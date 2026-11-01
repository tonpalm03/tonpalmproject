'use client';

import React from 'react';
import { X, ExternalLink, MessageSquare, MapPin } from 'lucide-react';
import MascotWatermark from './MascotWatermark';
import WavePattern from './WavePattern';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ContactModal({ isOpen, onClose }: ContactModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-brand-100 animate-in zoom-in-95 duration-200">
        <MascotWatermark page="contact" />
        
        {/* Modal Header */}
        <div className="bg-gradient-to-br from-[#E1F5EE] to-[#C3EBDC] border-b border-[#9FE1CB] p-4 sm:p-5 text-[#04342C] flex items-center justify-between shadow-md shrink-0 relative overflow-hidden isolate">
          <WavePattern className="text-white/90 -z-10" />
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white border border-[#9FE1CB] flex items-center justify-center text-xl shrink-0 shadow-inner">
              <MessageSquare className="w-5 h-5 text-[#1D9E75]" />
            </div>
            <div>
              <h2 className="font-black text-base sm:text-lg leading-tight flex items-center gap-1.5">
                ติดต่อเรา & ฝ่ายบริการ
              </h2>
              <p className="text-xs text-[#0F6E56] font-medium mt-0.5">
                CPRUFood • ชุมชนห้วยชัน - นาฝาย & มรภ. ชัยภูมิ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white hover:bg-brand-50 text-[#0F6E56] border border-[#9FE1CB] flex items-center justify-center transition active:scale-95 shrink-0"
            title="ปิด"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto max-h-[80vh] text-xs sm:text-sm text-gray-700 leading-relaxed bg-slate-50/40">
          
          {/* Direct LINE Contact Hero Card */}
          <div className="bg-gradient-to-br from-brand-500 via-brand-600 to-teal-700 rounded-3xl p-5 text-white shadow-lg space-y-3.5 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-brand-300 animate-ping" />
                <span className="text-xs font-black uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full">
                  CPRUFood Official Account
                </span>
              </div>
            </div>

            <div>
              <h3 className="text-lg sm:text-xl font-black">
                LINE Official Account (CPRUFood)
              </h3>
              <p className="text-xs text-brand-100 mt-1 leading-relaxed">
                ทักแชทสอบถามปัญหา แจ้งเรื่องออเดอร์ สมัครเปิดร้านค้า หรือติดต่อแอดมินได้โดยตรง
              </p>
            </div>

            <div className="bg-white/15 backdrop-blur-md p-3 rounded-2xl border border-white/25 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-brand-100 font-medium">LINE OA ID:</p>
                <p className="text-base font-black text-white tracking-wide font-mono">@887nrlyw</p>
              </div>
              <a
                href="https://line.me/R/ti/p/@887nrlyw"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 bg-white hover:bg-brand-50 text-brand-800 font-black text-xs rounded-xl shadow-md transition active:scale-95 flex items-center gap-1.5 shrink-0"
              >
                <span>เพิ่มเพื่อน / แชท</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Service Area Info */}
          <div className="p-3.5 bg-brand-50/70 border border-brand-200/70 rounded-2xl text-xs text-brand-900 space-y-1">
            <p className="font-bold flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-brand-600 shrink-0" />
              <span>พื้นที่ให้บริการ CPRUFood</span>
            </p>
            <p className="text-brand-800 leading-relaxed">ชุมชนห้วยชัน - นาฝาย และรอบ มรภ. ชัยภูมิ (ส่งตรงถึงหน้าบ้านและหอพัก)</p>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-brand-500 to-brand-500 hover:from-brand-600 text-white text-xs font-bold rounded-xl shadow-md transition active:scale-95 flex items-center justify-center gap-1.5"
          >
            <span>ปิดหน้าต่าง</span>
          </button>
        </div>

      </div>
    </div>
  );
}
