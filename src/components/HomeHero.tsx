'use client';

import React, { useEffect, useState } from 'react';
import { Heart, Store, Bike, ChefHat, Clock, CheckCircle2, MapPin, Sparkles } from 'lucide-react';
import { Order } from '@/types';
import { Supporter, formatBaht } from '@/lib/donations';
import { formatOrderCode } from '@/lib/orderNumber';
import UserAvatar from './UserAvatar';
import WavePattern from './WavePattern';

interface HomeHeroProps {
  supporters: Supporter[];
  userName?: string;
  openShopCount: number;
  trackingOrders: Order[];
  onOpenSupporters: () => void;
  onOpenTracking: () => void;
}

const ORDER_STATUS: Record<string, { label: string; icon: typeof Bike }> = {
  pending: { label: 'รอร้านรับออเดอร์', icon: Clock },
  cooking: { label: 'กำลังทำอาหาร', icon: ChefHat },
  delivering: { label: 'กำลังมาส่ง', icon: Bike },
  completed: { label: 'ส่งถึงแล้ว', icon: CheckCircle2 },
};

const TICKER_MS = 2500;

function mealPrompt(hour: number): string {
  if (hour >= 5 && hour < 11) return 'เช้านี้กินอะไรดี';
  if (hour >= 11 && hour < 14) return 'ได้เวลาข้าวเที่ยงแล้ว';
  if (hour >= 14 && hour < 17) return 'บ่ายนี้หาของหวานกินไหม';
  if (hour >= 17 && hour < 21) return 'มื้อเย็นวันนี้กินอะไรดี';
  return 'หิวดึกเหรอ';
}

export default function HomeHero({
  supporters, userName, openShopCount, trackingOrders, onOpenSupporters, onOpenTracking,
}: HomeHeroProps) {
  const firstName = userName?.split(' ')[0];
  // The supporters pill shows everyone in turn, one every few seconds, then starts over.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (supporters.length < 2) return;
    const id = setInterval(() => setTick(t => t + 1), TICKER_MS);
    return () => clearInterval(id);
  }, [supporters.length]);
  const current = supporters.length ? supporters[tick % supporters.length] : null;
  // The most advanced active order is the most useful one to show at a glance.
  const rank = ['delivering', 'cooking', 'pending', 'completed'];
  const activeOrder = [...trackingOrders]
    .filter(o => ORDER_STATUS[o.status])
    .sort((a, b) => rank.indexOf(a.status) - rank.indexOf(b.status))[0];
  const status = activeOrder ? ORDER_STATUS[activeOrder.status] : null;

  return (
    <section className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-2.5">
      {/* Greeting */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#C3EBDC] to-[#9FE1CB] p-3.5 min-h-[128px] shadow-[0_6px_16px_-6px_rgba(15,110,86,0.35)]">
        <WavePattern />
        <p className="relative z-10 text-xs font-bold text-[#085041] truncate pr-16">สวัสดี{firstName ? ` ${firstName}` : ''}</p>
        {/* Rendered from the device clock, so the prerendered text may differ */}
        <h2 suppressHydrationWarning className="relative z-10 text-base font-black text-[#04342C] mt-1 leading-snug pr-[72px] sm:pr-24">
          {mealPrompt(new Date().getHours())}
        </h2>
        <p className="relative z-10 mt-1.5 pr-[72px] sm:pr-24 text-[11px] font-medium text-[#0F6E56] leading-snug flex gap-1">
          <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
          <span>
            <span className="whitespace-nowrap">ชุมชนห้วยชัน - นาฝาย</span>{' '}
            <span className="whitespace-nowrap">&amp; มรภ.ชัยภูมิ</span>
          </span>
        </p>
        <img
          src="/mascots/pung-deng-thanks.webp"
          alt="น้องพุงเด้ง"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 w-[68px] sm:w-24 pointer-events-none select-none drop-shadow-sm"
        />
        <Sparkles className="absolute right-[72px] sm:right-24 top-4 w-3.5 h-3.5 text-white pointer-events-none" />
        <Sparkles className="absolute right-2 top-3 w-3 h-3 text-white/90 pointer-events-none" />
        <Sparkles className="absolute right-3 bottom-3 w-2.5 h-2.5 text-white/80 pointer-events-none" />
      </div>

      <div className="flex flex-col gap-2.5 min-w-0">
        {/* Supporters pill (kept small on purpose) */}
        <button
          type="button"
          onClick={onOpenSupporters}
          className="h-9 rounded-full bg-white text-[#085041] border border-[#E1F5EE] shadow-[0_4px_12px_-4px_rgba(15,110,86,0.3)] pl-1 pr-2.5 flex items-center gap-1.5 active:scale-95 transition min-w-0 overflow-hidden"
        >
          {current ? (
            // Keyed by supporter so each one slides in fresh
            <span key={`${current.key}-${tick}`} className="flex items-center gap-1.5 min-w-0 animate-in fade-in slide-in-from-bottom-3 duration-500 motion-reduce:animate-none">
              <span className="w-6 h-6 rounded-full overflow-hidden ring-2 ring-white bg-white shrink-0">
                <UserAvatar src={current.avatar_url} alt={current.display_name} />
              </span>
              <span className="text-xs font-black truncate">{current.display_name}</span>
              {current.total > 0 && (
                <span className="text-[11px] font-bold text-[#1D9E75] shrink-0">{formatBaht(current.total)}</span>
              )}
            </span>
          ) : (
            <>
              <span className="w-6 h-6 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                <Heart className="w-3.5 h-3.5 text-pink-500 fill-pink-500" />
              </span>
              <span className="text-xs font-black truncate">ผู้สนับสนุน</span>
            </>
          )}
        </button>

        {/* My order status, or how many shops are open */}
        {activeOrder && status ? (
          <button
            type="button"
            onClick={onOpenTracking}
            className="flex-1 bg-white border border-[#E1F5EE] shadow-[0_6px_16px_-6px_rgba(15,110,86,0.3)] rounded-2xl p-2 flex flex-col items-center justify-center text-center active:scale-95 transition relative"
          >
            {activeOrder.has_customer_unread_message && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500" />}
            <status.icon className="w-5 h-5 text-[#1D9E75]" />
            <span className="text-sm font-black text-gray-900 mt-1 leading-tight">{status.label}</span>
            <span className="text-[11px] text-gray-500 truncate max-w-full">
              ออเดอร์ #{formatOrderCode(activeOrder)}{trackingOrders.length > 1 ? ` +${trackingOrders.length - 1}` : ''}
            </span>
          </button>
        ) : (
          <div className="flex-1 bg-white border border-[#E1F5EE] shadow-[0_6px_16px_-6px_rgba(15,110,86,0.3)] rounded-2xl p-2 flex flex-col items-center justify-center text-center">
            <Store className="w-4 h-4 text-[#1D9E75] mb-0.5" />
            <span className="text-2xl font-black text-[#1D9E75] leading-tight">{openShopCount}</span>
            <span className="text-[11px] text-gray-500">ร้านเปิดอยู่</span>
          </div>
        )}
      </div>
    </section>
  );
}
