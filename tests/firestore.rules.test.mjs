import { before, after, beforeEach, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails as deny, assertSucceeds as allow } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, getDocs, collection, query, where, serverTimestamp } from 'firebase/firestore';

if (!process.env.FIRESTORE_EMULATOR_HOST?.startsWith('127.0.0.1:')) throw new Error('Local emulator required');
let env;
before(async () => { env = await initializeTestEnvironment({ projectId: 'demo-huaychan-security', firestore: { rules: readFileSync('firestore.rules', 'utf8') } }); });
after(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    for (const [path, data] of Object.entries({
      'access/admin': { role: 'admin' },
      'access/merchantA': { role: 'merchant', shop_id: 'a' },
      'access/merchantB': { role: 'merchant', shop_id: 'b' },
      'users/alice': { uid: 'alice', role: 'customer', display_name: 'Alice' },
      'users/bob': { uid: 'bob', role: 'customer', display_name: 'Bob' },
      'users/forged': { uid: 'forged', role: 'admin', display_name: 'Untrusted legacy role' },
      'shops/a': { name: 'A', owner_uid: 'merchantA', is_open: true },
      'shops/b': { name: 'B', owner_uid: 'merchantB', is_open: true },
      'menu_items/food': { shop_id: 'a', name: 'Rice', price: 50, is_available: true },
      'orders/one': { customer_uid: 'alice', shop_id: 'a', group_id: 'g', status: 'pending', total_amount: 60 },
      'orders/two': { customer_uid: 'bob', shop_id: 'b', status: 'pending' },
      'orders/done': { customer_uid: 'alice', shop_id: 'a', status: 'completed' },
      'orders/one/messages/msg': { sender_uid: 'alice', text: 'Hello', is_read: false },
      'weekly_settlements/settle': { shop_id: 'a', status: 'pending_approval', gp_due: 5 },
      'shop_private/a/devices/merchantA': { tokens: ['secret-token'] },
    })) await setDoc(doc(ctx.firestore(), path), data);
  });
});
const db = uid => uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore();

