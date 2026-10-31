'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import MerchantDashboard from '@/components/MerchantDashboard';
import { LogOut, ChefHat, AlertCircle, FileText, Home } from 'lucide-react';
import { soundAlert } from '@/lib/soundAlert';
import TermsModal from '@/components/TermsModal';
import MerchantApplicationPanel from '@/components/MerchantApplicationPanel';

export default function MerchantAppPage() {
  const { user, role, isLoading, loginWithLine, loginWithGoogle, logout } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showTerms, setShowTerms] = useState(false);

  // Unlock sound on mount or click
  useEffect(() => {
    soundAlert.unlock().catch(() => {});
  }, []);

  const handleLogin = async (provider: 'line' | 'google') => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    const res = provider === 'line' ? await loginWithLine() : await loginWithGoogle();
    if ('redirecting' in res && res.redirecting) return;
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
              CPRUFood
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

          {/* Logged in as customer: apply for a shop or see application status */}
          {user && role === 'customer' && (
            <div className="space-y-3">
              <MerchantApplicationPanel user={user} />
              <button
                type="button"
                onClick={() => logout()}
                className="w-full py-2 text-[11px] text-gray-500 hover:text-gray-700 font-semibold transition"
              >
                ไม่ใช่บัญชีนี้? ออกจากระบบ ({user.display_name})
              </button>
            </div>
          )}

          {/* Not logged in: merchants and applicants both use LINE / Google */}
          {!user && (
            <div className="space-y-3">
              <p className="text-xs text-gray-600 text-center leading-relaxed">
                เจ้าของร้านเข้าสู่ระบบด้วย LINE หรือ Google ที่ผูกกับร้าน
                <br />
                ยังไม่มีร้าน? เข้าสู่ระบบแล้วกรอกคำขอเปิดร้านได้เลย
              </p>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleLogin('line')}
                className="w-full py-3 bg-[#06C755] hover:bg-[#05b34c] disabled:opacity-60 text-white rounded-xl font-black text-sm shadow-md flex items-center justify-center gap-2 transition active:scale-95"
              >
                <svg className="w-5 h-5 fill-current shrink-0" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 5.91 2 10.74c0 2.94 1.67 5.53 4.25 7.03-.18.66-.67 2.42-.77 2.79-.12.46.17.45.36.33.15-.09 2.06-1.4 2.89-1.97.42.06.84.09 1.27.09 5.52 0 10-3.91 10-8.74S17.52 2 12 2z" />
                </svg>
                <span>เข้าสู่ระบบด้วย LINE</span>
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleLogin('google')}
                className="w-full py-3 bg-white hover:bg-gray-50 border border-gray-200 disabled:opacity-60 text-gray-800 rounded-xl font-bold text-sm shadow-xs flex items-center justify-center gap-2.5 transition active:scale-95"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>เข้าสู่ระบบด้วย Google</span>
              </button>
              <p className="text-[10px] text-gray-400 text-center leading-relaxed">
                เข้าบัญชี LINE / Google เดิมของร้านไม่ได้? ติดต่อแอดมินเพื่อย้ายสิทธิ์ร้านไปยังบัญชีใหม่
              </p>
            </div>
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
              <h2 className="text-xs font-black text-white leading-none">CPRUFood</h2>
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
