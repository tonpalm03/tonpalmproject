const { test } = require('node:test');
const assert = require('node:assert/strict');
const createCheckoutHandler = require('./checkout');

function setup({ gpEnabled = true, gpPercent = 5, deliveryFee = 10, isShopOpen = true, creditBalance = 50, menuPrice = 50, menuAvailable = true, initialCounter = 1000, uid = 'cust_123', retryOnce = false, beforeTransaction = () => {}, onRetry = () => {} } = {}) {
  const documents = new Map(Object.entries({
    'access/cust_123': { role: 'customer' },
    'system_settings/general': { gp_enabled: gpEnabled, gp_percent: gpPercent, delivery_fee: deliveryFee },
    'system_settings/order_counter': { last_order_number: initialCounter },
    'shops/shop_1': { name: 'Shop 1', is_open: isShopOpen, credit_balance: creditBalance, phone: '0812345678', delivery_fee: deliveryFee },
    'menu_items/menu_1': { shop_id: 'shop_1', name: 'Pad Thai', price: menuPrice, is_available: menuAvailable, options: [{ name: 'Extra Egg', price: 10 }] },
  }));

  let idGen = 0;
  const snapshot = ref => ({ id: ref.id, exists: documents.has(ref.path), data: () => documents.get(ref.path) });
  const collection = name => ({
    doc: value => {
      const docId = value ?? `gen_${++idGen}`;
      const ref = { path: `${name}/${docId}`, id: docId };
      ref.get = async () => snapshot(ref);
      ref.collection = child => collection(`${ref.path}/${child}`);
      return ref;
    },
  });

  const db = {
    collection,
    runTransaction: async fn => {
      beforeTransaction(documents);
      const writes = [];
      const tx = {
        get: async ref => {
          assert.equal(writes.length, 0, 'Firestore read after write error');
          return snapshot(ref);
        },
        update: (ref, data) => writes.push({ ref, data, merge: true }),
        set: (ref, data, opts) => writes.push({ ref, data, merge: opts?.merge }),
      };
      let result = await fn(tx);
      if (retryOnce) {
        // Discard the aborted attempt, as Firestore does on contention.
        writes.length = 0;
        onRetry(documents);
        result = await fn(tx);
      }
      for (const { ref, data, merge } of writes) {
        const current = documents.get(ref.path) ?? {};
        documents.set(ref.path, merge ? { ...current, ...data } : data);
      }
      return result;
    },
  };

  const firestore = Object.assign(() => db, { FieldValue: { serverTimestamp: () => 'timestamp' } });
  const admin = { firestore };
  const functions = { https: { HttpsError: class extends Error { constructor(code, msg) { super(msg); this.code = code; } } } };
  const notifications = [];
  const handler = createCheckoutHandler(admin, functions, { sendShopBadge: async shopId => { notifications.push(shopId); } });

  const validOrderPayload = (idempKey = 'key_1') => ({
    idempotency_key: idempKey,
    group_id: 'bundle_1',
    customer_name: 'Somchai',
    customer_phone: '0899999999',
    delivery_address: '123 Huaychan',
    payment_method: 'cash',
    orders: [
      {
        shop_id: 'shop_1',
        items: [
          { menu_id: 'menu_1', quantity: 2, selected_options: [{ name: 'Extra Egg', price: 999 /* forged client option price should be ignored/validated */ }] }
        ]
      }
    ]
  });

  return {
    documents,
    notifications,
    checkout: (payload, userUid = uid) => handler(payload, { auth: userUid ? { uid: userUid } : null }),
    validOrderPayload,
  };
}

test('checkoutOrder rejects unauthenticated requests', async () => {
  const s = setup({ uid: null });
  await assert.rejects(s.checkout(s.validOrderPayload()), { code: 'unauthenticated' });
});

