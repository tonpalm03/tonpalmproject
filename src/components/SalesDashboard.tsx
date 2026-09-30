'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Order, Shop, CreditTransaction } from '@/types';
import { dateKey, summarizeSales } from '@/lib/salesSummary';
import { formatOrderCode } from '@/lib/orderNumber';
import { formatThaiDateWithTime } from '@/lib/dateUtils';
import { Clock, FileText, X, Phone, MapPin, Utensils, CheckCircle2, FileEdit } from 'lucide-react';

const money = (value: number) => value.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
type Period = 'day' | 'week' | 'month' | 'year' | 'custom';
const periods: [Period, string][] = [['day', 'รายวัน'], ['week', 'รายสัปดาห์'], ['month', 'รายเดือน'], ['year', 'รายปี'], ['custom', 'กำหนดเอง']];

const formatOrderTime = (val: any): string => {
  if (!val) return '—';
  let d: Date | null = null;
  if (typeof val === 'object' && typeof val.seconds === 'number') {
    d = new Date(val.seconds * 1000);
  } else if (typeof val === 'string') {
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) d = parsed;
  } else if (val instanceof Date) {
    d = val;
  }
  if (!d) return String(val);
  return formatThaiDateWithTime(d);
};

export default function SalesDashboard({ orders, shops, shopId, onTopup, onViewCreditHistory }: {
  orders: Order[]; shops: Shop[]; shopId?: string; onTopup?: () => void; onViewCreditHistory?: () => void;
}) {
  const [period, setPeriod] = useState<Period>('day');
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [customEnd, setCustomEnd] = useState(() => dateKey(new Date()));
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [ledgerStatus, setLedgerStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [selectedBillOrder, setSelectedBillOrder] = useState<Order | null>(null);
  useEffect(() => {
    const source = collection(db, 'credit_transactions');
    return onSnapshot(shopId ? query(source, where('shop_id', '==', shopId)) : source, snap => {
      setTransactions(snap.docs.map(d => ({ ...d.data(), id: d.id } as CreditTransaction)));
      setLedgerStatus('ready');
    }, () => setLedgerStatus('error'));
  }, [shopId]);

  let start = selectedDate, end = selectedDate;
  if (period === 'month') { start = selectedDate.slice(0, 7) + '-01'; end = selectedDate.slice(0, 7) + '-31'; }
  if (period === 'year') { start = selectedDate.slice(0, 4) + '-01-01'; end = selectedDate.slice(0, 4) + '-12-31'; }
  if (period === 'week' && selectedDate) {
    const date = new Date(selectedDate + 'T12:00:00+07:00');
    const day = date.getUTCDay();
    date.setUTCDate(date.getUTCDate() - (day === 0 ? 6 : day - 1));
    start = dateKey(date); date.setUTCDate(date.getUTCDate() + 6); end = dateKey(date);
  }
  if (period === 'custom') end = customEnd;
  const invalidRange = !start || !end || start > end;
  const summary = summarizeSales(orders, transactions, invalidRange ? '9999' : start, invalidRange ? '0000' : end);
  const ready = ledgerStatus === 'ready';
  const credit = shops.reduce((sum, shop) => sum + (shop.credit_balance ?? 0), 0);
  const card = (title: string, value: number, detail: string, accent = false, available = true) => (
    <div key={title} className={`rounded-2xl border p-4 ${accent ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-gray-100 bg-white text-slate-900'}`}>
      <p className={`text-xs ${accent ? 'text-emerald-50' : 'text-slate-500'}`}>{title}</p>
      <p className="mt-2 text-2xl font-black tabular-nums">{available ? `${money(value)} ฿` : '—'}</p>
      <p className={`mt-2 text-[11px] ${accent ? 'text-emerald-50' : 'text-slate-500'}`}>{detail}</p>
    </div>
  );
  const ranking = new Map<string, { name: string; value: number; count: number }>();
  for (const order of summary.completed) {
    if (!shopId) {
      const row = ranking.get(order.shop_id) ?? { name: order.shop_name ?? 'ร้านค้า', value: 0, count: 0 };
      row.value += order.food_subtotal ?? 0; row.count++; ranking.set(order.shop_id, row);
    } else for (const item of order.items ?? []) {
      const key = item.menu_id || item.name;
      const row = ranking.get(key) ?? { name: item.name, value: 0, count: 0 };
      row.count += item.quantity; ranking.set(key, row);
    }
  }

  return <section className="space-y-4" aria-label={shopId ? 'รายงานยอดขายร้านค้า' : 'รายงานยอดขายและรายได้แพลตฟอร์ม'}>
    <div className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
      <div className="flex flex-wrap gap-2">{periods.map(([value, label]) => <button key={value} type="button" onClick={() => setPeriod(value)} aria-pressed={period === value} className={`rounded-xl px-3 py-2 text-xs font-bold ${period === value ? 'bg-amber-500 text-white' : 'bg-slate-50 text-slate-600'}`}>{label}</button>)}</div>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <label className="flex items-center gap-2">{period === 'custom' ? 'ตั้งแต่' : 'วันที่อ้างอิง'}<input aria-label="วันที่เริ่มรายงาน" type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="rounded-lg border border-gray-200 p-2" /></label>
        {period === 'custom' && <label className="flex items-center gap-2">ถึง<input aria-label="วันที่สิ้นสุดรายงาน" type="date" value={customEnd} min={selectedDate} onChange={e => setCustomEnd(e.target.value)} className="rounded-lg border border-gray-200 p-2" /></label>}
        <button type="button" onClick={() => { setSelectedDate(dateKey(new Date())); setCustomEnd(dateKey(new Date())); }} className="font-bold text-amber-700">กลับมาวันนี้</button>
      </div>
      <p className="text-[11px] text-slate-500">ช่วง {start} ถึง {end} • นับยอดขายตามวันส่งสำเร็จ เวลาไทย • สำเร็จ {summary.completed.length} บิล • ยกเลิกตามวันสั่ง {summary.cancelled} บิล</p>
      {invalidRange && <p role="alert" className="text-xs text-red-600">กรุณาเลือกช่วงวันที่ให้ถูกต้อง</p>}
      {!ready && <p role="status" className="text-xs text-amber-700">{ledgerStatus === 'error' ? 'โหลดบัญชีเครดิตไม่สำเร็จ จึงยังแสดงค่าบริการและยอดหลังหักไม่ได้ กรุณาลองเปิดหน้านี้อีกครั้ง' : 'กำลังตรวจสอบรายการหักเครดิต…'}</p>}
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      {card(shopId ? 'ยอดขายอาหาร' : 'ยอดอาหารทุกร้าน', summary.food, 'เฉพาะออเดอร์ส่งสำเร็จ')}
      {card('ค่าจัดส่งของร้าน', summary.delivery, 'รวมค่าส่งตามบิลจริง')}
      {card('ยอดรับจากลูกค้าตามบิล', summary.collected, 'ร้านรับโดยตรง รวมอาหารและค่าส่ง')}
      {shopId ? card('ยอดหลังหักค่าบริการ', summary.net, 'ยังไม่หักต้นทุนอาหารและค่าใช้จ่ายร้าน', true, ready) : card('รายได้ค่าบริการระบบ', summary.serviceRevenue, 'จากรายการหักเครดิตจริงในช่วงที่เลือก', true, ready)}
    </div>
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h3 className="font-bold text-emerald-950">{shopId ? 'เครดิตและค่าบริการร้านค้า' : 'เครดิตร้านค้าในระบบ'}</h3><p className="mt-1 text-xs text-emerald-900">ยอดเครดิตคงเหลือปัจจุบัน {money(credit)} บาท • ยอดนี้ไม่เปลี่ยนตามตัวกรองวันที่</p></div>
        <div className="flex flex-wrap items-center gap-2">
          {onViewCreditHistory && (
            <button type="button" onClick={onViewCreditHistory} className="rounded-xl bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 px-3 py-2 text-xs font-bold transition active:scale-95 cursor-pointer shadow-2xs inline-flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-emerald-600" />
              <span>ดูประวัติเครดิต</span>
            </button>
          )}
          {onTopup && <button type="button" onClick={onTopup} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-bold text-white transition active:scale-95 cursor-pointer shadow-2xs">เติมเครดิต</button>}
        </div>
      </div>
      <div className="grid sm:grid-cols-3 gap-3 text-xs text-emerald-950">
        <p>เติมเครดิตในช่วงนี้ <strong className="block mt-1 text-lg">{ready ? money(summary.topups) : '—'} ฿</strong></p>
        <p>ค่าบริการของบิลสำเร็จในช่วงนี้<strong className="block mt-1 text-lg">{ready ? money(summary.gp) : '—'} ฿</strong></p>
        <p>ปรับลด / คืนเครดิตผ่านแอดมิน<strong className="block mt-1 text-lg">{ready ? money(summary.deductions) : '—'} ฿</strong></p>
      </div>
      <p className="text-[11px] leading-relaxed text-emerald-800">ยอดเติมเครดิตเป็นเงินล่วงหน้าสำหรับใช้บริการ จึงแยกจากรายได้ค่าบริการที่หักจริง ไม่ต้องโอน GP ซ้ำรายสัปดาห์ รายการเติมและปรับลดนับตามวันที่ทำรายการ หากคืนค่าอาหารภายหลัง กรุณาให้แอดมินตรวจสอบยอด รายงานนี้ยังไม่หักเงินคืนค่าอาหารที่ทำภายนอกระบบ</p>
    </div>
    <div className="rounded-2xl border border-gray-100 bg-white p-4">
      <h3 className="font-bold text-sm text-slate-900">{shopId ? '5 เมนูขายดี' : 'อันดับยอดขายร้านค้า'} <span className="font-normal text-xs text-slate-500">ในช่วงที่เลือก</span></h3>
      {ranking.size === 0 ? <p className="py-6 text-center text-xs text-slate-400">ยังไม่มียอดขายในช่วงนี้</p> : [...ranking.entries()].sort((a, b) => shopId ? b[1].count - a[1].count : b[1].value - a[1].value).slice(0, shopId ? 5 : undefined).map(([id, row], index) => <div key={id} className="flex justify-between gap-3 border-b border-gray-50 py-3 text-xs"><span>{index + 1}. {row.name}</span><strong>{shopId ? `${row.count} รายการ` : `${money(row.value)} ฿ • ${row.count} บิล`}</strong></div>)}
    </div>
    {/* Completed Bills Table with Detailed Timestamp and Clickable Detail */}
    <details className="rounded-2xl border border-gray-100 bg-white p-4" open>
      <summary className="cursor-pointer font-bold text-sm flex items-center justify-between">
        <span>บิลส่งสำเร็จ ({summary.completed.length})</span>
        <span className="text-xs text-amber-700 font-normal">แตะ "ดูรายละเอียด" เพื่อดูข้อมูลแต่ละบิล</span>
      </summary>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-xs whitespace-nowrap">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="p-3">บิล / วันเวลาส่งสำเร็จ</th>
              <th className="p-3">ร้านค้า</th>
              <th className="p-3 text-right">ยอดอาหาร</th>
              <th className="p-3 text-right">ค่าส่ง</th>
              <th className="p-3 text-right">หักเครดิต</th>
              <th className="p-3 text-right">หลังหักค่าบริการ</th>
              <th className="p-3 text-center">รายละเอียด</th>
            </tr>
          </thead>
          <tbody>
            {summary.completed.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-slate-400">
                  ยังไม่มีออเดอร์ส่งสำเร็จในช่วงนี้
                </td>
              </tr>
            )}
            {summary.completed.map(o => {
              const charge = summary.charges.get(o.id) ?? 0;
              const netAmount = (o.total_amount ?? 0) - charge;
              const timeDisplay = formatOrderTime(o.completed_at || o.created_at);

              return (
                <tr key={o.id} className="border-b border-gray-50 hover:bg-amber-50/30 transition">
                  <td className="p-3">
                    <span className="font-mono font-bold text-slate-900 block">
                      #{formatOrderCode(o)}
                    </span>
                    <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 font-medium">
                      <Clock className="w-3 h-3 text-amber-500 shrink-0" />
                      <span>{timeDisplay}</span>
                    </span>
                  </td>
                  <td className="p-3 font-medium text-slate-800">{o.shop_name}</td>
                  <td className="p-3 text-right font-medium">{money(o.food_subtotal ?? 0)} ฿</td>
                  <td className="p-3 text-right font-medium">{money(o.delivery_fee ?? 0)} ฿</td>
                  <td className="p-3 text-right text-rose-600 font-medium">
                    {ready ? `${money(charge)} ฿` : '—'}
                  </td>
                  <td className="p-3 text-right font-bold text-emerald-700">
                    {ready ? `${money(netAmount)} ฿` : '—'}
                  </td>
                  <td className="p-3 text-center">
                    <button
                      type="button"
                      onClick={() => setSelectedBillOrder(o)}
                      className="px-2.5 py-1 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition shadow-2xs active:scale-95 inline-flex items-center gap-1 cursor-pointer"
                      title="กดเพื่อดูรายละเอียดออเดอร์และรายการอาหาร"
                    >
                      <FileText className="w-3 h-3 text-amber-600" />
                      <span>ดูรายละเอียด</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>

    {/* Order Details Modal for Sales Bills */}
    {selectedBillOrder && (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150 border border-gray-100 my-8">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-150">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-base text-gray-900 flex items-center gap-1.5">
                  <span>บิล #{formatOrderCode(selectedBillOrder)}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    ส่งสำเร็จแล้ว
                  </span>
                </h3>
                <p className="text-xs text-gray-500 font-medium">
                  {selectedBillOrder.shop_name}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedBillOrder(null)}
              className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Time & Dates Banner */}
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-150 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                <span>เวลาสั่งซื้อ:</span>
              </span>
              <span className="font-bold text-slate-800 font-mono">
                {formatOrderTime(selectedBillOrder.created_at)}
              </span>
            </div>
            {selectedBillOrder.completed_at && (
              <div className="flex items-center justify-between">
                <span className="text-emerald-700 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>เวลาส่งสำเร็จ:</span>
                </span>
                <span className="font-bold text-emerald-800 font-mono">
                  {formatOrderTime(selectedBillOrder.completed_at)}
                </span>
              </div>
            )}
          </div>

          {/* Customer & Delivery Details */}
          <div className="bg-white p-3.5 rounded-2xl border border-gray-150 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 font-medium">ลูกค้า:</span>
              <span className="font-bold text-gray-900">{selectedBillOrder.customer_name}</span>
            </div>
            {selectedBillOrder.customer_phone && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500 font-medium">เบอร์โทรศัพท์:</span>
                <a
                  href={`tel:${selectedBillOrder.customer_phone}`}
                  className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg font-mono font-bold flex items-center gap-1 transition"
                >
                  <Phone className="w-3 h-3 text-emerald-600" />
                  <span>{selectedBillOrder.customer_phone}</span>
                </a>
              </div>
            )}
            <div className="flex items-start justify-between gap-2 pt-1 border-t border-gray-100">
              <span className="text-gray-500 font-medium shrink-0 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-gray-400" />
                <span>ที่อยู่จัดส่ง:</span>
              </span>
              <span className="font-medium text-gray-800 text-right">
                {selectedBillOrder.delivery_address || '-'}
              </span>
            </div>
          </div>

          {/* Ordered Food Items List */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-gray-900 flex items-center gap-1">
              <Utensils className="w-3.5 h-3.5 text-amber-600" />
              <span>รายการอาหารที่สั่ง ({selectedBillOrder.items?.reduce((s, i) => s + i.quantity, 0) || 0} ชิ้น)</span>
            </span>
            <div className="bg-gray-50 rounded-2xl p-3 border border-gray-150 space-y-2 max-h-48 overflow-y-auto">
              {selectedBillOrder.items?.map((item, idx) => (
                <div key={idx} className="flex justify-between items-start text-xs border-b border-gray-100 pb-1.5 last:border-b-0 last:pb-0">
                  <div className="flex-1 pr-2">
                    <p className="font-bold text-gray-800">
                      <span className="text-amber-600 font-black">{item.quantity}x</span> {item.name}
                    </p>
                    {item.selected_options && item.selected_options.length > 0 && (
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        {item.selected_options.map(o => `+ ${o.name} (${o.price}฿)`).join(', ')}
                      </p>
                    )}
                    {item.note && (
                      <p className="text-[10px] text-amber-700 italic mt-0.5 flex items-center gap-1">
                        <FileEdit className="w-2.5 h-2.5 shrink-0" />
                        <span>{item.note}</span>
                      </p>
                    )}
                  </div>
                  <span className="font-bold text-gray-800 whitespace-nowrap">
                    {money(item.price * item.quantity)} ฿
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Financial Calculation Breakdown */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50/40 p-3.5 rounded-2xl border border-amber-200 text-xs space-y-1.5">
            <div className="flex justify-between text-gray-700">
              <span>ยอดรวมค่าอาหาร:</span>
              <span className="font-medium">{money(selectedBillOrder.food_subtotal ?? 0)} ฿</span>
            </div>
            <div className="flex justify-between text-gray-700">
              <span>ค่าจัดส่ง:</span>
              <span className="font-medium">{money(selectedBillOrder.delivery_fee ?? 0)} ฿</span>
            </div>
            <div className="flex justify-between text-gray-900 font-black pt-1 border-t border-amber-200/80 text-sm">
              <span>ยอดรวมที่รับจากลูกค้า:</span>
              <span className="text-orange-600">{money(selectedBillOrder.total_amount ?? 0)} ฿</span>
            </div>
            <div className="flex justify-between text-gray-500 text-[11px] pt-1 border-t border-dashed border-amber-200/60">
              <span>วิธีชำระเงิน:</span>
              <span className="font-bold text-gray-700">
                {selectedBillOrder.payment_method === 'cash' ? 'เงินสดปลายทาง' : 'สแกน QR ร้านปลายทาง'}
              </span>
            </div>
            {ready && (
              <>
                <div className="flex justify-between text-rose-700 text-[11px]">
                  <span>ค่าบริการระบบหักเครดิต (GP):</span>
                  <span className="font-bold">-{money(summary.charges.get(selectedBillOrder.id) ?? 0)} ฿</span>
                </div>
                <div className="flex justify-between text-emerald-800 font-black pt-1 border-t border-emerald-200 text-xs">
                  <span>ยอดสุทธิของร้านหลังหักค่าบริการ:</span>
                  <span>{money((selectedBillOrder.total_amount ?? 0) - (summary.charges.get(selectedBillOrder.id) ?? 0))} ฿</span>
                </div>
              </>
            )}
          </div>

          {/* Close Button */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setSelectedBillOrder(null)}
              className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        </div>
      </div>
    )}
  </section>;
}
