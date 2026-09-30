'use client';

import React from 'react';
import { X, ExternalLink, Sparkles, MessageSquare, Utensils, Store, HelpCircle, MapPin } from 'lucide-react';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ContactModal({ isOpen, onClose }: ContactModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-amber-100 animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 p-4 sm:p-5 text-white flex items-center justify-between shadow-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center text-xl shrink-0 shadow-inner">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-black text-base sm:text-lg leading-tight flex items-center gap-1.5">
                ติดต่อเรา & ฝ่ายบริการ
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

        {/* Modal Content */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto max-h-[80vh] text-xs sm:text-sm text-gray-700 leading-relaxed bg-slate-50/40">
          
          {/* Direct LINE Contact Hero Card */}
          <div className="bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 rounded-3xl p-5 text-white shadow-lg space-y-3.5 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-300 animate-ping" />
                <span className="text-xs font-black uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full">
                  Admin Support พร้อมให้บริการ
                </span>
              </div>
            </div>

            <div>
              <h3 className="text-lg sm:text-xl font-black">
                LINE ผู้ดูแลระบบ (Admin)
              </h3>
              <p className="text-xs text-emerald-100 mt-1 leading-relaxed">
                สามารถทักแชทสอบถามปัญหา แจ้งเรื่องออเดอร์ หรือติดต่อเปิดร้านค้าได้โดยตรง
              </p>
            </div>

            <div className="bg-white/15 backdrop-blur-md p-3 rounded-2xl border border-white/25 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] text-emerald-100 font-medium">LINE ID แอดมิน:</p>
                <p className="text-base font-black text-white tracking-wide font-mono">tonpalm033</p>
              </div>
              <a
                href="https://line.me/ti/p/~tonpalm033"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 bg-white hover:bg-emerald-50 text-emerald-800 font-black text-xs rounded-xl shadow-md transition active:scale-95 flex items-center gap-1.5 shrink-0"
              >
                <span>เปิด LINE</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Contact Topic Guidance */}
          <div className="space-y-2">
            <p className="font-bold text-gray-900 text-xs flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>เรื่องที่สามารถติดต่อได้:</span>
            </p>

            <div className="grid grid-cols-1 gap-2">
              <div className="p-3 bg-white rounded-2xl border border-gray-200/90 flex items-start gap-3 shadow-2xs">
                <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                  <Utensils className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-xs">สำหรับลูกค้า</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">กรณีติดต่อร้านค้าไม่ได้ หรือพบปัญหาการจัดส่งและคุณภาพอาหาร</p>
                </div>
              </div>

              <div className="p-3 bg-white rounded-2xl border border-gray-200/90 flex items-start gap-3 shadow-2xs">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <Store className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-xs">สำหรับร้านค้า</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">สมัครเปิดร้านใหม่, แนะนำการใช้งาน, หรือสอบถามการเติมเครดิต</p>
                </div>
              </div>

              <div className="p-3 bg-white rounded-2xl border border-gray-200/90 flex items-start gap-3 shadow-2xs">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <HelpCircle className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-xs">ข้อเสนอแนะเพื่อพัฒนาชุมชน</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">แจ้งข้อคิดเห็น ติชม หรือเสนอแนะฟังก์ชันที่อยากให้มีในระบบ</p>
                </div>
              </div>
            </div>
          </div>

          {/* Service Area Info */}
          <div className="p-3.5 bg-amber-50/70 border border-amber-200/70 rounded-2xl text-[11px] text-amber-900 space-y-1">
            <p className="font-bold flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>พื้นที่ให้บริการ huaychan</span>
            </p>
            <p className="text-amber-800 leading-relaxed">ชุมชนห้วยชัน - นาฝาย และรอบ มรภ. ชัยภูมิ (ส่งตรงถึงหน้าบ้านและหอพัก)</p>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 text-white text-xs font-bold rounded-xl shadow-md transition active:scale-95 flex items-center justify-center gap-1.5"
          >
            <span>ปิดหน้าต่าง</span>
          </button>
        </div>

      </div>
    </div>
  );
}
