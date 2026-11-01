const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function setup({ status = 'delivering', uid = 'merchant' } = {}) {
  const documents = new Map(Object.entries({
    'access/merchant': { role: 'merchant', shop_id: 'shop' },
    'orders/order': { status, shop_id: 'shop', food_subtotal: 60, items: [{ menu_id: 'menu', quantity: 2 }, { menu_id: 'menu', quantity: 1 }] },
    'shops/shop': { sales_count: 0, is_open: true },
    'menu_items/menu': { shop_id: 'shop', sales_count: 0 },
  }));
  let id = 0;
  const snapshot = ref => ({ exists: documents.has(ref.path), data: () => documents.get(ref.path) });
  const collection = name => ({
    doc: value => { const ref = { path: `${name}/${value ?? `generated-${++id}`}`, id: value ?? `generated-${id}` }; ref.get = async () => snapshot(ref); ref.collection = child => collection(`${ref.path}/${child}`); return ref; },
    get: async () => ({ docs: [] }),
    where: () => ({ get: async () => ({ docs: [] }), limit: () => ({ get: async () => ({ empty: true, docs: [] }) }) }),
  });
  const db = { collection, runTransaction: async fn => {
    const writes = [];
    const tx = {
      get: async ref => { assert.equal(writes.length, 0, 'Firestore read after write'); return snapshot(ref); },
      update: (ref, data) => writes.push({ ref, data, merge: true }),
      set: (ref, data) => writes.push({ ref, data }),
    };
    await fn(tx);
    for (const { ref, data, merge } of writes) {
      const current = documents.get(ref.path) ?? {};
      const resolved = Object.fromEntries(Object.entries(data).map(([key, val]) => [key, val?.increment !== undefined ? (current[key] ?? 0) + val.increment : val]));
      documents.set(ref.path, merge ? { ...current, ...resolved } : resolved);
    }
  } };
  const firestore = Object.assign(() => db, { FieldValue: { increment: value => ({ increment: value }), serverTimestamp: () => 'timestamp' } });
  const admin = { initializeApp() {}, firestore };
  const region = {
    https: { onCall: fn => fn, onRequest: fn => fn },
    firestore: { document: () => ({ onCreate: fn => fn, onUpdate: fn => fn, onDelete: fn => fn }) },
    runWith: options => {
      assert.equal(options.invoker, 'public', 'Firebase Auth clients must be able to reach the callable');
      return region;
    }
  };
  const functions = { https: { HttpsError: class extends Error { constructor(code, msg) { super(msg); this.code = code; } } }, region: () => region };
  const sandbox = { exports: {}, console, require: name => name === './mock-data' ? { MOCK_SHOPS: [], MOCK_MENUS: [] } : name === './security' || name === './checkout' ? () => ({}) : name === 'firebase-functions' ? functions : admin };
  vm.runInNewContext(fs.readFileSync(`${__dirname}/index.js`, 'utf8'), sandbox);
  return { documents, complete: () => sandbox.exports.completeOrder({ orderId: 'order' }, { auth: uid ? { uid } : null }) };
}

test('completion commits status and counters together, and retries do not double count', async () => {
  const s = setup();
  await s.complete(); await s.complete();
  assert.equal(s.documents.get('orders/order').status, 'completed');
  assert.equal(s.documents.get('shops/shop').is_open, true);
  assert.equal(s.documents.get('shops/shop').sales_count, 1);
  assert.equal(s.documents.get('menu_items/menu').sales_count, 3);
  assert.ok(s.documents.has('_completed_orders/order'));
  assert.equal([...s.documents.keys()].filter(key => key.startsWith('credit_transactions/')).length, 0);
});

test('cancelled orders cannot create sales', async () => {
  const s = setup({ status: 'cancelled' });
  await assert.rejects(s.complete(), { code: 'failed-precondition' });
  assert.equal(s.documents.get('shops/shop').sales_count, 0);
});

test('public callable transport still rejects unauthenticated requests', async () => {
  const s = setup({ uid: null });
  await assert.rejects(s.complete(), { code: 'unauthenticated' });
  assert.equal(s.documents.get('orders/order').status, 'delivering');
  assert.equal(s.documents.get('shops/shop').sales_count, 0);
});

test('another shop merchant cannot complete the order', async () => {
  const s = setup();
  s.documents.set('access/merchant', { role: 'merchant', shop_id: 'other-shop' });
  await assert.rejects(s.complete(), { code: 'permission-denied' });
  assert.equal(s.documents.get('orders/order').status, 'delivering');
  assert.equal(s.documents.get('shops/shop').sales_count, 0);
});
