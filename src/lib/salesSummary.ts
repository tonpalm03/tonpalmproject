import type { Order } from '../types';

export function dateKey(value: unknown): string {
  if (!value) return '';
  const raw = value as { seconds?: number };
  const date = typeof raw.seconds === 'number' ? new Date(raw.seconds * 1000) : new Date(value as string | Date);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function summarizeSales(orders: Order[], start: string, end: string) {
  const inRange = (key: string) => !!key && (!start || key >= start) && (!end || key <= end);
  const completed = orders.filter(o => o.status === 'completed' && inRange(dateKey(o.completed_at ?? o.created_at)));
  const sum = (values: number[]) => Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100;
  const food = sum(completed.map(o => o.food_subtotal ?? 0));
  const delivery = sum(completed.map(o => o.delivery_fee ?? 0));
  const collected = sum(completed.map(o => o.total_amount ?? ((o.food_subtotal ?? 0) + (o.delivery_fee ?? 0))));
  return {
    completed, food, delivery, collected,
    cancelled: orders.filter(o => o.status === 'cancelled' && inRange(dateKey(o.created_at))).length,
  };
}
