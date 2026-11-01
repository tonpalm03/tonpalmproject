'use client';

import React, { useState } from 'react';
import { X, Heart, ArrowLeft } from 'lucide-react';
import { Supporter, formatBaht, toMillis } from '@/lib/donations';
import { formatThaiDateWithTime } from '@/lib/dateUtils';
import UserAvatar from './UserAvatar';
import MascotWatermark from './MascotWatermark';
import WavePattern from './WavePattern';

interface SupportersModalProps {
  supporters: Supporter[];
  onDonate: () => void;
  onClose: () => void;
}

const amountLabel = (s: Supporter) =>
  s.total > 0 ? formatBaht(s.total) : 'ไม่แสดงยอด';

export default function SupportersModal({ supporters, onDonate, onClose }: SupportersModalProps) {
  const [selected, setSelected] = useState<Supporter | null>(null);
  const grandTotal = supporters.reduce((sum, s) => sum + s.total, 0);

  return (
    <div className="fixed inset-0 z-[200] bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
      <MascotWatermark page="supporters" />
        {selected ? (
          <SupporterHistory supporter={selected} onBack={() => setSelected(null)} onClose={onClose} />
        ) : (
          <>
            <div className="relative overflow-hidden isolate bg-gradient-to-br from-[#E1F5EE] to-[#C3EBDC] px-4 pt-4 pb-5">
              <WavePattern className="text-white/90 -z-10" />
              <button onClick={onClose} aria-label="ปิด" className="absolute right-3 top-3 z-10 w-8 h-8 rounded-full bg-white/80 text-[#0F6E56] flex items-center justify-center"><X className="w-4 h-4" /></button>
              <img src="/mascots/pung-deng-thanks.webp" alt="" aria-hidden="true" className="absolute right-12 -bottom-1 w-24 pointer-events-none select-none drop-shadow-sm" />
              <p className="text-xs font-bold text-[#0F6E56] flex items-center gap-1.5 pr-10"><Heart className="w-4 h-4 text-pink-500 fill-pink-500" /> ขอบคุณผู้สนับสนุนน้องพุงเด้ง</p>
              <p className="text-3xl font-black mt-1 text-[#04342C]">{formatBaht(grandTotal)}</p>
              <p className="text-xs font-semibold text-[#085041]">จากผู้สนับสนุน {supporters.length} คน</p>
              <button onClick={onDonate} className="relative mt-3 bg-white text-brand-700 font-black text-sm rounded-full px-4 py-2 flex items-center gap-1.5 shadow-[0_4px_12px_-4px_rgba(15,110,86,0.35)] active:scale-95 transition">
                <Heart className="w-4 h-4 fill-pink-500 text-pink-500" /> สนับสนุนแอป
              </button>
            </div>

            <div className="overflow-y-auto flex-1 pb-4">
              {supporters.length === 0 && (
                <div className="text-center py-10 space-y-2">
                  <img src="/mascots/pung-deng.webp" alt="" className="w-24 mx-auto opacity-90" />
                  <p className="text-sm text-gray-500">ยังไม่มีผู้สนับสนุน มาเป็นคนแรกกัน</p>
                </div>
              )}

              <div className="px-3 pt-2 divide-y divide-gray-100">
                {supporters.map(s => (
                  <button key={s.key} onClick={() => setSelected(s)} className="w-full flex items-center gap-3 py-2.5 text-left">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-brand-50 shrink-0">
                      <UserAvatar src={s.avatar_url} alt={s.display_name} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{s.display_name}</p>
                      <p className="text-[11px] text-gray-400">สนับสนุน {s.count} ครั้ง</p>
                    </div>
                    <span className="text-sm font-black text-brand-700">{amountLabel(s)}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SupporterHistory({ supporter, onBack, onClose }: { supporter: Supporter; onBack: () => void; onClose: () => void }) {
  const list = [...supporter.donations].sort((a, b) => toMillis(b.created_at) - toMillis(a.created_at));
  return (
    <>
      <div className="px-4 pt-4 pb-3 flex items-center gap-2 border-b border-gray-100">
        <button onClick={onBack} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><ArrowLeft className="w-4 h-4" /></button>
        <div className="w-10 h-10 rounded-full overflow-hidden bg-brand-50 shrink-0">
          <UserAvatar src={supporter.avatar_url} alt={supporter.display_name} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-sm truncate">{supporter.display_name}</p>
          <p className="text-xs text-brand-700 font-bold">
            {supporter.total > 0 ? `รวม ${formatBaht(supporter.total)}` : 'ไม่แสดงยอด'} · {supporter.count} ครั้ง
          </p>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><X className="w-4 h-4" /></button>
      </div>
      <div className="overflow-y-auto flex-1 p-3 space-y-2">
        {list.map(d => (
          <div key={d.id} className="bg-gray-50 rounded-xl p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-black text-brand-700 text-sm">{d.amount === null ? 'ไม่แสดงยอด' : formatBaht(d.amount)}</span>
              <span className="text-gray-400">{d.created_at ? formatThaiDateWithTime(new Date(toMillis(d.created_at))) : ''}</span>
            </div>
            {d.message && !d.message_hidden && <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap break-words">{d.message}</p>}
          </div>
        ))}
      </div>
    </>
  );
}
