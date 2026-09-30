# 📌 สรุป Flow ระบบ และ แผนพัฒนา โครงการ "ห้วยชันหิวข้าว" (Huai Chan Hiu Khao)

> **แผนหลักก่อนเปิดใช้จริง (อัปเดต 16 ก.ย. 2026):** อ่าน [PROJECT_READINESS_PLAN.md](./PROJECT_READINESS_PLAN.md) ก่อนทำงานต่อ แก้ 5 เรื่องตามลำดับ เริ่มจากสิทธิ์ฐานข้อมูล/ยืนยันตัวตน เอกสารนั้นมีสถานะล่าสุด เกณฑ์ทดสอบ และบันทึกส่งต่อ AI; รายการฟีเจอร์ด้านล่างไม่ใช่หลักฐานว่าผ่านการทดสอบ production แล้ว

> **จุดประสงค์เอกสาร:** บันทึก Flow การทำงาน, โครงสร้างฐานข้อมูล (Firestore), สิทธิ์ผู้ใช้ และแผนงาน เพื่อส่งมอบให้ผู้พัฒนาหรือ AI ตัวอื่นสามารถพัฒนาต่อยอดได้ทันที

---

## 1. ข้อมูลภาพรวมโครงการ (Project Overview)
- **ชื่อระบบ:** ห้วยชันหิวข้าว (Huai Chan Hiu Khao)
- **กลุ่มเป้าหมาย:** นักศึกษาและบุคลากร มหาวิทยาลัยราชภัฏชัยภูมิ (มรภ.ชัยภูมิ) และชาวบ้านชุมชนห้วยชัน ต.นาฝาย อ.เมือง จ.ชัยภูมิ
- **โมเดลธุรกิจหลัก:**
  - **ร้านค้าส่งเอง (Merchant Self-Delivery):** ร้านค้าทำหน้าที่ปรุงอาหารและขี่รถไปส่งให้ลูกค้าด้วยตนเอง (หรือให้คนของร้านไปส่ง)
  - **ค่าส่งคงที่:** อัตราเหมา **10 บาท/ออเดอร์** เข้ากระเป๋าร้านค้า/คนส่งทั้งหมด
  - **การชำระเงิน:** จ่ายเงินสดปลายทาง (Cash on Delivery) หรือ สแกนจ่ายพร้อมเพย์ปลายทางกับคนส่งโดยตรง
  - **รายได้แพลตฟอร์ม (GP):** หัก 5% จากยอดค่าอาหาร (ไม่รวมค่าส่ง 10 บ.) รวบยอดตัดรอบสัปดาห์ทุกวันอาทิตย์
- **Production Hosting:** `https://tonpalmproject.web.app` (Firebase Hosting)
- **Firebase Project ID:** `tonpalmproject`
- **LINE LIFF ID:** `2011320201-5sBLbtx2`

---

## 2. Tech Stack
- **Frontend / Fullstack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Lucide React (Icons)
- **Backend / Database:** Google Cloud Firebase
  - **Firebase Authentication:** LINE LIFF Login & Email/Password Mock/Auth
  - **Cloud Firestore:** Real-time database (onSnapshot) สำหรับร้านค้า, เมนู, ออเดอร์, แชท, รีวิว, ผู้ใช้
  - **Firebase Hosting:** Global CDN สำหรับ Fast Delivery
- **Maps & Location:** Leaflet (OpenStreetMap) แบบ Dynamic import (SSR safe) + Custom SVG/HTML divIcon + HTML5 Geolocation API
- **Audio / Media:** Web Audio API (Synthesizer Chime สำหรับเสียงกริ่งเตือนออเดอร์ใหม่โดยไม่ต้องพึ่งไฟล์ mp3 ภายนอก) + HTML5 Canvas สำหรับบีบอัดรูปภาพเมนูอาหาร (Base64 JPEG 500px)

---

## 3. สิทธิ์ผู้ใช้งาน (Roles & Authentication)
ระบบแบ่งผู้ใช้ออกเป็น 3 ระดับ โดยผูกกับ LINE User ID / UID:

