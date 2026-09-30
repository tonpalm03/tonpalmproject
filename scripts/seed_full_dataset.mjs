import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDocs, deleteDoc, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBWZ3AAnjJ_kLyzHlSVRc6MC-mTs-oCK_8",
  authDomain: "tonpalmproject.firebaseapp.com",
  projectId: "tonpalmproject",
  storageBucket: "tonpalmproject.firebasestorage.app",
  messagingSenderId: "854984707571",
  appId: "1:854984707571:web:f68272e0e99545bb6e1686",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 10 Shops (Preserving the 2 existing shops, adding 8 realistic local stores)
const SHOPS = [
  {
    id: 'shop_1789538138172', // Existing shop for merchant รัชชานนท์
    name: 'ร้านดังแหมบ',
    phone: '089-111-2233',
    owner_uid: 'iqJfckGxsoY9WGrwBuH7AUGAV1i1',
    is_open: true,
    address_detail: 'ซอยข้าง มรภ. ชัยภูมิ (ตรงข้ามหอพักเพชรไพลิน)',
    rating: 4.9,
    review_count: 32,
    sales_count: 85,
    image_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'shop_1789402067972', // Existing shop for merchant ปาล์ม
    name: 'ส้มตำต้นปาล์ม',
    phone: '081-999-8877',
    owner_uid: 'RnsPqXQQ0rfosAjnfQWCL2ppDEM2',
    is_open: true,
    address_detail: 'สามแยกบ้านห้วยชัน ติดถนนใหญ่',
    rating: 5.0,
    review_count: 48,
    sales_count: 142,
    image_url: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'shop_mock_03',
    name: 'ป้าศรี กะเพราถาดยักษ์',
    phone: '086-234-5678',
    is_open: true,
    address_detail: 'หน้าประตู 2 มรภ. ชัยภูมิ',
    rating: 4.8,
    review_count: 27,
    sales_count: 96,
    image_url: 'https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'shop_mock_04',
    name: 'เตี๋ยวเรืออยุธยา หน้า มรภ.',
    phone: '087-345-6789',
    is_open: true,
    address_detail: 'ปากทางเข้าซอยหอพักบุษบา ห้วยชัน',
    rating: 4.9,
    review_count: 41,
    sales_count: 120,
    image_url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'shop_mock_05',
    name: 'ข้าวมันไก่เฮียชัย ห้วยชัน',
    phone: '088-456-7890',
    is_open: true,
    address_detail: 'ชุมชนห้วยชัน เยื้องเซเว่นหน้า ม.',
    rating: 4.7,
    review_count: 19,
    sales_count: 64,
    image_url: 'https://images.unsplash.com/photo-1525755662778-989d0524087e?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'shop_mock_06',
    name: 'ชาพะยอม & โทสต์เนยสด ห้วยชัน',
    phone: '089-567-8901',
    is_open: true,
    address_detail: 'ซอยหอพักร่มเย็น มรภ. ชัยภูมิ',
    rating: 4.9,
    review_count: 53,
    sales_count: 178,
    image_url: 'https://images.unsplash.com/photo-1541658016709-82535e94bc69?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'shop_mock_07',
    name: 'Cafe De Chaiyaphum กาแฟสด',
    phone: '090-678-9012',
    is_open: true,
    address_detail: 'หน้าอาคารเรียนรวม มรภ. ชัยภูมิ',
    rating: 4.8,
    review_count: 36,
    sales_count: 110,
    image_url: 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'shop_mock_08',
    name: 'ครัวคุณยาย อาหารตามสั่งริมหอ',
    phone: '091-789-0123',
    is_open: true,
    address_detail: 'หลัง มรภ. ชัยภูมิ ใกล้หอพักสุขใจ',
    rating: 4.9,
    review_count: 22,
    sales_count: 73,
    image_url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'shop_mock_09',
    name: 'น้ำเต้าหู้ ปาท่องโก๋ & บิงซูห้วยชัน',
    phone: '092-890-1234',
    is_open: true,
    address_detail: 'ตลาดเย็นชุมชนบ้านห้วยชัน',
    rating: 4.8,
    review_count: 30,
    sales_count: 88,
    image_url: 'https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=600&auto=format&fit=crop&q=80',
  },
  {
    id: 'shop_mock_10',
    name: 'วาฟเฟิลฮ่องกง & ชาผลไม้สด Fresh Tea',
    phone: '093-901-2345',
    is_open: true,
    address_detail: 'ทางเข้าศูนย์อาหาร มรภ. ชัยภูมิ',
    rating: 4.9,
    review_count: 45,
    sales_count: 135,
    image_url: 'https://images.unsplash.com/photo-1562376552-0d160a2f238d?w=600&auto=format&fit=crop&q=80',
  }
];

