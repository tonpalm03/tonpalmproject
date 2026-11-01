import { doc, collection, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MerchantApplication, Shop, ShopCategory, UserProfile } from '@/types';

const DEFAULT_SHOP_IMAGE = 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&auto=format&fit=crop&q=80';

export interface NewShopInput {
  name: string;
  phone?: string;
  category?: ShopCategory;
  address_detail?: string;
  location?: { lat: number; lng: number };
}

function buildNewShop(shopId: string, ownerUid: string, input: NewShopInput) {
  return {
    id: shopId,
    owner_uid: ownerUid,
    name: input.name.trim(),
    phone: (input.phone || '').trim(),
    category: input.category === 'drink_dessert' || input.category === 'both' ? input.category : 'food',
    address_detail: (input.address_detail || '').trim() || 'รอบ มรภ. ชัยภูมิ',
    ...(input.location ? { location: { lat: input.location.lat, lng: input.location.lng } } : {}),
    delivery_fee: 0,
    // New shops start closed so the owner can set up menus and payment first.
    is_open: false,
    image_url: DEFAULT_SHOP_IMAGE,
    rating: 5.0,
    review_count: 0,
    sales_count: 0,
    created_at: new Date().toISOString(),
  };
}

/** Creates a shop owned by `user` and grants merchant access atomically. */
export async function grantMerchant(user: UserProfile, input: NewShopInput, application?: { reviewedBy: string }) {
  const shopId = `shop_${Date.now()}`;
  const batch = writeBatch(db);
  batch.set(doc(db, 'shops', shopId), buildNewShop(shopId, user.uid, input));
  batch.set(doc(db, 'users', user.uid), { role: 'merchant', shop_id: shopId }, { merge: true });
  batch.set(doc(db, 'access', user.uid), { role: 'merchant', shop_id: shopId });
  if (application) {
    batch.update(doc(db, 'merchant_applications', user.uid), {
      status: 'approved',
      shop_id: shopId,
      reviewed_by: application.reviewedBy,
      reviewed_at: serverTimestamp(),
    });
  }
  await batch.commit();
  return shopId;
}

export async function approveApplication(app: MerchantApplication, applicant: UserProfile, adminUid: string) {
  return grantMerchant(
    applicant,
    { name: app.shop_name, phone: app.phone, category: app.category, address_detail: app.address_detail, location: app.location },
    { reviewedBy: adminUid }
  );
}

export async function rejectApplication(app: MerchantApplication, adminUid: string, reason: string) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'merchant_applications', app.uid), {
    status: 'rejected',
    reject_reason: reason.trim(),
    reviewed_by: adminUid,
    reviewed_at: serverTimestamp(),
  });
  await batch.commit();
}

export async function setAdminRole(user: UserProfile, makeAdmin: boolean) {
  const role = makeAdmin ? 'admin' : 'customer';
  const batch = writeBatch(db);
  batch.set(doc(db, 'access', user.uid), { role });
  batch.set(doc(db, 'users', user.uid), { role, shop_id: null }, { merge: true });
  await batch.commit();
}

/**
 * Moves shop ownership to another account, e.g. when the owner lost access to
 * their LINE/Google login. The previous owner is demoted and their push devices
 * are removed so they stop receiving this shop's orders.
 */
export async function transferShopOwner(
  shop: Shop,
  newOwner: UserProfile,
  previousOwner: UserProfile | undefined,
  adminUid: string,
  reason: string
) {
  const previousUid = shop.owner_uid || '';
  if (previousUid === newOwner.uid) throw new Error('บัญชีนี้เป็นเจ้าของร้านอยู่แล้ว');
  if (newOwner.role !== 'customer') throw new Error('บัญชีปลายทางต้องเป็นลูกค้าทั่วไป (1 บัญชีมีได้ 1 ร้าน)');

  const batch = writeBatch(db);
  batch.update(doc(db, 'shops', shop.id), { owner_uid: newOwner.uid });
  batch.set(doc(db, 'access', newOwner.uid), { role: 'merchant', shop_id: shop.id });
  batch.set(doc(db, 'users', newOwner.uid), { role: 'merchant', shop_id: shop.id }, { merge: true });
  if (previousUid) {
    batch.set(doc(db, 'access', previousUid), { role: 'customer' });
    // The old account may already be deleted; don't recreate a stub profile for it.
    if (previousOwner) batch.set(doc(db, 'users', previousUid), { role: 'customer', shop_id: null }, { merge: true });
    batch.delete(doc(db, 'shop_private', shop.id, 'devices', previousUid));
  }
  batch.set(doc(collection(db, 'shop_owner_transfers')), {
    shop_id: shop.id,
    shop_name: shop.name,
    from_uid: previousUid || null,
    to_uid: newOwner.uid,
    to_name: newOwner.display_name,
    reason: reason.trim(),
    transferred_by: adminUid,
    created_at: serverTimestamp(),
  });
  await batch.commit();
}
