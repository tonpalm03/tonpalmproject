const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function setup(pending = 0, tokenCount = 1) {
  const messages = [], reads = [];
  const functions = { region: () => ({
    runWith: () => ({ https: { onCall: fn => fn } }),
    firestore: { document: () => ({ onWrite: fn => fn, onCreate: fn => fn }) },
    https: { onRequest: fn => fn },
  }) };
  const admin = {
    initializeApp() {},
    firestore: () => ({ collection: name => ({
      doc: shop => ({
        get: async () => ({ exists: true, data: () => name === 'access' ? { role: 'merchant', shop_id: shop } : {} }),
        collection: () => ({ get: async () => ({ docs: [{ id: shop, data: () => ({ tokens: Array.from({ length: tokenCount }, (_, i) => `device-token-${i}`) }) }] }) }),
      }),
      where: (field, op, shop) => ({ get: async () => {
        reads.push(shop);
        return { docs: [...Array.from({ length: pending }, () => ({ data: () => ({ status: 'pending' }) })), { data: () => ({ status: 'completed' }) }], readTime: { toMillis: () => 123456.789 } };
      } }),
    }) }),
    messaging: () => ({ sendEachForMulticast: async message => messages.push(message) }),
  };
  const sandbox = { exports: {}, console, require: name => name === './security' || name === './checkout' ? () => ({}) : name === 'firebase-functions' ? functions : admin };
  vm.runInNewContext(fs.readFileSync(`${__dirname}/index.js`, 'utf8'), sandbox);
  const snap = value => ({ exists: !!value, data: () => value });
  return { messages, reads, run: (before, after) => sandbox.exports.onOrderBadgeChanged({ before: snap(before), after: snap(after) }) };
}

test('new order sends absolute pending count and version without duplicating order notifications', async () => {
  const s = setup(3); await s.run(null, { shop_id: 'a', status: 'pending' });
  assert.equal(s.messages.length, 1);
  assert.equal(s.messages[0].data.count, '3');
  assert.equal(s.messages[0].data.version, '123456');
  assert.equal(s.messages[0].data.type, 'ORDER_BADGE');
  assert.equal(s.messages[0].notification, undefined);
});
test('acceptance, cancellation and deletion send zero to clear the badge', async () => {
  for (const after of [{ shop_id: 'a', status: 'accepted' }, { shop_id: 'a', status: 'cancelled' }, null]) {
    const s = setup(); await s.run({ shop_id: 'a', status: 'pending' }, after);
    assert.equal(s.messages[0].data.count, '0');
  }
});
test('unrelated edits do not read orders or send messages', async () => {
  const s = setup(); await s.run({ shop_id: 'a', status: 'pending' }, { shop_id: 'a', status: 'pending', note: 'changed' });
  assert.equal(s.reads.length, 0); assert.equal(s.messages.length, 0);
});
test('moving an order refreshes both shops', async () => {
  const s = setup(); await s.run({ shop_id: 'a', status: 'pending' }, { shop_id: 'b', status: 'pending' });
  assert.deepEqual(s.reads, ['a', 'b']);
});
test('FCM batches remain below the 500-token limit', async () => {
  const s = setup(1, 501); await s.run(null, { shop_id: 'a', status: 'pending' });
  assert.deepEqual(s.messages.map(m => m.tokens.length), [500, 1]);
});
