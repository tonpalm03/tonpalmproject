import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderItemUnitPrice } from '../src/lib/orderItemPrice.ts';

test('server orders display the charged price including options and quantity', () => {
  const item = { price: 60, unit_price: 50, quantity: 2 };
  assert.equal(orderItemUnitPrice(item) * item.quantity, 120);
});

test('legacy cart orders retain their inclusive unit price without double counting', () => {
  assert.equal(orderItemUnitPrice({ price: 50, unit_price: 60 }), 60);
});

test('orders without options, without unit_price, and free items retain their prices', () => {
  assert.equal(orderItemUnitPrice({ price: 50, unit_price: 50 }), 50);
  assert.equal(orderItemUnitPrice({ price: 50 }), 50);
  assert.equal(orderItemUnitPrice({ price: 0, unit_price: 0 }), 0);
});
