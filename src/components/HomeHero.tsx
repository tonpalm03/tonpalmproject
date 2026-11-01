'use client';

import React from 'react';
import { Heart, Store, Bike, ChefHat, Clock, CheckCircle2, MapPin } from 'lucide-react';
import { Order } from '@/types';
import { Supporter } from '@/lib/donations';
import { formatOrderCode } from '@/lib/orderNumber';
import UserAvatar from './UserAvatar';

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
  const faces = supporters.slice(0, 2);
  // The most advanced active order is the most useful one to show at a glance.
  const rank = ['delivering', 'cooking', 'pending', 'completed'];
  const activeOrder = [...trackingOrders]
    .filter(o => ORDER_STATUS[o.status])
    .sort((a, b) => rank.indexOf(a.status) - rank.indexOf(b.status))[0];
  const status = activeOrder ? ORDER_STATUS[activeOrder.status] : null;

  return (
    <section className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-2.5">
      {/* Greeting */}
      <div className="relative overflow-hidden rounded-2xl bg-[#9FE1CB] p-3.5 min-h-[128px]">
        <p className="text-xs font-bold text-[#085041] truncate pr-16">สวัสดี{firstName ? ` ${firstName}` : ''}</p>
        {/* Rendered from the device clock, so the prerendered text may differ */}
        <h2 suppressHydrationWarning className="relative z-10 text-base font-black text-[#04342C] mt-1 leading-snug pr-14">
          {mealPrompt(new Date().getHours())}
        </h2>
        <p className="relative z-10 mt-1.5 pr-16 text-[11px] font-medium text-[#0F6E56] leading-snug flex gap-1">
          <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
          <span>
            <span className="whitespace-nowrap">ชุมชนห้วยชัน - นาฝาย</span>{' '}
            <span className="whitespace-nowrap">&amp; มรภ.ชัยภูมิ</span>
          </span>
        </p>
        <img
          src="/mascots/pung-deng-hello.webp"
          alt="พุงเด้ง"
          className="absolute -right-3 -bottom-3 w-[88px] sm:w-28 pointer-events-none select-none"
        />
      </div>

      <div className="flex flex-col gap-2.5 min-w-0">
        {/* Supporters pill (kept small on purpose) */}
        <button
          type="button"
          onClick={onOpenSupporters}
          className="h-9 rounded-full bg-[#E1F5EE] text-[#085041] pl-1 pr-2.5 flex items-center gap-1.5 active:scale-95 transition min-w-0"
        >
          {faces.length > 0 ? (
            <span className="flex -space-x-2 shrink-0">
              {faces.map(s => (
                <span key={s.key} className="w-6 h-6 rounded-full overflow-hidden ring-2 ring-[#E1F5EE] bg-white">
                  <UserAvatar src={s.avatar_url} alt={s.display_name} />
                </span>
              ))}
            </span>
          ) : (
            <span className="w-6 h-6 rounded-full bg-white flex items-center justify-center shrink-0">
              <Heart className="w-3.5 h-3.5 text-pink-500 fill-pink-500" />
            </span>
          )}
          <span className="text-xs font-black truncate">ผู้สนับสนุน</span>
        </button>

        {/* My order status, or how many shops are open */}
        {activeOrder && status ? (
          <button
            type="button"
            onClick={onOpenTracking}
            className="flex-1 bg-white border border-gray-200 rounded-2xl p-2 flex flex-col items-center justify-center text-center active:scale-95 transition relative"
          >
            {activeOrder.has_customer_unread_message && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500" />}
            <status.icon className="w-5 h-5 text-[#1D9E75]" />
            <span className="text-sm font-black text-gray-900 mt-1 leading-tight">{status.label}</span>
            <span className="text-[11px] text-gray-500 truncate max-w-full">
              ออเดอร์ #{formatOrderCode(activeOrder)}{trackingOrders.length > 1 ? ` +${trackingOrders.length - 1}` : ''}
            </span>
          </button>
        ) : (
          <div className="flex-1 bg-white border border-gray-200 rounded-2xl p-2 flex flex-col items-center justify-center text-center">
            <Store className="w-4 h-4 text-[#1D9E75] mb-0.5" />
            <span className="text-2xl font-black text-[#1D9E75] leading-tight">{openShopCount}</span>
            <span className="text-[11px] text-gray-500">ร้านเปิดอยู่</span>
          </div>
        )}
      </div>
    </section>
  );
}
