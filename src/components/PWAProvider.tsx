'use client';

import React, { useState, useEffect } from 'react';
import { Smartphone, Download, X, Share } from 'lucide-react';

export default function PWAProvider() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    const CURRENT_BUILD = 'huaychan-20260917-v6';

    // 0. Auto-Purge Old CacheStorage directly from browser window.caches
    if (typeof window !== 'undefined' && typeof caches !== 'undefined') {
      caches.keys().then((keys) => {
        keys.forEach((key) => {
          console.log('[CacheBuster] Deleting cache:', key);
          caches.delete(key);
        });
      });
    }

    // 1. Check version migration: force-clean and reload once on version mismatch
    if (typeof window !== 'undefined') {
      const lastVersion = localStorage.getItem('huaychan_build_version');
      if (lastVersion !== CURRENT_BUILD) {
        localStorage.setItem('huaychan_build_version', CURRENT_BUILD);
        if (typeof caches !== 'undefined') {
          caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).finally(() => {
            (window as any).location.reload();
          });
        } else {
          (window as any).location.reload();
        }
        return;
      }
    }

    // 2. Register Service Worker & iOS Anti-Cache Update Triggers
    let cleanupListeners = () => {};

    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      let registration: ServiceWorkerRegistration | null = null;
      let refreshing = false;

      // When the active service worker changes, reload to consume fresh assets
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });

      const registerSW = () => {
        navigator.serviceWorker
          .register('/sw.js', { updateViaCache: 'none' })
          .then((reg) => {
            registration = reg;

            // If there's an updated worker waiting, activate it immediately
            if (reg.waiting) {
              reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            }

            reg.addEventListener('updatefound', () => {
              const newWorker = reg.installing;
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    newWorker.postMessage({ type: 'SKIP_WAITING' });
                  }
                });
              }
            });

            reg.update().catch(() => {});
          })
          .catch((err) => console.warn('PWA Service Worker registration error:', err));
      };

      if (document.readyState === 'complete') {
        registerSW();
      } else {
        window.addEventListener('load', registerSW);
      }

      // Special iOS & Mobile Handler: Check for updates when user returns to app
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible' && registration) {
          registration.update().catch(() => {});
        }
      };

      // Special iOS Safari back-forward cache handler (bfcache)
      const handlePageShow = (e: PageTransitionEvent) => {
        if (e.persisted && registration) {
          registration.update().catch(() => {});
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('pageshow', handlePageShow);
      const onlineHandler = () => registration?.update().catch(() => {});
      window.addEventListener('online', onlineHandler);

      cleanupListeners = () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('pageshow', handlePageShow);
        window.removeEventListener('online', onlineHandler);
      };
    }

    // 2. Check if already installed / standalone mode
    let timer: NodeJS.Timeout | null = null;
    const isStandaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(isStandaloneMode);

    // Check if iOS device
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // Check if user dismissed banner recently
    const dismissedUntil = localStorage.getItem('hchk_pwa_dismissed');
    const isDismissed = dismissedUntil && Number(dismissedUntil) > Date.now();

    if (!isStandaloneMode && !isDismissed) {
      // Delay showing banner slightly for smooth UX
      timer = setTimeout(() => {
        setShowInstallBanner(true);
      }, 2500);
    }

    // 3. Android / Chrome beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      cleanupListeners();
      if (timer) clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log('User PWA install response:', outcome);
      setDeferredPrompt(null);
      setShowInstallBanner(false);
    } else if (isIOS) {
      setShowIOSGuide(true);
    } else {
      alert('สามารถกดที่เมนู 3 จุดของเบราว์เซอร์ แล้วเลือก "ติดตั้งแอพ" หรือ "เพิ่มลงในหน้าจอหลัก" ได้ทันทีครับ');
    }
  };

  const handleDismiss = () => {
    setShowInstallBanner(false);
    // Dismiss for 2 days
    localStorage.setItem('hchk_pwa_dismissed', String(Date.now() + 2 * 24 * 60 * 60 * 1000));
  };

  // If already running as standalone app, don't show any install prompts
  if (isStandalone) return null;

  return (
    <>
      {/* Floating Bottom Install Banner */}
      {showInstallBanner && (
        <div className="fixed bottom-20 left-3 right-3 sm:left-auto sm:right-5 sm:max-w-md z-40 animate-in slide-in-from-bottom-5 duration-300">
          <div className="bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-2xl shadow-2xl border border-amber-500/30 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-xl shadow-md shrink-0">
                <Smartphone className="w-5 h-5 text-slate-950" />
              </div>
              <div className="text-left">
                <p className="font-bold text-xs leading-tight text-white flex items-center gap-1">
                  ติดตั้งแอปลงมือถือ
                  <span className="bg-amber-500 text-[9px] font-black px-1.5 py-0.5 rounded-full text-slate-900">
                    แนะนำ
                  </span>
                </p>
                <p className="text-[10px] text-gray-300 mt-0.5">
                  เปิดไว จอเต็มตา สั่งอาหารสะดวกเหมือนแอปจริง
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleInstallClick}
                className="py-1.5 px-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-md transition active:scale-95 flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>ติดตั้ง</span>
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="w-7 h-7 rounded-full text-gray-400 hover:text-white flex items-center justify-center transition"
                title="ปิด"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* iOS Safari Guide Modal */}
      {showIOSGuide && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-3 animate-in fade-in"
          onClick={() => setShowIOSGuide(false)}
        >
          <div
            className="bg-white rounded-3xl p-5 max-w-sm w-full text-center space-y-4 shadow-2xl animate-in slide-in-from-bottom-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto shadow-xs">
              <Smartphone className="w-6 h-6 text-amber-700" />
            </div>
            <div>
              <h3 className="font-black text-base text-gray-900">วิธีติดตั้งบน iPhone (iOS)</h3>
              <p className="text-xs text-gray-500 mt-1">
                ทำตาม 2 ขั้นตอนง่าย ๆ เพื่อเพิ่มไอคอนแอปลงบนหน้าจอโฮม
              </p>
            </div>

            <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-200 text-left space-y-2.5 text-xs">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-amber-500 text-white font-black flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                  1
                </span>
                <p className="text-gray-700">
                  แตะปุ่ม <strong>แชร์ (Share)</strong> <Share className="w-3.5 h-3.5 inline text-blue-500" /> ที่แถบด้านล่างของ Safari
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-amber-500 text-white font-black flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                  2
                </span>
                <p className="text-gray-700">
                  เลื่อนลงมาแล้วเลือก <strong>"เพิ่มไปยังหน้าจอโฮม" (Add to Home Screen)</strong>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-md transition active:scale-95"
            >
              เข้าใจแล้ว
            </button>
          </div>
        </div>
      )}
    </>
  );
}
