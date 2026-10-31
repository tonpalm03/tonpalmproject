'use client';

import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Store, Phone, MapPin, Check, X } from 'lucide-react';
import { db } from '@/lib/firebase';
import { approveApplication, rejectApplication } from '@/lib/merchantAccess';
import { MerchantApplication, UserProfile } from '@/types';
import { soundAlert } from '@/lib/soundAlert';
import { formatThaiDateWithTime } from '@/lib/dateUtils';

interface MerchantApplicationsAdminProps {
  users: UserProfile[];
  currentUser: UserProfile;
}

export default function MerchantApplicationsAdmin({ users, currentUser }: MerchantApplicationsAdminProps) {
  const [applications, setApplications] = useState<MerchantApplication[]>([]);
  const [busyUid, setBusyUid] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'merchant_applications'), where('status', '==', 'pending'));
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ ...(d.data() as MerchantApplication), uid: d.id }));
        list.sort((a, b) => (a.created_at?.toMillis?.() ?? 0) - (b.created_at?.toMillis?.() ?? 0));
        setApplications(list);
      },
      (err) => console.warn('Merchant applications listener error:', err)
    );
  }, []);

  if (applications.length === 0) return null;

  const handleApprove = async (app: MerchantApplication) => {
    const applicant = users.find((u) => u.uid === app.uid);
    if (!applicant) return alert('ไม่พบบัญชีผู้สมัครในระบบ (อาจถูกลบไปแล้ว)');
    if (applicant.role !== 'customer') return alert('ผู้สมัครมียศร้านค้าหรือแอดมินอยู่แล้ว');
    if (!confirm(`อนุมัติเปิดร้าน "${app.shop_name}" ให้ ${applicant.display_name}?`)) return;
    setBusyUid(app.uid);
    try {
      await approveApplication(app, applicant, currentUser.uid);
      soundAlert.playAdminPromoteSound().catch(() => {});
      alert(`อนุมัติร้าน "${app.shop_name}" แล้ว ร้านจะเริ่มต้นในสถานะปิด ให้เจ้าของตั้งค่าเมนูก่อนเปิดร้าน`);
    } catch (err) {
      console.error('Approve application error:', err);
      alert(`อนุมัติไม่สำเร็จ: ${err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'}`);
    } finally {
      setBusyUid(null);
    }
  };

  const handleReject = async (app: MerchantApplication) => {
    const reason = prompt(`เหตุผลที่ไม่อนุมัติร้าน "${app.shop_name}" (ผู้สมัครจะเห็นข้อความนี้)`);
    if (reason === null) return;
    setBusyUid(app.uid);
    try {
      await rejectApplication(app, currentUser.uid, reason || 'ข้อมูลไม่ครบถ้วน');
    } catch (err) {
      console.error('Reject application error:', err);
      alert(`ปฏิเสธคำขอไม่สำเร็จ: ${err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'}`);
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <div className="bg-orange-50/70 border border-orange-200 rounded-2xl p-3 space-y-2">
      <h3 className="font-black text-sm text-orange-900 flex items-center gap-1.5">
        <Store className="w-4 h-4 text-orange-500" />
        คำขอเปิดร้านรออนุมัติ ({applications.length})
      </h3>
      {applications.map((app) => {
        const applicant = users.find((u) => u.uid === app.uid);
        return (
          <div key={app.uid} className="bg-white rounded-xl p-3 border border-orange-100 space-y-1.5 text-xs">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-bold text-sm text-gray-900 truncate">{app.shop_name}</p>
                <p className="text-gray-500">
                  ผู้สมัคร: {applicant?.display_name || app.applicant_name}
                  {app.category === 'drink_dessert' ? ' • เครื่องดื่ม/ของหวาน' : ' • อาหาร'}
                </p>
              </div>
              {app.created_at?.toDate && (
                <span className="text-[10px] text-gray-400 shrink-0">{formatThaiDateWithTime(app.created_at.toDate())}</span>
              )}
            </div>
            <p className="flex items-center gap-1 text-amber-700 font-semibold">
              <Phone className="w-3 h-3" /> {app.phone}
            </p>
            {app.address_detail && (
              <p className="flex items-center gap-1 text-gray-600">
                <MapPin className="w-3 h-3" /> {app.address_detail}
              </p>
            )}
            {app.note && <p className="text-gray-600 bg-gray-50 rounded-lg p-2 whitespace-pre-wrap">{app.note}</p>}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={busyUid === app.uid}
                onClick={() => handleApprove(app)}
                className="flex-1 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg font-bold flex items-center justify-center gap-1 transition"
              >
                <Check className="w-3.5 h-3.5" /> อนุมัติ
              </button>
              <button
                type="button"
                disabled={busyUid === app.uid}
                onClick={() => handleReject(app)}
                className="flex-1 py-1.5 bg-white hover:bg-rose-50 disabled:opacity-50 text-rose-700 border border-rose-200 rounded-lg font-bold flex items-center justify-center gap-1 transition"
              >
                <X className="w-3.5 h-3.5" /> ไม่อนุมัติ
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
