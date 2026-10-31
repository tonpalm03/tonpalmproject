'use client';

import React, { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Store, Clock, XCircle, Send, AlertCircle } from 'lucide-react';
import { db } from '@/lib/firebase';
import { MerchantApplication, UserProfile } from '@/types';

interface MerchantApplicationPanelProps {
  user: UserProfile;
}

export default function MerchantApplicationPanel({ user }: MerchantApplicationPanelProps) {
  const [application, setApplication] = useState<MerchantApplication | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [shopName, setShopName] = useState('');
  const [phone, setPhone] = useState(user.phone || '');
  const [category, setCategory] = useState<'food' | 'drink_dessert'>('food');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    return onSnapshot(
      doc(db, 'merchant_applications', user.uid),
      (snap) => {
        const data = snap.exists() ? (snap.data() as MerchantApplication) : null;
        setApplication(data);
        if (data) {
          setShopName(data.shop_name);
          setPhone(data.phone);
          setCategory(data.category);
          setAddress(data.address_detail || '');
          setNote(data.note || '');
        }
        setLoaded(true);
      },
      (err) => {
        console.warn('Merchant application listener error:', err);
        setLoaded(true);
      }
    );
  }, [user.uid]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cleanPhone = phone.replace(/\D/g, '');
    if (!shopName.trim()) return setError('กรุณากรอกชื่อร้าน');
    if (cleanPhone.length < 9 || cleanPhone.length > 10) return setError('กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง');

    setSubmitting(true);
    try {
      await setDoc(doc(db, 'merchant_applications', user.uid), {
        uid: user.uid,
        applicant_name: (user.display_name || '').slice(0, 100),
        shop_name: shopName.trim().slice(0, 80),
        phone: cleanPhone,
        category,
        address_detail: address.trim().slice(0, 300),
        note: note.trim().slice(0, 500),
        status: 'pending',
        created_at: application?.created_at ?? serverTimestamp(),
        updated_at: serverTimestamp(),
      });
      setEditing(false);
    } catch (err) {
      console.error('Submit merchant application error:', err);
      setError('ส่งคำขอไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('ต้องการยกเลิกคำขอเปิดร้านใช่หรือไม่?')) return;
    try {
      await deleteDoc(doc(db, 'merchant_applications', user.uid));
    } catch (err) {
      console.error('Cancel merchant application error:', err);
      setError('ยกเลิกคำขอไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    }
  };

  if (!loaded) {
    return <p className="text-xs text-center text-gray-400 animate-pulse">กำลังโหลดข้อมูลคำขอ...</p>;
  }

  if (application?.status === 'pending' && !editing) {
    return (
      <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
        <p className="font-bold flex items-center gap-1.5 text-sm">
          <Clock className="w-4 h-4 text-amber-600" />
          ส่งคำขอเปิดร้านแล้ว รอแอดมินอนุมัติ
        </p>
        <p>
          ร้าน <strong>{application.shop_name}</strong> • โทร {application.phone}
        </p>
        <p className="text-[11px] text-amber-700 leading-relaxed">
          เมื่อแอดมินอนุมัติ หน้านี้จะเปลี่ยนเป็นระบบจัดการร้านค้าให้อัตโนมัติ ระหว่างนี้ยังสั่งอาหารในฐานะลูกค้าได้ตามปกติ
        </p>
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex-1 py-2 bg-white hover:bg-amber-100 border border-amber-200 rounded-xl font-bold transition"
          >
            แก้ไขคำขอ
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="flex-1 py-2 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-xl font-bold transition"
          >
            ยกเลิกคำขอ
          </button>
        </div>
        {error && <p className="text-rose-600 font-semibold">{error}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex items-center gap-2 text-gray-900">
        <Store className="w-5 h-5 text-orange-500" />
        <h2 className="font-black text-base">สมัครเปิดร้านค้า</h2>
      </div>

      {application?.status === 'rejected' && (
        <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-1">
          <p className="font-bold flex items-center gap-1.5">
            <XCircle className="w-4 h-4" />
            คำขอก่อนหน้าไม่ผ่านการอนุมัติ
          </p>
          {application.reject_reason && <p>เหตุผล: {application.reject_reason}</p>}
          <p className="text-[11px]">แก้ไขข้อมูลแล้วส่งคำขอใหม่ได้</p>
        </div>
      )}

      <p className="text-[11px] text-gray-500 leading-relaxed">
        กรอกข้อมูลร้านเบื้องต้น แอดมินจะตรวจสอบและติดต่อกลับ เมื่ออนุมัติแล้วจะใช้บัญชีนี้ ({user.display_name}) เข้าจัดการร้านได้ทันที
      </p>

      <div>
        <label className="text-xs font-bold text-gray-700 block mb-1">ชื่อร้าน *</label>
        <input
          type="text"
          required
          maxLength={80}
          placeholder="เช่น ส้มตำยายเพ็ญ มรภ."
          value={shopName}
          onChange={(e) => setShopName(e.target.value)}
          className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-orange-500"
        />
      </div>

      <div>
        <label className="text-xs font-bold text-gray-700 block mb-1">เบอร์โทรศัพท์ร้าน *</label>
        <input
          type="tel"
          required
          inputMode="numeric"
          placeholder="08xxxxxxxx"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-orange-500"
        />
      </div>

      <div>
        <label className="text-xs font-bold text-gray-700 block mb-1">ประเภทร้าน *</label>
        <div className="grid grid-cols-2 gap-2">
          {([
            ['food', 'อาหาร'],
            ['drink_dessert', 'เครื่องดื่ม / ของหวาน'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setCategory(value)}
              className={`py-2 rounded-xl text-xs font-bold border transition ${
                category === value ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-bold text-gray-700 block mb-1">ที่ตั้งร้าน</label>
        <input
          type="text"
          maxLength={300}
          placeholder="เช่น หน้าหอพัก... ซอย..."
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-orange-500"
        />
      </div>

      <div>
        <label className="text-xs font-bold text-gray-700 block mb-1">ข้อมูลเพิ่มเติมถึงแอดมิน</label>
        <textarea
          rows={2}
          maxLength={500}
          placeholder="เช่น เวลาเปิด-ปิด, เมนูแนะนำ, LINE ID สำหรับติดต่อกลับ"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-orange-500"
        />
      </div>

      {error && (
        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex gap-2">
        {editing && (
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="px-4 py-3 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
          >
            ยกเลิก
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 text-white font-black text-sm rounded-xl shadow-md transition active:scale-95 flex items-center justify-center gap-2"
        >
          <Send className="w-4 h-4" />
          <span>{submitting ? 'กำลังส่ง...' : editing ? 'บันทึกการแก้ไข' : 'ส่งคำขอเปิดร้าน'}</span>
        </button>
      </div>
    </form>
  );
}
