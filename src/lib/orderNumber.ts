import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

export async function getNextOrderNumbers(count: number = 1): Promise<number[]> {
  const reserve = httpsCallable<{ count: number }, { numbers: number[] }>(functions, 'reserveOrderNumbers');
  const result = await reserve({ count });
  return result.data.numbers;
}

/**
 * Format order code for display: prefers 4-digit code (e.g. 1001), falls back to clean hash
 */
export function formatOrderCode(order?: { order_code?: string; order_number?: number; id?: string } | null): string {
  if (!order) return '';
  if (order.order_code) return order.order_code;
  if (typeof order.order_number === 'number') return String(order.order_number);
  if (order.id) {
    return order.id.slice(0, 6).toUpperCase();
  }
  return '';
}
