'use client';

import React, { useState, useEffect } from 'react';
import {
  X, RotateCw, ShoppingBag, Clock, Store, MapPin, ChevronRight,
  AlertCircle, CheckCircle2, Bike, Utensils, Ban, ArrowRight, ExternalLink,
  FileText, FileEdit, CreditCard, Info
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { Order, Shop, MenuItem, SystemSettings } from '@/types';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { formatOrderCode } from '@/lib/orderNumber';

interface OrderHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  shops: Shop[];
  menuItems?: MenuItem[];
  systemSettings?: { gp_enabled?: boolean; gp_percent?: number } | null;
  onOpenCart?: () => void;
  onTrackOrder?: (order: Order) => void;
}

export default function OrderHistoryModal({
  isOpen,
  onClose,
  shops,
  menuItems = [],
  systemSettings,
  onOpenCart,
  onTrackOrder
}: OrderHistoryModalProps) {
  const { user } = useAuth();
  const { addItem, clearCart } = useCart();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all');
  const [reorderingId, setReorderingId] = useState<string | null>(null);

  // Realtime subscription to customer's orders
  useEffect(() => {
    if (!isOpen || !user) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'orders'),
      where('customer_uid', '==', user.uid)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: Order[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data()
        } as Order));

        // Sort locally by created_at desc (handles Firestore Timestamp, string or date)
        list.sort((a, b) => {
          const timeA = (a.created_at as any)?.toMillis
            ? (a.created_at as any).toMillis()
            : new Date(a.created_at || 0).getTime();
          const timeB = (b.created_at as any)?.toMillis
            ? (b.created_at as any).toMillis()
            : new Date(b.created_at || 0).getTime();
          return timeB - timeA;
        });

        setOrders(list);
        setLoading(false);
      },
      (err) => {
        console.error('Order history listener error:', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [isOpen, user]);

  if (!isOpen) return null;

  // Filter orders
  const filteredOrders = orders.filter((order) => {
    if (filterTab === 'active') {
      return order.status === 'pending' || order.status === 'cooking' || order.status === 'delivering';
    }
    if (filterTab === 'completed') {
      return order.status === 'completed';
    }
    if (filterTab === 'cancelled') {
      return order.status === 'cancelled';
    }
    return true;
  });

  // Re-order handler
  const handleReorder = (order: Order) => {
    setReorderingId(order.id);

    try {
      // 1. Check shop availability
      const targetShop = shops.find((s) => s.id === order.shop_id);
      if (!targetShop) {
        alert('ขออภัย ไม่พบข้อมูลร้านค้านี้ในระบบแล้ว');
        setReorderingId(null);
        return;
      }

      // Check shop is_open
      if (targetShop.is_open === false) {
        alert(`ขออภัย ร้าน "${targetShop.name}" ปิดให้บริการอยู่ในขณะนี้ ไม่สามารถสั่งซ้ำได้`);
        setReorderingId(null);
        return;
      }

      // Check GP balance if GP is enabled
      if (systemSettings?.gp_enabled === true && (targetShop.credit_balance ?? 0) <= 0) {
        alert(`ขออภัย ร้าน "${targetShop.name}" เครดิตร้านค้าหมดชั่วคราว ยังไม่พร้อมรับออเดอร์ในขณะนี้`);
        setReorderingId(null);
        return;
      }

      // 2. Add items to cart
      let addedCount = 0;
      const unavailableItems: string[] = [];

      // Add each item
      order.items.forEach((item) => {
        // Check if menu item is still available in catalog if menuItems provided
        const menuItemMatch = menuItems.find((m) => m.id === item.menu_id);
        if (menuItemMatch && menuItemMatch.is_available === false) {
          unavailableItems.push(item.name);
          return;
        }

        // Add to cart
        addItem(
          {
            id: item.menu_id,
            name: item.name,
            price: item.price,
            shop_id: order.shop_id,
            category: 'food',
            is_available: true
          } as MenuItem,
          {
            id: targetShop.id,
            name: targetShop.name,
            phone: targetShop.phone,
            delivery_fee: targetShop.delivery_fee ?? 0
          },
          item.note || '',
          item.selected_options || [],
          item.quantity || 1
        );
        addedCount++;
      });

      if (addedCount === 0) {
        alert('ขออภัย เมนูทั้งหมดในออเดอร์นี้หมดหรือปิดการขายชั่วคราว');
        setReorderingId(null);
        return;
      }

      if (unavailableItems.length > 0) {
        alert(`เพิ่ม ${addedCount} รายการลงในตะกร้าแล้ว (ข้ามบางรายการที่หมด: ${unavailableItems.join(', ')})`);
      }

      // Close modal and open cart
      onClose();
      onOpenCart?.();
    } catch (err: any) {
      console.error('Reorder error:', err);
      alert('เกิดข้อผิดพลาดในการสั่งซ้ำ: ' + (err.message || ''));
    } finally {
      setReorderingId(null);
    }
  };

  // Helper for status badge
  const renderStatusBadge = (status: Order['status']) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>จัดส่งสำเร็จแล้ว</span>
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-amber-200 animate-pulse">
            <Clock className="w-3 h-3 text-amber-600" />
            <span>รอยืนยัน</span>
          </span>
        );
      case 'cooking':
        return (
          <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-orange-200">
            <Utensils className="w-3 h-3 text-orange-600" />
            <span>ร้านกำลังทำอาหาร</span>
          </span>
        );
      case 'delivering':
        return (
          <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-blue-200">
            <Bike className="w-3 h-3 text-blue-600" />
            <span>กำลังจัดส่ง</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-rose-200">
            <Ban className="w-3 h-3 text-rose-600" />
            <span>ยกเลิกออเดอร์</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
            {status}
          </span>
        );
    }
  };

  // Format date helper
  const formatDate = (val: any) => {
    if (!val) return '';
    const d = val?.toDate ? val.toDate() : new Date(val);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 border border-amber-100">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 px-5 py-4 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-xl shadow-inner">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">ประวัติการสั่งซื้อของคุณ</h2>
              <p className="text-[11px] sm:text-xs text-amber-100">
                รายการออเดอร์ทั้งหมด {orders.length} รายการ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="px-4 pt-3 pb-2 border-b border-gray-100 bg-slate-50 flex items-center gap-1.5 overflow-x-auto text-xs font-bold scrollbar-none">
          <button
            type="button"
            onClick={() => setFilterTab('all')}
            className={`px-3 py-1.5 rounded-xl transition whitespace-nowrap ${
              filterTab === 'all'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            ทั้งหมด ({orders.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('active')}
            className={`px-3 py-1.5 rounded-xl transition whitespace-nowrap ${
              filterTab === 'active'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            กำลังดำเนินการ ({orders.filter((o) => o.status === 'pending' || o.status === 'cooking' || o.status === 'delivering').length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('completed')}
            className={`px-3 py-1.5 rounded-xl transition whitespace-nowrap ${
              filterTab === 'completed'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            สำเร็จ ({orders.filter((o) => o.status === 'completed').length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('cancelled')}
            className={`px-3 py-1.5 rounded-xl transition whitespace-nowrap ${
              filterTab === 'cancelled'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            ยกเลิก ({orders.filter((o) => o.status === 'cancelled').length})
          </button>
        </div>

        {/* Modal Body / Orders List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/50">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-gray-500 font-medium">กำลังโหลดประวัติการสั่งซื้อ...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-14 px-4 text-center space-y-3 bg-white rounded-2xl border border-gray-150">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mx-auto text-2xl">
                <Utensils className="w-7 h-7 text-amber-500" />
              </div>
              <div>
                <h4 className="font-bold text-gray-800 text-sm">ไม่พบรายการสั่งซื้อ</h4>
                <p className="text-xs text-gray-400 mt-0.5">
                  {filterTab === 'all'
                    ? 'คุณยังไม่มีประวัติการสั่งซื้ออาหารในระบบ'
                    : 'ไม่มีรายการในหมวดหมู่นี้'}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="py-2 px-4 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95"
              >
                ดูร้านอาหารและเริ่มสั่งเลย
              </button>
            </div>
          ) : (
            filteredOrders.map((order) => {
              const shopInfo = shops.find((s) => s.id === order.shop_id);
              const isShopOpen = shopInfo ? shopInfo.is_open !== false : false;
              const isActiveOrder = order.status === 'pending' || order.status === 'cooking' || order.status === 'delivering';
              const isReordering = reorderingId === order.id;

              return (
                <div
                  key={order.id}
                  className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-2xs hover:shadow-xs transition space-y-3"
                >
                  {/* Card Header: Shop & Status */}
                  <div className="flex items-start justify-between gap-2 border-b border-gray-100 pb-2.5">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-xs font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                          {formatOrderCode(order)}
                        </span>
                        <h3 className="font-black text-sm text-gray-900 flex items-center gap-1.5">
                          {shopInfo?.image_url ? (
                            <img
                              src={shopInfo.image_url}
                              alt={shopInfo.name}
                              className="w-4.5 h-4.5 rounded-full object-cover border border-amber-200 shrink-0"
                            />
                          ) : (
                            <Store className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          )}
                          <span>{order.shop_name || shopInfo?.name || 'ร้านค้า'}</span>
                        </h3>
                        {/* Live Shop Open/Closed Status Badge */}
                        {shopInfo ? (
                          isShopOpen ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                              ร้านเปิดอยู่
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                              ร้านปิดอยู่
                            </span>
                          )
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-md">
                            ไม่มีร้านนี้ในระบบ
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{formatDate(order.created_at)}</span>
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      {renderStatusBadge(order.status)}
                    </div>
                  </div>

                  {/* Items List with Menu Thumbnails */}
                  <div className="space-y-2 text-xs">
                    {order.items.map((item, idx) => {
                      const menuItemMatch = menuItems.find((m) => m.id === item.menu_id);
                      const itemImageUrl = (item as any).image_url || menuItemMatch?.image_url;

                      return (
                        <div key={idx} className="flex items-center justify-between gap-2.5 py-1">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {/* Menu Thumbnail */}
                            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-150/70 overflow-hidden shrink-0 flex items-center justify-center shadow-2xs">
                              {itemImageUrl ? (
                                <img
                                  src={itemImageUrl}
                                  alt={item.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    (e.currentTarget as HTMLElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                <Utensils className="w-4 h-4 text-amber-500" />
                              )}
                            </div>

                            {/* Menu Name, Options & Note */}
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-gray-800 leading-snug">
                                <span className="text-amber-600 font-black mr-1">{item.quantity}x</span>
                                {item.name}
                              </p>
                              {item.selected_options && item.selected_options.length > 0 && (
                                <p className="text-[10.5px] text-gray-500 mt-0.5">
                                  + {item.selected_options.map((o) => `${o.name} (${o.price}฿)`).join(', ')}
                                </p>
                              )}
                              {item.note && (
                                <p className="text-[10px] text-amber-600 italic mt-0.5 flex items-center gap-1">
                                  <FileEdit className="w-2.5 h-2.5 shrink-0" />
                                  <span>&ldquo;{item.note}&rdquo;</span>
                                </p>
                              )}
                            </div>
                          </div>

                          <span className="font-black text-xs text-gray-800 shrink-0 text-right pl-2">
                            ฿{(item.unit_price ?? item.price) * item.quantity}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pricing & Delivery Info Bar */}
                  <div className="bg-slate-50 rounded-xl p-2.5 flex items-center justify-between text-xs border border-gray-150">
                    <div className="space-y-0.5 text-[11px]">
                      <div className="text-gray-500 flex items-center gap-1">
                        <Bike className="w-3 h-3" />
                        <span>ค่าจัดส่ง:</span>
                        <strong className="text-gray-700">
                          {(order.delivery_fee ?? 0) === 0 ? (
                            <span className="text-emerald-600 font-bold">ส่งฟรี (0 บ.)</span>
                          ) : (
                            `${order.delivery_fee} บ.`
                          )}
                        </strong>
                      </div>
                      <div className="text-gray-500 flex items-center gap-1">
                        <CreditCard className="w-3 h-3" />
                        <span>ชำระโดย:</span>
                        <span className="font-semibold text-gray-700">
                          {order.payment_method === 'cash' ? 'เงินสด' : 'สแกนจ่าย'}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-gray-400 block">ยอดรวมทั้งสิ้น</span>
                      <span className="text-base font-black text-amber-600">
                        ฿{order.total_amount}
                      </span>
                    </div>
                  </div>

                  {/* Card Actions: Re-order & Track Order */}
                  <div className="pt-1 flex items-center justify-between gap-2 flex-wrap border-t border-gray-100/80 pt-2">
                    {/* Shop Open / Closed hint on the left */}
                    <div className="text-[11px] font-semibold flex items-center gap-1.5">
                      {shopInfo ? (
                        isShopOpen ? (
                          <span className="text-emerald-600 flex items-center gap-1 bg-emerald-50/80 px-2 py-0.5 rounded-lg border border-emerald-100">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            ร้านเปิดอยู่ • สั่งได้ทันที
                          </span>
                        ) : (
                          <span className="text-rose-600 flex items-center gap-1 bg-rose-50/80 px-2 py-0.5 rounded-lg border border-rose-100">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                            ร้านปิดอยู่ • สั่งไม่ได้ชั่วคราว
                          </span>
                        )
                      ) : (
                        <span className="text-gray-400 flex items-center gap-1">
                          ร้านนี้ไม่อยู่ในระบบแล้ว
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Active Order Tracker Button */}
                      {isActiveOrder && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onTrackOrder?.(order);
                          }}
                          className="py-1.5 px-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold text-xs flex items-center gap-1 shadow-xs transition active:scale-95 cursor-pointer"
                        >
                          <Bike className="w-3.5 h-3.5" />
                          <span>ติดตามสถานะ</span>
                        </button>
                      )}

                      {/* Smart Re-Order Button */}
                      {shopInfo ? (
                        isShopOpen ? (
                          <button
                            type="button"
                            disabled={isReordering}
                            onClick={() => handleReorder(order)}
                            className="py-1.5 px-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
                            title="นำเมนูเข้าตะกร้าเพื่อสั่งอีกครั้ง"
                          >
                            <RotateCw className={`w-3.5 h-3.5 ${isReordering ? 'animate-spin' : ''}`} />
                            <span>{isReordering ? 'กำลังนำเข้า...' : 'สั่งอีกครั้ง'}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={isReordering}
                            onClick={() => handleReorder(order)}
                            className="py-1.5 px-3.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-bold text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                            title="ร้านค้านี้ปิดให้บริการอยู่ในขณะนี้"
                          >
                            <Ban className="w-3.5 h-3.5 text-rose-500" />
                            <span>ร้านปิดอยู่</span>
                          </button>
                        )
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="py-1.5 px-3.5 bg-gray-100 text-gray-400 border border-gray-200 rounded-xl font-medium text-xs flex items-center gap-1.5 cursor-not-allowed"
                        >
                          <span>ไม่มีร้านในระบบ</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-white border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>สามารถกด <b>&ldquo;สั่งอีกครั้ง&rdquo;</b> เพื่อสั่งเมนูเดิมได้อย่างสะดวกรวดเร็ว</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="py-1.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition"
          >
            ปิด
          </button>
        </div>

      </div>
    </div>
  );
}
