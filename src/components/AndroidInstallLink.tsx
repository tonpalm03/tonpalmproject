'use client';

import React, { useEffect, useState } from 'react';
import { Download, Smartphone } from 'lucide-react';
import { INSTALL_PAGE_URL, isAndroidWeb } from '@/lib/androidApp';

type Variant = 'merchant' | 'row' | 'footer';

/** Link to the Android install page, shown only to Android phones browsing the website. */
export default function AndroidInstallLink({ variant }: { variant: Variant }) {
  const [show, setShow] = useState(false);
  useEffect(() => setShow(isAndroidWeb()), []);
  if (!show) return null;

  if (variant === 'footer') {
    return (
      <a href={INSTALL_PAGE_URL} className="hover:text-brand-600 underline font-semibold transition text-xs sm:text-sm inline-flex items-center gap-1">
        <Smartphone className="w-3.5 h-3.5" />
        <span>Download for Android</span>
      </a>
    );
  }

  if (variant === 'row') {
    return (
      <a
        href={INSTALL_PAGE_URL}
        className="w-full py-2.5 px-4 rounded-2xl border border-brand-200 bg-white hover:bg-brand-50 text-brand-900 font-bold text-xs flex items-center justify-between transition active:scale-98"
      >
        <span className="flex items-center gap-2">
          <Smartphone className="w-3.5 h-3.5 text-brand-500" />
          <span>ติดตั้งแอป CPRUFood (Android)</span>
        </span>
        <Download className="w-3.5 h-3.5 text-brand-500" />
      </a>
    );
  }

  return (
    <a
      href={INSTALL_PAGE_URL}
      className="w-full p-3 rounded-2xl bg-[#E3F5D9] border border-[#B0E294] flex items-center gap-3 active:scale-98 transition"
    >
      <span className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shrink-0">
        <Smartphone className="w-5 h-5 text-[#177A34]" />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-xs font-black text-[#14361C]">ติดตั้งแอปเพื่อไม่พลาดออเดอร์</span>
        <span className="block text-xs text-[#177A34]">มีเสียงแจ้งเตือนแม้ปิดหน้าจอ และนำทางส่งอาหารได้</span>
      </span>
      <Download className="w-4 h-4 text-[#177A34] shrink-0" />
    </a>
  );
}
