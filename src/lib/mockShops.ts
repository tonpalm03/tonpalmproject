import { collection, doc, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { MenuCategory, OptionGroup, Shop } from '@/types';

/**
 * Demo shops for trying the app before real merchants join. They have no owner and
 * every id starts with MOCK_PREFIX, so they can be replaced or removed in one go.
 * Photos live in public/mock (cut from brand/raw/mock, prompts in brand/mock-shops-prompt.md).
 */
export const MOCK_PREFIX = 'shop_mock_';

type MockMenu = [name: string, price: number, category: MenuCategory, options?: OptionGroup[]];

const SPICE: OptionGroup = {
  id: 'spice', title: 'ระดับความเผ็ด', required: true, type: 'single',
  options: [{ id: 'mild', name: 'ไม่เผ็ด', price: 0 }, { id: 'medium', name: 'เผ็ดกลาง', price: 0 }, { id: 'hot', name: 'เผ็ดมาก', price: 0 }],
};
const EXTRA_EGG: OptionGroup = {
  id: 'extra', title: 'เพิ่มเติม', required: false, type: 'multiple',
  options: [{ id: 'egg', name: 'ไข่ดาว', price: 10 }, { id: 'jumbo', name: 'พิเศษ', price: 10 }],
};
const SWEET: OptionGroup = {
  id: 'sweet', title: 'ความหวาน', required: true, type: 'single',
  options: [{ id: '0', name: 'ไม่หวาน', price: 0 }, { id: '50', name: 'หวานน้อย', price: 0 }, { id: '100', name: 'หวานปกติ', price: 0 }],
};
const PEARL: OptionGroup = {
  id: 'topping', title: 'ท็อปปิ้ง', required: false, type: 'multiple',
  options: [{ id: 'pearl', name: 'ไข่มุก', price: 5 }, { id: 'jelly', name: 'บุก', price: 5 }],
};
const NOODLE: OptionGroup = {
  id: 'noodle', title: 'เส้น', required: true, type: 'single',
  options: [{ id: 'small', name: 'เส้นเล็ก', price: 0 }, { id: 'big', name: 'เส้นใหญ่', price: 0 }, { id: 'mama', name: 'มาม่า', price: 0 }, { id: 'glass', name: 'วุ้นเส้น', price: 0 }],
};

interface MockShop extends Omit<Shop, 'id'> { menus: MockMenu[] }

// Spread around มรภ.ชัยภูมิ (DEFAULT_CAMPUS_LOCATION 15.9303, 102.0156), all within about 1 km.
const MOCK_SHOPS: MockShop[] = [
  {
    name: 'ป้าศรี อาหารตามสั่ง', phone: '0898765432', category: 'food',
    address_detail: 'ซอยข้างหอพักพูนทรัพย์ ตรงข้ามประตู 1 มรภ.', location: { lat: 15.9318, lng: 102.0171 },
    delivery_fee: 10, delivery_radius_km: 2, allow_cod: true,
    menus: [
      ['ข้าวกะเพราหมูกรอบไข่ดาว', 55, 'food', [SPICE, EXTRA_EGG]],
      ['ข้าวผัดหมู', 45, 'food', [EXTRA_EGG]],
      ['ข้าวหมูกระเทียม', 50, 'food', [EXTRA_EGG]],
      ['ผัดซีอิ๊วหมู', 50, 'food'],
      ['ข้าวไข่เจียวหมูสับ', 40, 'food'],
      ['สุกี้น้ำทะเล', 60, 'food', [SPICE]],
      ['ชาดำเย็น', 20, 'drink_dessert', [SWEET]],
      ['น้ำเปล่า', 10, 'drink_dessert'],
    ],
  },
  {
    name: 'ส้มตำยายเพ็ญ ห้วยชัน', phone: '0812349999', category: 'food',
    address_detail: 'สามแยกห้วยชัน ใกล้ 7-Eleven', location: { lat: 15.9271, lng: 102.0122 },
    delivery_fee: 15, delivery_radius_km: 3, allow_cod: true,
    menus: [
      ['ส้มตำไทย', 40, 'food', [SPICE]],
      ['ส้มตำปูปลาร้า', 40, 'food', [SPICE]],
      ['ไก่ย่าง (ครึ่งตัว)', 80, 'food'],
      ['คอหมูย่าง', 70, 'food'],
      ['ลาบหมู', 60, 'food', [SPICE]],
      ['ข้าวเหนียว', 10, 'food'],
      ['ชาเขียวมะนาวเย็น', 25, 'drink_dessert', [SWEET]],
      ['น้ำแดงโซดา', 20, 'drink_dessert'],
    ],
  },
  {
    name: 'ก๋วยเตี๋ยวเรือลุงชัย', phone: '0861237788', category: 'food',
    address_detail: 'ริมถนนชัยภูมิ-ตาดโตน หน้าวัดนาฝาย', location: { lat: 15.9342, lng: 102.0138 },
    delivery_fee: 10, delivery_radius_km: 2, allow_cod: true,
    menus: [
      ['ก๋วยเตี๋ยวเรือหมู น้ำตก', 40, 'food', [NOODLE]],
      ['ก๋วยเตี๋ยวเรือเนื้อ', 50, 'food', [NOODLE]],
      ['เย็นตาโฟ', 45, 'food', [NOODLE]],
      ['ก๋วยเตี๋ยวต้มยำ', 45, 'food', [NOODLE, SPICE]],
      ['เกาเหลาหมู', 45, 'food'],
      ['แคบหมู', 20, 'food'],
      ['น้ำกระเจี๊ยบ', 20, 'drink_dessert'],
      ['น้ำลำไย', 20, 'drink_dessert'],
    ],
  },
  {
    name: 'ข้าวมันไก่เจ๊หมวย', phone: '0833456677', category: 'food',
    address_detail: 'ตลาดนัดหน้า มรภ. ล็อกที่ 3', location: { lat: 15.9296, lng: 102.0189 },
    delivery_fee: 0, delivery_radius_km: 1.5, allow_cod: true,
    menus: [
      ['ข้าวมันไก่ต้ม', 45, 'food', [EXTRA_EGG]],
      ['ข้าวมันไก่ทอด', 50, 'food'],
      ['ข้าวมันไก่ผสม', 55, 'food'],
      ['ข้าวหมูแดง', 50, 'food'],
      ['ข้าวหมูกรอบ', 55, 'food'],
      ['น้ำซุปไก่', 10, 'food'],
      ['น้ำเก๊กฮวย', 20, 'drink_dessert'],
      ['น้ำใบเตย', 20, 'drink_dessert'],
    ],
  },
  {
    name: 'ชานมไข่มุก ชัยภูมิสวีท', phone: '0865551234', category: 'drink_dessert',
    address_detail: 'ใต้หอพักนักศึกษาหญิง', location: { lat: 15.9327, lng: 102.0149 },
    delivery_fee: 10, delivery_radius_km: 2, allow_cod: true,
    menus: [
      ['ชานมไต้หวันไข่มุก', 35, 'drink_dessert', [SWEET, PEARL]],
      ['ชาเขียวมัทฉะนมสด', 45, 'drink_dessert', [SWEET, PEARL]],
      ['ชาไทยเย็น', 35, 'drink_dessert', [SWEET, PEARL]],
      ['โกโก้เย็น', 35, 'drink_dessert', [SWEET, PEARL]],
      ['นมสดบราวน์ชูการ์', 45, 'drink_dessert', [PEARL]],
      ['อเมริกาโน่เย็น', 40, 'drink_dessert', [SWEET]],
      ['วาฟเฟิลกรอบ', 35, 'drink_dessert'],
      ['เฟรนช์ฟรายส์', 39, 'food'],
    ],
  },
  {
    name: 'ปังปิ้งบิงซู บ้านน้องมิ้นท์', phone: '0957778899', category: 'both',
    address_detail: 'หน้าหอพักบ้านสวน ซอยนาฝาย 3', location: { lat: 15.9284, lng: 102.0163 },
    delivery_fee: 10, delivery_radius_km: 2, allow_cod: true,
    menus: [
      ['ปังปิ้งเนยนมน้ำตาล', 30, 'drink_dessert'],
      ['ปังปิ้งช็อกโกแลตกล้วย', 40, 'drink_dessert'],
      ['บิงซูสตรอว์เบอร์รี', 79, 'drink_dessert'],
      ['บิงซูชาไทย', 69, 'drink_dessert'],
      ['มาม่าผัดขี้เมาไข่ดาว', 45, 'food', [SPICE]],
      ['ไข่กระทะ', 49, 'food'],
      ['นมสดปั่นโอรีโอ', 45, 'drink_dessert', [SWEET]],
      ['นมชมพูเย็น', 30, 'drink_dessert', [SWEET]],
    ],
  },
];

export const MOCK_SHOP_COUNT = MOCK_SHOPS.length;

/** Deletes every demo shop and its menu, returning how many shops were removed. */
async function deleteMockShops() {
  const shops = (await getDocs(collection(db, 'shops'))).docs.filter(d => d.id.startsWith(MOCK_PREFIX));
  const ids = new Set(shops.map(d => d.id));
  const menus = (await getDocs(collection(db, 'menu_items'))).docs.filter(d => ids.has(d.data().shop_id));
  const refs = [...menus, ...shops].map(d => d.ref);
  // A batch takes at most 500 writes.
  for (let i = 0; i < refs.length; i += 450) {
    const batch = writeBatch(db);
    refs.slice(i, i + 450).forEach(ref => batch.delete(ref));
    await batch.commit();
  }
  return shops.length;
}

export async function removeMockShops() {
  return deleteMockShops();
}

/** Replaces all demo shops with the current set above. Admin only (rules enforce it). */
export async function replaceMockShops() {
  await deleteMockShops();
  const batch = writeBatch(db);
  MOCK_SHOPS.forEach(({ menus, ...shop }, s) => {
    const shopId = `${MOCK_PREFIX}${String(s + 1).padStart(2, '0')}`;
    batch.set(doc(db, 'shops', shopId), {
      ...shop,
      is_open: true,
      image_url: `/mock/shop${s + 1}-1.webp`,
      created_at: serverTimestamp(),
    });
    menus.forEach(([name, price, category, options], m) => {
      batch.set(doc(db, 'menu_items', `${shopId}_m${m + 1}`), {
        shop_id: shopId,
        name,
        price,
        category,
        // Panel 1 of each sheet is the shop front, so menu photos start at panel 2.
        image_url: `/mock/shop${s + 1}-${m + 2}.webp`,
        is_available: true,
        ...(options ? { option_groups: options } : {}),
        created_at: serverTimestamp(),
      });
    });
  });
  await batch.commit();
  return MOCK_SHOPS.length;
}