// Exactly 20 Food items
const FOOD_MENUS = [
  // ร้านดังแหมบ (3 อาหาร)
  {
    id: 'menu_food_01',
    shop_id: 'shop_1789538138172',
    name: 'ข้าวกะเพราหมูกรอบไข่ดาว',
    price: 55,
    category: 'food',
    image_url: 'https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=600&auto=format&fit=crop&q=80',
    is_available: true,
    options: [{ name: 'ไข่ดาวเพิ่ม', price: 10 }, { name: 'พิเศษเพิ่มข้าว', price: 10 }, { name: 'หมูกรอบพิเศษ', price: 20 }]
  },
  {
    id: 'menu_food_02',
    shop_id: 'shop_1789538138172',
    name: 'ข้าวผัดพริกแกงหมูชิ้น',
    price: 45,
    category: 'food',
    image_url: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=600&auto=format&fit=crop&q=80',
    is_available: true,
    options: [{ name: 'ไข่ดาว', price: 10 }, { name: 'ไข่เจียว', price: 10 }, { name: 'พิเศษ', price: 10 }]
  },
  {
    id: 'menu_food_03',
    shop_id: 'shop_1789538138172',
    name: 'ข้าวคะน้าหมูกรอบพริกสด',
    price: 55,
    category: 'food',
    image_url: 'https://images.unsplash.com/photo-1625944230945-1b7dd3b949ab?w=600&auto=format&fit=crop&q=80',
    is_available: true,
    options: [{ name: 'ไข่ดาว', price: 10 }, { name: 'พิเศษ', price: 10 }]
  },

  // ส้มตำต้นปาล์ม (4 อาหาร)
  {
    id: 'menu_food_04',
    shop_id: 'shop_1789402067972',
    name: 'ส้มตำปูปลาร้าแซ่บนัว',
    price: 40,
    category: 'food',
    image_url: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&auto=format&fit=crop&q=80',
    is_available: true,
    options: [{ name: 'เผ็ดมาก (พริก 10 เม็ด)', price: 0 }, { name: 'เผ็ดปานกลาง', price: 0 }, { name: 'เพิ่มกากหมูเจียว', price: 10 }, { name: 'ขนมจีน 1 จับ', price: 10 }]
  },
  {
    id: 'menu_food_05',
    shop_id: 'shop_1789402067972',
    name: 'ตำป่าถาดห้วยชันเครื่องแน่น',
    price: 60,
    category: 'food',
    image_url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop&q=80',
    is_available: true,
    options: [{ name: 'เพิ่มแคบหมู', price: 10 }, { name: 'เพิ่มไข่ต้ม', price: 10 }, { name: 'ข้าวเหนียวร้อนๆ', price: 10 }]
  },
  {
    id: 'menu_food_06',
    shop_id: 'shop_1789402067972',
    name: 'ไก่ย่างเขาสวนกวางครึ่งตัว',
    price: 70,
    category: 'food',
    image_url: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=600&auto=format&fit=crop&q=80',
    is_available: true,
    options: [{ name: 'น้ำจิ้มแจ่วรสเด็ด', price: 0 }, { name: 'ข้าวเหนียว', price: 10 }]
  },
  {
    id: 'menu_food_07',
    shop_id: 'shop_1789402067972',
    name: 'ลาบหมูคั่วข้าวคั่วหอม',
    price: 50,
    category: 'food',
    image_url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80',
    is_available: true,
    options: [{ name: 'ตับหมูเพิ่ม', price: 10 }, { name: 'ข้าวเหนียว', price: 10 }]
  },

  // ป้าศรี กะเพราถาดยักษ์ (3 อาหาร)
  {
    id: 'menu_food_08',
    shop_id: 'shop_mock_03',
    name: 'กะเพราหมูสับถาดยักษ์',
    price: 50,
    category: 'food',
    image_url: 'https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=600&auto=format&fit=crop&q=80',
    is_available: true,
    options: [{ name: 'ไข่ดาวกรอบ', price: 10 }, { name: 'ไข่เยี่ยวม้าทอด', price: 15 }, { name: 'พิเศษถาดยักษ์', price: 15 }]
  },
  {
    id: 'menu_food_09',
    shop_id: 'shop_mock_03',
    name: 'ข้าวผัดหมูโบราณใส่คะน้า',
    price: 45,
    category: 'food',
    image_url: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=600&auto=format&fit=crop&q=80',
    is_available: true,
    options: [{ name: 'ไข่ดาว', price: 10 }, { name: 'พิเศษ', price: 10 }]
  },
  {
    id: 'menu_food_10',
    shop_id: 'shop_mock_03',
    name: 'ข้าวหมูทอดกระเทียมพริกไทย',
    price: 45,
    category: 'food',
    image_url: 'https://images.unsplash.com/photo-1625944230945-1b7dd3b949ab?w=600&auto=format&fit=crop&q=80',
    is_available: true,
    options: [{ name: 'ไข่ดาว', price: 10 }, { name: 'กระเทียมเจียวเพิ่ม', price: 5 }]
  },

  // เตี๋ยวเรืออยุธยา หน้า มรภ. (3 อาหาร)
  {
    id: 'menu_food_11',
    shop_id: 'shop_mock_04',
    name: 'ก๋วยเตี๋ยวเรือน้ำตกหมูตุ๋น',
    price: 45,
    category: 'food',
    image_url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&auto=format&fit=crop&q=80',
    is_available: true,
    options: [{ name: 'เส้นเล็ก', price: 0 }, { name: 'เส้นหมี่', price: 0 }, { name: 'บะหมี่หยก', price: 0 }, { name: 'เพิ่มกากหมูเจียว', price: 10 }, { name: 'แคบหมู', price: 10 }]
  },
  {
    id: 'menu_food_12',
    shop_id: 'shop_mock_04',
    name: 'เส้นหมี่ต้มยำหมูมะนาวสด',
    price: 45,
    category: 'food',
    image_url: 'https://images.unsplash.com/photo-1559847844-5315695dadae?w=600&auto=format&fit=crop&q=80',
    is_available: true,
    options: [{ name: 'เพิ่มเกี๊ยวกรอบ', price: 10 }, { name: 'พิเศษหมูนุ่ม', price: 10 }]
  },
  {
    id: 'menu_food_13',
    shop_id: 'shop_mock_04',
    name: 'เกาเหลาบกหมูน้ำตกชามโต',
    price: 50,
    category: 'food',
    image_url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&auto=format&fit=crop&q=80',
    is_available: true,
    options: [{ name: 'ข้าวสวย 1 ถ้วย', price: 10 }, { name: 'กากหมูเจียว', price: 10 }]
  },

  // ข้าวมันไก่เฮียชัย ห้วยชัน (3 อาหาร)
  {
    id: 'menu_food_14',
    shop_id: 'shop_mock_05',
    name: 'ข้าวมันไก่ต้มสูตรเบตง',
    price: 45,
    category: 'food',
    image_url: 'https://images.unsplash.com/photo-1525755662778-989d0524087e?w=600&auto=format&fit=crop&q=80',
    is_available: true,
    options: [{ name: 'เนื้อน่องสะโพก', price: 0 }, { name: 'เนื้ออกล้วน', price: 0 }, { name: 'เพิ่มตับไก่', price: 10 }, { name: 'พิเศษเนื้อไก่', price: 15 }]
  },
  {
    id: 'menu_food_15',
    shop_id: 'shop_mock_05',
    name: 'ข้าวมันไก่ทอดกรอบซอสหวาน',
    price: 50,
    category: 'food',
    image_url: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=600&auto=format&fit=crop&q=80',
    is_available: true,
    options: [{ name: 'เพิ่มข้าวมัน', price: 10 }, { name: 'พิเศษไก่ทอด', price: 15 }]
  },
  {
    id: 'menu_food_16',
    shop_id: 'shop_mock_05',
    name: 'ข้าวมันไก่ผสม (ต้ม+ทอด)',
    price: 55,
    category: 'food',
    image_url: 'https://images.unsplash.com/photo-1525755662778-989d0524087e?w=600&auto=format&fit=crop&q=80',
    is_available: true,
    options: [{ name: 'เพิ่มข้าวมัน', price: 10 }, { name: 'เพิ่มน้ำซุปต้มยำ', price: 10 }]
  },

  // ครัวคุณยาย อาหารตามสั่ง (4 อาหาร)
  {
    id: 'menu_food_17',
    shop_id: 'shop_mock_08',
    name: 'ข้าวไข่ข้นกุ้งกระเทียม',
    price: 55,
    category: 'food',
    image_url: 'https://images.unsplash.com/photo-1559847844-5315695dadae?w=600&auto=format&fit=crop&q=80',
    is_available: true,
    options: [{ name: 'เพิ่มกุ้ง', price: 20 }, { name: 'พิเศษ', price: 10 }]
  },
  {
    id: 'menu_food_18',
    shop_id: 'shop_mock_08',
    name: 'ผัดซีอิ๊วหมูนุ่มเส้นใหญ่',
    price: 45,
    category: 'food',
    image_url: 'https://images.unsplash.com/photo-1559847844-5315695dadae?w=600&auto=format&fit=crop&q=80',
    is_available: true,
    options: [{ name: 'ไข่ดาว', price: 10 }, { name: 'พิเศษหมู', price: 15 }]
  },
  {
    id: 'menu_food_19',
    shop_id: 'shop_mock_08',
    name: 'ต้มยำกุ้งน้ำข้นราดข้าว',
    price: 60,
    category: 'food',
    image_url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80',
    is_available: true,
    options: [{ name: 'ไข่เจียว', price: 10 }, { name: 'เพิ่มกุ้ง', price: 20 }]
  },
  {
    id: 'menu_food_20',
    shop_id: 'shop_mock_08',
    name: 'ยำวุ้นเส้นหมูสับทะเลรวม',
    price: 60,
    category: 'food',
    image_url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop&q=80',
    is_available: true,
    options: [{ name: 'เผ็ดน้อย', price: 0 }, { name: 'เผ็ดแซ่บ', price: 0 }]
  }
];