1. **`customer` (ลูกค้าทั่วไป / นักศึกษา):**
   - ดูฟีดร้านค้าที่จัดอันดับตามความนิยม (ยอดขายสูงสุด และ คะแนนดาวสูงสุดขึ้นก่อน)
   - ปักหมุดพิกัดจัดส่งบนแผนที่ Leaflet (ซูม/ลากหมุด/ระบุหอพัก/ห้อง)
   - สั่งอาหารพร้อมกันได้หลายร้านในตะกร้าเดียว (Multi-Shop Cart): รวมสินค้าและจัดกลุ่มตามร้านค้า คำนวณค่าส่งเหมา 10 บาทต่อร้าน (เข้าร้านค้าผู้จัดส่ง)
   - ติดตามสถานะออเดอร์แบบ Real-time แยกตามร้านค้า (Multi-Shop Tabs): มีสเต็ปสถานะ ปุ่มโทรหาร้าน และแชทสองทางเฉพาะร้านนั้นๆ
   - ให้คะแนน (1-5 ดาว) และเขียนรีวิวร้านค้า พร้อม Tag ชมด่วนเมื่อได้รับอาหารแต่ละร้านเรียบร้อย

2. **`merchant` (ร้านค้าชุมชน):**
   - เปิด-ปิดร้านค้า (Real-time Toggle)
   - มีเสียงกริ่งกระดิ่งแจ้งเตือนทันทีเมื่อมีออเดอร์ใหม่เข้า
   - ปุ่มเปลี่ยนสถานะออเดอร์: `รับออเดอร์ (เริ่มทำ)` ➔ `ปรุงเสร็จแล้ว กำลังออกไปส่ง` ➔ `ส่งถึงมือแล้ว + รับเงินเรียบร้อย` (ระบบจะนับยอดขาย `sales_count` เพิ่มให้อัตโนมัติ)
   - นำทางไปยังหมุดลูกค้าด้วย Google Maps 1-Click
   - แชทสองทางกับลูกค้าเพื่อสอบถามทางหรือยืนยันคำสั่งซื้อ
   - จัดการเมนู: เพิ่มเมนูใหม่, ถ่ายรูป/อัปโหลดรูปอาหารจากกล้องและมือถือ (บีบอัดอัตโนมัติ), สลับสถานะของหมด (Out of Stock), ลบเมนู
   - สรุปยอดขาย: ยอดขายค่าอาหาร, ค่าส่งที่ได้รับ (10 บ. x จำนวนออเดอร์), ยอด GP 5% ที่ต้องโอนให้ระบบทุกวันอาทิตย์

3. **`admin` (ผู้ดูแลระบบ):**
   - ค้นหาผู้ใช้ด้วย **เบอร์โทรศัพท์** หรือ ชื่อ
   - กรองดูผู้ใช้ตามยศ: ทั้งหมด, ลูกค้า, ร้านค้า, แอดมิน
   - ปรับเปลี่ยนยศผู้ใช้ (แต่งตั้งเป็นร้านค้า หรือ แอดมิน)
   - ลบบัญชีผู้ใช้ใดๆ ออกจากระบบ (🗑️ ลบบัญชี)
   - ตั้งค่า GP ระบบ และ ค่าจัดส่งมาตรฐาน

---

## 4. โครงสร้างฐานข้อมูล Firestore (Database Collections)

### 1) Collection: `shops` (ร้านค้า)
```typescript
{
  id: string;              // เช่น "shop_1"
  name: string;            // ชื่อร้าน เช่น "ป้าพร ตามสั่ง & กะเพราถาดยักษ์"
  category: string;        // "food" | "drink_dessert"
  image_url: string;       // URL หรือ Base64 รูปภาพหน้าร้าน
  phone: string;           // เบอร์ติดต่อร้าน
  address_detail: string;  // ที่อยู่/พิกัด เช่น "ซอย 3 หน้า มรภ.ชัยภูมิ"
  location?: { lat: number; lng: number }; // พิกัด GPS
  is_open: boolean;        // เปิด-ปิดรับออเดอร์
  sales_count: number;     // ยอดขายสะสม (ใช้อันดับฟีด)
  rating: number;          // คะแนนเฉลี่ย 1.0 - 5.0
  review_count: number;    // จำนวนรีวิวทั้งหมด
  owner_uid?: string;      // UID ผู้ใช้ที่เป็นเจ้าของร้าน
}
```

### 2) Collection: `menu_items` (รายการเมนู)
```typescript
{
  id: string;              // Auto ID
  shop_id: string;         // ID ร้านค้าที่สังกัด
  name: string;            // ชื่อเมนู เช่น "ข้าวกะเพราหมูกรอบไข่ดาว"
  price: number;           // ราคาบาท เช่น 50
  category: "food" | "drink_dessert";
  image_url?: string;      // URL รูปภาพอาหาร หรือ Data URL
  is_available: boolean;   // มีของ / ของหมด
  created_at: Timestamp;
}
```

