'use client';

import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Copy, Download, X } from 'lucide-react';
import { ApkVersion, fetchLatestApkVersion } from '@/lib/androidApp';

const INSTALL_LINK = 'https://cprufood.web.app/install';
const DISMISS_KEY = 'cprufood_update_dismissed';

/**
 * Inside the Android app, tells the user when a newer APK is on the site. Web changes reach
 * the app on their own; only native changes (new plugins, permissions) need a new APK.
 */
export default function AppUpdateNotice() {
  const [latest, setLatest] = useState<ApkVersion | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;
    (async () => {
      const [info, newest] = await Promise.all([App.getInfo().catch(() => null), fetchLatestApkVersion()]);
      if (!info || !newest || Number(info.build) >= newest.versionCode) return;
      try {
        if (localStorage.getItem(DISMISS_KEY) === String(newest.versionCode)) return;
      } catch {}
      setLatest(newest);
    })();
  }, []);

  if (!latest) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(latest.versionCode)); } catch {}
    setLatest(null);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(INSTALL_LINK);
      setCopied(true);
    } catch {}
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-[60] max-w-md mx-auto bg-white rounded-2xl border border-[#9FE1CB] shadow-xl p-3.5 animate-in fade-in slide-in-from-bottom-3">
      <button type="button" onClick={dismiss} aria-label="ปิด" className="absolute top-2 right-2 w-7 h-7 rounded-full hover:bg-gray-100 flex items-center justify-center">
        <X className="w-4 h-4 text-gray-400" />
      </button>
      <div className="flex gap-3 pr-6">
        <span className="w-9 h-9 rounded-xl bg-[#E1F5EE] flex items-center justify-center shrink-0">
          <Download className="w-5 h-5 text-[#0F6E56]" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-black text-gray-900">มีแอปเวอร์ชันใหม่ {latest.versionName}</p>
          <p className="text-xs text-gray-500 leading-relaxed mt-0.5">
            เปิดลิงก์นี้ใน Chrome เพื่อโหลดแอปใหม่ ติดตั้งทับได้เลย ข้อมูลเดิมไม่หาย
          </p>
          <button
            type="button"
            onClick={copyLink}
            className="mt-2 h-8 px-3 rounded-xl bg-brand-500 text-white text-xs font-bold inline-flex items-center gap-1.5 active:scale-95 transition"
          >
            <Copy className="w-3.5 h-3.5" /> {copied ? 'คัดลอกลิงก์แล้ว' : 'คัดลอกลิงก์ดาวน์โหลด'}
          </button>
        </div>
      </div>
    </div>
  );
}
