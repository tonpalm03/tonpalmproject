'use client';

import React, { useState, useEffect } from 'react';
import { X, Phone, MessageSquare, CheckCircle, Clock, ChefHat, Bike, AlertCircle, MapPin, Star, Store, CreditCard, CheckCircle2 } from 'lucide-react';
import { Order, UserRole, UserProfile } from '@/types';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, collection, query, where, updateDoc, serverTimestamp } from 'firebase/firestore';
import ChatModal from './ChatModal';
import ReviewModal from './ReviewModal';
import { formatOrderCode } from '@/lib/orderNumber';
import { orderItemUnitPrice } from '@/lib/orderItemPrice';

interface OrderStatusModalProps {
  orderId: string;
  initialOrder?: Order;
  initialOrders?: Order[];
  currentUser?: UserProfile | null;
  autoOpenChat?: boolean;
  onClose: () => void;
  onDismissOrder?: (orderId: string) => void;
  onDismissAllCompleted?: () => void;
}

export default function OrderStatusModal({
  orderId,
  initialOrder,
  initialOrders,
  currentUser,
  autoOpenChat = false,
  onClose,
  onDismissOrder,
  onDismissAllCompleted,
}: OrderStatusModalProps) {
  const [selectedOrderId, setSelectedOrderId] = useState<string>(orderId);
  const [ordersList, setOrdersList] = useState<Order[]>(
    initialOrders && initialOrders.length > 0 ? initialOrders : (initialOrder ? [initialOrder] : [])
  );
  const [showChat, setShowChat] = useState(autoOpenChat);
  const [showReviewModal, setShowReviewModal] = useState(false);

  const activeOrder = ordersList.find((o) => o.id === selectedOrderId) || ordersList[0] || initialOrder;
  const groupId = activeOrder?.group_id;

  // Realtime listener for the specific order (only if not in a group)
  useEffect(() => {
    // BUG-17: If groupId is present, the group listener already monitors all orders in the bundle
    if (!selectedOrderId || groupId) return;

    try {
      const unsub = onSnapshot(doc(db, 'orders', selectedOrderId), (docSnap) => {
        if (docSnap.exists()) {
          const updated = { id: docSnap.id, ...docSnap.data() } as Order;
          setOrdersList((prev) => {
            const index = prev.findIndex((o) => o.id === updated.id);
            if (index > -1) {
              const copy = [...prev];
              copy[index] = updated;
              return copy;
            }
            return [...prev, updated];
          });
        }
      }, (err) => {
        console.warn('OrderStatus listener fallback:', err);
      });

      return () => unsub();
    } catch (e) {
      console.error(e);
    }
  }, [selectedOrderId, groupId]);

  // Realtime listener for bundle group if multi-shop order
  useEffect(() => {
    if (!groupId || !currentUser?.uid) return;

    try {
      const q = query(collection(db, 'orders'), where('group_id', '==', groupId), where('customer_uid', '==', currentUser.uid));
      const unsub = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          const list: Order[] = [];
          snapshot.forEach((d) => list.push({ id: d.id, ...d.data() } as Order));
          setOrdersList(list);
          // BUG-18: update selectedOrderId if currently selected order is no longer in list
          setSelectedOrderId((prevId) => {
            const exists = list.some((o) => o.id === prevId);
            return exists ? prevId : (list[0]?.id || prevId);
          });
        }
      }, (err) => console.warn('Group orders listener error:', err));

      return () => unsub();
    } catch (e) {
      console.warn('Group orders sync error:', e);
    }
  }, [groupId, currentUser?.uid]);

  if (!activeOrder) {
    return null;
  }

  const steps = [
    { key: 'pending', label: 'รอโอนเงิน/รับ', icon: Clock, desc: 'กรุณาโอนเงินผ่านแชทสดกับร้านค้าเพื่อเริ่มทำอาหาร' },
    { key: 'cooking', label: 'กำลังปรุง', icon: ChefHat, desc: 'ร้านได้รับยอดเงินแล้ว กำลังปรุงอาหาร' },
    { key: 'delivering', label: 'กำลังไปส่ง', icon: Bike, desc: 'ร้านกำลังขี่รถไปส่งถึงจุดนัดรับ' },
    { key: 'completed', label: 'ส่งสำเร็จ', icon: CheckCircle, desc: 'ส่งอาหารถึงมือเรียบร้อยแล้ว' },
  ];

  const getStepIndex = (status: string) => {
    switch (status) {
      case 'pending': return 0;
      case 'cooking': return 1;
      case 'delivering': return 2;
      case 'completed': return 3;
      case 'cancelled': return -1;
      default: return 0;
    }
  };

  const currentStep = getStepIndex(activeOrder.status);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3">
        <div className="bg-white w-full max-w-md md:max-w-xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
          
          {/* Header */}
          <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 p-4 text-white flex items-center justify-between shadow-sm">
            <div>
              <span className="text-[11px] bg-white/20 px-2 py-0.5 rounded-full font-medium">
                {ordersList.length > 1 ? `สั่งอาหาร ${ordersList.length} ร้านค้า` : `ออเดอร์ #${formatOrderCode(activeOrder)}`}
              </span>
              <h2 className="font-black text-lg mt-0.5">สถานะการจัดส่ง</h2>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-black/15 hover:bg-black/25 flex items-center justify-center transition active:scale-95"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Multi-Shop Order Tabs (if customer ordered from multiple shops) */}
          {ordersList.length > 1 && (
            <div className="bg-amber-50/90 border-b border-amber-200/70 px-3 py-2 flex gap-2 overflow-x-auto shrink-0">
              {ordersList.map((o) => {
                const isSelected = o.id === selectedOrderId;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setSelectedOrderId(o.id)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold shrink-0 transition flex items-center gap-1.5 shadow-2xs ${
                      isSelected
                        ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-300'
                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <Store className="w-3.5 h-3.5" />
                    <span>{o.shop_name || 'ร้านค้า'}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                        isSelected
                          ? 'bg-white/25 text-white'
                          : o.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : o.status === 'delivering'
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {o.status === 'completed'
                        ? 'ส่งถึงแล้ว'
                        : o.status === 'delivering'
                        ? 'กำลังส่ง'
                        : o.status === 'cooking'
                        ? 'กำลังทำ'
                        : 'รอรับ/โอน'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            
            {/* Status Stepper */}
            {activeOrder.status === 'cancelled' ? (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
                <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-1" />
                <h4 className="font-bold text-red-700">ออเดอร์นี้ถูกยกเลิก</h4>
                <p className="text-xs text-red-600 mt-0.5">ร้านค้าไม่สะดวกรับออเดอร์ หรือวัตถุดิบหมด</p>
              </div>
            ) : (
              <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-amber-900 flex items-center gap-1">
                    <Store className="w-3.5 h-3.5 text-amber-600" />
                    ร้าน {activeOrder.shop_name || 'ร้านค้าชุมชน'}
                  </span>
                  <span className="text-[10px] bg-white px-2 py-0.5 rounded-full text-amber-800 font-bold border border-amber-200 flex items-center gap-1">
                    <Bike className="w-3 h-3" />
                    <span>{(activeOrder.delivery_fee ?? 0) === 0 ? 'ร้านส่งฟรี' : `ร้านส่งเอง (${activeOrder.delivery_fee} บ.)`}</span>
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-1 relative">
                  {steps.map((s, idx) => {
                    const isPassed = currentStep >= idx;
                    const isCurrent = currentStep === idx;
                    const Icon = s.icon;

                    return (
                      <div key={s.key} className="flex flex-col items-center text-center relative z-10">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                            isCurrent
                              ? 'bg-amber-500 text-white shadow-lg ring-4 ring-amber-200 animate-pulse'
                              : isPassed
                              ? 'bg-emerald-500 text-white'
                              : 'bg-gray-200 text-gray-400'
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <span className={`text-[11px] font-bold mt-1.5 ${isCurrent ? 'text-amber-700 font-extrabold' : isPassed ? 'text-emerald-700' : 'text-gray-400'}`}>
                          {s.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 text-center bg-white/80 py-1.5 px-3 rounded-xl border border-amber-100">
                  <p className="text-xs font-semibold text-amber-900">
                    {steps[currentStep]?.desc || 'กำลังดำเนินการ'}
                  </p>
                </div>
              </div>
            )}

            {/* Pending Pre-payment Banner */}
            {activeOrder.status === 'pending' && (
              <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 rounded-2xl p-3.5 text-white shadow-md space-y-2.5 border border-amber-300 animate-in fade-in">
                <div className="flex items-start gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0 shadow-inner">
                    <CreditCard className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-black text-xs sm:text-sm leading-tight">
                      กรุณาโอนเงินผ่านแชทเพื่อเริ่มทำอาหาร
                    </h4>
                    <p className="text-[11px] text-amber-100 mt-0.5 leading-snug">
                      ร้านค้าจะส่ง QR พร้อมเพย์ / บัญชีในแชทสด โอนแล้วแนบสลิปยืนยัน ร้านจะเริ่มทำอาหารทันทีหลังได้รับยอดครับ
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowChat(true)}
                  className="w-full py-2.5 bg-white text-orange-600 hover:bg-amber-50 font-black rounded-xl text-xs shadow-md transition active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>เปิดแชทเพื่อโอนเงิน & ส่งสลิปทันที ➔</span>
                </button>
              </div>
            )}

            {/* If active order is completed, show review card */}
            {activeOrder.status === 'completed' && (
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-3.5 text-white shadow-md flex items-center justify-between gap-2 animate-in fade-in">
                <div>
                  <p className="font-bold text-xs flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
                    <span>อาหารร้านนี้ส่งถึงมือแล้ว!</span>
                  </p>
                  <p className="text-[11px] text-amber-100">ช่วยให้คะแนนและรีวิวเพื่อเป็นกำลังใจให้ร้านค้า</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowReviewModal(true)}
                  className="px-3.5 py-2 bg-white text-amber-600 hover:bg-amber-50 font-black rounded-xl text-xs shadow-sm transition active:scale-95 shrink-0 flex items-center gap-1.5"
                >
                  <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                  <span>ให้คะแนนร้าน</span>
                </button>
              </div>
            )}

            {/* Quick Action Buttons: Call & Chat with this specific merchant */}
            <div className="grid grid-cols-2 gap-2">
              <a
                href={`tel:${activeOrder.shop_phone || '0898765432'}`}
                className="flex items-center justify-center gap-2 py-2.5 px-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold rounded-2xl text-xs shadow-xs active:scale-95 transition"
              >
                <Phone className="w-4 h-4 text-emerald-600" />
                โทรหาร้านนี้
              </a>
              <button
                type="button"
                onClick={() => setShowChat(true)}
                className="flex items-center justify-center gap-2 py-2.5 px-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-2xl text-xs shadow-md active:scale-95 transition"
              >
                <MessageSquare className="w-4 h-4" />
                {activeOrder.status === 'completed' ? 'แชทหลังส่งอาหาร' : 'แชทกับร้านนี้'}
              </button>
            </div>
            {/* Post-delivery chat hint */}
            {activeOrder.status === 'completed' && (
              <p className="text-[11px] text-gray-400 text-center flex items-center justify-center gap-1">
                <MessageSquare className="w-3 h-3 text-gray-400" />
                <span>ยังคุยกับร้านได้ภายใน 24 ชั่วโมง หากมีปัญหาหลังรับอาหาร</span>
              </p>
            )}

            {/* Dismiss / Close Completed Order Button */}
            {activeOrder.status === 'completed' && (
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (onDismissOrder) {
                      onDismissOrder(activeOrder.id);
                    }
                    setOrdersList((prev) => {
                      const next = prev.filter((o) => o.id !== activeOrder.id);
                      if (next.length === 0) {
                        onClose();
                      } else {
                        setSelectedOrderId(next[0].id);
                      }
                      return next;
                    });
                  }}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-xs sm:text-sm rounded-2xl shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition active:scale-95"
                >
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>ได้รับอาหารเรียบร้อยแล้ว (ปิดการติดตามออเดอร์นี้)</span>
                </button>

                {ordersList.length > 1 && ordersList.every((o) => o.status === 'completed') && (
                  <button
                    type="button"
                    onClick={() => {
                      if (onDismissAllCompleted) {
                        onDismissAllCompleted();
                      }
                      onClose();
                    }}
                    className="w-full py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <span>ปิดการติดตามทั้งหมด ({ordersList.length} ร้านค้า)</span>
                  </button>
                )}
              </div>
            )}

            {/* Cancel order button if still pending */}
            {activeOrder.status === 'pending' && (
              <button
                type="button"
                onClick={async () => {
                  const ok = window.confirm('คุณต้องการยกเลิกคำสั่งซื้อนี้ใช่หรือไม่?');
                  if (!ok) return;
                  try {
                    await updateDoc(doc(db, 'orders', activeOrder.id), {
                      status: 'cancelled',
                      cancelled_by: 'customer',
                      cancelled_at: serverTimestamp(),
                    });
                  } catch (err) {
                    console.warn('Cancel order error:', err);
                    alert('ไม่สามารถยกเลิกคำสั่งซื้อได้ กรุณาลองใหม่อีกครั้ง');
                  }
                }}
                className="w-full py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-2xl text-xs font-bold transition active:scale-95 flex items-center justify-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                <span>ยกเลิกคำสั่งซื้อนี้ (เนื่องจากร้านยังไม่ได้รับออเดอร์)</span>
              </button>
            )}

            {/* Order Items for this shop */}
            <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-100 space-y-2">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                รายการอาหารของร้าน {activeOrder.shop_name || 'ร้านค้าชุมชน'}
              </h4>
              <div className="divide-y divide-gray-100">
                {activeOrder.items.map((item, idx) => (
                  <div key={idx} className="py-1.5 flex justify-between items-start text-sm">
                    <div className="pr-2">
                      <span className="font-semibold text-gray-800">{item.name}</span>
                      <span className="text-xs text-gray-500 ml-1.5">x{item.quantity}</span>
                      {item.selected_options && item.selected_options.length > 0 && (
                        <div className="text-[11px] text-amber-800/90 pl-1 space-y-0.5 mt-0.5">
                          {item.selected_options.map((opt, oIdx) => (
                            <div key={oIdx}>↳ + {opt.name} {opt.price > 0 ? `(+${opt.price} ฿)` : '(ฟรี)'}</div>
                          ))}
                        </div>
                      )}
                      {item.note && (
                        <p className="text-[11px] text-amber-700 mt-0.5">({item.note})</p>
                      )}
                    </div>
                    <span className="font-bold text-gray-700 shrink-0">
                      {orderItemUnitPrice(item) * item.quantity} ฿
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-gray-200 space-y-1 text-xs">
                <div className="flex justify-between text-gray-600">
                  <span>ค่าอาหารร้านนี้</span>
                  <span>{activeOrder.food_subtotal} ฿</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>ค่าส่งเหมา (ร้านส่งเอง)</span>
                  <span className="text-emerald-600 font-bold">{activeOrder.delivery_fee} ฿</span>
                </div>
                <div className="flex justify-between text-base font-black text-amber-600 pt-1 border-t border-gray-200">
                  <span>ยอดที่ต้องจ่ายให้ร้านนี้</span>
                  <span>{activeOrder.total_amount} ฿</span>
                </div>
              </div>
            </div>

            {/* Delivery Info */}
            <div className="bg-white rounded-2xl p-3.5 border border-gray-200 text-xs space-y-1.5 shadow-xs">
              <div className="flex items-start gap-1.5 text-gray-700">
                <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">สถานที่ส่ง: </span>
                  <span>{activeOrder.delivery_address}</span>
                  {activeOrder.location && (
                    <span className="text-[10px] text-gray-400 block">
                      พิกัด GPS: {activeOrder.location.lat.toFixed(4)}, {activeOrder.location.lng.toFixed(4)}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-gray-600 pt-1 border-t border-gray-100">
                <span className="font-bold">วิธีชำระเงิน: </span>
                <span>
                  {activeOrder.payment_method === 'transfer_chat'
                    ? 'โอนเงินผ่านแชทสด (ส่งสลิปในแชท)'
                    : activeOrder.payment_method === 'cash'
                    ? 'เงินสด (ตามที่ตกลงกับร้านค้า)'
                    : 'สแกนจ่ายกับคนส่ง'}
                </span>
                {activeOrder.cash_change_note && (
                  <span className="text-amber-700 block">
                    ({activeOrder.cash_change_note})
                  </span>
                )}
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* Embedded Chat Modal */}
      {showChat && (
        <ChatModal
          orderId={activeOrder.id}
          orderCode={formatOrderCode(activeOrder)}
          shopName={activeOrder.shop_name || 'ร้านค้า'}
          shopImage={activeOrder.shop_image}
          customerName={activeOrder.customer_name}
          customerImage={activeOrder.customer_avatar || currentUser?.picture_url}
          currentUser={{
            uid: currentUser?.uid || activeOrder.customer_uid || 'guest_customer',
            name: currentUser?.display_name || activeOrder.customer_name || 'ลูกค้า',
            role: (currentUser?.role as UserRole) || 'customer',
            picture_url: currentUser?.picture_url || activeOrder.customer_avatar || '',
          }}
          onClose={() => setShowChat(false)}
        />
      )}

      {/* Review Modal */}
      {showReviewModal && (
        <ReviewModal
          shopId={activeOrder.shop_id}
          shopName={activeOrder.shop_name || 'ร้านค้า'}
          orderId={activeOrder.id}
          currentUser={currentUser}
          onClose={() => setShowReviewModal(false)}
        />
      )}
    </>
  );
}
