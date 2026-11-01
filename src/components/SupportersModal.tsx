'use client';

import React, { useState } from 'react';
import { X, Heart, ArrowLeft, Crown } from 'lucide-react';
import { Supporter, formatBaht, toMillis } from '@/lib/donations';
import { formatThaiDateWithTime } from '@/lib/dateUtils';
import UserAvatar from './UserAvatar';

interface SupportersModalProps {
  supporters: Supporter[];
  onDonate: () => void;
  onClose: () => void;
}

const amountLabel = (s: Supporter) =>
  s.total > 0 ? formatBaht(s.total) : 'ไม่แสดงยอด';

const PODIUM = [
  { ring: 'ring-amber-400', badge: 'bg-amber-400', size: 'w-20 h-20' },
  { ring: 'ring-slate-300', badge: 'bg-slate-400', size: 'w-16 h-16' },
  { ring: 'ring-orange-300', badge: 'bg-orange-400', size: 'w-16 h-16' },
];

export default function SupportersModal({ supporters, onDonate, onClose }: SupportersModalProps) {
  const [selected, setSelected] = useState<Supporter | null>(null);
  const grandTotal = supporters.reduce((sum, s) => sum + s.total, 0);
  const top = supporters.slice(0, 3);
  const rest = supporters.slice(3);
  // Display order for the podium: 2nd, 1st, 3rd.
  const podiumOrder = [1, 0, 2].filter(i => top[i]);

  return (
    <div className="fixed inset-0 z-[200] bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {selected ? (
          <SupporterHistory supporter={selected} onBack={() => setSelected(null)} onClose={onClose} />
        ) : (
          <>
            <div className="bg-emerald-600 text-white px-4 pt-4 pb-5 relative">
              <button onClick={onClose} className="absolute right-3 top-3 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"><X className="w-4 h-4" /></button>
              <p className="text-sm font-bold opacity-90 flex items-center gap-1.5"><Heart className="w-4 h-4 fill-white" /> ขอบคุณผู้สนับสนุนพุงเด้ง</p>
              <p className="text-3xl font-black mt-1">{formatBaht(grandTotal)}</p>
              <p className="text-xs opacity-80">จากผู้สนับสนุน {supporters.length} คน</p>
              <button onClick={onDonate} className="mt-3 bg-white text-emerald-700 font-black text-sm rounded-full px-4 py-2 flex items-center gap-1.5">
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

              {top.length > 0 && (
                <div className="flex items-end justify-center gap-3 px-4 pt-5 pb-3">
                  {podiumOrder.map(i => {
                    const s = top[i];
                    const style = PODIUM[i];
                    return (
                      <button key={s.key} onClick={() => setSelected(s)} className={`flex flex-col items-center w-24 ${i === 0 ? '' : 'pt-4'}`}>
                        <div className="relative">
                          {i === 0 && <Crown className="w-6 h-6 text-amber-400 fill-amber-300 absolute -top-5 left-1/2 -translate-x-1/2" />}
                          <div className={`${style.size} rounded-full overflow-hidden ring-4 ${style.ring} bg-emerald-50`}>
                            <UserAvatar src={s.avatar_url} alt={s.display_name} />
                          </div>
                          <span className={`absolute -bottom-1 left-1/2 -translate-x-1/2 ${style.badge} text-white text-[11px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-white`}>
                            {i + 1}
                          </span>
                        </div>
                        <p className="mt-2 text-xs font-bold text-gray-900 truncate w-full text-center">{s.display_name}</p>
                        <p className="text-sm font-black text-emerald-700">{amountLabel(s)}</p>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="px-3 divide-y divide-gray-100">
                {rest.map((s, idx) => (
                  <button key={s.key} onClick={() => setSelected(s)} className="w-full flex items-center gap-3 py-2.5 text-left">
                    <span className="w-6 text-center text-xs font-black text-gray-400">{idx + 4}</span>
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-emerald-50 shrink-0">
                      <UserAvatar src={s.avatar_url} alt={s.display_name} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{s.display_name}</p>
                      <p className="text-[11px] text-gray-400">สนับสนุน {s.count} ครั้ง</p>
                    </div>
                    <span className="text-sm font-black text-emerald-700">{amountLabel(s)}</span>
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
        <div className="w-10 h-10 rounded-full overflow-hidden bg-emerald-50 shrink-0">
          <UserAvatar src={supporter.avatar_url} alt={supporter.display_name} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-sm truncate">{supporter.display_name}</p>
          <p className="text-xs text-emerald-700 font-bold">
            {supporter.total > 0 ? `รวม ${formatBaht(supporter.total)}` : 'ไม่แสดงยอด'} · {supporter.count} ครั้ง
          </p>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><X className="w-4 h-4" /></button>
      </div>
      <div className="overflow-y-auto flex-1 p-3 space-y-2">
        {list.map(d => (
          <div key={d.id} className="bg-gray-50 rounded-xl p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-black text-emerald-700 text-sm">{d.amount === null ? 'ไม่แสดงยอด' : formatBaht(d.amount)}</span>
              <span className="text-gray-400">{d.created_at ? formatThaiDateWithTime(new Date(toMillis(d.created_at))) : ''}</span>
            </div>
            {d.message && !d.message_hidden && <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap break-words">{d.message}</p>}
          </div>
        ))}
      </div>
    </>
  );
}
