'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X, Phone, MapPin, Plus, Store, Star, Flame, MessageSquare,
  UtensilsCrossed, CupSoda, Search, Minus, Check, Navigation,
  Lock, Sparkles, FileEdit, Bike, AlertCircle
} from 'lucide-react';
import { Shop, MenuItem, MenuItemOption, OptionGroup, OptionItem, ShopReview } from '@/types';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import ReviewModal from './ReviewModal';

interface ShopDetailModalProps {
  shop: Shop;
  menuItems: MenuItem[];
  onClose: () => void;
  onOpenCart: () => void;
  onRequireLogin?: () => void;
}

export default function ShopDetailModal({ shop, menuItems, onClose, onOpenCart, onRequireLogin }: ShopDetailModalProps) {
  const { user } = useAuth();
  const { addItem, confirmSwitchShopAndAdd, itemCount, total, deliveryFee } = useCart();
  const [activeTab, setActiveTab] = useState<'menu' | 'reviews'>('menu');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'food' | 'drink_dessert'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [reviews, setReviews] = useState<ShopReview[]>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [systemSettings, setSystemSettings] = useState<{ gp_enabled?: boolean; gp_percent?: number } | null>(null);

  // Item Customization & Toppings State
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<MenuItemOption[]>([]);
  const [selectedGroupOptions, setSelectedGroupOptions] = useState<Record<string, OptionItem[]>>({});
  const [validationError, setValidationError] = useState<string | null>(null);
  const [customNote, setCustomNote] = useState('');
  const [customQuantity, setCustomQuantity] = useState(1);

  // Realtime System Settings Listener
  useEffect(() => {
    try {
      const unsub = onSnapshot(doc(db, 'system_settings', 'general'), (snap) => {
        if (snap.exists()) {
          setSystemSettings(snap.data() as any);
        }
      });
      return () => unsub();
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (!shop.id) return;
    try {
      const q = query(collection(db, 'shop_reviews'), where('shop_id', '==', shop.id));
      const unsub = onSnapshot(q, (snapshot) => {
        const list: ShopReview[] = [];
        snapshot.forEach((d) => {
          const review = { id: d.id, ...d.data() } as ShopReview;
          if (Number.isInteger(review.rating) && review.rating >= 1 && review.rating <= 5) list.push(review);
        });
        list.sort((a, b) => {
          const tA = a.created_at?.toMillis?.() || 0;
          const tB = b.created_at?.toMillis?.() || 0;
          return tB - tA;
        });
        setReviews(list);
      }, (err) => console.warn('Shop reviews listener fallback:', err));

      return () => unsub();
    } catch (e) {
      console.warn('Reviews subscription error:', e);
    }
  }, [shop.id]);

  const isOwnShop = Boolean(user && user.role === 'merchant' && user.shop_id && user.shop_id === shop.id);
  const isShopOpenAndReady = shop.is_open !== false && !(systemSettings?.gp_enabled === true && (shop.credit_balance ?? 0) <= 0);

  const handleItemClick = (item: MenuItem) => {
    if (!user) {
      if (onRequireLogin) onRequireLogin();
      return;
    }
    if (isOwnShop) {
      alert('คุณไม่สามารถสั่งอาหารจากร้านของตนเองได้ (คุณยังสามารถสั่งอาหารจากร้านอื่นได้ตามปกติครับ)');
      return;
    }
    if (!isShopOpenAndReady || !item.is_available) return;

    const hasGroups = item.option_groups && item.option_groups.length > 0;
    const hasLegacyOptions = item.options && item.options.length > 0;

    if (hasGroups || hasLegacyOptions) {
      setCustomizingItem(item);
      setSelectedOptions([]);
      setCustomNote('');
      setCustomQuantity(1);
      setValidationError(null);

      // Pre-select first item for required single groups (e.g. default noodle or soup)
      const initialGroupSelections: Record<string, OptionItem[]> = {};
      if (hasGroups) {
        item.option_groups?.forEach((grp) => {
          if (grp.type === 'single' && grp.required && grp.options.length > 0) {
            initialGroupSelections[grp.id] = [grp.options[0]];
          } else {
            initialGroupSelections[grp.id] = [];
          }
        });
      }
      setSelectedGroupOptions(initialGroupSelections);
    } else {
      addItem(item, { id: shop.id, name: shop.name, phone: shop.phone, delivery_fee: shop.delivery_fee });
    }
  };

  const selectGroupOption = (group: OptionGroup, opt: OptionItem) => {
    setValidationError(null);
    setSelectedGroupOptions((prev) => {
      const current = prev[group.id] || [];
      if (group.type === 'single') {
        const isAlready = current.some((o) => o.name === opt.name);
        if (isAlready && !group.required) {
          return { ...prev, [group.id]: [] };
        }
        return { ...prev, [group.id]: [opt] };
      } else {
        const exists = current.some((o) => o.name === opt.name);
        if (exists) {
          return { ...prev, [group.id]: current.filter((o) => o.name !== opt.name) };
        } else {
          if (group.max_select && current.length >= group.max_select) {
            return prev;
          }
          return { ...prev, [group.id]: [...current, opt] };
        }
      }
    });
  };

  const toggleOption = (opt: MenuItemOption) => {
    setValidationError(null);
    setSelectedOptions((prev) => {
      const exists = prev.some((o) => o.name === opt.name);
      if (exists) {
        return prev.filter((o) => o.name !== opt.name);
      } else {
        return [...prev, opt];
      }
    });
  };

  const allSelectedOptionsList: MenuItemOption[] = useMemo(() => {
    const groupOpts: MenuItemOption[] = [];
    if (customizingItem?.option_groups) {
      for (const grp of customizingItem.option_groups) {
        const selected = selectedGroupOptions[grp.id] || [];
        for (const opt of selected) {
          groupOpts.push({
            id: opt.id,
            name: opt.name,
            price: opt.price || 0,
            group_id: grp.id,
            group_title: grp.title || grp.name,
            option_id: opt.id,
          });
        }
      }
    }
    return [...selectedOptions, ...groupOpts];
  }, [customizingItem, selectedOptions, selectedGroupOptions]);

  const handleConfirmAddToCart = () => {
    if (!user) {
      if (onRequireLogin) onRequireLogin();
      return;
    }
    if (!customizingItem) return;

    // Validate required option groups (e.g. must select noodle line or soup)
    if (customizingItem.option_groups && customizingItem.option_groups.length > 0) {
      for (const grp of customizingItem.option_groups) {
        if (grp.required) {
          const selectedInGrp = selectedGroupOptions[grp.id] || [];
          const min = grp.min_select || 1;
          if (selectedInGrp.length < min) {
            setValidationError(`กรุณาเลือก "${grp.title}" ให้ครบถ้วนก่อนใส่ตะกร้า`);
            return;
          }
        }
      }
    }

    addItem(
      customizingItem,
      { id: shop.id, name: shop.name, phone: shop.phone, delivery_fee: shop.delivery_fee },
      customNote.trim(),
      allSelectedOptionsList,
      customQuantity
    );
    setCustomizingItem(null);
  };

  const foodItems = menuItems.filter((m) => m.category === 'food');
  const drinkItems = menuItems.filter((m) => m.category === 'drink_dessert');

  const filteredFoodItems = foodItems.filter((m) =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredDrinkItems = drinkItems.filter((m) =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayRating = reviews.length > 0
    ? Math.round((reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length) * 10) / 10
    : 0;

  const displayReviewCount = reviews.length;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3">
        <div className="bg-white w-full max-w-md md:max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
          
          {/* Cover Image & Header */}
          <div className="relative h-44 md:h-56 bg-slate-100 shrink-0">
            {shop.image_url ? (
              <img
                key={shop.image_url}
                src={shop.image_url}
                alt={shop.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-amber-500 via-orange-500 to-amber-700 flex flex-col items-center justify-center text-white select-none">
                <Store className="w-14 h-14 opacity-85 mb-1" />
                <span className="text-sm font-bold bg-black/25 backdrop-blur-xs px-3 py-1 rounded-full border border-white/20">
                  {shop.name}
                </span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent pointer-events-none" />

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-xs transition active:scale-95 z-10"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Shop Title Info Overlay */}
            <div className="absolute bottom-3 left-4 right-4 text-white">
              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isShopOpenAndReady ? 'bg-emerald-500' : 'bg-red-500'}`}>
                  {isShopOpenAndReady ? 'เปิดรับออเดอร์' : 'ปิดร้านชั่วคราว'}
                </span>
                
                <span className="text-[10px] bg-amber-500/90 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Star className="w-3 h-3 fill-white text-white" />
                  <span>{displayRating.toFixed(1)} ({displayReviewCount})</span>
                </span>

                {(shop.sales_count ?? 0) > 0 && (
                  <span className="text-[10px] bg-orange-600/90 font-black px-2 py-0.5 rounded-full flex items-center gap-0.5">
                    <Flame className="w-3 h-3 fill-white" />
                    <span>ขายแล้ว {shop.sales_count}</span>
                  </span>
                )}

                <span className="text-[10px] bg-white/20 backdrop-blur-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Bike className="w-3 h-3" />
                  <span>{(shop.delivery_fee ?? 0) === 0 ? 'ส่งฟรี' : `ค่าส่ง ${shop.delivery_fee} บ.`}</span>
                </span>
              </div>

              <h2 className="text-lg md:text-2xl font-black leading-tight drop-shadow-md">{shop.name}</h2>
              <div className="flex items-center gap-3 text-xs md:text-sm text-amber-100/90 mt-0.5 flex-wrap">
                <a href={`tel:${shop.phone}`} className="flex items-center gap-1 hover:underline">
                  <Phone className="w-3 h-3" /> {shop.phone}
                </a>
                {shop.address_detail && (
                  <span className="flex items-center gap-1 truncate max-w-[200px] sm:max-w-xs">
                    <MapPin className="w-3 h-3 shrink-0" /> {shop.address_detail}
                  </span>
                )}
                {shop.location?.lat && shop.location?.lng && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${shop.location.lat},${shop.location.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white font-bold px-2 py-0.5 rounded-full border border-white/30 text-[10px] backdrop-blur-xs transition active:scale-95"
                  >
                    <Navigation className="w-2.5 h-2.5 text-amber-300" />
                    <span>นำทาง Google Maps</span>
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Own Shop Notice for Merchant Owner */}
          {isOwnShop && (
            <div className="mx-4 mt-3 p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-2.5 text-amber-900 shadow-2xs shrink-0">
              <Store className="w-5 h-5 text-amber-600 shrink-0" />
              <div className="text-xs">
                <p className="font-bold">นี่คือร้านค้าของคุณเอง</p>
                <p className="text-[11px] text-amber-700 mt-0.5">
                  ระบบไม่อนุญาตให้สั่งอาหารจากร้านของตนเอง แต่คุณยังสามารถสั่งอาหารจากร้านอื่นได้ตามปกติครับ
                </p>
              </div>
            </div>
          )}

          {/* Navigation Tabs: Menu vs Reviews */}
          <div className="flex border-b border-gray-100 bg-white px-3 pt-2 gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('menu')}
              className={`flex-1 py-2 text-xs font-bold border-b-2 transition flex items-center justify-center gap-1.5 ${
                activeTab === 'menu'
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <UtensilsCrossed className="w-3.5 h-3.5" />
              <span>รายการเมนู ({menuItems.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('reviews')}
              className={`flex-1 py-2 text-xs font-bold border-b-2 transition flex items-center justify-center gap-1 ${
                activeTab === 'reviews'
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>รีวิวร้านค้า ({displayReviewCount})</span>
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
            
            {/* TAB 1: MENU ITEMS */}
            {activeTab === 'menu' && (
              <div className="space-y-3">
                {/* Guest Notice: Must login to add items */}
                {!user && (
                  <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 text-white rounded-2xl p-3 flex items-center justify-between gap-2 shadow-sm animate-in fade-in">
                    <div className="flex items-center gap-2 min-w-0">
                      <Lock className="w-4 h-4 shrink-0" />
                      <p className="text-xs font-bold truncate">
                        กรุณาเข้าสู่ระบบเพื่อกดสั่งอาหาร
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={onRequireLogin}
                      className="px-3 py-1.5 bg-white hover:bg-amber-50 text-amber-600 font-black text-xs rounded-xl shadow-xs shrink-0 active:scale-95 whitespace-nowrap"
                    >
                      เข้าสู่ระบบ
                    </button>
                  </div>
                )}
                {/* Category Filter Pills (ทั้งหมด / อาหาร / เครื่องดื่ม & ของหวาน) */}
                <div className="grid grid-cols-3 gap-1.5 bg-white p-1 rounded-2xl border border-gray-150 shadow-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('all')}
                    className={`py-2 px-1 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-0.5 transition active:scale-95 ${
                      selectedCategory === 'all'
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    <span>ทั้งหมด</span>
                    <span className={`text-[10px] font-semibold ${selectedCategory === 'all' ? 'text-amber-100' : 'text-gray-400'}`}>
                      ({menuItems.length})
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedCategory('food')}
                    className={`py-2 px-1 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-0.5 transition active:scale-95 ${
                      selectedCategory === 'food'
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      <UtensilsCrossed className="w-3.5 h-3.5" /> อาหาร
                    </span>
                    <span className={`text-[10px] font-semibold ${selectedCategory === 'food' ? 'text-amber-100' : 'text-gray-400'}`}>
                      ({foodItems.length})
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedCategory('drink_dessert')}
                    className={`py-2 px-1 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-0.5 transition active:scale-95 ${
                      selectedCategory === 'drink_dessert'
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    <span className="flex items-center gap-1 text-center truncate">
                      <CupSoda className="w-3.5 h-3.5 shrink-0" /> น้ำ/ของหวาน
                    </span>
                    <span className={`text-[10px] font-semibold ${selectedCategory === 'drink_dessert' ? 'text-amber-100' : 'text-gray-400'}`}>
                      ({drinkItems.length})
                    </span>
                  </button>
                </div>

                {/* Quick search input */}
                {menuItems.length > 3 && (
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="ค้นหาชื่อเมนูในร้านนี้..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-7 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-amber-500 shadow-2xs"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs p-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}

                {/* Foods Section */}
                {(selectedCategory === 'all' || selectedCategory === 'food') && (
                  <>
                    {filteredFoodItems.length > 0 ? (
                      <div className="space-y-2">
                        <h3 className="text-xs font-black text-gray-600 uppercase tracking-wider flex items-center gap-1.5 pt-1">
                          <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                          <span>เมนูอาหารจานเดียว / ตามสั่ง ({filteredFoodItems.length})</span>
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          {filteredFoodItems.map((item) => (
                            <div
                              key={item.id}
                              onClick={() => handleItemClick(item)}
                              className="bg-white rounded-2xl p-3 border border-gray-100 shadow-xs flex items-center justify-between gap-3 hover:shadow-md transition cursor-pointer active:scale-[0.99]"
                            >
                              <div className="flex items-center gap-3">
                                {item.image_url ? (
                                  <img
                                    key={item.image_url}
                                    src={item.image_url}
                                    alt={item.name}
                                    className="w-16 h-16 rounded-xl object-cover border border-gray-100 shrink-0"
                                  />
                                ) : (
                                  <div className="w-16 h-16 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 shrink-0">
                                    <UtensilsCrossed className="w-6 h-6" />
                                  </div>
                                )}
                                <div>
                                  <h4 className="font-bold text-sm text-gray-800 leading-tight">{item.name}</h4>
                                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                    <p className="text-xs font-black text-amber-600">{item.price} บาท</p>
                                    {(item.sales_count ?? 0) > 0 && (
                                      <span className="text-[10px] bg-orange-50 text-orange-600 font-bold px-1.5 py-0.2 rounded-md border border-orange-200 flex items-center gap-0.5">
                                        <Flame className="w-3 h-3" /> ขายแล้ว {item.sales_count} จาน
                                      </span>
                                    )}
                                  </div>
                                  {item.options && item.options.length > 0 && (
                                    <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md font-bold border border-amber-200">
                                      <Sparkles className="w-2.5 h-2.5" /> ตัวเลือกเสริม ({item.options.length})
                                    </span>
                                  )}
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleItemClick(item);
                                }}
                                disabled={isOwnShop || !isShopOpenAndReady || !item.is_available}
                                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs transition active:scale-95 shrink-0 ${
                                  isOwnShop
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    : 'bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white'
                                }`}
                              >
                                {isOwnShop ? (
                                  <span>ร้านของคุณ</span>
                                ) : (
                                  <>
                                    <Plus className="w-3.5 h-3.5" /> {item.options && item.options.length > 0 ? 'เลือก' : 'ใส่ตะกร้า'}
                                  </>
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : selectedCategory === 'food' ? (
                      <div className="text-center py-8 text-gray-400 text-xs bg-white rounded-2xl border border-gray-100 flex flex-col items-center justify-center gap-1.5">
                        <UtensilsCrossed className="w-6 h-6 text-gray-300" />
                        <p>ยังไม่มีเมนูอาหารในหมวดนี้</p>
                      </div>
                    ) : null}
                  </>
                )}

                {/* Drinks & Desserts Section */}
                {(selectedCategory === 'all' || selectedCategory === 'drink_dessert') && (
                  <>
                    {filteredDrinkItems.length > 0 ? (
                      <div className="space-y-2">
                        <h3 className="text-xs font-black text-gray-600 uppercase tracking-wider flex items-center gap-1.5 pt-1">
                          <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />
                          <span>เครื่องดื่ม & ของหวาน ({filteredDrinkItems.length})</span>
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          {filteredDrinkItems.map((item) => (
                            <div
                              key={item.id}
                              onClick={() => handleItemClick(item)}
                              className="bg-white rounded-2xl p-3 border border-gray-100 shadow-xs flex items-center justify-between gap-3 hover:shadow-sm transition cursor-pointer active:scale-[0.99]"
                            >
                              <div className="flex items-center gap-3">
                                {item.image_url ? (
                                  <img
                                    key={item.image_url}
                                    src={item.image_url}
                                    alt={item.name}
                                    className="w-16 h-16 rounded-xl object-cover border border-gray-100 shrink-0"
                                  />
                                ) : (
                                  <div className="w-16 h-16 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-100 shrink-0">
                                    <CupSoda className="w-6 h-6" />
                                  </div>
                                )}
                                <div>
                                  <h4 className="font-bold text-sm text-gray-800 leading-tight">{item.name}</h4>
                                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                    <p className="text-xs font-black text-amber-600">{item.price} บาท</p>
                                    {(item.sales_count ?? 0) > 0 && (
                                      <span className="text-[10px] bg-orange-50 text-orange-600 font-bold px-1.5 py-0.2 rounded-md border border-orange-200 flex items-center gap-0.5">
                                        <Flame className="w-3 h-3" /> ขายแล้ว {item.sales_count} แก้ว
                                      </span>
                                    )}
                                  </div>
                                  {item.options && item.options.length > 0 && (
                                    <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded-md font-bold border border-orange-200">
                                      <Sparkles className="w-2.5 h-2.5" /> ตัวเลือกเสริม ({item.options.length})
                                    </span>
                                  )}
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleItemClick(item);
                                }}
                                disabled={isOwnShop || !isShopOpenAndReady || !item.is_available}
                                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs transition active:scale-95 shrink-0 ${
                                  isOwnShop
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    : 'bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white'
                                }`}
                              >
                                {isOwnShop ? (
                                  <span>ร้านของคุณ</span>
                                ) : (
                                  <>
                                    <Plus className="w-3.5 h-3.5" /> {item.options && item.options.length > 0 ? 'เลือก' : 'ใส่ตะกร้า'}
                                  </>
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : selectedCategory === 'drink_dessert' ? (
                      <div className="text-center py-8 text-gray-400 text-xs bg-white rounded-2xl border border-gray-100 flex flex-col items-center justify-center gap-1.5">
                        <CupSoda className="w-6 h-6 text-gray-300" />
                        <p>ยังไม่มีเครื่องดื่มหรือของหวานในหมวดนี้</p>
                      </div>
                    ) : null}
                  </>
                )}

                {menuItems.length === 0 && (
                  <div className="text-center py-10 text-gray-400 text-xs bg-white rounded-2xl border border-gray-100">
                    ยังไม่มีรายการเมนูในร้านนี้
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: REVIEWS */}
            {activeTab === 'reviews' && (
              <div className="space-y-3">
                {/* Rating Summary Card */}
                <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-3xl font-black text-amber-700">{displayRating.toFixed(1)}</span>
                      <div>
                        <div className="flex items-center">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`w-4 h-4 ${
                                Math.round(displayRating) >= s
                                  ? 'text-amber-500 fill-amber-500'
                                  : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-[11px] text-amber-800 font-bold">
                          {displayReviewCount} รีวิวจากลูกค้า
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!user) {
                        alert('กรุณาเข้าสู่ระบบก่อนเขียนรีวิวร้านค้า');
                        return;
                      }
                      setShowReviewModal(true);
                    }}
                    className="px-3 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 text-white text-xs font-bold rounded-xl shadow-xs transition active:scale-95 flex items-center gap-1"
                  >
                    <Star className="w-3.5 h-3.5 fill-white" />
                    <span>เขียนรีวิว</span>
                  </button>
                </div>

                {/* Reviews List */}
                {reviews.length === 0 ? (
                  <div className="bg-white rounded-2xl p-6 text-center border border-gray-100 space-y-2">
                    <Star className="w-8 h-8 text-amber-300 fill-amber-300 mx-auto" />
                    <h4 className="text-xs font-bold text-gray-700">ยังไม่มีรีวิวสำหรับร้านนี้</h4>
                    <p className="text-[11px] text-gray-400">สั่งอาหารและเป็นคนแรกที่รีวิวร้านนี้กันเถอะ!</p>
                    <button
                      type="button"
                      onClick={() => {
                        if (!user) {
                          alert('กรุณาเข้าสู่ระบบก่อนเขียนรีวิวร้านค้า');
                          return;
                        }
                        setShowReviewModal(true);
                      }}
                      className="text-xs text-amber-600 font-bold hover:underline inline-block pt-1"
                    >
                      + กดเขียนรีวิวคนแรก
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {reviews.map((rev) => (
                      <div
                        key={rev.id}
                        className="bg-white rounded-2xl p-3 border border-gray-100 shadow-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {rev.customer_avatar ? (
                              <img
                                src={rev.customer_avatar}
                                alt=""
                                className="w-6 h-6 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 text-xs flex items-center justify-center font-bold">
                                {rev.customer_name?.charAt(0) || 'U'}
                              </div>
                            )}
                            <span className="font-bold text-xs text-gray-800">{rev.customer_name}</span>
                          </div>

                          <div className="flex items-center">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                className={`w-3 h-3 ${
                                  rev.rating >= s ? 'text-amber-400 fill-amber-400' : 'text-gray-200'
                                }`}
                              />
                            ))}
                          </div>
                        </div>

                        <p className="text-xs text-gray-700 pl-8 leading-relaxed">
                          {rev.comment}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Floating Bottom Cart Bar if items exist */}
          {itemCount > 0 && (
            <div className="p-3 bg-white border-t border-gray-100 flex items-center justify-between shadow-lg">
              <div>
                <span className="text-xs text-gray-500">ในตะกร้า {itemCount} ชิ้น</span>
                <p className="text-sm font-black text-gray-800">{total} ฿ (รวมส่ง {deliveryFee} บ.)</p>
              </div>
              <button
                onClick={() => {
                  onClose();
                  onOpenCart();
                }}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 text-white font-bold text-xs rounded-xl shadow-md transition active:scale-95 flex items-center gap-1"
              >
                <span>ดูตะกร้า & สั่งซื้อ</span>
                <span>➔</span>
              </button>
            </div>
          )}

        </div>
      </div>

      {/* Review Modal */}
      {showReviewModal && user && (
        <ReviewModal
          shopId={shop.id}
          shopName={shop.name}
          currentUser={user}
          onClose={() => setShowReviewModal(false)}
        />
      )}

      {/* Item Customization & Toppings Modal */}
      {customizingItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-sm w-full p-4 space-y-3.5 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-gray-100 pb-2.5">
              <div className="flex items-center gap-2.5">
                {customizingItem.image_url ? (
                  <img
                    key={customizingItem.image_url}
                    src={customizingItem.image_url}
                    alt=""
                    className="w-12 h-12 rounded-xl object-cover ring-1 ring-gray-200 shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 font-bold text-xl flex items-center justify-center shrink-0">
                    {customizingItem.category === 'drink_dessert' ? <CupSoda className="w-6 h-6" /> : <UtensilsCrossed className="w-6 h-6" />}
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-sm text-gray-900 leading-snug">{customizingItem.name}</h3>
                  <p className="text-xs font-black text-amber-600 mt-0.5">ราคาเริ่มต้น {customizingItem.price} ฿</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCustomizingItem(null)}
                className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-3.5 pr-0.5 max-h-[55vh]">
              {/* Validation Error Banner */}
              {validationError && (
                <div className="p-2.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              {/* 1. Structured Option Groups (Noodles, Meatballs, Custom Choice Groups) */}
              {customizingItem.option_groups && customizingItem.option_groups.length > 0 && (
                <div className="space-y-3.5">
                  {customizingItem.option_groups.map((group) => {
                    const selectedInGroup = selectedGroupOptions[group.id] || [];
                    const isRequiredAndMissing = group.required && selectedInGroup.length === 0;

                    return (
                      <div
                        key={group.id}
                        className={`p-3 rounded-2xl border transition ${
                          isRequiredAndMissing
                            ? 'bg-amber-50/40 border-amber-300'
                            : 'bg-white border-gray-100 shadow-2xs'
                        } space-y-2`}
                      >
                        <div className="flex items-center justify-between flex-wrap gap-1">
                          <span className="text-xs font-black text-gray-900 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>{group.title}</span>
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              group.required
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {group.required
                              ? `จำเป็น • ${group.type === 'single' ? 'เลือก 1 อย่าง' : 'เลือกอย่างน้อย 1'}`
                              : `ตัวเลือกเสริม • ${group.type === 'single' ? 'เลือกได้ 1 อย่าง' : 'เลือกได้หลายอย่าง'}`}
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          {group.options.map((opt, optIdx) => {
                            const isSelected = selectedInGroup.some((o) => o.name === opt.name);
                            return (
                              <button
                                key={opt.id || optIdx}
                                type="button"
                                onClick={() => selectGroupOption(group, opt)}
                                className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition active:scale-98 ${
                                  isSelected
                                    ? 'bg-amber-50 border-amber-400 text-amber-950 font-bold shadow-2xs'
                                    : 'bg-gray-50/70 border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  {group.type === 'single' ? (
                                    /* Radio Button Indicator */
                                    <div
                                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition shrink-0 ${
                                        isSelected
                                          ? 'border-amber-500 bg-amber-500'
                                          : 'border-gray-300 bg-white'
                                      }`}
                                    >
                                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                    </div>
                                  ) : (
                                    /* Checkbox Indicator */
                                    <div
                                      className={`w-4 h-4 rounded-md border flex items-center justify-center transition shrink-0 ${
                                        isSelected
                                          ? 'bg-amber-500 border-amber-500 text-white'
                                          : 'border-gray-300 bg-white'
                                      }`}
                                    >
                                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                    </div>
                                  )}
                                  <span className="text-xs">{opt.name}</span>
                                </div>
                                <span
                                  className={`text-xs font-bold ${
                                    isSelected ? 'text-amber-700' : 'text-gray-500'
                                  }`}
                                >
                                  {opt.price > 0 ? `+${opt.price} ฿` : 'ฟรี'}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 2. Legacy Flat Options (Backward Compatibility) */}
              {(!customizingItem.option_groups || customizingItem.option_groups.length === 0) &&
                customizingItem.options &&
                customizingItem.options.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-amber-600" /> เลือกท็อปปิ้ง / ตัวเลือกเสริม:
                      </span>
                      <span className="text-[10px] text-gray-400 font-normal">เลือกได้หลายอย่าง</span>
                    </label>
                    <div className="space-y-1.5">
                      {customizingItem.options.map((opt, idx) => {
                        const isSelected = selectedOptions.some((o) => o.name === opt.name);
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => toggleOption(opt)}
                            className={`w-full p-2.5 rounded-2xl border text-left flex items-center justify-between transition active:scale-98 ${
                              isSelected
                                ? 'bg-amber-50 border-amber-400 text-amber-950 font-bold shadow-2xs'
                                : 'bg-gray-50/70 border-gray-200 text-gray-700 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-4 h-4 rounded-md border flex items-center justify-center transition ${
                                  isSelected ? 'bg-amber-500 border-amber-500 text-white' : 'border-gray-300 bg-white'
                                }`}
                              >
                                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                              <span className="text-xs">{opt.name}</span>
                            </div>
                            <span className={`text-xs font-bold ${isSelected ? 'text-amber-700' : 'text-gray-500'}`}>
                              {opt.price > 0 ? `+${opt.price} ฿` : 'ฟรี'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

              {/* Special Note input */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-gray-700 flex items-center gap-1">
                  <FileEdit className="w-3 h-3 text-gray-500" />
                  <span>รายละเอียดเพิ่มเติมถึงร้าน (ไม่บังคับ):</span>
                </label>
                <input
                  type="text"
                  placeholder="เช่น ไม่ใส่ผักโรย, เผ็ดน้อย, หวาน 50%"
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium"
                />
              </div>

              {/* Quantity Selector */}
              <div className="pt-2 flex items-center justify-between border-t border-gray-100">
                <span className="text-xs font-bold text-gray-700">จำนวน:</span>
                <div className="flex items-center gap-3 bg-gray-100 px-3 py-1.5 rounded-2xl">
                  <button
                    type="button"
                    disabled={customQuantity <= 1}
                    onClick={() => setCustomQuantity((q) => Math.max(1, q - 1))}
                    className="w-6 h-6 rounded-lg bg-white text-gray-700 flex items-center justify-center shadow-2xs hover:bg-gray-200 disabled:opacity-30 active:scale-95 transition"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="text-sm font-black text-gray-900 w-4 text-center">{customQuantity}</span>
                  <button
                    type="button"
                    onClick={() => setCustomQuantity((q) => q + 1)}
                    className="w-6 h-6 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow-2xs hover:bg-amber-600 active:scale-95 transition"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Button with Realtime Calculated Price */}
            <div className="pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={handleConfirmAddToCart}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 text-white font-bold text-xs rounded-2xl shadow-md transition active:scale-95 flex items-center justify-between px-4"
              >
                <span>ใส่ตะกร้า</span>
                <span className="text-sm font-black">
                  {(
                    (customizingItem.price +
                      allSelectedOptionsList.reduce((sum, o) => sum + (Number(o.price) || 0), 0)) *
                    customQuantity
                  ).toFixed(0)}{' '}
                  ฿
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
