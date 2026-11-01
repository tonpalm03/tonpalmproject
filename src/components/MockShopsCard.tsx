'use client';

import React, { useState } from 'react';
import { FlaskConical, RefreshCw, Trash2 } from 'lucide-react';
import { MOCK_PREFIX, MOCK_SHOP_COUNT, removeMockShops, replaceMockShops } from '@/lib/mockShops';
import { Shop } from '@/types';

/** Admin tool to load or clear the demo shops (ids starting with shop_mock_). */
export default function MockShopsCard({ shops }: { shops: Shop[] }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const current = shops.filter(s => s.id.startsWith(MOCK_PREFIX)).length;

  const run = async (label: string, task: () => Promise<number>, done: (n: number) => string) => {
    if (!window.confirm(label)) return;
    setBusy(true);
    setMessage('');
    try {
      setMessage(done(await task()));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <FlaskConical className="w-4 h-4 text-amber-600 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-800">ร้านจำลอง</p>
          <p className="text-xs text-gray-500">ตอนนี้มี {current} ร้าน · ชุดใหม่มี {MOCK_SHOP_COUNT} ร้าน พร้อมเมนูและรูป</p>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => run(
            `ลบร้านจำลองเดิม ${current} ร้าน แล้วลงชุดใหม่ ${MOCK_SHOP_COUNT} ร้าน?`,
            replaceMockShops,
            n => `ลงร้านจำลอง ${n} ร้านแล้ว`,
          )}
          className="flex-1 h-9 rounded-xl bg-amber-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-95 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} /> ลงชุดใหม่
        </button>
        <button
          type="button"
          disabled={busy || current === 0}
          onClick={() => run(
            `ลบร้านจำลองทั้งหมด ${current} ร้าน พร้อมเมนู?`,
            removeMockShops,
            n => `ลบร้านจำลอง ${n} ร้านแล้ว`,
          )}
          className="h-9 px-3 rounded-xl bg-white border border-amber-200 text-amber-700 text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-95 transition"
        >
          <Trash2 className="w-3.5 h-3.5" /> ลบทั้งหมด
        </button>
      </div>
      {message && <p className="text-xs font-medium text-amber-700">{message}</p>}
    </div>
  );
}
