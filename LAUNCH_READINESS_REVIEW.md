# ผลตรวจความพร้อมเปิดระบบ

อัปเดตล่าสุด: 17 กันยายน 2026 (Asia/Bangkok)

**ข้อสรุป: ข้อ 1 (Backend Checkout & GP Security), ข้อ 2 (Production Deploy & IAM Fix) และ ข้อ 3 (Android Signed Release APK) ดำเนินการและผ่านการตรวจสอบเรียบร้อยแล้ว** ปัจจุบันพร้อมสำหรับการทดสอบ Acceptance Testing บนอุปกรณ์จริง (ข้อ 4) ก่อนเปิดใช้งาน Pilot

---

## 📊 หลักฐานที่ตรวจและผลการทดสอบล่าสุด

| การตรวจ | ผล | รายละเอียด |
|---|---|---|
| **Production Build และ TypeScript** | ✅ ผ่าน | Next.js 16.3.5 Turbopack คอมไพล์ Static Pages 7/7 หน้าสำเร็จ 0 errors |
| **Functions Unit Tests** | ✅ ผ่าน 20/20 | badge (5), line-identity (3), complete-order (6), checkout-order (6) |
| **Sales Summary Tests** | ✅ ผ่าน 2/2 | ตรวจสอบการนับยอดขายตามเขตเวลา Asia/Bangkok |
| **Release Gates (Readiness)** | ✅ ผ่าน 3/3 | ตรวจสอบการปลอมราคา, การข้าม GP, และการสั่งซื้อซ้ำ ถูกปฏิเสธ 100% |
| **Firestore Security Rules Tests** | ✅ ผ่าน 16/16 | ครอบคลุมกฎความปลอดภัยทุกระดับบน Emulator |
| **Production Cloud Functions Deploy** | ✅ ผ่าน 6/6 | deploy บน `us-central1` พร้อม `invoker: public` |
| **Production Firestore Rules Deploy** | ✅ ผ่าน | deploy กฎความปลอดภัยชุดล่าสุดขึ้น Cloud Firestore แล้ว |
| **Production Web Hosting Deploy** | ✅ ผ่าน | deploy ขึ้น `https://tonpalmproject.web.app` และ `https://huaychan.web.app` |
| **Production Endpoints Smoke Test** | ✅ ผ่าน 6/6 | ไม่มีฟังก์ชันไหนติด HTTP 403 Forbidden อีกต่อไป (ทุกตัวตอบ 401 JSON ตามมาตรฐานเมื่อไม่มี Auth) |
| **Android Signed Release APK** | ✅ ผ่าน | `huaychan-release-1.0.2.apk` (v1.0.2, code 3) เซ็นด้วย Keystore สมบูรณ์ |

---

## 🔍 ผลการทดสอบ Live Endpoints บนระบบจริง

| Function | ผลการทดสอบก่อนแก้ | ผลการทดสอบปัจจุบัน |
|---|---|---|
| `signInWithLine` | 401 JSON | ✅ 401 JSON (พร้อมทำงาน) |
| `reserveOrderNumbers` | 401 JSON | ✅ 401 JSON (พร้อมทำงาน) |
| `completeOrder` | 401 JSON | ✅ 401 JSON (พร้อมทำงาน) |
| `notifyNewOrder` | 403 HTML (IAM Error) | ✅ 401 JSON (แก้สิทธิ์สำเร็จ) |
| `topUpMerchantCredit` | 403 HTML (IAM Error) | ✅ 401 JSON (แก้สิทธิ์สำเร็จ) |
| `checkoutOrder` (ใหม่) | - | ✅ 401 JSON (พร้อมทำงาน) |

---

## 🚀 ประเด็นที่ปิดแล้ว

1. ✅ **ราคาและ GP เป็น Authoritative จาก Server**: ย้ายระบบสั่งซื้อไปที่ `checkoutOrder` Cloud Function อ่านราคาจริงจาก `menu_items` และปิด Direct Create จาก Client
2. ✅ **ป้องกันการบายพาสการจบออเดอร์และ GP**: บังคับให้การจบออเดอร์ต้องผ่าน `completeOrder` เท่านั้น
3. ✅ **Idempotency Protection**: มี `idempotency_key` ตรวจจับคำขอเดิมไม่ให้สร้างออเดอร์ซ้ำ
4. ✅ **แก้ปัญหา HTTP 403 Forbidden บน Production**: จัดการ IAM Policy `allUsers` ของ Cloud Functions สำเร็จ
5. ✅ **สิทธิ์ความจริงแหล่งเดียว**: ใช้ `/access/{uid}` เป็น authoritative source สำหรับบทบาทผู้ใช้
6. ✅ **Android Signed Release Package**: สร้าง Keystore ถาวร (`release.keystore`), ตั้งค่า Gradle Signing, และคอมไพล์ APK Signed Release เวอร์ชัน 1.0.2

---

## 📌 งานที่ต้องทำในขั้นตอนต่อไป

1. **ข้อที่ 4: Field Acceptance Testing (ทดสอบระบบจริง 2 เครื่อง)**:
   - นำไฟล์ `huaychan-release-1.0.2.apk` ติดตั้งบนมือถือฝั่งร้านค้า
   - เครื่องลูกค้า: เข้าเว็บ `https://huaychan.web.app` เลือกสินค้า สั่งซื้อจริง
   - ตรวจสอบ: การแจ้งเตือน Push Notification / เสียงเตือน / ปุ่มลอย Floating Bubble ฝั่งร้านค้า
   - ทดสอบร้านค้ากดรับออเดอร์ และกดจบออเดอร์ -> ตรวจสอบการตัดเครดิต GP และยอดขายในแดชบอร์ด
2. **ข้อที่ 5: Pilot Rollout**:
   - เปิดให้ร้านค้าจริง 1–2 ร้านแรกใช้งานในพื้นที่ห้วยชัน
   - เฝ้าระวังระบบ Real-time ในวันแรก
