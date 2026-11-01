'use client';

import React, { useState } from 'react';
import { ArrowRightLeft, Search, X, AlertTriangle } from 'lucide-react';
import { transferShopOwner } from '@/lib/merchantAccess';
import { Shop, UserProfile } from '@/types';
import UserAvatar, { getUserCode } from './UserAvatar';

interface ShopOwnerTransferModalProps {
  shop: Shop;
  users: UserProfile[];
  currentUser: UserProfile;
  onClose: () => void;
}

export default function ShopOwnerTransferModal({ shop, users, currentUser, onClose }: ShopOwnerTransferModalProps) {
  const [search, setSearch] = useState('');
  const [target, setTarget] = useState<UserProfile | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const currentOwner = users.find((u) => u.uid === shop.owner_uid);
  const q = search.trim().toLowerCase();
  const candidates = q
    ? users
        .filter((u) => u.role === 'customer' && u.uid !== shop.owner_uid)
        .filter(
          (u) =>
            (u.phone && u.phone.includes(q)) ||
            (u.display_name && u.display_name.toLowerCase().includes(q)) ||
            getUserCode(u).toLowerCase().includes(q)
        )
        .slice(0, 8)
    : [];

  const handleTransfer = async () => {
    if (!target) return;
    if (!reason.trim()) return setError('กรุณาระบุเหตุผล เช่น เจ้าของร้านเข้าบัญชี LINE เดิมไม่ได้');
    if (!confirm(`ย้ายสิทธิ์เจ้าของร้าน "${shop.name}" ไปให้ ${target.display_name}?\nบัญชีเดิมจะถูกปลดเป็นลูกค้าทันที`)) return;
    setSaving(true);
    setError('');
    try {
      await transferShopOwner(shop, target, currentOwner, currentUser.uid, reason);
      alert(`ย้ายสิทธิ์ร้าน "${shop.name}" ไปให้ ${target.display_name} เรียบร้อยแล้ว`);
      onClose();
    } catch (err) {
      console.error('Transfer shop owner error:', err);
      setError(err instanceof Error ? err.message : 'ย้ายสิทธิ์ไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3">
      <div className="bg-white rounded-3xl p-5 max-w-sm w-full space-y-3 shadow-2xl animate-in zoom-in-95 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-800">
            <ArrowRightLeft className="w-5 h-5 text-purple-600" />
            <h3 className="font-bold text-base">ย้ายเจ้าของร้าน</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="text-xs bg-gray-50 rounded-xl p-3 space-y-1">
          <p>
            ร้าน: <strong>{shop.name}</strong>
          </p>
          <p>
            เจ้าของปัจจุบัน:{' '}
            <strong>{currentOwner ? `${currentOwner.display_name} (#${getUserCode(currentOwner)})` : 'ไม่พบบัญชี (อาจถูกลบแล้ว)'}</strong>
          </p>
        </div>

        <div className="text-xs text-brand-900 bg-brand-50 border border-brand-200 rounded-xl p-2.5 flex gap-1.5 leading-relaxed">
          <AlertTriangle className="w-4 h-4 text-brand-600 shrink-0" />
          <span>
            ให้เจ้าของร้านเข้าสู่ระบบด้วยบัญชี LINE หรือ Google ใหม่ก่อน 1 ครั้ง แล้วค้นหาบัญชีนั้นด้านล่าง ควรยืนยันตัวตนเจ้าของร้าน (เช่น โทรกลับเบอร์ร้าน) ก่อนย้ายสิทธิ์
          </span>
        </div>

        {!target ? (
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoFocus
                placeholder="ค้นหาบัญชีใหม่ด้วยชื่อ เบอร์โทร หรือรหัสผู้ใช้"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-purple-500"
              />
            </div>
            {q && candidates.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-2">ไม่พบบัญชีลูกค้าที่ตรงกัน</p>
            )}
            {candidates.map((u) => (
              <button
                key={u.uid}
                type="button"
                onClick={() => setTarget(u)}
                className="w-full flex items-center gap-2.5 p-2 rounded-xl border border-gray-100 hover:border-purple-300 hover:bg-purple-50 text-left transition"
              >
                <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-200 shrink-0">
                  <UserAvatar src={u.picture_url} alt={u.display_name} />
                </div>
                <div className="min-w-0 text-xs">
                  <p className="font-bold text-gray-800 truncate">{u.display_name}</p>
                  <p className="text-gray-400">
                    #{getUserCode(u)} • {u.phone || 'ไม่ระบุเบอร์'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 p-2 rounded-xl border border-purple-300 bg-purple-50">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-200 shrink-0">
                <UserAvatar src={target.picture_url} alt={target.display_name} />
              </div>
              <div className="min-w-0 text-xs flex-1">
                <p className="font-bold text-gray-800 truncate">{target.display_name}</p>
                <p className="text-gray-500">#{getUserCode(target)} • {target.phone || 'ไม่ระบุเบอร์'}</p>
              </div>
              <button type="button" onClick={() => setTarget(null)} className="text-xs text-purple-700 font-bold px-2">
                เปลี่ยน
              </button>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">เหตุผล (บันทึกไว้ในประวัติ)</label>
              <input
                type="text"
                maxLength={200}
                placeholder="เช่น เจ้าของร้านเปลี่ยนเบอร์ เข้า LINE เดิมไม่ได้"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl"
              />
            </div>
          </div>
        )}

        {error && <p className="text-xs text-rose-600 font-semibold">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs text-zinc-600 hover:bg-zinc-100 rounded-xl">
            ยกเลิก
          </button>
          <button
            type="button"
            disabled={!target || saving}
            onClick={handleTransfer}
            className="px-4 py-2 text-xs bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white font-bold rounded-xl shadow-xs"
          >
            {saving ? 'กำลังย้าย...' : 'ยืนยันย้ายสิทธิ์'}
          </button>
        </div>
      </div>
    </div>
  );
}
