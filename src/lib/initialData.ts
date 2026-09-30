import { Shop, MenuItem } from '@/types';

export const INITIAL_SHOPS: Shop[] = [
  {
    id: 'shop_1',
    owner_uid: 'user_merchant_1',
    name: 'ป้าศรี กะเพราถาดยักษ์ (หน้า มรภ.)',
    phone: '0898765432',
    is_open: true,
    image_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500&auto=format&fit=crop&q=80',
    address_detail: 'ซอยข้างหอพักพูนทรัพย์ ตรงข้ามประตู 1 มรภ. ชัยภูมิ',
  },
  {
    id: 'shop_2',
    owner_uid: 'user_merchant_2',
    name: 'ส้มตำแซ่บนัว ยายเพ็ญ ห้วยชัน',
    phone: '0812349999',
    is_open: true,
    image_url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&auto=format&fit=crop&q=80',
    address_detail: 'สามแยกห้วยชัน ใกล้ 7-Eleven',
  },
  {
    id: 'shop_3',
    owner_uid: 'user_merchant_3',
    name: 'ชานมไข่มุก & ปังปิ้ง ชัยภูมิสวีท',
    phone: '0865551234',
    is_open: true,
    image_url: 'https://images.unsplash.com/photo-1541658016709-82535e94bc69?w=500&auto=format&fit=crop&q=80',
    address_detail: 'ใต้หอพักนักศึกษาหญิง',
  },
];

export const INITIAL_MENU_ITEMS: MenuItem[] = [
  // Shop 1: ป้าศรี กะเพราถาด
  {
    id: 'm_1',
    shop_id: 'shop_1',
    name: 'ข้าวกะเพราหมูกรอบไข่ดาว',
    price: 55,
    category: 'food',
    image_url: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=300&auto=format&fit=crop&q=80',
    is_available: true,
  },
  {
    id: 'm_2',
    shop_id: 'shop_1',
    name: 'ข้าวผัดต้มยำทะเลรวมมิตร',
    price: 60,
    category: 'food',
    image_url: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=300&auto=format&fit=crop&q=80',
    is_available: true,
  },
  {
    id: 'm_3',
    shop_id: 'shop_1',
    name: 'ข้าวหมูกระเทียมพริกไทย',
    price: 50,
    category: 'food',
    image_url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&auto=format&fit=crop&q=80',
    is_available: true,
  },

  // Shop 2: ส้มตำแซ่บนัว ยายเพ็ญ
  {
    id: 'm_4',
    shop_id: 'shop_2',
    name: 'ส้มตำปูปลาร้า (พริก 5 เม็ด)',
    price: 45,
    category: 'food',
    image_url: 'https://images.unsplash.com/photo-1559847844-5315695dadae?w=300&auto=format&fit=crop&q=80',
    is_available: true,
  },
  {
    id: 'm_5',
    shop_id: 'shop_2',
    name: 'ไก่ย่างสมุนไพรพร้อมข้าวเหนียว',
    price: 60,
    category: 'food',
    image_url: 'https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=300&auto=format&fit=crop&q=80',
    is_available: true,
  },
  {
    id: 'm_6',
    shop_id: 'shop_2',
    name: 'ต้มแซ่บกระดูกอ่อน',
    price: 70,
    category: 'food',
    image_url: 'https://images.unsplash.com/photo-1547928576-a4a33237cbc3?w=300&auto=format&fit=crop&q=80',
    is_available: true,
  },

  // Shop 3: ชานมไข่มุก & ปังปิ้ง
  {
    id: 'm_7',
    shop_id: 'shop_3',
    name: 'ชานมไต้หวันไข่มุกลาวา (หวานน้อย)',
    price: 35,
    category: 'drink_dessert',
    image_url: 'https://images.unsplash.com/photo-1558857563-b37cf006a86c?w=300&auto=format&fit=crop&q=80',
    is_available: true,
  },
  {
    id: 'm_8',
    shop_id: 'shop_3',
    name: 'ชาเขียวมัทฉะนมสดเย็น',
    price: 40,
    category: 'drink_dessert',
    image_url: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=300&auto=format&fit=crop&q=80',
    is_available: true,
  },
  {
    id: 'm_9',
    shop_id: 'shop_3',
    name: 'ปังปิ้งเนยนม-ช็อกโกแลต (2 แผ่น)',
    price: 30,
    category: 'drink_dessert',
    image_url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300&auto=format&fit=crop&q=80',
    is_available: true,
  },
];
