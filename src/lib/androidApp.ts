import { Capacitor } from '@capacitor/core';

/**
 * The Android app is sideloaded from our own site. The APK and its version file live in
 * public/download; bump version.json whenever a new APK is uploaded there.
 */
export const APK_URL = '/download/cprufood.apk';
export const APK_VERSION_URL = '/download/version.json';

// LINE's in-app browser can't download files. This flag asks LINE to reopen the page in the phone's browser.
export const INSTALL_PAGE_URL = '/install?openExternalBrowser=1';

export interface ApkVersion {
  versionCode: number;
  versionName: string;
}

/** True on an Android phone browsing the website (not inside our app). */
export function isAndroidWeb() {
  if (typeof navigator === 'undefined' || Capacitor.isNativePlatform()) return false;
  return /android/i.test(navigator.userAgent);
}

export function isInLineApp() {
  return typeof navigator !== 'undefined' && /\bLine\//i.test(navigator.userAgent);
}

export async function fetchLatestApkVersion(): Promise<ApkVersion | null> {
  try {
    const res = await fetch(APK_VERSION_URL, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.versionCode === 'number' ? data : null;
  } catch {
    return null;
  }
}
