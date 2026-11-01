import React from 'react';

/** Soft flowing lines that fill their positioned parent, used as a decorative backdrop. */
export default function WavePattern({ className = 'text-white/80' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 320 160"
      preserveAspectRatio="xMidYMid slice"
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
    >
      <path d="M-20 40 C 40 10, 90 70, 150 40 S 260 10, 340 45" strokeWidth="10" opacity="0.6" />
      <path d="M-20 100 C 50 70, 110 130, 180 95 S 280 70, 340 105" strokeWidth="14" opacity="0.45" />
      <path d="M-20 150 C 60 120, 120 175, 200 140 S 290 120, 340 150" strokeWidth="8" opacity="0.5" />
      <path d="M200 -10 C 230 30, 290 20, 330 60" strokeWidth="3" opacity="0.8" />
    </svg>
  );
}
