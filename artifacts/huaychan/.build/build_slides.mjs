import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {Presentation,PresentationFile} from '@oai/artifact-tool';
const root='D:/tonpalmproject/artifacts/huaychan';
const skill='C:/Users/LENOVO/.codex/plugins/cache/openai-primary-runtime/presentations/26.909.12148/skills/presentations';
const {finalizePresentation}=await import(pathToFileURL(skill+'/container_tools/artifact_tool_utils.mjs'));
const presentation=Presentation.create({slideSize:{width:1280,height:720}});
const slides=[
['huaychan','ระบบสั่งอาหารของร้านค้าในชุมชน','รัชชานนท์ ผมไผ  •  681102118\nสาขาวิทยาการคอมพิวเตอร์\nมหาวิทยาลัยราชภัฏชัยภูมิ\n\nเสนอต่อ อาจารย์ ฤทธิชัย ผานาค','สวัสดีครับ ผมรัชชานนท์ ผมไผ วันนี้ขอนำเสนอโครงงาน huaychan ซึ่งเริ่มจากร้านอาหารและเครื่องดื่มใกล้บ้านที่โพสต์ขายบน Facebook ผมอยากช่วยให้คนในชุมชนหาร้านและสั่งซื้อได้สะดวกขึ้น โดยร้านยังขาย รับเงิน และส่งเอง ใช้เวลานำเสนอประมาณ 15–20 นาที'],
['ที่มาของโครงงาน','ปัญหาที่พบใกล้ตัว','เดิมให้เลือกศึกษาโครงงานจากมหาวิทยาลัยไทย\nยังไม่พบหัวข้อที่ตรงกับความสนใจ\nจึงพิจารณาร้านใกล้บ้านที่โพสต์ขายอาหารทุกวัน','อธิบายที่มาด้วยประสบการณ์ที่ผู้จัดทำให้ไว้ ไม่อ้างว่าได้สำรวจร้านทั้งชุมชนหรือได้รับอนุมัติเปลี่ยนหัวข้อแล้ว จุดเริ่มต้นคือการมองเห็นงานจริงที่อยากช่วยแก้ และนำเสนอขอบเขตให้ตรงกับรายวิชา'],
['ปัญหาที่ต้องการแก้','ข้อมูลร้านและรายการสั่งซื้อ','ลูกค้าต้องหาเมนู ราคา และช่องทางติดต่อ\nรายละเอียดการสั่งอยู่ในบทสนทนา\nร้านต้องติดตามรายการและความคืบหน้าของงาน','ยกตัวอย่างว่าลูกค้าเห็นรูปอาหารแล้วต้องถามราคา แจ้งจำนวน และส่งที่อยู่หลายข้อความ ระบบจึงรวบรวมข้อมูลที่ต้องใช้ไว้ในรายการเดียว นี่เป็นข้อสังเกตตั้งต้น ไม่ใช่ผลการทดลองเปรียบเทียบ Facebook'],
['แนวคิดของ huaychan','พื้นที่กลางให้ร้านกับลูกค้ามาเจอกัน','รวมร้านและเมนูที่ค้นหาได้\nสร้างออเดอร์และติดตามสถานะ\nคุยกับร้านโดยตรงผ่านออเดอร์','อธิบายว่าเป้าหมายคือให้ร้านเล็กมีหน้าร้านออนไลน์ และให้คนในพื้นที่อุดหนุนกัน แพลตฟอร์มช่วยจัดข้อมูลและการสื่อสาร ไม่ได้มีทีมปรุงอาหารหรือเครือข่ายคนขับแยกของตนเองตามหลักฐานโครงการ'],
['บทบาทในระบบ','ลูกค้า  •  ร้านค้า  •  ผู้ดูแล','ลูกค้าเลือกสินค้า แจ้งจุดส่ง และจ่ายให้ร้าน\nร้านปรุงอาหาร รับเงิน และจัดส่งเอง\nผู้ดูแลดูแลระบบ สิทธิ์ และช่วยประสานงาน','อย่าอธิบายว่าแพลตฟอร์มไม่ต้องรับผิดชอบอะไรเลย เพราะยังต้องดูแลระบบและข้อมูล ส่วนอาหารและการให้บริการของร้านเป็นบทบาทร้านตามแนวคิดที่กำหนด แยกบทบาทให้ชัดจะช่วยตอบเรื่องขอบเขตโครงงาน'],
['หน้าเว็บไซต์จริง','huaychan.web.app','image','ภาพหน้าสาธารณะบันทึกวันที่ 17 กันยายน 2569 แสดงร้าน หมวดสินค้า การค้นหา เข้าสู่ระบบ และแนวคิดชุมชน ภาพไม่ได้ยืนยันธุรกรรมจริงครบเส้นทาง ไม่ใช้ยอดขายหรือคะแนนที่เห็นเป็นผลประเมินความสำเร็จ แหล่งข้อมูล https://huaychan.web.app'],
['วัตถุประสงค์และขอบเขต','สิ่งที่ต้องตรวจได้','ค้นหาร้านและเมนูในพื้นที่\nสั่งซื้อพร้อมข้อมูลที่ร้านต้องใช้\nติดตามสถานะและสื่อสารตามรายการ\nจัดการร้านและตรวจประวัติด้วยสิทธิ์ที่เหมาะสม','อธิบายว่าขอบเขตพื้นที่คือห้วยชัน นาฝาย และรอบมหาวิทยาลัยราชภัฏชัยภูมิตามหน้าเว็บ การบอกพื้นที่บริการบนหน้าเว็บยังไม่เท่ากับมี geofence ตรวจอัตโนมัติทุกคำสั่งซื้อ เกณฑ์ตรวจรับละเอียดอยู่ในรายงาน'],
['เทคโนโลยีหลัก','เว็บและบริการข้อมูล','Next.js 16.3.5 + React 19.2.8 + TypeScript\nFirebase Auth / Firestore / Cloud Functions\nLINE LIFF สำหรับเส้นทางเข้าสู่ระบบ\nCapacitor สำหรับแอป Android','อ้าง package.json และ capacitor.config.ts เวอร์ชันที่มีเครื่องหมาย ^ ในรายงานคือช่วงที่ manifest ยอมรับ ต้องใช้ lockfile เมื่อติดตั้งซ้ำ โครงการตั้ง Next.js เป็น static export และใช้บริการ Firebase แยกสำหรับข้อมูลและตรรกะ backend'],
['โครงสร้างระบบ','หน้าจอเชื่อมกับบริการ Firebase','เว็บและ Android แสดงส่วนติดต่อผู้ใช้\nAuthentication ระบุตัวตน\nFirestore เก็บร้าน เมนู ออเดอร์ และแชท\nFunctions ทำงานที่กำหนดไว้ฝั่งเซิร์ฟเวอร์','ไล่เส้นทางจากผู้ใช้ไปหน้าจอ แล้วแยกบัญชี ฐานข้อมูล และ Functions หน้าจออยู่บน Firebase Hosting โดย build ลง out งานที่ต้องตรวจความถูกต้องไม่ควรเชื่อเพียงค่าจากเครื่องลูกค้า ที่มา next.config.ts, firebase.json, src/lib/firebase.ts และ functions/index.js'],
['ข้อมูลและความสัมพันธ์','ออเดอร์เชื่อมคนซื้อกับร้าน','ร้านหนึ่งแห่งมีหลายเมนูและหลายออเดอร์\nออเดอร์หนึ่งรายการเป็นของร้านหนึ่งแห่ง\nหลายออเดอร์ใช้ group_id ร่วมกันได้\nแชทอยู่ใต้ orders/{id}/messages','ตะกร้าอาจมีหลายร้าน แต่ checkout แยกออเดอร์ให้แต่ละร้าน ความสัมพันธ์ใช้ shop_id และ customer_uid ใน Firestore จึงต้องตรวจความสอดคล้องของรหัสด้วยโปรแกรมและ Rules ที่มา src/types/index.ts และ CartCheckoutModal.tsx'],
['ขั้นตอนการสั่งซื้อ','ตั้งแต่เลือกเมนูจนปิดงาน','1  เลือกเมนู ตัวเลือก จำนวน และตรวจตะกร้า\n2  กรอกข้อมูลติดต่อ จุดส่ง และวิธีจ่าย\n3  ส่งออเดอร์แยกร้านและติดตามสถานะ\n4  ร้านทำอาหาร ส่ง รับเงิน และจบงาน','สาธิตขั้นตอนโดยอธิบายสถานะ pending, cooking, delivering, completed และ cancelled การสาธิตที่มีการเขียนข้อมูลควรใช้สภาพแวดล้อมทดสอบ เน้นว่าเมื่อหลายร้านสำเร็จไม่พร้อมกันต้องรู้ว่ารายการใดเกิดขึ้นแล้ว ก่อนลองใหม่'],
['ตะกร้าหลายร้าน','ค่าส่งคิดตามจำนวนร้าน','ร้าน ก  (50 + ตัวเลือก 10) × 2 = 120 บาท\nร้าน ข  เครื่องดื่ม 30 บาท\nค่าส่ง 2 ร้าน × 10 = 20 บาท\nยอดชำระรวม 170 บาท','ตัวเลขทั้งหมดเป็นตัวอย่างสมมติ โค้ด CartContext กำหนดค่าส่ง 10 บาทต่อร้าน ดังนั้นตะกร้าสองร้านเป็น 20 บาท ร้านแต่ละแห่งรับเงินส่วนของตน ไม่ควรอธิบายว่าเหมาทุกตะกร้าเพียง 10 บาท'],
['ตัวอย่างโค้ดตะกร้า','คำนวณยอดของแต่ละร้าน','const unit = item.unit_price ?? item.price;\ngroups[sId].subtotal += unit * item.quantity;\ngroups[sId].total =\n  groups[sId].subtotal + groups[sId].deliveryFee;','ตัวอย่างย่อจาก src/context/CartContext.tsx เปลี่ยนชื่อตัวแปร itemUnitPrice เป็น unit เพื่ออ่านบนสไลด์ unit_price คือราคาเมนูรวมตัวเลือก คูณจำนวนเป็นยอดรายการ แล้วรวมค่าส่ง นี่เป็นการคำนวณหน้าจอ ยังต้องยืนยันราคาที่ backend ก่อนเชื่อถือเพื่อสร้างออเดอร์'],
['บัญชีและสิทธิ์','ตรวจที่ฐานข้อมูลและ backend','access กำหนด role และ shop_id\nลูกค้าอ่านออเดอร์ของตน\nร้านเข้าถึงงานของร้านที่ได้รับสิทธิ์\nการซ่อนปุ่มไม่แทนการตรวจสิทธิ์','อ้าง firestore.rules และ AuthContext.tsx การรับข้อมูลชื่อบทบาทจากหน้าจอไม่เพียงพอ ต้องตรวจตัวตนจริงกับสิทธิ์ที่เชื่อถือได้ บันทึก readiness ระบุว่า backend บางส่วนยังมี fallback สิทธิ์เก่า ต้องทำให้สอดคล้องกัน'],
['แชทและการแจ้งเตือน','สื่อสารโดยอ้างอิงออเดอร์','ข้อความและรูปภาพผูกกับรายการสั่งซื้อ\nเบอร์และรายละเอียดจุดส่งช่วยประสานงาน\nPush และเสียงช่วยเตือนร้าน\nการบันทึกงานกับการแจ้งเตือนต้องตรวจแยกกัน','อ้าง ChatModal.tsx, pushNotifications.ts และ functions/index.js แชทอยู่ในขอบเขตผู้เกี่ยวข้องกับออเดอร์ การแจ้งเตือนไม่ถึงไม่ได้แปลว่าออเดอร์ไม่ถูกบันทึก และบันทึก readiness ยังมีปัญหา endpoint 403 ที่ต้องแก้ก่อนยืนยันการใช้งานจริง'],
['การจบงานและค่าบริการ','สถานะกับ ledger ต้องสอดคล้องกัน','completeOrder ใช้ transaction\nตรวจสถานะซ้ำก่อนปรับเครดิตและยอดขาย\nGP ทำงานตามการตั้งค่าที่เปิดใช้\nรายงานยอดอ่านค่าหักจริงจากธุรกรรม','อ้าง functions/index.js และ src/lib/salesSummary.ts แยกยอดรับลูกค้ากับรายได้ค่าบริการ ตัวอย่าง GP 5% ไม่ใช่หลักฐานว่าเปิดใช้เสมอ ค่า net ยังไม่หักวัตถุดิบ ค่าแรง หรือค่าเดินทาง จึงไม่ควรเรียกกำไรสุทธิ'],
['ขั้นตอนพัฒนาและเผยแพร่','ลำดับสำหรับทำความเข้าใจระบบ','กำหนดปัญหาและขอบเขตผู้ใช้\nออกแบบข้อมูล แล้วพัฒนาทีละเส้นทาง\nทดสอบตรรกะ สิทธิ์ และงานครบเส้นทาง\nBuild เว็บ ตรวจ Hosting และทดสอบ Android','ลำดับนี้เรียบเรียงจากส่วนประกอบของโครงการเพื่ออธิบายวิธีทำ ไม่ใช่วันเวลาพัฒนาที่มีบันทึกครบ อ่านคู่มือ Next.js รุ่นติดตั้งก่อนแก้โค้ด และใช้ emulator ทดสอบคำขอผิดพลาดก่อน deploy'],
['ผลทดสอบย่อย','ผ่าน 20 จาก 20 กรณี','Badge 5  •  LINE identity 3\nComplete order 6\nGeolocation 4  •  Sales summary 2\nรันวันที่ 17 กันยายน 2569','รันด้วย node --test ตามรายชื่อไฟล์ที่ระบุในรายงาน ผ่านทั้งหมด แต่เป็นการทดสอบตรรกะจำลอง ไม่ได้ทดสอบลูกค้าสั่งจริงแล้วร้านส่งจริง ไม่ได้รัน emulator suite ทั้งหมดใหม่ในงานเอกสารนี้ ไม่ใช้ผล 20/20 แทนคำว่าปลอดภัยหรือพร้อมเปิดใช้'],
['ข้อจำกัดที่ต้องแก้','ยังต้องตรวจรับก่อนเปิดใช้ทั่วไป','ราคาปัจจุบันยังมาจาก client\nต้องกันการสร้างออเดอร์ซ้ำเมื่อ retry\nต้องบังคับจบงานผ่าน backend\nEndpoint และ Android ต้องทดสอบจริง','ที่มา LAUNCH_READINESS_REVIEW.md วันที่ 17 กันยายน 2026 บันทึกเดิมระบุ security tests ผ่าน 15/16 และ readiness gates ไม่ผ่าน 3/3 ข้อค้นพบต่างระดับกับ unit tests จึงไม่ขัดแย้งกัน ต้องเก็บผลทดสอบใหม่หลังแก้ก่อนเปลี่ยนข้อสรุป'],
['แนวทางพัฒนาต่อ','ความถูกต้องก่อนขยายการใช้งาน','ให้ server อ่านราคาและสร้างออเดอร์\nใช้ request key เดิมเมื่อส่งซ้ำ\nจัดสิทธิ์และธุรกรรมให้สอดคล้อง\nทดลองกับร้านและลูกค้ากลุ่มเล็กหลังผ่านเกณฑ์','อธิบาย idempotency ด้วยตัวอย่าง กดคำขอเดิมสองครั้งควรได้ออเดอร์เดิม การทดลองชุมชนควรเก็บงานสำเร็จ ระยะเวลา และจุดสับสนตามวิธีที่กำหนด ยังไม่มีคะแนนความพึงพอใจหรือข้อมูลว่ายอดขายเพิ่มขึ้น'],
['สิ่งที่ได้เรียนรู้','ระบบชุมชนต้องเชื่อมกับงานจริง','เข้าใจวิธีทำงานของผู้ซื้อและร้าน\nออกแบบข้อมูลและขอบเขตสิทธิ์ร่วมกัน\nแยกสิ่งที่พัฒนาแล้วออกจากสิ่งที่ทดสอบแล้ว\nใช้หลักฐานกำหนดงานปรับปรุงถัดไป','สรุปว่าโครงการตอบโจทย์พื้นที่กลางสำหรับค้นหาร้าน สั่ง และคุยโดยตรง แต่ความพร้อมเชิงธุรกรรมยังต้องแก้และทดสอบ ขอบเขตร้านส่งเองช่วยให้โครงการสอดคล้องกับบริบทชุมชน ปิดด้วยแนวคิดร้านเล็กก็มีหน้าร้านออนไลน์ได้โดยไม่อ้างผลสำเร็จที่ยังไม่ได้วัด'],
['แหล่งอ้างอิงและคำถาม','เอกสารประกอบโครงงาน','ซอร์สโค้ดและบันทึกตรวจโครงการ huaychan\nคู่มือ Next.js ที่ติดตั้งตรงรุ่น\nFirebase • LINE Developers • Capacitor\nเว็บไซต์ huaychan.web.app','แหล่งอ้างอิง: https://firebase.google.com/docs/firestore/query-data/listen ; https://firebase.google.com/docs/firestore/manage-data/transactions ; https://developers.line.biz/en/docs/liff/using-user-profile/ ; https://capacitorjs.com/docs ; คู่มือ local node_modules/next/dist/docs/01-app/02-guides/static-exports.md ตรวจ 17 กันยายน 2569 รายละเอียดบรรณานุกรมและโค้ดเต็มตามช่วงที่คัดอยู่ในรายงาน Word เตรียมตอบคำถามเรื่องเหตุผลหัวข้อ ผู้จัดส่ง ความถูกต้องของราคา และเกณฑ์ตรวจรับ']
];
slides[18]=['การปรับปรุงและงานตรวจรับ','อัปเดตระหว่างจัดทำรายงาน','เพิ่ม checkoutOrder และ idempotency แล้ว\nRules จำกัดการจบงานตรงจากร้าน\nบันทึกโครงการระบุว่า deploy และแก้ IAM แล้ว\nยังต้องตรวจ acceptance บนมือถือจริง','โค้ดล่าสุดเพิ่ม functions/checkout.js และ client ส่ง idempotency_key บันทึก LAUNCH_READINESS_REVIEW.md ฉบับอัปเดตระบุ readiness 3/3, security 16/16 และ signed APK แล้ว เป็นผลจากบันทึกโครงการ ไม่ได้รันซ้ำทั้งหมดในงานเอกสารนี้ HTTP 401 ของคำขอไม่มีบัญชียืนยันเพียงว่าเข้าถึง handler ไม่แทนผลการสั่งซื้อจริง ยังต้องตรวจตัวเลือกอาหารและคำขอพร้อมกัน'];
slides[19]=['แผนตรวจรับถัดไป','ตรวจความถูกต้องครบเส้นทาง','ตรวจราคาตัวเลือกและยอดหน้าจอกับ server\nส่งคำขอซ้ำและพร้อมกันหลายครั้ง\nตรวจสถานะ เครดิต และ ledger ร่วมกัน\nทดลอง Android ก่อนเริ่มใช้กับกลุ่มเล็ก','functions/checkout.js ณ เวลาตรวจยังมี fallback ราคาตัวเลือกจากคำขอเมื่อหาในเมนูไม่พบ จึงควรตรวจเพิ่มเติม รวมถึงผลตอบกลับเมื่อ transaction retry ไม่อ้างว่าผ่านทุกกรณีจากการมี backend checkout เพียงอย่างเดียว หลังผ่าน acceptance จึงประเมินความเข้าใจของลูกค้าและร้านจริง'];
for(const a of slides){a[3]=a[3].replace('บันทึก readiness ระบุว่า backend บางส่วนยังมี fallback สิทธิ์เก่า ต้องทำให้สอดคล้องกัน','ฉบับอัปเดตเปลี่ยน backend ให้อ่าน access แล้ว ควรทดสอบการถอนสิทธิ์เพิ่มเติม').replace('บันทึก readiness ยังมีปัญหา endpoint 403 ที่ต้องแก้ก่อนยืนยันการใช้งานจริง','บันทึก readiness ฉบับอัปเดตระบุว่าแก้ endpoint 403 แล้ว แต่ยังต้องทดสอบการส่งถึงอุปกรณ์จริง');}
function text(slide,t,x,y,w,h,size,color='#18302C',bold=false,font='Tahoma'){
 const shape=slide.shapes.add({geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});
 shape.text=t;shape.text.style={typeface:font,fontSize:size,color,bold,autoFit:'none'};return shape;
}
for(let i=0;i<slides.length;i++){
 const [title,sub,body,notes]=slides[i];const s=presentation.slides.add();s.background.fill=i===0?'#173F36':'#FFFCF5';
 if(i===0){
  text(s,title,72,56,1100,110,78,'#FFFFFF',true);
  text(s,sub,76,191,1100,85,40,'#FFBE61',true);
  text(s,body,76,325,1050,290,28,'#FFFFFF');
 } else {
  text(s,title,64,44,1160,82,45,'#173F36',true);
  text(s,sub,66,137,1140,65,28,'#AF5300');
  if(body==='image'){
   s.images.add({blob:new Uint8Array(await fs.readFile(root+'/.build/home.png')),contentType:'image/png',alt:'หน้าเว็บไซต์ huaychan วันที่ 17 กันยายน 2569',fit:'contain',position:{left:64,top:215,width:1120,height:430}});
  } else text(s,body,70,248,1135,335,i===12?30:33,'#233B35',false,i===12?'Consolas':'Tahoma');
  text(s,String(i+1).padStart(2,'0'),1150,655,65,35,18,'#697871');
 }
 s.speakerNotes.textFrame.setText(notes);
}
await fs.mkdir(root+'/.build/slide-render',{recursive:true});
await (await PresentationFile.exportPptx(presentation)).save(root+'/.build/candidate.pptx');
const final=root+'/output/Huaychan_Presentation_Final.pptx';
await finalizePresentation({workspaceDir:root,candidatePath:root+'/.build/candidate.pptx',finalPath:final,
 pythonExecutable:'C:/Users/LENOVO/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',
 integrityValidatorPath:skill+'/container_tools/inspect_presentation_package_integrity.py',
 layoutValidatorPath:skill+'/container_tools/inspect_presentation_layout_geometry.py',
 layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-bullet-geometry','--validate-heading-fit'],
 fontPolicy:{basis:'design',families:['Tahoma','Consolas']},verifyArtifactToolImport:true,
 receiptPath:root+'/.build/validation-final.json'});
for(let i=0;i<presentation.slides.items.length;i++){
 const b=await presentation.export({slide:presentation.slides.items[i],format:'png',scale:1});
 await fs.writeFile(root+'/.build/slide-render/slide-'+(i+1)+'.png',new Uint8Array(await b.arrayBuffer()));
}
await fs.writeFile(root+'/.build/slides.json',JSON.stringify(slides,null,2));
console.log('Saved',slides.length,'slides');