// Exactly 20 Drink/Dessert items
const DRINK_MENUS = [
  // ร้านดังแหมบ (2 เครื่องดื่ม)
  {
    id: 'menu_drink_01',
    shop_id: 'shop_1789538138172',
    name: 'ชาไทยเย็นโบราณสูตรปักษ์ใต้',
    price: 30,
    category: 'drink_dessert',
    image_url: 'https://images.unsplash.com/photo-1558857563-b371033873b8?w=600&auto=format&fit=crop&q=80',
    is_available: true,
    options: [{ name: 'หวานปกติ (100%)', price: 0 }, { name: 'หวานน้อย (50%)', price: 0 }, { name: 'เพิ่มวิปครีม', price: 10 }]
  },
  {
    id: 'menu_drink_02',
    shop_id: 'shop_1789538138172',
    name: 'ชาเขียวนมสดมัทฉะแท้เย็น',
    price: 35,
    category: 'drink_dessert',
    image_url: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=600&auto=format&fit=crop&q=80',
    is_available: true,
    options: [{ name: 'หวานปกติ', price: 0 }, { name: 'หวาน 50%', price: 0 }, { name: 'เพิ่มไข่มุก', price: 5 }]
  },

  // ชาพะยอม & โทสต์เนยสด ห้วยชัน (4 เครื่องดื่ม/ขนม)
  {
    id: 'menu_drink_03',
    shop_id: 'shop_mock_06',
    name: 'ชานมไข่มุกไต้หวันบราวชูการ์',
    price: 35,
    category: 'drink_dessert',
    image_url: 'https://images.unsplash.com/photo-1541658016709-82535e94bc69?w=600&auto=format&fit=crop&q=80',
    is_available: true,
    options: [{ name: 'เพิ่มไข่มุกบราวชูการ์', price: 5 }, { name: 'พ่นไฟชีสเยิ้ม', price: 15 }]
  },
  {
    id: 'menu_drink_04',
    shop_id: 'shop_mock_06',
    name: 'โทสต์เนยสดคาราเมลไอศกรีม',
    price: 59,
    category: 'drink_dessert',
    image_url: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=600&auto=format&fit=crop&q=80',
    is_available: true,
    options: [{ name: 'ไอศกรีมวานิลลา', price: 0 }, { name: 'ไอศกรีมช็อกโกแลต', price: 0 }, { name: 'เพิ่มกล้วยหอม', price: 10 }]
  },
  {
    id: 'menu_drink_05',
    shop_id: 'shop_mock_06',
    name: 'ชาไทยวิปชีสพ่นไฟซิกเนเจอร์',
    price: 45,
    category: 'drink_dessert',
    image_url: 'https://images.unsplash.com/photo-1558857563-b371033873b8?w=600&auto=format&fit=crop&q=80',
    is_available: true,
    options: [{ name: 'หวาน 50%', price: 0 }, { name: 'หวาน 100%', price: 0 }]
  },
  {
    id: 'menu_drink_06',
    shop_id: 'shop_mock_06',
    name: 'นมสดคาราเมลเย็นเจลลี่บราวน์',
    price: 40,
    category: 'drink_dessert',
    image_url: 'https://images.unsplash.com/photo-1541658016709-82535e94bc69?w=600&auto=format&fit=crop&q=80',
    is_available: true,
    options: [{ name: 'เพิ่มบุกคริสตัล', price: 10 }]
  },

  // Cafe De Chaiyaphum (5 เครื่องดื่ม)
  {
    id: 'menu_drink_07',
    shop_id: 'shop_mock_07',
    name: 'กาแฟสดเอสเพรสโซ่เย็นเข้มข้น',
    price: 40,
    category: 'drink_dessert',
    image_url: 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=600&auto=format&fit=crop&q=80',
    is_available: true,
    options: [{ name: 'คั่วเข้ม', price: 0 }, { name: 'คั่วกลาง', price: 0 }, { name: 'เพิ่มช็อตกาแฟ', price: 15 }]
  },
  {
    id: 'menu_drink_08',
    shop_id: 'shop_mock_07',
    name: 'คาปูชิโน่เย็นฟองนมนุ่ม',
    price: 45,
    category: 'drink_dessert',
    image_url: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=600&auto=format&fit=crop&q=80',
    is_available: true,
    options: [{ name: 'หวาน 50%', price: 0 }, { name: 'หวานปกติ', price: 0 }]
  },
  {
    id: 'menu_drink_09',
    shop_id: 'shop_mock_07',
    name: 'สตอเบอรี่สมูทตี้โยเกิร์ตแท้',
    price: 45,
    category: 'drink_dessert',
    image_url: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=600&auto=format&fit=crop&q=80',
    is_available: true,
    options: [{ name: 'เพิ่มเนื้อสตอเบอรี่', price: 10 }, { name: 'วิปครีมฟู', price: 10 }]
  },
  {
    id: 'menu_drink_10',
    shop_id: 'shop_mock_07',
    name: 'มะม่วงปั่นสมูทตี้หวานฉ่ำ',
    price: 45,
    category: 'drink_dessert',
    image_url: 'https://images.unsplash.com/photo-1623065422902-30a2d299bbe4?w=600&auto=format&fit=crop&q=80',
    is_available: true,
    options: [{ name: 'เพิ่มเยลลี่มะม่วง', price: 10 }]
  },
  {
    id: 'menu_drink_11',
    shop_id: 'shop_mock_07',
    name: 'อเมริกาโน่น้ำส้มสดแท้ 100%',
    price: 50,
    category: 'drink_dessert',
    image_url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop&q=80',
    is_available: true,
    options: [{ name: 'ไม่หวาน', price: 0 }, { name: 'หวานน้อย', price: 0 }]
  },

  // น้ำเต้าหู้ ปาท่องโก๋ & บิงซูห้วยชัน (3 รายการ)
  {
    id: 'menu_drink_12',
    shop_id: 'shop_mock_09',
    name: 'น้ำเต้าหู้ทรงเครื่องโบราณ',
    price: 25,
    category: 'drink_dessert',
    image_url: 'https://images.unsplash.com/photo-1558857563-b371033873b8?w=600&auto=format&fit=crop&q=80',
    is_available: true,
    options: [{ name: 'ใส่เครื่องครบ (ลูกเดือย แมงลัก วุ้น)', price: 0 }, { name: 'ไม่ใส่น้ำตาล', price: 0 }]
  },
  {
    id: 'menu_drink_13',
    shop_id: 'shop_mock_09',
    name: 'ปาท่องโก๋ชุดนมข้นหวาน+สังขยาใบเตย',
    price: 30,
    category: 'drink_dessert',
    image_url: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=600&auto=format&fit=crop&q=80',
    is_available: true,
    options: [{ name: 'สังขยาใบเตย', price: 0 }, { name: 'นมข้นหวาน', price: 0 }]
  },
  {
    id: 'menu_drink_14',
    shop_id: 'shop_mock_09',
    name: 'บิงซูเมลอนนมสดเกาหลี',
    price: 79,
    category: 'drink_dessert',
    image_url: 'https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=600&auto=format&fit=crop&q=80',
    is_available: true,
    options: [{ name: 'เพิ่มนมข้นหวาน', price: 5 }, { name: 'เพิ่มคอนเฟลก', price: 5 }]
  },

  // วาฟเฟิลฮ่องกง & ชาผลไม้สด Fresh Tea (3 รายการ)
  {
    id: 'menu_drink_15',
    shop_id: 'shop_mock_10',
    name: 'ชาผลไม้รวมเสาวรสเลมอนสด',
    price: 40,
    category: 'drink_dessert',
    image_url: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&auto=format&fit=crop&q=80',
    is_available: true,
    options: [{ name: 'เพิ่มบุกวุ้น', price: 10 }, { name: 'หวาน 50%', price: 0 }]
  },
  {
    id: 'menu_drink_16',
    shop_id: 'shop_mock_10',
    name: 'ชาส้มยูซุฮันนี่โซดาซ่าสดชื่น',
    price: 45,
    category: 'drink_dessert',
    image_url: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&auto=format&fit=crop&q=80',
    is_available: true,
    options: [{ name: 'เพิ่มวุ้นอโลเวร่า', price: 10 }]
  },
  {
    id: 'menu_drink_17',
    shop_id: 'shop_mock_10',
    name: 'วาฟเฟิลฮ่องกงไส้ช็อกโกแลตชิพ',
    price: 39,
    category: 'drink_dessert',
    image_url: 'https://images.unsplash.com/photo-1562376552-0d160a2f238d?w=600&auto=format&fit=crop&q=80',
    is_available: true,
    options: [{ name: 'ราดซอสช็อกโกแลต', price: 5 }, { name: 'ราดซอสสตรอว์เบอร์รี', price: 5 }]
  },

  // เครื่องดื่มเสริมตามร้านอาหาร (3 รายการ)
  {
    id: 'menu_drink_18',
    shop_id: 'shop_mock_04',
    name: 'ชาดำเย็นมะนาวสดแท้',
    price: 25,
    category: 'drink_dessert',
    image_url: 'https://images.unsplash.com/photo-1558857563-b371033873b8?w=600&auto=format&fit=crop&q=80',
    is_available: true,
    options: [{ name: 'หวาน 50%', price: 0 }]
  },
  {
    id: 'menu_drink_19',
    shop_id: 'shop_mock_05',
    name: 'โอเลี้ยงยกล้อโบราณเข้มข้น',
    price: 25,
    category: 'drink_dessert',
    image_url: 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=600&auto=format&fit=crop&q=80',
    is_available: true,
    options: [{ name: 'หวานมัน', price: 0 }]
  },
  {
    id: 'menu_drink_20',
    shop_id: 'shop_mock_08',
    name: 'ลอดช่องสิงคโปร์น้ำกะทิสดหอมควันเทียน',
    price: 30,
    category: 'drink_dessert',
    image_url: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=600&auto=format&fit=crop&q=80',
    is_available: true,
    options: [{ name: 'เพิ่มขนุนฉีก', price: 5 }, { name: 'หวานน้อย', price: 0 }]
  }
];

