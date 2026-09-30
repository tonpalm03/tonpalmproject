'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Store, Power, Bell, BellOff, Phone, MapPin, Navigation, MessageSquare, Check,
  Clock, ChefHat, Bike, AlertCircle, Plus, DollarSign, Calendar, Upload, QrCode, X,
  Camera, Image as ImageIcon, Trash2, Scissors, Volume2, VolumeX, Sun, Moon, Edit2,
  ChevronLeft, ChevronRight, CheckCircle2, Eye, TrendingUp, Filter, UtensilsCrossed,
  CupSoda, Star, CreditCard, FileText, Sparkles, Package, BellRing, ChevronDown, ChevronUp, ChevronsDown, ChevronsUp
} from 'lucide-react';
import { Order, MenuItem, MenuItemOption, OptionGroup, OptionItem, MenuCategory, UserProfile, Shop, CreditTransaction } from '@/types';
import { db, functions } from '@/lib/firebase';
import {
  collection, query, where, onSnapshot, doc, updateDoc, addDoc, setDoc, deleteDoc, serverTimestamp, getDoc
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import ChatModal from './ChatModal';
import SalesDashboard from './SalesDashboard';
import MerchantCreditHistoryModal from './MerchantCreditHistoryModal';
import ImageCropModal from './ImageCropModal';
import FloatingBubbleControl from './FloatingBubbleControl';
import MapPicker from './MapPicker';
import { formatOrderCode } from '@/lib/orderNumber';
import { orderItemUnitPrice } from '@/lib/orderItemPrice';
import { soundAlert } from '@/lib/soundAlert';
import {
  getOrderDate, isSameDay, getWeekRange, getCycleId, formatThaiDate,
  formatThaiDateWithTime, formatCycleLabel, THAI_MONTHS_FULL
} from '@/lib/dateUtils';
import { registerMerchantPushNotifications } from '@/lib/pushNotifications';
import { readFileAsDataUrl } from '@/lib/imageUtils';

export const OPTION_PRESETS: { label: string; icon: string; groups: () => OptionGroup[] }[] = [
  {
    label: 'ก๋วยเตี๋ยว',
    icon: '🍜',
    groups: () => [
      {
        id: `grp_${Date.now()}_1`,
        title: '1. เลือกเส้น',
        required: true,
        type: 'single',
        options: [
          { id: '1', name: 'เส้นเล็ก', price: 0 },
          { id: '2', name: 'เส้นใหญ่', price: 0 },
          { id: '3', name: 'บะหมี่เหลือง', price: 0 },
          { id: '4', name: 'เส้นหมี่ขาว', price: 0 },
          { id: '5', name: 'วุ้นเส้น', price: 0 },
          { id: '6', name: 'เกาเหลา (ไม่ใส่เส้น)', price: 10 },
          { id: '7', name: 'มาม่า', price: 10 },
        ],
      },
      {
        id: `grp_${Date.now()}_2`,
        title: '2. เลือกน้ำซุป / รูปแบบ',
        required: true,
        type: 'single',
        options: [
          { id: '1', name: 'น้ำตกหมูตุ๋น', price: 0 },
          { id: '2', name: 'น้ำใสกระดูกหมู', price: 0 },
          { id: '3', name: 'ต้มยำน้ำ', price: 0 },
          { id: '4', name: 'ต้มยำแห้ง', price: 0 },
          { id: '5', name: 'แห้ง (คลุกซีอิ๊วดำ)', price: 0 },
        ],
      },
      {
        id: `grp_${Date.now()}_3`,
        title: '3. ขนาด / ความพิเศษ',
        required: true,
        type: 'single',
        options: [
          { id: '1', name: 'ธรรมดา', price: 0 },
          { id: '2', name: 'พิเศษ', price: 10 },
          { id: '3', name: 'จัมโบ้รวมมิตร', price: 20 },
        ],
      },
      {
        id: `grp_${Date.now()}_4`,
        title: '4. เพิ่มท็อปปิ้งเสริม',
        required: false,
        type: 'multiple',
        options: [
          { id: '1', name: 'เพิ่มกากหมูเจียวกรอบ', price: 15 },
          { id: '2', name: 'เพิ่มลูกชิ้นหมู 4 ลูก', price: 10 },
          { id: '3', name: 'เพิ่มไข่ออนเซ็น / ต้มยางมะตูม', price: 10 },
          { id: '4', name: 'เพิ่มเกี๊ยวทอดกรอบ', price: 10 },
        ],
      },
    ],
  },
  {
    label: 'ลูกชิ้น / ของทอด',
    icon: '🍢',
    groups: () => [
      {
        id: `grp_${Date.now()}_1`,
        title: '1. วิธีการทำ',
        required: true,
        type: 'single',
        options: [
          { id: '1', name: 'ทอดกรอบ', price: 0 },
          { id: '2', name: 'ปิ้งเตาถ่าน', price: 0 },
          { id: '3', name: 'นึ่งสมุนไพร / ลวกจิ้ม', price: 0 },
        ],
      },
      {
        id: `grp_${Date.now()}_2`,
        title: '2. เลือกน้ำจิ้ม',
        required: true,
        type: 'single',
        options: [
          { id: '1', name: 'น้ำจิ้มมะขามเปรี้ยวหวาน', price: 0 },
          { id: '2', name: 'น้ำจิ้มพริกเผาเผ็ดแซ่บ', price: 0 },
          { id: '3', name: 'น้ำจิ้มซีฟู้ดมะนาวสด', price: 0 },
          { id: '4', name: 'ผสมน้ำจิ้มหวาน + เผ็ด', price: 0 },
        ],
      },
      {
        id: `grp_${Date.now()}_3`,
        title: '3. การราดน้ำจิ้ม',
        required: true,
        type: 'single',
        options: [
          { id: '1', name: 'ราดน้ำจิ้มเลย', price: 0 },
          { id: '2', name: 'แยกน้ำจิ้มใส่ถุง', price: 0 },
        ],
      },
      {
        id: `grp_${Date.now()}_4`,
        title: '4. ผักเคียง',
        required: false,
        type: 'single',
        options: [
          { id: '1', name: 'รับผักสด (กะหล่ำ + แตงกวา)', price: 0 },
          { id: '2', name: 'ไม่รับผัก', price: 0 },
        ],
      },
    ],
  },
  {
    label: 'เครื่องดื่ม / ชานม',
    icon: '🧋',
    groups: () => [
      {
        id: `grp_${Date.now()}_1`,
        title: '1. ระดับความหวาน',
        required: true,
        type: 'single',
        options: [
          { id: '1', name: 'หวานปกติ (100%)', price: 0 },
          { id: '2', name: 'หวานน้อย (50%)', price: 0 },
          { id: '3', name: 'หวานน้อยมาก (25%)', price: 0 },
          { id: '4', name: 'ไม่หวานเลย (0%)', price: 0 },
        ],
      },
      {
        id: `grp_${Date.now()}_2`,
        title: '2. ปริมาณน้ำแข็ง',
        required: true,
        type: 'single',
        options: [
          { id: '1', name: 'น้ำแข็งปกติ', price: 0 },
          { id: '2', name: 'น้ำแข็งน้อย', price: 0 },
          { id: '3', name: 'แยกน้ำแข็ง (ใส่ถุง)', price: 5 },
        ],
      },
      {
        id: `grp_${Date.now()}_3`,
        title: '3. เพิ่มท็อปปิ้ง',
        required: false,
        type: 'multiple',
        options: [
          { id: '1', name: 'ไข่มุกหนึบ', price: 10 },
          { id: '2', name: 'บุกคริสตัล', price: 10 },
          { id: '3', name: 'เฉาก๊วยหนึบ', price: 10 },
          { id: '4', name: 'วิปครีม', price: 15 },
        ],
      },
    ],
  },
  {
    label: 'อาหารตามสั่ง',
    icon: '🍚',
    groups: () => [
      {
        id: `grp_${Date.now()}_1`,
        title: '1. เลือกเนื้อสัตว์',
        required: true,
        type: 'single',
        options: [
          { id: '1', name: 'หมูชิ้น / หมูสับ', price: 0 },
          { id: '2', name: 'ไก่', price: 0 },
          { id: '3', name: 'หมูกรอบ', price: 10 },
          { id: '4', name: 'ทะเล (กุ้ง+หมึก)', price: 20 },
        ],
      },
      {
        id: `grp_${Date.now()}_2`,
        title: '2. เพิ่มไข่',
        required: false,
        type: 'single',
        options: [
          { id: '1', name: 'ไข่ดาวไม่สุก', price: 10 },
          { id: '2', name: 'ไข่ดาวสุก', price: 10 },
          { id: '3', name: 'ไข่เจียว', price: 15 },
          { id: '4', name: 'ไข่ข้น', price: 15 },
        ],
      },
      {
        id: `grp_${Date.now()}_3`,
        title: '3. ระดับความเผ็ด',
        required: false,
        type: 'single',
        options: [
          { id: '1', name: 'เผ็ดมาก (พริก 5 เม็ด)', price: 0 },
          { id: '2', name: 'เผ็ดกลาง (พริก 3 เม็ด)', price: 0 },
          { id: '3', name: 'เผ็ดน้อย (พริก 1 เม็ด)', price: 0 },
          { id: '4', name: 'ไม่ใส่พริกเลย', price: 0 },
        ],
      },
    ],
  },
];

interface MerchantDashboardProps {
  currentUser: UserProfile;
}



export default function MerchantDashboard({ currentUser }: MerchantDashboardProps) {
  // BUG-06: no fallback to shop_1 — if shop_id is missing, show error state
  const shopId = currentUser.shop_id;
  const [isOpen, setIsOpen] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [activeTab, setActiveTab] = useState<'orders' | 'menu' | 'sales' | 'shop_info'>('orders');
  const [orderFilterTab, setOrderFilterTab] = useState<'active' | 'completed' | 'cancelled'>('active');
  const [activeChatOrder, setActiveChatOrder] = useState<Order | null>(null);
  const [systemSettings, setSystemSettings] = useState<{ gp_enabled?: boolean; gp_percent?: number } | null>(null);
  const [showTopupContactModal, setShowTopupContactModal] = useState(false);
  const [showCreditHistoryModal, setShowCreditHistoryModal] = useState(false);
  const [creditTransactions, setCreditTransactions] = useState<CreditTransaction[]>([]);
  const [collapsedOrderMap, setCollapsedOrderMap] = useState<{ [id: string]: boolean }>({});

  const isOrderCollapsed = (order: Order) => {
    if (collapsedOrderMap[order.id] !== undefined) {
      return collapsedOrderMap[order.id];
    }
    // Completed and cancelled orders default to collapsed to save vertical scrolling
    return order.status === 'completed' || order.status === 'cancelled';
  };

  const toggleOrderCollapse = (orderId: string, currentStatus?: string) => {
    setCollapsedOrderMap((prev) => {
      const currentVal = prev[orderId] !== undefined ? prev[orderId] : (currentStatus === 'completed' || currentStatus === 'cancelled');
      return {
        ...prev,
        [orderId]: !currentVal,
      };
    });
  };

  const toggleAllOrders = (collapse: boolean, ordersList: Order[]) => {
    const updated: { [id: string]: boolean } = {};
    ordersList.forEach((o) => {
      updated[o.id] = collapse;
    });
    setCollapsedOrderMap((prev) => ({ ...prev, ...updated }));
  };

  // Realtime listener for platform GP settings
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'system_settings', 'general'), (snap) => {
      if (snap.exists()) {
        setSystemSettings(snap.data() as any);
      }
    });
    return () => unsub();
  }, []);

  // Realtime listener for shop's credit transactions (top-ups, GP deductions, adjustments)
  useEffect(() => {
    if (!shopId) return;
    try {
      const q = query(collection(db, 'credit_transactions'), where('shop_id', '==', shopId));
      const unsub = onSnapshot(q, (snap) => {
        const list: CreditTransaction[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as CreditTransaction);
        });
        setCreditTransactions(list);
      }, (err) => {
        console.warn('Shop credit transactions listener warning:', err);
      });
      return () => unsub();
    } catch (e) {
      console.warn('Shop credit transactions setup error:', e);
    }
  }, [shopId]);

  // Sound & Continuous Alarm States
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [isAlarmMuted, setIsAlarmMuted] = useState(false);
  const [isWakeLockActive, setIsWakeLockActive] = useState(false);
  const [soundTestMessage, setSoundTestMessage] = useState<string | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const knownPendingOrderIdsRef = useRef<Set<string>>(new Set());
  const knownUnreadMessagesMapRef = useRef<Map<string, string>>(new Map());
  const isInitialLoadRef = useRef(true);
  // BUG-11: keep isSoundEnabled in a ref so the orders listener doesn't rebuild on toggle
  const isSoundEnabledRef = useRef(isSoundEnabled);
  useEffect(() => { isSoundEnabledRef.current = isSoundEnabled; }, [isSoundEnabled]);

  // Check & register Push Notifications on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
    if (shopId) {
      registerMerchantPushNotifications(
        shopId,
        () => {
          // Notification received in foreground
        },
        () => {
          // Notification tapped
          setActiveTab('orders');
        }
      ).then((res) => {
        if (res.registered) {
          setNotificationPermission('granted');
        }
      }).catch((e) => console.warn('Push registration error on mount:', e));
    }
  }, [shopId]);

  const handleRequestNotificationPermission = async () => {
    if (shopId) {
      const res = await registerMerchantPushNotifications(
        shopId,
        () => {},
        () => setActiveTab('orders')
      );
      if (res.registered) {
        setNotificationPermission('granted');
        alert('เปิดรับการแจ้งเตือนออเดอร์บนอุปกรณ์นี้สำเร็จแล้วครับ!\nแม้ปิดแอปสนิทก็จะมีแจ้งเตือนเด้งขึ้นมาพร้อมเสียงเตือน');
        return;
      } else if (res.error) {
        alert(res.error);
        return;
      }
    }

    if (typeof window === 'undefined' || !('Notification' in window)) {
      alert('อุปกรณ์นี้ไม่รองรับการแจ้งเตือน');
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);
      if (perm === 'granted') {
        alert('เปิดรับการแจ้งเตือนสำเร็จ!');
      } else if (perm === 'denied') {
        alert('การแจ้งเตือนถูกปิดกั้นไว้ สามารถไปเปิดได้ในการตั้งค่าการแจ้งเตือนของอุปกรณ์หรือเบราว์เซอร์ครับ');
      }
    } catch (err) {
      console.warn('Request notification error:', err);
    }
  };



  // Shop Data state
  const [shopData, setShopData] = useState<Shop | null>(null);
  const [editShopName, setEditShopName] = useState('');
  const [editShopPhone, setEditShopPhone] = useState('');
  const [editShopAddress, setEditShopAddress] = useState('');
  const [editShopDeliveryFee, setEditShopDeliveryFee] = useState<string>('0');
  const [editShopDeliveryRadius, setEditShopDeliveryRadius] = useState<string>('1.0');
  const [editShopBankName, setEditShopBankName] = useState('');
  const [editShopBankAccountNumber, setEditShopBankAccountNumber] = useState('');
  const [editShopBankAccountName, setEditShopBankAccountName] = useState('');
  const [editShopPromptpay, setEditShopPromptpay] = useState('');
  const [editShopPromptpayQrUrl, setEditShopPromptpayQrUrl] = useState('');
  const [editShopAllowCod, setEditShopAllowCod] = useState(false);
  const [shopLocation, setShopLocation] = useState<{ lat: number; lng: number }>({ lat: 15.8272, lng: 102.0298 });
  const [isSavingShopInfo, setIsSavingShopInfo] = useState(false);
  const [cropTarget, setCropTarget] = useState<'menu' | 'shop_cover' | 'shop_qr'>('menu');
  const [menuCategoryFilter, setMenuCategoryFilter] = useState<'all' | 'food' | 'drink_dessert'>('all');
  const shopCoverInputRef = useRef<HTMLInputElement | null>(null);
  const shopQrInputRef = useRef<HTMLInputElement | null>(null);
  // BUG-19: track dirty state so Firestore snapshot doesn't reset fields while editing
  const shopNameDirtyRef = useRef(false);
  const shopPhoneDirtyRef = useRef(false);
  const shopAddressDirtyRef = useRef(false);
  const shopDeliveryFeeDirtyRef = useRef(false);
  const shopDeliveryRadiusDirtyRef = useRef(false);
  const shopBankNameDirtyRef = useRef(false);
  const shopBankAccountNumberDirtyRef = useRef(false);
  const shopBankAccountNameDirtyRef = useRef(false);
  const shopPromptpayDirtyRef = useRef(false);
  const shopPromptpayQrUrlDirtyRef = useRef(false);
  const shopAllowCodDirtyRef = useRef(false);
  const shopLocationDirtyRef = useRef(false);

  // New Menu form state
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [newMenuName, setNewMenuName] = useState('');
  const [newMenuPrice, setNewMenuPrice] = useState('');
  const [newMenuCategory, setNewMenuCategory] = useState<MenuCategory>('food');
  const [newMenuImage, setNewMenuImage] = useState('');
  const [newMenuOptions, setNewMenuOptions] = useState<MenuItemOption[]>([]);
  const [newMenuOptionGroups, setNewMenuOptionGroups] = useState<OptionGroup[]>([]);
  const [editingItemForImage, setEditingItemForImage] = useState<MenuItem | null>(null);
  const [rawImageForCrop, setRawImageForCrop] = useState<string | null>(null);
  const [isEditingForCrop, setIsEditingForCrop] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const editFileInputRef = useRef<HTMLInputElement | null>(null);

  // Edit Existing Menu Item details state
  const [editingMenuItem, setEditingMenuItem] = useState<MenuItem | null>(null);
  const [editItemName, setEditItemName] = useState('');
  const [editItemPrice, setEditItemPrice] = useState('');
  const [editItemCategory, setEditItemCategory] = useState<MenuCategory>('food');
  const [editItemImage, setEditItemImage] = useState('');
  const [editItemOptions, setEditItemOptions] = useState<MenuItemOption[]>([]);
  const [editItemOptionGroups, setEditItemOptionGroups] = useState<OptionGroup[]>([]);

  const [statusToast, setStatusToast] = useState<{ message: string; type: 'open' | 'close' } | null>(null);

  const [shopReviews, setShopReviews] = useState<any[]>([]);

  // Realtime Shop Reviews Listener
  useEffect(() => {
    if (!shopId) return;
    try {
      const q = query(collection(db, 'shop_reviews'), where('shop_id', '==', shopId));
      const unsub = onSnapshot(q, (snap) => {
        const list: any[] = [];
        snap.forEach((d) => {
          const rev = d.data();
          if (Number.isInteger(rev.rating) && rev.rating >= 1 && rev.rating <= 5) list.push(rev);
        });
        setShopReviews(list);
      });
      return () => unsub();
    } catch (e) {
      console.warn('Merchant shop reviews listener error:', e);
    }
  }, [shopId]);

  // Realtime Shop Data Listener
  useEffect(() => {
    if (!shopId) return;
    try {
      const unsub = onSnapshot(doc(db, 'shops', shopId), (docSnap) => {
        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() } as Shop;
          setShopData(data);

          // If GP is active and credit is 0 or negative, automatically lock shop closed
          const isCreditDepleted = systemSettings?.gp_enabled === true && (data.credit_balance ?? 0) <= 0;
          if (isCreditDepleted) {
            setIsOpen(false);
            if (data.is_open !== false) {
              updateDoc(doc(db, 'shops', shopId), { is_open: false }).catch(() => {});
            }
          } else {
            setIsOpen(data.is_open ?? true);
          }

          // BUG-19: only reset edit fields if not currently being edited
          if (!shopNameDirtyRef.current) setEditShopName(data.name || '');
          if (!shopPhoneDirtyRef.current) setEditShopPhone(data.phone || '');
          if (!shopAddressDirtyRef.current) setEditShopAddress(data.address_detail || '');
          if (!shopDeliveryFeeDirtyRef.current) setEditShopDeliveryFee(String(data.delivery_fee ?? 0));
          if (!shopDeliveryRadiusDirtyRef.current) setEditShopDeliveryRadius(String(data.delivery_radius_km ?? 1.0));
          if (!shopBankNameDirtyRef.current) setEditShopBankName(data.bank_name || '');
          if (!shopBankAccountNumberDirtyRef.current) setEditShopBankAccountNumber(data.bank_account_number || '');
          if (!shopBankAccountNameDirtyRef.current) setEditShopBankAccountName(data.bank_account_name || '');
          if (!shopPromptpayDirtyRef.current) setEditShopPromptpay(data.promptpay_number || '');
          if (!shopPromptpayQrUrlDirtyRef.current) setEditShopPromptpayQrUrl(data.promptpay_qr_url || '');
          if (!shopAllowCodDirtyRef.current) setEditShopAllowCod(data.allow_cod ?? false);
          if (!shopLocationDirtyRef.current && data.location?.lat && data.location?.lng) {
            setShopLocation(data.location);
          }
        }
      });
      return () => unsub();
    } catch (e) {
      console.warn('Shop data listener error:', e);
    }
  }, [shopId, systemSettings?.gp_enabled]);

  // Monitor GP toggle and credit balance changes to auto-close if credit runs out
  useEffect(() => {
    if (systemSettings?.gp_enabled === true && (shopData?.credit_balance ?? 0) <= 0 && isOpen && shopId) {
      setIsOpen(false);
      updateDoc(doc(db, 'shops', shopId), { is_open: false }).catch(() => {});
    }
  }, [systemSettings?.gp_enabled, shopData?.credit_balance, isOpen, shopId]);


  // Realtime Orders Listener
  useEffect(() => {
    if (!shopId) return;
    try {
      const ordersRef = collection(db, 'orders');
      const q = query(ordersRef, where('shop_id', '==', shopId));

      const unsub = onSnapshot(q, (snapshot) => {
        const list: Order[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Order);
        });
        // Sort by date desc using getOrderDate helper (supports Timestamp, string, or Date)
        list.sort((a, b) => (getOrderDate(b)?.getTime() || 0) - (getOrderDate(a)?.getTime() || 0));
        setOrders(list);

        const pending = list.filter((o) => o.status === 'pending');
        const unreadFromCustomers = list.filter((o) => o.has_unread_message);

        if (isInitialLoadRef.current) {
          isInitialLoadRef.current = false;
          pending.forEach((o) => knownPendingOrderIdsRef.current.add(o.id));
          unreadFromCustomers.forEach((o) => {
            const sig = `${o.last_message || ''}_${(o as any).last_message_at?.seconds || ''}`;
            knownUnreadMessagesMapRef.current.set(o.id, sig);
          });
        } else {
          const hasNewPending = pending.some((o) => !knownPendingOrderIdsRef.current.has(o.id));
          if (hasNewPending) {
            pending.forEach((o) => knownPendingOrderIdsRef.current.add(o.id));
            setIsAlarmMuted(false); // Unmute for newly arrived orders
            if (isSoundEnabledRef.current) {
              soundAlert.playOrderChime();
            }
            // Trigger OS System Notification if granted
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then((reg) => {
                  reg.showNotification('มีออเดอร์ใหม่เข้ามา!', {
                    body: `มีออเดอร์รอดำเนินการ ${pending.length} รายการ กรุณากดเพื่อเปิดดูและรับออเดอร์`,
                    icon: '/icon-192.png',
                    badge: '/icon-192.png',
                    tag: 'order-alert-' + Date.now(),
                    requireInteraction: true
                  });
                }).catch(() => {});
              }
            }
          }

          // Check for new incoming customer messages (including on completed orders)
          const newMsgOrders = unreadFromCustomers.filter((o) => {
            const sig = `${o.last_message || ''}_${(o as any).last_message_at?.seconds || ''}`;
            return knownUnreadMessagesMapRef.current.get(o.id) !== sig;
          });

          if (newMsgOrders.length > 0) {
            unreadFromCustomers.forEach((o) => {
              const sig = `${o.last_message || ''}_${(o as any).last_message_at?.seconds || ''}`;
              knownUnreadMessagesMapRef.current.set(o.id, sig);
            });

            // Play message sound chime
            if (isSoundEnabledRef.current) {
              soundAlert.playMessageSound();
            }

            // Trigger OS notification for message
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              if ('serviceWorker' in navigator) {
                const latest = newMsgOrders[0];
                navigator.serviceWorker.ready.then((reg) => {
                  reg.showNotification(`ข้อความใหม่จากลูกค้า: ${latest.customer_name || 'ลูกค้า'}`, {
                    body: `${latest.last_message || 'ส่งรูปภาพ/ข้อความ'} (ออเดอร์ #${formatOrderCode(latest)})`,
                    icon: '/icon-192.png',
                    badge: '/icon-192.png',
                    tag: 'chat-alert-' + Date.now(),
                    requireInteraction: true
                  });
                }).catch(() => {});
              }
            }
          }
        }
      }, (err) => {
        console.warn('Orders listener fallback:', err);
        const cached = localStorage.getItem('hchk_orders');
        if (cached) {
          const allOrders = JSON.parse(cached);
          const shopOrders = allOrders.filter((o: Order) => o.shop_id === shopId);
          setOrders(shopOrders);
          const pending = shopOrders.filter((o: Order) => o.status === 'pending');
          const hasNewPending = pending.some((o: Order) => !knownPendingOrderIdsRef.current.has(o.id));
          if (hasNewPending) {
            pending.forEach((o: Order) => knownPendingOrderIdsRef.current.add(o.id));
            setIsAlarmMuted(false);
            if (isSoundEnabledRef.current) {
              soundAlert.playOrderChime();
            }
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then((reg) => {
                  reg.showNotification('มีออเดอร์ใหม่เข้ามา!', {
                    body: `มีออเดอร์รอดำเนินการ ${pending.length} รายการ`,
                    icon: '/icon-192.png',
                    badge: '/icon-192.png',
                    tag: 'order-alert-' + Date.now(),
                    requireInteraction: true
                  });
                }).catch(() => {});
              }
            }
          }
        }
      });

      return () => unsub();
    } catch (e) {
      console.error(e);
    }
  }, [shopId]); // BUG-11: isSoundEnabled moved to ref — no longer a dep

  // Derived list of orders awaiting restaurant acceptance
  const pendingOrders = orders.filter((o) => o.status === 'pending');

  // 🔔 Continuous Alarm Loop: rings every 3.5 seconds while pending orders exist
  useEffect(() => {
    if (pendingOrders.length === 0 || !isSoundEnabled || isAlarmMuted) {
      return;
    }

    // BUG-31: removed immediate playOrderChime() here to avoid double-chime with listener
    // Repeat every 3.5 seconds until accepted, cancelled, or muted

    // Repeat every 3.5 seconds until accepted, cancelled, or muted
    const timer = setInterval(() => {
      soundAlert.playOrderChime();
    }, 3500);

    return () => clearInterval(timer);
  }, [pendingOrders.length, isSoundEnabled, isAlarmMuted]);

  // Clean up wake lock on unmount
  useEffect(() => {
    return () => {
      soundAlert.releaseWakeLock();
    };
  }, []);

  // Handlers for Audio Test and WakeLock
  const handleTestSound = async () => {
    setSoundTestMessage('กำลังทดสอบเสียงกระดิ่งออเดอร์ใหม่...');
    await soundAlert.unlock();
    const played = await soundAlert.playOrderChime();
    if (played) {
      setSoundTestMessage('ระบบเสียงทำงานปกติ! (Ding-Dong!)');
      setTimeout(() => setSoundTestMessage(null), 4000);
    } else {
      setSoundTestMessage('หากไม่ได้ยินเสียง กรุณาตรวจสอบสวิตช์ปิดเสียง (Silent Mode) ของอุปกรณ์');
    }
  };

  const handleTestAcceptSound = async () => {
    setSoundTestMessage('กำลังทดสอบเสียงกดรับออเดอร์...');
    await soundAlert.unlock();
    const played = await soundAlert.playOrderAcceptedSound();
    if (played) {
      setSoundTestMessage('เสียงกดรับออเดอร์ทำงานปกติ! (Ding-Ding-Dong!)');
      setTimeout(() => setSoundTestMessage(null), 4000);
    } else {
      setSoundTestMessage('กรุณาตรวจสอบว่าเปิดเสียงของอุปกรณ์แล้ว');
    }
  };

  const handleTestDeliveringSound = async () => {
    setSoundTestMessage('กำลังทดสอบเสียงกำลังออกไปส่ง...');
    await soundAlert.unlock();
    const played = await soundAlert.playOrderDeliveringSound();
    if (played) {
      setSoundTestMessage('เสียงออกไปส่งทำงานปกติ!');
      setTimeout(() => setSoundTestMessage(null), 4000);
    } else {
      setSoundTestMessage('กรุณาตรวจสอบว่าเปิดเสียงของอุปกรณ์แล้ว');
    }
  };

  const handleTestCompletedSound = async () => {
    setSoundTestMessage('กำลังทดสอบเสียงส่งถึงมือ + รับเงินเรียบร้อย...');
    await soundAlert.unlock();
    const played = await soundAlert.playOrderCompletedSound();
    if (played) {
      setSoundTestMessage('เสียงรับเงินสำเร็จทำงานปกติ! (Ka-Ching!)');
      setTimeout(() => setSoundTestMessage(null), 4000);
    } else {
      setSoundTestMessage('กรุณาตรวจสอบว่าเปิดเสียงของอุปกรณ์แล้ว');
    }
  };

  const toggleWakeLock = async () => {
    if (isWakeLockActive) {
      soundAlert.releaseWakeLock();
      setIsWakeLockActive(false);
    } else {
      const ok = await soundAlert.requestWakeLock();
      if (ok) {
        setIsWakeLockActive(true);
      } else {
        alert('อุปกรณ์นี้ไม่รองรับการเปิดหน้าจอค้างไว้ หรือระบบยังไม่อนุญาตครับ');
      }
    }
  };


  // Realtime Menu Items Listener
  useEffect(() => {
    if (!shopId) return;
    try {
      const menuRef = collection(db, 'menu_items');
      const q = query(menuRef, where('shop_id', '==', shopId));

      const unsub = onSnapshot(q, (snapshot) => {
        const list: MenuItem[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as MenuItem);
        });
        setMenuItems(list);
      }, (err) => {
        console.warn('Menu items listener fallback:', err);
      });

      return () => unsub();
    } catch (e) {
      console.error(e);
    }
  }, [shopId]);

  const updateOrderStatus = async (orderId: string, nextStatus: Order['status']) => {
    try {
      if (nextStatus === 'completed') {
        const complete = httpsCallable<{ orderId: string }, { success: boolean }>(functions, 'completeOrder');
        await complete({ orderId });
      } else {
        await updateDoc(doc(db, 'orders', orderId), {
          status: nextStatus,
        });
      }

      // 🔔 Play sound effect ONLY after server update succeeds
      if (nextStatus === 'cooking') {
        soundAlert.playOrderAcceptedSound();
      } else if (nextStatus === 'delivering') {
        soundAlert.playOrderDeliveringSound();
      } else if (nextStatus === 'completed') {
        soundAlert.playOrderCompletedSound();
      }
    } catch (e: unknown) {
      console.warn('Order status update failed:', e);
      // Map Firebase error codes to human-readable Thai messages
      const code = (e as { code?: string })?.code ?? '';
      let msg = 'บันทึกสถานะไม่สำเร็จ กรุณาลองใหม่';
      if (code === 'functions/failed-precondition') {
        msg = 'ไม่สามารถจบออเดอร์ได้\nออเดอร์ต้องอยู่ในสถานะ "กำลังจัดส่ง" ก่อนจึงจะกดจบได้';
      } else if (code === 'functions/permission-denied') {
        msg = 'คุณไม่มีสิทธิ์จัดการออเดอร์นี้';
      } else if (code === 'functions/unauthenticated') {
        msg = 'เซสชันหมดอายุ กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่';
      } else if (code === 'functions/not-found') {
        msg = 'ไม่พบออเดอร์นี้ในระบบ';
      } else if (code === 'permission-denied' || code === 'PERMISSION_DENIED') {
        msg = 'สิทธิ์ไม่เพียงพอ กรุณาติดต่อแอดมิน';
      }
      alert(msg);
    }
  };

  const handleToggleOpen = async () => {
    if (!shopId) return;
    const next = !isOpen;

    // ตรวจสอบเครดิตก่อนเปิดร้าน: หากระบบเปิดเก็บ GP อยู่ และเครดิตหมด (<= 0) จะไม่อนุญาตให้เปิดร้าน
    if (next && systemSettings?.gp_enabled === true) {
      const currentCredit = shopData?.credit_balance ?? 0;
      if (currentCredit <= 0) {
        setShowTopupContactModal(true);
        alert(
          `ไม่สามารถเปิดร้านได้!\n\nยอดเครดิตคงเหลือของคุณไม่เพียงพอ (฿${currentCredit.toFixed(2)})\nระบบจำเป็นต้องมีเครดิตเพื่อใช้หักค่าคอมมิชชั่น GP ${systemSettings?.gp_percent || 5}%\n\nกรุณาแตะปุ่ม "เติมเครดิต" เพื่อติดต่อแอดมินทาง LINE ครับ`
        );
        return;
      }
    }

    try {
      await updateDoc(doc(db, 'shops', shopId), { is_open: next });
      setIsOpen(next);
      soundAlert.playShopToggleSound(next);

      setStatusToast({
        message: next
          ? 'เปิดร้านรับออเดอร์แล้ว! พร้อมรับลูกค้า'
          : 'ปิดร้านชั่วคราวแล้ว หยุดรับออเดอร์',
        type: next ? 'open' : 'close',
      });
      setTimeout(() => {
        setStatusToast(null);
      }, 3000);
    } catch (e) {
      console.warn('Update shop is_open error:', e);
      alert('ไม่สามารถเปลี่ยนสถานะร้านค้าได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต');
    }
  };

  const handleShopCoverFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const input = e.target;

    try {
      const result = await readFileAsDataUrl(file);
      setCropTarget('shop_cover');
      setRawImageForCrop(result);
    } catch (err: any) {
      console.error('Shop cover file read error:', err);
      alert(err.message || 'ไม่สามารถอ่านไฟล์รูปภาพได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      input.value = '';
    }
  };

  const handleUpdateShopCover = async (imageUrl: string) => {
    if (!shopId) throw new Error('ไม่พบข้อมูลร้านค้า กรุณาเข้าสู่ระบบใหม่');
    try {
      await updateDoc(doc(db, 'shops', shopId), { image_url: imageUrl });
      setShopData((prev: Shop | null) => (prev ? { ...prev, image_url: imageUrl } : null));
      alert('อัปเดตรูปภาพหน้าร้านเรียบร้อยแล้ว!');
    } catch (e) {
      console.warn('Update shop cover error:', e);
      throw new Error('เกิดข้อผิดพลาดในการบันทึกรูปภาพ กรุณาลองใหม่อีกครั้ง');
    }
  };

  const handleRemoveShopCover = async () => {
    if (!shopId) return;
    if (!confirm('คุณต้องการลบรูปภาพหน้าร้าน และกลับไปใช้รูปภาพเริ่มต้นใช่หรือไม่?')) {
      return;
    }
    try {
      await updateDoc(doc(db, 'shops', shopId), { image_url: '' });
      setShopData((prev: Shop | null) => (prev ? { ...prev, image_url: '' } : null));
      alert('ลบรูปภาพหน้าร้านเรียบร้อยแล้ว');
    } catch (e) {
      console.warn('Remove shop cover error:', e);
      alert('เกิดข้อผิดพลาดในการลบรูปภาพ กรุณาลองใหม่อีกครั้ง');
    }
  };

  const handleSaveShopInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopId) {
      alert('ไม่พบรหัสร้านค้าของคุณ กรุณาเข้าสู่ระบบใหม่อีกครั้ง');
      return;
    }
    setIsSavingShopInfo(true);
    try {
      const parsedRadius = parseFloat(editShopDeliveryRadius);
      const updatePayload: Record<string, any> = {
        name: editShopName.trim(),
        phone: editShopPhone.trim(),
        address_detail: editShopAddress.trim(),
        delivery_fee: Number(editShopDeliveryFee) || 0,
        delivery_radius_km: (!isNaN(parsedRadius) && parsedRadius > 0) ? Math.round(parsedRadius * 10) / 10 : 1.0,
        bank_name: editShopBankName.trim(),
        bank_account_number: editShopBankAccountNumber.trim(),
        bank_account_name: editShopBankAccountName.trim(),
        promptpay_number: editShopPromptpay.trim(),
        promptpay_qr_url: editShopPromptpayQrUrl.trim(),
        allow_cod: Boolean(editShopAllowCod),
      };

      if (shopLocation?.lat && shopLocation?.lng) {
        updatePayload.location = {
          lat: Number(shopLocation.lat),
          lng: Number(shopLocation.lng),
        };
      }

      await updateDoc(doc(db, 'shops', shopId), updatePayload);
      shopNameDirtyRef.current = false;
      shopPhoneDirtyRef.current = false;
      shopAddressDirtyRef.current = false;
      shopDeliveryFeeDirtyRef.current = false;
      shopDeliveryRadiusDirtyRef.current = false;
      shopBankNameDirtyRef.current = false;
      shopBankAccountNumberDirtyRef.current = false;
      shopBankAccountNameDirtyRef.current = false;
      shopPromptpayDirtyRef.current = false;
      shopPromptpayQrUrlDirtyRef.current = false;
      shopAllowCodDirtyRef.current = false;
      shopLocationDirtyRef.current = false;
      alert('บันทึกข้อมูลร้านค้าเรียบร้อยแล้ว!');
    } catch (err: any) {
      console.warn('Save shop info error:', err);
      alert(`เกิดข้อผิดพลาดในการบันทึกข้อมูล: ${err?.message || 'กรุณาลองใหม่อีกครั้ง'}`);
    } finally {
      setIsSavingShopInfo(false);
    }
  };

  const handleQrImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const input = e.target;
    try {
      const result = await readFileAsDataUrl(file);
      setCropTarget('shop_qr');
      setRawImageForCrop(result);
      setIsEditingForCrop(false);
    } catch (err: any) {
      console.error('QR image file read error:', err);
      alert(err.message || 'ไม่สามารถอ่านไฟล์รูปภาพ QR ได้');
    } finally {
      input.value = '';
    }
  };

  const handleRemoveShopQr = async () => {
    if (!confirm('คุณต้องการลบรูปภาพ QR Code รับเงินใช่หรือไม่?')) return;
    shopPromptpayQrUrlDirtyRef.current = true;
    setEditShopPromptpayQrUrl('');
    if (shopId) {
      try {
        await updateDoc(doc(db, 'shops', shopId), { promptpay_qr_url: '' });
      } catch (e) {}
    }
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>, isEditing = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const input = e.target;

    try {
      const result = await readFileAsDataUrl(file);
      setCropTarget('menu');
      setRawImageForCrop(result);
      setIsEditingForCrop(isEditing);
    } catch (err: any) {
      console.error('Menu image file read error:', err);
      alert(err.message || 'ไม่สามารถอ่านไฟล์รูปภาพได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      input.value = '';
    }
  };

  const handleCropFinished = async (croppedDataUrl: string) => {
    if (cropTarget === 'shop_cover') {
      await handleUpdateShopCover(croppedDataUrl);
    } else if (cropTarget === 'shop_qr') {
      shopPromptpayQrUrlDirtyRef.current = true;
      setEditShopPromptpayQrUrl(croppedDataUrl);
    } else if (isEditingForCrop) {
      setEditItemImage(croppedDataUrl);
      if (editingItemForImage) {
        handleUpdateItemImage(editingItemForImage.id, croppedDataUrl);
      }
    } else {
      setNewMenuImage(croppedDataUrl);
    }
    setRawImageForCrop(null);
  };

  const handleUpdateItemImage = async (itemId: string, imageUrl: string) => {
    try {
      await updateDoc(doc(db, 'menu_items', itemId), { image_url: imageUrl });
      setMenuItems((prev) => prev.map((m) => (m.id === itemId ? { ...m, image_url: imageUrl } : m)));
      setEditingItemForImage(null);
      alert('อัปเดตรูปภาพอาหารเรียบร้อยแล้ว!');
    } catch (e: any) {
      console.error('Update image error:', e);
      alert(`อัปเดตรูปภาพไม่สำเร็จ: ${e.message || 'กรุณาลองใหม่อีกครั้ง'}`);
      setEditingItemForImage(null);
    }
  };

  const handleDeleteMenuItem = async (itemId: string, itemName: string) => {
    if (!confirm(`ต้องการลบเมนู "${itemName}" หรือไม่?`)) return;
    try {
      await deleteDoc(doc(db, 'menu_items', itemId));
      setMenuItems((prev) => prev.filter((m) => m.id !== itemId));
    } catch (e: any) {
      console.error('Delete menu error:', e);
      alert(`ลบเมนูไม่สำเร็จ: ${e.message || 'กรุณาลองใหม่อีกครั้ง'}`);
    }
  };

  const handleAddMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopId || !newMenuName || !newMenuPrice) return;

    const validOptions = newMenuOptions
      .filter((o) => o.name.trim())
      .map((o) => ({ name: o.name.trim(), price: Number(o.price) || 0 }));

    const validGroups = newMenuOptionGroups
      .filter((g) => g.title.trim())
      .map((g) => ({
        id: g.id || `grp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        title: g.title.trim(),
        required: Boolean(g.required),
        type: g.type || 'single',
        min_select: g.min_select,
        max_select: g.max_select,
        options: g.options
          .filter((o) => o.name.trim())
          .map((o) => ({
            id: o.id || `opt_${Math.random().toString(36).substring(2, 6)}`,
            name: o.name.trim(),
            price: Number(o.price) || 0,
          })),
      }))
      .filter((g) => g.options.length > 0);

    const newItem = {
      shop_id: shopId,
      name: newMenuName.trim(),
      price: Number(newMenuPrice),
      category: newMenuCategory,
      is_available: true,
      options: validOptions,
      option_groups: validGroups,
      image_url: newMenuImage.trim() || '',
    };

    try {
      await addDoc(collection(db, 'menu_items'), {
        ...newItem,
        created_at: serverTimestamp(),
      });
      setNewMenuName('');
      setNewMenuPrice('');
      setNewMenuImage('');
      setNewMenuOptions([]);
      setNewMenuOptionGroups([]);
      setShowAddMenu(false);
      alert('เพิ่มเมนูอาหารใหม่สำเร็จแล้ว!');
    } catch (e: any) {
      console.error('Add menu item error:', e);
      alert(`เพิ่มเมนูอาหารไม่สำเร็จ: ${e.message || 'กรุณาลองใหม่อีกครั้ง'}`);
    }
  };

  const handleSaveEditMenuItem = async () => {
    if (!editingMenuItem || !editItemName.trim() || !editItemPrice.trim()) return;
    try {
      const validOptions = editItemOptions
        .filter((o) => o.name.trim())
        .map((o) => ({ name: o.name.trim(), price: Number(o.price) || 0 }));

      const validGroups = editItemOptionGroups
        .filter((g) => g.title.trim())
        .map((g) => ({
          id: g.id || `grp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          title: g.title.trim(),
          required: Boolean(g.required),
          type: g.type || 'single',
          min_select: g.min_select,
          max_select: g.max_select,
          options: g.options
            .filter((o) => o.name.trim())
            .map((o) => ({
              id: o.id || `opt_${Math.random().toString(36).substring(2, 6)}`,
              name: o.name.trim(),
              price: Number(o.price) || 0,
            })),
        }))
        .filter((g) => g.options.length > 0);

      const updatedData = {
        name: editItemName.trim(),
        price: parseFloat(editItemPrice) || 0,
        category: editItemCategory,
        options: validOptions,
        option_groups: validGroups,
        image_url: editItemImage.trim() || '',
      };

      await updateDoc(doc(db, 'menu_items', editingMenuItem.id), updatedData);
      setMenuItems((prev) =>
        prev.map((m) => (m.id === editingMenuItem.id ? { ...m, ...updatedData } : m))
      );
      setEditingMenuItem(null);
      setEditItemImage('');
      setEditItemOptionGroups([]);
      alert('บันทึกการแก้ไขเมนูอาหารเรียบร้อยแล้ว!');
    } catch (e: any) {
      console.error('Save edit menu item error:', e);
      alert(`เกิดข้อผิดพลาดในการบันทึกการแก้ไขเมนู: ${e.message || 'กรุณาลองใหม่อีกครั้ง'}`);
    }
  };

  const toggleItemAvailability = async (itemId: string, current: boolean) => {
    try {
      await updateDoc(doc(db, 'menu_items', itemId), { is_available: !current });
      setMenuItems((prev) =>
        prev.map((m) => (m.id === itemId ? { ...m, is_available: !current } : m))
      );
    } catch (e: any) {
      console.error('Toggle item availability error:', e);
      alert(`ไม่สามารถเปลี่ยนสถานะสินค้าได้: ${e.message || 'กรุณาลองใหม่อีกครั้ง'}`);
    }
  };

  // Calculations for Sales summary & Order Tabs
  const completedOrders = orders.filter((o) => o.status === 'completed');
  const cancelledOrders = orders.filter((o) => o.status === 'cancelled');
  const activeOrders = orders.filter((o) => o.status !== 'completed' && o.status !== 'cancelled');
  const unreadOrders = orders.filter((o) => o.has_unread_message);
  const completedUnreadCount = completedOrders.filter((o) => o.has_unread_message).length;

  const displayedOrders =
    orderFilterTab === 'active'
      ? activeOrders
      : orderFilterTab === 'completed'
      ? completedOrders
      : cancelledOrders;

  // BUG-06: friendly state if merchant has no shop assigned
  if (!shopId) {
    return (
      <div className="bg-white rounded-3xl p-8 text-center shadow-md border border-amber-100 max-w-lg mx-auto my-12 space-y-4">
        <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center text-3xl mx-auto">
          <Store className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-black text-gray-800">ยังไม่มีข้อมูลร้านค้าที่ผูกไว้</h2>
        <p className="text-xs text-gray-500 leading-relaxed">
          บัญชีของคุณได้รับการตั้งค่าเป็น &ldquo;ร้านค้า&rdquo; แล้ว แต่ยังไม่ได้รับการกำหนดร้านค้าในระบบ กรุณาติดต่อผู้ดูแลระบบ (Admin) เพื่อกำหนดร้านค้าให้บัญชีของคุณครับ
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Shop Status Toggle Floating Toast */}
      {statusToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-none">
          <div
            className={`px-4 py-2.5 rounded-2xl shadow-xl font-bold text-xs flex items-center gap-2 border text-white ${
              statusToast.type === 'open'
                ? 'bg-emerald-600 border-emerald-400 shadow-emerald-600/30'
                : 'bg-rose-600 border-rose-400 shadow-rose-600/30'
            }`}
          >
            <span>{statusToast.message}</span>
          </div>
        </div>
      )}

      {/* Hidden input for shop cover image upload */}
      <input
        ref={shopCoverInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleShopCoverFileChange}
      />

      {/* Hidden input for shop QR code image upload */}
      <input
        ref={shopQrInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleQrImageFileChange}
      />

      {/* Top Storefront Cover Banner */}
      {shopId && shopData && <FloatingBubbleControl shopId={shopId} isOpen={isOpen} count={pendingOrders.length} onOpenOrders={() => setActiveTab('orders')} />}
      <div className="relative h-48 md:h-60 rounded-3xl overflow-hidden border border-gray-100 shadow-md group bg-slate-100">
        {shopData?.image_url ? (
          <img
            key={shopData.image_url}
            src={shopData.image_url}
            alt={shopData.name || 'Shop cover'}
            className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-amber-500 via-orange-500 to-amber-700 flex flex-col items-center justify-center text-white select-none">
            <Store className="w-14 h-14 opacity-85 mb-1.5" />
            <span className="text-xs font-bold bg-black/25 backdrop-blur-xs px-3 py-1 rounded-full border border-white/20">
              ยังไม่มีรูปภาพหน้าร้าน (ตั้งค่ารูปได้ในแท็บ &quot;ข้อมูลร้าน&quot;)
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/15 pointer-events-none" />

        {/* Top Action Buttons on Banner */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleToggleOpen}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md transition active:scale-95 cursor-pointer ${
              isOpen
                ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                : systemSettings?.gp_enabled === true && (shopData?.credit_balance ?? 0) <= 0
                ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                : 'bg-red-500 hover:bg-red-600 text-white'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            <span>
              {isOpen
                ? 'เปิดร้านรับออเดอร์'
                : systemSettings?.gp_enabled === true && (shopData?.credit_balance ?? 0) <= 0
                ? 'ปิดร้าน (เครดิตหมด แตะเพื่อเติม)'
                : 'ปิดร้านชั่วคราว (แตะเพื่อเปิด)'}
            </span>
          </button>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleWakeLock}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold backdrop-blur-xs flex items-center gap-1 shadow-md active:scale-95 transition cursor-pointer border ${
                isWakeLockActive
                  ? 'bg-emerald-600/90 hover:bg-emerald-700 text-white border-emerald-400/50'
                  : 'bg-black/60 hover:bg-black/80 text-white border-white/15'
              }`}
              title="ป้องกันไม่ให้จอมือถือดับขณะเปิดร้านรอออเดอร์"
            >
              {isWakeLockActive ? (
                <Sun className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span>{isWakeLockActive ? 'จอเปิดค้าง' : 'เปิดจอค้าง'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('shop_info')}
              className="px-3 py-1.5 bg-black/60 hover:bg-black/80 text-white font-bold text-xs rounded-xl backdrop-blur-xs flex items-center gap-1.5 shadow-md active:scale-95 transition cursor-pointer border border-white/15"
              title="ไปที่การตั้งค่าข้อมูลร้านและรูปภาพปก"
            >
              <Store className="w-3.5 h-3.5 text-amber-400" />
              <span>ตั้งค่าข้อมูลร้าน</span>
            </button>
          </div>
        </div>

        {/* Shop Info Overlay at Bottom */}
        <div className="absolute bottom-3 left-4 right-4 text-white">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            {(() => {
              const count = shopReviews.length;
              const avg = count > 0 ? (Math.round((shopReviews.reduce((sum, r) => sum + r.rating, 0) / count) * 10) / 10).toFixed(1) : (shopData?.rating ? shopData.rating.toFixed(1) : '0.0');
              return (
                <span className="text-[10px] bg-amber-500 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Star className="w-3 h-3 fill-white text-white" /> {avg} ({count} รีวิว)
                </span>
              );
            })()}
            {(shopData?.sales_count ?? 0) > 0 && (
              <span className="text-[10px] bg-orange-600 font-black px-2 py-0.5 rounded-full">
                ขายแล้ว {shopData?.sales_count} ออเดอร์
              </span>
            )}
            <span className="text-[10px] bg-white/20 backdrop-blur-xs px-2 py-0.5 rounded-full">
              รูปนี้แสดงบนฟีดหน้าแรก
            </span>
          </div>
          <h1 className="text-xl font-black leading-tight drop-shadow-md">
            {shopData?.name || currentUser.display_name}
          </h1>
          <p className="text-xs text-amber-200 mt-0.5 flex items-center gap-1 truncate">
            <MapPin className="w-3 h-3 shrink-0" /> {shopData?.address_detail || 'รอบ มรภ. ชัยภูมิ'}
          </p>
        </div>
      </div>

      {/* Credit & Commission Status Card */}
      <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-2xl font-bold shrink-0 shadow-2xs">
            <CreditCard className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500">ยอดเครดิตคงเหลือ:</span>
              <span className={`text-lg font-black ${((shopData?.credit_balance ?? 0) < 0) ? 'text-rose-600' : 'text-emerald-600'}`}>
                ฿{(shopData?.credit_balance ?? 0).toFixed(2)}
              </span>
            </div>
            {systemSettings?.gp_enabled === false ? (
              <p className="text-[11px] text-emerald-600 font-bold flex items-center gap-1 mt-0.5">
                <span>ฟรีค่าคอมมิชชั่น 0% (ไม่ต้องเติมเครดิต)</span>
              </p>
            ) : (
              <p className="text-[11px] text-gray-500 mt-0.5">
                หักค่าคอม GP {systemSettings?.gp_percent || 5}% อัตโนมัติเมื่อส่งออเดอร์สำเร็จ
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end shrink-0">
          <button
            type="button"
            onClick={() => setShowCreditHistoryModal(true)}
            className="flex-1 sm:flex-none px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 font-bold text-xs rounded-xl shadow-2xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
            title="ดูประวัติการเติมเงินและหักค่าบริการทั้งหมด"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>ดูประวัติเครดิต</span>
            {creditTransactions.length > 0 && (
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-black px-1.5 py-0.2 rounded-full">
                {creditTransactions.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowTopupContactModal(true)}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>เติมเครดิต (ทัก LINE)</span>
          </button>
        </div>
      </div>

      {/* Continuous Order Alarm Banner (Rings continuously until merchant accepts) */}
      {pendingOrders.length > 0 && (
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white p-3.5 rounded-3xl shadow-xl border-2 border-red-300 flex flex-col sm:flex-row items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="w-11 h-11 rounded-2xl bg-white/25 backdrop-blur-xs flex items-center justify-center text-2xl shrink-0 shadow-inner">
              <BellRing className="w-6 h-6 text-white animate-bounce" />
            </div>
            <div>
              <h4 className="font-black text-sm sm:text-base flex items-center gap-1.5">
                มีออเดอร์ใหม่รอดำเนินการ ({pendingOrders.length} ออเดอร์)!
              </h4>
              <p className="text-[11px] text-red-100 font-medium">
                {isAlarmMuted
                  ? 'พักเสียงเตือนชั่วคราวแล้ว (กดปุ่มเปิดเสียงต่อได้)'
                  : 'เสียงกระดิ่งเตือนวนซ้ำต่อเนื่อง (จะดังจนกว่าจะกดรับออเดอร์)'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
            <button
              type="button"
              onClick={() => setIsAlarmMuted(!isAlarmMuted)}
              className="px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs transition active:scale-95"
            >
              {isAlarmMuted ? 'เปิดเสียงต่อ' : 'พักเสียงเตือน'}
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('orders');
                setOrderFilterTab('active');
              }}
              className="px-3.5 py-1.5 rounded-xl bg-white text-red-600 font-black text-xs shadow-md hover:bg-red-50 transition active:scale-95"
            >
              ไปที่ออเดอร์
            </button>
          </div>
        </div>
      )}

      {/* Navigation Sub-tabs */}
      <div className="flex bg-gray-100 p-1 rounded-2xl gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('orders')}
          className={`flex-1 min-w-[75px] py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition ${
            activeTab === 'orders'
              ? 'bg-white text-gray-800 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Bell className="w-3.5 h-3.5 text-amber-500" />
          <span>ออเดอร์ ({activeOrders.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('menu')}
          className={`flex-1 min-w-[75px] py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition ${
            activeTab === 'menu'
              ? 'bg-white text-gray-800 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Store className="w-3.5 h-3.5 text-orange-500" />
          <span>เมนู ({menuItems.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('sales')}
          className={`flex-1 min-w-[75px] py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition ${
            activeTab === 'sales'
              ? 'bg-white text-gray-800 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
          <span>ยอดขาย</span>
        </button>
        <button
          onClick={() => setActiveTab('shop_info')}
          className={`flex-1 min-w-[75px] py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition ${
            activeTab === 'shop_info'
              ? 'bg-white text-gray-800 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <span className="flex items-center gap-1.5"><Store className="w-3.5 h-3.5 text-zinc-500" /> ข้อมูลร้าน</span>
        </button>
      </div>

      {/* TAB 1: ORDERS (Active / Completed / Cancelled) */}
      {activeTab === 'orders' && (
        <div className="space-y-3">
          {/* Global Unread Messages Alert Banner */}
          {unreadOrders.length > 0 && (
            <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white p-3.5 sm:p-4 rounded-3xl shadow-lg shadow-orange-500/25 border-2 border-amber-300 animate-pulse flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-xl shrink-0 shadow-inner">
                  <MessageSquare className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-black text-xs sm:text-sm">
                      มีข้อความใหม่จากลูกค้า! ({unreadOrders.length} ออเดอร์)
                    </p>
                    {completedUnreadCount > 0 && (
                      <span className="bg-emerald-900/90 text-emerald-200 text-[10px] px-2 py-0.5 rounded-full font-bold border border-emerald-400/40">
                        ประวัติส่งสำเร็จ {completedUnreadCount} ข้อความ
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-amber-100 truncate mt-0.5">
                    คุณ {unreadOrders[0].customer_name}: &quot;{unreadOrders[0].last_message || 'ส่งข้อความใหม่'}&quot; (ออเดอร์ #{formatOrderCode(unreadOrders[0])})
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                {completedUnreadCount > 0 && orderFilterTab !== 'completed' && (
                  <button
                    type="button"
                    onClick={() => setOrderFilterTab('completed')}
                    className="px-3 py-2 bg-white/20 hover:bg-white/30 text-white font-bold rounded-xl text-xs backdrop-blur-xs transition active:scale-95"
                  >
                    ดูแท็บส่งสำเร็จ ({completedUnreadCount})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setActiveChatOrder(unreadOrders[0]);
                    updateDoc(doc(db, 'orders', unreadOrders[0].id), { has_unread_message: false }).catch(() => {});
                  }}
                  className="px-4 py-2 bg-white text-orange-600 hover:bg-amber-50 font-black rounded-xl text-xs shadow-md shrink-0 active:scale-95 transition flex items-center gap-1.5"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>เปิดแชททันที</span>
                </button>
              </div>
            </div>
          )}

          {/* Sub-tabs for Order Status: กำลังทำ / ส่งสำเร็จ / ยกเลิก */}
          <div className="flex bg-gray-100 p-1 rounded-2xl gap-1">
            <button
              type="button"
              onClick={() => setOrderFilterTab('active')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                orderFilterTab === 'active'
                  ? 'bg-white text-gray-800 shadow-xs'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  activeOrders.length > 0 ? 'bg-amber-500 animate-pulse' : 'bg-gray-300'
                }`}
              />
              <span>กำลังทำ ({activeOrders.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setOrderFilterTab('completed')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                orderFilterTab === 'completed'
                  ? 'bg-white text-gray-800 shadow-xs'
                  : 'text-gray-500 hover:text-gray-700'
              } ${completedUnreadCount > 0 ? 'ring-2 ring-amber-400 bg-amber-50 text-amber-900 font-extrabold' : ''}`}
            >
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>ส่งสำเร็จ ({completedOrders.length})</span>
              {completedUnreadCount > 0 && (
                <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-black animate-bounce flex items-center gap-1">
                  <MessageSquare className="w-2.5 h-2.5" />
                  <span>{completedUnreadCount}</span>
                </span>
              )}
            </button>

            {cancelledOrders.length > 0 && (
              <button
                type="button"
                onClick={() => setOrderFilterTab('cancelled')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${
                  orderFilterTab === 'cancelled'
                    ? 'bg-white text-gray-800 shadow-xs'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <span>ยกเลิก ({cancelledOrders.length})</span>
              </button>
            )}
          </div>

          {/* Controls Bar for Orders */}
          {displayedOrders.length > 0 && (
            <div className="flex items-center justify-between px-1 text-xs text-gray-500 mb-1">
              <span className="font-bold text-gray-700">
                รายการออเดอร์ ({displayedOrders.length} บิล)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => toggleAllOrders(true, displayedOrders)}
                  className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-[11px] transition active:scale-95 flex items-center gap-1 cursor-pointer shadow-2xs"
                  title="ย่อแถบออเดอร์ทั้งหมดเพื่อดูภาพรวม"
                >
                  <ChevronsUp className="w-3.5 h-3.5 text-gray-500" />
                  <span>ย่อทั้งหมด</span>
                </button>
                <button
                  type="button"
                  onClick={() => toggleAllOrders(false, displayedOrders)}
                  className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 rounded-xl font-bold text-[11px] transition active:scale-95 flex items-center gap-1 cursor-pointer shadow-2xs"
                  title="ขยายรายละเอียดอาหารทุกออเดอร์"
                >
                  <ChevronsDown className="w-3.5 h-3.5 text-amber-600" />
                  <span>ขยายทั้งหมด</span>
                </button>
              </div>
            </div>
          )}

          {displayedOrders.length === 0 ? (
            orderFilterTab === 'active' ? (
              <div className="bg-white rounded-3xl p-6 sm:p-8 text-center border border-gray-100 shadow-xs space-y-4">
                {/* Notice if there are unread messages in completed tab */}
                {completedUnreadCount > 0 && (
                  <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white p-4 rounded-2xl shadow-md text-left space-y-2 animate-pulse">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs sm:text-sm flex items-center gap-1.5">
                        มีลูกค้าทักแชทเข้ามา {completedUnreadCount} ข้อความ ในแท็บส่งสำเร็จ!
                      </span>
                      <span className="bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold animate-ping">
                        ใหม่!
                      </span>
                    </div>
                    <p className="text-xs text-amber-100">
                      ลูกค้าจากออเดอร์ที่จัดส่งเสร็จแล้วส่งข้อความถึงร้านค้า แตะปุ่มด้านล่างเพื่อเปิดอ่านและตอบแชท
                    </p>
                    <button
                      type="button"
                      onClick={() => setOrderFilterTab('completed')}
                      className="w-full py-2.5 bg-white text-orange-600 hover:bg-amber-50 font-black rounded-xl text-xs shadow-md active:scale-95 transition flex items-center justify-center gap-1.5"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>เปิดดูข้อความในแท็บส่งสำเร็จ ({completedUnreadCount})</span>
                    </button>
                  </div>
                )}

                <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-2xs">
                  <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 text-sm">ไม่มีออเดอร์ค้าง พร้อมรับออเดอร์ใหม่!</h3>
                  <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
                    เมื่อมีลูกค้าสั่งอาหาร ออเดอร์จะเด้งขึ้นมาที่หน้านี้พร้อมเสียงเตือนทันที
                  </p>
                </div>
                {completedOrders.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setOrderFilterTab('completed')}
                    className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-xl border border-emerald-200 inline-flex items-center gap-1 transition active:scale-95"
                  >
                    ดูประวัติที่ส่งเสร็จแล้ว ({completedOrders.length} ออเดอร์)
                  </button>
                )}
              </div>
            ) : orderFilterTab === 'completed' ? (
              <div className="bg-white rounded-3xl p-8 text-center border border-gray-100 shadow-xs space-y-2">
                <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto shadow-2xs">
                  <Package className="w-6 h-6 text-gray-400" />
                </div>
                <h3 className="font-bold text-gray-700 text-sm">ยังไม่มีประวัติออเดอร์ที่ส่งสำเร็จ</h3>
                <p className="text-xs text-gray-400">ออเดอร์ที่จัดส่งเสร็จแล้วจะถูกจัดเก็บรวบรวมไว้ที่นี่</p>
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-8 text-center border border-gray-100 shadow-xs space-y-2">
                <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto shadow-2xs">
                  <X className="w-6 h-6 text-gray-400" />
                </div>
                <h3 className="font-bold text-gray-700 text-sm">ไม่มีออเดอร์ที่ถูกยกเลิก</h3>
              </div>
            )
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {displayedOrders.map((order) => {
              const isCompleted = order.status === 'completed';
              const isCancelled = order.status === 'cancelled';
              const collapsed = isOrderCollapsed(order);

              return (
                <div
                  key={order.id}
                  className={`bg-white rounded-3xl p-4 border shadow-xs space-y-3 transition ${
                    order.has_unread_message
                      ? 'border-2 border-amber-400 bg-amber-50/40 ring-2 ring-amber-300 shadow-md'
                      : order.status === 'pending'
                      ? 'border-amber-400 ring-2 ring-amber-100'
                      : isCompleted
                      ? 'border-gray-200/80 bg-gray-50/30'
                      : 'border-orange-200'
                  }`}
                >
                  {/* Order Card Header */}
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                    <div
                      onClick={() => toggleOrderCollapse(order.id, order.status)}
                      className="cursor-pointer group flex-1"
                    >
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-black text-base text-gray-900 group-hover:text-amber-600 transition">
                          #{formatOrderCode(order)}
                        </span>
                        <span
                          className={`text-[10px] sm:text-[11px] font-extrabold px-2 py-0.5 rounded-full ${
                            order.has_unread_message
                              ? 'bg-amber-500 text-white animate-bounce shadow-xs'
                              : order.status === 'pending'
                              ? 'bg-amber-100 text-amber-800 animate-pulse'
                              : order.status === 'cooking'
                              ? 'bg-blue-100 text-blue-800'
                              : order.status === 'delivering'
                              ? 'bg-orange-100 text-orange-800'
                              : isCompleted
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {order.has_unread_message
                            ? 'มีข้อความใหม่!'
                            : order.status === 'pending'
                            ? 'รอร้านรับ'
                            : order.status === 'cooking'
                            ? 'กำลังปรุง'
                            : order.status === 'delivering'
                            ? 'กำลังขี่รถไปส่ง'
                            : isCompleted
                            ? 'ส่งสำเร็จแล้ว'
                            : 'ยกเลิก'}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-gray-600 mt-0.5">
                        ลูกค้า: <strong className="text-gray-900 font-bold">{order.customer_name}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {/* Customer Phone & Quick Call Button */}
                      {order.customer_phone ? (
                        <a
                          href={`tel:${order.customer_phone}`}
                          className="h-8 px-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 flex items-center gap-1.5 border border-emerald-200 transition shadow-2xs group cursor-pointer"
                          title="แตะเพื่อโทรหาลูกค้า"
                        >
                          <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0 group-hover:scale-110 transition-transform" />
                          <span className="font-mono text-xs font-bold tracking-tight text-emerald-800">
                            {order.customer_phone}
                          </span>
                        </a>
                      ) : (
                        <div className="h-8 px-2 rounded-xl bg-gray-50 text-gray-400 flex items-center gap-1 border border-gray-200 text-xs">
                          <Phone className="w-3.5 h-3.5" />
                          <span>ไม่มีเบอร์</span>
                        </div>
                      )}

                      {/* Chat Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveChatOrder(order);
                          if (order.has_unread_message) {
                            updateDoc(doc(db, 'orders', order.id), { has_unread_message: false }).catch(() => {});
                          }
                        }}
                        className={`relative w-8 h-8 rounded-xl flex items-center justify-center border transition active:scale-95 cursor-pointer ${
                          order.has_unread_message
                            ? 'bg-amber-500 text-white border-amber-600 shadow-md animate-pulse ring-2 ring-amber-300'
                            : 'bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-200'
                        }`}
                        title="แชทกับลูกค้า"
                      >
                        <MessageSquare className="w-4 h-4" />
                        {order.has_unread_message && (
                          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white animate-ping" />
                        )}
                      </button>

                      {/* Expand / Collapse Button */}
                      <button
                        type="button"
                        onClick={() => toggleOrderCollapse(order.id, order.status)}
                        className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition active:scale-95 cursor-pointer"
                        title={collapsed ? 'ขยายดูรายการอาหาร' : 'ย่อแถบ'}
                      >
                        {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Latest Message Preview if any */}
                  {order.last_message && (
                    <div className={`rounded-xl px-3 py-1.5 text-xs flex items-center justify-between gap-1.5 animate-in fade-in ${
                      order.has_unread_message
                        ? 'bg-amber-500 text-white border border-amber-600 font-bold shadow-sm'
                        : 'bg-amber-50/90 text-amber-900 border border-amber-200 text-[11px]'
                    }`}>
                      <span className="truncate">
                        <strong>{order.has_unread_message ? 'ลูกค้าส่งข้อความ' : order.last_message_sender === 'merchant' ? 'ร้านค้า' : 'ลูกค้า'}:</strong> {order.last_message}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveChatOrder(order);
                          if (order.has_unread_message) {
                            updateDoc(doc(db, 'orders', order.id), { has_unread_message: false }).catch(() => {});
                          }
                        }}
                        className={`text-[10px] font-black underline shrink-0 ${
                          order.has_unread_message ? 'text-white hover:text-amber-100 bg-black/20 px-2 py-0.5 rounded-md' : 'text-amber-700 hover:text-amber-900'
                        }`}
                      >
                        {order.has_unread_message ? 'ตอบแชท' : 'แชท'}
                      </button>
                    </div>
                  )}

                  {/* Collapsed Compact Preview */}
                  {collapsed ? (
                    <div
                      onClick={() => toggleOrderCollapse(order.id, order.status)}
                      className="bg-amber-50/40 hover:bg-amber-50 border border-amber-200/80 rounded-2xl p-3 transition cursor-pointer flex items-center justify-between gap-2 shadow-2xs group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-black text-xs text-amber-700 bg-white px-2 py-0.5 rounded-md border border-amber-200 shadow-2xs">
                            {order.items?.reduce((s, it) => s + it.quantity, 0)} รายการ
                          </span>
                          <span className="font-extrabold text-xs sm:text-sm text-gray-900 truncate">
                            {order.items?.map(it => `${it.quantity}x ${it.name}`).join(', ')}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-600 truncate mt-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                          <span>ส่ง: {order.delivery_address || 'ไม่ระบุที่อยู่'}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0 pl-2 border-l border-amber-200/70">
                        <span className="font-black text-amber-600 text-sm sm:text-base block">{order.total_amount} ฿</span>
                        <span className="text-[10px] text-amber-700 font-bold group-hover:underline flex items-center justify-end gap-0.5 mt-0.5">
                          <span>แตะขยาย</span>
                          <ChevronDown className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Items list with Enlarged & Clear Typography */}
                      <div className="bg-[#FFFDF9] border border-amber-200/80 rounded-2xl p-3 sm:p-3.5 space-y-2.5 shadow-2xs">
                        {order.items?.map((item, idx) => (
                          <div key={idx} className="pb-2.5 border-b border-amber-100 last:border-b-0 last:pb-0">
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="inline-flex items-center justify-center bg-amber-500 text-white font-black text-xs sm:text-sm px-2 py-0.5 rounded-lg shadow-2xs">
                                    {item.quantity}x
                                  </span>
                                  <span className="font-black text-sm sm:text-base text-gray-900 leading-tight">
                                    {item.name}
                                  </span>
                                </div>

                                {item.selected_options && item.selected_options.length > 0 && (
                                  <div className="mt-1.5 pl-2.5 border-l-2 border-amber-400 space-y-1">
                                    {item.selected_options.map((opt, oIdx) => (
                                      <div key={oIdx} className="text-xs font-bold text-amber-950 flex items-center gap-1.5 flex-wrap">
                                        <span className="text-amber-500 font-black">•</span>
                                        <span>{opt.name}</span>
                                        {opt.price > 0 && (
                                          <span className="text-amber-700 text-[11px] font-extrabold bg-amber-100/70 px-1.5 py-0.2 rounded">
                                            +{opt.price} ฿
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {item.note && (
                                  <div className="mt-1.5 bg-rose-50 border border-rose-200 text-rose-800 px-2.5 py-1 rounded-xl text-xs font-bold inline-flex items-center gap-1.5">
                                    <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-md font-black">
                                      หมายเหตุ
                                    </span>
                                    <span>{item.note}</span>
                                  </div>
                                )}
                              </div>

                              <span className="font-black text-sm sm:text-base text-gray-900 shrink-0">
                                {orderItemUnitPrice(item) * item.quantity} ฿
                              </span>
                            </div>
                          </div>
                        ))}

                        <div className="pt-2 mt-1 border-t-2 border-amber-200/80 flex justify-between items-center font-bold text-gray-700">
                          <span className="text-xs sm:text-sm">ยอดรวมอาหาร (รวมค่าส่ง {(order.delivery_fee ?? 0) === 0 ? 'ส่งฟรี' : `${order.delivery_fee} บ.`})</span>
                          <span className="text-amber-600 text-base sm:text-lg font-black">{order.total_amount} ฿</span>
                        </div>
                      </div>

                      {/* Delivery Location & Google Maps Link */}
                      <div className="bg-amber-50/50 rounded-2xl p-2.5 border border-amber-100 text-xs space-y-1.5">
                        <div className="flex items-start gap-1.5 text-gray-700">
                          <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold">ที่อยู่จัดส่ง: </span>
                            <span className="font-semibold text-gray-900">{order.delivery_address}</span>
                          </div>
                        </div>

                        {/* Google Maps 1-Click Navigation */}
                        {order.location && (
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${order.location.lat},${order.location.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-xs transition active:scale-95"
                          >
                            <Navigation className="w-3.5 h-3.5" />
                            เปิด Google Maps นำทาง
                          </a>
                        )}

                        <div className="text-gray-500 text-[11px] pt-1">
                          วิธีจ่าย: <span className="font-bold text-gray-700">
                            {order.payment_method === 'transfer_chat'
                              ? 'โอนเงินผ่านแชทก่อนทำ'
                              : order.payment_method === 'cash'
                              ? 'เงินสด'
                              : 'สแกน QR ปลายทาง'}
                          </span>
                          {order.cash_change_note && ` (${order.cash_change_note})`}
                        </div>
                      </div>

                      {/* Pending Order Notice for Merchant */}
                      {order.status === 'pending' && (
                        <div className="bg-amber-50 rounded-xl p-2 border border-amber-200 text-[11px] text-amber-900 flex items-center justify-between gap-1.5">
                          <span className="flex items-center gap-1 font-semibold">
                            <CreditCard className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>รอตรวจสลิปโอนเงินในแชท</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveChatOrder(order);
                              if (order.has_unread_message) {
                                updateDoc(doc(db, 'orders', order.id), { has_unread_message: false }).catch(() => {});
                              }
                            }}
                            className="px-2 py-0.5 bg-amber-500 text-white rounded-lg font-bold hover:bg-amber-600 transition shrink-0 cursor-pointer"
                          >
                            เปิดแชท
                          </button>
                        </div>
                      )}
                    </>
                  )}

                  {/* Action Buttons (Always accessible or when needed) */}
                  {!isCompleted && !isCancelled && (
                    <div className="flex items-center gap-2 pt-1">
                      {order.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            onClick={() => updateOrderStatus(order.id, 'cancelled')}
                            className="flex-1 py-2.5 rounded-xl border border-red-200 text-red-600 font-bold text-xs hover:bg-red-50 transition cursor-pointer"
                          >
                            ปฏิเสธ
                          </button>
                          <button
                            type="button"
                            onClick={() => updateOrderStatus(order.id, 'cooking')}
                            className="flex-2 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs sm:text-sm shadow-sm flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95"
                          >
                            <ChefHat className="w-4 h-4" /> รับออเดอร์ (เริ่มทำ)
                          </button>
                        </>
                      )}

                      {order.status === 'cooking' && (
                        <button
                          type="button"
                          onClick={() => updateOrderStatus(order.id, 'delivering')}
                          className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black text-xs sm:text-sm shadow-md flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95"
                        >
                          <Bike className="w-4 h-4" /> ปรุงเสร็จแล้ว กำลังออกไปส่ง
                        </button>
                      )}

                      {order.status === 'delivering' && (
                        <button
                          type="button"
                          onClick={() => updateOrderStatus(order.id, 'completed')}
                          className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm shadow-md flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95"
                        >
                          <Check className="w-4 h-4" /> ส่งถึงมือแล้ว + รับเงินเรียบร้อย
                        </button>
                      )}
                    </div>
                  )}

                  {/* Status Footer for Completed or Cancelled Orders */}
                  {isCompleted && (
                    <div className="space-y-2">
                      <div className="bg-emerald-50 rounded-2xl p-2.5 border border-emerald-100 text-xs flex items-center justify-between text-emerald-800">
                        <span className="font-bold flex items-center gap-1.5">
                          <Check className="w-4 h-4 text-emerald-600" /> จัดส่งถึงมือ & รับเงินเรียบร้อย
                        </span>
                        <span className="font-black text-emerald-700">+{order.total_amount} ฿</span>
                      </div>
                      {/* Post-delivery chat button */}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveChatOrder(order);
                          if (order.has_unread_message) {
                            updateDoc(doc(db, 'orders', order.id), { has_unread_message: false }).catch(() => {});
                          }
                        }}
                        className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold border transition active:scale-95 cursor-pointer ${
                          order.has_unread_message
                            ? 'bg-amber-500 text-white border-amber-600 shadow-md animate-pulse'
                            : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50'
                        }`}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        {order.has_unread_message ? 'มีข้อความใหม่จากลูกค้า!' : 'แชทกับลูกค้า (ติดตามหลังส่ง)'}
                      </button>
                    </div>
                  )}

                  {isCancelled && (
                    <div className="bg-red-50 rounded-2xl p-2.5 border border-red-100 text-xs flex items-center justify-between text-red-700">
                      <span className="font-bold flex items-center gap-1">
                        ออเดอร์นี้ถูกยกเลิกแล้ว
                      </span>
                    </div>
                  )}

                </div>
              );
            })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MENU MANAGEMENT */}
      {activeTab === 'menu' && (
        <div className="space-y-3">
          {/* Hidden file inputs for menu item image upload & crop (Always mounted in Menu tab) */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => handleImageFileChange(e, false)}
          />
          <input
            ref={editFileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => handleImageFileChange(e, true)}
          />

          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-gray-800">รายการเมนูของร้าน</h3>
            <button
              type="button"
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs transition"
            >
              <Plus className="w-3.5 h-3.5" /> เพิ่มเมนูใหม่
            </button>
          </div>

          {/* Add Menu Form */}
          {showAddMenu && (
            <form
              onSubmit={handleAddMenuItem}
              className="bg-amber-50/70 border border-amber-200 rounded-3xl p-4 space-y-3 animate-in fade-in"
            >
              <h4 className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-amber-600" />
                เพิ่มเมนูอาหาร/เครื่องดื่มใหม่
              </h4>

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  placeholder="ชื่อเมนู เช่น ตำป่า, ข้าวกะเพรา"
                  value={newMenuName}
                  onChange={(e) => setNewMenuName(e.target.value)}
                  className="px-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
                <input
                  type="number"
                  required
                  placeholder="ราคา (บาท)"
                  value={newMenuPrice}
                  onChange={(e) => setNewMenuPrice(e.target.value)}
                  className="px-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Category radio */}
              <div className="flex gap-4 text-xs font-medium text-gray-700 bg-white p-2 rounded-xl border border-gray-100">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="cat"
                    checked={newMenuCategory === 'food'}
                    onChange={() => setNewMenuCategory('food')}
                  />
                  <span>หมวดอาหาร</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="cat"
                    checked={newMenuCategory === 'drink_dessert'}
                    onChange={() => setNewMenuCategory('drink_dessert')}
                  />
                  <span>หมวดเครื่องดื่ม/ของหวาน</span>
                </label>
              </div>

              {/* Image Upload & Presets Section */}
              <div className="bg-white p-3 rounded-2xl border border-gray-200 space-y-2">
                <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Camera className="w-3.5 h-3.5 text-amber-600" /> รูปภาพอาหาร
                  </span>
                  {newMenuImage && (
                    <button
                      type="button"
                      onClick={() => setNewMenuImage('')}
                      className="text-[11px] text-red-500 font-semibold hover:underline"
                    >
                      ลบรูปภาพ
                    </button>
                  )}
                </label>

                {newMenuImage ? (
                  <div className="relative w-full h-44 rounded-2xl overflow-hidden border border-amber-200 shadow-xs">
                    <img src={newMenuImage} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setRawImageForCrop(newMenuImage);
                          setIsEditingForCrop(false);
                        }}
                        className="px-3 py-1.5 bg-black/75 hover:bg-black/90 text-white rounded-xl text-xs font-bold backdrop-blur-xs flex items-center gap-1 shadow-xs transition active:scale-95"
                      >
                        <Scissors className="w-3.5 h-3.5 text-amber-400" />
                        <span>ตัดขอบใหม่</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold backdrop-blur-xs flex items-center gap-1 shadow-xs transition active:scale-95"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>เปลี่ยนรูป</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-5 border-2 border-dashed border-amber-300 hover:border-amber-500 bg-amber-50/50 hover:bg-amber-50 rounded-2xl text-xs font-bold text-amber-900 flex flex-col items-center justify-center gap-2 transition active:scale-98"
                    >
                      <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-lg shadow-inner">
                        <Camera className="w-5 h-5 text-amber-700" />
                      </div>
                      <span className="text-sm font-bold">ถ่ายรูป / เลือกรูปจากมือถือ</span>
                      <span className="text-[11px] text-amber-700/80 font-normal">
                        สามารถตัดขอบ ปรับขนาด ซูม และหมุนรูปภาพได้อิสระ
                      </span>
                    </button>
                  </div>
                )}
              </div>

              {/* Advanced Option Groups & Toppings Section */}
              <div className="bg-white p-3.5 rounded-2xl border border-gray-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-2">
                  <div>
                    <label className="text-xs font-black text-gray-800 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      <span>กลุ่มตัวเลือกเมนู (ก๋วยเตี๋ยว, ลูกชิ้น, ชานม, อาหารตามสั่ง)</span>
                    </label>
                    <p className="text-[11px] text-gray-400">
                      สร้างกลุ่มตัวเลือกแบบบังคับเลือก (เช่น เส้น/น้ำซุป) หรือท็อปปิ้งเสริม
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const newGroupId = `grp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
                      setNewMenuOptionGroups([
                        ...newMenuOptionGroups,
                        {
                          id: newGroupId,
                          title: `กลุ่มที่ ${newMenuOptionGroups.length + 1}`,
                          required: true,
                          type: 'single',
                          options: [
                            { id: '1', name: '', price: 0 },
                            { id: '2', name: '', price: 0 },
                          ],
                        },
                      ]);
                    }}
                    className="text-xs font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-xl border border-amber-200 transition active:scale-95 flex items-center gap-1 shrink-0 self-start sm:self-auto"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ เพิ่มกลุ่มตัวเลือกเอง</span>
                  </button>
                </div>

                {/* Quick 1-Click Preset Templates */}
                <div className="space-y-1.5 bg-amber-50/50 p-2.5 rounded-xl border border-amber-100">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-600" />
                      <span>เทมเพลตด่วน (กด 1 คลิกเพื่อโหลดตัวเลือกสำเร็จรูป):</span>
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {OPTION_PRESETS.map((preset, pIdx) => (
                      <button
                        key={pIdx}
                        type="button"
                        onClick={() => {
                          if (
                            newMenuOptionGroups.length > 0 &&
                            !confirm(`ต้องการโหลดเทมเพลต "${preset.label}" แทนที่กลุ่มตัวเลือกปัจจุบันหรือไม่?`)
                          ) {
                            return;
                          }
                          setNewMenuOptionGroups(preset.groups());
                        }}
                        className="p-2 rounded-xl bg-white hover:bg-amber-50 text-gray-800 border border-amber-200/80 text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs hover:shadow-xs transition active:scale-95 text-center"
                      >
                        <span className="text-base">{preset.icon}</span>
                        <span className="truncate">{preset.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Option Groups List */}
                {newMenuOptionGroups.length > 0 && (
                  <div className="space-y-3 pt-1">
                    {newMenuOptionGroups.map((group, gIdx) => (
                      <div
                        key={group.id || gIdx}
                        className="p-3 bg-gray-50/80 rounded-2xl border border-gray-200 space-y-2.5 animate-in fade-in"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200/70 pb-2">
                          <div className="flex-1 flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-black flex items-center justify-center shrink-0">
                              {gIdx + 1}
                            </span>
                            <input
                              type="text"
                              placeholder="ชื่อกลุ่ม เช่น 1. เลือกเส้น หรือ เลือกน้ำจิ้ม"
                              value={group.title}
                              onChange={(e) => {
                                const next = [...newMenuOptionGroups];
                                next[gIdx].title = e.target.value;
                                setNewMenuOptionGroups(next);
                              }}
                              className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-xl font-bold focus:ring-1 focus:ring-amber-500"
                            />
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            {/* Required / Optional switch */}
                            <button
                              type="button"
                              onClick={() => {
                                const next = [...newMenuOptionGroups];
                                next[gIdx].required = !next[gIdx].required;
                                setNewMenuOptionGroups(next);
                              }}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition ${
                                group.required
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : 'bg-white text-gray-600 border-gray-200'
                              }`}
                            >
                              {group.required ? 'จำเป็น (ต้องเลือก)' : 'ไม่บังคับ (เลือกหรือไม่ก็ได้)'}
                            </button>

                            {/* Single / Multiple Choice Switch */}
                            <button
                              type="button"
                              onClick={() => {
                                const next = [...newMenuOptionGroups];
                                next[gIdx].type = next[gIdx].type === 'single' ? 'multiple' : 'single';
                                setNewMenuOptionGroups(next);
                              }}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition ${
                                group.type === 'single'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-blue-50 text-blue-800 border-blue-200'
                              }`}
                            >
                              {group.type === 'single' ? 'เลือกได้ 1 อย่าง (Radio)' : 'เลือกได้หลายอย่าง (Checkbox)'}
                            </button>

                            {/* Delete Group */}
                            <button
                              type="button"
                              onClick={() => {
                                setNewMenuOptionGroups(newMenuOptionGroups.filter((_, i) => i !== gIdx));
                              }}
                              className="p-1 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                              title="ลบกลุ่มตัวเลือกนี้"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Items in this group */}
                        <div className="space-y-1.5 pl-2 sm:pl-4 border-l-2 border-amber-300">
                          {group.options.map((opt, oIdx) => (
                            <div key={opt.id || oIdx} className="flex items-center gap-1.5 animate-in fade-in">
                              <input
                                type="text"
                                placeholder="ชื่อตัวเลือก เช่น เส้นเล็ก, น้ำตก, เพิ่มกากหมู"
                                value={opt.name}
                                onChange={(e) => {
                                  const next = [...newMenuOptionGroups];
                                  next[gIdx].options[oIdx].name = e.target.value;
                                  setNewMenuOptionGroups(next);
                                }}
                                className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-xl font-medium focus:ring-1 focus:ring-amber-500"
                              />
                              <div className="flex items-center gap-1 w-24 shrink-0">
                                <input
                                  type="number"
                                  placeholder="+บาท"
                                  value={opt.price}
                                  onChange={(e) => {
                                    const next = [...newMenuOptionGroups];
                                    next[gIdx].options[oIdx].price = parseFloat(e.target.value) || 0;
                                    setNewMenuOptionGroups(next);
                                  }}
                                  className="w-full px-2 py-1.5 text-xs bg-white border border-gray-200 rounded-xl text-right font-bold text-amber-600 focus:ring-1 focus:ring-amber-500"
                                />
                                <span className="text-[11px] text-gray-400">฿</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const next = [...newMenuOptionGroups];
                                  next[gIdx].options = next[gIdx].options.filter((_, i) => i !== oIdx);
                                  setNewMenuOptionGroups(next);
                                }}
                                className="p-1.5 text-gray-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition shrink-0"
                                title="ลบตัวเลือกนี้"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}

                          <button
                            type="button"
                            onClick={() => {
                              const next = [...newMenuOptionGroups];
                              next[gIdx].options.push({
                                id: `opt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                                name: '',
                                price: 0,
                              });
                              setNewMenuOptionGroups(next);
                            }}
                            className="text-[11px] font-bold text-amber-600 hover:text-amber-700 inline-flex items-center gap-1 pt-1"
                          >
                            <Plus className="w-3 h-3" />
                            <span>+ เพิ่มตัวเลือกในกลุ่ม &quot;{group.title || `กลุ่มที่ ${gIdx + 1}`}&quot;</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {newMenuOptionGroups.length === 0 && (
                  <p className="text-[11px] text-gray-400 italic">
                    กดเลือกเทมเพลตสำเร็จรูปด้านบน หรือกดปุ่ม &quot;+ เพิ่มกลุ่มตัวเลือกเอง&quot; เพื่อตั้งค่าตัวเลือกสำหรับก๋วยเตี๋ยว ลูกชิ้น หรือชานมได้ทันที
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-amber-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddMenu(false);
                    setNewMenuImage('');
                    setNewMenuOptions([]);
                  }}
                  className="px-3.5 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-xl"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-md transition active:scale-95"
                >
                  บันทึกเมนูอาหาร
                </button>
              </div>
            </form>
          )}

          {/* Menu Category Filter Pills */}
          <div className="flex bg-gray-100 p-1 rounded-2xl gap-1">
            <button
              type="button"
              onClick={() => setMenuCategoryFilter('all')}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${
                menuCategoryFilter === 'all'
                  ? 'bg-white text-gray-800 shadow-xs'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <span>ทั้งหมด ({menuItems.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setMenuCategoryFilter('food')}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${
                menuCategoryFilter === 'food'
                  ? 'bg-white text-gray-800 shadow-xs'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <span>อาหาร ({menuItems.filter((m) => m.category === 'food').length})</span>
            </button>
            <button
              type="button"
              onClick={() => setMenuCategoryFilter('drink_dessert')}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${
                menuCategoryFilter === 'drink_dessert'
                  ? 'bg-white text-gray-800 shadow-xs'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <span>น้ำ/ของหวาน ({menuItems.filter((m) => m.category === 'drink_dessert').length})</span>
            </button>
          </div>

          {/* Menu Items List */}
          {menuItems.filter((item) => menuCategoryFilter === 'all' || item.category === menuCategoryFilter).length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-xs bg-white rounded-2xl border border-gray-100">
              ยังไม่มีรายการเมนูในหมวดนี้
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {menuItems
                .filter((item) => menuCategoryFilter === 'all' || item.category === menuCategoryFilter)
                .map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl p-3 border border-gray-100 shadow-xs space-y-2.5"
                >
                  {editingMenuItem?.id === item.id ? (
                    /* Inline Edit Mode */
                    <div className="space-y-2.5 animate-in fade-in">
                      <div className="flex items-center justify-between border-b border-gray-100 pb-1.5">
                        <span className="text-xs font-bold text-gray-800">แก้ไขเมนูอาหาร</span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMenuItem(null);
                            setEditItemImage('');
                          }}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          ปิด
                        </button>
                      </div>

                      {/* Menu Image Edit & Crop Section */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-gray-700 flex items-center gap-1">
                            <Camera className="w-3.5 h-3.5 text-amber-600" />
                            <span>รูปภาพอาหาร</span>
                          </label>
                          {editItemImage && (
                            <button
                              type="button"
                              onClick={() => setEditItemImage('')}
                              className="text-[10px] text-rose-500 font-bold hover:underline cursor-pointer"
                            >
                              ลบรูปภาพ (ไม่ใส่รูป)
                            </button>
                          )}
                        </div>

                        {editItemImage ? (
                          <div className="relative w-full h-36 rounded-xl overflow-hidden border border-amber-200 shadow-2xs group bg-gray-50">
                            <img
                              key={editItemImage}
                              src={editItemImage}
                              alt="รูปภาพอาหาร"
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setCropTarget('menu');
                                  setRawImageForCrop(editItemImage);
                                  setIsEditingForCrop(true);
                                }}
                                className="px-2.5 py-1.5 bg-black/80 hover:bg-black text-white rounded-xl text-xs font-bold backdrop-blur-xs flex items-center gap-1 shadow-md transition active:scale-95 cursor-pointer"
                                title="ตัดขอบหรือปรับมุมรูปภาพอาหาร"
                              >
                                <Scissors className="w-3.5 h-3.5 text-amber-400" />
                                <span>ตัดขอบใหม่</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingItemForImage(item);
                                  editFileInputRef.current?.click();
                                }}
                                className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold backdrop-blur-xs flex items-center gap-1 shadow-md transition active:scale-95 cursor-pointer"
                                title="เลือกรูปภาพใหม่จากมือถือหรือคอมพิวเตอร์"
                              >
                                <Camera className="w-3.5 h-3.5" />
                                <span>เปลี่ยนรูป</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditItemImage('')}
                                className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold backdrop-blur-xs flex items-center gap-1 shadow-md transition active:scale-95 cursor-pointer"
                                title="ลบรูปภาพนี้ออก (ใช้สัญลักษณ์เริ่มต้น)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>ลบรูป</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingItemForImage(item);
                              editFileInputRef.current?.click();
                            }}
                            className="w-full py-4 border-2 border-dashed border-amber-300 hover:border-amber-400 bg-amber-50/50 hover:bg-amber-50 rounded-2xl text-xs font-bold text-amber-900 flex flex-col items-center justify-center gap-1.5 transition active:scale-98"
                          >
                            <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-base shadow-inner">
                              <Camera className="w-4 h-4 text-amber-600" />
                            </div>
                            <span className="text-xs font-bold">แตะเพื่อเลือกรูปภาพ / ถ่ายรูปอาหาร</span>
                            <span className="text-[10px] text-amber-700/80 font-normal">
                              ตัดขอบ ซูม และหมุนรูปภาพได้อิสระ
                            </span>
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-gray-600 block mb-0.5">ชื่อเมนู</label>
                          <input
                            type="text"
                            value={editItemName}
                            onChange={(e) => setEditItemName(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-amber-500 font-medium"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-600 block mb-0.5">ราคา (บาท)</label>
                          <input
                            type="number"
                            value={editItemPrice}
                            onChange={(e) => setEditItemPrice(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-amber-500 font-medium"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-gray-600 block mb-0.5">หมวดหมู่</label>
                        <select
                          value={editItemCategory}
                          onChange={(e) => setEditItemCategory(e.target.value as any)}
                          className="w-full px-2.5 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-hidden"
                        >
                          <option value="food">อาหาร</option>
                          <option value="drink_dessert">เครื่องดื่ม/ของหวาน</option>
                        </select>
                      </div>

                      {/* Edit Option Groups & Toppings */}
                      <div className="bg-amber-50/50 p-2.5 rounded-xl border border-amber-200/80 space-y-2.5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-amber-200/60 pb-1.5">
                          <div>
                            <span className="text-[11px] font-black text-amber-900 flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-amber-600" />
                              <span>กลุ่มตัวเลือกเมนู (ก๋วยเตี๋ยว, ลูกชิ้น, ชานม)</span>
                            </span>
                            <p className="text-[9px] text-gray-500">
                              ตั้งค่ากลุ่มตัวเลือกแบบบังคับเลือก (Radio) หรือเลือกได้หลายอย่าง (Checkbox)
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const newGroupId = `grp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
                              setEditItemOptionGroups([
                                ...editItemOptionGroups,
                                {
                                  id: newGroupId,
                                  title: `กลุ่มที่ ${editItemOptionGroups.length + 1}`,
                                  required: true,
                                  type: 'single',
                                  options: [
                                    { id: '1', name: '', price: 0 },
                                    { id: '2', name: '', price: 0 },
                                  ],
                                },
                              ]);
                            }}
                            className="text-[10px] font-bold text-amber-800 bg-white hover:bg-amber-100 px-2 py-0.5 rounded-lg border border-amber-300 transition active:scale-95 flex items-center gap-1 shrink-0 self-start sm:self-auto"
                          >
                            <Plus className="w-3 h-3" />
                            <span>+ เพิ่มกลุ่มตัวเลือก</span>
                          </button>
                        </div>

                        {/* Quick 1-Click Preset Templates for Edit Form */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
                          {OPTION_PRESETS.map((preset, pIdx) => (
                            <button
                              key={pIdx}
                              type="button"
                              onClick={() => {
                                if (
                                  editItemOptionGroups.length > 0 &&
                                  !confirm(`ต้องการโหลดเทมเพลต "${preset.label}" แทนที่กลุ่มตัวเลือกปัจจุบันหรือไม่?`)
                                ) {
                                  return;
                                }
                                setEditItemOptionGroups(preset.groups());
                              }}
                              className="p-1.5 rounded-lg bg-white hover:bg-amber-50 text-gray-800 border border-amber-200/80 text-[10px] font-bold flex items-center justify-center gap-1 shadow-2xs transition active:scale-95"
                            >
                              <span>{preset.icon}</span>
                              <span className="truncate">{preset.label}</span>
                            </button>
                          ))}
                        </div>

                        {/* Edit Option Groups List */}
                        {editItemOptionGroups.length > 0 && (
                          <div className="space-y-2 pt-1">
                            {editItemOptionGroups.map((group, gIdx) => (
                              <div
                                key={group.id || gIdx}
                                className="p-2.5 bg-white rounded-xl border border-amber-200 space-y-2 shadow-2xs animate-in fade-in"
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-gray-100 pb-1.5">
                                  <div className="flex-1 flex items-center gap-1.5">
                                    <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-black flex items-center justify-center shrink-0">
                                      {gIdx + 1}
                                    </span>
                                    <input
                                      type="text"
                                      placeholder="ชื่อกลุ่ม เช่น 1. เลือกเส้น"
                                      value={group.title}
                                      onChange={(e) => {
                                        const next = [...editItemOptionGroups];
                                        next[gIdx].title = e.target.value;
                                        setEditItemOptionGroups(next);
                                      }}
                                      className="flex-1 px-2 py-1 text-xs bg-gray-50 border border-gray-200 rounded-lg font-bold"
                                    />
                                  </div>

                                  <div className="flex items-center gap-1 flex-wrap">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const next = [...editItemOptionGroups];
                                        next[gIdx].required = !next[gIdx].required;
                                        setEditItemOptionGroups(next);
                                      }}
                                      className={`px-2 py-0.5 rounded text-[9px] font-bold border transition ${
                                        group.required
                                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                                          : 'bg-gray-50 text-gray-600 border-gray-200'
                                      }`}
                                    >
                                      {group.required ? 'จำเป็น' : 'ไม่บังคับ'}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        const next = [...editItemOptionGroups];
                                        next[gIdx].type = next[gIdx].type === 'single' ? 'multiple' : 'single';
                                        setEditItemOptionGroups(next);
                                      }}
                                      className={`px-2 py-0.5 rounded text-[9px] font-bold border transition ${
                                        group.type === 'single'
                                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                                          : 'bg-blue-50 text-blue-800 border-blue-200'
                                      }`}
                                    >
                                      {group.type === 'single' ? 'เลือกได้ 1 อย่าง (Radio)' : 'เลือกได้หลายอย่าง (Checkbox)'}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditItemOptionGroups(editItemOptionGroups.filter((_, i) => i !== gIdx));
                                      }}
                                      className="p-1 text-gray-400 hover:text-rose-600 rounded"
                                      title="ลบกลุ่มตัวเลือกนี้"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>

                                {/* Items in this group */}
                                <div className="space-y-1 pl-2 border-l-2 border-amber-300">
                                  {group.options.map((opt, oIdx) => (
                                    <div key={opt.id || oIdx} className="flex items-center gap-1 animate-in fade-in">
                                      <input
                                        type="text"
                                        placeholder="ชื่อตัวเลือก เช่น เส้นเล็ก, น้ำตก"
                                        value={opt.name}
                                        onChange={(e) => {
                                          const next = [...editItemOptionGroups];
                                          next[gIdx].options[oIdx].name = e.target.value;
                                          setEditItemOptionGroups(next);
                                        }}
                                        className="flex-1 px-2 py-1 text-xs bg-gray-50 border border-gray-200 rounded-lg font-medium"
                                      />
                                      <div className="flex items-center gap-0.5 w-20 shrink-0">
                                        <input
                                          type="number"
                                          placeholder="+บาท"
                                          value={opt.price}
                                          onChange={(e) => {
                                            const next = [...editItemOptionGroups];
                                            next[gIdx].options[oIdx].price = parseFloat(e.target.value) || 0;
                                            setEditItemOptionGroups(next);
                                          }}
                                          className="w-full px-1.5 py-1 text-xs bg-gray-50 border border-gray-200 rounded-lg text-right font-bold text-amber-600"
                                        />
                                        <span className="text-[10px] text-gray-400">฿</span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const next = [...editItemOptionGroups];
                                          next[gIdx].options = next[gIdx].options.filter((_, i) => i !== oIdx);
                                          setEditItemOptionGroups(next);
                                        }}
                                        className="p-1 text-gray-400 hover:text-rose-500 rounded"
                                        title="ลบตัวเลือกนี้"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ))}

                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = [...editItemOptionGroups];
                                      next[gIdx].options.push({
                                        id: `opt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                                        name: '',
                                        price: 0,
                                      });
                                      setEditItemOptionGroups(next);
                                    }}
                                    className="text-[10px] font-bold text-amber-700 hover:text-amber-800 inline-flex items-center gap-1 pt-0.5"
                                  >
                                    <Plus className="w-2.5 h-2.5" />
                                    <span>+ เพิ่มตัวเลือกในกลุ่ม &quot;{group.title || `กลุ่มที่ ${gIdx + 1}`}&quot;</span>
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {editItemOptionGroups.length === 0 && (
                          <p className="text-[10px] text-gray-400 italic">
                            ยังไม่มีกลุ่มตัวเลือก กดเลือกเทมเพลตด้านบนหรือกด &quot;+ เพิ่มกลุ่มตัวเลือก&quot; ได้เลย
                          </p>
                        )}
                      </div>

                      <div className="flex justify-end gap-1.5 pt-1 border-t border-gray-100">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMenuItem(null);
                            setEditItemImage('');
                            setEditItemOptionGroups([]);
                          }}
                          className="px-3 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded-xl"
                        >
                          ยกเลิก
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveEditMenuItem}
                          className="px-4 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-xs transition active:scale-95"
                        >
                          บันทึกการแก้ไข
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Normal View Mode */
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative group/img shrink-0">
                          {item.image_url ? (
                            <img
                              key={item.image_url}
                              src={item.image_url}
                              alt={item.name}
                              className="w-14 h-14 rounded-2xl object-cover border border-gray-100 shadow-2xs"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl border border-amber-100">
                              {item.category === 'food' ? <UtensilsCrossed className="w-6 h-6" /> : <CupSoda className="w-6 h-6" />}
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingItemForImage(item);
                              editFileInputRef.current?.click();
                            }}
                            className="absolute inset-0 bg-black/60 text-white rounded-2xl opacity-0 hover:opacity-100 transition flex flex-col items-center justify-center text-[10px] font-bold"
                            title="คลิกเพื่อเปลี่ยนรูปอาหาร"
                          >
                            <Camera className="w-3.5 h-3.5 mb-0.5" />
                            <span>ใส่รูป</span>
                          </button>
                        </div>

                        <div className="min-w-0">
                          <h4 className="font-bold text-sm text-gray-800 leading-tight truncate">{item.name}</h4>
                          <p className="text-xs text-amber-600 font-black mt-0.5">{item.price} บาท</p>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-md">
                              {item.category === 'food' ? 'อาหาร' : 'ของหวาน/น้ำ'}
                            </span>
                            <span className="text-[10px] bg-orange-50 text-orange-600 font-bold px-1.5 py-0.5 rounded-md border border-orange-200">
                              ขายแล้ว {item.sales_count || 0} {item.category === 'food' ? 'จาน' : 'แก้ว'}
                            </span>
                            {!item.image_url ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingItemForImage(item);
                                  editFileInputRef.current?.click();
                                }}
                                className="text-[10px] text-amber-600 hover:underline font-semibold cursor-pointer"
                              >
                                + ใส่รูป
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={async () => {
                                  if (confirm(`ต้องการลบรูปภาพของเมนู "${item.name}" และใช้รูปเริ่มต้นใช่หรือไม่?`)) {
                                    await handleUpdateItemImage(item.id, '');
                                  }
                                }}
                                className="text-[10px] text-rose-500 hover:underline font-semibold flex items-center gap-0.5 cursor-pointer"
                                title="ลบรูปภาพเมนูนี้"
                              >
                                <Trash2 className="w-2.5 h-2.5" /> ลบรูป
                              </button>
                            )}
                          </div>
                          {item.option_groups && item.option_groups.length > 0 ? (
                            <div className="text-[10px] text-amber-800 bg-amber-50/80 px-2 py-0.5 rounded-lg border border-amber-200/70 mt-1 max-w-xs truncate flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-amber-600 shrink-0" />
                              <span>กลุ่มตัวเลือก: {item.option_groups.map((g) => g.title).join(' • ')}</span>
                            </div>
                          ) : item.options && item.options.length > 0 ? (
                            <div className="text-[10px] text-amber-800 bg-amber-50/80 px-2 py-0.5 rounded-lg border border-amber-200/70 mt-1 max-w-xs truncate">
                              ท็อปปิ้ง: {item.options.map((o) => `${o.name} (+${o.price}฿)`).join(', ')}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMenuItem(item);
                            setEditItemName(item.name);
                            setEditItemPrice(String(item.price));
                            setEditItemCategory(item.category || 'food');
                            setEditItemImage(item.image_url || '');
                            setEditItemOptions(item.options ? [...item.options] : []);
                            setEditItemOptionGroups(item.option_groups ? JSON.parse(JSON.stringify(item.option_groups)) : []);
                          }}
                          className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition"
                          title="แก้ไขเมนูและตัวเลือก"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleItemAvailability(item.id, item.is_available)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                            item.is_available
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          {item.is_available ? 'พร้อมขาย' : 'ของหมด'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteMenuItem(item.id, item.name)}
                          className="p-1.5 text-gray-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="ลบเมนูนี้"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sales use completed orders and actual credit charges. */}
      {activeTab === 'sales' && shopId && (
        <SalesDashboard
          orders={orders}
          shops={shopData ? [shopData] : []}
          shopId={shopId}
          onTopup={() => setShowTopupContactModal(true)}
          onViewCreditHistory={() => setShowCreditHistoryModal(true)}
        />
      )}

      {/* TAB 4: SHOP PROFILE SETTINGS */}
      {activeTab === 'shop_info' && (
        <form
          onSubmit={handleSaveShopInfo}
          className="bg-white rounded-3xl p-5 border border-gray-100 shadow-xs space-y-4 animate-in fade-in"
        >
          <div>
            <h3 className="font-black text-base text-gray-800">ตั้งค่าข้อมูลร้านค้า</h3>
            <p className="text-xs text-gray-400">ข้อมูลนี้จะแสดงให้ลูกค้าเห็นในหน้ารายชื่อร้านค้าและหน้าสั่งอาหาร</p>
          </div>

          {/* Storefront Image Setting (Single Canonical Place) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-700 block">รูปภาพหน้าร้าน (Cover Banner หน้าแรก)</label>
              <span className="text-[11px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                สัดส่วนแนวนอน 16:9
              </span>
            </div>
            <div className="relative h-44 rounded-2xl overflow-hidden border border-gray-200 shadow-2xs group bg-gray-100">
              {shopData?.image_url ? (
                <img
                  key={shopData.image_url}
                  src={shopData.image_url}
                  alt={shopData.name || 'Storefront cover'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-amber-500 via-orange-500 to-amber-700 flex flex-col items-center justify-center text-white select-none">
                  <Store className="w-12 h-12 opacity-85 mb-1" />
                  <span className="text-xs font-bold bg-black/25 backdrop-blur-xs px-3 py-1 rounded-full border border-white/20">
                    ยังไม่มีรูปภาพหน้าร้าน
                  </span>
                </div>
              )}
              <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setCropTarget('shop_cover');
                    shopCoverInputRef.current?.click();
                  }}
                  className="px-3 py-1.5 bg-black/80 hover:bg-black/95 text-white rounded-xl text-xs font-bold backdrop-blur-xs flex items-center gap-1.5 shadow-md active:scale-95 transition cursor-pointer border border-white/20"
                >
                  <Camera className="w-3.5 h-3.5 text-amber-400" />
                  <span>{shopData?.image_url ? 'เปลี่ยนรูปภาพหน้าร้าน' : 'ใส่รูปภาพหน้าร้าน'}</span>
                </button>

                {shopData?.image_url && (
                  <button
                    type="button"
                    onClick={handleRemoveShopCover}
                    className="px-2.5 py-1.5 bg-rose-600/85 hover:bg-rose-700 text-white rounded-xl text-xs font-bold backdrop-blur-xs flex items-center gap-1.5 shadow-md active:scale-95 transition cursor-pointer"
                    title="ลบรูปภาพหน้าร้าน"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>ลบรูป</span>
                  </button>
                )}
              </div>
            </div>
            <p className="text-[11px] text-gray-400">รูปภาพหน้าร้านนี้จะแสดงบนฟีดหน้าแรก ให้ลูกค้าเห็นความน่ากินและป้ายร้าน</p>
          </div>

          {/* Shop Name */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-700 block">ชื่อร้านค้า</label>
            <input
              type="text"
              required
              placeholder="เช่น ส้มตำต้นปาล์ม หรือ ป้าศรี กะเพราถาดยักษ์"
              value={editShopName}
              onChange={(e) => {
                shopNameDirtyRef.current = true;
                setEditShopName(e.target.value);
              }}
              className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium"
            />
          </div>

          {/* Phone */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-700 block">เบอร์โทรศัพท์ร้าน (สำหรับให้ลูกค้าโทรติดต่อ)</label>
            <input
              type="tel"
              required
              placeholder="08x-xxx-xxxx"
              value={editShopPhone}
              onChange={(e) => {
                shopPhoneDirtyRef.current = true;
                setEditShopPhone(e.target.value);
              }}
              className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium"
            />
          </div>

          {/* Address */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-700 block">ที่ตั้งร้าน / พิกัดจุดสังเกต</label>
            <textarea
              rows={2}
              placeholder="เช่น ซอยข้างหอพักพูนทรัพย์ ตรงข้ามประตู 1 มรภ. ชัยภูมิ"
              value={editShopAddress}
              onChange={(e) => {
                shopAddressDirtyRef.current = true;
                setEditShopAddress(e.target.value);
              }}
              className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 resize-none font-medium"
            />
          </div>

          {/* Delivery Fee Setting by Merchant */}
          <div className="space-y-1.5 p-3.5 bg-amber-50/70 rounded-2xl border border-amber-200">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-amber-950 block flex items-center gap-1.5">
                <Bike className="w-3.5 h-3.5 text-amber-600" />
                <span>ค่าจัดส่งของร้าน (บาท)</span>
              </label>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                GP ไม่หักค่าส่ง
              </span>
            </div>
            <p className="text-[11px] text-amber-800/80">
              กำหนดค่าส่งเหมาของร้านคุณสำหรับออเดอร์นี้ (หากไม่กรอกหรือใส่ 0 ระบบจะขึ้นว่า "ส่งฟรี")
            </p>

            {/* Quick Presets */}
            <div className="flex gap-1.5 pt-1">
              {[0, 10, 15, 20].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    shopDeliveryFeeDirtyRef.current = true;
                    setEditShopDeliveryFee(String(preset));
                  }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-xl border transition ${
                    editShopDeliveryFee === String(preset)
                      ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {preset === 0 ? 'ส่งฟรี (0฿)' : `${preset} ฿`}
                </button>
              ))}
            </div>

            <input
              type="number"
              min="0"
              placeholder="0 (ส่งฟรี)"
              value={editShopDeliveryFee}
              onChange={(e) => {
                shopDeliveryFeeDirtyRef.current = true;
                setEditShopDeliveryFee(e.target.value);
              }}
              className="w-full px-3 py-2 text-sm bg-white border border-amber-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-bold text-gray-800"
            />
          </div>

          {/* Delivery Radius Setting by Merchant */}
          <div className="space-y-1.5 p-3.5 bg-orange-50/70 rounded-2xl border border-orange-200">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-orange-950 flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5 text-orange-600" />
                <span>รัศมีขอบเขตจัดส่งอาหาร (กิโลเมตร)</span>
              </label>
              <span className="text-[11px] font-bold text-orange-700 bg-orange-100/80 px-2 py-0.5 rounded-full">
                ค่าเริ่มต้น 1.0 กม.
              </span>
            </div>
            <p className="text-[11px] text-orange-800/80">
              กำหนดระยะทางสูงสุดที่ร้านของคุณรับจัดส่ง ลูกค้าที่ปักหมุดเกินระยะนี้จะไม่สามารถสั่งอาหารได้ (วงกลมบนแผนที่จะปรับขนาดตามทันที)
            </p>

            {/* Quick Radius Presets */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[0.5, 1.0, 1.5, 2.0, 3.0, 5.0].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    shopDeliveryRadiusDirtyRef.current = true;
                    setEditShopDeliveryRadius(String(preset));
                  }}
                  className={`flex-1 min-w-[52px] py-1.5 text-xs font-bold rounded-xl border transition ${
                    parseFloat(editShopDeliveryRadius) === preset
                      ? 'bg-orange-500 text-white border-orange-600 shadow-2xs'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {preset} กม.{preset === 1.0 ? ' ★' : ''}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <div className="relative flex-1">
                <input
                  type="number"
                  step="0.1"
                  min="0.2"
                  max="30"
                  placeholder="1.0"
                  value={editShopDeliveryRadius}
                  onChange={(e) => {
                    shopDeliveryRadiusDirtyRef.current = true;
                    setEditShopDeliveryRadius(e.target.value);
                  }}
                  className="w-full px-3 py-2 text-sm bg-white border border-orange-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-orange-500 font-bold text-gray-800"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold pointer-events-none">
                  กม.
                </span>
              </div>
            </div>
          </div>

          {/* Payment Info Settings (QR Code, Bank Account, PromptPay) */}
          <div className="space-y-3.5 p-4 bg-gradient-to-br from-emerald-50/80 to-teal-50/60 rounded-2xl border border-emerald-200">
            <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-700 shrink-0" />
                <div>
                  <h4 className="text-xs font-black text-emerald-950">ข้อมูลการรับเงินของร้านค้า</h4>
                  <p className="text-[11px] text-emerald-800/80">ระบบจะนำข้อมูลนี้ไปสร้างปุ่มส่งให้ลูกค้าสแกนจ่าย/โอนเงินในห้องแชทสดทันที</p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                โอนก่อนทำอาหาร
              </span>
            </div>

            {/* QR Code Image Upload */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 block">
                รูปภาพ QR Code รับเงิน (PromptPay / บัญชีธนาคาร)
              </label>
              {editShopPromptpayQrUrl ? (
                <div className="flex items-center gap-3 p-2.5 bg-white rounded-2xl border border-emerald-200 shadow-2xs">
                  <div className="w-20 h-20 rounded-xl border border-gray-200 overflow-hidden bg-gray-50 shrink-0">
                    <img
                      src={editShopPromptpayQrUrl}
                      alt="QR Code ร้านค้า"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <p className="text-xs font-bold text-emerald-900">มีรูปภาพ QR Code แล้ว</p>
                    <p className="text-[11px] text-gray-500 leading-snug">ลูกค้าสามารถสแกนจ่ายผ่านแชทสดได้สะดวกรวดเร็ว</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => shopQrInputRef.current?.click()}
                        className="px-2.5 py-1 text-[11px] font-bold bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg transition"
                      >
                        เปลี่ยนรูป QR
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveShopQr}
                        className="px-2.5 py-1 text-[11px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition"
                      >
                        ลบรูป
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => shopQrInputRef.current?.click()}
                  className="w-full py-3.5 px-4 bg-white hover:bg-emerald-50/50 border-2 border-dashed border-emerald-300 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold text-emerald-800 transition active:scale-98 shadow-2xs cursor-pointer"
                >
                  <QrCode className="w-4 h-4 text-emerald-600" />
                  <span>แตะเพื่ออัปโหลดรูป QR Code รับเงิน</span>
                </button>
              )}
            </div>

            {/* Bank Select & Account Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">ธนาคาร / ช่องทางรับเงิน</label>
                <select
                  value={editShopBankName}
                  onChange={(e) => {
                    shopBankNameDirtyRef.current = true;
                    setEditShopBankName(e.target.value);
                  }}
                  className="w-full px-3 py-2 text-sm bg-white border border-emerald-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium text-gray-800"
                >
                  <option value="">-- เลือกธนาคาร --</option>
                  <option value="กสิกรไทย (KBANK)">กสิกรไทย (KBANK)</option>
                  <option value="ไทยพาณิชย์ (SCB)">ไทยพาณิชย์ (SCB)</option>
                  <option value="กรุงไทย (KTB)">กรุงไทย (KTB)</option>
                  <option value="กรุงเทพ (BBL)">กรุงเทพ (BBL)</option>
                  <option value="ทหารไทยธนชาต (TTB)">ทหารไทยธนชาต (TTB)</option>
                  <option value="กรุงศรีอยุธยา (BAY)">กรุงศรีอยุธยา (BAY)</option>
                  <option value="ออมสิน (GSB)">ออมสิน (GSB)</option>
                  <option value="ธ.ก.ส. (BAAC)">ธ.ก.ส. (BAAC)</option>
                  <option value="พร้อมเพย์ (PromptPay)">พร้อมเพย์ (PromptPay)</option>
                  <option value="ทรูมันนี่ (TrueMoney)">ทรูมันนี่ วอลเล็ท (TrueMoney)</option>
                  <option value="อื่นๆ">อื่นๆ</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">เลขที่บัญชีธนาคาร</label>
                <input
                  type="text"
                  placeholder="เช่น 123-4-56789-0"
                  value={editShopBankAccountNumber}
                  onChange={(e) => {
                    shopBankAccountNumberDirtyRef.current = true;
                    setEditShopBankAccountNumber(e.target.value);
                  }}
                  className="w-full px-3 py-2 text-sm bg-white border border-emerald-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium text-gray-800"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">ชื่อ-นามสกุล เจ้าของบัญชี</label>
                <input
                  type="text"
                  placeholder="เช่น นายสมชาย ใจดี"
                  value={editShopBankAccountName}
                  onChange={(e) => {
                    shopBankAccountNameDirtyRef.current = true;
                    setEditShopBankAccountName(e.target.value);
                  }}
                  className="w-full px-3 py-2 text-sm bg-white border border-emerald-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium text-gray-800"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">เบอร์พร้อมเพย์ (PromptPay)</label>
                <input
                  type="text"
                  placeholder="เช่น 0812345678 (ถ้ามี)"
                  value={editShopPromptpay}
                  onChange={(e) => {
                    shopPromptpayDirtyRef.current = true;
                    setEditShopPromptpay(e.target.value);
                  }}
                  className="w-full px-3 py-2 text-sm bg-white border border-emerald-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium text-gray-800"
                />
              </div>
            </div>
          </div>

          {/* Shop Location GPS Map Picker */}
          <div className="space-y-1.5 pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-rose-500" />
                <span>ปักหมุดตำแหน่งที่ตั้งร้านค้า (GPS)</span>
              </label>
              {shopLocation && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${shopLocation.lat},${shopLocation.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 font-semibold"
                >
                  <Navigation className="w-3 h-3 text-blue-500" /> ดูบน Google Maps
                </a>
              )}
            </div>
            <p className="text-[11px] text-gray-400">
              แตะบนแผนที่ หรือลากหมุดสีแดงเพื่อระบุพิกัดหน้าร้านของคุณ ให้ลูกค้าและไรเดอร์นำทางมาได้แม่นยำ
            </p>
            <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-2xs">
              <MapPicker
                location={shopLocation}
                centerLocation={shopLocation}
                maxRadiusKm={parseFloat(editShopDeliveryRadius) > 0 ? parseFloat(editShopDeliveryRadius) : 1.0}
                showRadiusCircle={true}
                onChange={(loc) => {
                  shopLocationDirtyRef.current = true;
                  setShopLocation(loc);
                }}
                title={editShopName || 'ตำแหน่งร้านของคุณ'}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSavingShopInfo}
            className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 text-white font-black text-xs rounded-xl shadow-md transition active:scale-95 disabled:opacity-50"
          >
            {isSavingShopInfo ? 'กำลังบันทึก...' : 'บันทึกข้อมูลร้านค้า'}
          </button>

        </form>
      )}

      {/* Embedded Chat Modal for Merchant */}
      {activeChatOrder && (
        <ChatModal
          orderId={activeChatOrder.id}
          orderCode={formatOrderCode(activeChatOrder)}
          shopName={currentUser.display_name}
          shopImage={shopData?.image_url || currentUser.picture_url}
          shopPaymentInfo={{
            bank_name: shopData?.bank_name,
            bank_account_number: shopData?.bank_account_number,
            bank_account_name: shopData?.bank_account_name,
            promptpay_number: shopData?.promptpay_number,
            promptpay_qr_url: shopData?.promptpay_qr_url,
          }}
          orderTotal={activeChatOrder.total_amount}
          customerName={activeChatOrder.customer_name}
          customerImage={activeChatOrder.customer_avatar}
          currentUser={{
            uid: currentUser.uid,
            name: currentUser.display_name,
            role: currentUser.role,
            picture_url: currentUser.picture_url,
          }}
          onClose={() => setActiveChatOrder(null)}
        />
      )}

      {/* Image Crop & Adjust Modal */}
      {rawImageForCrop && (
        <ImageCropModal
          key={rawImageForCrop}
          imageSrc={rawImageForCrop}
          initialAspectRatio={cropTarget === 'shop_cover' ? '16:9' : '1:1'}
          title={cropTarget === 'shop_cover' ? 'ตัดขอบรูปภาพหน้าร้าน (แนวนอน 16:9)' : 'ตัดขอบรูปภาพอาหาร'}
          onCropComplete={handleCropFinished}
          onCancel={() => setRawImageForCrop(null)}
        />
      )}

      {/* Top-up Credit Contact Modal */}
      {showTopupContactModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                <span>เติมเครดิตร้านค้า</span>
              </h3>
              <button
            type="button"
            onClick={() => setShowTopupContactModal(false)}
            className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 font-bold transition text-xs"
          >
            <X className="w-4 h-4" />
          </button>
            </div>

            <div className="space-y-3 text-xs text-gray-600">
              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 space-y-1.5">
                <p className="font-bold">ขั้นตอนการเติมเครดิตร้านค้า:</p>
                <ol className="list-decimal list-inside space-y-1 text-[11px] text-amber-800">
                  <li>ทัก LINE Official Account: <strong className="text-amber-950 font-mono">@887nrlyw</strong></li>
                  <li>แจ้งชื่อร้านค้า: <strong className="text-amber-950">{shopData?.name || 'ครัวต้นปาล์ม'}</strong></li>
                  <li>โอนเงินเติมเครดิตตามต้องการ (เช่น 100, 200, 500 บาท)</li>
                  <li>ส่งสลิปให้แอดมิน แอดมินจะกดเพิ่มเครดิตเข้าระบบทันทีครับ</li>
                </ol>
              </div>

              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-900 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-emerald-700 font-bold">LINE Official (HuayChan)</p>
                  <p className="text-sm font-black text-emerald-950 font-mono">@887nrlyw</p>
                </div>
                <a
                  href="https://line.me/R/ti/p/@887nrlyw"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 bg-[#06C755] hover:bg-[#05b34c] text-white font-black text-xs rounded-xl shadow-xs flex items-center gap-1 transition active:scale-95"
                >
                  <span>เปิด LINE</span>
                </a>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowTopupContactModal(false)}
              className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        </div>
      )}

      {/* Merchant Transparent Credit History Modal */}
      <MerchantCreditHistoryModal
        isOpen={showCreditHistoryModal}
        onClose={() => setShowCreditHistoryModal(false)}
        shopData={shopData}
        transactions={creditTransactions}
        gpEnabled={systemSettings?.gp_enabled}
        gpPercent={systemSettings?.gp_percent}
        onOpenTopupContact={() => setShowTopupContactModal(true)}
      />

    </div>
  );
}
