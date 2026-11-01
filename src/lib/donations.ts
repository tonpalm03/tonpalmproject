import { collection, onSnapshot, orderBy, query, type Unsubscribe } from 'firebase/firestore';
import { db } from './firebase';
import type { Donation } from '../types';

export const ANON_NAME = 'ผู้ใจดี';
export const MASCOT_AVATAR = '/mascots/pung-deng.webp';

export interface Supporter {
  key: string;
  display_name: string;
  avatar_url?: string;
  total: number;        // sum of visible amounts
  hidden_count: number; // donations with a hidden amount
  count: number;
  last_at: number;
  donations: Donation[];
}

export function toMillis(value: unknown): number {
  if (!value) return 0;
  const raw = value as { seconds?: number; toMillis?: () => number };
  if (typeof raw.toMillis === 'function') return raw.toMillis();
  if (typeof raw.seconds === 'number') return raw.seconds * 1000;
  const t = new Date(value as string).getTime();
  return Number.isFinite(t) ? t : 0;
}

export function subscribeDonations(onChange: (list: Donation[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'donations'), orderBy('created_at', 'desc')),
    snap => onChange(snap.docs.map(d => ({ id: d.id, ...d.data() } as Donation))),
    err => console.warn('Donations listener fallback:', err),
  );
}

/** Groups donations per supporter, ranked by total visible amount (largest first). */
export function aggregateSupporters(donations: Donation[]): Supporter[] {
  const map = new Map<string, Supporter>();
  for (const d of donations) {
    const s = map.get(d.supporter_key) ?? {
      key: d.supporter_key, display_name: d.display_name, avatar_url: d.avatar_url,
      total: 0, hidden_count: 0, count: 0, last_at: 0, donations: [],
    };
    const at = toMillis(d.created_at);
    if (at >= s.last_at) {
      s.last_at = at;
      s.display_name = d.display_name;
      s.avatar_url = d.avatar_url;
    }
    if (typeof d.amount === 'number') s.total += d.amount;
    else s.hidden_count += 1;
    s.count += 1;
    s.donations.push(d);
    map.set(d.supporter_key, s);
  }
  return [...map.values()].sort((a, b) => b.total - a.total || b.last_at - a.last_at);
}

export const formatBaht = (n: number) => `฿${n.toLocaleString('th-TH', { maximumFractionDigits: 2 })}`;


/** Compresses a slip photo to a JPEG data URL small enough for a Firestore field. */
export function compressSlip(file: File, maxDim = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('กรุณาเลือกไฟล์รูปภาพเท่านั้น'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('อ่านไฟล์รูปไม่สำเร็จ'));
    reader.onload = e => {
      const img = new Image();
      img.onerror = () => reject(new Error('เปิดรูปไม่สำเร็จ'));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('เบราว์เซอร์ไม่รองรับการย่อรูป')); return; }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        let quality = 0.8;
        let url = canvas.toDataURL('image/jpeg', quality);
        while (url.length > 850_000 && quality > 0.3) {
          quality -= 0.15;
          url = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(url);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}
