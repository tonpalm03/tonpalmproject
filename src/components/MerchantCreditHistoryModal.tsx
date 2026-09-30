'use client';

import React, { useState, useMemo } from 'react';
import { CreditTransaction, Shop } from '@/types';
import {
  X, Wallet, ArrowDownRight, ArrowUpRight, Clock,
  Search, Filter, CheckCircle2, AlertCircle, MessageCircle,
  FileText, ShieldCheck, ChevronRight, Plus, Tag, Minus
} from 'lucide-react';
import { formatThaiDateWithTime } from '@/lib/dateUtils';

interface MerchantCreditHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopData: Shop | null;
  transactions: CreditTransaction[];
  gpEnabled?: boolean;
  gpPercent?: number;
  onOpenTopupContact: () => void;
}

export default function MerchantCreditHistoryModal({
  isOpen,
  onClose,
  shopData,
  transactions,
  gpEnabled = false,
  gpPercent = 5,
  onOpenTopupContact,
}: MerchantCreditHistoryModalProps) {
  const [filterType, setFilterType] = useState<'all' | 'topup' | 'gp_deduct' | 'deduct'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Sort transactions by created_at desc
  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => {
      const timeA = a.created_at?.seconds
        ? a.created_at.seconds * 1000
        : a.created_at
        ? new Date(a.created_at).getTime()
        : 0;
      const timeB = b.created_at?.seconds
        ? b.created_at.seconds * 1000
        : b.created_at
        ? new Date(b.created_at).getTime()
        : 0;
      return timeB - timeA;
    });
  }, [transactions]);

  // Filtered list based on tab and search
  const filteredTransactions = useMemo(() => {
    return sortedTransactions.filter((tx) => {
      if (filterType !== 'all') {
        if (filterType === 'topup' && tx.type !== 'topup') return false;
        if (filterType === 'gp_deduct' && tx.type !== 'gp_deduct') return false;
        if (filterType === 'deduct' && tx.type !== 'deduct') return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const noteMatch = (tx.note || '').toLowerCase().includes(q);
        const orderMatch = tx.order_number ? String(tx.order_number).includes(q) : false;
        const amountMatch = String(Math.abs(tx.amount)).includes(q);
        return noteMatch || orderMatch || amountMatch;
      }
      return true;
    });
  }, [sortedTransactions, filterType, searchQuery]);

  // Aggregate stats
  const stats = useMemo(() => {
    let totalTopup = 0;
    let totalGpDeduct = 0;
    let totalManualDeduct = 0;

    for (const tx of transactions) {
      if (tx.type === 'topup' || (tx.amount > 0 && tx.type !== 'gp_deduct')) {
        totalTopup += tx.amount;
      } else if (tx.type === 'gp_deduct') {
        totalGpDeduct += Math.abs(tx.amount);
      } else if (tx.type === 'deduct' || tx.amount < 0) {
        totalManualDeduct += Math.abs(tx.amount);
      }
    }

    return {
      totalTopup,
      totalGpDeduct,
      totalManualDeduct,
      count: transactions.length,
    };
  }, [transactions]);

  if (!isOpen) return null;

  const currentBalance = shopData?.credit_balance ?? 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-gray-100 flex flex-col max-h-[90vh] overflow-hidden my-auto animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-xl font-bold shadow-2xs">
              <FileText className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-gray-900 flex items-center gap-2">
                <span>ประวัติธุรกรรมและเติมเครดิต</span>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  โปร่งใส 100%
                </span>
              </h2>
              <p className="text-xs text-gray-500">
                {shopData?.name || 'ร้านค้า'} • บันทึกการเติมเงินและหักค่าบริการแบบเรียลไทม์
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white hover:bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-800 text-sm font-bold transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body (Scrollable) */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          
          {/* Balance & Overview Card */}
          <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-4 sm:p-5 shadow-md relative overflow-hidden">
            <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs text-emerald-100 font-medium">ยอดเครดิตคงเหลือปัจจุบัน</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl sm:text-4xl font-black tracking-tight tabular-nums">
                    ฿{currentBalance.toFixed(2)}
                  </span>
                  <span className="text-xs text-emerald-200 font-semibold">บาท</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    currentBalance > 0
                      ? 'bg-emerald-400/30 text-emerald-50 border border-emerald-300/40'
                      : 'bg-rose-500/80 text-white border border-rose-400'
                  }`}>
                    {currentBalance > 0 ? '● สถานะปกติ พร้อมเปิดรับออเดอร์' : '● เครดิตหมด กรุณาเติมเพื่อเปิดร้าน'}
                  </span>
                  {gpEnabled ? (
                    <span className="text-[10px] text-emerald-100 bg-black/20 px-2 py-0.5 rounded-full">
                      หัก GP {gpPercent}%
                    </span>
                  ) : (
                    <span className="text-[10px] text-amber-200 bg-amber-900/40 px-2 py-0.5 rounded-full font-bold">
                      ฟรี GP 0%
                    </span>
                  )}
                </div>
              </div>

              <div className="flex sm:flex-col gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenTopupContact();
                  }}
                  className="w-full px-4 py-2.5 bg-white hover:bg-emerald-50 text-emerald-800 font-black text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                >
                  <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>เติมเครดิตเพิ่ม</span>
                </button>
              </div>
            </div>

            {/* Quick Stat Tiles */}
            <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-white/20 text-center">
              <div className="bg-black/15 rounded-xl p-2">
                <span className="text-[10px] text-emerald-200 block">เติมเครดิตสะสม</span>
                <span className="text-xs sm:text-sm font-black text-white tabular-nums">
                  +฿{stats.totalTopup.toFixed(2)}
                </span>
              </div>
              <div className="bg-black/15 rounded-xl p-2">
                <span className="text-[10px] text-emerald-200 block">หัก GP ออเดอร์</span>
                <span className="text-xs sm:text-sm font-black text-amber-200 tabular-nums">
                  -฿{stats.totalGpDeduct.toFixed(2)}
                </span>
              </div>
              <div className="bg-black/15 rounded-xl p-2">
                <span className="text-[10px] text-emerald-200 block">ปรับยอด/อื่นๆ</span>
                <span className="text-xs sm:text-sm font-black text-rose-200 tabular-nums">
                  -฿{stats.totalManualDeduct.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Filter Bar & Search */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex flex-wrap gap-1.5 flex-1">
                <button
                  type="button"
                  onClick={() => setFilterType('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    filterType === 'all'
                      ? 'bg-gray-900 text-white shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  ทั้งหมด ({transactions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('topup')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                    filterType === 'topup'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                  }`}
                >
                  <ArrowUpRight className="w-3 h-3" />
                  <span>เติมเครดิต</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('gp_deduct')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                    filterType === 'gp_deduct'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                  }`}
                >
                  <ArrowDownRight className="w-3 h-3" />
                  <span>หัก GP ออเดอร์</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('deduct')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                    filterType === 'deduct'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                  }`}
                >
                  <span>ปรับยอด</span>
                </button>
              </div>

              {/* Search Box */}
              <div className="relative w-full sm:w-48 shrink-0">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="ค้นหา เช่น #1002"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Transactions List */}
          <div className="border border-gray-100 rounded-2xl overflow-hidden bg-white shadow-2xs">
            {filteredTransactions.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <div className="w-12 h-12 bg-gray-100 text-gray-400 rounded-2xl flex items-center justify-center mx-auto">
                  <FileText className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-xs font-bold text-gray-600">ไม่พบรายการธุรกรรมเครดิต</p>
                <p className="text-[11px] text-gray-400">
                  {searchQuery ? 'ไม่พบข้อมูลที่ตรงกับคำค้นหา' : 'ยังไม่มีประวัติการเติมหรือหักเครดิตสำหรับร้านค้านี้'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-[380px] overflow-y-auto">
                {filteredTransactions.map((tx) => {
                  const txDate = tx.created_at?.seconds
                    ? new Date(tx.created_at.seconds * 1000)
                    : tx.created_at
                    ? new Date(tx.created_at)
                    : null;

                  const isTopup = tx.type === 'topup' || (tx.amount > 0 && tx.type !== 'gp_deduct');
                  const isGp = tx.type === 'gp_deduct';

                  return (
                    <div
                      key={tx.id}
                      className="p-3.5 sm:p-4 hover:bg-slate-50/80 transition flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Transaction Icon */}
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-base font-bold shadow-2xs ${
                            isTopup
                              ? 'bg-emerald-100 text-emerald-700'
                              : isGp
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {isTopup ? <Plus className="w-4 h-4" /> : isGp ? <Tag className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                        </div>

                        {/* Transaction Details */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs text-gray-900 truncate">
                              {isTopup
                                ? 'เติมเครดิตเข้าระบบ'
                                : isGp
                                ? `หักค่าบริการ GP ออเดอร์ ${tx.order_number ? `#${tx.order_number}` : ''}`.trim()
                                : 'ปรับลดยอดเครดิต'}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.2 rounded-full ${
                                isTopup
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : isGp
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {isTopup ? 'เติมเงิน' : isGp ? 'หัก GP' : 'ปรับยอด'}
                            </span>
                          </div>

                          <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                            {tx.note || (isTopup ? 'แอดมินเติมเครดิต' : 'หักค่าบริการออเดอร์')}
                          </p>

                          {txDate && (
                            <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                              <Clock className="w-2.5 h-2.5" />
                              <span>{formatThaiDateWithTime(txDate)}</span>
                              {tx.created_by && (
                                <span className="text-gray-300">• {tx.created_by === 'system' ? 'ระบบอัตโนมัติ' : 'แอดมิน'}</span>
                              )}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Transaction Amount */}
                      <div className="text-right shrink-0">
                        <span
                          className={`text-sm sm:text-base font-black tabular-nums block ${
                            isTopup ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {isTopup ? `+฿${tx.amount.toFixed(2)}` : `-฿${Math.abs(tx.amount).toFixed(2)}`}
                        </span>
                        <span className="text-[10px] text-gray-400">บาท</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Transparency & Policy Info */}
          <div className="p-3 bg-slate-50 rounded-2xl border border-gray-200/80 text-[11px] text-gray-500 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-gray-700">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>ความโปร่งใสในระบบเครดิตร้านค้า</span>
            </div>
            <p className="leading-relaxed">
              ยอดเครดิตคือเงินที่ร้านเติมล่วงหน้าไว้สำหรับหักค่าคอมมิชชั่น GP ({gpPercent}%) เมื่อจัดส่งออเดอร์สำเร็จ โดยระบบจะคำนวณและหักตามจริงต่อบิลทันที ร้านค้าจึงรับเงินสดหรือเงินสแกนจากลูกค้าได้เต็มจำนวนโดยไม่ต้องโอนเงินซ้ำรายสัปดาห์ หากมีข้อสงสัยเกี่ยวกับยอดเงิน สามารถติดต่อแอดมินเพื่อตรวจสอบได้ตลอดเวลา
            </p>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-gray-100 flex items-center justify-between gap-2 bg-gray-50">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenTopupContact();
            }}
            className="text-xs text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>ติดต่อแอดมินทาง LINE</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold text-xs rounded-xl transition cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>

      </div>
    </div>
  );
}
