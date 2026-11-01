/**
 * Text size chosen by the user. It scales the root font size, and every Tailwind size and
 * spacing is in rem, so the whole app grows together like a browser zoom.
 */
export type FontScale = 'normal' | 'large' | 'xlarge';

export const FONT_SCALES: { id: FontScale; label: string; percent: number }[] = [
  { id: 'normal', label: 'ปกติ', percent: 100 },
  { id: 'large', label: 'ใหญ่', percent: 112.5 },
  { id: 'xlarge', label: 'ใหญ่มาก', percent: 125 },
];

export const FONT_SCALE_KEY = 'cprufood_font_scale';

// Runs in <head> before the page paints, so a saved size shows without a flash.
export const FONT_SCALE_BOOT_SCRIPT = `try{var p={large:'112.5%',xlarge:'125%'}[localStorage.getItem('${FONT_SCALE_KEY}')];if(p)document.documentElement.style.fontSize=p}catch(e){}`;

export function readFontScale(): FontScale {
  try {
    const v = localStorage.getItem(FONT_SCALE_KEY);
    if (v === 'large' || v === 'xlarge') return v;
  } catch {}
  return 'normal';
}

export function applyFontScale(scale: FontScale) {
  const percent = FONT_SCALES.find(s => s.id === scale)?.percent ?? 100;
  document.documentElement.style.fontSize = percent === 100 ? '' : `${percent}%`;
  try {
    if (scale === 'normal') localStorage.removeItem(FONT_SCALE_KEY);
    else localStorage.setItem(FONT_SCALE_KEY, scale);
  } catch {}
}
