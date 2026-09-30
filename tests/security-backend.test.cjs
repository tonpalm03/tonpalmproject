const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const admin = require('../functions/node_modules/firebase-admin');
const { HttpsError } = require('../functions/node_modules/firebase-functions').https;
if (!process.env.FIRESTORE_EMULATOR_HOST?.startsWith('127.0.0.1:')) throw Error('Local emulator required');
admin.initializeApp({ projectId: 'demo-huaychan-security' });
const db = admin.firestore();
const functions = { https: { HttpsError }, region: () => ({ runWith: () => ({ https: { onCall: f => f } }), https: { onCall: f => f }, firestore: { document: () => ({ onUpdate: f => f, onWrite: f => f }) } }) };
const handlers = require('../functions/security')(functions, admin);
after(() => admin.app().delete());

test('account deletion enforces authority, deletes Auth and profile, and is retryable', async () => {
  await db.doc('access/deletion-admin').set({ role: 'admin' });
  await admin.auth().createUser({ uid: 'deletion-target', email: 'delete@example.test' });
  await db.doc('users/deletion-target').set({ display_name: 'Test' });
  await db.doc('access/deletion-target').set({ role: 'merchant', shop_id: 'deletion-shop' });
  await db.doc('shop_private/deletion-shop/devices/deletion-target').set({ tokens: ['token'] });
  await db.doc('orders/deletion-history').set({ customer_uid: 'deletion-target', status: 'completed' });
  const call = handlers.deleteUserAccount;
  await assert.rejects(call({ uid: 'deletion-target' }, {}), { code: 'unauthenticated' });
  await assert.rejects(call({ uid: 'deletion-target' }, { auth: { uid: 'outsider' } }), { code: 'permission-denied' });
  await assert.rejects(call({ uid: 'deletion-admin' }, { auth: { uid: 'deletion-admin' } }), { code: 'failed-precondition' });
  assert.equal((await admin.auth().getUser('deletion-target')).disabled, false);
  const context = { auth: { uid: 'deletion-admin' } };
  assert.equal((await call({ uid: 'deletion-target' }, context)).success, true);
  await assert.rejects(admin.auth().getUser('deletion-target'), { code: 'auth/user-not-found' });
  for (const path of ['users/deletion-target', 'access/deletion-target', 'shop_private/deletion-shop/devices/deletion-target']) {
    assert.equal((await db.doc(path).get()).exists, false);
  }
  assert.equal((await db.doc('orders/deletion-history').get()).exists, true);
  assert.equal((await call({ uid: 'deletion-target' }, context)).success, true);
  assert.equal((await db.doc('_account_deletions/deletion-target').get()).data().state, 'deleted');
});

test('deletion finishes orphaned profiles and resumes interrupted cleanup', async () => {
  const context = { auth: { uid: 'cleanup-admin' } };
  await db.doc('access/cleanup-admin').set({ role: 'admin' });
  await db.doc('users/orphan').set({ display_name: 'Orphan' });
  await db.doc('_account_deletions/orphan').set({ state: 'deleting', revoked_before: 123, shop_id: 'old-shop' });
  await db.doc('shop_private/old-shop/devices/orphan').set({ tokens: ['old-token'] });
  await handlers.deleteUserAccount({ uid: 'orphan' }, context);
  assert.equal((await db.doc('users/orphan').get()).exists, false);
  assert.equal((await db.doc('shop_private/old-shop/devices/orphan').get()).exists, false);
  assert.equal((await db.doc('_account_deletions/orphan').get()).data().revoked_before, 123);
});