test('unknown options cannot lower the price and rejected checkout writes nothing', async () => {
  const s = setup();
  const payload = s.validOrderPayload();
  payload.orders[0].items[0].selected_options = [{ name: 'Forged discount', price: -49 }];
  const before = structuredClone(s.documents);
  await assert.rejects(s.checkout(payload), { code: 'invalid-argument' });
  assert.deepEqual(s.documents, before);
  assert.deepEqual(s.notifications, []);
});

test('known options ignore negative client prices and preserve free options', async () => {
  const s = setup();
  s.documents.get('menu_items/menu_1').options.push({ name: 'No spice', price: 0 });
  const payload = s.validOrderPayload();
  payload.orders[0].items[0].selected_options = [{ name: 'Extra Egg', price: -1000 }, { name: 'No spice', price: 999 }];
  const result = await s.checkout(payload);
  assert.equal(result.orders[0].food_subtotal, 120);
  assert.deepEqual(result.orders[0].items[0].selected_options, [{ name: 'Extra Egg', price: 10 }, { name: 'No spice', price: 0 }]);
});

test('invalid stored option prices never fall back to client prices', async () => {
  for (const price of [undefined, '10', -10, NaN, Infinity]) {
    const s = setup();
    s.documents.get('menu_items/menu_1').options[0].price = price;
    await assert.rejects(s.checkout(s.validOrderPayload()), { code: 'failed-precondition' });
    assert.equal(s.documents.has('_checkout_requests/key_1'), false);
  }
});

test('malformed selected options are rejected', async () => {
  for (const options of [{ name: 'Extra Egg' }, [null], [{}]]) {
    const s = setup();
    const payload = s.validOrderPayload();
    payload.orders[0].items[0].selected_options = options;
    await assert.rejects(s.checkout(payload), { code: 'invalid-argument' });
  }
});

test('transaction retries return only committed orders and notify once', async () => {
  const s = setup({ retryOnce: true });
  const result = await s.checkout(s.validOrderPayload());
  const committedIds = [...s.documents.keys()].filter(key => key.startsWith('orders/')).map(key => key.split('/')[1]);
  assert.equal(committedIds.length, 1);
  assert.deepEqual(result.orderIds, committedIds);
  assert.deepEqual(result.orders.map(order => order.id), committedIds);
  assert.deepEqual(s.documents.get('_checkout_requests/key_1').order_ids, committedIds);
  assert.equal(s.documents.get('system_settings/order_counter').last_order_number, 1001);
  assert.deepEqual(s.notifications, ['shop_1']);
});

function commitCompetingCheckout(documents, uid = 'cust_123') {
  documents.set('orders/winner', { customer_uid: uid, shop_id: 'shop_1', order_number: 1001 });
  documents.set('_checkout_requests/key_1', { customer_uid: uid, order_ids: ['winner'], group_id: 'winning_group' });
  documents.set('system_settings/order_counter', { last_order_number: 1001 });
}

test('same-key concurrent checkout returns the winning order, including after retry', async () => {
  for (const retryOnce of [false, true]) {
    const s = setup({ retryOnce, [retryOnce ? 'onRetry' : 'beforeTransaction']: commitCompetingCheckout });
    const result = await s.checkout(s.validOrderPayload());
    assert.equal(result.alreadyProcessed, true);
    assert.deepEqual(result.orderIds, ['winner']);
    assert.deepEqual(result.orders, [{ id: 'winner', ...s.documents.get('orders/winner') }]);
    assert.equal(result.groupId, 'winning_group');
    assert.equal(s.documents.get('system_settings/order_counter').last_order_number, 1001);
    assert.deepEqual(s.notifications, []);
  }
});

test('a competing checkout key owned by another user is rejected', async () => {
  for (const retryOnce of [false, true]) {
    const s = setup({ retryOnce, [retryOnce ? 'onRetry' : 'beforeTransaction']: documents => commitCompetingCheckout(documents, 'other_customer') });
    await assert.rejects(s.checkout(s.validOrderPayload()), { code: 'permission-denied' });
    assert.deepEqual(s.notifications, []);
  }
});

