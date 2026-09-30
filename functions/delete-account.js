module.exports = function createDeleteAccountHandler(admin, functions) {
  const db = admin.firestore();
  return async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
    const uid = data?.uid;
    if (typeof uid !== 'string' || !uid.trim() || uid.includes('/') || uid.length > 128) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid user ID');
    }
    if (uid === context.auth.uid) throw new functions.https.HttpsError('failed-precondition', 'Cannot delete your own account');
    const access = db.collection('access').doc(uid);
    const profile = db.collection('users').doc(uid);
    const marker = db.collection('_account_deletions').doc(uid);
    const shopId = await db.runTransaction(async tx => {
      const caller = await tx.get(db.collection('access').doc(context.auth.uid));
      if (!caller.exists || caller.data().role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Admin access required');
      }
      const [permission, user, previous] = await Promise.all([tx.get(access), tx.get(profile), tx.get(marker)]);
      const pending = previous.exists && previous.data().state === 'deleting';
      const shop = permission.data()?.shop_id || user.data()?.shop_id || (pending ? previous.data().shop_id : null) || null;
      tx.set(marker, {
        state: 'deleting',
        revoked_before: pending ? previous.data().revoked_before : Math.floor(Date.now() / 1000),
        shop_id: shop,
      });
      tx.delete(access);
      return shop;
    });
    try {
      await admin.auth().updateUser(uid, { disabled: true });
      await admin.auth().revokeRefreshTokens(uid);
      await admin.auth().deleteUser(uid);
    } catch (error) {
      // Allows cleanup of orphaned profiles and safe retry after partial failure.
      if (error.code !== 'auth/user-not-found') throw error;
    }
    const batch = db.batch();
    batch.delete(profile);
    batch.delete(access);
    batch.delete(db.collection('admins').doc(uid));
    batch.delete(db.collection('admin_merchant_credentials').doc(uid));
    if (shopId) {
      batch.delete(db.collection('shop_private').doc(shopId).collection('devices').doc(uid));
      batch.delete(db.collection('admin_merchant_credentials').doc(shopId));
      const shopSnap = await db.collection('shops').doc(shopId).get();
      if (shopSnap.exists) {
        batch.update(db.collection('shops').doc(shopId), {
          is_open: false,
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }
    batch.update(marker, { state: 'deleted' });
    await batch.commit();
    return { success: true };
  };
};
