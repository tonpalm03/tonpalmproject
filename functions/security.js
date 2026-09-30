const { verifyLineIdentity } = require('./line-identity');

module.exports = function securityFunctions(functions, admin) {
  const db = admin.firestore();
  const region = functions.region('us-central1');
  return {
    deleteUserAccount: region.runWith({ invoker: 'public' }).https.onCall(require('./delete-account')(admin, functions)),
    signInWithLine: region.https.onCall(async (data) => {
      let identity;
      try {
        identity = await verifyLineIdentity(data?.idToken, process.env.LINE_LOGIN_CHANNEL_ID || '2011320201');
      } catch (error) {
        console.error('signInWithLine verifyLineIdentity failure:', error.message);
        if (error.message === 'LINE_CHANNEL_NOT_CONFIGURED') throw new functions.https.HttpsError('failed-precondition', 'LINE login is not configured');
        throw new functions.https.HttpsError('unauthenticated', 'LINE verification failed');
      }

      // 1. Account deletion verification & Firestore profile sync in parallel
      const profileSyncTask = (async () => {
        const profile = db.collection('users').doc(identity.uid);
        await db.runTransaction(async tx => {
          const deletion = await tx.get(db.collection('_account_deletions').doc(identity.uid));
          if (deletion.exists && (deletion.data().state !== 'deleted'
            || !Number.isFinite(identity.issuedAt) || identity.issuedAt <= deletion.data().revoked_before)) {
            throw new functions.https.HttpsError('unauthenticated', 'กรุณาเข้าสู่ระบบ LINE ใหม่หลังจากบัญชีเดิมถูกลบ');
          }
          const snapshot = await tx.get(profile);
          if (!snapshot.exists) {
            tx.create(profile, {
              uid: identity.uid,
              line_user_id: identity.uid,
              display_name: identity.name,
              picture_url: identity.picture,
              role: 'customer',
              created_at: admin.firestore.FieldValue.serverTimestamp()
            });
          } else {
            const updates = {};
            if (identity.name && identity.name !== snapshot.data().display_name) updates.display_name = identity.name;
            if (identity.picture && identity.picture !== snapshot.data().picture_url) updates.picture_url = identity.picture;
            if (Object.keys(updates).length > 0) {
              tx.update(profile, updates);
            }
          }
        });
      })();

      // 2. Auth user sync & disabled check in parallel
      const authSyncTask = (async () => {
        try {
          const existing = await admin.auth().getUser(identity.uid);
          if (existing.disabled) throw new functions.https.HttpsError('permission-denied', 'Account is disabled');
          await admin.auth().updateUser(identity.uid, {
            displayName: identity.name,
            photoURL: identity.picture || undefined,
          });
        } catch (error) {
          if (error.code === 'auth/user-not-found') {
            await admin.auth().createUser({
              uid: identity.uid,
              displayName: identity.name,
              photoURL: identity.picture || undefined,
            }).catch(() => {});
          } else {
            throw error;
          }
        }
      })();

      // 3. Custom token creation in parallel
      const customTokenTask = admin.auth().createCustomToken(identity.uid);

      const [, , token] = await Promise.all([profileSyncTask, authSyncTask, customTokenTask]);
      return { token };
    }),
    reserveOrderNumbers: region.https.onCall(async (data, context) => {
      if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first');
      const count = data?.count ?? 1;
      if (!Number.isInteger(count) || count < 1 || count > 20) throw new functions.https.HttpsError('invalid-argument', 'Invalid order count');
      const ref = db.collection('system_settings').doc('order_counter');
      const numbers = await db.runTransaction(async tx => {
        const snap = await tx.get(ref);
        const current = snap.exists ? snap.data().last_order_number : 1000;
        if (!Number.isSafeInteger(current) || current < 1000 || current > Number.MAX_SAFE_INTEGER - count) throw new functions.https.HttpsError('failed-precondition', 'Invalid order counter');
        tx.set(ref, { last_order_number: current + count, updated_at: admin.firestore.FieldValue.serverTimestamp() });
        return Array.from({ length: count }, (_, i) => current + i + 1);
      });
      return { numbers };
    }),
    ...(process.env.FIRESTORE_EMULATOR_HOST || process.env.FUNCTIONS_EMULATOR ? {
      onOrderCompleted: region.firestore.document('orders/{orderId}').onUpdate(async (change, context) => {
        if (change.before.data().status === 'completed' || change.after.data().status !== 'completed') return;
        const order = change.after.data();
        const marker = db.collection('_completed_orders').doc(context.params.orderId);
        await db.runTransaction(async tx => {
          if ((await tx.get(marker)).exists) return;
          const shop = db.collection('shops').doc(order.shop_id);
          const shopSnap = await tx.get(shop);
          const quantities = new Map();
          for (const item of order.items || []) {
            if (typeof item.menu_id === 'string' && Number.isInteger(item.quantity) && item.quantity > 0) quantities.set(item.menu_id, (quantities.get(item.menu_id) || 0) + item.quantity);
          }
          const menus = [];
          for (const [id, quantity] of quantities) {
            const ref = db.collection('menu_items').doc(id), snap = await tx.get(ref);
            if (snap.exists && snap.data().shop_id === order.shop_id) menus.push({ ref, quantity });
          }
          if (shopSnap.exists) tx.update(shop, { sales_count: admin.firestore.FieldValue.increment(1) });
          for (const item of menus) tx.update(item.ref, { sales_count: admin.firestore.FieldValue.increment(item.quantity) });
          tx.create(marker, { processed_at: admin.firestore.FieldValue.serverTimestamp() });
        });
      }),
      onReviewChanged: region.firestore.document('shop_reviews/{reviewId}').onWrite(async change => {
        const shopId = change.after.exists ? change.after.data().shop_id : change.before.data().shop_id;
        if (!shopId) return;
        await db.runTransaction(async tx => {
          const shop = db.collection('shops').doc(shopId);
          if (!(await tx.get(shop)).exists) return;
          const reviews = await tx.get(db.collection('shop_reviews').where('shop_id', '==', shopId));
          const ratings = reviews.docs.map(doc => doc.data().rating).filter(n => Number.isInteger(n) && n >= 1 && n <= 5);
          tx.update(shop, { review_count: ratings.length, rating: ratings.length ? Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length * 10) / 10 : 0 });
        });
      }),
    } : {}),
  };
};