test('multi-shop checkout preserves totals, payment details and sequential numbers on retry', async () => {
  for (const paymentMethod of ['cash', 'scan_merchant']) {
    const s = setup({ retryOnce: true, gpEnabled: false, deliveryFee: 10 });
    s.documents.set('shops/shop_2', { name: 'Shop 2', is_open: true, delivery_fee: 10 });
    s.documents.set('menu_items/menu_2', { name: 'Tea', shop_id: 'shop_2', price: 20, is_available: true });
    const payload = s.validOrderPayload();
    payload.payment_method = paymentMethod;
    payload.cash_change_note = 'Change for 500';
    payload.orders.push({ shop_id: 'shop_2', items: [{ menu_id: 'menu_2', quantity: 1 }] });
    const result = await s.checkout(payload);
    assert.equal(result.orders.length, 2);
    assert.deepEqual(result.orders.map(o => o.total_amount), [130, 30]);
    assert.deepEqual(result.orders.map(o => o.order_number), [1001, 1002]);
    assert.deepEqual(result.orders.map(o => o.gp_amount), [0, 0]);
    for (const order of result.orders) {
      assert.equal(order.payment_method, paymentMethod);
      assert.equal(order.cash_change_note, paymentMethod === 'cash' ? 'Change for 500' : null);
      const { id, ...storedOrder } = order;
      assert.deepEqual(s.documents.get(`orders/${id}`), storedOrder);
    }
    assert.deepEqual(s.notifications, ['shop_1', 'shop_2']);
  }
});

test('checkoutOrder calculates authoritative price & GP from database', async () => {
  const s = setup({ menuPrice: 50, gpEnabled: true, gpPercent: 5, deliveryFee: 10 });
  // Menu = 50 + 10 (extra egg from db options) = 60 * 2 = 120 food subtotal
  // Delivery = 10, Total = 130
  // GP = 120 * 5% = 6.00
  const res = await s.checkout(s.validOrderPayload('key_price_test'));
  assert.equal(res.success, true);
  assert.equal(res.orders.length, 1);
  const created = res.orders[0];
  assert.equal(created.food_subtotal, 120);
  assert.equal(created.delivery_fee, 10);
  assert.equal(created.total_amount, 130);
  assert.equal(created.gp_amount, 6);
  assert.equal(created.order_number, 1001);
  assert.equal(s.documents.get('system_settings/order_counter').last_order_number, 1001);
});

test('checkoutOrder rejects order when shop is closed', async () => {
  const s = setup({ isShopOpen: false });
  await assert.rejects(s.checkout(s.validOrderPayload()), { code: 'failed-precondition' });
});

test('checkoutOrder rejects order when menu is unavailable', async () => {
  const s = setup({ menuAvailable: false });
  await assert.rejects(s.checkout(s.validOrderPayload()), { code: 'failed-precondition' });
});

test('checkoutOrder rejects order when GP enabled and shop has 0 credit', async () => {
  const s = setup({ gpEnabled: true, creditBalance: 0 });
  await assert.rejects(s.checkout(s.validOrderPayload()), { code: 'failed-precondition' });
});

test('checkoutOrder is idempotent: same key returns previous order without re-incrementing counter', async () => {
  const s = setup({ initialCounter: 1000 });
  const payload = s.validOrderPayload('idemp_replay_key');
  const first = await s.checkout(payload);
  assert.equal(first.success, true);
  assert.equal(first.orders[0].order_number, 1001);
  assert.equal(s.documents.get('system_settings/order_counter').last_order_number, 1001);

  // Replay with identical key
  const second = await s.checkout(payload);
  assert.equal(second.success, true);
  assert.equal(second.alreadyProcessed, true);
  assert.equal(second.orderIds[0], first.orderIds[0]);
  assert.equal(s.documents.get('system_settings/order_counter').last_order_number, 1001);
});

