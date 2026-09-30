const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
try {
  admin.firestore().settings({ ignoreUndefinedProperties: true });
} catch (e) {
  // ignore if already set
}
Object.assign(exports, require('./security')(functions, admin));

async function merchantTokens(shopId) {
  const devices = await admin.firestore().collection('shop_private').doc(shopId).collection('devices').get();
  const tokens = [];
  for (const device of devices.docs) {
    const access = await admin.firestore().collection('access').doc(device.id).get();
    if (access.exists && access.data().role === 'merchant' && access.data().shop_id === shopId) tokens.push(...(device.data().tokens || []));
  }
  return [...new Set(tokens.filter(t => typeof t === 'string' && t.trim().length > 10))];
}

async function sendShopBadge(shopId) {
  const [shop, orders] = await Promise.all([
    admin.firestore().collection("shops").doc(shopId).get(),
    admin.firestore().collection("orders").where("shop_id", "==", shopId).get(),
  ]);
  if (!shop.exists) return;
  const tokens = await merchantTokens(shopId);
  if (tokens.length === 0) return;
  const count = orders.docs.filter(order => order.data().status === "pending").length;
  for (let offset = 0; offset < tokens.length; offset += 500) {
    await admin.messaging().sendEachForMulticast({
      tokens: tokens.slice(offset, offset + 500),
      data: { type: "ORDER_BADGE", shopId: String(shopId), count: String(count), version: String(Math.floor(orders.readTime ? orders.readTime.toMillis() : Date.now())) },
      android: { priority: "normal", ttl: 5 * 60 * 1000, collapseKey: `badge_${shopId}` },
    }).catch(err => console.warn("Badge push error:", err));
  }
}

const handleOrderBadgeChange = async (change) => {
  const before = change.before?.exists ? change.before.data() : null;
  const after = change.after?.exists ? change.after.data() : null;
  if (before?.status === after?.status && before?.shop_id === after?.shop_id) return;
  const shops = [...new Set([before?.shop_id, after?.shop_id].filter(Boolean))];
  for (const shopId of shops) {
    await sendShopBadge(shopId);
  }
};
exports.onOrderBadgeChanged = handleOrderBadgeChange;

async function notifyShopNewOrders(orders) {
  if (!Array.isArray(orders) || orders.length === 0) return;
  for (const order of orders) {
    const shopId = order.shop_id;
    if (!shopId) continue;
    try {
      const tokens = await merchantTokens(shopId);
      if (tokens.length > 0) {
        const orderNumber = order.order_number ? `#${order.order_number}` : '';
        const total = order.total_amount ? `฿${order.total_amount}` : '';
        const itemsCount = Array.isArray(order.items) ? order.items.length : 0;
        const itemsPreview = Array.isArray(order.items)
          ? order.items.slice(0, 2).map(i => `${i.name} x${i.quantity}`).join(', ') + (itemsCount > 2 ? ` และอีก ${itemsCount - 2} รายการ` : '')
          : '';
        const title = `🔔 มีออเดอร์ใหม่! ${orderNumber}`.trim();
        const body = `${order.shop_name || 'ร้านค้า'} • ${itemsPreview ? itemsPreview + ' • ' : ''}${total} (แตะเพื่อเปิดดู)`;

        await admin.messaging().sendEachForMulticast({
          tokens,
          notification: { title, body },
          data: {
            orderId: String(order.id),
            shopId: String(shopId),
            type: 'NEW_ORDER',
          },
          android: {
            priority: 'high',
            notification: {
              channelId: 'orders_channel',
              sound: 'default',
              defaultSound: true,
              defaultVibrateTimings: true,
              notificationPriority: 'PRIORITY_MAX',
              visibility: 'PUBLIC',
            },
          },
        }).catch(err => console.warn('Order push multicast error:', err));
      }
    } catch (err) {
      console.warn('notifyShopNewOrders error for shop', shopId, err);
    }
  }
}

const createCheckoutHandler = require('./checkout');

