'use client';

import React, { useState } from 'react';
import {
  X, ShieldCheck, FileText, Store, Utensils,
  Phone, CheckCircle2, Lock, Sparkles, MapPin, Bike, CreditCard, MessageSquare
} from 'lucide-react';

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'customer' | 'merchant' | 'rules' | 'privacy';
  onOpenContact?: () => void;
}

export default function TermsModal({ isOpen, onClose, defaultTab = 'customer', onOpenContact }: TermsModalProps) {
  // Map legacy tabs into 2 modern clean tabs: 'terms' | 'privacy'
  const initialTab = defaultTab === 'privacy' ? 'privacy' : 'terms';
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy'>(initialTab);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-amber-100 animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 p-4 sm:p-5 text-white flex items-center justify-between shadow-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center text-xl shrink-0 shadow-inner">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-black text-base sm:text-lg leading-tight flex items-center gap-1.5">
                ข้อกำหนดและนโยบาย
              </h2>
              <p className="text-xs text-amber-100 font-medium mt-0.5">
                huaychan • ชุมชนห้วยชัน - นาฝาย & มรภ. ชัยภูมิ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/20 hover:bg-black/35 text-white flex items-center justify-center transition active:scale-95 shrink-0"
            title="ปิด"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Clean 2-Tab Navigation */}
        <div className="flex bg-slate-100 p-1.5 border-b border-gray-200 gap-1 shrink-0 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('terms')}
            className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95 ${
              activeTab === 'terms'
                ? 'bg-amber-500 text-white shadow-xs font-black'
                : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>ข้อกำหนดการใช้บริการ</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('privacy')}
            className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95 ${
              activeTab === 'privacy'
                ? 'bg-amber-500 text-white shadow-xs font-black'
                : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>นโยบายความเป็นส่วนตัว</span>
          </button>
        </div>

        {/* Scrollable Clean Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 text-xs sm:text-sm text-gray-700 leading-relaxed bg-slate-50/40">
          
          {/* TAB 1: ข้อกำหนดการใช้บริการ */}
          {activeTab === 'terms' && (
            <div className="space-y-3 animate-in fade-in duration-150">
              
              {/* Community Purpose Banner */}
              <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3.5 space-y-1.5 shadow-2xs">
                <div className="flex items-center gap-1.5">
                  <Store className="w-4 h-4 text-amber-700" />
                  <h3 className="font-black text-amber-950 text-xs sm:text-sm">
                    พื้นที่กลางเพื่อชุมชน ส่งตรงถึงหน้าบ้านและหอพัก
                  </h3>
                </div>
                <p className="text-[11px] text-amber-900 leading-relaxed">
                  huaychan จัดทำขึ้นเพื่อสนับสนุนร้านค้าในชุมชนห้วยชัน-นาฝาย ให้ส่งต่ออาหารอร่อยถึงมือเพื่อนบ้านและนักศึกษา มรภ.ชัยภูมิ อย่างสะดวกและรวดเร็ว
                </p>
              </div>

              {/* 1. Shop Role */}
              <div className="bg-white border border-gray-200/90 rounded-2xl p-3.5 space-y-1.5 shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-black shrink-0">1</span>
                  <h4 className="font-bold text-gray-900 text-xs sm:text-sm flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-orange-500" />
                    <span>ร้านค้าปรุงและจัดส่งด้วยตนเอง</span>
                  </h4>
                </div>
                <p className="text-gray-600 text-xs pl-8 leading-relaxed">
                  ร้านค้าเป็นผู้ขาย ปรุงสดใหม่ กำหนดค่าส่งตามระยะทาง และจัดส่งถึงหน้าบ้าน/หอพักด้วยตนเอง พร้อมรับผิดชอบคุณภาพอาหารและการบริการ
                </p>
              </div>

              {/* 2. Customer Phone & Contact */}
              <div className="bg-white border border-gray-200/90 rounded-2xl p-3.5 space-y-1.5 shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-black shrink-0">2</span>
                  <h4 className="font-bold text-gray-900 text-xs sm:text-sm flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-amber-500" />
                    <span>เบอร์โทรศัพท์ 10 หลักและที่อยู่รับของ</span>
                  </h4>
                </div>
                <p className="text-gray-600 text-xs pl-8 leading-relaxed">
                  ผู้สั่งต้องระบุเบอร์โทรศัพท์ที่ติดต่อได้จริง และระบุจุดส่ง (บ้าน/หอพัก/ห้อง) ให้ชัดเจน เพื่อให้คนส่งอาหารโทรแจ้งเมื่อถึงจุดนัดรับ
                </p>
              </div>

              {/* 3. Payment */}
              <div className="bg-white border border-gray-200/90 rounded-2xl p-3.5 space-y-1.5 shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-black shrink-0">3</span>
                  <h4 className="font-bold text-gray-900 text-xs sm:text-sm flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                    <span>การชำระเงินผ่านแชทสดก่อนเริ่มปรุงอาหาร</span>
                  </h4>
                </div>
                <div className="text-gray-600 text-xs pl-8 space-y-1 leading-relaxed">
                  <p>
                    • <b>ชำระเงินโดยตรงกับร้านค้า:</b> ผู้สั่งต้องชำระเงินผ่านการโอนบัญชีธนาคารหรือสแกน QR Code ของร้านค้าในระบบแชทสด และส่งสลิปยืนยันก่อนร้านค้าเริ่มปรุงอาหาร
                  </p>
                  <p>
                    • <b>การเก็บเงินปลายทาง (COD):</b> ไม่มีบริการเก็บเงินปลายทางเป็นค่าเริ่มต้น ยกเว้นกรณีที่ลูกค้าทักแชทตกลงและได้รับการยินยอมจากร้านค้านั้นๆ โดยตรง
                  </p>
                  <p>
                    • <b>การยกเลิกออเดอร์:</b> เมื่อร้านค้าได้รับสลิปและเริ่มปรุงอาหารแล้ว จะไม่สามารถยกเลิกออเดอร์หรือขอคืนเงินได้ทุกกรณี
                  </p>
                </div>
              </div>

              {/* 4. Platform Role */}
              <div className="bg-white border border-gray-200/90 rounded-2xl p-3.5 space-y-1.5 shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-black shrink-0">4</span>
                  <h4 className="font-bold text-gray-900 text-xs sm:text-sm flex items-center gap-1.5">
                    <Bike className="w-3.5 h-3.5 text-blue-500" />
                    <span>บทบาทของ huaychan</span>
                  </h4>
                </div>
                <p className="text-gray-600 text-xs pl-8 leading-relaxed">
                  huaychan ทำหน้าที่เป็นระบบเทคโนโลยีตัวกลางในการจับคู่ออเดอร์และแชทติดต่อ หากเกิดข้อพิพาทหรือต้องการความช่วยเหลือ สามารถแจ้งผู้ดูแลระบบได้ทันที
                </p>
              </div>

            </div>
          )}

          {/* TAB 2: นโยบายความเป็นส่วนตัว */}
          {activeTab === 'privacy' && (
            <div className="space-y-3 animate-in fade-in duration-150">
              
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5 space-y-1.5 shadow-2xs">
                <div className="flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-emerald-700" />
                  <h3 className="font-black text-emerald-950 text-xs sm:text-sm">
                    เราเคารพและปกป้องข้อมูลส่วนบุคคลของคุณ
                  </h3>
                </div>
                <p className="text-[11px] text-emerald-900 leading-relaxed">
                  huaychan จัดเก็บเฉพาะข้อมูลที่จำเป็นเพื่อการจัดส่งอาหารในชุมชนเท่านั้น และไม่มีนโยบายจำหน่ายหรือส่งต่อข้อมูลให้บุคคลภายนอก
                </p>
              </div>

              {/* 1. Information Collected */}
              <div className="bg-white border border-gray-200/90 rounded-2xl p-3.5 space-y-1.5 shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-black shrink-0">1</span>
                  <h4 className="font-bold text-gray-900 text-xs sm:text-sm">
                    ข้อมูลที่เราจัดเก็บ
                  </h4>
                </div>
                <p className="text-gray-600 text-xs pl-8 leading-relaxed">
                  • <b>ชื่อโปรไฟล์และรูปภาพ:</b> ใช้แสดงเพื่อระบุตัวตนในระบบและห้องแชท<br />
                  • <b>เบอร์โทรศัพท์:</b> ใช้ให้ร้านค้าและคนส่งอาหารโทรยืนยันออเดอร์<br />
                  • <b>ที่อยู่และหมุดพิกัดจัดส่ง:</b> ใช้คำนวณและนำส่งอาหารให้ถึงหน้าบ้าน/หอพัก
                </p>
              </div>

              {/* 2. Usage Purpose */}
              <div className="bg-white border border-gray-200/90 rounded-2xl p-3.5 space-y-1.5 shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-black shrink-0">2</span>
                  <h4 className="font-bold text-gray-900 text-xs sm:text-sm">
                    การนำข้อมูลไปใช้งาน
                  </h4>
                </div>
                <p className="text-gray-600 text-xs pl-8 leading-relaxed">
                  นำไปใช้เพื่ออำนวยความสะดวกในการจัดส่งอาหาร แจ้งเตือนสถานะออเดอร์ และให้การสนับสนุนกรณีเกิดปัญหาเท่านั้น
                </p>
              </div>

              {/* 3. Data Control */}
              <div className="bg-white border border-gray-200/90 rounded-2xl p-3.5 space-y-1.5 shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-black shrink-0">3</span>
                  <h4 className="font-bold text-gray-900 text-xs sm:text-sm">
                    สิทธิของคุณในการจัดการข้อมูล
                  </h4>
                </div>
                <p className="text-gray-600 text-xs pl-8 leading-relaxed">
                  คุณสามารถแก้ไขชื่อ เบอร์โทรศัพท์ และหมุดที่อยู่จัดส่งได้ตลอดเวลาผ่านหน้าโปรไฟล์ของคุณ
                </p>
              </div>

            </div>
          )}

          {/* Clean Contact Redirect Hint */}
          <div className="p-3 bg-white border border-gray-200/80 rounded-2xl flex items-center justify-between gap-2 shadow-2xs">
            <div className="text-[11px] text-gray-500">
              <span>มีข้อสงสัยเพิ่มเติมหรือต้องการแจ้งปัญหา?</span>
            </div>
            {onOpenContact && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenContact();
                }}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl border border-emerald-200 transition active:scale-95 flex items-center gap-1 shrink-0"
              >
                <MessageSquare className="w-3.5 h-3.5 text-emerald-700" />
                <span>ติดต่อเรา</span>
              </button>
            )}
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3 shrink-0">
          <p className="text-[11px] text-gray-500 hidden sm:flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>huaychan ส่งตรงถึงหน้าบ้านและหอพัก</span>
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 text-white text-xs font-bold rounded-xl shadow-md transition active:scale-95 flex items-center justify-center gap-1.5 ml-auto"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>รับทราบและปิดหน้าต่าง</span>
          </button>
        </div>

      </div>
    </div>
  );
}
