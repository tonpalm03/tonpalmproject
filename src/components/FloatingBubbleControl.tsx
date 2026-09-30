'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CircleDot } from 'lucide-react';
import { floatingBubble, supportsFloatingBubble } from '@/lib/floatingBubble';

export default function FloatingBubbleControl({ shopId, isOpen, count, onOpenOrders }: {
  shopId: string; isOpen: boolean; count: number; onOpenOrders: () => void;
}) {
  const [supported, setSupported] = useState(false);
  const router = useRouter();
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const waitingPermission = useRef(false);
  const started = useRef(false);
  const latest = useRef({ isOpen, count, onOpenOrders });
  useEffect(() => { latest.current = { isOpen, count, onOpenOrders }; }, [isOpen, count, onOpenOrders]);
  const key = `merchant-bubble:${shopId}`;

  useEffect(() => {
    if (!supportsFloatingBubble()) return;
    let disposed = false;
    const restore = async () => {
      const status = await floatingBubble.checkPermission();
      if (disposed) return;
      setSupported(true);
      if (waitingPermission.current) {
        waitingPermission.current = false;
        if (status.granted) {
          localStorage.setItem(key, 'true'); setEnabled(true); setError('');
        } else setError('ยังไม่ได้อนุญาตให้แสดงทับแอปอื่น');
      } else if (started.current && (!status.running || !status.granted)) {
        localStorage.removeItem(key); setEnabled(false); started.current = false;
      } else setEnabled(localStorage.getItem(key) === 'true' && status.granted);
    };
    void restore().catch(() => { if (!disposed) setError('ตรวจสอบสิทธิ์ปุ่มลอยไม่สำเร็จ'); });
    const resume = floatingBubble.addListener('resume', () => { void restore().catch(() => setError('ตรวจสอบสิทธิ์ปุ่มลอยไม่สำเร็จ')); });
    const open = floatingBubble.addListener('openOrders', () => {
      if (disposed) return;
      // /merchant also verifies the signed-in merchant before displaying orders.
      if (window.location.pathname.replace(/\/$/, '') !== '/merchant') router.push('/merchant');
      else latest.current.onOpenOrders();
    });
    return () => {
      disposed = true;
      void resume.then(handle => handle.remove());
      void open.then(handle => handle.remove());
      void floatingBubble.hideBubble();
      started.current = false;
    };
  }, [key, router]);

  useEffect(() => {
    if (!supported) return;
    if (enabled && isOpen) {
      void floatingBubble.showBubble({ shopId, count: latest.current.count }).then(() => {
        started.current = true;
      }).catch(() => {
        setError('เปิดปุ่มลอยไม่ได้ กรุณาเปิดแอปและตรวจสอบสิทธิ์อีกครั้ง');
        setEnabled(false); localStorage.removeItem(key);
      });
    } else {
      started.current = false;
      void floatingBubble.hideBubble();
    }
  }, [supported, enabled, isOpen, shopId, key]);

  useEffect(() => {
    if (supported && enabled) void floatingBubble.updateBadge({ shopId, count }).catch(() => {});
  }, [supported, enabled, shopId, count]);

  const toggle = async () => {
    setBusy(true); setError('');
    try {
      if (enabled) { localStorage.removeItem(key); setEnabled(false); return; }
      const status = await floatingBubble.checkPermission();
      if (!status.granted) {
        waitingPermission.current = true;
        await floatingBubble.requestPermission();
        return;
      }
      localStorage.setItem(key, 'true'); setEnabled(true);
    } catch {
      waitingPermission.current = false;
      setError('เปิดหน้าตั้งค่าปุ่มลอยไม่สำเร็จ กรุณาลองใหม่');
    } finally { setBusy(false); }
  };
  if (!supported) return null;
  return <div className="pt-2 border-t border-amber-100 text-xs space-y-2">
    <label className="flex items-center justify-between gap-3 font-bold text-gray-700">
      <span className="flex items-center gap-1.5">
        <CircleDot className="w-3.5 h-3.5 text-amber-600" />
        <span>แสดงปุ่มลอยเมื่อสลับไปแอปอื่น</span>
      </span>
      <input type="checkbox" role="switch" checked={enabled} disabled={busy} onChange={() => void toggle()} className="h-5 w-5 accent-orange-500" />
    </label>
    {enabled && <p className="text-gray-600">{isOpen ? 'แตะปุ่มลอยเพื่อกลับมารับออเดอร์' : 'ปุ่มลอยพักอยู่ระหว่างปิดร้าน'}</p>}
    {error && <p role="alert" className="text-red-600">{error}</p>}
  </div>;
}
