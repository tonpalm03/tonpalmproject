'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Heart } from 'lucide-react';
import { Donation } from '@/types';
import { donationLevel, formatBaht, toMillis } from '@/lib/donations';
import { soundAlert } from '@/lib/soundAlert';
import UserAvatar from './UserAvatar';

const CONFETTI_COLORS = ['#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#a855f7', '#facc15'];
const DURATION_MS = [5000, 5500, 7000, 9000];

/** Stream-style alert for donations approved while the app is open. */
export default function DonationPopup({ donations }: { donations: Donation[] }) {
  const [startedAt] = useState(() => Date.now());
  const seen = useRef(new Set<string>());
  const [queue, setQueue] = useState<Donation[]>([]);
  const current = queue[0] ?? null;

  useEffect(() => {
    const fresh = donations.filter(d =>
      d.notify && !seen.current.has(d.id) && toMillis(d.created_at) > startedAt - 5000);
    if (fresh.length === 0) return;
    fresh.forEach(d => seen.current.add(d.id));
    // Oldest first so alerts play in the order they were approved.
    fresh.sort((a, b) => toMillis(a.created_at) - toMillis(b.created_at));
    setQueue(q => [...q, ...fresh]);
  }, [donations, startedAt]);

  const dismiss = () => setQueue(q => q.slice(1));

  useEffect(() => {
    if (!current) return;
    soundAlert.playDonationSound().catch(() => {});
    const timer = setTimeout(() => setQueue(q => q.slice(1)), DURATION_MS[donationLevel(current.amount)]);
    return () => clearTimeout(timer);
  }, [current]);

  if (!current) return null;
  return <PopupCard key={current.id} donation={current} onClose={dismiss} />;
}

// Deterministic per-piece randomness keeps renders pure.
const rand = (seed: number) => {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
};

function PopupCard({ donation, onClose }: { donation: Donation; onClose: () => void }) {
  const level = donationLevel(donation.amount);
  const gold = level === 3;
  const pieces = useMemo(() => {
    const count = level === 0 ? 0 : level === 1 ? 40 : 110;
    return Array.from({ length: count }, (_, i) => ({
      left: rand(i * 4 + 1) * 100,
      delay: rand(i * 4 + 2) * (level === 1 ? 1.2 : 2.5),
      duration: 2.4 + rand(i * 4 + 3) * 2.2,
      size: 6 + rand(i * 4 + 4) * 6,
      color: gold && i % 2 === 0 ? '#facc15' : CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      round: i % 3 === 0,
    }));
  }, [level, gold]);

  return (
    <div className="fixed inset-0 z-[400] pointer-events-none flex items-start justify-center pt-24 px-4">
      {pieces.length > 0 && (
        <div className={`absolute inset-x-0 top-0 overflow-hidden ${level >= 2 ? 'h-full' : 'h-72'}`}>
          {pieces.map((p, i) => (
            <span
              key={i}
              className="donate-confetti absolute top-0"
              style={{
                left: `${p.left}%`,
                width: p.size,
                height: p.round ? p.size : p.size * 0.45,
                background: p.color,
                borderRadius: p.round ? '9999px' : '2px',
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
              }}
            />
          ))}
        </div>
      )}

      {level >= 2 && (
        <img src="/mascots/pung-deng-scooter.webp" alt="" className="donate-scooter absolute bottom-16 w-36" />
      )}

      <button
        onClick={onClose}
        className={`donate-pop pointer-events-auto relative w-full max-w-sm rounded-3xl p-4 text-center shadow-2xl border-4 ${
          gold ? 'bg-gradient-to-b from-amber-50 to-yellow-100 border-amber-400' : 'bg-white border-emerald-400'
        }`}
      >
        <div className={`mx-auto -mt-12 w-20 h-20 rounded-full overflow-hidden ring-4 ${gold ? 'ring-amber-400' : 'ring-emerald-400'} bg-emerald-50`}>
          <UserAvatar src={donation.avatar_url} alt={donation.display_name} />
        </div>
        <p className="mt-2 text-sm font-bold text-gray-500 flex items-center justify-center gap-1">
          <Heart className="w-4 h-4 text-pink-500 fill-pink-500" /> ขอบคุณที่สนับสนุนพุงเด้ง
        </p>
        <p className="text-lg font-black text-gray-900 truncate">{donation.display_name}</p>
        {donation.amount !== null && (
          <p className={`font-black ${gold ? 'text-4xl text-amber-600' : level >= 1 ? 'text-3xl text-emerald-600' : 'text-2xl text-emerald-600'}`}>
            {formatBaht(donation.amount)}
          </p>
        )}
        {donation.message && !donation.message_hidden && (
          <p className="mt-2 text-sm text-gray-700 bg-gray-50 rounded-2xl px-3 py-2 break-words line-clamp-4">{donation.message}</p>
        )}
      </button>
    </div>
  );
}