test('checkoutOrder correctly processes items with no selected options (no undefined)', async () => {
  const s = setup();
  const payload = {
    idempotency_key: 'no_options_key',
    customer_name: 'Somchai',
    customer_phone: '0899999999',
    delivery_address: '123 Huaychan',
    payment_method: 'cash',
    orders: [
      {
        shop_id: 'shop_1',
        items: [
          { menu_id: 'menu_1', quantity: 1, selected_options: [] }
        ]
      }
    ]
  };
  const res = await s.checkout(payload);
  assert.equal(res.success, true);
  assert.deepEqual(res.orders[0].items[0].selected_options, []);
  assert.equal(res.orders[0].items[0].price, 50);
});

test('checkoutOrder auto-creates payment message when shop has payment info', async () => {
  const s = setup();
  const shop = s.documents.get('shops/shop_1');
  shop.bank_name = 'กสิกรไทย';
  shop.bank_account_number = '123-4-56789-0';
  shop.bank_account_name = 'นายสมชาย ใจดี';
  shop.promptpay_number = '0812345678';
  shop.promptpay_qr_url = 'https://example.com/qr.png';

  const res = await s.checkout(s.validOrderPayload('auto_qr_key'));
  assert.equal(res.success, true);
  const orderId = res.orderIds[0];
  const order = res.orders[0];

  assert.equal(order.last_message, '💳 ข้อมูลชำระเงินและ QR Code');
  assert.equal(order.last_message_sender, 'merchant');
  assert.equal(order.has_customer_unread_message, true);

  // Check that message document was created in subcollection
  const messageKey = [...s.documents.keys()].find(k => k.startsWith(`orders/${orderId}/messages/`));
  assert.ok(messageKey, 'Initial payment message should exist');
  const message = s.documents.get(messageKey);
  assert.equal(message.order_id, orderId);
  assert.equal(message.sender_role, 'merchant');
  assert.equal(message.image_url, 'https://example.com/qr.png');
  assert.ok(message.text.includes('💳 ข้อมูลชำระเงินสำหรับออเดอร์ #1001'));
  assert.ok(message.text.includes('ธนาคาร: กสิกรไทย'));
  assert.ok(message.text.includes('123-4-56789-0'));
});

test('checkoutOrder correctly processes items with option_groups', async () => {
  const s = setup();
  const menu = s.documents.get('menu_items/menu_1');
  menu.option_groups = [
    {
      id: 'grp_1',
      name: 'เลือกเส้น',
      type: 'single',
      required: true,
      options: [
        { name: 'เส้นเล็ก', price: 0 },
        { name: 'บะหมี่เกี๊ยว', price: 15 }
      ]
    },
    {
      id: 'grp_2',
      name: 'ท็อปปิ้ง',
      type: 'multiple',
      required: false,
      options: [
        { name: 'เพิ่มไข่ต้ม', price: 10 }
      ]
    }
  ];

  const payload = {
    idempotency_key: 'noodle_group_key',
    customer_name: 'Somchai',
    customer_phone: '0899999999',
    delivery_address: '123 Huaychan',
    payment_method: 'cash',
    orders: [
      {
        shop_id: 'shop_1',
        items: [
          {
            menu_id: 'menu_1',
            quantity: 2,
            selected_options: [
              { name: 'บะหมี่เกี๊ยว', price: 999 /* forged client price */ },
              { name: 'เพิ่มไข่ต้ม', price: 999 /* forged client price */ }
            ]
          }
        ]
      }
    ]
  };

  const res = await s.checkout(payload);
  assert.equal(res.success, true);
  // Base price = 50, +15 (บะหมี่เกี๊ยว), +10 (ไข่ต้ม) = 75 per item * 2 = 150 + 10 (delivery) = 160
  assert.equal(res.orders[0].items[0].price, 75);
  assert.equal(res.orders[0].food_subtotal, 150);
  assert.equal(res.orders[0].total_amount, 160);
});

