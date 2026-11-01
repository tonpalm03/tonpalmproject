'use client';

import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Store, Smartphone, ZoomIn, ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import TermsModal from './TermsModal';

interface AuthModalProps {
  onClose: () => void;
}

export default function AuthModal({ onClose }: AuthModalProps) {
  const { user, loginWithLine, loginWithGoogle } = useAuth();

  const [isLineLoading, setIsLineLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [showTerms, setShowTerms] = useState(false);
  const [showFullImageModal, setShowFullImageModal] = useState(false);

  useEffect(() => {
    if (user) {
      onClose();
    }
  }, [user, onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3">
      <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl flex flex-col max-h-[92vh] overflow-y-auto border border-gray-100 animate-in fade-in zoom-in-95 duration-200 relative">
        
        {/* Loading Overlay inside AuthModal when logging in with LINE or Google */}
        {(isLineLoading || isGoogleLoading) && (
          <div className="absolute inset-0 bg-white/95 backdrop-blur-xs rounded-3xl z-30 flex flex-col items-center justify-center p-6 text-center space-y-3.5 animate-in fade-in duration-200">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-inner relative ${isLineLoading ? 'bg-[#06C755]/10 text-[#06C755]' : 'bg-gray-100 text-gray-700'}`}>
              {isLineLoading ? (
                <>
                  <svg className="w-9 h-9 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 5.91 2 10.74c0 2.94 1.67 5.53 4.25 7.03-.18.66-.67 2.42-.77 2.79-.12.46.17.45.36.33.15-.09 2.06-1.4 2.89-1.97.42.06.84.09 1.27.09 5.52 0 10-3.91 10-8.74S17.52 2 12 2z"/>
                  </svg>
                  <div className="absolute inset-0 rounded-2xl border-2 border-[#06C755] border-t-transparent animate-spin" />
                </>
              ) : (
                <>
                  <svg className="w-8 h-8 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <div className="absolute inset-0 rounded-2xl border-2 border-brand-500 border-t-transparent animate-spin" />
                </>
              )}
            </div>
            <div className="space-y-1">
              <h4 className="font-black text-base text-gray-900">
                {isLineLoading ? 'กำลังเข้าสู่ระบบด้วย LINE' : 'กำลังเข้าสู่ระบบด้วย Google'}
              </h4>
              <p className="text-xs text-gray-500 leading-relaxed">
                {isLineLoading ? 'กำลังเปิดหน้าต่างยืนยันตัวตน LINE... กรุณารอสักครู่' : 'กำลังเปิดหน้าต่างเข้าสู่ระบบ Google... กรุณารอสักครู่'}
              </p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div>
            <h3 className="font-black text-lg text-gray-900">
              เข้าสู่ระบบ
            </h3>
            <p className="text-xs text-brand-600 font-semibold">CPRUFood • มรภ. ชัยภูมิ</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2 text-xs text-red-600 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. Customer Section (LINE & Google Login) */}
        <div className="mt-4 space-y-2.5">
          <div className="text-center">
            <span className="inline-block px-2.5 py-0.5 bg-brand-50 text-brand-700 font-bold text-[11px] rounded-full border border-brand-200">
              สำหรับลูกค้าสั่งอาหาร
            </span>
            <p className="text-xs text-gray-500 mt-1">เลือกเข้าสู่ระบบด้วย LINE หรือ Google ได้ทันที</p>
          </div>

          {/* LINE Login Button */}
          <button
            type="button"
            disabled={isLineLoading || isGoogleLoading}
            onClick={async () => {
              if (isLineLoading || isGoogleLoading) return;
              setIsLineLoading(true);
              setError('');
              const res = await loginWithLine();
              if (res.redirecting) {
                // Keep loading indicator while browser initiates OAuth redirect
                return;
              }
              setIsLineLoading(false);
              if (res.success) {
                onClose();
              } else if (res.error) {
                setError(res.error);
              }
            }}
            className="w-full py-3 bg-[#06C755] hover:bg-[#05b34c] disabled:opacity-75 text-white rounded-2xl font-black text-sm shadow-md flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer"
          >
            {isLineLoading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>กำลังเข้าสู่ระบบ...</span>
              </div>
            ) : (
              <>
                <svg className="w-5 h-5 fill-current shrink-0" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 5.91 2 10.74c0 2.94 1.67 5.53 4.25 7.03-.18.66-.67 2.42-.77 2.79-.12.46.17.45.36.33.15-.09 2.06-1.4 2.89-1.97.42.06.84.09 1.27.09 5.52 0 10-3.91 10-8.74S17.52 2 12 2z"/>
                </svg>
                <span>เข้าสู่ระบบด้วย LINE</span>
              </>
            )}
          </button>

          {/* Google Login Button */}
          <button
            type="button"
            disabled={isLineLoading || isGoogleLoading}
            onClick={async () => {
              if (isLineLoading || isGoogleLoading) return;
              setIsGoogleLoading(true);
              setError('');
              const res = await loginWithGoogle();
              setIsGoogleLoading(false);
              if (res.success) {
                onClose();
              } else if (res.error) {
                setError(res.error);
              }
            }}
            className="w-full py-3 bg-white hover:bg-gray-50 border border-gray-200/90 hover:border-gray-300 disabled:opacity-75 text-gray-800 rounded-2xl font-bold text-sm shadow-xs flex items-center justify-center gap-2.5 transition active:scale-98 cursor-pointer"
          >
            {isGoogleLoading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
                <span>กำลังเข้าสู่ระบบ...</span>
              </div>
            ) : (
              <>
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>เข้าสู่ระบบด้วย Google</span>
              </>
            )}
          </button>

          {/* LINE Login Tip & Direct Visual Guide */}
          <div className="bg-brand-50/70 border border-brand-100 rounded-2xl p-2.5 text-left transition-all">
            <div className="flex items-start gap-2 mb-2">
              <Smartphone className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
              <div className="flex-1 text-[11px] text-gray-600 leading-relaxed">
                <p className="font-bold text-brand-800">ทริค: ไม่ต้องจำรหัสผ่าน</p>
                <p className="mt-0.5">
                  เมื่อหน้า LINE ขึ้นมา ให้เลื่อนลงล่างสุด แล้วกดปุ่ม{' '}
                  <span className="font-bold text-brand-900 bg-white/90 px-1 py-0.5 rounded border border-brand-200 inline-block">
                    "เข้าสู่ระบบด้วยแอป LINE"
                  </span>
                </p>
              </div>
            </div>

            {/* Direct Image Preview with Zoom on Click */}
            <div
              onClick={() => setShowFullImageModal(true)}
              className="relative overflow-hidden rounded-xl border border-brand-200 bg-white p-1 cursor-pointer group hover:border-brand-400 transition"
            >
              <img
                src="/line-login-guide.png"
                alt="วิธีเข้าสู่ระบบด้วยแอป LINE"
                className="w-full h-auto max-h-56 object-contain rounded-lg group-hover:opacity-95 transition"
              />
              <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition flex items-center justify-center rounded-xl">
                <span className="bg-black/70 text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                  <ZoomIn className="w-3 h-3" /> แตะเพื่อดูรูปขยาย
                </span>
              </div>
              <p className="text-[10px] text-center text-gray-400 mt-1 font-medium">
                แตะที่รูปเพื่อดูรูปภาพขนาดเต็ม
              </p>
            </div>
          </div>
        </div>

        {/* Merchants and applicants sign in with the same LINE / Google buttons */}
        <div className="mt-4 pt-3 border-t border-gray-100">
          <a
            href="/merchant"
            className="w-full py-2.5 px-3 bg-brand-50 hover:bg-brand-100 text-brand-900 rounded-2xl border border-brand-200 flex items-center justify-between text-xs font-bold transition"
          >
            <span className="flex items-center gap-2">
              <Store className="w-4 h-4 text-brand-500" />
              <span>เจ้าของร้าน / สมัครเปิดร้านค้า</span>
            </span>
            <ArrowRight className="w-4 h-4 text-brand-500" />
          </a>
          <p className="text-[11px] text-gray-400 text-center mt-1.5">
            ร้านค้าและแอดมินเข้าสู่ระบบด้วย LINE หรือ Google ด้านบนได้เลย
          </p>
        </div>

        {/* Terms of Service Button */}
        <div className="mt-3 pt-2 text-center">
          <button
            type="button"
            onClick={() => setShowTerms(true)}
            className="text-[11px] text-brand-600 hover:text-brand-700 underline font-semibold cursor-pointer"
          >
            ข้อกำหนดการใช้บริการ
          </button>
        </div>

      </div>

      {/* Terms of Service Modal */}
      <TermsModal
        isOpen={showTerms}
        onClose={() => setShowTerms(false)}
        defaultTab="customer"
      />

      {/* Fullscreen Image Zoom Modal */}
      {showFullImageModal && (
        <div
          className="fixed inset-0 z-60 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150"
          onClick={() => setShowFullImageModal(false)}
        >
          <div
            className="bg-white max-w-sm w-full rounded-3xl p-4 shadow-2xl border border-gray-100 flex flex-col items-center animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between pb-2 border-b border-gray-100 mb-3">
              <div className="flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-brand-600" />
                <span className="text-xs font-bold text-gray-900">วิธีเข้าสู่ระบบผ่านแอป LINE</span>
              </div>
              <button
                type="button"
                onClick={() => setShowFullImageModal(false)}
                className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="w-full overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 flex items-center justify-center">
              <img
                src="/line-login-guide.png"
                alt="วิธีเข้าสู่ระบบด้วยแอป LINE"
                className="w-full h-auto max-h-[65vh] object-contain"
              />
            </div>

            <div className="w-full mt-3 bg-brand-50 rounded-xl p-2.5 text-center border border-brand-100">
              <p className="text-xs font-bold text-brand-800">
                เลื่อนลงล่างสุด แล้วกดปุ่มในวงกลมสีแดง
              </p>
              <p className="text-[11px] text-gray-600 mt-0.5">
                "เข้าสู่ระบบด้วยแอป LINE" เพื่อเข้าใช้งานทันที
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowFullImageModal(false)}
              className="mt-3 w-full py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl transition cursor-pointer"
            >
              เข้าใจแล้ว ปิดหน้าต่าง
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
