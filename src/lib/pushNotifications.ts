import { Capacitor } from '@capacitor/core';
import type { PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { auth, db } from './firebase';
import { doc, setDoc, updateDoc, arrayUnion, arrayRemove, serverTimestamp } from 'firebase/firestore';
import { soundAlert } from './soundAlert';

let active: { uid: string; shopId: string; token?: string } | null = null;
let generation = 0;
let setup: Promise<PushRegistrationResult> | null = null;
let onReceived: ((notification: PushNotificationSchema) => void) | undefined;
let onAction: ((action: ActionPerformed) => void) | undefined;
export interface PushRegistrationResult { supported: boolean; registered: boolean; token?: string; error?: string }

export async function unregisterMerchantPushNotifications() {
  generation++;
  const previous = active;
  active = null; setup = null; onReceived = undefined; onAction = undefined;
  if (previous?.token && auth.currentUser?.uid === previous.uid) {
    try { await updateDoc(doc(db, 'shop_private', previous.shopId, 'devices', previous.uid), { tokens: arrayRemove(previous.token), updated_at: serverTimestamp() }); }
    catch { console.warn('Could not remove old push registration'); }
  }
  if (Capacitor.isNativePlatform()) {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    await PushNotifications.removeAllListeners();
    await PushNotifications.unregister().catch(() => {});
  }
  if (typeof window !== 'undefined') localStorage.removeItem('huaychan_fcm_token');
}

export async function registerMerchantPushNotifications(shopId: string, received?: (notification: PushNotificationSchema) => void, action?: (action: ActionPerformed) => void): Promise<PushRegistrationResult> {
  if (typeof window === 'undefined') return { supported: false, registered: false };
  if (!Capacitor.isNativePlatform()) {
    if (!('Notification' in window)) return { supported: false, registered: false };
    const permission = await Notification.requestPermission();
    return { supported: true, registered: permission === 'granted' };
  }
  const uid = auth.currentUser?.uid;
  if (!uid) return { supported: true, registered: false, error: 'กรุณาเข้าสู่ระบบก่อนเปิดแจ้งเตือน' };
  onReceived = received; onAction = action;
  if (active?.uid === uid && active.shopId === shopId && setup) return setup;
  if (active) await unregisterMerchantPushNotifications();
  onReceived = received; onAction = action;
  const current = ++generation;
  active = { uid, shopId };
  setup = (async () => {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      await PushNotifications.createChannel({ id: 'orders_channel', name: 'แจ้งเตือนออเดอร์ใหม่', importance: 5, visibility: 1, vibration: true });
      let permission = await PushNotifications.checkPermissions();
      if (permission.receive === 'prompt' || permission.receive === 'prompt-with-rationale') permission = await PushNotifications.requestPermissions();
      if (permission.receive !== 'granted') return { supported: true, registered: false, error: 'ยังไม่ได้อนุญาตการแจ้งเตือน' };
      if (generation !== current) return { supported: true, registered: false };
      await PushNotifications.removeAllListeners();
      await PushNotifications.addListener('registration', async ({ value }) => {
        if (generation !== current || auth.currentUser?.uid !== uid || !active) return;
        try {
          await setDoc(doc(db, 'shop_private', shopId, 'devices', uid), { tokens: arrayUnion(value), updated_at: serverTimestamp() }, { merge: true });
          if (generation === current && active) active.token = value;
        } catch { console.warn('Could not save private push registration'); }
      });
      await PushNotifications.addListener('registrationError', () => { console.warn('Push registration failed'); });
      await PushNotifications.addListener('pushNotificationReceived', notification => {
        if (generation !== current || auth.currentUser?.uid !== uid) return;
        soundAlert.playOrderChime(); onReceived?.(notification);
      });
      await PushNotifications.addListener('pushNotificationActionPerformed', event => {
        if (generation === current && auth.currentUser?.uid === uid) onAction?.(event);
      });
      if (generation !== current) return { supported: true, registered: false };
      await PushNotifications.register();
      return { supported: true, registered: true };
    } catch { return { supported: true, registered: false, error: 'เปิดแจ้งเตือนไม่สำเร็จ กรุณาลองใหม่' }; }
  })();
  const result = await setup;
  if (!result.registered && generation === current) setup = null;
  return result;
}