test('Auth failure does not report success or erase the profile; a retry completes cleanup', async () => {
  await db.doc('access/failure-admin').set({ role: 'admin' });
  await db.doc('users/failure-target').set({ display_name: 'Retry me' });
  await admin.auth().createUser({ uid: 'failure-target' });
  const failing = require('../functions/delete-account')({
    firestore: () => db,
    auth: () => ({ updateUser: async () => { throw Object.assign(new Error('Auth unavailable'), { code: 'auth/internal-error' }); } }),
  }, functions);
  const context = { auth: { uid: 'failure-admin' } };
  await assert.rejects(failing({ uid: 'failure-target' }, context), { code: 'auth/internal-error' });
  assert.equal((await db.doc('users/failure-target').get()).exists, true);
  assert.equal((await db.doc('_account_deletions/failure-target').get()).data().state, 'deleting');
  await handlers.deleteUserAccount({ uid: 'failure-target' }, context);
  assert.equal((await db.doc('users/failure-target').get()).exists, false);
  await assert.rejects(admin.auth().getUser('failure-target'), { code: 'auth/user-not-found' });
});
test('counter rejects unauthenticated/invalid calls and reserves unique numbers concurrently', async () => {
  await assert.rejects(handlers.reserveOrderNumbers({ count: 1 }, {}), { code: 'unauthenticated' });
  await assert.rejects(handlers.reserveOrderNumbers({ count: 100 }, { auth: { uid: 'a' } }), { code: 'invalid-argument' });
  await db.doc('system_settings/order_counter').set({ last_order_number: 1000 });
  const results = await Promise.all(Array.from({ length: 5 }, () => handlers.reserveOrderNumbers({ count: 2 }, { auth: { uid: 'a' } })));
  assert.equal(new Set(results.flatMap(r => r.numbers)).size, 10);
  assert.equal((await db.doc('system_settings/order_counter').get()).data().last_order_number, 1010);
});
test('completion aggregates process duplicate trigger deliveries exactly once', async () => {
  await db.doc('shops/aggregate').set({ sales_count: 0 });
  await db.doc('menu_items/aggregate').set({ shop_id: 'aggregate', sales_count: 0 });
  await db.doc('_completed_orders/aggregate').delete();
  const change = { before: { data: () => ({ status: 'delivering' }) }, after: { data: () => ({ status: 'completed', shop_id: 'aggregate', items: [{ menu_id: 'aggregate', quantity: 2 }] }) } };
  await Promise.all(Array.from({ length: 3 }, () => handlers.onOrderCompleted(change, { params: { orderId: 'aggregate' } })));
  assert.equal((await db.doc('shops/aggregate').get()).data().sales_count, 1);
  assert.equal((await db.doc('menu_items/aggregate').get()).data().sales_count, 2);
});
test('review aggregate reflects current documents and repeat/delete deliveries', async () => {
  await db.doc('shops/review-aggregate').set({});
  await db.doc('shop_reviews/agg-1').set({ shop_id: 'review-aggregate', rating: 5 });
  await db.doc('shop_reviews/agg-2').set({ shop_id: 'review-aggregate', rating: 3 });
  const snapshot = { exists: true, data: () => ({ shop_id: 'review-aggregate' }) };
  await handlers.onReviewChanged({ before: snapshot, after: snapshot });
  await handlers.onReviewChanged({ before: snapshot, after: snapshot });
  assert.deepEqual((await db.doc('shops/review-aggregate').get()).data(), { rating: 4, review_count: 2 });
  await db.doc('shop_reviews/agg-2').delete();
  await handlers.onReviewChanged({ before: snapshot, after: { exists: false } });
  assert.deepEqual((await db.doc('shops/review-aggregate').get()).data(), { rating: 5, review_count: 1 });
});
test('verified LINE subject signs into Auth emulator; submitted role/uid cannot elevate', async () => {
  const { initializeApp, deleteApp } = require('firebase/app');
  const { getAuth, connectAuthEmulator, signInWithCustomToken } = require('firebase/auth');
  if (!process.env.FIREBASE_AUTH_EMULATOR_HOST?.startsWith('127.0.0.1:')) throw Error('Auth emulator required');
  const uid = 'U' + 'b'.repeat(32);
  process.env.LINE_LOGIN_CHANNEL_ID = '12345';
  const originalFetch = global.fetch;
  let issuedAt = Math.floor(Date.now() / 1000);
  global.fetch = async (url, options) => String(url) === 'https://api.line.me/oauth2/v2.1/verify'
    ? { ok: true, json: async () => ({ iss: 'https://access.line.me', aud: '12345', sub: uid, iat: issuedAt, exp: Date.now() / 1000 + 60, name: 'Verified LINE' }) }
    : originalFetch(url, options);
  const app = initializeApp({ apiKey: 'demo-key', projectId: 'demo-huaychan-security' }, 'line-security-test');
  try {
    const { token } = await handlers.signInWithLine({ idToken: 'token'.repeat(10), uid: 'admin', role: 'admin' });
    const auth = getAuth(app);
    connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
    const signedIn = await signInWithCustomToken(auth, token);
    assert.equal(signedIn.user.uid, uid);
    assert.equal((await db.doc(`users/${uid}`).get()).data().role, 'customer');
    assert.equal((await db.doc(`access/${uid}`).get()).exists, false);
    await db.doc('access/line-delete-admin').set({ role: 'admin' });
    await handlers.deleteUserAccount({ uid }, { auth: { uid: 'line-delete-admin' } });
    await assert.rejects(handlers.signInWithLine({ idToken: 'token'.repeat(10) }), { code: 'unauthenticated' });
    assert.equal((await db.doc(`users/${uid}`).get()).exists, false);
    issuedAt = (await db.doc(`_account_deletions/${uid}`).get()).data().revoked_before + 1;
    const fresh = await handlers.signInWithLine({ idToken: 'fresh-token'.repeat(10) });
    await signInWithCustomToken(auth, fresh.token);
    assert.equal((await db.doc(`users/${uid}`).get()).data().role, 'customer');
    assert.equal((await db.doc(`access/${uid}`).get()).exists, false);
    await admin.auth().updateUser(uid, { disabled: true });
    await assert.rejects(handlers.signInWithLine({ idToken: 'token'.repeat(10) }), { code: 'permission-denied' });
  } finally { global.fetch = originalFetch; delete process.env.LINE_LOGIN_CHANNEL_ID; await deleteApp(app); }
});
