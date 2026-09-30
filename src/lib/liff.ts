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

let liffInitPromise: Promise<LiffInitResult> | null = null;

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

export async function initLiff(forceRefresh: boolean = false): Promise<LiffInitResult> {
  if (typeof window === 'undefined') {
    return { isInitialized: false, isLoggedIn: false };
  }

  if (forceRefresh) {
    liffInitPromise = null;
  }

  // Reuse pending or completed initialization promise to avoid concurrent init errors
  if (liffInitPromise) {
    return liffInitPromise;
  }

  liffInitPromise = (async (): Promise<LiffInitResult> => {
    const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID;

    if (!liffId) {
      console.warn('NEXT_PUBLIC_LINE_LIFF_ID is not configured');
      return { isInitialized: false, isLoggedIn: false, error: 'NO_LIFF_ID' };
    }

    try {
      if (!liff.id) {
        await liff.init({ liffId });
      }

      // On iOS Safari / WebKit and desktop browsers, ensure storage sync
      if (liff.ready) {
        await liff.ready;
      }

      const loggedIn = liff.isLoggedIn();

      let profile: LineUserProfile | undefined = undefined;
      if (loggedIn) {
        // Safe profile extraction: profile failure on iOS/PC must NEVER block authentication
        try {
          const p = await liff.getProfile().catch(() => null);
          if (p) {
            profile = {
              userId: p.userId,
              displayName: p.displayName,
              pictureUrl: p.pictureUrl,
              statusMessage: p.statusMessage,
            };
          }
        } catch (profileErr) {
          console.warn('LIFF getProfile non-critical warning:', profileErr);
        }
      }

      // Clean up URL parameters left after OAuth redirect callback
      try {
        if (typeof window !== 'undefined' && (window.location.search.includes('code=') || window.location.search.includes('liffClientId='))) {
          const cleanUrl = `${window.location.origin}${window.location.pathname}`;
          window.history.replaceState({}, document.title, cleanUrl);
        }
      } catch (_) {}

      return {
        isInitialized: true,
        isLoggedIn: loggedIn,
        profile,
      };
    } catch (err: unknown) {
      console.warn('LINE LIFF Init Error:', err);
      liffInitPromise = null;
      return {
        isInitialized: false,
        isLoggedIn: false,
        error: err instanceof Error ? err.message : 'UNKNOWN_ERROR',
      };
    }
  })();

  return liffInitPromise;
}

export function lineLogin(force: boolean = false) {
  if (typeof window === 'undefined') return;
  liffInitPromise = null;

  try {
    if (force && liff.isLoggedIn()) {
      try { liff.logout(); } catch (_) {}
    }
    // Explicitly provide redirectUri so LINE OAuth never has mismatch with current origin
    const redirectUri = `${window.location.origin}${window.location.pathname}`;
    liff.login({ redirectUri });
  } catch (err) {
    console.error('LIFF login execution error:', err);
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
  liffInitPromise = null;
  try {
    if (typeof window !== 'undefined' && liff.isLoggedIn()) {
      liff.logout();
    }
  } catch (e) {
    console.warn('LIFF logout error:', e);
  }
}

