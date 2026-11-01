'use client';

import React from 'react';

export type MascotPage =
  | 'profile' | 'cart' | 'history' | 'tracking' | 'chat' | 'contact'
  | 'terms' | 'supporters' | 'donate' | 'shop' | 'merchant' | 'admin';

/**
 * A faint พุงเด้ง in the bottom-right corner, a different pose per page.
 * By default it pins to the nearest positioned parent (a modal panel);
 * `fixed` pins it to the screen corner for full pages. It never takes clicks.
 */
export default function MascotWatermark({ page, fixed = false }: { page: MascotPage; fixed?: boolean }) {
  const position = fixed ? 'fixed right-0 bottom-0 w-48 sm:w-60' : 'absolute -right-4 -bottom-4 w-40 sm:w-48';
  return (
    <img
      src={`/mascots/bg/${page}.webp`}
      alt=""
      aria-hidden="true"
      className={`pointer-events-none select-none opacity-[0.12] z-10 ${position}`}
    />
  );
}
