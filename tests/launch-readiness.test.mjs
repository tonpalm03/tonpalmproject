// Release gates: these must pass before opening to the public.
// Run only against the local emulator; never submit audit orders to production.
import { before, after, beforeEach, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

if (!process.env.FIRESTORE_EMULATOR_HOST?.startsWith('127.0.0.1:')) throw Error('Local emulator required');
let env;
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-huaychan-security', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
after(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    for (const [path, value] of Object.entries({
      'access/merchant': { role: 'merchant', shop_id: 'audit-shop' },
      'shops/audit-shop': { name: 'Audit only', is_open: true, credit_balance: 100 },
      'system_settings/general': { gp_enabled: true, gp_percent: 5, delivery_fee: 10 },
      'menu_items/audit-menu': { shop_id: 'audit-shop', name: 'Rice', price: 50, is_available: true },
      'orders/delivering': { customer_uid: 'customer', shop_id: 'audit-shop', status: 'delivering', food_subtotal: 50, gp_amount: 2.5 },
    })) await setDoc(doc(ctx.firestore(), path), value);
  });
});
const customerDb = () => env.authenticatedContext('customer').firestore();
const order = () => ({
  customer_uid: 'customer', shop_id: 'audit-shop', status: 'pending',
  group_id: 'same-checkout-request', order_number: 1001,
  items: [{ menu_id: 'audit-menu', quantity: 1 }],
  food_subtotal: 50, delivery_fee: 10, total_amount: 60, gp_amount: 2.5,
  payment_method: 'cash', created_at: serverTimestamp(),
});

test('release gate: client cannot submit a forged price and GP', async () => {
  await assertFails(setDoc(doc(customerDb(), 'orders/forged-price'), {
    ...order(), food_subtotal: 1, delivery_fee: 0, total_amount: 1, gp_amount: 0.01,
  }));
});

test('release gate: merchant cannot bypass the completion/GP callable', async () => {
  const merchantDb = env.authenticatedContext('merchant').firestore();
  await assertFails(updateDoc(doc(merchantDb, 'orders/delivering'), {
    status: 'completed', completed_at: serverTimestamp(),
  }));
});

test('release gate: replaying the same checkout cannot create a second order', async () => {
  const db = customerDb();
  await assertFails(setDoc(doc(db, 'orders/first-attempt'), order()));
  await assertFails(setDoc(doc(db, 'orders/retried-attempt'), order()));
});
