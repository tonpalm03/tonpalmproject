'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { UserProfile, UserRole } from '@/types';
import { db, auth } from '@/lib/firebase';
import { doc, getDoc, setDoc, onSnapshot, runTransaction } from 'firebase/firestore';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  signInWithCustomToken,
} from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { unregisterMerchantPushNotifications } from '@/lib/pushNotifications';
import { initLiff, getLineIdToken, getValidLineIdToken, isLineTokenValid, lineLogin as triggerLineLogin, lineLogout as triggerLineLogout } from '@/lib/liff';

interface AuthContextType {
  user: UserProfile | null;
  role: UserRole;
  isLoading: boolean;
  isLiffAvailable: boolean;
  loginWithLine: () => Promise<{ success: boolean; redirecting?: boolean; error?: string }>;
  loginWithEmail: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  registerWithEmail: (email: string, pass: string, name: string, phone: string) => Promise<{ success: boolean; error?: string }>;
  updateUserPhone: (phone: string) => Promise<{ success: boolean; error?: string }>;
  updateUserProfile: (updates: {
    display_name?: string;
    picture_url?: string;
    phone?: string;
    default_address?: string;
    default_location?: { lat: number; lng: number };
  }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLiffAvailable, setIsLiffAvailable] = useState<boolean>(false);
  const [authError, setAuthError] = useState('');
  const allowLineLogin = useRef(true);

  useEffect(() => {
    let disposed = false, generation = 0, lineAttempted = false;
    let listeners: Array<() => void> = [];
    const stopListeners = () => { listeners.forEach(stop => stop()); listeners = []; };
    const unsubscribe = onAuthStateChanged(auth, async firebaseUser => {
      const current = ++generation;
      stopListeners(); setUser(null); setIsLoading(true); setAuthError('');
      const active = () => !disposed && generation === current;
      try {
        if (!firebaseUser) {
          localStorage.removeItem('hchk_uid'); localStorage.removeItem('hchk_user_cache');
          if (!lineAttempted && allowLineLogin.current) {
            lineAttempted = true;
            try {
              const result = await initLiff();
              if (!active()) return;
              setIsLiffAvailable(result.isInitialized);
              if (result.isLoggedIn) {
                const idToken = await getValidLineIdToken(30, 50);
                if (idToken) {
                  try {
                    const exchange = httpsCallable<{ idToken: string }, { token: string }>(functions, 'signInWithLine');
                    const response = await exchange({ idToken });
                    if (!active() || !allowLineLogin.current) return;
                    await signInWithCustomToken(auth, response.data.token);
                    return;
                  } catch (exchangeErr) {
                    console.warn('Auto LINE token exchange failed:', exchangeErr);
                  }
                } else {
                  console.warn('LIFF reports logged in but token not yet populated');
                }
              }
            } catch (lineErr) {
              console.warn('Auto LINE login check skipped:', lineErr);
            }
          }
          if (active()) setIsLoading(false);
          return;
        }

        // Fast immediate profile publication
        if (!active()) return;
        localStorage.setItem('hchk_uid', firebaseUser.uid);

        // Optimistic cached profile to eliminate loading latency on PC / Mobile
        try {
          const cachedRaw = localStorage.getItem('hchk_user_cache');
          if (cachedRaw) {
            const cached = JSON.parse(cachedRaw);
            if (cached && cached.uid === firebaseUser.uid) {
              setUser(cached);
              setIsLoading(false);
            }
          }
        } catch (_) {}

        const ref = doc(db, 'users', firebaseUser.uid);

        // Background non-blocking user doc baseline guarantee (only creates if missing)
        getDoc(ref).then((snap) => {
          if (!snap.exists()) {
            setDoc(ref, {
              uid: firebaseUser.uid,
              display_name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'ผู้ใช้งาน',
              picture_url: firebaseUser.photoURL || '',
              role: 'customer',
              created_at: new Date().toISOString(),
            }).catch((err) => console.warn('Background profile baseline check warning:', err));
          }
        }).catch((err) => console.warn('Background profile check error:', err));

        let profile: UserProfile | null = null;
        let accessReady = false;
        let authority: { role: UserRole; shop_id?: string } = { role: 'customer' };
        const publish = () => {
          if (!active() || !accessReady) return;
          const resolvedProfile = profile || {
            uid: firebaseUser.uid,
            display_name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'ผู้ใช้งาน',
            picture_url: firebaseUser.photoURL || '',
            role: authority.role,
            created_at: new Date().toISOString(),
          };
          const fullUser = { ...resolvedProfile, uid: firebaseUser.uid, role: authority.role, shop_id: authority.shop_id };
          setUser(fullUser);
          localStorage.setItem('hchk_user_cache', JSON.stringify(fullUser));
          setIsLoading(false);
        };
        const fail = () => { if (active()) { generation++; stopListeners(); setUser(null); setIsLoading(false); setAuthError('ตรวจสอบสิทธิ์บัญชีไม่สำเร็จ กรุณาเข้าสู่ระบบใหม่'); } };
        listeners.push(onSnapshot(ref, snapshot => { profile = snapshot.exists() ? snapshot.data() as UserProfile : null; publish(); }, fail));
        listeners.push(onSnapshot(doc(db, 'access', firebaseUser.uid), snapshot => {
          const data = snapshot.data();
          authority = data && ['admin', 'merchant', 'customer'].includes(data.role)
            ? { role: data.role, shop_id: data.role === 'merchant' ? data.shop_id : undefined } : { role: 'customer' };
          accessReady = true; publish();
        }, fail));
      } catch (error) {
        if (active()) {
          setUser(null);
          setIsLoading(false);
          console.warn('Authentication initialization warning:', error instanceof Error ? error.message : 'unknown');
        }
      }
    });
    return () => { disposed = true; generation++; unsubscribe(); stopListeners(); };
  }, []);

