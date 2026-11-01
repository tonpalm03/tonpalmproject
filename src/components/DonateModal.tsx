'use client';

import React, { useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { X, Heart, Copy, Check, ImagePlus, ArrowLeft, QrCode, Download } from 'lucide-react';
import { db } from '@/lib/firebase';
import { SystemSettings, UserProfile } from '@/types';
import { MASCOT_AVATAR, compressSlip } from '@/lib/donations';
import { renderDonateCard } from '@/lib/donateCard';
import Toggle from './Toggle';
import WavePattern from './WavePattern';

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

  const [cardState, setCardState] = useState<'idle' | 'busy' | 'saved' | 'copied'>('idle');

  const makeCard = () => renderDonateCard({
    qrUrl: settings?.donate_qr_url ?? '',
    name: settings?.donate_promptpay_name?.trim(),
    number,
  });

  const flash = (state: 'saved' | 'copied') => {
    setCardState(state);
    setTimeout(() => setCardState('idle'), 1800);
  };

  const saveCard = async () => {
    if (!settings?.donate_qr_url) return;
    setCardState('busy');
    try {
      const url = URL.createObjectURL(await makeCard());
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cprufood-donate-qr.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      flash('saved');
    } catch (err) {
      setCardState('idle');
      alert(err instanceof Error ? err.message : 'บันทึกรูปไม่สำเร็จ');
    }
  };

  const copyCard = async () => {
    if (!settings?.donate_qr_url) return;
    setCardState('busy');
    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        // Hand the clipboard a promise so Safari still treats this as part of the tap.
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': makeCard() })]);
        flash('copied');
        return;
      }
      const file = new File([await makeCard()], 'cprufood-donate-qr.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
        setCardState('idle');
        return;
      }
      throw new Error('unsupported');
    } catch (err) {
      setCardState('idle');
      if (err instanceof Error && err.name === 'AbortError') return;
      alert('เครื่องนี้คัดลอกรูปไม่ได้ ลองกด "บันทึกรูป QR" แทน');
    }
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
        {/* Outside the scrolling area, so the close button stays put while reading */}
        {step === 'qr' && (
          <button onClick={onClose} aria-label="ปิด" className="absolute right-3 top-3 z-20 w-8 h-8 rounded-full bg-white/90 text-[#0F6E56] shadow-md flex items-center justify-center"><X className="w-4 h-4" /></button>
        )}
        <div className="overflow-y-auto">
        {step === 'qr' ? (
          <div className="relative overflow-hidden isolate bg-gradient-to-br from-[#E1F5EE] to-[#C3EBDC] px-4 pt-4 pb-5">
            <WavePattern className="text-white/90 -z-10" />
            <p className="text-xs font-bold text-[#0F6E56] flex items-center gap-1"><Heart className="w-3.5 h-3.5 text-pink-500 fill-pink-500" /> สนับสนุนแอป</p>
            <h3 className="mt-1 text-xl font-black text-[#04342C] leading-snug pr-28">ช่วยให้น้องพุงเด้ง<br />ได้ไปต่อ</h3>
            <img src="/mascots/bg/donate.webp" alt="น้องพุงเด้งถือกระปุกออมสิน" className="absolute right-12 -bottom-2 w-24 pointer-events-none select-none drop-shadow-sm" />
          </div>
        ) : (
        <div className="sticky top-0 bg-white px-4 pt-4 pb-2 flex items-center gap-2 z-10">
          {step === 'form' && (
            <button onClick={() => setStep('qr')} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><ArrowLeft className="w-4 h-4" /></button>
          )}
          <h3 className="font-black text-base flex-1 flex items-center gap-1.5">
            <Heart className="w-4 h-4 text-pink-500 fill-pink-500" /> สนับสนุนแอป
          </h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        )}

        {step === 'qr' && (
          <div className="px-4 pt-4 pb-5 space-y-3">
            <div className="space-y-2 text-[13px] text-gray-600 leading-relaxed">
              <p>CPRUFood ตั้งใจทำขึ้นมาเพื่อร้านค้า คนในชุมชน และนักศึกษารอบ มรภ.ชัยภูมิ แอปไม่หักค่าธรรมเนียมใดๆ ทั้งจากร้านและลูกค้า เราเป็นแค่ตัวกลางให้ลูกค้ากับร้านได้เจอกัน</p>
              <p>แต่ถ้าวันหนึ่งมีคนใช้มากขึ้น ค่าดูแลเซิร์ฟเวอร์ก็จะมากขึ้นตามไปด้วย จนเราอาจแบกไว้ไม่ไหว จึงเปิดช่องทางนี้ไว้สำหรับผู้ใจดีที่อยากช่วยให้แอปอยู่ต่อไปได้ ทุกบาทจะใช้ดูแลระบบให้ทุกคนได้ใช้งานต่อไปครับ</p>
            </div>

            <div className="relative !mt-8 rounded-2xl border-2 border-dashed border-[#5DCAA5] bg-[#E1F5EE]/40 p-3 text-center">
              <img src="/mascots/pung-deng-hello.webp" alt="" aria-hidden="true" className="absolute -left-2 -top-8 w-14 pointer-events-none select-none" />
              <div className="mx-auto w-52 rounded-xl bg-white p-2.5">
                {settings?.donate_qr_url ? (
                  <img src={settings.donate_qr_url} alt="QR พร้อมเพย์" className="w-full aspect-square object-contain" />
                ) : (
                  <div className="w-full aspect-square flex flex-col items-center justify-center text-gray-300 gap-2">
                    <QrCode className="w-14 h-14" />
                    <span className="text-xs text-gray-400">ยังไม่ได้ตั้งค่า QR</span>
                  </div>
                )}
              </div>
              {settings?.donate_promptpay_name && <p className="mt-2 text-sm font-black text-[#04342C]">{settings.donate_promptpay_name}</p>}
              {number && (
                <button onClick={copyNumber} className="mt-1 inline-flex items-center gap-1.5 text-sm font-bold text-[#0F6E56] bg-white rounded-full px-3 py-1">
                  พร้อมเพย์ {number}
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>

            {settings?.donate_qr_url && (
              <div className="grid grid-cols-2 gap-2">
                <button onClick={saveCard} disabled={cardState === 'busy'} className="py-2.5 rounded-xl border border-[#5DCAA5] text-[#0F6E56] text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition disabled:opacity-50">
                  {cardState === 'saved' ? <Check className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                  {cardState === 'saved' ? 'บันทึกแล้ว' : 'บันทึกรูป QR'}
                </button>
                <button onClick={copyCard} disabled={cardState === 'busy'} className="py-2.5 rounded-xl border border-[#5DCAA5] text-[#0F6E56] text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition disabled:opacity-50">
                  {cardState === 'copied' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {cardState === 'copied' ? 'คัดลอกแล้ว' : 'คัดลอก QR'}
                </button>
              </div>
            )}

            <p className="text-[11px] text-gray-500 text-center">โอนแล้วกด &ldquo;แจ้งโอน&rdquo; พร้อมแนบสลิป ชื่อของคุณจะขึ้นในรายชื่อผู้ใจดี</p>
            <button onClick={goToForm} className="w-full bg-brand-600 text-white rounded-2xl py-3 font-black shadow-[0_6px_16px_-6px_rgba(15,110,86,0.45)] active:scale-95 transition">
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
