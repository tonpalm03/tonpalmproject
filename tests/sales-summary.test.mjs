import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dateKey, summarizeSales } from '../src/lib/salesSummary.ts';

test('counts completion date in Bangkok and actual charges, not a fixed percentage', () => {
  const orders = [
    { id: 'paid', status: 'completed', created_at: '2026-09-15T00:00:00Z', completed_at: '2026-09-15T18:00:00Z', food_subtotal: 100, delivery_fee: 0, total_amount: 100 },
    { id: 'free', status: 'completed', completed_at: '2026-09-16T04:00:00Z', food_subtotal: 60, delivery_fee: 15, total_amount: 75, gp_amount: 3 },
    { id: 'cancelled', status: 'cancelled', created_at: '2026-09-16T01:00:00Z', food_subtotal: 999 },
    { id: 'pending', status: 'pending', created_at: '2026-09-16T01:00:00Z', food_subtotal: 999 },
  ];
  const tx = [
    { type: 'gp_deduct', order_id: 'paid', amount: -7, created_at: '2026-09-16T01:00:00Z' },
    { type: 'topup', amount: 200, created_at: '2026-09-16T01:00:00Z' },
    { type: 'deduct', amount: -20, created_at: '2026-09-16T01:00:00Z' },
    { type: 'topup', amount: 500, created_at: '2026-08-01T01:00:00Z' },
  ];
  const result = summarizeSales(orders, tx, '2026-09-16', '2026-09-16');
  assert.equal(result.completed.length, 2);
  assert.equal(result.food, 160);
  assert.equal(result.delivery, 15);
  assert.equal(result.collected, 175);
  assert.equal(result.gp, 7);
  assert.equal(result.net, 168);
  assert.equal(result.serviceRevenue, 7);
  assert.equal(result.topups, 200);
  assert.equal(result.deductions, 20);
  assert.equal(result.cancelled, 1);
});

test('empty periods report zero and timestamps preserve the Thai day', () => {
  assert.equal(dateKey({ seconds: Date.parse('2026-09-15T18:00:00Z') / 1000 }), '2026-09-16');
  assert.equal(dateKey('invalid'), '');
  const summary = summarizeSales([], [], '2026-09-16', '2026-09-16');
  for (const field of ['food', 'delivery', 'collected', 'gp', 'net', 'topups', 'serviceRevenue']) assert.equal(summary[field], 0);
});