async function seed() {
  console.log('Seeding 10 shops...');
  for (const s of SHOPS) {
    await setDoc(doc(db, 'shops', s.id), {
      name: s.name,
      phone: s.phone,
      is_open: s.is_open,
      address_detail: s.address_detail,
      rating: s.rating,
      review_count: s.review_count,
      sales_count: s.sales_count,
      image_url: s.image_url,
      ...(s.owner_uid ? { owner_uid: s.owner_uid } : {}),
      created_at: new Date().toISOString(),
    }, { merge: true });
    console.log(`✓ Shop: ${s.name} (${s.id})`);
  }

  console.log('\nCleaning old menu items to ensure clean 40 count...');
  const oldSnap = await getDocs(collection(db, 'menu_items'));
  for (const d of oldSnap.docs) {
    await deleteDoc(doc(db, 'menu_items', d.id));
  }
  console.log(`Removed ${oldSnap.size} old menu items.`);

  console.log(`\nSeeding 20 Food items...`);
  for (const m of FOOD_MENUS) {
    await setDoc(doc(db, 'menu_items', m.id), {
      shop_id: m.shop_id,
      name: m.name,
      price: m.price,
      category: m.category,
      image_url: m.image_url,
      is_available: m.is_available,
      options: m.options,
      created_at: new Date().toISOString(),
    });
    console.log(`  🍲 Food: ${m.name} [${m.price}฿]`);
  }

  console.log(`\nSeeding 20 Drink/Dessert items...`);
  for (const m of DRINK_MENUS) {
    await setDoc(doc(db, 'menu_items', m.id), {
      shop_id: m.shop_id,
      name: m.name,
      price: m.price,
      category: m.category,
      image_url: m.image_url,
      is_available: m.is_available,
      options: m.options,
      created_at: new Date().toISOString(),
    });
    console.log(`  🧋 Drink: ${m.name} [${m.price}฿]`);
  }

  console.log(`\nSUCCESS: 10 shops, 40 menus (20 foods, 20 drinks) seeded cleanly!`);
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