const region = functions.region('us-central1');

async function isCallerAdmin(callerUid) {
  if (!callerUid) return false;
  const db = admin.firestore();
  try {
    const accessSnap = await db.collection('access').doc(callerUid).get();
    if (accessSnap.exists && accessSnap.data().role === 'admin') return true;
  } catch (err) {
    console.warn('isCallerAdmin check warning:', err);
  }
  return false;
}

async function isCallerMerchantForShop(callerUid, shopId) {
  if (!callerUid) return false;
  const db = admin.firestore();
  try {
    const accessSnap = await db.collection('access').doc(callerUid).get();
    if (accessSnap.exists) {
      const data = accessSnap.data();
      if (data.role === 'merchant' && (!shopId || data.shop_id === shopId)) {
        return true;
      }
    }
  } catch (err) {
    console.warn('isCallerMerchantForShop check warning:', err);
  }
  return false;
}

/**
 * Authenticated order notification callable
 */
exports.notifyNewOrder = region.runWith({ invoker: 'public' }).https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
  const orderId = data?.orderId;
  if (!orderId || typeof orderId !== 'string') throw new functions.https.HttpsError('invalid-argument', 'Missing orderId');

  const orderDoc = await admin.firestore().collection('orders').doc(orderId).get();
  if (!orderDoc.exists) throw new functions.https.HttpsError('not-found', 'Order not found');
  const order = orderDoc.data();

  const callerUid = context.auth.uid;
  const isAdmin = await isCallerAdmin(callerUid);
  if (order.customer_uid !== callerUid && !isAdmin) {
    throw new functions.https.HttpsError('permission-denied', 'Unauthorized to notify for this order');
  }

  const shopId = order.shop_id;
  if (!shopId) return { success: false, reason: 'no-shop' };

  try {
    const shopDoc = await admin.firestore().collection('shops').doc(shopId).get();
    const shopName = shopDoc.exists ? shopDoc.data().name : 'ร้านค้า';
    const tokens = await merchantTokens(shopId);

    if (tokens.length > 0) {
      const orderNumber = order.order_number ? `#${order.order_number}` : '';
      const total = order.total_amount ? `฿${order.total_amount}` : '';
      const itemsCount = Array.isArray(order.items) ? order.items.length : 0;
      const itemsPreview = Array.isArray(order.items)
        ? order.items.slice(0, 2).map(i => `${i.name} x${i.quantity}`).join(', ') + (itemsCount > 2 ? ` และอีก ${itemsCount - 2} รายการ` : '')
        : '';
      const title = `🔔 มีออเดอร์ใหม่! ${orderNumber}`.trim();
      const body = `${shopName} • ${itemsPreview ? itemsPreview + ' • ' : ''}${total} (แตะเพื่อเปิดดู)`;

      await admin.messaging().sendEachForMulticast({
        tokens,
        notification: { title, body },
        data: {
          orderId: String(orderId),
          shopId: String(shopId),
          type: 'NEW_ORDER',
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'orders_channel',
            sound: 'default',
            defaultSound: true,
            defaultVibrateTimings: true,
            notificationPriority: 'PRIORITY_MAX',
            visibility: 'PUBLIC',
          },
        },
      });
    }

    await sendShopBadge(shopId);
    return { success: true };
  } catch (err) {
    console.error('Error in notifyNewOrder:', err);
    return { success: false, error: err.message };
  }
});

/**
 * Complete order atomically: updates status, increments sales, deducts credit if GP enabled
 */