test('deleted account sessions cannot recreate profiles; fresh registration is allowed after cleanup', async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), '_account_deletions/removed'), { state: 'deleting', revoked_before: 1000 });
  });
  const oldSession = env.authenticatedContext('removed', { auth_time: 999 }).firestore();
  const newSession = env.authenticatedContext('removed', { auth_time: 1001 }).firestore();
  const profile = { uid: 'removed', role: 'customer', display_name: 'Returning user' };
  await deny(setDoc(doc(oldSession, 'users/removed'), profile));
  await deny(setDoc(doc(newSession, 'users/removed'), profile));
  await env.withSecurityRulesDisabled(ctx => updateDoc(doc(ctx.firestore(), '_account_deletions/removed'), { state: 'deleted' }));
  await deny(setDoc(doc(oldSession, 'users/removed'), profile));
  await deny(deleteDoc(doc(newSession, '_account_deletions/removed')));
  await allow(setDoc(doc(newSession, 'users/removed'), profile));
});
test('guest: public catalog only, no private reads or writes', async () => {
  await allow(getDocs(collection(db(), 'shops')));
  await allow(getDoc(doc(db(), 'menu_items/food')));
  for (const p of ['users/alice', 'orders/one', 'orders/one/messages/msg', 'weekly_settlements/settle', 'shop_private/a/devices/merchantA', 'access/admin']) await deny(getDoc(doc(db(), p)));
  await deny(updateDoc(doc(db(), 'shops/a'), { name: 'attack' }));
});
test('customers: own profile/order and constrained query only', async () => {
  await allow(getDoc(doc(db('alice'), 'users/alice')));
  await allow(getDoc(doc(db('alice'), 'orders/one')));
  await deny(getDoc(doc(db('alice'), 'users/bob')));
  await deny(getDoc(doc(db('alice'), 'orders/two')));
  await deny(getDocs(collection(db('alice'), 'orders')));
  await allow(getDocs(query(collection(db('alice'), 'orders'), where('customer_uid', '==', 'alice'), where('group_id', '==', 'g'))));
});
test('merchants: shop isolation, immutable ownership, private devices', async () => {
  await allow(getDocs(query(collection(db('merchantA'), 'orders'), where('shop_id', '==', 'a'))));
  await deny(getDoc(doc(db('merchantA'), 'orders/two')));
  await allow(updateDoc(doc(db('merchantA'), 'shops/a'), { name: 'Updated' }));
  await deny(updateDoc(doc(db('merchantB'), 'shops/a'), { name: 'attack' }));
  await deny(updateDoc(doc(db('merchantA'), 'shops/a'), { owner_uid: 'merchantB' }));
  await deny(getDoc(doc(db('merchantB'), 'shop_private/a/devices/merchantA')));
  await allow(setDoc(doc(db('merchantA'), 'shop_private/a/devices/merchantA'), { tokens: ['new-token'], updated_at: serverTimestamp() }));
});
test('self promotion and legacy profile role do not grant access', async () => {
  await deny(updateDoc(doc(db('alice'), 'users/alice'), { role: 'admin' }));
  await deny(setDoc(doc(db('alice'), 'access/alice'), { role: 'admin' }));
  await deny(getDoc(doc(db('forged'), 'orders/one')));
  await deny(setDoc(doc(db('new'), 'users/new'), { uid: 'new', display_name: 'New', role: 'admin' }));
  await allow(setDoc(doc(db('new'), 'users/new'), { uid: 'new', display_name: 'New', role: 'customer' }));
  await allow(updateDoc(doc(db('alice'), 'users/alice'), { phone: '0123456789' }));
});
test('admin assigns others but cannot remove own authority', async () => {
  await allow(setDoc(doc(db('admin'), 'access/alice'), { role: 'merchant', shop_id: 'a' }));
  await deny(deleteDoc(doc(db('admin'), 'access/admin')));
  await allow(getDocs(collection(db('admin'), 'users')));
});
test('order totals/identity immutable; direct completion denied; state machine enforced', async () => {
  await deny(updateDoc(doc(db('alice'), 'orders/one'), { total_amount: 1 }));
  await deny(updateDoc(doc(db('merchantA'), 'orders/one'), { customer_uid: 'bob' }));
  await deny(updateDoc(doc(db('merchantA'), 'orders/one'), { status: 'completed', completed_at: serverTimestamp() }));
  await allow(updateDoc(doc(db('merchantA'), 'orders/one'), { status: 'cooking' }));
  await allow(updateDoc(doc(db('merchantA'), 'orders/one'), { status: 'delivering' }));
  await deny(updateDoc(doc(db('merchantA'), 'orders/one'), { status: 'completed', completed_at: serverTimestamp() }));
  await deny(updateDoc(doc(db('merchantA'), 'orders/one'), { status: 'cooking' }));
});
test('chat: forged role, sender and unrelated participant rejected', async () => {
  const data = { order_id: 'one', sender_uid: 'alice', sender_name: 'Alice', sender_role: 'customer', text: 'Hi', is_read: false, created_at: serverTimestamp() };
  await allow(setDoc(doc(db('alice'), 'orders/one/messages/new'), data));
  await deny(setDoc(doc(db('alice'), 'orders/one/messages/fake'), { ...data, sender_role: 'admin' }));
  await deny(setDoc(doc(db('bob'), 'orders/one/messages/fake'), { ...data, sender_uid: 'bob' }));
});
test('settlement: merchant may resubmit but cannot approve or alter totals', async () => {
  await allow(updateDoc(doc(db('merchantA'), 'weekly_settlements/settle'), { slip_url: 'image', status: 'pending_approval', updated_at: serverTimestamp() }));
  await deny(updateDoc(doc(db('merchantA'), 'weekly_settlements/settle'), { status: 'paid' }));
  await deny(updateDoc(doc(db('merchantA'), 'weekly_settlements/settle'), { gp_due: 0 }));
});
test('review: completed owner only, unique order ID, aggregate protected', async () => {
  const review = { order_id: 'done', shop_id: 'a', customer_uid: 'alice', rating: 5, comment: 'Good', created_at: serverTimestamp() };
  await deny(setDoc(doc(db('bob'), 'shop_reviews/done'), { ...review, customer_uid: 'bob' }));
  await allow(setDoc(doc(db('alice'), 'shop_reviews/done'), review));
  await deny(setDoc(doc(db('alice'), 'shop_reviews/done'), review));
  await deny(updateDoc(doc(db('alice'), 'shops/a'), { rating: 5 }));
});
test('unknown collection defaults to deny', async () => { await deny(setDoc(doc(db('alice'), 'anything/new'), { public: true })); });
test('direct client order creation is denied; customer can cancel own pending order', async () => {
  const order = { customer_uid: 'alice', shop_id: 'a', status: 'pending', items: [{ menu_id: 'food', quantity: 1 }], food_subtotal: 50, delivery_fee: 10, total_amount: 60, gp_amount: 2.5, payment_method: 'cash', created_at: serverTimestamp() };
  await deny(setDoc(doc(db('alice'), 'orders/new'), order));
  await allow(updateDoc(doc(db('alice'), 'orders/one'), { status: 'cancelled', cancelled_by: 'customer', cancelled_at: serverTimestamp() }));
});
test('menu ownership, price checks, role revocation and counter are protected', async () => {
  await deny(updateDoc(doc(db('merchantB'), 'menu_items/food'), { price: 1 }));
  await deny(updateDoc(doc(db('merchantA'), 'menu_items/food'), { shop_id: 'b' }));
  await deny(updateDoc(doc(db('merchantA'), 'menu_items/food'), { price: -1 }));
  await allow(updateDoc(doc(db('merchantA'), 'menu_items/food'), { price: 55, option_groups: [{ title: 'เส้น', required: true, type: 'single', options: [{ name: 'เล็ก', price: 0 }] }] }));
  await allow(setDoc(doc(db('merchantA'), 'menu_items/new_food'), { shop_id: 'a', name: 'Noodles', price: 60, category: 'food', is_available: true, options: [], option_groups: [{ title: 'เส้น', required: true, type: 'single', options: [{ name: 'เล็ก', price: 0 }] }], created_at: serverTimestamp() }));
  await deny(setDoc(doc(db('merchantB'), 'menu_items/new_food2'), { shop_id: 'a', name: 'Noodles', price: 60, category: 'food', is_available: true, options: [], option_groups: [], created_at: serverTimestamp() }));
  await deny(setDoc(doc(db('alice'), 'system_settings/order_counter'), { last_order_number: 0 }));
  await allow(setDoc(doc(db('admin'), 'access/merchantA'), { role: 'customer' }));
  await deny(getDoc(doc(db('merchantA'), 'orders/one')));
});
