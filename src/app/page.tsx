'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Store, UtensilsCrossed, CupSoda, ShoppingBag, MapPin, Phone,
  Plus, Search, ShieldCheck, UserCheck, ChevronRight, Sparkles,
  Star, Flame, FileText, Bike, CheckCircle2, MessageSquare,
  Lock, ChefHat
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { Shop, MenuItem, Order, UserRole } from '@/types';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, getDoc, query, where, getDocs } from 'firebase/firestore';
import { soundAlert } from '@/lib/soundAlert';

import CartCheckoutModal from '@/components/CartCheckoutModal';
import OrderStatusModal from '@/components/OrderStatusModal';
import ShopDetailModal from '@/components/ShopDetailModal';
import MerchantDashboard from '@/components/MerchantDashboard';
import AdminDashboard from '@/components/AdminDashboard';
import AuthModal from '@/components/AuthModal';
import UserProfileModal from '@/components/UserProfileModal';
import OrderHistoryModal from '@/components/OrderHistoryModal';
import TermsModal from '@/components/TermsModal';
import ContactModal from '@/components/ContactModal';
import UserAvatar from '@/components/UserAvatar';
import { formatOrderCode } from '@/lib/orderNumber';

export default function HomePage() {
  const { user, role, isLineLoggingIn, logout } = useAuth();
  const {
    items,
    currentShop,
    deliveryFee,
    total,
    itemCount,
    shopCount,
    addItem,
    confirmSwitchShopAndAdd
  } = useCart();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [trackingOrders, setTrackingOrders] = useState<Order[]>([]);
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [autoOpenChatInTracking, setAutoOpenChatInTracking] = useState(false);

  // Active view mode for merchant/admin
  const [viewMode, setViewMode] = useState<'customer' | 'merchant' | 'admin'>('customer');

  useEffect(() => {
    if (role === 'admin') setViewMode('admin');
    else if (role === 'merchant') setViewMode('merchant');
    else setViewMode('customer');
  }, [role]);

  // 3 Main Customer Tabs as requested:
  // 1. ร้านค้าทั้งหมด (All Shops)
  // 2. อาหาร (Food)
  // 3. เครื่องดื่ม/ของหวาน (Drink & Dessert)
  const [customerTab, setCustomerTab] = useState<'shops' | 'food' | 'drink_dessert'>('shops');

  // Shops & Menus state
  const [shops, setShops] = useState<Shop[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [showCartModal, setShowCartModal] = useState(false);
  const [selectedShopForDetail, setSelectedShopForDetail] = useState<Shop | null>(null);
  const [trackingOrder, setTrackingOrder] = useState<Order | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showOrderHistoryModal, setShowOrderHistoryModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsTab, setTermsTab] = useState<'customer' | 'privacy'>('customer');
  const [showContactModal, setShowContactModal] = useState(false);

  // System Settings state (GP enabled, percent)
  const [systemSettings, setSystemSettings] = useState<{ gp_enabled?: boolean; gp_percent?: number } | null>(null);

  // Firestore Realtime synchronization
  useEffect(() => {
    try {
      let catalog: Shop[] = [];
      let reviewStats: Map<string, { total: number; count: number }> | null = null;
      const publishShops = () => setShops(catalog.map(shop => {
        if (!reviewStats) return shop;
        const stats = reviewStats.get(shop.id);
        const count = stats?.count ?? 0;
        return {
          ...shop,
          review_count: count,
          rating: count > 0 ? Math.round(stats!.total / count * 10) / 10 : (shop.rating || 5.0),
        };
      }));
      const unsubShops = onSnapshot(collection(db, 'shops'), (snapshot) => {
        catalog = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Shop));
        publishShops();
      }, (err) => console.warn('Shops listener fallback:', err));

      // Use the same live review collection as the shop details. The database
      // region does not support the aggregate trigger, so shop counters can lag.
      const unsubReviews = onSnapshot(collection(db, 'shop_reviews'), (snapshot) => {
        reviewStats = new Map();
        snapshot.forEach(d => {
          const review = d.data();
          if (typeof review.shop_id !== 'string' || !Number.isInteger(review.rating) || review.rating < 1 || review.rating > 5) return;
          const stats = reviewStats!.get(review.shop_id) ?? { total: 0, count: 0 };
          stats.total += review.rating;
          stats.count += 1;
          reviewStats!.set(review.shop_id, stats);
        });
        publishShops();
      }, (err) => console.warn('Reviews listener fallback:', err));

      const unsubMenu = onSnapshot(collection(db, 'menu_items'), (snapshot) => {
        const list: MenuItem[] = [];
        snapshot.forEach((d) => list.push({ id: d.id, ...d.data() } as MenuItem));
        setMenuItems(list);
      }, (err) => console.warn('Menu listener fallback:', err));

      const unsubSettings = onSnapshot(doc(db, 'system_settings', 'general'), (snap) => {
        if (snap.exists()) {
          setSystemSettings(snap.data() as any);
        }
      }, (err) => console.warn('Settings listener fallback:', err));

      return () => {
        unsubShops();
        unsubReviews();
        unsubMenu();
        unsubSettings();
      };
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Restore active customer orders — query Firestore on login, fallback to localStorage
  useEffect(() => {
    if (!user) {
      // Logged out: clear in-memory tracker but keep localStorage so orders are
      // restored from Firestore on next login (don't wipe the cache here).
      setTrackingOrders([]);
      setShowTrackingModal(false); // BUG-26: close modal on logout
      return;
    }

    // Query Firestore for orders that are actively ongoing for this user
    const restoreOrders = async () => {
      try {
        // Only load actively ongoing orders (pending, cooking, delivering)
        const activeStatuses = ['pending', 'cooking', 'delivering'];
        const q = query(
          collection(db, 'orders'),
          where('customer_uid', '==', user.uid),
          where('status', 'in', activeStatuses)
        );
        const snap = await getDocs(q);
        const firestoreOrders: Order[] = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as Order)
        );

        // Also read any active orders saved locally
        let localOrders: Order[] = [];
        try {
          const stored = localStorage.getItem('hchk_orders');
          if (stored) {
            const parsed: Order[] = JSON.parse(stored);
            localOrders = parsed.filter(
              (o) => o.status === 'pending' || o.status === 'cooking' || o.status === 'delivering'
            );
          }
        } catch { /* ignore localStorage errors */ }

        // Merge: Firestore is the source of truth; local orders fill gaps
        const firestoreIds = new Set(firestoreOrders.map((o) => o.id));
        const merged = [
          ...firestoreOrders,
          ...localOrders.filter((o) => !firestoreIds.has(o.id)),
        ];

        if (merged.length > 0) {
          setTrackingOrders(merged);
          try { localStorage.setItem('hchk_orders', JSON.stringify(merged)); } catch {}
        } else {
          // No active orders — clear tracking state and localStorage
          setTrackingOrders([]);
          try { localStorage.removeItem('hchk_orders'); } catch {}
        }
      } catch (e) {
        console.warn('Restore orders from Firestore error:', e);
        // Fallback to localStorage only
        try {
          const stored = localStorage.getItem('hchk_orders');
          if (stored) {
            const parsed: Order[] = JSON.parse(stored);
            const active = parsed.filter(
              (o) => o.status === 'pending' || o.status === 'cooking' || o.status === 'delivering'
            );
            setTrackingOrders(active);
            if (active.length > 0) {
              localStorage.setItem('hchk_orders', JSON.stringify(active));
            } else {
              localStorage.removeItem('hchk_orders');
            }
          }
        } catch (le) {
          console.warn('Restore orders localStorage fallback error:', le);
        }
      }
    };

    restoreOrders();
  }, [user]);

  // Deep link support for web push notifications / direct chat links (e.g. ?order_id=...&open_chat=1)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const targetOrderId = params.get('order_id');
    const openChat = params.get('open_chat');

    if (targetOrderId) {
      const loadDeepLinkOrder = async () => {
        try {
          const docSnap = await getDoc(doc(db, 'orders', targetOrderId));
          if (docSnap.exists()) {
            const orderData = { id: docSnap.id, ...docSnap.data() } as Order;
            setTrackingOrders((prev) => {
              const existingIdx = prev.findIndex((o) => o.id === targetOrderId);
              if (existingIdx >= 0) {
                const next = [...prev];
                next.splice(existingIdx, 1);
                return [orderData, ...next];
              }
              return [orderData, ...prev];
            });
            if (openChat === '1' || openChat === 'true') {
              setAutoOpenChatInTracking(true);
            }
            setShowTrackingModal(true);
          }
        } catch (err) {
          console.warn('Deep link order load failed:', err);
        }
      };
      loadDeepLinkOrder();
    }
  }, []);

  const orderSubscribersRef = useRef<Map<string, () => void>>(new Map());

  // Sync active orders in realtime from Firestore & notify on new merchant messages
  useEffect(() => {
    if (!user || trackingOrders.length === 0) {
      orderSubscribersRef.current.forEach((unsub) => unsub());
      orderSubscribersRef.current.clear();
      return;
    }

    const currentIds = new Set(trackingOrders.map((o) => o.id));
    const subMap = orderSubscribersRef.current;

    // 1. Remove subscriptions for orders no longer in trackingOrders
    subMap.forEach((unsub, id) => {
      if (!currentIds.has(id)) {
        unsub();
        subMap.delete(id);
      }
    });

    // 2. Add subscriptions for new order IDs
    currentIds.forEach((id) => {
      if (!subMap.has(id)) {
        try {
          const unsub = onSnapshot(doc(db, 'orders', id), (docSnap) => {
            if (docSnap.exists()) {
              const updated = { id: docSnap.id, ...docSnap.data() } as Order;
              setTrackingOrders((prev) => {
                const prevOrder = prev.find((o) => o.id === id);
                // If order status advanced, play status chime
                if (prevOrder && prevOrder.status !== updated.status) {
                  if (updated.status === 'cooking' || updated.status === 'delivering' || updated.status === 'completed') {
                    soundAlert.playCustomerStatusSound(updated.status).catch(() => {});
                  }
                }
                // If new unread message arrived from shop (or subsequent message), play chime sound
                const prevMsgAt = (prevOrder as any)?.last_message_at?.seconds ?? (prevOrder as any)?.last_message_at;
                const newMsgAt = (updated as any)?.last_message_at?.seconds ?? (updated as any)?.last_message_at;
                const isNewMessageArrival = updated.has_customer_unread_message && (
                  !prevOrder?.has_customer_unread_message ||
                  (newMsgAt && prevMsgAt !== newMsgAt)
                );
                if (isNewMessageArrival && !showTrackingModal) {
                  soundAlert.playMessageSound();
                }
                // Keep completed orders for 24h (post-delivery chat); remove cancelled immediately
                let next: Order[];
                if (updated.status === 'cancelled') {
                  next = prev.filter((o) => o.id !== id);
                } else if (updated.status === 'completed') {
                  const raw = (updated as unknown as Record<string, unknown>).completed_at;
                  const ts = raw && typeof (raw as Record<string, unknown>).seconds === 'number'
                    ? (raw as { seconds: number }).seconds * 1000
                    : null;
                  const expired = ts && (Date.now() - ts) >= 24 * 60 * 60 * 1000;
                  next = expired
                    ? prev.filter((o) => o.id !== id)
                    : prev.map((o) => (o.id === id ? updated : o));
                } else {
                  next = prev.map((o) => (o.id === id ? updated : o));
                }
                try {
                  localStorage.setItem('hchk_orders', JSON.stringify(next));
                } catch {}
                return next;
              });
            }
          }, (err) => {
            console.warn('Order sync snapshot error:', err);
          });
          subMap.set(id, unsub);
        } catch (e) {
          console.warn('Order sync listener setup error:', e);
        }
      }
    });
  }, [user, trackingOrders.map((o) => o.id).sort().join(',')]);

  // Clean up all order listeners on unmount
  useEffect(() => {
    return () => {
      orderSubscribersRef.current.forEach((unsub) => unsub());
      orderSubscribersRef.current.clear();
    };
  }, []);

  const hasCustomerUnreadMessage = trackingOrders.some((o) => o.has_customer_unread_message);

  const handleDismissOrder = (orderIdToDismiss: string) => {
    setTrackingOrders((prev) => {
      const next = prev.filter((o) => o.id !== orderIdToDismiss);
      try {
        localStorage.setItem('hchk_orders', JSON.stringify(next));
      } catch {}
      if (next.length === 0) {
        setShowTrackingModal(false);
      }
      return next;
    });
  };

  const handleDismissAllCompleted = () => {
    setTrackingOrders((prev) => {
      const next = prev.filter((o) => o.status !== 'completed');
      try {
        localStorage.setItem('hchk_orders', JSON.stringify(next));
      } catch {}
      if (next.length === 0) {
        setShowTrackingModal(false);
      }
      return next;
    });
  };

  const handleAddItemFromFeed = (item: MenuItem) => {
    // BUG-14: require login before adding to cart
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    const shop = shops.find((s) => s.id === item.shop_id) || {
      id: item.shop_id,
      name: 'ร้านค้าชุมชน',
      phone: '0898765432',
      delivery_fee: 0,
    };

    const hasGroups = item.option_groups && item.option_groups.length > 0;
    const hasLegacyOptions = item.options && item.options.length > 0;

    if (hasGroups || hasLegacyOptions) {
      setSelectedShopForDetail(shop);
    } else {
      addItem(item, { id: shop.id, name: shop.name, phone: shop.phone, delivery_fee: shop.delivery_fee, location: shop.location });
    }
  };

  const handleOpenCart = () => {
    if (!user) {
      setShowAuthModal(true);
    } else {
      setShowCartModal(true);
    }
  };

  // Helper to determine if shop is open and allowed to receive orders (with GP credit validation)
  const isShopOpenAndReady = (s: Shop) => {
    if (s.is_open === false) return false;
    if (systemSettings?.gp_enabled === true && (s.credit_balance ?? 0) <= 0) return false;
    return true;
  };

  // Helper to calculate shop ranking score (Sales count + Rating + Review count)
  const getShopRankScore = (shop: Shop): number => {
    const sales = shop.sales_count ?? 0;
    const rating = shop.rating ?? 0;
    const reviews = shop.review_count ?? 0;
    // Score weighted: high sales volume (20 pts) + high ratings (10 pts) + review volume (5 pts)
    return (sales * 20) + (rating * 10) + (reviews * 5);
  };

  // 1. Ranked Shops: Open shops sorted by Sales & Rating descending, followed by closed shops
  const rankedShops = useMemo(() => {
    const openShops = shops.filter(isShopOpenAndReady);
    const closedShops = shops.filter((s) => !isShopOpenAndReady(s));

    const sortShopList = (list: Shop[]) => {
      return [...list].sort((a, b) => {
        const scoreA = getShopRankScore(a);
        const scoreB = getShopRankScore(b);
        if (scoreB !== scoreA) return scoreB - scoreA;
        
        const salesA = a.sales_count ?? 0;
        const salesB = b.sales_count ?? 0;
        if (salesB !== salesA) return salesB - salesA;

        const ratingA = a.rating ?? 0;
        const ratingB = b.rating ?? 0;
        if (ratingB !== ratingA) return ratingB - ratingA;

        return a.name.localeCompare(b.name, 'th');
      });
    };

    return [...sortShopList(openShops), ...sortShopList(closedShops)];
  }, [shops, systemSettings?.gp_enabled]);

  // 2. Ranked Foods: Available items sorted by Sales & Shop score descending, followed by unavailable items
  const rankedFoods = useMemo(() => {
    const foods = menuItems.filter((m) => m.category === 'food');
    const isItemAvailable = (m: MenuItem) => {
      const shop = shops.find((s) => s.id === m.shop_id);
      return m.is_available !== false && (!shop || isShopOpenAndReady(shop));
    };

    const available = foods.filter(isItemAvailable);
    const unavailable = foods.filter((m) => !isItemAvailable(m));

    const sortMenuList = (list: MenuItem[]) => {
      return [...list].sort((a, b) => {
        const itemSalesA = a.sales_count ?? 0;
        const itemSalesB = b.sales_count ?? 0;
        const shopA = shops.find((s) => s.id === a.shop_id);
        const shopB = shops.find((s) => s.id === b.shop_id);
        const shopScoreA = shopA ? getShopRankScore(shopA) : 0;
        const shopScoreB = shopB ? getShopRankScore(shopB) : 0;

        const totalScoreA = (itemSalesA * 30) + shopScoreA;
        const totalScoreB = (itemSalesB * 30) + shopScoreB;

        if (totalScoreB !== totalScoreA) return totalScoreB - totalScoreA;
        if (itemSalesB !== itemSalesA) return itemSalesB - itemSalesA;
        return a.name.localeCompare(b.name, 'th');
      });
    };

    return [...sortMenuList(available), ...sortMenuList(unavailable)];
  }, [menuItems, shops, systemSettings?.gp_enabled]);

  // 3. Ranked Drinks & Desserts: Available items sorted by Sales & Shop score descending, followed by unavailable items
  const rankedDrinks = useMemo(() => {
    const drinks = menuItems.filter((m) => m.category === 'drink_dessert');
    const isItemAvailable = (m: MenuItem) => {
      const shop = shops.find((s) => s.id === m.shop_id);
      return m.is_available !== false && (!shop || isShopOpenAndReady(shop));
    };

    const available = drinks.filter(isItemAvailable);
    const unavailable = drinks.filter((m) => !isItemAvailable(m));

    const sortMenuList = (list: MenuItem[]) => {
      return [...list].sort((a, b) => {
        const itemSalesA = a.sales_count ?? 0;
        const itemSalesB = b.sales_count ?? 0;
        const shopA = shops.find((s) => s.id === a.shop_id);
        const shopB = shops.find((s) => s.id === b.shop_id);
        const shopScoreA = shopA ? getShopRankScore(shopA) : 0;
        const shopScoreB = shopB ? getShopRankScore(shopB) : 0;

        const totalScoreA = (itemSalesA * 30) + shopScoreA;
        const totalScoreB = (itemSalesB * 30) + shopScoreB;

        if (totalScoreB !== totalScoreA) return totalScoreB - totalScoreA;
        if (itemSalesB !== itemSalesA) return itemSalesB - itemSalesA;
        return a.name.localeCompare(b.name, 'th');
      });
    };

    return [...sortMenuList(available), ...sortMenuList(unavailable)];
  }, [menuItems, shops, systemSettings?.gp_enabled]);

  // Search filter applied on ranked lists
  const filteredShops = useMemo(() => {
    if (!searchQuery.trim()) return rankedShops;
    const q = searchQuery.toLowerCase().trim();
    return rankedShops.filter((s) => s.name.toLowerCase().includes(q));
  }, [rankedShops, searchQuery]);

  const filteredFoods = useMemo(() => {
    if (!searchQuery.trim()) return rankedFoods;
    const q = searchQuery.toLowerCase().trim();
    return rankedFoods.filter((m) => m.name.toLowerCase().includes(q));
  }, [rankedFoods, searchQuery]);

  const filteredDrinks = useMemo(() => {
    if (!searchQuery.trim()) return rankedDrinks;
    const q = searchQuery.toLowerCase().trim();
    return rankedDrinks.filter((m) => m.name.toLowerCase().includes(q));
  }, [rankedDrinks, searchQuery]);

  return (
    <main className="min-h-screen bg-slate-50 pb-24 text-gray-800">
      
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3.5 flex items-center justify-between gap-1.5 sm:gap-4">
          
          {/* Logo & Brand Name */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
            <img
              src="/logo.png?v=5"
              alt="huaychan"
              className="w-9 h-9 sm:w-11 sm:h-11 object-contain hover:scale-105 active:scale-95 transition shrink-0 drop-shadow-sm"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm sm:text-base md:text-lg font-black tracking-tight text-gray-900 leading-tight whitespace-nowrap">
                  huaychan
                </h1>
                <span className="hidden lg:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-200/80 shrink-0">
                  ส่งรอบ มรภ. ชัยภูมิ
                </span>
              </div>
              <p className="hidden xs:flex sm:flex text-[10px] sm:text-xs text-gray-500 font-medium mt-0.5 items-center gap-1 whitespace-nowrap truncate">
                <MapPin className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-500 shrink-0" />
                <span className="truncate max-w-[180px] sm:max-w-none">ชุมชนห้วยชัน - นาฝาย • ส่งถึงหน้าบ้าน & หอพัก</span>
              </p>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">

            {/* Customer Order History Button */}
            {user && viewMode === 'customer' && (
              <button
                type="button"
                onClick={() => setShowOrderHistoryModal(true)}
                className="px-2 py-1.5 sm:px-2.5 rounded-xl text-xs font-bold bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200/80 shadow-2xs transition active:scale-95 flex items-center gap-1.5 whitespace-nowrap shrink-0"
                title="ประวัติการสั่งซื้อของฉัน"
              >
                <FileText className="w-3.5 h-3.5 text-gray-500" />
                <span className="hidden md:inline">ประวัติสั่งซื้อ</span>
              </button>
            )}

            {/* Customer Active Orders Quick Tracker Button in Header */}
            {viewMode === 'customer' && trackingOrders.length > 0 && (() => {
              const activeCount = trackingOrders.filter((o) => o.status !== 'completed').length;
              const hasCompleted = trackingOrders.some((o) => o.status === 'completed');
              return (
                <button
                  type="button"
                  onClick={() => setShowTrackingModal(true)}
                  className={`px-2 py-1.5 sm:px-2.5 rounded-xl text-xs font-bold transition active:scale-95 flex items-center gap-1.5 shadow-xs whitespace-nowrap shrink-0 ${
                    hasCustomerUnreadMessage
                      ? 'bg-amber-500 text-white animate-pulse ring-2 ring-amber-300'
                      : activeCount === 0 && hasCompleted
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/80'
                  }`}
                  title="ติดตามสถานะออเดอร์ & แชทกับร้าน"
                >
                  {activeCount === 0 && hasCompleted ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                  ) : (
                    <Bike className={`w-3.5 h-3.5 shrink-0 ${hasCustomerUnreadMessage || (activeCount === 0 && hasCompleted) ? 'text-white' : 'text-amber-600'}`} />
                  )}
                  <span className="hidden sm:inline">
                    {activeCount === 0 && hasCompleted ? `ส่งถึงแล้ว (${trackingOrders.length})` : `ออเดอร์ (${trackingOrders.length})`}
                  </span>
                  <span className="sm:hidden text-[11px] font-bold">({trackingOrders.length})</span>
                  {hasCustomerUnreadMessage && (
                    <span className="w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white animate-ping shrink-0" />
                  )}
                </button>
              );
            })()}
            
            {/* Merchant / Admin View Mode Switcher */}
            {role === 'merchant' && (
              <button
                type="button"
                onClick={() => setViewMode(viewMode === 'merchant' ? 'customer' : 'merchant')}
                className="px-2 py-1.5 sm:px-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition active:scale-95 flex items-center gap-1.5 whitespace-nowrap shrink-0"
                title={viewMode === 'merchant' ? 'สลับไปหน้าสั่งอาหาร' : 'สลับไปหน้าจัดการร้านค้า'}
              >
                {viewMode === 'merchant' ? <UtensilsCrossed className="w-3.5 h-3.5" /> : <ChefHat className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{viewMode === 'merchant' ? 'หน้าสั่งอาหาร' : 'จัดการร้านค้า'}</span>
                <span className="sm:hidden text-[11px] font-bold">{viewMode === 'merchant' ? 'สั่งอาหาร' : 'ร้านค้า'}</span>
              </button>
            )}

            {role === 'admin' && (
              <button
                type="button"
                onClick={() => setViewMode(viewMode === 'admin' ? 'customer' : 'admin')}
                className="px-2 py-1.5 sm:px-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition active:scale-95 flex items-center gap-1.5 whitespace-nowrap shrink-0"
                title={viewMode === 'admin' ? 'สลับไปหน้าสั่งอาหาร' : 'สลับไปหน้าจัดการหลังบ้าน'}
              >
                {viewMode === 'admin' ? <UtensilsCrossed className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{viewMode === 'admin' ? 'หน้าสั่งอาหาร' : 'จัดการหลังบ้าน'}</span>
                <span className="sm:hidden text-[11px] font-bold">{viewMode === 'admin' ? 'สั่งอาหาร' : 'แอดมิน'}</span>
              </button>
            )}

            {/* Account / Login with Email or LINE */}
            {!user ? (
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="px-2.5 py-1.5 sm:px-3 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition active:scale-95 flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <UserCheck className="w-3.5 h-3.5 shrink-0" />
                <span className="text-[11px] sm:text-xs font-black">เข้าสู่ระบบ</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowProfileModal(true)}
                className="px-1.5 py-1 sm:px-2.5 sm:py-1.5 rounded-2xl text-xs font-bold bg-gray-50 hover:bg-gray-100 text-gray-800 border border-gray-200/80 flex items-center gap-1.5 shadow-2xs hover:shadow-xs transition active:scale-95 group shrink-0"
                title="จัดการโปรไฟล์ & เปลี่ยนรูป"
              >
                <div className="w-6 h-6 sm:w-5 sm:h-5 rounded-full overflow-hidden ring-1 ring-amber-300 group-hover:scale-105 transition shrink-0 bg-amber-200">
                  <UserAvatar src={user.picture_url} alt={user.display_name} />
                </div>
                <span className="hidden sm:inline max-w-[65px] truncate font-extrabold text-gray-800">
                  {user.display_name.split(' ')[0]}
                </span>
              </button>
            )}

            {/* Cart Button (Visible in customer view) */}
            {viewMode === 'customer' && (
              <button
                type="button"
                onClick={handleOpenCart}
                className="relative p-2 bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-200/80 rounded-xl sm:rounded-2xl shadow-xs hover:scale-105 active:scale-95 transition shrink-0"
                title="ดูตะกร้าสินค้า"
              >
                <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
                {itemCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] font-black min-w-4 h-4 px-1 rounded-full flex items-center justify-center shadow-xs">
                    {itemCount}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 md:pt-6">
        
        {/* ROLE 1: MERCHANT DASHBOARD */}
        {viewMode === 'merchant' && user && (
          <MerchantDashboard currentUser={user} />
        )}

        {/* ROLE 2: ADMIN DASHBOARD */}
        {viewMode === 'admin' && user && (
          <AdminDashboard currentUser={user} />
        )}

        {/* ROLE 3: CUSTOMER VIEW */}
        {viewMode === 'customer' && (
          <div className="space-y-4 md:space-y-6">
            
            {/* Campus Banner / Value Proposition */}
            <div className="bg-white rounded-3xl p-5 md:p-8 text-gray-900 border border-gray-100 shadow-sm relative overflow-hidden flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="relative z-10 max-w-2xl">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span className="text-[10px] md:text-xs bg-amber-50 text-amber-700 border border-amber-200/60 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
                    <Bike className="w-3 h-3 text-amber-600" /> ชุมชนห้วยชัน - นาฝาย & มรภ.ชัยภูมิ
                  </span>
                  <span className="hidden sm:inline-flex items-center gap-1 text-[10px] md:text-xs bg-orange-50 text-orange-700 border border-orange-200/60 px-2.5 py-0.5 rounded-full font-bold">
                    <Sparkles className="w-3 h-3 text-orange-500" /> ส่งตรงถึงหน้าบ้านและหอพัก
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black tracking-tight leading-tight text-gray-900">
                  สั่งร้านเด็ดรอบ ม. และชุมชน ส่งถึงหน้าบ้านทันใจ
                </h2>
                <p className="text-xs sm:text-sm md:text-base text-gray-500 mt-1 md:mt-2 leading-relaxed">
                  ร้านค้าชุมชนส่งเอง • ค่าส่งตามแต่ละร้านกำหนด
                </p>
                <div className="hidden sm:flex items-center gap-3 mt-3.5 text-xs font-bold text-gray-600">
                  <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200/70 px-3 py-1.5 rounded-xl">
                    <Bike className="w-3.5 h-3.5 text-amber-600" />
                    <span>ส่งตรงถึงหน้าบ้านและหอพัก</span>
                  </div>
                </div>
              </div>

              {/* Decorative background watermark */}
              <div className="absolute -right-6 -bottom-6 text-amber-500/10 select-none pointer-events-none">
                <UtensilsCrossed className="w-28 h-28 md:w-36 md:h-36" />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs text-amber-950 shadow-2xs">
              <p className="leading-relaxed">
                <strong>อุดหนุนร้านใกล้บ้าน ผ่านพื้นที่กลางของชุมชน</strong>
                <span className="block text-amber-800">ร้านค้าขายและส่งเอง • คุยกับร้านได้โดยตรง • เราดูแลระบบและช่วยประสานงาน</span>
              </p>
              <a href="#about-huaychan" className="shrink-0 font-bold underline underline-offset-4 text-amber-700 hover:text-amber-900">รู้จัก huaychan</a>
            </div>

            {/* Search Input & Category Filter Tabs */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              {/* Search Input */}
              <div className="relative flex-1 md:max-w-md">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="ค้นหาร้านค้า, เมนูอาหาร, ชานม..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 md:py-3 bg-white border border-gray-200 rounded-2xl text-xs md:text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500 shadow-xs transition"
                />
              </div>

              {/* 3 Main User Tabs: [ร้านค้าทั้งหมด] [อาหาร] [เครื่องดื่ม/ของหวาน] */}
              <div className="grid grid-cols-3 md:flex items-center gap-1.5 bg-white p-1 rounded-2xl border border-gray-100 shadow-xs shrink-0">
                <button
                  type="button"
                  onClick={() => setCustomerTab('shops')}
                  className={`py-2 px-3 md:px-5 rounded-xl text-xs md:text-sm font-bold flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 transition ${
                    customerTab === 'shops'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-800 hover:bg-slate-50'
                  }`}
                >
                  <Store className="w-4 h-4" />
                  <span>ร้านค้าทั้งหมด ({filteredShops.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCustomerTab('food')}
                  className={`py-2 px-3 md:px-5 rounded-xl text-xs md:text-sm font-bold flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 transition ${
                    customerTab === 'food'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-800 hover:bg-slate-50'
                  }`}
                >
                  <UtensilsCrossed className="w-4 h-4" />
                  <span>อาหาร ({filteredFoods.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCustomerTab('drink_dessert')}
                  className={`py-2 px-3 md:px-5 rounded-xl text-xs md:text-sm font-bold flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 transition ${
                    customerTab === 'drink_dessert'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-800 hover:bg-slate-50'
                  }`}
                >
                  <CupSoda className="w-4 h-4" />
                  <span>ของหวาน/น้ำ ({filteredDrinks.length})</span>
                </button>
              </div>
            </div>

            {/* TAB 1 CONTENT: ร้านค้าทั้งหมด */}
            {customerTab === 'shops' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs md:text-sm text-gray-500 px-1 font-bold">
                  <span>ร้านค้าชุมชน ({filteredShops.length})</span>
                  <span>แตะเพื่อดูเมนู</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
                  {filteredShops.map((shop) => {
                    const shopMenu = menuItems.filter((m) => m.shop_id === shop.id);
                    return (
                      <div
                        key={shop.id}
                        onClick={() => setSelectedShopForDetail(shop)}
                        className="bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-xs hover:shadow-lg transition-all duration-300 cursor-pointer active:scale-98 group flex flex-col justify-between"
                      >
                        <div className="relative h-36 sm:h-40 md:h-44 bg-slate-100">
                          {shop.image_url ? (
                            <img
                              key={shop.image_url}
                              src={shop.image_url}
                              alt={shop.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-amber-400 via-orange-400 to-amber-600 flex flex-col items-center justify-center text-white select-none">
                              <Store className="w-10 h-10 opacity-80 mb-1" />
                              <span className="text-[11px] font-bold text-white/90 px-2 truncate max-w-[85%]">{shop.name}</span>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent pointer-events-none" />
                          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs ${
                                isShopOpenAndReady(shop) ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                              }`}
                            >
                              {isShopOpenAndReady(shop) ? 'เปิดรับออเดอร์' : 'ปิดร้านชั่วคราว'}
                            </span>
                            {(shop.sales_count ?? 0) > 0 && (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-xs flex items-center gap-0.5">
                                <Flame className="w-3 h-3 fill-white" />
                                <span>ขายแล้ว {shop.sales_count}</span>
                              </span>
                            )}
                          </div>

                          <div className="absolute top-2.5 right-2.5 bg-black/60 backdrop-blur-xs px-2 py-0.5 rounded-full text-white text-[11px] font-bold flex items-center gap-1 shadow-xs">
                            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                            <span>{(shop.rating ?? 0).toFixed(1)}</span>
                            <span className="text-[10px] text-gray-300">({shop.review_count || 0})</span>
                          </div>

                          <div className="absolute bottom-2.5 left-3 right-3 text-white">
                            <h3 className="font-bold text-sm md:text-base leading-tight drop-shadow-md">
                              {shop.name}
                            </h3>
                            <div className="flex items-center justify-between gap-1 text-[11px] text-amber-200 mt-0.5">
                              <p className="flex items-center gap-1 truncate">
                                <MapPin className="w-3 h-3 shrink-0" /> {shop.address_detail || 'รอบ มรภ. ชัยภูมิ'}
                              </p>
                              {shop.location?.lat && shop.location?.lng && (
                                <span className="shrink-0 text-[10px] bg-emerald-500/90 text-white font-bold px-1.5 py-0.2 rounded-md shadow-2xs flex items-center gap-0.5">
                                  <MapPin className="w-2.5 h-2.5" /> มีพิกัด
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="p-3 flex items-center justify-between text-xs border-t border-gray-50 bg-slate-50/50">
                          <div className="flex items-center gap-2 text-gray-500">
                            <span className="flex items-center gap-1 font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200/50">
                              <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                              {(shop.rating ?? 0).toFixed(1)}
                            </span>
                            <span>{shopMenu.length} เมนู • {(shop.delivery_fee ?? 0) === 0 ? <span className="text-emerald-600 font-bold">ส่งฟรี</span> : <span className="text-amber-700 font-bold">ค่าส่ง {shop.delivery_fee} บ.</span>}</span>
                          </div>
                          <span className="text-amber-600 font-bold flex items-center gap-0.5 group-hover:translate-x-1 transition">
                            ดูเมนู <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 2 CONTENT: อาหาร */}
            {customerTab === 'food' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs md:text-sm text-gray-500 px-1 font-bold">
                  <span>เมนูอาหารทั้งหมด ({filteredFoods.length})</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                  {filteredFoods.map((item) => {
                    const shop = shops.find((s) => s.id === item.shop_id);
                    const isShopReady = isShopOpenAndReady(shop || ({} as Shop));
                    return (
                      <div
                        key={item.id}
                        className="bg-white rounded-2xl p-3 border border-gray-100 shadow-xs flex items-center justify-between gap-3 hover:shadow-md transition group"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className="w-16 h-16 rounded-xl object-cover border border-gray-100 shrink-0 group-hover:scale-105 transition"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 shrink-0">
                              <UtensilsCrossed className="w-6 h-6" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <h4 className="font-bold text-sm text-gray-800 leading-tight truncate">
                              {item.name}
                            </h4>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <p className="text-xs text-amber-600 font-black">
                                {item.price} บาท
                              </p>
                              {(item.sales_count ?? 0) > 0 && (
                                <span className="text-[10px] bg-orange-50 text-orange-600 font-bold px-1.5 py-0.2 rounded-md border border-orange-200 flex items-center gap-0.5">
                                  <Flame className="w-3 h-3" /> ขายแล้ว {item.sales_count} จาน
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                              ร้าน: {shop?.name || 'ร้านค้าชุมชน'}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleAddItemFromFeed(item)}
                          disabled={!isShopReady || !item.is_available}
                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs transition active:scale-95 shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" /> ใส่ตะกร้า
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 3 CONTENT: เครื่องดื่ม & ของหวาน */}
            {customerTab === 'drink_dessert' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs md:text-sm text-gray-500 px-1 font-bold">
                  <span>เครื่องดื่ม & ของหวานทั้งหมด ({filteredDrinks.length})</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                  {filteredDrinks.map((item) => {
                    const shop = shops.find((s) => s.id === item.shop_id);
                    const isShopReady = isShopOpenAndReady(shop || ({} as Shop));
                    return (
                      <div
                        key={item.id}
                        className="bg-white rounded-2xl p-3 border border-gray-100 shadow-xs flex items-center justify-between gap-3 hover:shadow-md transition group"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className="w-16 h-16 rounded-xl object-cover border border-gray-100 shrink-0 group-hover:scale-105 transition"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-100 shrink-0">
                              <CupSoda className="w-6 h-6" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <h4 className="font-bold text-sm text-gray-800 leading-tight truncate">
                              {item.name}
                            </h4>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <p className="text-xs text-amber-600 font-black">
                                {item.price} บาท
                              </p>
                              {(item.sales_count ?? 0) > 0 && (
                                <span className="text-[10px] bg-orange-50 text-orange-600 font-bold px-1.5 py-0.2 rounded-md border border-orange-200 flex items-center gap-0.5">
                                  <Flame className="w-3 h-3" /> ขายแล้ว {item.sales_count} แก้ว
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                              ร้าน: {shop?.name || 'ร้านค้าชุมชน'}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleAddItemFromFeed(item)}
                          disabled={!isShopReady || !item.is_available}
                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs transition active:scale-95 shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" /> ใส่ตะกร้า
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        )}

        {/* Community Footer */}
        {viewMode === 'customer' && (
          <footer className="mt-14 pt-8 pb-28 border-t border-gray-200/80 text-center text-xs text-gray-500 space-y-2.5 animate-in fade-in">
            <section id="about-huaychan" aria-labelledby="about-huaychan-title" className="scroll-mt-24 mx-auto mb-6 max-w-2xl rounded-3xl border border-amber-150 bg-amber-50/70 p-5 sm:p-6 text-left shadow-2xs">
              <h2 id="about-huaychan-title" className="text-lg sm:text-xl font-black text-slate-900">จากโพสต์ขายของในชุมชน สู่หน้าร้านที่หาเจอง่ายขึ้น</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                เราเห็นพ่อค้าแม่ค้าใกล้บ้านโพสต์ขายอาหารบน Facebook อยู่ทุกวัน จึงอยากทำพื้นที่เล็ก ๆ
                ที่ช่วยรวมร้านและเมนูให้หาเจอง่าย สั่งสะดวก และคุยกับคนขายได้โดยตรง
                ให้ร้านในชุมชนมีโอกาสเข้าถึงลูกค้ามากขึ้น และให้คนแถวนี้ได้อุดหนุนกัน
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                ที่นี่ ร้านค้าเป็นคนขาย ปรุงอาหาร รับเงิน และจัดส่งเอง โดยรับผิดชอบอาหารและบริการของร้าน
                ส่วน huaychan ดูแลระบบที่ช่วยให้ร้านกับลูกค้ามาเจอกัน หากมีปัญหา ติดต่อร้านผ่านออเดอร์ได้เลย
                หรือแจ้งแอดมินให้ช่วยประสานงาน
              </p>
              <p className="mt-3 font-bold text-amber-900">ร้านเล็ก ๆ ก็มีหน้าร้านออนไลน์ของตัวเองได้ และทุกออเดอร์คือการอุดหนุนคนในชุมชน</p>
            </section>
            <div className="flex items-center justify-center gap-3 sm:gap-4 flex-wrap font-medium">
              <button
                type="button"
                onClick={() => { setTermsTab('customer'); setShowTermsModal(true); }}
                className="hover:text-orange-600 underline font-semibold transition text-xs sm:text-sm inline-flex items-center gap-1"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>ข้อกำหนดการใช้บริการ</span>
              </button>
              <span className="text-gray-300">•</span>
              <button
                type="button"
                onClick={() => { setTermsTab('privacy'); setShowTermsModal(true); }}
                className="hover:text-orange-600 underline font-semibold transition text-xs sm:text-sm inline-flex items-center gap-1"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>นโยบายความเป็นส่วนตัว</span>
              </button>
              <span className="text-gray-300">•</span>
              <button
                type="button"
                onClick={() => setShowContactModal(true)}
                className="hover:text-emerald-700 font-bold transition inline-flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-xl border border-emerald-200 shadow-2xs active:scale-95 text-xs sm:text-sm"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>ติดต่อเรา</span>
              </button>
            </div>
            <p className="text-[11px] text-gray-400">
              huaychan • แพลตฟอร์มสั่งอาหารชุมชนบ้านห้วยชัน - นาฝาย และ มหาวิทยาลัยราชภัฏชัยภูมิ
            </p>
          </footer>
        )}

      </div>

      {/* Floating Bottom Cart Bar (if user is in customer view and has items in cart) */}
      {viewMode === 'customer' && itemCount > 0 && (
        <div className="fixed bottom-3 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-4 sm:max-w-md z-30 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <button
            type="button"
            onClick={handleOpenCart}
            className="w-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white p-3.5 rounded-2xl shadow-xl shadow-orange-500/30 flex items-center justify-between active:scale-98 hover:shadow-2xl transition"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center font-bold text-sm">
                {itemCount}
              </div>
              <div className="text-left">
                <p className="text-xs text-amber-100 leading-none">
                  {shopCount > 1 ? `สั่งรวม ${shopCount} ร้านค้า` : `ร้าน ${currentShop?.name}`}
                </p>
                <p className="text-sm font-black mt-0.5">{total} บาท (รวมส่ง {deliveryFee} บ.)</p>
              </div>
            </div>

            <div className="flex items-center gap-1 font-bold text-xs bg-white/20 px-3 py-1.5 rounded-xl backdrop-blur-xs">
              <span>ไปที่ตะกร้า</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      )}

      {/* Floating Active Order Tracker Banner */}
      {viewMode === 'customer' && trackingOrders.length > 0 && (() => {
        const ongoingOrders = trackingOrders.filter((o) => o.status !== 'completed' && o.status !== 'cancelled');
        const allCompleted = ongoingOrders.length === 0 && trackingOrders.some((o) => o.status === 'completed');

        return (
          <div className={`fixed left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-20 animate-in fade-in slide-in-from-bottom-2 duration-200 ${
            itemCount > 0 ? 'bottom-[4.75rem] sm:bottom-[5.25rem]' : 'bottom-20 sm:bottom-24'
          }`}>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowTrackingModal(true)}
                className={`w-full text-white p-3 rounded-2xl shadow-xl flex items-center justify-between border transition active:scale-98 ${
                  hasCustomerUnreadMessage
                    ? 'bg-slate-900 border-amber-400 ring-2 ring-amber-400/50 animate-bounce'
                    : allCompleted
                    ? 'bg-slate-900 border-emerald-500 ring-1 ring-emerald-400/40'
                    : 'bg-slate-900 border-amber-500/40 animate-pulse'
                }`}
              >
                <div className="flex items-center gap-2.5 text-xs text-left min-w-0 pr-2">
                  <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                    {allCompleted ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Bike className="w-4 h-4 text-amber-400" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold flex items-center gap-1.5 flex-wrap">
                      {hasCustomerUnreadMessage && (
                        <span className="bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                          <MessageSquare className="w-2.5 h-2.5" /> มีข้อความจากร้าน!
                        </span>
                      )}
                      <span className="truncate">
                        {allCompleted
                          ? `อาหารส่งถึงแล้ว (${trackingOrders.length} ร้านค้า) แตะดู/ปิดงาน`
                          : ongoingOrders.length > 1
                          ? `กำลังจัดส่ง ${ongoingOrders.length} ร้านค้า (แตะดูสถานะ)`
                          : `ออเดอร์ #${formatOrderCode(trackingOrders[0])} กำลังดำเนินการ`}
                      </span>
                    </p>
                    <p className="text-[10px] text-gray-400 truncate">
                      {allCompleted ? 'แตะเพื่อรีวิว ให้คะแนน หรือปิดการติดตาม' : 'แตะเพื่อติดตามสถานะ & แชทกับร้าน'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-xl ${allCompleted ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'}`}>
                    {hasCustomerUnreadMessage ? 'ดูแชท' : allCompleted ? 'ดู/ปิดงาน' : 'ติดตาม'}
                  </span>
                </div>
              </button>
            </div>
          </div>
        );
      })()}

      {/* Cart & Checkout Modal */}
      {showCartModal && (
        <CartCheckoutModal
          onClose={() => setShowCartModal(false)}
          onRequireAuth={() => {
            setShowCartModal(false);
            setShowAuthModal(true);
          }}
          onOrderSuccess={(primaryOrderId, primaryOrder, allOrders) => {
            setShowCartModal(false);
            const newOrders = allOrders && allOrders.length > 0 ? allOrders : [primaryOrder];
            // BUG-08: merge new orders with existing ones instead of replacing
            setTrackingOrders(prev => {
              const merged = [
                ...newOrders,
                ...prev.filter(p => !newOrders.some(n => n.id === p.id)),
              ];
              try { localStorage.setItem('hchk_orders', JSON.stringify(merged)); } catch {}
              return merged;
            });
            setAutoOpenChatInTracking(true);
            setShowTrackingModal(true);
          }}
        />
      )}

      {/* Shop Detail Modal */}
      {selectedShopForDetail && (
        <ShopDetailModal
          shop={shops.find((s) => s.id === selectedShopForDetail.id) || selectedShopForDetail}
          menuItems={menuItems.filter((m) => m.shop_id === selectedShopForDetail.id)}
          onClose={() => setSelectedShopForDetail(null)}
          onOpenCart={handleOpenCart}
          onRequireLogin={() => setShowAuthModal(true)}
        />
      )}

      {/* Order Status Tracking Modal */}
      {showTrackingModal && trackingOrders.length > 0 && (
        <OrderStatusModal
          orderId={trackingOrders[0].id}
          initialOrder={trackingOrders[0]}
          initialOrders={trackingOrders}
          currentUser={user || {
            uid: trackingOrders[0].customer_uid || 'guest_user',
            display_name: trackingOrders[0].customer_name || 'ลูกค้า',
            role: 'customer' as UserRole,
          }}
          autoOpenChat={autoOpenChatInTracking}
          onClose={() => {
            setShowTrackingModal(false);
            setAutoOpenChatInTracking(false);
          }}
          onDismissOrder={handleDismissOrder}
          onDismissAllCompleted={handleDismissAllCompleted}
        />
      )}

      {/* Auth Modal (Email/Password & LINE) */}
      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} />
      )}

      {/* User Profile Modal */}
      {showProfileModal && (
        <UserProfileModal
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          onOpenOrderHistory={() => setShowOrderHistoryModal(true)}
        />
      )}

      {/* Customer Order History Modal */}
      {showOrderHistoryModal && (
        <OrderHistoryModal
          isOpen={showOrderHistoryModal}
          onClose={() => setShowOrderHistoryModal(false)}
          shops={shops}
          menuItems={menuItems}
          systemSettings={systemSettings}
          onOpenCart={handleOpenCart}
          onTrackOrder={(order) => {
            setTrackingOrders((prev) => {
              if (prev.some((o) => o.id === order.id)) return prev;
              return [order, ...prev];
            });
            setShowTrackingModal(true);
          }}
        />
      )}

      {/* Terms of Service Modal */}
      <TermsModal
        key={`${showTermsModal}-${termsTab}`}
        defaultTab={termsTab}
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        onOpenContact={() => setShowContactModal(true)}
      />

      {/* Contact Us Modal */}
      <ContactModal
        isOpen={showContactModal}
        onClose={() => setShowContactModal(false)}
      />

      {/* LINE Login Global Loading Overlay */}
      {isLineLoggingIn && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 text-center max-w-xs w-full shadow-2xl space-y-3.5 border border-emerald-100 animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-2xl bg-[#06C755]/10 text-[#06C755] flex items-center justify-center mx-auto relative shadow-inner">
              <svg className="w-9 h-9 fill-current" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 5.91 2 10.74c0 2.94 1.67 5.53 4.25 7.03-.18.66-.67 2.42-.77 2.79-.12.46.17.45.36.33.15-.09 2.06-1.4 2.89-1.97.42.06.84.09 1.27.09 5.52 0 10-3.91 10-8.74S17.52 2 12 2z"/>
              </svg>
              <div className="absolute inset-0 rounded-2xl border-2 border-[#06C755] border-t-transparent animate-spin" />
            </div>
            <div className="space-y-1">
              <h4 className="font-black text-base text-gray-900">กำลังเข้าสู่ระบบ LINE</h4>
              <p className="text-xs text-gray-500 mt-1">กำลังยืนยันข้อมูลผู้ใช้งาน กรุณารอสักครู่...</p>
            </div>
            <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-400 to-[#06C755] h-full w-2/3 rounded-full animate-pulse" />
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