// Firebase clients use Firebase Auth, not Google IAM credentials. Allow the
// callable transport, then enforce authentication and shop ownership below.
exports.completeOrder = region.runWith({ invoker: 'public' }).https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
  const orderId = data?.orderId;
  if (!orderId || typeof orderId !== 'string') throw new functions.https.HttpsError('invalid-argument', 'Missing orderId');

  const orderRef = admin.firestore().collection('orders').doc(orderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) throw new functions.https.HttpsError('not-found', 'Order not found');
  const order = orderSnap.data();

  const callerUid = context.auth.uid;
  const isAdmin = await isCallerAdmin(callerUid);
  const isMerchant = !isAdmin && await isCallerMerchantForShop(callerUid, order.shop_id);

  if (!isAdmin && !isMerchant) {
    throw new functions.https.HttpsError('permission-denied', 'Unauthorized to complete this order');
  }

  if (order.status === 'completed') {
    return { success: true, alreadyCompleted: true };
  }

  const db = admin.firestore();
  await db.runTransaction(async tx => {
    const oSnap = await tx.get(orderRef);
    if (!oSnap.exists) throw new functions.https.HttpsError('not-found', 'Order not found');
    const current = oSnap.data();
    if (current.status === 'completed') return;
    if (current.status !== 'delivering' && current.status !== 'cooking') {
      throw new functions.https.HttpsError('failed-precondition', 'Order must be cooking or delivering');
    }

    // Firestore requires ALL reads before the first write.
    const shopRef = db.collection('shops').doc(current.shop_id);
    const shopSnap = await tx.get(shopRef);
    if (!shopSnap.exists) throw new functions.https.HttpsError('not-found', 'Shop not found');
    const settingsSnap = await tx.get(db.collection('system_settings').doc('general'));
    const marker = db.collection('_completed_orders').doc(orderId);
    const markerSnap = await tx.get(marker);
    const quantities = new Map();
    for (const item of current.items || []) {
      const menuKey = item.menu_id || item.id;
      const qty = parseInt(item.quantity, 10);
      if (typeof menuKey === 'string' && Number.isInteger(qty) && qty > 0) {
        quantities.set(menuKey, (quantities.get(menuKey) || 0) + qty);
      }
    }
    const menus = [];
    for (const [id, quantity] of quantities) {
      const ref = db.collection('menu_items').doc(id);
      const snap = await tx.get(ref);
      if (snap.exists && snap.data().shop_id === current.shop_id) menus.push({ ref, quantity });
    }
    const settings = settingsSnap.exists ? settingsSnap.data() : {};
    let gpAmount = 0;
    const isGpActive = settings.gp_enabled === true || String(settings.gp_enabled) === 'true';
    if (isGpActive) {
      if (typeof current.gp_amount === 'number' && current.gp_amount > 0) {
        gpAmount = current.gp_amount;
      } else {
        const percent = typeof settings.gp_percent === 'number' ? settings.gp_percent : (parseFloat(settings.gp_percent) || 5);
        const subtotal = typeof current.food_subtotal === 'number' ? current.food_subtotal : (parseFloat(current.food_subtotal) || 0);
        gpAmount = Math.round(subtotal * (percent / 100) * 100) / 100;
      }
    }
    if (typeof gpAmount !== 'number' || !Number.isFinite(gpAmount) || gpAmount < 0) {
      throw new functions.https.HttpsError('failed-precondition', 'Invalid order fee');
    }
    tx.update(orderRef, { status: 'completed', completed_at: admin.firestore.FieldValue.serverTimestamp() });
    const updates = {};
    if (!markerSnap.exists) {
      updates.sales_count = admin.firestore.FieldValue.increment(1);
      for (const item of menus) tx.update(item.ref, { sales_count: admin.firestore.FieldValue.increment(item.quantity) });
      tx.set(marker, { processed_at: admin.firestore.FieldValue.serverTimestamp() });
    }
    if (gpAmount > 0) {
      updates.credit_balance = admin.firestore.FieldValue.increment(-gpAmount);
      const currentBal = typeof shopSnap.data().credit_balance === 'number' ? shopSnap.data().credit_balance : 0;
      if (currentBal - gpAmount <= 0) updates.is_open = false;
      const txRef = db.collection('credit_transactions').doc();
      tx.set(txRef, {
        id: txRef.id,
        shop_id: current.shop_id,
        shop_name: current.shop_name || shopSnap.data().name || '',
        order_id: orderId,
        order_number: current.order_number || null,
        amount: -gpAmount,
        type: 'gp_deduct',
        note: 'หักค่าบริการสำหรับออเดอร์ #' + (current.order_number || orderId),
        created_by: 'system',
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    if (Object.keys(updates).length) tx.update(shopRef, updates);
  });

  await sendShopBadge(order.shop_id).catch(() => {});
  return { success: true };
});

/**
 * Top up / adjust merchant credit balance (Admin only)
 */
exports.topUpMerchantCredit = region.runWith({ invoker: 'public' }).https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
  const callerUid = context.auth.uid;
  const isAdmin = await isCallerAdmin(callerUid);
  if (!isAdmin) {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required');
  }

  const { shopId, amount, note, idempotencyKey } = data || {};
  if (!shopId || typeof amount !== 'number' || isNaN(amount) || amount === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid shopId or amount');
  }

  const db = admin.firestore();
  const trimmedIdemp = idempotencyKey && typeof idempotencyKey === 'string' ? idempotencyKey.trim() : null;
  const idempRef = trimmedIdemp ? db.collection('_topup_requests').doc(trimmedIdemp) : null;

  if (idempRef) {
    const existingIdemp = await idempRef.get();
    if (existingIdemp.exists) {
      const prevData = existingIdemp.data();
      return { success: true, newBalance: prevData.newBalance, is_open: prevData.is_open, alreadyProcessed: true };
    }
  }

  const shopRef = db.collection('shops').doc(shopId);
  const settingsRef = db.collection('system_settings').doc('general');
  const txRef = db.collection('credit_transactions').doc();

  let finalBalance = 0;
  let finalIsOpen = true;

  await db.runTransaction(async tx => {
    if (idempRef) {
      const txIdempSnap = await tx.get(idempRef);
      if (txIdempSnap.exists) {
        const prevData = txIdempSnap.data();
        finalBalance = prevData.newBalance;
        finalIsOpen = prevData.is_open;
        return;
      }
    }

    const [shopSnap, settingsSnap] = await Promise.all([
      tx.get(shopRef),
      tx.get(settingsRef)
    ]);

    if (!shopSnap.exists) throw new functions.https.HttpsError('not-found', 'Shop not found');
    const shopData = shopSnap.data();
    const settings = settingsSnap.exists ? settingsSnap.data() : {};

    const currentBalance = typeof shopData.credit_balance === 'number' ? shopData.credit_balance : 0;
    finalBalance = Math.round((currentBalance + amount) * 100) / 100;

    const updates = {
      credit_balance: finalBalance,
    };

    // If GP is active and resulting credit is <= 0, automatically close the shop
    if (settings.gp_enabled === true && finalBalance <= 0) {
      updates.is_open = false;
      finalIsOpen = false;
    } else {
      finalIsOpen = shopData.is_open ?? true;
    }

    tx.update(shopRef, updates);
    tx.set(txRef, {
      id: txRef.id,
      shop_id: shopId,
      shop_name: shopData.name || '',
      amount: amount,
      type: amount > 0 ? 'topup' : 'deduct',
      note: note || (amount > 0 ? 'แอดมินเติมเครดิต' : 'แอดมินปรับลดยอดเครดิต'),
      created_by: callerUid,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    if (idempRef) {
      tx.set(idempRef, {
        shop_id: shopId,
        amount,
        newBalance: finalBalance,
        is_open: finalIsOpen,
        created_by: callerUid,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });

  return { success: true, newBalance: finalBalance, is_open: finalIsOpen };
});

/**
 * Server-side order checkout callable: authoritative pricing, atomic reservation, idempotency
 */
exports.checkoutOrder = region.runWith({ invoker: 'public' }).https.onCall(
  createCheckoutHandler(admin, functions, { sendShopBadge, merchantTokens, notifyShopNewOrders })
);

/**
 * Admin: Create merchant account with email and password, provision shop and access atomically
 */
exports.createMerchantAccount = region.runWith({ invoker: 'public' }).https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
  const callerUid = context.auth.uid;
  const isAdmin = await isCallerAdmin(callerUid);
  if (!isAdmin) {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required');
  }

  const { email, password, shopName, shopPhone, promptpayNumber, addressDetail, deliveryFee, category } = data || {};
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid email address');
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    throw new functions.https.HttpsError('invalid-argument', 'Password must be at least 6 characters');
  }
  if (!shopName || typeof shopName !== 'string' || shopName.trim().length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Shop name is required');
  }

  const cleanEmail = email.trim().toLowerCase();
  const trimmedShopName = shopName.trim();
  const trimmedPhone = (shopPhone || '').trim();
  const fee = typeof deliveryFee === 'number' && deliveryFee >= 0 ? deliveryFee : 0;
  const cat = category === 'drink_dessert' ? 'drink_dessert' : 'food';

  const db = admin.firestore();
  let userRecord;
  try {
    userRecord = await admin.auth().createUser({
      email: cleanEmail,
      password: password,
      displayName: trimmedShopName,
    });
  } catch (authErr) {
    console.error('Auth create user error:', authErr);
    throw new functions.https.HttpsError('already-exists', authErr.message || 'อีเมลนี้มีผู้ใช้งานในระบบแล้ว');
  }

  const newUid = userRecord.uid;
  const shopId = `shop_${Date.now()}`;

  try {
    const batch = db.batch();

    // 1. Create shop document
    const shopRef = db.collection('shops').doc(shopId);
    batch.set(shopRef, {
      id: shopId,
      owner_uid: newUid,
      name: trimmedShopName,
      merchant_email: cleanEmail,
      phone: trimmedPhone || '0898765432',
      promptpay_number: (promptpayNumber || '').trim(),
      address_detail: (addressDetail || '').trim() || 'รอบ มรภ. ชัยภูมิ',
      delivery_fee: fee,
      category: cat,
      is_open: true,
      image_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&auto=format&fit=crop&q=80',
      rating: 5.0,
      review_count: 0,
      sales_count: 0,
      credit_balance: 0,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 2. Create /users doc
    const userRef = db.collection('users').doc(newUid);
    batch.set(userRef, {
      uid: newUid,
      email: cleanEmail,
      display_name: trimmedShopName,
      phone: trimmedPhone,
      role: 'merchant',
      shop_id: shopId,
      picture_url: '',
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 3. Create /access doc (Authoritative role enforcement)
    const accessRef = db.collection('access').doc(newUid);
    batch.set(accessRef, {
      role: 'merchant',
      shop_id: shopId,
    });

    // 4. Record credentials in admin_merchant_credentials (Protected for Admin only)
    const credRef = db.collection('admin_merchant_credentials').doc(shopId);
    batch.set(credRef, {
      shop_id: shopId,
      owner_uid: newUid,
      email: cleanEmail,
      password: password,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();
    return { success: true, uid: newUid, shopId: shopId };
  } catch (err) {
    console.error('Error provisioning merchant docs:', err);
    await admin.auth().deleteUser(newUid).catch(() => {});
    throw new functions.https.HttpsError('internal', 'เกิดข้อผิดพลาดในการสร้างข้อมูลร้านค้า');
  }
});

/**
 * Admin: Get merchant login credentials (email, password if recorded, owner UID)
 */
exports.getMerchantCredentials = region.runWith({ invoker: 'public' }).https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
  const callerUid = context.auth.uid;
  const isAdmin = await isCallerAdmin(callerUid);
  if (!isAdmin) {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required');
  }

  const { shopId } = data || {};
  if (!shopId || typeof shopId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'Shop ID is required');
  }

  const db = admin.firestore();
  const shopSnap = await db.collection('shops').doc(shopId).get();
  if (!shopSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Shop not found');
  }
  const shopData = shopSnap.data();

  // Try admin_merchant_credentials doc first
  const credSnap = await db.collection('admin_merchant_credentials').doc(shopId).get();
  let email = credSnap.exists ? (credSnap.data().email || '') : '';
  let password = credSnap.exists ? (credSnap.data().password || '') : '';

  // Fallback to shop doc or auth user if not present
  if (!email && shopData.merchant_email) {
    email = shopData.merchant_email;
  }
  if (!email && shopData.owner_uid) {
    try {
      const userRecord = await admin.auth().getUser(shopData.owner_uid);
      if (userRecord && userRecord.email) {
        email = userRecord.email;
      }
    } catch (e) {
      console.warn('Could not fetch Auth user for shop:', e.message);
    }
  }

  // Fallback to users doc if password or email is there
  if ((!email || !password) && shopData.owner_uid) {
    try {
      const userSnap = await db.collection('users').doc(shopData.owner_uid).get();
      if (userSnap.exists) {
        const udata = userSnap.data();
        if (!email && udata.email) email = udata.email;
        if (!password && udata.merchant_password) password = udata.merchant_password;
      }
    } catch (e) {}
  }

  return {
    shopId,
    shopName: shopData.name || '',
    ownerUid: shopData.owner_uid || '',
    email: email || '',
    password: password || '',
  };
});

/**
 * Admin: Update merchant credentials (email and/or password)
 * Updates Firebase Auth, admin_merchant_credentials, and syncs to users/shops.
 */
exports.updateMerchantCredentials = region.runWith({ invoker: 'public' }).https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
  const callerUid = context.auth.uid;
  const isAdmin = await isCallerAdmin(callerUid);
  if (!isAdmin) {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required');
  }

  const { shopId, email, password } = data || {};
  if (!shopId || typeof shopId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'Shop ID is required');
  }

  const cleanEmail = email && typeof email === 'string' ? email.trim().toLowerCase() : null;
  const newPassword = password && typeof password === 'string' && password.trim().length > 0 ? password.trim() : null;

  if (!cleanEmail && !newPassword) {
    throw new functions.https.HttpsError('invalid-argument', 'กรุณาระบุอีเมลหรือรหัสผ่านที่ต้องการแก้ไข');
  }
  if (cleanEmail && (!cleanEmail.includes('@') || !cleanEmail.includes('.'))) {
    throw new functions.https.HttpsError('invalid-argument', 'รูปแบบอีเมลไม่ถูกต้อง');
  }
  if (newPassword && newPassword.length < 6) {
    throw new functions.https.HttpsError('invalid-argument', 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
  }

  const db = admin.firestore();
  const shopRef = db.collection('shops').doc(shopId);
  const shopSnap = await shopRef.get();
  if (!shopSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'ไม่พบข้อมูลร้านค้านี้ในระบบ');
  }
  const shopData = shopSnap.data();
  let ownerUid = shopData.owner_uid;

  // 1. Update or create user in Firebase Auth
  if (ownerUid) {
    try {
      const authUpdates = {};
      if (cleanEmail) authUpdates.email = cleanEmail;
      if (newPassword) authUpdates.password = newPassword;
      await admin.auth().updateUser(ownerUid, authUpdates);
    } catch (authErr) {
      console.error('admin.auth().updateUser error:', authErr);
      if (authErr.code === 'auth/user-not-found') {
        if (!cleanEmail || !newPassword) {
          throw new functions.https.HttpsError('invalid-argument', 'ไม่พบบัญชีเดิมในระบบ กรุณาระบุทั้งอีเมลและรหัสผ่านเพื่อสร้างบัญชีใหม่');
        }
        const newUser = await admin.auth().createUser({
          email: cleanEmail,
          password: newPassword,
          displayName: shopData.name,
        });
        ownerUid = newUser.uid;
      } else {
        throw new functions.https.HttpsError('internal', authErr.message || 'ไม่สามารถอัปเดตข้อมูลบัญชีผู้ใช้ได้');
      }
    }
  } else {
    if (!cleanEmail || !newPassword) {
      throw new functions.https.HttpsError('invalid-argument', 'ร้านค้านี้ยังไม่มีบัญชีเจ้าของ กรุณาระบุทั้งอีเมลและรหัสผ่านเพื่อสร้างบัญชีใหม่');
    }
    const newUser = await admin.auth().createUser({
      email: cleanEmail,
      password: newPassword,
      displayName: shopData.name,
    });
    ownerUid = newUser.uid;
  }

  const batch = db.batch();

  // 2. Update admin_merchant_credentials
  const credRef = db.collection('admin_merchant_credentials').doc(shopId);
  const credUpdates = {
    shop_id: shopId,
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
    updated_by: callerUid,
  };
  if (ownerUid) credUpdates.owner_uid = ownerUid;
  if (cleanEmail) credUpdates.email = cleanEmail;
  if (newPassword) credUpdates.password = newPassword;
  batch.set(credRef, credUpdates, { merge: true });

  // 3. Update shops doc
  const shopUpdates = {
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (cleanEmail) shopUpdates.merchant_email = cleanEmail;
  if (ownerUid && ownerUid !== shopData.owner_uid) shopUpdates.owner_uid = ownerUid;
  batch.update(shopRef, shopUpdates);

  // 4. Update users doc and access doc if ownerUid exists
  if (ownerUid) {
    const userRef = db.collection('users').doc(ownerUid);
    const userUpdates = {
      uid: ownerUid,
      display_name: shopData.name || 'เจ้าของร้านค้า',
      role: 'merchant',
      shop_id: shopId,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (cleanEmail) userUpdates.email = cleanEmail;
    batch.set(userRef, userUpdates, { merge: true });

    const accessRef = db.collection('access').doc(ownerUid);
    batch.set(accessRef, {
      role: 'merchant',
      shop_id: shopId,
    }, { merge: true });
  }

  await batch.commit();

  return {
    success: true,
    shopId,
    email: cleanEmail || shopData.merchant_email || '',
    password: newPassword || '',
  };
});

exports.sendOrderPush = functions.region('us-central1').https.onRequest((req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  res.status(200).json({ ok: true });
});

/**
 * Realtime Chat Message Push Notification Trigger
 * Listens for new messages on orders/{orderId}/messages/{messageId} and sends push alerts
 */
exports.onChatMessageCreated = region.firestore
  .document('orders/{orderId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    const message = snap.data();
    if (!message) return null;
    const { orderId } = context.params;
    const senderUid = message.sender_uid;
    const senderRole = message.sender_role;

    // Do not notify for system messages
    if (senderUid === 'system') return null;

    try {
      const orderSnap = await admin.firestore().collection('orders').doc(orderId).get();
      if (!orderSnap.exists) return null;
      const order = orderSnap.data();

      // If message sent by customer or admin, notify merchant devices
      if (senderRole === 'customer' || senderRole === 'admin') {
        const shopId = order.shop_id;
        if (shopId) {
          const tokens = await merchantTokens(shopId);
          if (tokens.length > 0) {
            const senderName = message.sender_name || 'ลูกค้า';
            const title = `💬 ข้อความใหม่จาก ${senderName}`;
            const body = `${message.text ? message.text.slice(0, 100) : '📷 ส่งรูปภาพ'} (ออเดอร์ #${order.order_number || orderId.slice(0, 5)})`;

            await admin.messaging().sendEachForMulticast({
              tokens,
              notification: { title, body },
              data: {
                orderId: String(orderId),
                shopId: String(shopId),
                type: 'CHAT_MESSAGE',
                url: `/?order_id=${orderId}&open_chat=1`,
              },
              android: {
                priority: 'high',
                notification: {
                  channelId: 'orders_channel',
                  sound: 'default',
                  defaultSound: true,
                  defaultVibrateTimings: true,
                  notificationPriority: 'PRIORITY_MAX',
                  visibility: 'PUBLIC',
                },
              },
            }).catch((err) => console.warn('Chat push multicast error:', err));
          }
        }
      }
    } catch (err) {
      console.warn('onChatMessageCreated error:', err);
    }
    return null;
  });


