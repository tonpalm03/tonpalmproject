'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  collection, doc, onSnapshot, query, where, serverTimestamp, writeBatch,
  updateDoc, deleteDoc, setDoc,
} from 'firebase/firestore';
import {
  Heart, Check, X, Plus, Search, Eye, EyeOff, Trash2, Pencil, Bell, BellOff, QrCode, Save, Image as ImageIcon,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { Donation, DonationRequest, SystemSettings, UserProfile } from '@/types';
import { ANON_NAME, MASCOT_AVATAR, aggregateSupporters, formatBaht, subscribeDonations, toMillis } from '@/lib/donations';
import { formatThaiDateWithTime } from '@/lib/dateUtils';
import { readFileAsDataUrl } from '@/lib/imageUtils';
import UserAvatar from './UserAvatar';
import Toggle from './Toggle';

interface DonationsAdminProps {
  currentUser: UserProfile;
  users: UserProfile[];
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');

export default function DonationsAdmin({ users }: DonationsAdminProps) {
  const [requests, setRequests] = useState<DonationRequest[]>([]);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [amountEdits, setAmountEdits] = useState<Record<string, string>>({});
  const [notifyOnApprove, setNotifyOnApprove] = useState(true);
  const [slipPreview, setSlipPreview] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Donation | null>(null);

  useEffect(() => {
    const unsubReq = onSnapshot(
      query(collection(db, 'donation_requests'), where('status', '==', 'pending')),
      snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as DonationRequest));
        list.sort((a, b) => toMillis(a.created_at) - toMillis(b.created_at));
        setRequests(list);
      },
      err => console.warn('Donation requests listener error:', err),
    );
    const unsubDon = subscribeDonations(setDonations);
    return () => { unsubReq(); unsubDon(); };
  }, []);

  const supporters = useMemo(() => aggregateSupporters(donations), [donations]);
  const grandTotal = supporters.reduce((sum, s) => sum + s.total, 0);

  const approve = async (r: DonationRequest) => {
    const amount = Number(amountEdits[r.id] ?? r.amount);
    if (!Number.isFinite(amount) || amount <= 0) return alert('ยอดเงินไม่ถูกต้อง');
    setBusyId(r.id);
    try {
      const batch = writeBatch(db);
      batch.set(doc(collection(db, 'donations')), {
        supporter_key: r.is_anonymous ? `anon:${r.id}` : r.uid,
        display_name: r.is_anonymous ? ANON_NAME : r.display_name,
        avatar_url: r.is_anonymous ? MASCOT_AVATAR : (r.avatar_url || ''),
        amount: r.hide_amount ? null : amount,
        message: r.message || '',
        notify: notifyOnApprove,
        source: 'request',
        request_id: r.id,
        created_at: serverTimestamp(),
      });
      // The real amount stays on the private request even when it is hidden publicly.
      batch.update(doc(db, 'donation_requests', r.id), { status: 'approved', amount });
      await batch.commit();
    } catch (err) {
      alert(`อนุมัติไม่สำเร็จ: ${errorText(err)}`);
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (r: DonationRequest) => {
    if (!confirm(`ปฏิเสธรายการแจ้งโอนของ ${r.display_name}?`)) return;
    setBusyId(r.id);
    try {
      await updateDoc(doc(db, 'donation_requests', r.id), { status: 'rejected' });
    } catch (err) {
      alert(`ปฏิเสธไม่สำเร็จ: ${errorText(err)}`);
    } finally {
      setBusyId(null);
    }
  };

  const toggleMessageHidden = (d: Donation) =>
    updateDoc(doc(db, 'donations', d.id), { message_hidden: !d.message_hidden }).catch(err => alert(errorText(err)));

  const remove = async (d: Donation) => {
    if (!confirm(`ลบรายการ donate ของ ${d.display_name}${d.amount !== null ? ` (${formatBaht(d.amount)})` : ''}?`)) return;
    await deleteDoc(doc(db, 'donations', d.id)).catch(err => alert(errorText(err)));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="ยอดรวม" value={formatBaht(grandTotal)} />
        <Stat label="ผู้สนับสนุน" value={`${supporters.length} คน`} />
        <Stat label="รอตรวจ" value={`${requests.length} รายการ`} highlight={requests.length > 0} />
      </div>

      <PromptPaySettings />

      {/* Pending slip reviews */}
      <section className="bg-pink-50/70 border border-pink-200 rounded-2xl p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-black text-sm text-pink-900 flex items-center gap-1.5">
            <Heart className="w-4 h-4 text-pink-500" /> รอตรวจ donate ({requests.length})
          </h3>
          <button
            onClick={() => setNotifyOnApprove(v => !v)}
            className={`text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 border ${notifyOnApprove ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-500 border-gray-200'}`}
          >
            {notifyOnApprove ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3" />}
            {notifyOnApprove ? 'เด้งแจ้งเตือนเมื่ออนุมัติ' : 'ไม่เด้งแจ้งเตือน'}
          </button>
        </div>
        {requests.length === 0 && <p className="text-xs text-gray-500 py-2 text-center">ไม่มีรายการรอตรวจ</p>}
        {requests.map(r => (
          <div key={r.id} className="bg-white rounded-xl p-3 border border-pink-100 flex gap-3">
            <button onClick={() => setSlipPreview(r.slip_url)} className="w-16 h-24 rounded-lg overflow-hidden bg-gray-100 shrink-0 border border-gray-200">
              <img src={r.slip_url} alt="สลิป" className="w-full h-full object-cover" />
            </button>
            <div className="flex-1 min-w-0 space-y-1 text-xs">
              <p className="font-bold text-sm text-gray-900 truncate">
                {r.display_name}
                {r.is_anonymous && <span className="ml-1 text-[10px] text-gray-500 font-medium">(ไม่ระบุชื่อ)</span>}
                {r.hide_amount && <span className="ml-1 text-[10px] text-gray-500 font-medium">(ซ่อนยอด)</span>}
              </p>
              {r.message && <p className="text-gray-600 line-clamp-2">&ldquo;{r.message}&rdquo;</p>}
              <p className="text-[10px] text-gray-400">{r.created_at ? formatThaiDateWithTime(new Date(toMillis(r.created_at))) : ''}</p>
              <div className="flex items-center gap-1.5 pt-1">
                <span className="text-gray-500">฿</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={amountEdits[r.id] ?? String(r.amount)}
                  onChange={e => setAmountEdits(prev => ({ ...prev, [r.id]: e.target.value }))}
                  className="w-20 border border-gray-200 rounded-lg px-2 py-1 font-bold text-sm"
                />
                <button disabled={busyId === r.id} onClick={() => approve(r)} className="ml-auto bg-emerald-600 text-white rounded-lg px-2.5 py-1.5 font-bold flex items-center gap-1 disabled:opacity-50">
                  <Check className="w-3.5 h-3.5" /> อนุมัติ
                </button>
                <button disabled={busyId === r.id} onClick={() => reject(r)} className="bg-gray-100 text-gray-600 rounded-lg px-2.5 py-1.5 font-bold flex items-center gap-1 disabled:opacity-50">
                  <X className="w-3.5 h-3.5" /> ปฏิเสธ
                </button>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* All donations */}
      <section className="bg-white border border-gray-200 rounded-2xl p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-sm text-gray-900">รายการ donate ทั้งหมด ({donations.length})</h3>
          <button onClick={() => setShowAdd(true)} className="bg-emerald-600 text-white text-xs font-bold rounded-lg px-3 py-1.5 flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> เพิ่ม donate
          </button>
        </div>
        {donations.length === 0 && <p className="text-xs text-gray-500 py-2 text-center">ยังไม่มีรายการ</p>}
        <div className="divide-y divide-gray-100">
          {donations.map(d => (
            <div key={d.id} className="py-2 flex items-start gap-2.5 text-xs">
              <div className="w-9 h-9 rounded-full overflow-hidden bg-emerald-50 shrink-0">
                <UserAvatar src={d.avatar_url} alt={d.display_name} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 truncate">
                  {d.display_name}
                  <span className="ml-1.5 text-emerald-700">{d.amount === null ? 'ซ่อนยอด' : formatBaht(d.amount)}</span>
                </p>
                {d.message && (
                  <p className={`line-clamp-2 ${d.message_hidden ? 'text-gray-300 line-through' : 'text-gray-600'}`}>{d.message}</p>
                )}
                <p className="text-[10px] text-gray-400">
                  {d.created_at ? formatThaiDateWithTime(new Date(toMillis(d.created_at))) : ''} · {d.source === 'admin' ? 'แอดมินเพิ่ม' : 'จากสลิป'}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                {d.message && (
                  <IconBtn title={d.message_hidden ? 'แสดงข้อความ' : 'ซ่อนข้อความ'} onClick={() => toggleMessageHidden(d)}>
                    {d.message_hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </IconBtn>
                )}
                <IconBtn title="แก้ไข" onClick={() => setEditing(d)}><Pencil className="w-3.5 h-3.5" /></IconBtn>
                <IconBtn title="ลบ" onClick={() => remove(d)} danger><Trash2 className="w-3.5 h-3.5" /></IconBtn>
              </div>
            </div>
          ))}
        </div>
      </section>

      {slipPreview && (
        <div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-4" onClick={() => setSlipPreview(null)}>
          <img src={slipPreview} alt="สลิป" className="max-h-full max-w-full rounded-xl" />
        </div>
      )}
      {showAdd && <DonationEditor users={users} onClose={() => setShowAdd(false)} />}
      {editing && <DonationEditor users={users} donation={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-2.5 border ${highlight ? 'bg-pink-50 border-pink-200' : 'bg-white border-gray-200'}`}>
      <p className="text-[10px] text-gray-500 font-bold">{label}</p>
      <p className="text-sm font-black text-gray-900 truncate">{value}</p>
    </div>
  );
}

function IconBtn({ children, onClick, title, danger }: { children: React.ReactNode; onClick: () => void; title: string; danger?: boolean }) {
  return (
    <button title={title} onClick={onClick} className={`w-7 h-7 rounded-lg flex items-center justify-center border ${danger ? 'text-red-500 border-red-100 bg-red-50' : 'text-gray-600 border-gray-200 bg-white'}`}>
      {children}
    </button>
  );
}

function PromptPaySettings() {
  const [settings, setSettings] = useState<Pick<SystemSettings, 'donate_promptpay_name' | 'donate_promptpay_number' | 'donate_qr_url'>>({});
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => onSnapshot(doc(db, 'system_settings', 'general'), snap => {
    const d = snap.data() as SystemSettings | undefined;
    setSettings({
      donate_promptpay_name: d?.donate_promptpay_name ?? '',
      donate_promptpay_number: d?.donate_promptpay_number ?? '',
      donate_qr_url: d?.donate_qr_url ?? '',
    });
  }), []);

  const pickQr = async (file?: File) => {
    if (!file) return;
    try {
      const url = await readFileAsDataUrl(file, 800);
      setSettings(s => ({ ...s, donate_qr_url: url }));
    } catch (err) {
      alert(errorText(err));
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'system_settings', 'general'), { ...settings, updated_at: serverTimestamp() }, { merge: true });
      setOpen(false);
    } catch (err) {
      alert(`บันทึกไม่สำเร็จ: ${errorText(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const configured = !!settings.donate_qr_url;

  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-3">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between text-sm font-black text-gray-900">
        <span className="flex items-center gap-1.5"><QrCode className="w-4 h-4 text-emerald-600" /> พร้อมเพย์รับ donate</span>
        <span className={`text-[11px] font-bold ${configured ? 'text-emerald-600' : 'text-orange-500'}`}>
          {configured ? 'ตั้งค่าแล้ว' : 'ยังไม่ได้อัปโหลด QR'}
        </span>
      </button>
      {open && (
        <div className="mt-3 space-y-2 text-xs">
          <label className="block">
            <span className="font-bold text-gray-600">ชื่อบัญชี</span>
            <input value={settings.donate_promptpay_name} onChange={e => setSettings(s => ({ ...s, donate_promptpay_name: e.target.value }))} className="mt-1 w-full border border-gray-200 rounded-lg px-2.5 py-2" />
          </label>
          <label className="block">
            <span className="font-bold text-gray-600">เบอร์พร้อมเพย์</span>
            <input value={settings.donate_promptpay_number} inputMode="numeric" onChange={e => setSettings(s => ({ ...s, donate_promptpay_number: e.target.value }))} className="mt-1 w-full border border-gray-200 rounded-lg px-2.5 py-2" />
          </label>
          <div className="flex items-center gap-3">
            <div className="w-24 h-24 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden">
              {settings.donate_qr_url ? <img src={settings.donate_qr_url} alt="QR" className="w-full h-full object-contain" /> : <ImageIcon className="w-6 h-6 text-gray-300" />}
            </div>
            <label className="bg-gray-100 rounded-lg px-3 py-2 font-bold text-gray-700 cursor-pointer">
              อัปโหลดรูป QR พร้อมเพย์
              <input type="file" accept="image/*" className="hidden" onChange={e => pickQr(e.target.files?.[0])} />
            </label>
          </div>
          <button disabled={saving} onClick={save} className="w-full bg-emerald-600 text-white rounded-lg py-2 font-bold flex items-center justify-center gap-1 disabled:opacity-50">
            <Save className="w-3.5 h-3.5" /> บันทึก
          </button>
        </div>
      )}
    </section>
  );
}

/** Add a donation manually (from a slip received elsewhere) or edit an existing one. */
function DonationEditor({ users, donation, onClose }: { users: UserProfile[]; donation?: Donation; onClose: () => void }) {
  const isEdit = !!donation;
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [name, setName] = useState(donation?.display_name ?? '');
  const [amount, setAmount] = useState(donation?.amount != null ? String(donation.amount) : '');
  const [message, setMessage] = useState(donation?.message ?? '');
  const [anonymous, setAnonymous] = useState(donation?.supporter_key.startsWith('anon:') ?? false);
  const [hideAmount, setHideAmount] = useState(donation ? donation.amount === null : false);
  const [notify, setNotify] = useState(!isEdit);
  const [saving, setSaving] = useState(false);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return users.filter(u => u.display_name?.toLowerCase().includes(q) || u.phone?.includes(q)).slice(0, 6);
  }, [search, users]);

  const save = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return alert('กรุณาใส่ยอดเงิน');
    const displayName = anonymous ? ANON_NAME : (selectedUser?.display_name ?? name.trim());
    if (!displayName) return alert('กรุณาเลือกผู้ใช้หรือพิมพ์ชื่อ');
    setSaving(true);
    try {
      if (isEdit) {
        await updateDoc(doc(db, 'donations', donation.id), {
          display_name: anonymous ? ANON_NAME : name.trim() || donation.display_name,
          amount: hideAmount ? null : value,
          message: message.trim(),
        });
      } else {
        const ref = doc(collection(db, 'donations'));
        const key = anonymous ? `anon:${ref.id}` : selectedUser ? selectedUser.uid : `name:${displayName}`;
        await setDoc(ref, {
          supporter_key: key,
          display_name: displayName,
          avatar_url: anonymous || !selectedUser ? MASCOT_AVATAR : (selectedUser.picture_url || ''),
          amount: hideAmount ? null : value,
          message: message.trim(),
          notify,
          source: 'admin',
          created_at: serverTimestamp(),
        });
      }
      onClose();
    } catch (err) {
      alert(`บันทึกไม่สำเร็จ: ${errorText(err)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[250] bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-4 space-y-3 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-black text-base">{isEdit ? 'แก้ไข donate' : 'เพิ่ม donate'}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>

        {!isEdit && !anonymous && (
          selectedUser ? (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-2">
              <div className="w-9 h-9 rounded-full overflow-hidden"><UserAvatar src={selectedUser.picture_url} /></div>
              <p className="flex-1 font-bold text-sm truncate">{selectedUser.display_name}</p>
              <button onClick={() => setSelectedUser(null)} className="text-xs text-gray-500 font-bold">เปลี่ยน</button>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาผู้ใช้ในแอป (ชื่อ/เบอร์)" className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-sm" />
              </div>
              {matches.map(u => (
                <button key={u.uid} onClick={() => { setSelectedUser(u); setSearch(''); }} className="w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-50 text-left">
                  <div className="w-7 h-7 rounded-full overflow-hidden"><UserAvatar src={u.picture_url} /></div>
                  <span className="text-sm truncate">{u.display_name}</span>
                </button>
              ))}
              <p className="text-[11px] text-gray-400 text-center">หรือพิมพ์ชื่อเอง (จะใช้รูปพุงเด้งแทนรูปโปรไฟล์)</p>
              <input value={name} onChange={e => setName(e.target.value)} maxLength={40} placeholder="ชื่อที่จะแสดง" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
            </div>
          )
        )}
        {isEdit && !anonymous && (
          <input value={name} onChange={e => setName(e.target.value)} maxLength={40} placeholder="ชื่อที่จะแสดง" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
        )}

        <input type="number" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="ยอดเงิน (บาท)" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold" />
        <textarea value={message} onChange={e => setMessage(e.target.value)} maxLength={200} rows={2} placeholder="ข้อความ (ไม่บังคับ)" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none" />

        <div className="grid grid-cols-1 gap-1.5 text-sm">
          {!isEdit && <Toggle label="ไม่ระบุชื่อ (แสดงเป็น ผู้ใจดี)" value={anonymous} onChange={setAnonymous} />}
          <Toggle label="ซ่อนยอดเงิน" value={hideAmount} onChange={setHideAmount} />
          {!isEdit && <Toggle label="เด้งแจ้งเตือนบนหน้าแอป" value={notify} onChange={setNotify} />}
        </div>

        <button disabled={saving} onClick={save} className="w-full bg-emerald-600 text-white rounded-xl py-2.5 font-bold disabled:opacity-50">
          {saving ? 'กำลังบันทึก...' : 'บันทึก'}
        </button>
      </div>
    </div>
  );
}
