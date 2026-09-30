'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import MerchantDashboard from '@/components/MerchantDashboard';
import { Store, Lock, Mail, Phone, LogOut, UserCheck, ChefHat, AlertCircle, ArrowRight, FileText, Home } from 'lucide-react';
import { soundAlert } from '@/lib/soundAlert';
import TermsModal from '@/components/TermsModal';

export default function MerchantAppPage() {
  const { user, role, isLoading, loginWithEmail, logout } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showTerms, setShowTerms] = useState(false);

  // Unlock sound on mount or click
  useEffect(() => {
    soundAlert.unlock().catch(() => {});
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    const res = await loginWithEmail(email.trim(), password);
    setIsSubmitting(false);

    if (!res.success) {
      setErrorMessage(res.error || 'เข้าสู่ระบบไม่สำเร็จ');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white">
        <div className="w-16 h-16 rounded-3xl bg-orange-500/20 flex items-center justify-center animate-bounce mb-4">
          <ChefHat className="w-8 h-8 text-orange-500" />
        </div>
        <p className="text-sm font-bold text-gray-300 animate-pulse">กำลังโหลดระบบร้านค้า...</p>
      </div>
    );
  }

  // Not logged in or not a merchant/admin
  if (!user || (role !== 'merchant' && role !== 'admin')) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950/40 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
          
          {/* Header */}
          <div className="text-center space-y-2">
            <div
              style={{ backgroundColor: '#f97316' }}
              className="w-16 h-16 rounded-2xl bg-orange-500 bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-orange-500/30"
            >
              <ChefHat className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-xl font-black text-gray-900">
              huaychan
            </h1>
            <p className="text-xs font-bold text-orange-600 bg-orange-50 inline-block px-3 py-1 rounded-full border border-orange-200">
              แอปพลิเคชันสำหรับร้านค้า (Merchant App)
            </p>
          </div>

          {/* Error Alert */}
          {errorMessage && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* User is logged in but role is customer */}
          {user && role === 'customer' && (
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
              <p className="font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                บัญชีปัจจุบันเป็น &ldquo;ลูกค้า&rdquo;
              </p>
              <p className="text-[11px] text-amber-700 leading-relaxed">
                บัญชีของคุณยังไม่ได้รับสิทธิ์ร้านค้า กรุณาติดต่อแอดมินเพื่อกำหนดสิทธิ์ร้านค้าให้ หรือเข้าสู่ระบบด้วยบัญชีร้านค้า
              </p>
              <button
                type="button"
                onClick={() => logout()}
                className="w-full py-2 bg-amber-200/80 hover:bg-amber-300 text-amber-900 font-bold rounded-xl text-xs transition"
              >
                ออกจากระบบ เพื่อเข้าสู่ระบบใหม่
              </button>
            </div>
          )}

          {/* Login Form */}
          {(!user || role !== 'customer') && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 block">อีเมลร้านค้า</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    placeholder="merchant@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 block">รหัสผ่าน</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                style={{ backgroundColor: '#f97316' }}
                className="w-full py-3.5 bg-orange-500 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white font-black text-sm rounded-xl shadow-lg shadow-orange-500/25 transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <span>{isSubmitting ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบร้านค้า'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* Navigation */}
          <div className="pt-2 border-t border-gray-100 text-center space-y-2">
            <a
              href="/"
              className="w-full py-2.5 px-4 bg-orange-50 hover:bg-orange-100 text-orange-900 border border-orange-200 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 block text-center"
            >
              <Home className="w-4 h-4" />
              <span>ไปที่หน้าหลัก (สั่งอาหาร / ร้านค้าทั้งหมด)</span>
            </a>
          </div>

          {/* Terms link */}
          <div className="text-center pt-1">
            <button
              type="button"
              onClick={() => setShowTerms(true)}
              className="text-[11px] text-amber-700 hover:text-amber-800 underline font-semibold inline-flex items-center gap-1"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>อ่านข้อกำหนดและเงื่อนไขสำหรับร้านค้า (GP 5%)</span>
            </button>
          </div>

          <div className="text-center text-[10px] text-gray-400">
            ระบบรับออเดอร์ร้านค้า ชุมชนบ้านห้วยชัน - นาฝาย & มรภ.ชัยภูมิ
          </div>
        </div>

        {/* Terms of Service Modal */}
        <TermsModal
          isOpen={showTerms}
          onClose={() => setShowTerms(false)}
          defaultTab="merchant"
        />
      </div>
    );
  }

  // Logged in as merchant or admin
  return (
    <div className="min-h-screen bg-slate-100 pb-8">
      {/* Merchant App Header Bar */}
      <header className="bg-slate-900 text-white sticky top-0 z-30 shadow-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-500 flex items-center justify-center shadow-sm">
              <ChefHat className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-xs font-black text-white leading-none">huaychan</h2>
              <p className="text-[10px] text-amber-400 font-semibold mt-0.5">
                {user.shop_id ? 'ระบบจัดการร้านค้า' : 'แผงควบคุมร้านค้า'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowTerms(true)}
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 flex items-center gap-1 transition active:scale-95"
              title="ข้อกำหนดร้านค้า"
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="text-[11px] hidden sm:inline">ข้อกำหนด</span>
            </button>
            <span className="text-xs font-bold text-gray-300 hidden sm:inline">
              {user.display_name}
            </span>
            <button
              type="button"
              onClick={() => logout()}
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-rose-900/40 text-gray-300 hover:text-rose-300 border border-slate-700 flex items-center gap-1 transition active:scale-95"
              title="ออกจากระบบ"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="text-[11px]">ออก</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Merchant Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-4">
        <MerchantDashboard currentUser={user} />
      </main>

      {/* Terms of Service Modal */}
      <TermsModal
        isOpen={showTerms}
        onClose={() => setShowTerms(false)}
        defaultTab="merchant"
      />
    </div>
  );
}
