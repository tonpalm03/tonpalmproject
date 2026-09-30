'use client';

import React, { useState } from 'react';
import { X, Mail, Lock, LogIn, AlertCircle, Store, Smartphone, ChevronDown, ZoomIn, ExternalLink } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import TermsModal from './TermsModal';

interface AuthModalProps {
  onClose: () => void;
}

export default function AuthModal({ onClose }: AuthModalProps) {
  const { loginWithEmail, loginWithLine } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showTerms, setShowTerms] = useState(false);
  const [showMerchantLogin, setShowMerchantLogin] = useState(false);
  const [showFullImageModal, setShowFullImageModal] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    setLoading(true);
    const res = await loginWithEmail(email, password);
    setLoading(false);
    if (res.success) {
      onClose();
    } else {
      setError(res.error || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3">
      <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl flex flex-col max-h-[92vh] overflow-y-auto border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div>
            <h3 className="font-black text-lg text-gray-900">
              เข้าสู่ระบบ
            </h3>
            <p className="text-xs text-amber-600 font-semibold">huaychan • มรภ. ชัยภูมิ</p>
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

        {/* 1. Customer Section (LINE Login) */}
        <div className="mt-4 space-y-2.5">
          <div className="text-center">
            <span className="inline-block px-2.5 py-0.5 bg-emerald-50 text-emerald-700 font-bold text-[11px] rounded-full border border-emerald-200">
              สำหรับลูกค้าสั่งอาหาร
            </span>
            <p className="text-xs text-gray-500 mt-1">เข้าสู่ระบบง่ายๆ ผ่าน LINE ได้ทันที</p>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              setError('');
              const res = await loginWithLine();
              if (res.redirecting) {
                // Keep loading indicator while browser initiates OAuth redirect
                return;
              }
              setLoading(false);
              if (res.success) {
                onClose();
              } else if (res.error) {
                setError(res.error);
              }
            }}
            className="w-full py-3 bg-[#06C755] hover:bg-[#05b34c] disabled:opacity-50 text-white rounded-2xl font-black text-sm shadow-md flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer"
          >
            <svg className="w-5 h-5 fill-current shrink-0" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 5.91 2 10.74c0 2.94 1.67 5.53 4.25 7.03-.18.66-.67 2.42-.77 2.79-.12.46.17.45.36.33.15-.09 2.06-1.4 2.89-1.97.42.06.84.09 1.27.09 5.52 0 10-3.91 10-8.74S17.52 2 12 2z"/>
            </svg>
            <span>{loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบด้วย LINE'}</span>
          </button>

          {/* LINE Login Tip & Direct Visual Guide */}
          <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-2.5 text-left transition-all">
            <div className="flex items-start gap-2 mb-2">
              <Smartphone className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1 text-[11px] text-gray-600 leading-relaxed">
                <p className="font-bold text-emerald-800">ทริค: ไม่ต้องจำรหัสผ่าน</p>
                <p className="mt-0.5">
                  เมื่อหน้า LINE ขึ้นมา ให้เลื่อนลงล่างสุด แล้วกดปุ่ม{' '}
                  <span className="font-bold text-emerald-900 bg-white/90 px-1 py-0.5 rounded border border-emerald-200 inline-block">
                    "เข้าสู่ระบบด้วยแอป LINE"
                  </span>
                </p>
              </div>
            </div>

            {/* Direct Image Preview with Zoom on Click */}
            <div
              onClick={() => setShowFullImageModal(true)}
              className="relative overflow-hidden rounded-xl border border-emerald-200 bg-white p-1 cursor-pointer group hover:border-emerald-400 transition"
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

        {/* Divider & Merchant Collapsible Toggle */}
        <div className="mt-4 pt-3 border-t border-gray-100">
          <button
            type="button"
            onClick={() => setShowMerchantLogin(!showMerchantLogin)}
            className="w-full py-2 px-3 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-2xl border border-gray-200/80 flex items-center justify-between text-xs font-bold transition cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Store className="w-4 h-4 text-amber-500" />
              <span>เข้าสู่ระบบสำหรับร้านค้า / แอดมิน</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${showMerchantLogin ? 'rotate-180' : ''}`} />
          </button>

          {/* 2. Merchant / Admin Form (Collapsed by Default) */}
          {showMerchantLogin && (
            <form onSubmit={handleSubmit} className="mt-3 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">อีเมลร้านค้า / แอดมิน (Email)</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    placeholder="merchant@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">รหัสผ่าน (Password)</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    placeholder="กรอกรหัสผ่าน"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-md transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>{loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบร้านค้า / แอดมิน'}</span>
              </button>

              <div className="text-center pt-1 space-y-0.5">
                <p className="text-[11px] text-gray-400">
                  บัญชีร้านค้าจะได้รับการเปิดโดยผู้ดูแลระบบเท่านั้น
                </p>
                <p className="text-[11px] text-gray-400">
                  หากต้องการเปิดร้านค้าใหม่{' '}
                  <a
                    href="https://line.me/R/ti/p/@887nrlyw"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-600 hover:text-emerald-700 font-bold underline inline-flex items-center gap-0.5"
                  >
                    <span>ติดต่อ LINE Official (@887nrlyw)</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </p>
              </div>
            </form>
          )}
        </div>

        {/* Terms of Service Button */}
        <div className="mt-3 pt-2 text-center">
          <button
            type="button"
            onClick={() => setShowTerms(true)}
            className="text-[11px] text-amber-600 hover:text-amber-700 underline font-semibold cursor-pointer"
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
                <Smartphone className="w-4 h-4 text-emerald-600" />
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

            <div className="w-full mt-3 bg-emerald-50 rounded-xl p-2.5 text-center border border-emerald-100">
              <p className="text-xs font-bold text-emerald-800">
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
