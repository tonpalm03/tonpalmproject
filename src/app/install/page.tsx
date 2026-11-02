'use client';

import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Download, Home, Smartphone, ShieldCheck, Bell, Navigation, Info } from 'lucide-react';
import WavePattern from '@/components/WavePattern';
import { APK_URL, ApkVersion, fetchLatestApkVersion, isInLineApp } from '@/lib/androidApp';

type Device = 'android' | 'ios' | 'native' | 'other';

const STEPS = [
  'กดปุ่ม "ดาวน์โหลดแอป" ด้านบน',
  'โหลดเสร็จแล้ว กดเปิดไฟล์ cprufood.apk จากแถบแจ้งเตือน หรือในแอปไฟล์ของฉัน',
  'ถ้ามือถือถามเรื่องติดตั้งแอปจากแหล่งที่ไม่รู้จัก ให้กด "การตั้งค่า" แล้วเปิด "อนุญาตจากแหล่งนี้"',
  'กด "ติดตั้ง" ถ้ามีคำเตือนจาก Play Protect ให้กด "ติดตั้งต่อไป" (แอปนี้ไม่ได้ลงใน Play Store จึงมีคำเตือนนี้)',
  'เปิดแอป CPRUFood แล้วเข้าสู่ระบบด้วยบัญชีเดิม',
];

export default function InstallPage() {
  const [device, setDevice] = useState<Device>('other');
  const [inLine, setInLine] = useState(false);
  const [version, setVersion] = useState<ApkVersion | null>(null);

  useEffect(() => {
    const ua = navigator.userAgent;
    setDevice(Capacitor.isNativePlatform() ? 'native' : /android/i.test(ua) ? 'android' : /iphone|ipad|ipod/i.test(ua) ? 'ios' : 'other');
    setInLine(isInLineApp());
    fetchLatestApkVersion().then(setVersion);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="relative overflow-hidden isolate rounded-3xl bg-gradient-to-br from-[#E3F5D9] to-[#D3F0C2] p-5 text-center">
          <WavePattern className="text-white/90 -z-10" />
          <img src="/mascots/pung-deng-hello.webp" alt="น้องพุงเด้งโบกมือ" className="w-28 mx-auto select-none drop-shadow-sm" />
          <h1 className="mt-2 text-xl font-black text-[#14361C]">แอป CPRUFood สำหรับ Android</h1>
          <p className="mt-1 text-xs font-bold text-[#177A34]">
            {version ? `เวอร์ชัน ${version.versionName}` : 'เวอร์ชันล่าสุด'}
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-4 space-y-3">
          <ul className="space-y-2 text-xs text-gray-600">
            <li className="flex items-center gap-2"><Bell className="w-4 h-4 text-brand-500 shrink-0" /> แจ้งเตือนออเดอร์และแชทพร้อมเสียง แม้ปิดหน้าจอ</li>
            <li className="flex items-center gap-2"><Navigation className="w-4 h-4 text-brand-500 shrink-0" /> ใช้ GPS และนำทางส่งอาหารได้แม่นยำกว่าเว็บ</li>
            <li className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-brand-500 shrink-0" /> อัปเดตเมนูและหน้าตาแอปเองทุกครั้งที่เราปรับปรุง</li>
          </ul>

          {device === 'native' ? (
            <p className="p-3 rounded-2xl bg-brand-50 text-brand-800 text-xs font-bold text-center">คุณใช้แอป CPRUFood อยู่แล้ว</p>
          ) : device === 'ios' ? (
            <p className="p-3 rounded-2xl bg-amber-50 text-amber-800 text-xs leading-relaxed">
              แอปนี้ใช้ได้เฉพาะ Android ส่วน iPhone สั่งอาหารผ่านเว็บนี้ได้เลย หรือกดปุ่มแชร์ใน Safari แล้วเลือก "เพิ่มไปยังหน้าจอโฮม"
            </p>
          ) : (
            <>
              {inLine && (
                <p className="p-3 rounded-2xl bg-amber-50 text-amber-800 text-xs leading-relaxed flex gap-2">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>LINE โหลดไฟล์แอปไม่ได้ กดเมนูมุมขวาบน แล้วเลือก "เปิดในเบราว์เซอร์อื่น" ก่อนกดดาวน์โหลด</span>
                </p>
              )}
              <a
                href={APK_URL}
                download="cprufood.apk"
                className="w-full py-3.5 rounded-2xl bg-brand-500 hover:bg-brand-600 text-white font-black text-sm flex items-center justify-center gap-2 shadow-md active:scale-98 transition"
              >
                <Download className="w-5 h-5" /> ดาวน์โหลดแอป
              </a>
              {device === 'other' && (
                <p className="text-xs text-gray-400 text-center flex items-center justify-center gap-1">
                  <Smartphone className="w-3.5 h-3.5" /> เปิดหน้านี้จากมือถือ Android เพื่อติดตั้ง
                </p>
              )}
            </>
          )}
        </div>

        {device !== 'native' && device !== 'ios' && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-4">
            <h2 className="text-sm font-black text-gray-800 mb-3">วิธีติดตั้ง</h2>
            <ol className="space-y-2.5">
              {STEPS.map((step, i) => (
                <li key={i} className="flex gap-2.5 text-xs text-gray-600 leading-relaxed">
                  <span className="w-5 h-5 rounded-full bg-[#E3F5D9] text-[#11592A] text-xs font-black flex items-center justify-center shrink-0">{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <a
          href="/"
          className="w-full py-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 font-bold text-xs flex items-center justify-center gap-1.5"
        >
          <Home className="w-4 h-4" /> กลับหน้าหลัก
        </a>
      </div>
    </div>
  );
}