### 3) Collection: `orders` (คำสั่งซื้อ)
```typescript
{
  id: string;              // Auto ID
  customer_uid: string;
  customer_name: string;
  customer_phone: string;
  shop_id: string;
  shop_name: string;
  shop_phone: string;
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
    note?: string;
  }>;
  food_subtotal: number;   // รวมค่าอาหาร
  delivery_fee: number;    // 10 บาท
  total_amount: number;    // food_subtotal + 10
  payment_method: 'cash' | 'promptpay';
  cash_change_note?: string; // เช่น "เตรียมเงินทอนแบงค์ 500"
  delivery_address: string;  // ที่อยู่จัดส่ง เช่น "หอสุขใจ ห้อง 304"
  location?: { lat: number; lng: number }; // พิกัด GPS หมุดลูกค้า
  status: 'pending' | 'cooking' | 'delivering' | 'completed' | 'cancelled';
  created_at: Timestamp;
  completed_at?: Timestamp;
}
```

### 4) Collection: `chats` (แชทสนทนาระหว่างร้านและลูกค้า)
```typescript
{
  id: string;
  order_id: string;
  sender_uid: string;
  sender_name: string;
  sender_role: 'customer' | 'merchant' | 'admin';
  text: string;
  created_at: Timestamp;
}
```

### 5) Collection: `shop_reviews` (คะแนนและรีวิว)
```typescript
{
  id: string;
  shop_id: string;
  order_id?: string;
  customer_uid: string;
  customer_name: string;
  customer_avatar?: string;
  rating: number;          // 1 ถึง 5 ดาว
  comment: string;         // ข้อความรีวิว
  created_at: Timestamp;
}
```

### 6) Collection: `users` & `admins` (ผู้ใช้และแอดมิน)
- `users/{uid}`: `{ uid, display_name, phone, role, line_user_id, picture_url, created_at }`
- `admins/{adminId}`: `{ line_user_id, note, updated_at }`

---

## 5. ฟีเจอร์สำคัญที่ทำเสร็จแล้วล่าสุด (Recent Completed Implementations)
1. **ระบบสั่งพร้อมกันหลายร้าน (Multi-Shop Cart & Checkout):**
   - ลูกค้าสามารถกดสั่งอาหารจากหลายร้านค้าพร้อมกันลงในตะกร้าเดียวได้
   - คำนวณค่าส่งเหมา 10 บ. ต่อร้านค้าโดยอัตโนมัติ (เช่น สั่ง 2 ร้าน ค่าส่งรวม 20 บ.)
   - เมื่อกดยืนยันสั่งซื้อ ระบบจะแตกรายการสั่งซื้อเป็น Document แยกตามร้านค้าใน Firestore พร้อมระบุ `group_id` เดียวกัน
   - ลูกค้าสามารถสลับแถบดูสถานะออเดอร์ของแต่ละร้านได้พร้อมกัน โทรหา หรือแชทกับร้านค้าแต่ละร้านได้อย่างอิสระ
2. **เครื่องมือตัดขอบรูปภาพอิสระ (Custom Image Cropper - `ImageCropModal`):**
   - ยกเลิกปุ่มรูปอาหารสำเร็จรูปยอดนิยมทั้งหมดตามคำขอ
   - มีระบบตัดขอบรูปภาพ (Image Crop) ในตัว: สามารถลากเลื่อน (Pan/Drag), เลื่อนแถบซูมเข้า-ออก (Zoom 0.6x - 3x), หมุนภาพ 90 องศา และเลือกสัดส่วนได้ (1:1, 4:3, 16:9)
   - รองรับการใช้งานผ่านมือถือ (Touch Gestures) และคอมพิวเตอร์ (Mouse Drag)
3. **การใส่และเปลี่ยนรูปภาพหน้าร้าน (Storefront Cover Photo):**
   - **สำหรับร้านค้า (Merchant):** กดปุ่ม `📸 เปลี่ยนรูปหน้าร้าน` บนแบนเนอร์ด้านบนสุด หรือไปที่แท็บ `🏪 ข้อมูลร้าน` แล้วเลือกรูป ➔ ระบบจะเปิดตัวตัดขอบ 16:9 ให้ปรับแต่ง ➔ บันทึกลง Firestore `shops/{shopId}.image_url` ทันที
   - **สำหรับผู้ดูแลระบบ (Admin):** มีแท็บ `🏪 จัดการร้านค้า` ใน Admin Dashboard สามารถดูร้านค้าทั้งหมด และกดปุ่ม `📸 เปลี่ยนรูปหน้าร้าน` เพื่อแก้ไขรูปของร้านใดก็ได้ในระบบทันที
