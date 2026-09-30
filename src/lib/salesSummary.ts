import type { Order, CreditTransaction } from '../types';

export function dateKey(value: unknown): string {
  if (!value) return '';
  const raw = value as { seconds?: number };
  const date = typeof raw.seconds === 'number' ? new Date(raw.seconds * 1000) : new Date(value as string | Date);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function chargedByOrder(transactions: CreditTransaction[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.type === 'gp_deduct' && tx.order_id && tx.amount < 0) {
      result.set(tx.order_id, Math.round(((result.get(tx.order_id) ?? 0) - tx.amount) * 100) / 100);
    }
  }
  return result;
}

export function summarizeSales(orders: Order[], transactions: CreditTransaction[], start: string, end: string) {
  const inRange = (key: string) => !!key && (!start || key >= start) && (!end || key <= end);
  const completed = orders.filter(o => o.status === 'completed' && inRange(dateKey(o.completed_at ?? o.created_at)));
  const ledger = transactions.filter(tx => inRange(dateKey(tx.created_at)));
  const charges = chargedByOrder(transactions);
  const sum = (values: number[]) => Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100;
  const food = sum(completed.map(o => o.food_subtotal ?? 0));
  const delivery = sum(completed.map(o => o.delivery_fee ?? 0));
  const collected = sum(completed.map(o => o.total_amount ?? ((o.food_subtotal ?? 0) + (o.delivery_fee ?? 0))));
  const gp = sum(completed.map(o => charges.get(o.id) ?? 0));
  return {
    completed, ledger, charges, food, delivery, collected, gp, net: sum([collected, -gp]),
    cancelled: orders.filter(o => o.status === 'cancelled' && inRange(dateKey(o.created_at))).length,
    topups: sum(ledger.filter(tx => tx.type === 'topup').map(tx => tx.amount)),
    deductions: sum(ledger.filter(tx => tx.type === 'deduct').map(tx => -tx.amount)),
    serviceRevenue: sum(ledger.filter(tx => tx.type === 'gp_deduct').map(tx => -tx.amount)),
  };
}
