'use client';

import liff from '@line/liff';

export interface LineUserProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

export interface LiffInitResult {
  isInitialized: boolean;
  isLoggedIn: boolean;
  profile?: LineUserProfile;
  error?: string;
}

export interface LineLoginResult {
  status: 'redirecting' | 'authenticated' | 'in_client' | 'failed';
  error?: string;
}

// Store the initialization promise alone so subsequent calls check live SDK status
let sdkInitPromise: Promise<boolean> | null = null;

export function isLineTokenValid(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    if (!liff.isLoggedIn()) return false;
    const token = liff.getIDToken();
    if (!token || typeof token !== 'string' || token.length < 20) return false;
    const decoded = liff.getDecodedIDToken();
    if (!decoded || !decoded.exp) return false;
    // Ensure token is not expired (with 30-second clock skew buffer)
    return decoded.exp > (Date.now() / 1000) + 30;
  } catch {
    return false;
  }
}

/**
 * Polls and waits for LIFF to populate and validate the ID token
 * Critical for mobile browsers (iOS Safari / Android Chrome / WebViews) where token storage hydration is async.
 */
export async function getValidLineIdToken(maxAttempts: number = 8, intervalMs: number = 200): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  for (let i = 0; i < maxAttempts; i++) {
    try {
      if (liff.isLoggedIn()) {
        const token = liff.getIDToken();
        if (token && typeof token === 'string' && token.length > 20) {
          const decoded = liff.getDecodedIDToken();
          if (decoded && typeof decoded.exp === 'number') {
            const nowSec = Math.floor(Date.now() / 1000);
            if (decoded.exp > nowSec + 30) {
              return token;
            }
          }
        }
      }
    } catch (e) {
      console.warn('Waiting for LIFF ID token attempt:', i + 1, e);
    }
    if (i < maxAttempts - 1) {
      await new Promise(r => setTimeout(r, intervalMs));
    }
  }
  return null;
}

async function ensureLiffSdkInitialized(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  if (liff.id) {
    if (liff.ready) await liff.ready;
    return true;
  }

  if (sdkInitPromise) return sdkInitPromise;

  sdkInitPromise = (async (): Promise<boolean> => {
    const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID;
    if (!liffId) {
      console.warn('NEXT_PUBLIC_LINE_LIFF_ID is not configured');
      return false;
    }

    try {
      if (!liff.id) {
        await liff.init({ liffId });
      }
      if (liff.ready) {
        await liff.ready;
      }

      // Clean up OAuth query parameters from URL without reloading
      try {
        if (typeof window !== 'undefined' && (window.location.search.includes('code=') || window.location.search.includes('liffClientId='))) {
          const cleanUrl = `${window.location.origin}${window.location.pathname}`;
          window.history.replaceState({}, document.title, cleanUrl);
        }
      } catch (_) {}

      return true;
    } catch (err) {
      console.warn('LINE LIFF SDK Init Error:', err);
      sdkInitPromise = null;
      return false;
    }
  })();

  return sdkInitPromise;
}

/**
 * Initialize LIFF and return real-time authentication status without blocking on getProfile()
 */
export async function initLiff(forceRefresh: boolean = false): Promise<LiffInitResult> {
  if (typeof window === 'undefined') {
    return { isInitialized: false, isLoggedIn: false };
  }

  if (forceRefresh) {
    sdkInitPromise = null;
  }

  const isInitialized = await ensureLiffSdkInitialized();
  if (!isInitialized) {
    return { isInitialized: false, isLoggedIn: false, error: 'INIT_FAILED' };
  }

  const isLoggedIn = liff.isLoggedIn();
  return {
    isInitialized: true,
    isLoggedIn,
  };
}

/**
 * Independent lazy profile loader that never blocks core authentication pipeline
 */
export async function getLineProfile(): Promise<LineUserProfile | null> {
  try {
    if (typeof window === 'undefined' || !liff.isLoggedIn()) return null;
    const p = await liff.getProfile();
    if (!p) return null;
    return {
      userId: p.userId,
      displayName: p.displayName,
      pictureUrl: p.pictureUrl,
      statusMessage: p.statusMessage,
    };
  } catch (err) {
    console.warn('Lazy getLineProfile failed:', err);
    return null;
  }
}

/**
 * Initiate LINE OAuth login with environment checking and proper error propagation
 */
export function lineLogin(force: boolean = false): LineLoginResult {
  if (typeof window === 'undefined') {
    return { status: 'failed', error: 'WINDOW_UNDEFINED' };
  }

  try {
    // If running inside LINE App (in-client browser), auth is handled natively by LIFF
    if (liff.isInClient?.() && liff.isLoggedIn()) {
      return { status: 'in_client' };
    }

    if (force && liff.isLoggedIn()) {
      try {
        liff.logout();
      } catch (_) {}
    }

    const redirectUri = `${window.location.origin}${window.location.pathname}`;
    liff.login({ redirectUri });
    return { status: 'redirecting' };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'LIFF_LOGIN_ERROR';
    console.error('LIFF login execution error:', err);
    return { status: 'failed', error: errorMsg };
  }
}

export function getLineIdToken(): string | null {
  try {
    if (typeof window === 'undefined') return null;
    return liff.getIDToken();
  } catch (_) {
    return null;
  }
}

export function lineLogout() {
  sdkInitPromise = null;
  try {
    if (typeof window !== 'undefined' && liff.isLoggedIn()) {
      liff.logout();
    }
  } catch (e) {
    console.warn('LIFF logout error:', e);
  }
}
