'use client';

import React, { useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { X, Heart, Copy, Check, ImagePlus, ArrowLeft, QrCode } from 'lucide-react';
import { db } from '@/lib/firebase';
import { SystemSettings, UserProfile } from '@/types';
import { MASCOT_AVATAR, compressSlip } from '@/lib/donations';
import Toggle from './Toggle';
import MascotWatermark from './MascotWatermark';

interface DonateModalProps {
  settings: SystemSettings | null;
  user: UserProfile | null;
  onRequireLogin: () => void;
  onClose: () => void;
}

export default function DonateModal({ settings, user, onRequireLogin, onClose }: DonateModalProps) {
  const [step, setStep] = useState<'qr' | 'form' | 'done'>('qr');
  const [copied, setCopied] = useState(false);
  const [slip, setSlip] = useState('');
  const [amount, setAmount] = useState('');
  const [name, setName] = useState(user?.display_name ?? '');
  const [message, setMessage] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [hideAmount, setHideAmount] = useState(false);
  const [busy, setBusy] = useState(false);

  const number = settings?.donate_promptpay_number?.trim();

  const copyNumber = async () => {
    if (!number) return;
    try {
      await navigator.clipboard.writeText(number.replace(/\D/g, ''));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked; the number is still visible */ }
  };

  const goToForm = () => {
    if (!user) { onRequireLogin(); return; }
    setStep('form');
  };

  const pickSlip = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      setSlip(await compressSlip(file));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'อ่านรูปไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!user) return onRequireLogin();
    const value = Number(amount);
    if (!slip) return alert('กรุณาแนบสลิปการโอน');
    if (!Number.isFinite(value) || value < 1) return alert('กรุณาใส่ยอดเงินที่โอน');
    if (!anonymous && !name.trim()) return alert('กรุณาใส่ชื่อที่จะแสดง');
    setBusy(true);
    try {
      await addDoc(collection(db, 'donation_requests'), {
        uid: user.uid,
        display_name: (name.trim() || user.display_name || 'ผู้ใช้').slice(0, 40),
        avatar_url: user.picture_url || MASCOT_AVATAR,
        amount: Math.round(value * 100) / 100,
        message: message.trim().slice(0, 200),
        is_anonymous: anonymous,
        hide_amount: hideAmount,
        slip_url: slip,
        status: 'pending',
        created_at: serverTimestamp(),
      });
      setStep('done');
    } catch (err) {
      alert(`ส่งไม่สำเร็จ: ${err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <MascotWatermark page="donate" />
        <div className="overflow-y-auto">
        <div className="sticky top-0 bg-white px-4 pt-4 pb-2 flex items-center gap-2 z-10">
          {step === 'form' && (
            <button onClick={() => setStep('qr')} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><ArrowLeft className="w-4 h-4" /></button>
          )}
          <h3 className="font-black text-base flex-1 flex items-center gap-1.5">
            <Heart className="w-4 h-4 text-pink-500 fill-pink-500" /> สนับสนุนแอป
          </h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>

        {step === 'qr' && (
          <div className="px-4 pb-5 space-y-3 text-center">
            <p className="text-xs text-gray-500">แอปนี้ใช้ฟรีทุกคน ทั้งลูกค้าและร้านค้า ยอดสนับสนุนจะนำไปเป็นค่าเซิร์ฟเวอร์และพัฒนาแอปต่อ</p>
            <div className="mx-auto w-60 rounded-2xl border-2 border-brand-100 bg-white p-3">
              {settings?.donate_qr_url ? (
                <img src={settings.donate_qr_url} alt="QR พร้อมเพย์" className="w-full aspect-square object-contain" />
              ) : (
                <div className="w-full aspect-square flex flex-col items-center justify-center text-gray-300 gap-2">
                  <QrCode className="w-14 h-14" />
                  <span className="text-xs text-gray-400">ยังไม่ได้ตั้งค่า QR</span>
                </div>
              )}
            </div>
            {settings?.donate_promptpay_name && <p className="text-sm font-bold text-gray-800">{settings.donate_promptpay_name}</p>}
            {number && (
              <button onClick={copyNumber} className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-700 bg-brand-50 rounded-full px-3 py-1.5">
                พร้อมเพย์ {number}
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            )}
            <p className="text-[11px] text-gray-400">สแกนจ่ายด้วยแอปธนาคาร แล้วกด &ldquo;แจ้งโอน&rdquo; เพื่อขึ้นชื่อในรายชื่อผู้สนับสนุน</p>
            <button onClick={goToForm} className="w-full bg-brand-600 text-white rounded-2xl py-3 font-black">
              แจ้งโอน
            </button>
          </div>
        )}

        {step === 'form' && (
          <div className="px-4 pb-5 space-y-3">
            <label className="block rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 cursor-pointer overflow-hidden">
              {slip ? (
                <img src={slip} alt="สลิป" className="w-full max-h-64 object-contain bg-white" />
              ) : (
                <div className="py-8 flex flex-col items-center gap-1.5 text-gray-400">
                  <ImagePlus className="w-8 h-8" />
                  <span className="text-sm font-bold">{busy ? 'กำลังโหลดรูป...' : 'แนบสลิปการโอน'}</span>
                </div>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={e => pickSlip(e.target.files?.[0])} />
            </label>
            <input type="number" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="ยอดที่โอน (บาท)" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold" />
            {!anonymous && (
              <input value={name} onChange={e => setName(e.target.value)} maxLength={40} placeholder="ชื่อที่จะแสดง" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" />
            )}
            <textarea value={message} onChange={e => setMessage(e.target.value)} maxLength={200} rows={3} placeholder="ข้อความถึงทีมงาน (ไม่บังคับ)" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none" />
            <div className="text-sm">
              <Toggle label="ไม่ระบุชื่อ (แสดงเป็น ผู้ใจดี)" value={anonymous} onChange={setAnonymous} />
              <Toggle label="ไม่แสดงยอดเงิน" value={hideAmount} onChange={setHideAmount} />
            </div>
            <button disabled={busy} onClick={submit} className="w-full bg-brand-600 text-white rounded-2xl py-3 font-black disabled:opacity-50">
              {busy ? 'กำลังส่ง...' : 'ส่งให้แอดมินตรวจ'}
            </button>
          </div>
        )}

        {step === 'done' && (
          <div className="px-4 pb-6 text-center space-y-3">
            <img src={MASCOT_AVATAR} alt="" className="w-28 mx-auto" />
            <p className="font-black text-lg text-gray-900">ขอบคุณมากครับ</p>
            <p className="text-sm text-gray-500">แอดมินจะตรวจสลิปและขึ้นชื่อของคุณในรายชื่อผู้สนับสนุนเร็ว ๆ นี้</p>
            <button onClick={onClose} className="w-full bg-brand-600 text-white rounded-2xl py-3 font-black">ปิด</button>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