  const loginWithEmail = async (email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setIsLoading(true);
      await signInWithEmailAndPassword(auth, email.trim(), pass);
      return { success: true };
    } catch (err: unknown) {
      const code = err instanceof FirebaseError ? err.code : '';
      setIsLoading(false);
      let errorMsg = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
      if (code === 'auth/user-not-found') errorMsg = 'ไม่พบบัญชีผู้ใช้นี้ในระบบ';
      if (code === 'auth/wrong-password') errorMsg = 'รหัสผ่านไม่ถูกต้อง';
      if (code === 'auth/invalid-email') errorMsg = 'รูปแบบอีเมลไม่ถูกต้อง';
      return { success: false, error: errorMsg };
    }
  };

  const registerWithEmail = async (
    email: string,
    pass: string,
    name: string,
    phone: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      setIsLoading(true);
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
      const userRef = doc(db, 'users', cred.user.uid);
      const newProfile: UserProfile = {
        uid: cred.user.uid,
        line_user_id: `EMAIL_${cred.user.uid}`,
        display_name: name.trim() || email.split('@')[0],
        picture_url: '',
        phone: phone.trim() || '',
        role: 'customer', // Always customer by default, admin can promote to merchant
        created_at: new Date().toISOString(),
      };
      await runTransaction(db, async tx => {
        if ((await tx.get(userRef)).exists()) tx.update(userRef, { display_name: newProfile.display_name, phone: newProfile.phone });
        else tx.set(userRef, newProfile);
      });

      return { success: true };
    } catch (err: unknown) {
      const code = err instanceof FirebaseError ? err.code : '';
      setIsLoading(false);
      let errorMsg = 'ไม่สามารถสมัครสมาชิกได้';
      if (code === 'auth/email-already-in-use') errorMsg = 'อีเมลนี้ถูกใช้งานไปแล้ว';
      if (code === 'auth/weak-password') errorMsg = 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร';
      if (code === 'auth/invalid-email') errorMsg = 'รูปแบบอีเมลไม่ถูกต้อง';
      return { success: false, error: errorMsg };
    }
  };

  const loginWithLine = async (): Promise<{ success: boolean; redirecting?: boolean; error?: string }> => {
    try {
      allowLineLogin.current = true;
      setIsLoading(true);
      setAuthError('');
      const initResult = await initLiff();
      if (!initResult.isInitialized) {
        setIsLoading(false);
        const err = 'ไม่สามารถเชื่อมต่อระบบ LINE ได้ กรุณาลองใหม่อีกครั้ง';
        setAuthError(err);
        return { success: false, error: err };
      }

      if (initResult.isLoggedIn) {
        const idToken = await getValidLineIdToken(30, 50);
        if (idToken) {
          try {
            const exchange = httpsCallable<{ idToken: string }, { token: string }>(functions, 'signInWithLine');
            const response = await exchange({ idToken });
            await signInWithCustomToken(auth, response.data.token);
            setIsLoading(false);
            return { success: true };
          } catch (exchangeErr: any) {
            console.warn('LINE token exchange failed, refreshing session:', exchangeErr);
            triggerLineLogout();
            const redirectRes = triggerLineLogin(true);
            if (redirectRes.status === 'redirecting') {
              return { success: true, redirecting: true };
            }
            setIsLoading(false);
            const msg = 'ไม่สามารถยืนยันตัวตนกับ LINE ได้ กรุณาลองใหม่อีกครั้ง';
            setAuthError(msg);
            return { success: false, error: msg };
          }
        }
      }

      const redirectRes = triggerLineLogin();
      if (redirectRes.status === 'redirecting') {
        return { success: true, redirecting: true };
      }
      setIsLoading(false);
      return { success: false, error: redirectRes.error || 'ไม่สามารถเปิดหน้าเข้าสู่ระบบ LINE ได้' };
    } catch (err: unknown) {
      setIsLoading(false);
      const msg = err instanceof Error ? err.message : 'เข้าสู่ระบบ LINE ไม่สำเร็จ';
      setAuthError(msg);
      console.error('loginWithLine error:', err);
      return { success: false, error: msg };
    }
  };

  const updateUserPhone = async (phone: string): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'ยังไม่ได้เข้าสู่ระบบ' };
    const cleanPhone = phone.trim();
    const updated = { ...user, phone: cleanPhone };
    setUser(updated);
    localStorage.setItem('hchk_user_cache', JSON.stringify(updated));
    try {
      await setDoc(doc(db, 'users', user.uid), { phone: cleanPhone }, { merge: true });
      return { success: true };
    } catch (e: any) {
      console.warn('Phone update to Firestore failed:', e);
      return { success: false, error: e?.message || 'บันทึกเบอร์โทรศัพท์ไม่สำเร็จ' };
    }
  };

  const updateUserProfile = async (updates: {
    display_name?: string;
    picture_url?: string;
    phone?: string;
    default_address?: string;
    default_location?: { lat: number; lng: number };
  }): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'ยังไม่ได้เข้าสู่ระบบ' };
    const allowedKeys = ['display_name', 'picture_url', 'phone', 'default_address', 'default_location'] as const;
    const cleanUpdates: Record<string, any> = {};
    for (const key of allowedKeys) {
      if (key in updates && updates[key] !== undefined) {
        cleanUpdates[key] = updates[key];
      }
    }
    if (cleanUpdates.display_name !== undefined && !cleanUpdates.display_name.trim()) {
      return { success: false, error: 'กรุณากรอกชื่อโปรไฟล์' };
    }
    const updated = { ...user, ...cleanUpdates };
    setUser(updated);
    localStorage.setItem('hchk_user_cache', JSON.stringify(updated));
    try {
      await setDoc(doc(db, 'users', user.uid), cleanUpdates, { merge: true });
      return { success: true };
    } catch (e: any) {
      console.warn('Profile update to Firestore failed:', e);
      return { success: false, error: e?.message || 'บันทึกข้อมูลไม่สำเร็จ' };
    }
  };

  const logout = async () => {
    allowLineLogin.current = false;
    await unregisterMerchantPushNotifications().catch(() => console.warn('Push cleanup failed during sign-out'));
    try {
      await firebaseSignOut(auth);
    } catch (e) {
      console.warn('Firebase signout error:', e);
      setAuthError('ออกจากระบบไม่สำเร็จ กรุณาลองใหม่');
      return;
    }
    triggerLineLogout();
    localStorage.removeItem('hchk_uid');
    localStorage.removeItem('hchk_user_cache');
    localStorage.removeItem('hchk_cart');   // BUG-03: clear cart so next user can't see it
    localStorage.removeItem('hchk_orders'); // clear order tracking too
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('hchk_auth_reset'));
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      role: user?.role || 'customer',
      isLoading,
      isLiffAvailable,
      loginWithLine,
      loginWithEmail,
      registerWithEmail,
      updateUserPhone,
      updateUserProfile,
      logout,
    }}>
      {authError && (
        <div role="alert" className="bg-red-50 border-b border-red-200 px-4 py-2 text-xs text-red-700 flex items-center justify-between gap-2">
          <span>{authError}</span>
          <button
            type="button"
            onClick={() => setAuthError('')}
            className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-red-200 text-red-600 font-bold text-xs shrink-0"
            title="ปิดการแจ้งเตือน"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
