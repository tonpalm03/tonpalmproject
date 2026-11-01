'use client';

import React, { useEffect, useState } from 'react';
import { Heart, Store, Bike, ChefHat, Clock, CheckCircle2, MapPin, Sparkles } from 'lucide-react';
import { Order } from '@/types';
import { Supporter, formatBaht } from '@/lib/donations';
import { formatOrderCode } from '@/lib/orderNumber';
import UserAvatar from './UserAvatar';
import { STATUS_MASCOT } from '@/lib/statusMascot';
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

// น้องพุงเด้ง changes pose through the day: [from hour, pose, description].
const TIME_POSES: [number, string, string][] = [
  [5, 'morning', 'น้องพุงเด้งตื่นนอนถือกาแฟ'],
  [10, 'lunch', 'น้องพุงเด้งกินข้าวกะเพราไข่ดาว'],
  [13, 'afternoon', 'น้องพุงเด้งดูดชานมไข่มุกกับไอศกรีม'],
  [16, 'evening', 'น้องพุงเด้งขี่สกู๊ตเตอร์ส่งอาหาร'],
  [19, 'dinner', 'น้องพุงเด้งลูบพุงอิ่ม'],
  [22, 'night', 'น้องพุงเด้งใส่หมวกนอนกอดบะหมี่'],
];

function poseFor(hour: number) {
  const pose = [...TIME_POSES].reverse().find(([from]) => hour >= from) ?? TIME_POSES[TIME_POSES.length - 1];
  return { src: `/mascots/time/${pose[1]}.webp`, alt: pose[2] };
}

/**
 * The pose for the device clock. The page is prerendered at build time, so the first
 * render shows nothing and the real pose fills in after mount; it re-checks every minute.
 */
function useTimePose() {
  const [pose, setPose] = useState<{ src: string; alt: string } | null>(null);
  useEffect(() => {
    const update = () => setPose(poseFor(new Date().getHours()));
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, []);
  return pose;
}


/** The most advanced active order is the most useful one to show at a glance. */
function pickActiveOrder(trackingOrders: Order[]) {
  const rank = ['delivering', 'cooking', 'pending', 'completed'];
  return [...trackingOrders]
    .filter(o => ORDER_STATUS[o.status])
    .sort((a, b) => rank.indexOf(a.status) - rank.indexOf(b.status))[0];
}

/** Shows every supporter in turn, one every few seconds, then starts over. */
function SupporterTicker({ supporters, compact = false }: { supporters: Supporter[]; compact?: boolean }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (supporters.length < 2) return;
    const id = setInterval(() => setTick(t => t + 1), TICKER_MS);
    return () => clearInterval(id);
  }, [supporters.length]);
  const current = supporters.length ? supporters[tick % supporters.length] : null;
  const avatar = compact ? 'w-5 h-5' : 'w-6 h-6';

  if (!current) {
    return (
      <>
        <span className={`${avatar} rounded-full bg-rose-50 flex items-center justify-center shrink-0`}>
          <Heart className="w-3.5 h-3.5 text-pink-500 fill-pink-500" />
        </span>
        <span className="text-xs font-black truncate">ผู้สนับสนุน</span>
      </>
    );
  }
  return (
    // Keyed by supporter so each one slides in fresh
    <span key={`${current.key}-${tick}`} className="flex items-center gap-1.5 min-w-0 animate-in fade-in slide-in-from-bottom-3 duration-500 motion-reduce:animate-none">
      <span className={`${avatar} rounded-full overflow-hidden ring-2 ring-white bg-white shrink-0`}>
        <UserAvatar src={current.avatar_url} alt={current.display_name} />
      </span>
      <span className={`${compact ? 'text-xs' : 'text-xs'} font-black truncate`}>{current.display_name}</span>
      {current.total > 0 && (
        <span className={`${compact ? 'text-xs' : 'text-xs'} font-bold text-[#1D9E75] shrink-0`}>{formatBaht(current.total)}</span>
      )}
    </span>
  );
}