4. **ตัวเลือกหมวดหมู่เมนูในร้าน (Menu Category Filter):**
   - หน้าดูเมนูของลูกค้า (`ShopDetailModal`): เพิ่มแท็บ `ทั้งหมด`, `🍲 อาหาร`, `🧋 น้ำ/ของหวาน` พร้อมช่องค้นหาชื่อเมนู
   - หน้าร้านค้า (`MerchantDashboard`): เพิ่มแถบกรองประเภทเมนูเช่นเดียวกัน
5. **ระบบจัดเก็บออเดอร์และแยกสถานะ (Order Archiving & Separation):**
   - ในหน้าร้านค้า แยกแท็บย่อยระหว่าง **`🛵 กำลังทำ`** (แสดงเฉพาะออเดอร์ที่รอดำเนินการ `pending`, `cooking`, `delivering`) กับ **`📦 ส่งสำเร็จ`** (ออเดอร์ที่จัดส่งเสร็จแล้ว `completed`)
   - เมื่อร้านค้ากด *"ส่งถึงมือแล้ว + รับเงินเรียบร้อย"* ออเดอร์จะย้ายออกจากหน้ารับงานปัจจุบันไปเก็บไว้ในแท็บประวัติโดยอัตโนมัติ ทำให้หน้าจอทำงานจริงสะอาด ชัดเจน ไม่ปะปนกับออเดอร์เก่า พร้อมรับออเดอร์ใหม่เสมอ
6. **ระบบดู Log ออเดอร์ย้อนหลัง & ส่งออกรายงาน Excel/CSV (Order Monitoring & Export):**
   - ในหน้าแอดมิน (`AdminDashboard.tsx`) เพิ่มแท็บ `มอนิเตอร์ & Log`
   - กรองสถานะออเดอร์ (`ทั้งหมด`, `สด/กำลังทำ`, `สำเร็จ`, `ยกเลิก`)
   - ตัวกรองวันย้อนหลัง: ปุ่มลัด `ทั้งหมด`, `วันนี้`, `เมื่อวาน`, `7 วันล่าสุด` และช่องปฏิทินเลือกวันแบบเจาะจง (`<input type="date" />`)
   - ค้นหาอัจฉริยะ (ค้นหาด้วยรหัส, ชื่อลูกค้า, เบอร์โทร, ร้านค้า, เมนู)
   - ปุ่ม **"โหลด CSV"** ส่งออกไฟล์ Excel รองรับภาษาไทย UTF-8 BOM ทันที
7. **ระบบจัดการพื้นที่ Database & ล้างแชทเก่า (Storage Maintenance & Chat Cleanup):**
   - ปุ่ม **"🧹 ล้างแชทเก่า"** ในหน้าแอดมิน
   - ลบเฉพาะข้อความแชทคุยระหว่างทาง (`orders/{orderId}/messages`) ที่จบงานแล้ว
   - เลือกระยะเวลาได้: เก่ากว่า 30 วัน (แนะนำ), 60 วัน, 90 วัน หรือทั้งหมด
   - **ความปลอดภัย 100%:** ข้อมูลยอดขาย บิลซื้อขาย รายการอาหาร และประวัติทางบัญชี GP 5% จะคงอยู่ถาวร ไม่ถูกแตะต้อง

---

## 6. แผนพัฒนาต่อยอด (Future Roadmap for Next AI)
1. **Push Notifications via LINE Official Account (LINE Messaging API):**
   - ส่งข้อความ Flex Message เตือนลูกค้าเมื่อร้านกด "กำลังออกไปส่ง"
   - ส่งข้อความเตือนร้านค้าผ่าน Webhook เมื่อมีออเดอร์ใหม่
2. **Dynamic Delivery Zone / Geofence:**
   - ตรวจสอบระยะทางรัศมี 3-5 กิโลเมตรรอบ มรภ.ชัยภูมิ และชุมชนห้วยชัน
3. **Weekly Billing & Slip Upload for GP:**
   - ระบบแนบสลิปโอนเงินค่า GP 5% ทุกวันอาทิตย์สำหรับร้านค้า และหน้าจอตรวจสอบสลิปของแอดมิน (เชื่อมโยงสำเร็จใน Merchant & Admin Dashboard แล้ว)
4. **Cloudflare R2 / Firebase Storage Integration:**
   - ปัจจุบันเก็บแบบ Base64 Data URL (JPEG 500px คุณภาพ 0.82) เพื่อความเสถียรและไม่ต้องตั้งค่า Rules หากต้องการจัดเก็บรูปขนาดใหญ่มากๆ สามารถต่อ R2 หรือ Firebase Storage เพิ่มได้
