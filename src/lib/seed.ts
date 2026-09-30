import { db } from './firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { INITIAL_SHOPS, INITIAL_MENU_ITEMS } from './initialData';

export async function seedInitialFirestoreData(): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    let count = 0;

    // 1. Seed System Settings
    await setDoc(doc(db, 'system_settings', 'general'), {
      gp_percent: 5,
      delivery_fee: 10,
      platform_name: 'huaychan',
      updated_at: serverTimestamp(),
    }, { merge: true });
    count += 1;

    // 2. Seed Shops
    for (const shop of INITIAL_SHOPS) {
      await setDoc(doc(db, 'shops', shop.id), {
        ...shop,
        created_at: serverTimestamp(),
      }, { merge: true });
      count += 1;
    }

    // 3. Seed Menu Items
    for (const item of INITIAL_MENU_ITEMS) {
      await setDoc(doc(db, 'menu_items', item.id), {
        ...item,
        created_at: serverTimestamp(),
      }, { merge: true });
      count += 1;
    }

    // 4. Seed Demo Merchant User
    await setDoc(doc(db, 'users', 'user_merchant_1'), {
      uid: 'user_merchant_1',
      line_user_id: 'LINE_user_merchant_1',
      display_name: 'ป้าศรี กะเพราถาดยักษ์ (ร้านค้า)',
      picture_url: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=150&auto=format&fit=crop&q=80',
      role: 'merchant',
      shop_id: 'shop_1',
      phone: '0898765432',
      created_at: serverTimestamp(),
    }, { merge: true });
    count += 1;

    return { success: true, count };
  } catch (err: any) {
    console.error('Seed error:', err);
    return { success: false, count: 0, error: err?.message || 'Unknown error' };
  }
}
