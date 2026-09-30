'use client';

import React, { useState, useRef, useMemo } from 'react';
import { X, Trash2, Plus, Minus, MapPin, Navigation, Banknote, QrCode, ArrowRight, Store, Bike, Info, MessageCircle, Lock, ShoppingCart, AlertCircle, AlertTriangle, CheckCircle2, Home } from 'lucide-react';
import { useCart, ShopCartGroup } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { Order, PaymentMethod } from '@/types';
import MapPicker from './MapPicker';
import TermsModal from './TermsModal';
import {
  getCurrentLocation,
  locationErrorMessage,
  DEFAULT_CAMPUS_LOCATION,
  MAX_DELIVERY_RADIUS_KM,
  getDistanceKm,
  formatDistance,
} from '@/lib/geolocation';
import { soundAlert } from '@/lib/soundAlert';


interface CartCheckoutModalProps {
  onClose: () => void;
  onRequireAuth?: () => void;
  onOrderSuccess: (primaryOrderId: string, primaryOrder: Order, allOrders?: Order[]) => void;
}

export default function CartCheckoutModal({ onClose, onRequireAuth, onOrderSuccess }: CartCheckoutModalProps) {
  const {
    items,
    groupedItems,
    shopsInCart,
    shopCount,
    deliveryFee,
    subtotal,
    total,
    gpAmount,
    updateQuantity,
    removeItem,
    clearCart
  } = useCart();
  const { user, updateUserPhone, updateUserProfile } = useAuth();

  const [customerName, setCustomerName] = useState(() => {
    try {
      const draft = sessionStorage.getItem('hchk_checkout_draft');
      if (draft) return JSON.parse(draft).customerName || user?.display_name || '';
    } catch (_) {}
    return user?.display_name || '';
  });
  const [customerPhone, setCustomerPhone] = useState(() => {
    try {
      const draft = sessionStorage.getItem('hchk_checkout_draft');
      if (draft) return JSON.parse(draft).customerPhone || user?.phone || '';
    } catch (_) {}
    return user?.phone || '';
  });
  const [deliveryAddress, setDeliveryAddress] = useState(() => {
    try {
      const draft = sessionStorage.getItem('hchk_checkout_draft');
      if (draft) return JSON.parse(draft).deliveryAddress || user?.default_address || '';
    } catch (_) {}
    return user?.default_address || '';
  });
  const [location, setLocation] = useState<{ lat: number; lng: number }>(() => {
    try {
      const draft = sessionStorage.getItem('hchk_checkout_draft');
      if (draft && JSON.parse(draft).location) return JSON.parse(draft).location;
    } catch (_) {}
    return user?.default_location || { lat: 15.8272, lng: 102.0298 };
  });
  const [addressMode, setAddressMode] = useState<'profile' | 'current' | 'custom'>(() => {
    try {
      const draft = sessionStorage.getItem('hchk_checkout_draft');
      if (draft && JSON.parse(draft).addressMode) return JSON.parse(draft).addressMode;
    } catch (_) {}
    return user?.default_address ? 'profile' : 'custom';
  });
  const [saveToProfile, setSaveToProfile] = useState(false);
  const [isLocatingGPS, setIsLocatingGPS] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(() => {
    try {
      const draft = sessionStorage.getItem('hchk_checkout_draft');
      if (draft && JSON.parse(draft).paymentMethod) return JSON.parse(draft).paymentMethod;
    } catch (_) {}
    return 'transfer_chat';
  });
  const [cashChangeNote, setCashChangeNote] = useState(() => {
    try {
      const draft = sessionStorage.getItem('hchk_checkout_draft');
      if (draft && JSON.parse(draft).cashChangeNote !== undefined) return JSON.parse(draft).cashChangeNote;
    } catch (_) {}
    return '';
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showTerms, setShowTerms] = useState(false);
  const idempotencyKeyRef = useRef<string>(`idemp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);

  // Persist form draft across modal closes/refreshes
  React.useEffect(() => {
    try {
      sessionStorage.setItem('hchk_checkout_draft', JSON.stringify({
        customerName,
        customerPhone,
        deliveryAddress,
        location,
        addressMode,
        paymentMethod,
        cashChangeNote,
      }));
    } catch (_) {}
  }, [customerName, customerPhone, deliveryAddress, location, addressMode, paymentMethod, cashChangeNote]);

  const hasOwnShopItems = Boolean(
    user && user.role === 'merchant' && user.shop_id &&
    groupedItems.some(group => group.shop.id === user.shop_id)
  );

  const shopCenterLocation = useMemo(() => {
    return shopsInCart[0]?.location || DEFAULT_CAMPUS_LOCATION;
  }, [shopsInCart]);

  const deliveryDistanceKm = useMemo(() => {
    return getDistanceKm(shopCenterLocation.lat, shopCenterLocation.lng, location.lat, location.lng);
  }, [shopCenterLocation, location]);

  const isDeliveryOutOfRange = deliveryDistanceKm > (MAX_DELIVERY_RADIUS_KM + 0.05);

  // 1. If not logged in, prompt to log in first!
  if (!user) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-6 text-center max-w-sm w-full space-y-4 shadow-2xl animate-in zoom-in-95">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto shadow-inner">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-black text-lg text-gray-900">กรุณาเข้าสู่ระบบก่อน</h3>
            <p className="text-xs text-gray-500 mt-1">
              คุณต้องเข้าสู่ระบบหรือสมัครสมาชิกก่อนเปิดดูตะกร้าและสั่งอาหาร
            </p>
          </div>
          <div className="space-y-2 pt-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onRequireAuth?.();
              }}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 text-white rounded-2xl font-bold text-xs shadow-md active:scale-95 transition"
            >
              เข้าสู่ระบบ / สมัครสมาชิก
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 text-xs font-semibold text-gray-400 hover:text-gray-600"
            >
              ไว้คราวหลัง
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. If cart is empty
  if (items.length === 0) {
    return (
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-6 text-center max-w-sm w-full space-y-3 shadow-xl">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-gray-800">ตะกร้าของคุณว่างเปล่า</h3>
          <p className="text-xs text-gray-500">เลือกอาหารหรือเครื่องดื่มเพื่อเริ่มสั่งซื้อ</p>
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-amber-500 text-white rounded-2xl font-bold text-sm"
          >
            ไปดูเมนู
          </button>
        </div>
      </div>
    );
  }

  const handleUseCurrentGPS = async () => {
    if (isLocatingGPS) return;
    setAddressMode('current');
    setIsLocatingGPS(true);
    setErrorMsg('');
    try {
      const pos = await getCurrentLocation();
      setLocation(pos);
      const dist = getDistanceKm(shopCenterLocation.lat, shopCenterLocation.lng, pos.lat, pos.lng);
      if (dist > MAX_DELIVERY_RADIUS_KM) {
        setErrorMsg(`พิกัด GPS ปัจจุบันของคุณ (${formatDistance(dist)}) อยู่นอกรัศมีบริการ ${MAX_DELIVERY_RADIUS_KM} กม. กรุณาเลื่อนหมุดมาอยู่ในเขตบริการ`);
      }
    } catch (error) {
      setErrorMsg(locationErrorMessage(error));
    } finally {
      setIsLocatingGPS(false);
    }
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      if (onRequireAuth) {
        onRequireAuth();
      } else {
        setErrorMsg('กรุณาเข้าสู่ระบบก่อนทำการสั่งซื้อ');
      }
      return;
    }
    if (!customerName.trim()) {
      setErrorMsg('กรุณาระบุชื่อผู้รับ');
      return;
    }
    const cleanPhone = customerPhone.replace(/[-\s]/g, '');
    if (!cleanPhone || !/^0[0-9]{9}$/.test(cleanPhone)) {
      setErrorMsg('กรุณาระบุเบอร์โทรศัพท์ 10 หลักที่ติดต่อได้จริง (เช่น 0812345678) ร้านค้าจะโทรยืนยันออเดอร์ก่อนจัดส่ง');
      return;
    }
    if (!deliveryAddress.trim()) {
      setErrorMsg('กรุณากรอกรายละเอียดสถานที่จัดส่ง เช่น หอพัก / เลขห้อง');
      return;
    }

    if (hasOwnShopItems) {
      setErrorMsg('คุณไม่สามารถสั่งอาหารจากร้านของตนเองได้ กรุณาลบเมนูของร้านตนเองออกจากตะกร้าก่อนสั่งซื้อ (คุณสามารถสั่งอาหารจากร้านอื่นได้ตามปกติครับ)');
      return;
    }

    if (isDeliveryOutOfRange) {
      setErrorMsg(`ขออภัย จุดจัดส่งของคุณอยู่นอกพื้นที่บริการ (${formatDistance(deliveryDistanceKm)}) ระบบจำกัดระยะจัดส่งไม่เกิน ${MAX_DELIVERY_RADIUS_KM} กม. กรุณาเลื่อนหมุดมาอยู่ในเขตบริการ`);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    if (cleanPhone !== user?.phone) {
      updateUserPhone(cleanPhone);
    }

    if (saveToProfile && user) {
      updateUserProfile({
        default_address: deliveryAddress.trim(),
        default_location: location,
      }).catch(console.warn);
    }

    const bundleId = `bundle_${Date.now()}`;

    try {
      const checkout = httpsCallable<{
        idempotency_key: string;
        group_id: string;
        customer_name: string;
        customer_phone: string;
        customer_avatar: string;
        delivery_address: string;
        location: { lat: number; lng: number };
        payment_method: PaymentMethod;
        cash_change_note?: string | null;
        orders: Array<{
          shop_id: string;
          items: Array<{
            menu_id: string;
            quantity: number;
            selected_options?: any[];
            note?: string;
          }>;
        }>;
      }, {
        success: boolean;
        orderIds: string[];
        orders: Order[];
        groupId: string;
      }>(functions, 'checkoutOrder');

      const response = await checkout({
        idempotency_key: idempotencyKeyRef.current,
        group_id: bundleId,
        customer_name: customerName.trim(),
        customer_phone: cleanPhone,
        customer_avatar: user.picture_url || '',
        delivery_address: deliveryAddress.trim(),
        location: location,
        payment_method: paymentMethod,
        cash_change_note: paymentMethod === 'cash' ? (cashChangeNote || '') : null,
        orders: groupedItems.map((group) => ({
          shop_id: group.shop.id,
          items: group.items.map((it) => ({
            menu_id: it.menu_id,
            quantity: it.quantity,
            selected_options: Array.isArray(it.selected_options) ? it.selected_options : [],
            note: it.note || '',
          })),
        })),
      });

      const createdOrders = response.data?.orders || [];

      // Safe offline fallback storage sync (isolated so storage errors never reject order)
      try {
        const cachedRaw = localStorage.getItem('hchk_orders');
        const existingOrders = cachedRaw ? JSON.parse(cachedRaw) : [];
        if (Array.isArray(existingOrders)) {
          existingOrders.unshift(...createdOrders);
          localStorage.setItem('hchk_orders', JSON.stringify(existingOrders.slice(0, 50)));
        }
      } catch (storageErr) {
        console.warn('LocalStorage order cache sync non-critical warning:', storageErr);
      }

      clearCart();
      try {
        sessionStorage.removeItem('hchk_checkout_draft');
      } catch (_) {}
      setIsSubmitting(false);

      if (createdOrders.length > 0) {
        soundAlert.playOrderPlacedSound().catch(() => {});
        onOrderSuccess(createdOrders[0].id, createdOrders[0], createdOrders);
      } else {
        setErrorMsg('ไม่สามารถสร้างคำสั่งซื้อได้ กรุณาลองใหม่อีกครั้ง');
      }
    } catch (err: any) {
      console.error('Submit order error:', err);
      const msg = err?.message || '';
      if (msg.includes('ร้านค้าปิด')) {
        setErrorMsg('ขออภัย ร้านค้าปิดให้บริการอยู่ในขณะนี้');
      } else if (msg.includes('เครดิต')) {
        setErrorMsg('ขออภัย ร้านค้าไม่สามารถรับออเดอร์ได้ชั่วคราว');
      } else {
        setErrorMsg(err?.message || 'เกิดข้อผิดพลาดในการส่งคำสั่งซื้อ กรุณาลองใหม่อีกครั้ง');
      }
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3">
      <div className="bg-white w-full max-w-md md:max-w-2xl max-h-[92vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-4 text-white flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <Store className="w-5 h-5 text-amber-100" />
            <div>
              <h2 className="font-bold text-base leading-tight">ตะกร้าสั่งอาหาร</h2>
              <p className="text-xs text-amber-100">
                {shopCount === 1 ? shopsInCart[0]?.name : `${shopCount} ร้านค้า (ร้านแยกกันส่ง)`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-black/15 hover:bg-black/25 flex items-center justify-center transition active:scale-95"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Scrollable Body */}
        <form onSubmit={handleSubmitOrder} className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-600 font-medium flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Multi-shop Delivery Notice */}
          {shopCount > 1 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">คุณกำลังสั่งอาหารจาก {shopCount} ร้านค้า</span>
                <span className="text-[11px] text-amber-800">
                  เนื่องจากแต่ละร้านเป็นผู้จัดส่งเอง แต่ละร้านจะแยกกันส่งถึงมือ คิดค่าจัดส่งตามแต่ละร้านกำหนดครับ
                </span>
              </div>
            </div>
          )}

          {/* Cart Items Grouped by Shop */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-gray-500 px-1">
              <span>รายการสินค้า ({items.length} รายการ จาก {shopCount} ร้าน)</span>
              <button
                type="button"
                onClick={clearCart}
                className="text-red-500 hover:text-red-600 flex items-center gap-0.5 text-[11px]"
              >
                <Trash2 className="w-3 h-3" /> ล้างตะกร้า
              </button>
            </div>

            {groupedItems.map((group) => {
              const isGroupOwnShop = Boolean(user?.role === 'merchant' && user?.shop_id === group.shop.id);
              return (
                <div
                  key={group.shop.id}
                  className={`bg-white rounded-2xl border p-3.5 shadow-2xs space-y-2.5 ${
                    isGroupOwnShop ? 'border-rose-300 ring-2 ring-rose-100' : 'border-gray-200'
                  }`}
                >
                  {isGroupOwnShop && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-800 text-xs font-bold">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>(ร้านของคุณ) ระบบไม่อนุญาตให้สั่งอาหารจากร้านของตนเอง กรุณากดลบรายการออก</span>
                    </div>
                  )}

                  {/* Shop Group Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold">
                        <Store className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-gray-800 leading-tight">
                          {group.shop.name}
                        </h4>
                        <p className="text-[10px] text-gray-400">
                          {group.items.length} เมนู • {group.deliveryFee === 0 ? 'ส่งฟรี (ร้านส่งเอง)' : `ค่าส่ง ${group.deliveryFee} บ. (ร้านส่งเอง)`}
                        </p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      group.deliveryFee === 0
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}>
                      {group.deliveryFee === 0 ? 'ส่งฟรี' : `+ ค่าส่ง ${group.deliveryFee} บ.`}
                    </span>
                  </div>

                {/* Items in this shop */}
                <div className="divide-y divide-gray-50">
                  {group.items.map((item) => (
                    <div key={item.cart_item_id || item.menu_id} className="py-2 flex items-center justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-gray-800 leading-tight">{item.name}</p>
                        <p className="text-xs text-amber-600 font-bold mt-0.5">
                          {item.unit_price ?? item.price} ฿
                        </p>
                        {item.selected_options && item.selected_options.length > 0 && (
                          <div className="text-[10px] text-amber-800/90 pl-1 space-y-0.5 mt-0.5">
                            {item.selected_options.map((opt, oIdx) => (
                              <div key={oIdx}>↳ + {opt.name} {opt.price > 0 ? `(+${opt.price} ฿)` : '(ฟรี)'}</div>
                            ))}
                          </div>
                        )}
                        {item.note && (
                          <p className="text-[10px] text-gray-400 italic mt-0.5">({item.note})</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 bg-gray-50 px-2 py-1 rounded-xl border border-gray-200 shadow-2xs">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.cart_item_id || item.menu_id, -1)}
                          className="w-5 h-5 rounded-md bg-white text-gray-700 flex items-center justify-center hover:bg-gray-200 active:scale-95 transition"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-bold text-gray-800 w-3 text-center">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.cart_item_id || item.menu_id, 1)}
                          className="w-5 h-5 rounded-md bg-amber-500 text-white flex items-center justify-center hover:bg-amber-600 active:scale-95 transition"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Subtotal of this shop */}
                <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                  <span>อาหาร {group.subtotal} ฿ {group.deliveryFee === 0 ? '+ ส่งฟรี' : `+ ค่าส่ง ${group.deliveryFee} ฿`}</span>
                  <span className="font-bold text-gray-800">รวมร้านนี้: {group.total} ฿</span>
                </div>
              </div>
            ); })}

            {/* Bill Overall Breakdown */}
            <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-200 space-y-1.5 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>ค่าอาหารรวมทั้งหมด ({items.length} รายการ)</span>
                <span className="font-semibold">{subtotal} ฿</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>ค่าส่งรวม ({shopCount} ร้าน)</span>
                <span className="text-emerald-600 font-bold">{deliveryFee === 0 ? 'ส่งฟรี (0 ฿)' : `${deliveryFee} ฿`}</span>
              </div>
              <div className="flex justify-between text-base font-black text-amber-600 pt-2 border-t border-gray-200">
                <span>ยอดรวมที่ต้องชำระ</span>
                <span>{total} ฿</span>
              </div>
            </div>
          </div>

          {/* Delivery & Customer Info */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              ข้อมูลผู้รับและจุดจัดส่ง
            </h3>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">ชื่อผู้รับ</label>
                <input
                  type="text"
                  required
                  placeholder="เช่น น้องต้น"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">เบอร์โทรศัพท์</label>
                <input
                  type="tel"
                  required
                  placeholder="08x-xxx-xxxx"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Address Mode Selector Chips */}
            <div className="bg-gray-100 p-1 rounded-2xl flex gap-1 text-xs">
              {user?.default_address ? (
                <button
                  type="button"
                  onClick={() => {
                    setAddressMode('profile');
                    if (user.default_address) setDeliveryAddress(user.default_address);
                    if (user.default_location) setLocation(user.default_location);
                  }}
                  className={`flex-1 py-1.5 px-2 rounded-xl font-bold transition flex items-center justify-center gap-1 ${
                    addressMode === 'profile'
                      ? 'bg-white text-amber-700 shadow-xs border border-amber-200/60'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Home className="w-3.5 h-3.5 text-amber-600" />
                  <span>ที่อยู่โปรไฟล์</span>
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleUseCurrentGPS}
                disabled={isLocatingGPS}
                className={`flex-1 py-1.5 px-2 rounded-xl font-bold transition flex items-center justify-center gap-1 ${
                  addressMode === 'current'
                    ? 'bg-white text-amber-700 shadow-xs border border-amber-200/60'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Navigation className="w-3.5 h-3.5 text-amber-600" />
                <span>{isLocatingGPS ? 'กำลังค้นหา...' : 'GPS ปัจจุบัน'}</span>
              </button>
              <button
                type="button"
                onClick={() => setAddressMode('custom')}
                className={`flex-1 py-1.5 px-2 rounded-xl font-bold transition flex items-center justify-center gap-1 ${
                  addressMode === 'custom'
                    ? 'bg-white text-amber-700 shadow-xs border border-amber-200/60'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <MapPin className="w-3.5 h-3.5 text-amber-600" />
                <span>ระบุเอง / ปรับหมุด</span>
              </button>
            </div>

            {/* Map Pinning Component */}
            <MapPicker
              location={location}
              centerLocation={shopCenterLocation}
              maxRadiusKm={MAX_DELIVERY_RADIUS_KM}
              showRadiusCircle={true}
              onChange={(loc) => {
                setLocation(loc);
                if (addressMode === 'profile') setAddressMode('custom');
              }}
            />

            {/* Free-text Address Detail */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-gray-600 block">
                  สถานที่ส่ง / จุดนัดรับ (พิมพ์เองอิสระ)
                </label>
                {addressMode === 'profile' && (
                  <span className="text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-bold">
                    ใช้ที่อยู่จากโปรไฟล์
                  </span>
                )}
              </div>
              <textarea
                required
                rows={2}
                placeholder="เช่น หอพักพรเทพ ห้อง 204 ซอยข้าง 7-11 หรือ ใต้ตึก 5 คณะครุศาสตร์"
                value={deliveryAddress}
                onChange={(e) => {
                  setDeliveryAddress(e.target.value);
                  if (addressMode === 'profile') setAddressMode('custom');
                }}
                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 resize-none"
              />

              {/* Save to Profile Checkbox */}
              <label className="mt-2.5 flex items-center gap-2 cursor-pointer select-none text-xs text-gray-600 bg-amber-50/60 p-2 rounded-xl border border-amber-200/50">
                <input
                  type="checkbox"
                  checked={saveToProfile}
                  onChange={(e) => setSaveToProfile(e.target.checked)}
                  className="rounded-sm text-amber-500 focus:ring-amber-400 w-4 h-4 cursor-pointer accent-amber-500"
                />
                <span className="font-medium text-amber-950">บันทึกที่อยู่นี้และหมุดนี้เป็นค่าเริ่มต้นในโปรไฟล์ด้วย</span>
              </label>
            </div>
          </div>

          {/* Out of Service Radius Warning Alert */}
          {isDeliveryOutOfRange && (
            <div className="p-3.5 bg-rose-50 border-2 border-rose-200 rounded-2xl flex items-start gap-2.5 text-rose-900 shadow-2xs">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5 animate-bounce" />
              <div className="space-y-1">
                <p className="font-bold text-xs text-rose-900">
                  จุดจัดส่งอยู่นอกรัศมีบริการ {MAX_DELIVERY_RADIUS_KM} กม. (ระยะทางปัจจุบัน: {formatDistance(deliveryDistanceKm)})
                </p>
                <p className="text-[11px] text-rose-700 leading-relaxed">
                  ระบบเปิดรับออเดอร์เฉพาะในเขตบริการไม่เกิน 3 กิโลเมตรจากร้านค้า / มรภ.ชัยภูมิ เพื่อรักษาคุณภาพและความรวดเร็วในการจัดส่งอาหาร กรุณาเลื่อนหรือปักหมุดใหม่อีกครั้ง
                </p>
              </div>
            </div>
          )}

          {/* Payment Method */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                วิธีชำระเงิน (โอนผ่านแชทก่อนเริ่มทำอาหาร)
              </h3>
              <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                ร้านค้าส่งตรง
              </span>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-2xl border border-amber-500 bg-amber-50/70 shadow-xs ring-1 ring-amber-400">
              <div className="p-2.5 rounded-xl shrink-0 bg-amber-500 text-white shadow-xs">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-xs font-bold text-gray-900">โอนเงินผ่านแชทสดกับร้านค้า</p>
                  <span className="bg-emerald-600 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full">
                    แนะนำ
                  </span>
                </div>
                <p className="text-[11px] text-gray-600 mt-1 leading-relaxed">
                  ร้านค้าจะส่ง QR พร้อมเพย์ / บัญชีธนาคารในห้องแชทสด โอนแล้วแนบสลิปเพื่อเริ่มทำอาหารทันที
                </p>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <p className="text-center text-[11px] text-gray-600 mb-2 leading-relaxed">
              คุณกำลังสั่งซื้อจากร้านค้าโดยตรง ร้านรับผิดชอบอาหารและจัดส่งเอง<br />
              huaychan ดูแลระบบสั่งซื้อและช่วยประสานงานเมื่อมีปัญหา
            </p>
            <p className="text-center text-[11px] text-gray-500 mb-2">
              การกดสั่งซื้อถือว่าคุณยอมรับ{' '}
              <button
                type="button"
                onClick={() => setShowTerms(true)}
                className="text-amber-600 hover:text-amber-700 underline font-bold inline-flex items-center"
              >
                ข้อกำหนดการใช้บริการ
              </button>
            </p>
            <button
              type="submit"
              disabled={isSubmitting || hasOwnShopItems || isDeliveryOutOfRange}
              className={`w-full py-3.5 rounded-2xl font-bold text-sm sm:text-base shadow-lg flex items-center justify-center gap-2 active:scale-98 transition ${
                hasOwnShopItems || isDeliveryOutOfRange
                  ? 'bg-gray-300 shadow-none cursor-not-allowed text-gray-600'
                  : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-orange-500/25'
              }`}
            >
              <span>
                {hasOwnShopItems
                  ? 'กรุณาลบเมนูร้านของตนเองออกก่อนสั่งซื้อ'
                  : isDeliveryOutOfRange
                  ? `จุดส่งเกิน 3 กม. (${formatDistance(deliveryDistanceKm)})`
                  : isSubmitting
                  ? 'กำลังส่งออเดอร์...'
                  : `ยืนยันสั่งซื้อ & ไปชำระเงิน (${total} บาท)`}
              </span>
              {!hasOwnShopItems && !isDeliveryOutOfRange && <ArrowRight className="w-5 h-5" />}
            </button>
            <p className="text-center text-[11px] text-gray-400 mt-2">
              โอนชำระเงินกับร้านค้าผ่านแชทสดก่อนเริ่มปรุงอาหาร • ร้านค้าเป็นผู้จัดส่งเอง
            </p>
          </div>

        </form>

      </div>

      {/* Terms of Service Modal */}
      <TermsModal
        isOpen={showTerms}
        onClose={() => setShowTerms(false)}
        defaultTab="customer"
      />
    </div>
  );
}