/** A slim version of the hero, pinned under the header once the full card scrolls away. */
export function HomeHeroCompact({
  supporters, openShopCount, trackingOrders, onOpenSupporters, onOpenTracking,
}: Omit<HomeHeroProps, 'userName'>) {
  const pose = useTimePose();
  const activeOrder = pickActiveOrder(trackingOrders);
  const status = activeOrder ? ORDER_STATUS[activeOrder.status] : null;
  return (
    <div className="relative overflow-hidden isolate rounded-2xl bg-gradient-to-br from-[#C3EBDC] to-[#9FE1CB] px-1.5 py-1 flex items-center gap-1.5 shadow-[0_4px_12px_-6px_rgba(15,110,86,0.35)] animate-in fade-in slide-in-from-top-2 duration-300 motion-reduce:animate-none">
      <WavePattern className="text-white/70 -z-10" />
      {pose ? (
        <img src={pose.src} alt={pose.alt} className="w-8 h-8 object-contain shrink-0 pointer-events-none select-none" />
      ) : (
        <span className="w-8 h-8 shrink-0" />
      )}
      <button
        type="button"
        onClick={onOpenSupporters}
        className="flex-1 min-w-0 h-7 rounded-full bg-white text-[#085041] pl-1 pr-2 flex items-center gap-1.5 overflow-hidden active:scale-95 transition"
      >
        <SupporterTicker supporters={supporters} compact />
      </button>
      {activeOrder && status ? (
        <button
          type="button"
          onClick={onOpenTracking}
          className="relative h-7 rounded-full bg-white text-[#0F6E56] px-2 flex items-center gap-1 text-xs font-bold shrink-0 active:scale-95 transition"
        >
          {activeOrder.has_customer_unread_message && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-rose-500" />}
          <status.icon className="w-3.5 h-3.5" />
          <span className="max-w-[72px] truncate">{status.label}</span>
        </button>
      ) : (
        <span className="h-7 rounded-full bg-white text-[#0F6E56] px-2 flex items-center gap-1 text-xs font-bold shrink-0">
          <Store className="w-3.5 h-3.5" /> {openShopCount} ร้านเปิด
        </span>
      )}
    </div>
  );
}

export default function HomeHero({
  supporters, userName, openShopCount, trackingOrders, onOpenSupporters, onOpenTracking,
}: HomeHeroProps) {
  const firstName = userName?.split(' ')[0];
  const pose = useTimePose();
  const activeOrder = pickActiveOrder(trackingOrders);
  const status = activeOrder ? ORDER_STATUS[activeOrder.status] : null;

  return (
    <section className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-2.5">
      {/* Greeting. When large text leaves the card too narrow, the mascot steps aside for the words. */}
      <div className="relative overflow-hidden @container rounded-2xl bg-gradient-to-br from-[#C3EBDC] to-[#9FE1CB] p-3.5 min-h-[128px] shadow-[0_6px_16px_-6px_rgba(15,110,86,0.35)]">
        <WavePattern />
        <p className="relative z-10 text-xs font-bold text-[#085041] truncate pr-16 @max-[10rem]:pr-0">สวัสดี{firstName ? ` ${firstName}` : ''}</p>
        <h2 className="relative z-10 text-sm font-black text-[#04342C] mt-1 leading-snug pr-[64px] sm:pr-24 @max-[10rem]:pr-0">
          {/* Break between phrases only, never mid-word */}
          <span className="whitespace-nowrap">สั่งอาหาร</span><wbr /><span className="whitespace-nowrap">กับน้องพุงเด้ง</span>
        </h2>
        <p className="relative z-10 text-xs font-bold text-[#085041] leading-snug pr-[64px] sm:pr-24 @max-[10rem]:pr-0">
          <span className="whitespace-nowrap">จัดส่งถึง</span><wbr /><span className="whitespace-nowrap">หน้าบ้าน/หอพัก</span>
        </p>
        <p className="relative z-10 mt-1.5 pr-[72px] sm:pr-24 @max-[10rem]:pr-0 text-xs font-medium text-[#0F6E56] leading-snug flex gap-1">
          <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
          <span>
            <span className="whitespace-nowrap">ชุมชนห้วยชัน - นาฝาย</span>{' '}
            <span className="whitespace-nowrap">&amp; มรภ.ชัยภูมิ</span>
          </span>
        </p>
        {pose && (
          <img
            key={pose.src}
            src={pose.src}
            alt={pose.alt}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-[68px] sm:w-24 @max-[10rem]:hidden pointer-events-none select-none drop-shadow-sm animate-in fade-in zoom-in-95 duration-500 motion-reduce:animate-none"
          />
        )}
        <Sparkles className="absolute right-[72px] sm:right-24 top-4 w-3.5 h-3.5 text-white pointer-events-none @max-[10rem]:hidden" />
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
          <SupporterTicker supporters={supporters} />
        </button>

        {/* My order status, or how many shops are open */}
        {activeOrder && status ? (
          <button
            type="button"
            onClick={onOpenTracking}
            className="flex-1 bg-white border border-[#E1F5EE] shadow-[0_6px_16px_-6px_rgba(15,110,86,0.3)] rounded-2xl p-2 flex flex-col items-center justify-center text-center active:scale-95 transition relative"
          >
            {activeOrder.has_customer_unread_message && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500" />}
            {STATUS_MASCOT[activeOrder.status] ? (
              <img
                src={STATUS_MASCOT[activeOrder.status].src}
                alt={STATUS_MASCOT[activeOrder.status].alt}
                className="w-14 h-14 object-contain pointer-events-none select-none drop-shadow-sm"
              />
            ) : (
              <status.icon className="w-5 h-5 text-[#1D9E75]" />
            )}
            <span className="text-sm font-black text-gray-900 mt-0.5 leading-tight">{status.label}</span>
            <span className="text-xs text-gray-500 leading-tight">
              ออเดอร์ <span className="whitespace-nowrap">#{formatOrderCode(activeOrder)}{trackingOrders.length > 1 ? ` +${trackingOrders.length - 1}` : ''}</span>
            </span>
          </button>
        ) : (
          <div className="flex-1 bg-white border border-[#E1F5EE] shadow-[0_6px_16px_-6px_rgba(15,110,86,0.3)] rounded-2xl p-2 flex flex-col items-center justify-center text-center">
            <Store className="w-4 h-4 text-[#1D9E75] mb-0.5" />
            <span className="text-2xl font-black text-[#1D9E75] leading-tight">{openShopCount}</span>
            <span className="text-xs text-gray-500">ร้านเปิดอยู่</span>
          </div>
        )}
      </div>
    </section>
  );
}
