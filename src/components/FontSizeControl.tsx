'use client';

import React, { useEffect, useState } from 'react';
import { Type } from 'lucide-react';
import { FONT_SCALES, FontScale, applyFontScale, readFontScale } from '@/lib/fontScale';

// The sample letter in each button is drawn at that size, so the choice is visible at a glance.
const SAMPLE_SIZE: Record<FontScale, string> = { normal: 'text-sm', large: 'text-base', xlarge: 'text-lg' };

/** Three-way text size picker: normal, large, extra large. Saved on this device. */
export default function FontSizeControl() {
  const [scale, setScale] = useState<FontScale>('normal');
  useEffect(() => setScale(readFontScale()), []);

  const choose = (next: FontScale) => {
    setScale(next);
    applyFontScale(next);
  };

  return (
    <div className="w-full p-3 rounded-2xl border border-gray-200 bg-white space-y-2">
      <p className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
        <Type className="w-4 h-4 text-brand-500" /> ขนาดตัวอักษร
      </p>
      <div className="grid grid-cols-3 gap-1.5 bg-gray-100 p-1 rounded-xl">
        {FONT_SCALES.map(s => (
          <button
            key={s.id}
            type="button"
            onClick={() => choose(s.id)}
            aria-pressed={scale === s.id}
            className={`py-1.5 rounded-lg flex flex-col items-center leading-tight transition ${
              scale === s.id ? 'bg-white text-brand-700 shadow-xs' : 'text-gray-500'
            }`}
          >
            <span className={`${SAMPLE_SIZE[s.id]} font-black`}>ก</span>
            <span className="text-xs font-bold">{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
