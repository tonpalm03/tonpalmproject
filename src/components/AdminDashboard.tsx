'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck, Users, Store, TrendingUp, Calendar, Eye, CheckCircle2,
  AlertCircle, DollarSign, Clock, MessageSquare, Award, Search, Trash2, Phone, X,
  Camera, MapPin, Star, Power, Edit3, Download, Navigation, FileSpreadsheet, Check, Bike, ChefHat, Plus, Edit2, Scissors,
  Key, Lock, Copy, EyeOff, Settings, ArrowRight, User, RefreshCw, Sparkles, Coffee, Utensils, Percent, Wallet, FileText
} from 'lucide-react';
import { UserProfile, Order, UserRole, Shop, MenuItem, MenuItemOption, CreditTransaction } from '@/types';
import { db, functions } from '@/lib/firebase';
import {
  collection, onSnapshot, doc, updateDoc, setDoc, deleteDoc, getDocs, serverTimestamp, writeBatch, query, where, orderBy, limit, runTransaction, Transaction
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import ChatModal from './ChatModal';
import SalesDashboard from './SalesDashboard';
import { chargedByOrder } from '@/lib/salesSummary';
import ImageCropModal from './ImageCropModal';
import UserAvatar, { getUserCode } from './UserAvatar';
import { formatOrderCode } from '@/lib/orderNumber';
import { orderItemUnitPrice } from '@/lib/orderItemPrice';
import {
  getOrderDate, isSameDay, getWeekRange, getCycleId, formatThaiDate,
  formatThaiDateWithTime, formatCycleLabel, THAI_MONTHS_FULL
} from '@/lib/dateUtils';
import { soundAlert } from '@/lib/soundAlert';
import { readFileAsDataUrl } from '@/lib/imageUtils';

interface AdminDashboardProps {
  currentUser: UserProfile;
}

export default function AdminDashboard({ currentUser }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'analytics' | 'users' | 'shops' | 'orders' | 'settlement'>('analytics');

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeChatOrder, setActiveChatOrder] = useState<Order | null>(null);

  // Cropping state for Admin (Shop Cover & Menu Items)
  const [cropTarget, setCropTarget] = useState<'shop_cover' | 'new_menu' | 'edit_menu'>('shop_cover');
  const cropTargetRef = useRef<'shop_cover' | 'new_menu' | 'edit_menu'>('shop_cover');
  const [selectedShopForCrop, setSelectedShopForCrop] = useState<Shop | null>(null);
  const selectedShopForCropRef = useRef<Shop | null>(null);
  const [editingMenuItemForImage, setEditingMenuItemForImage] = useState<MenuItem | null>(null);
  const editingMenuItemForImageRef = useRef<MenuItem | null>(null);
  const [rawImageForCrop, setRawImageForCrop] = useState<string | null>(null);
  const adminShopCoverInputRef = useRef<HTMLInputElement | null>(null);
  const adminMenuImageInputRef = useRef<HTMLInputElement | null>(null);
  const adminMenuEditImageInputRef = useRef<HTMLInputElement | null>(null);
  const [isSubmittingMenu, setIsSubmittingMenu] = useState(false);
  const isSubmittingMenuRef = useRef(false);

  // User search & filter state
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'customer' | 'merchant' | 'admin'>('all');

  // Grant Merchant Modal state
  const [selectedUserForMerchant, setSelectedUserForMerchant] = useState<UserProfile | null>(null);
  const [newShopName, setNewShopName] = useState('');
  const [newShopPhone, setNewShopPhone] = useState('');

  // Order Log Filter & Date State for Admin
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all');
  const [orderDatePreset, setOrderDatePreset] = useState<'all' | 'today' | 'yesterday' | '7days' | 'custom'>('all');
  const [orderCustomDate, setOrderCustomDate] = useState<string>(''); // YYYY-MM-DD
  const [orderSearchQuery, setOrderSearchQuery] = useState<string>('');
  const [orderShopFilter, setOrderShopFilter] = useState<string>('all');

  // Storage Maintenance Modal State
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [isCleaningChats, setIsCleaningChats] = useState(false);
  const [cleanupStatusMessage, setCleanupStatusMessage] = useState<string | null>(null);

  // Comprehensive Shop Management states (Reviews, Menus, Edit Info)
  const [allShopReviews, setAllShopReviews] = useState<any[]>([]);
  const [allMenuItems, setAllMenuItems] = useState<MenuItem[]>([]);
  const [selectedShopForReviews, setSelectedShopForReviews] = useState<Shop | null>(null);
  const [selectedShopForMenus, setSelectedShopForMenus] = useState<Shop | null>(null);
  const [selectedShopForEdit, setSelectedShopForEdit] = useState<Shop | null>(null);
  const [editShopName, setEditShopName] = useState('');
  const [editShopPhone, setEditShopPhone] = useState('');
  const [editShopPromptpay, setEditShopPromptpay] = useState('');
  const [editShopAddress, setEditShopAddress] = useState('');
  const [editShopCategory, setEditShopCategory] = useState<'food' | 'drink_dessert'>('food');
  const [editShopDeliveryFee, setEditShopDeliveryFee] = useState<string>('0');
  const [isSavingShopDetails, setIsSavingShopDetails] = useState(false);

  // Admin Create Merchant Account Modal state
  const [showCreateMerchantModal, setShowCreateMerchantModal] = useState(false);
  const [createShopName, setCreateShopName] = useState('');
  const [createMerchantEmail, setCreateMerchantEmail] = useState('');
  const [createMerchantPassword, setCreateMerchantPassword] = useState('');
  const [createShopPhone, setCreateShopPhone] = useState('');
  const [createShopPromptpay, setCreateShopPromptpay] = useState('');
  const [createShopAddress, setCreateShopAddress] = useState('');
  const [createShopDeliveryFee, setCreateShopDeliveryFee] = useState('0');
  const [createShopCategory, setCreateShopCategory] = useState<'food' | 'drink_dessert'>('food');
  const [isCreatingMerchant, setIsCreatingMerchant] = useState(false);
  const [createMerchantError, setCreateMerchantError] = useState('');

  // Admin View / Edit Merchant Credentials Modal state
  const [selectedShopForCredentials, setSelectedShopForCredentials] = useState<Shop | null>(null);
  const [merchantCredEmail, setMerchantCredEmail] = useState('');
  const [merchantCredPassword, setMerchantCredPassword] = useState('');
  const [isFetchingCreds, setIsFetchingCreds] = useState(false);
  const [isSavingCreds, setIsSavingCreds] = useState(false);
  const [credError, setCredError] = useState('');
  const [credSuccess, setCredSuccess] = useState('');
  const [showCredPassword, setShowCredPassword] = useState(false);
  const [editCredEmail, setEditCredEmail] = useState('');
  const [editCredPassword, setEditCredPassword] = useState('');
  const [copiedCredField, setCopiedCredField] = useState<'email' | 'password' | null>(null);

  const [isAddingNewMenu, setIsAddingNewMenu] = useState(false);
  const [newMenuName, setNewMenuName] = useState('');
  const [newMenuPrice, setNewMenuPrice] = useState('');
  const [newMenuCategory, setNewMenuCategory] = useState<'food' | 'drink_dessert'>('food');
  const [newMenuImage, setNewMenuImage] = useState('');
  const [newMenuOptions, setNewMenuOptions] = useState<MenuItemOption[]>([]);

  // Editing existing menu item details
  const [editingMenuItem, setEditingMenuItem] = useState<MenuItem | null>(null);
  const [editMenuItemName, setEditMenuItemName] = useState('');
  const [editMenuItemPrice, setEditMenuItemPrice] = useState('');
  const [editMenuItemCategory, setEditMenuItemCategory] = useState<'food' | 'drink_dessert'>('food');
  const [editMenuItemOptions, setEditMenuItemOptions] = useState<MenuItemOption[]>([]);

  // Platform GP & Merchant Credit Management
  const [gpEnabled, setGpEnabled] = useState<boolean>(false);
  const [gpPercent, setGpPercent] = useState<number>(5);
  const [isSavingGp, setIsSavingGp] = useState<boolean>(false);
  const [creditTransactions, setCreditTransactions] = useState<CreditTransaction[]>([]);
  const [creditLedgerReady, setCreditLedgerReady] = useState(false);

  // Top-Up Merchant Credit Modal
  const [selectedShopForCredit, setSelectedShopForCredit] = useState<Shop | null>(null);
  const [topupAmount, setTopupAmount] = useState<string>('100');
  const [topupType, setTopupType] = useState<'topup' | 'deduct'>('topup');
  const [topupNote, setTopupNote] = useState<string>('');
  const [isSubmittingCredit, setIsSubmittingCredit] = useState<boolean>(false);
  const [creditError, setCreditError] = useState<string | null>(null);

  // Real-time listener for System Settings (GP toggle & percentage)
  useEffect(() => {
    try {
      const unsub = onSnapshot(doc(db, 'system_settings', 'general'), (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setGpEnabled(data.gp_enabled === true);
          setGpPercent(typeof data.gp_percent === 'number' ? data.gp_percent : 5);
        }
      }, (err) => {
        console.warn('System settings listener fallback:', err);
      });
      return () => unsub();
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Real-time listener for Credit Transactions Log
  useEffect(() => {
    try {
      const q = query(collection(db, 'credit_transactions'), orderBy('created_at', 'desc'));
      const unsub = onSnapshot(q, (snapshot) => {
        const list: CreditTransaction[] = [];
        snapshot.forEach((d) => list.push({ id: d.id, ...d.data() } as CreditTransaction));
        setCreditTransactions(list);
        setCreditLedgerReady(true);
      }, (err) => {
        setCreditLedgerReady(false);
        console.warn('Credit transactions listener fallback:', err);
      });
      return () => unsub();
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Listen to Users
  useEffect(() => {
    try {
      const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
        const list: UserProfile[] = [];
        snapshot.forEach((d) => list.push({ uid: d.id, ...d.data() } as UserProfile));
        setUsers(list);
      }, (err) => {
        console.warn('Admin users listener fallback:', err);
        // Fallback default users
        setUsers([
          {
            uid: 'guest_student_1',
            line_user_id: 'U12345',
            display_name: 'น้องต้นปาล์ม (นักศึกษา)',
            picture_url: '',
            role: 'customer',
            phone: '0812345678',
          },
          {
            uid: 'user_merchant_1',
            line_user_id: 'U67890',
            display_name: 'ป้าศรี กะเพราถาดยักษ์',
            picture_url: '',
            role: 'merchant',
            shop_id: 'shop_1',
            phone: '0898765432',
          },
        ]);
      });

      return () => unsub();
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Listen to All Orders
  useEffect(() => {
    try {
      const unsub = onSnapshot(collection(db, 'orders'), (snapshot) => {
        const list: Order[] = [];
        snapshot.forEach((d) => list.push({ id: d.id, ...d.data() } as Order));
        list.sort((a, b) => (getOrderDate(b)?.getTime() || 0) - (getOrderDate(a)?.getTime() || 0));
        setOrders(list);
      }, (err) => {
        console.warn('Admin orders listener fallback:', err);
        const cached = localStorage.getItem('hchk_orders');
        if (cached) setOrders(JSON.parse(cached));
      });

      return () => unsub();
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Listen to Shops
  useEffect(() => {
    try {
      const unsub = onSnapshot(collection(db, 'shops'), (snapshot) => {
        const list: Shop[] = [];
        snapshot.forEach((d) => list.push({ id: d.id, ...d.data() } as Shop));
        setShops(list);
      }, (err) => console.warn('Admin shops listener fallback:', err));

      return () => unsub();
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Listen to All Shop Reviews
  useEffect(() => {
    try {
      const unsub = onSnapshot(collection(db, 'shop_reviews'), (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((d) => list.push({ id: d.id, ...d.data() }));
        setAllShopReviews(list);
      }, (err) => console.warn('Admin shop reviews listener fallback:', err));

      return () => unsub();
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Listen to All Menu Items
  useEffect(() => {
    try {
      const unsub = onSnapshot(collection(db, 'menu_items'), (snapshot) => {
        const list: MenuItem[] = [];
        snapshot.forEach((d) => list.push({ id: d.id, ...d.data() } as MenuItem));
        setAllMenuItems(list);
      }, (err) => console.warn('Admin menu items listener fallback:', err));

      return () => unsub();
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleAdminShopCoverFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const input = e.target;

    try {
      const result = await readFileAsDataUrl(file);
      setCropTarget('shop_cover');
      cropTargetRef.current = 'shop_cover';
      setRawImageForCrop(result);
    } catch (err: any) {
      console.error('Admin shop cover file read error:', err);
      alert(err.message || 'ไม่สามารถอ่านไฟล์รูปภาพได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      input.value = '';
    }
  };

  const handleAdminMenuImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const input = e.target;

    try {
      const result = await readFileAsDataUrl(file);
      setCropTarget('new_menu');
      cropTargetRef.current = 'new_menu';
      setRawImageForCrop(result);
    } catch (err: any) {
      console.error('Admin menu image file read error:', err);
      alert(err.message || 'ไม่สามารถอ่านไฟล์รูปภาพได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      input.value = '';
    }
  };

  const handleAdminMenuEditFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const input = e.target;

    try {
      const result = await readFileAsDataUrl(file);
      setCropTarget('edit_menu');
      cropTargetRef.current = 'edit_menu';
      setRawImageForCrop(result);
    } catch (err: any) {
      console.error('Admin edit menu image file read error:', err);
      alert(err.message || 'ไม่สามารถอ่านไฟล์รูปภาพได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      input.value = '';
    }
  };

  const handleAdminCropComplete = async (croppedDataUrl: string) => {
    const activeCropTarget = cropTargetRef.current || cropTarget;
    if (activeCropTarget === 'shop_cover') {
      const targetShop = selectedShopForCrop || selectedShopForCropRef.current;
      if (targetShop) {
        const shopId = targetShop.id;
        try {
          await updateDoc(doc(db, 'shops', shopId), { image_url: croppedDataUrl });
          setShops((prev) =>
            prev.map((s) => (s.id === shopId ? { ...s, image_url: croppedDataUrl } : s))
          );
          alert(`อัปเดตรูปภาพหน้าร้าน "${targetShop.name}" สำเร็จแล้ว!`);
        } catch (e: any) {
          console.error('Update shop cover error:', e);
          alert(`อัปเดตรูปภาพหน้าร้านไม่สำเร็จ: ${e.message || 'เกิดข้อผิดพลาด'}`);
        } finally {
          setSelectedShopForCrop(null);
          selectedShopForCropRef.current = null;
        }
      } else {
        alert('ไม่พบข้อมูลร้านค้า กรุณาลองใหม่อีกครั้ง');
      }
    } else if (activeCropTarget === 'new_menu') {
      setNewMenuImage(croppedDataUrl);
    } else if (activeCropTarget === 'edit_menu') {
      const targetItem = editingMenuItemForImage || editingMenuItemForImageRef.current;
      if (targetItem) {
        const itemId = targetItem.id;
        try {
          await updateDoc(doc(db, 'menu_items', itemId), { image_url: croppedDataUrl });
          setAllMenuItems((prev) =>
            prev.map((m) => (m.id === itemId ? { ...m, image_url: croppedDataUrl } : m))
          );
          alert(`อัปเดตรูปภาพเมนู "${targetItem.name}" เรียบร้อยแล้ว!`);
        } catch (e: any) {
          console.error('Update menu image error:', e);
          alert(`อัปเดตรูปภาพเมนูไม่สำเร็จ: ${e.message || 'เกิดข้อผิดพลาด'}`);
        } finally {
          setEditingMenuItemForImage(null);
          editingMenuItemForImageRef.current = null;
        }
      } else {
        alert('ไม่พบข้อมูลเมนูที่ต้องการแก้ไขรูปภาพ');
      }
    }
    setRawImageForCrop(null);
  };

  const handleAdminRemoveShopCover = async (shop: Shop) => {
    if (!confirm(`ต้องการลบรูปภาพหน้าร้าน "${shop.name}" และใช้รูปเริ่มต้นใช่หรือไม่?`)) return;
    try {
      await updateDoc(doc(db, 'shops', shop.id), { image_url: '' });
      setShops((prev) =>
        prev.map((s) => (s.id === shop.id ? { ...s, image_url: '' } : s))
      );
      alert(`ลบรูปภาพหน้าร้าน "${shop.name}" เรียบร้อยแล้ว`);
    } catch (e: any) {
      console.warn('Admin remove shop cover error:', e);
      alert(`เกิดข้อผิดพลาดในการลบรูปภาพ: ${e.message || 'ไม่สามารถลบได้'}`);
    }
  };

  const handleAdminRemoveMenuImage = async (item: MenuItem) => {
    if (!confirm(`ต้องการลบรูปภาพเมนู "${item.name}" และใช้สัญลักษณ์เริ่มต้นใช่หรือไม่?`)) return;
    try {
      await updateDoc(doc(db, 'menu_items', item.id), { image_url: '' });
      setAllMenuItems((prev) =>
        prev.map((m) => (m.id === item.id ? { ...m, image_url: '' } : m))
      );
      alert(`ลบรูปภาพเมนู "${item.name}" เรียบร้อยแล้ว`);
    } catch (e: any) {
      console.error('Admin remove menu image error:', e);
      alert(`เกิดข้อผิดพลาดในการลบรูปภาพเมนู: ${e.message || 'ไม่สามารถลบได้'}`);
    }
  };

  const handleToggleShopOpen = async (shop: Shop) => {
    const nextOpen = !(shop.is_open ?? true);
    try {
      await updateDoc(doc(db, 'shops', shop.id), { is_open: nextOpen });
      soundAlert.playShopToggleSound(nextOpen);
      setShops((prev) =>
        prev.map((s) => (s.id === shop.id ? { ...s, is_open: nextOpen } : s))
      );
    } catch (e: any) {
      console.warn('Toggle shop open error:', e);
      alert(`ไม่สามารถเปลี่ยนสถานะร้านได้: ${e.message || 'เกิดข้อผิดพลาด'}`);
    }
  };

  const handleGrantMerchantRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForMerchant || !newShopName) return;

    const shopId = `shop_${Date.now()}`;

    try {
      const batch = writeBatch(db);
      // Create the shop and its authority atomically.
      batch.set(doc(db, 'shops', shopId), {
        id: shopId,
        owner_uid: selectedUserForMerchant.uid,
        name: newShopName.trim(),
        phone: newShopPhone.trim() || selectedUserForMerchant.phone || '0898765432',
        is_open: true,
        image_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&auto=format&fit=crop&q=80',
        created_at: new Date().toISOString(),
      });

      // 2. Update user role
      batch.update(doc(db, 'users', selectedUserForMerchant.uid), {
        role: 'merchant',
        shop_id: shopId,
      });

      batch.set(doc(db, 'access', selectedUserForMerchant.uid), { role: 'merchant', shop_id: shopId });
      await batch.commit();
      soundAlert.playAdminPromoteSound().catch(() => {});
      setSelectedUserForMerchant(null);
      setNewShopName('');
      setNewShopPhone('');
      alert(`แต่งตั้งให้ ${selectedUserForMerchant.display_name} เป็นร้านค้าเรียบร้อยแล้ว!`);
    } catch (e: any) {
      console.error('Grant merchant error:', e);
      alert(`แต่งตั้งร้านค้าไม่สำเร็จ: ${e.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล'}`);
    }
  };

  const handleRevokeRole = async (userId: string) => {
    if (!confirm('ต้องการลดระดับผู้ใช้นี้กลับเป็นลูกค้าทั่วไปหรือไม่?')) return;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'users', userId), { role: 'customer', shop_id: null });
      batch.set(doc(db, 'access', userId), { role: 'customer' });
      await batch.commit();
      alert('ลดระดับผู้ใช้เป็นลูกค้าทั่วไปเรียบร้อยแล้ว');
    } catch (e: any) {
      console.error('Revoke role error:', e);
      alert(`ลดระดับผู้ใช้ไม่สำเร็จ: ${e.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล'}`);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (userId === currentUser.uid) {
      alert('ไม่สามารถลบบัญชีของตัวเองได้');
      return;
    }
    if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบบัญชี "${userName}" ออกจากระบบ? ข้อมูลจะถูกลบถาวร`)) {
      return;
    }
    try {
      const targetUser = users.find((u) => u.uid === userId);
      const deleteAccount = httpsCallable<{ uid: string }, { success: boolean }>(functions, 'deleteUserAccount');
      await deleteAccount({ uid: userId });
      
      // If the deleted user owned a shop, prompt to delete the shop as well
      if (targetUser?.shop_id) {
        if (confirm(`ผู้ใช้นี้เป็นเจ้าของร้านค้าด้วย ต้องการลบข้อมูลร้านค้าและเมนูอาหารของเขาออกจากระบบด้วยหรือไม่?`)) {
          await handleDeleteShop(targetUser.shop_id, targetUser.display_name, userId);
        }
      }

      setUsers((prev) => prev.filter((u) => u.uid !== userId));
      alert(`ลบบัญชี "${userName}" เรียบร้อยแล้ว`);
    } catch (e: any) {
      console.error('Delete user error:', e);
      alert(`ลบบัญชีไม่สำเร็จ: ${e.message || 'เกิดข้อผิดพลาด'}`);
    }
  };

  const handleDeleteShop = async (shopId: string, shopName: string, deletedUserId?: string) => {
    if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบร้านค้า "${shopName}" ออกจากระบบ?\n\n*ข้อควรระวัง: ข้อมูลร้านค้า, เมนูอาหาร, ออเดอร์ และยอดขายทั้งหมดของร้านนี้จะถูกลบออกอย่างถาวร*`)) {
      return;
    }

    try {
      // 1. Delete shop document
      await deleteDoc(doc(db, 'shops', shopId));

      // 2. Delete all menu items belonging to this shop
      const menuSnap = await getDocs(collection(db, 'menu_items'));
      for (const mDoc of menuSnap.docs) {
        if (mDoc.data().shop_id === shopId) {
          await deleteDoc(doc(db, 'menu_items', mDoc.id));
        }
      }

      // 3. Delete all orders and messages belonging to this shop
      const ordersSnap = await getDocs(collection(db, 'orders'));
      for (const oDoc of ordersSnap.docs) {
        if (oDoc.data().shop_id === shopId) {
          try {
            const msgsSnap = await getDocs(collection(db, 'orders', oDoc.id, 'messages'));
            for (const mDoc of msgsSnap.docs) {
              await deleteDoc(doc(db, 'orders', oDoc.id, 'messages', mDoc.id));
            }
          } catch (_) {}
          await deleteDoc(doc(db, 'orders', oDoc.id));
        }
      }

      // 4. Delete reviews belonging to this shop
      const reviewsSnap = await getDocs(collection(db, 'shop_reviews'));
      for (const rDoc of reviewsSnap.docs) {
        if (rDoc.data().shop_id === shopId) {
          await deleteDoc(doc(db, 'shop_reviews', rDoc.id));
        }
      }

      // 5. Delete credit transactions belonging to this shop
      const transSnap = await getDocs(collection(db, 'credit_transactions'));
      for (const tDoc of transSnap.docs) {
        if (tDoc.data().shop_id === shopId) {
          await deleteDoc(doc(db, 'credit_transactions', tDoc.id));
        }
      }

      // 6. Demote owner user back to customer if still active
      const ownerUser = users.find((u) => u.shop_id === shopId);
      if (ownerUser && ownerUser.uid !== deletedUserId) {
        await setDoc(doc(db, 'access', ownerUser.uid), { role: 'customer' });
        await updateDoc(doc(db, 'users', ownerUser.uid), {
          role: 'customer',
          shop_id: null,
        });
        setUsers((prev) =>
          prev.map((u) => (u.uid === ownerUser.uid ? { ...u, role: 'customer', shop_id: undefined } : u))
        );
      }

      setShops((prev) => prev.filter((s) => s.id !== shopId));
      setOrders((prev) => prev.filter((o) => o.shop_id !== shopId));
      alert(`ลบร้านค้า "${shopName}" เมนูอาหาร และออเดอร์ที่เกี่ยวข้องออกจากระบบเรียบร้อยแล้ว!`);
    } catch (e: any) {
      console.error('Delete shop error:', e);
      alert(`ลบร้านค้าไม่สำเร็จ: ${e.message || 'เกิดข้อผิดพลาด'}`);
    }
  };

  // Platform GP Settings Save Handler
  const handleSaveGpSettings = async () => {
    setIsSavingGp(true);
    try {
      await setDoc(
        doc(db, 'system_settings', 'general'),
        {
          gp_enabled: gpEnabled,
          gp_percent: Number(gpPercent) || 5,
          updated_at: serverTimestamp(),
        },
        { merge: true }
      );

      // If GP is enabled, close any shops that have 0 or negative credit balance
      if (gpEnabled) {
        const depletedShops = shops.filter((s) => (s.credit_balance ?? 0) <= 0 && s.is_open === true);
        for (const s of depletedShops) {
          try {
            await updateDoc(doc(db, 'shops', s.id), { is_open: false });
          } catch (_) {}
        }
      }

      alert('บันทึกการตั้งค่าระบบ GP สำเร็จแล้ว');
    } catch (err: any) {
      console.error('Save GP settings error:', err);
      alert(`บันทึกการตั้งค่า GP ไม่สำเร็จ: ${err.message || 'สิทธิ์ไม่เพียงพอ'}`);
    } finally {
      setIsSavingGp(false);
    }
  };

  // Top-Up Merchant Credit Submit Handler
  const handleTopUpCreditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShopForCredit) return;
    const num = parseFloat(topupAmount);
    if (isNaN(num) || num <= 0) {
      setCreditError('กรุณาระบุจำนวนเงินที่ถูกต้อง (มากกว่า 0)');
      return;
    }

    const finalAmount = topupType === 'deduct' ? -num : num;
    setIsSubmittingCredit(true);
    setCreditError(null);

    try {
      let newBal = 0;
      let willClose = false;

      try {
        const callTopup = httpsCallable<
          { shopId: string; amount: number; note?: string },
          { success: boolean; newBalance: number; is_open?: boolean }
        >(functions, 'topUpMerchantCredit');

        const res = await callTopup({
          shopId: selectedShopForCredit.id,
          amount: finalAmount,
          note: topupNote.trim() || (topupType === 'topup' ? 'แอดมินเติมเครดิต' : 'แอดมินปรับลดยอดเครดิต'),
        });

        if (res.data?.success) {
          newBal = res.data.newBalance ?? 0;
          willClose = gpEnabled && newBal <= 0;
        } else {
          throw new Error('Callable returned failure');
        }
      } catch (callableErr: any) {
        console.warn('topUpMerchantCredit callable fallback, attempting direct Firestore transaction:', callableErr);
        const shopRef = doc(db, 'shops', selectedShopForCredit.id);
        const txDocRef = doc(collection(db, 'credit_transactions'));
        
        await runTransaction(db, async (transaction) => {
          const shopSnap = await transaction.get(shopRef);
          if (!shopSnap.exists()) throw new Error('ไม่พบข้อมูลร้านค้า');
          const currentBal = typeof shopSnap.data().credit_balance === 'number' ? shopSnap.data().credit_balance : 0;
          newBal = Math.round((currentBal + finalAmount) * 100) / 100;
          willClose = gpEnabled && newBal <= 0;

          transaction.update(shopRef, {
            credit_balance: newBal,
            ...(willClose ? { is_open: false } : {}),
          });

          transaction.set(txDocRef, {
            id: txDocRef.id,
            shop_id: selectedShopForCredit.id,
            shop_name: selectedShopForCredit.name || '',
            amount: finalAmount,
            type: finalAmount > 0 ? 'topup' : 'deduct',
            note: topupNote.trim() || (topupType === 'topup' ? 'แอดมินเติมเครดิต' : 'แอดมินปรับลดยอดเครดิต'),
            created_by: currentUser.uid,
            created_at: serverTimestamp(),
          });
        });
      }

      soundAlert.playAdminTopupSound().catch(() => {});
      
      // Ensure local shop state reflects new credit and status
      setShops((prev) =>
        prev.map((s) =>
          s.id === selectedShopForCredit.id
            ? { ...s, credit_balance: newBal, is_open: willClose ? false : s.is_open }
            : s
        )
      );

      alert(
        `${topupType === 'topup' ? 'เติมเครดิต' : 'ปรับลดเครดิต'} ให้ร้าน "${selectedShopForCredit.name}" สำเร็จ!\nยอดคงเหลือใหม่: ฿${newBal.toFixed(2)}${
          willClose ? '\n\nยอดเครดิตไม่เพียงพอ ระบบได้ทำการปิดร้านค้านี้ชั่วคราวอัตโนมัติ' : ''
        }`
      );
      setSelectedShopForCredit(null);
      setTopupAmount('100');
      setTopupNote('');
    } catch (err: any) {
      console.error('Top-up credit error:', err);
      setCreditError(err.message || 'เกิดข้อผิดพลาดในการทำรายการเครดิต');
    } finally {
      setIsSubmittingCredit(false);
    }
  };

  // Handle Delete Review (Recalculates shop average rating and count)
  const handleDeleteReview = async (reviewId: string, shopId: string, reviewerName: string) => {
    if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบรีวิวนี้จากคุณ "${reviewerName}" ออกจากระบบ?\n\n*ระบบจะทำการคำนวณคะแนนดาวเฉลี่ยของร้านค้าใหม่ให้อัตโนมัติ*`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'shop_reviews', reviewId));

      const remainingReviews = allShopReviews.filter((r) => r.id !== reviewId && r.shop_id === shopId && Number.isInteger(r.rating) && r.rating >= 1 && r.rating <= 5);
      const newCount = remainingReviews.length;
      const newRating = newCount > 0
        ? Math.round((remainingReviews.reduce((sum, r) => sum + r.rating, 0) / newCount) * 10) / 10
        : 0;

      await updateDoc(doc(db, 'shops', shopId), {
        rating: newRating,
        review_count: newCount,
      });

      setShops((prev) =>
        prev.map((s) => (s.id === shopId ? { ...s, rating: newRating, review_count: newCount } : s))
      );

      if (selectedShopForReviews && selectedShopForReviews.id === shopId) {
        setSelectedShopForReviews((prev) => (prev ? { ...prev, rating: newRating, review_count: newCount } : null));
      }

      alert(`ลบรีวิวเรียบร้อยแล้ว!\nคะแนนเฉลี่ยใหม่ของร้านคือ:  ${newRating > 0 ? newRating.toFixed(1) : '0.0'} (${newCount} รีวิว)`);
    } catch (e) {
      console.error('Delete review error:', e);
      alert('เกิดข้อผิดพลาดในการลบรีวิว');
    }
  };

  // Handle Save Shop Details (Admin)
  const handleSaveShopDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShopForEdit) return;

    try {
      setIsSavingShopDetails(true);
      const updates = {
        name: editShopName.trim(),
        phone: editShopPhone.trim(),
        promptpay_number: editShopPromptpay.trim(),
        address_detail: editShopAddress.trim(),
        category: editShopCategory,
        delivery_fee: Number(editShopDeliveryFee) || 0,
      };

      await updateDoc(doc(db, 'shops', selectedShopForEdit.id), updates);
      setShops((prev) =>
        prev.map((s) => (s.id === selectedShopForEdit.id ? { ...s, ...updates } : s))
      );

      alert(`อัปเดตข้อมูลร้าน "${editShopName}" สำเร็จแล้ว!`);
      setSelectedShopForEdit(null);
    } catch (e) {
      console.error('Update shop details error:', e);
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูลร้าน');
    } finally {
      setIsSavingShopDetails(false);
    }
  };

  // Handle Create Merchant Account (Admin)
  const handleCreateMerchantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateMerchantError('');

    if (!createShopName.trim()) {
      setCreateMerchantError('กรุณากรอกชื่อร้านค้า');
      return;
    }
    if (!createMerchantEmail.trim() || !createMerchantEmail.includes('@')) {
      setCreateMerchantError('กรุณากรอกอีเมลร้านค้าที่ถูกต้อง');
      return;
    }
    if (createMerchantPassword.length < 6) {
      setCreateMerchantError('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
      return;
    }

    setIsCreatingMerchant(true);
    try {
      const createMerchantCall = httpsCallable<
        {
          email: string;
          password: string;
          shopName: string;
          shopPhone?: string;
          promptpayNumber?: string;
          addressDetail?: string;
          deliveryFee?: number;
          category?: string;
        },
        { success: boolean; uid: string; shopId: string }
      >(functions, 'createMerchantAccount');

      const res = await createMerchantCall({
        email: createMerchantEmail.trim(),
        password: createMerchantPassword,
        shopName: createShopName.trim(),
        shopPhone: createShopPhone.trim(),
        promptpayNumber: createShopPromptpay.trim(),
        addressDetail: createShopAddress.trim(),
        deliveryFee: Number(createShopDeliveryFee) || 0,
        category: createShopCategory,
      });

      if (res.data?.success) {
        soundAlert.playAdminPromoteSound().catch(() => {});
        alert(
          `สร้างบัญชีร้านค้า "${createShopName}" สำเร็จแล้ว!\n\n` +
          `อีเมล: ${createMerchantEmail.trim()}\n` +
          `รหัสผ่าน: ${createMerchantPassword}\n\n` +
          `ร้านค้าสามารถนำข้อมูลนี้ไปเข้าสู่ระบบเพื่อจัดการเมนูและรับออเดอร์ได้ทันที`
        );
        setShowCreateMerchantModal(false);
        setCreateShopName('');
        setCreateMerchantEmail('');
        setCreateMerchantPassword('');
        setCreateShopPhone('');
        setCreateShopPromptpay('');
        setCreateShopAddress('');
        setCreateShopDeliveryFee('0');
      } else {
        throw new Error('Callable returned failure');
      }
    } catch (err: any) {
      console.error('Create merchant account error:', err);
      setCreateMerchantError(err.message || 'เกิดข้อผิดพลาดในการสร้างบัญชีร้านค้า');
    } finally {
      setIsCreatingMerchant(false);
    }
  };

  // Handle Open Merchant Credentials Modal
  const handleOpenCredentialsModal = async (shop: Shop) => {
    setSelectedShopForCredentials(shop);
    setMerchantCredEmail(shop.merchant_email || '');
    setMerchantCredPassword('');
    setEditCredEmail(shop.merchant_email || '');
    setEditCredPassword('');
    setCredError('');
    setCredSuccess('');
    setShowCredPassword(false);
    setIsFetchingCreds(true);

    try {
      const getCreds = httpsCallable<{ shopId: string }, { email: string; password: string }>(
        functions,
        'getMerchantCredentials'
      );
      const res = await getCreds({ shopId: shop.id });
      if (res.data) {
        setMerchantCredEmail(res.data.email || shop.merchant_email || '');
        setEditCredEmail(res.data.email || shop.merchant_email || '');
        setMerchantCredPassword(res.data.password || '');
      }
    } catch (err: any) {
      console.warn('getMerchantCredentials error:', err);
      if (shop.merchant_email) {
        setMerchantCredEmail(shop.merchant_email);
        setEditCredEmail(shop.merchant_email);
      }
    } finally {
      setIsFetchingCreds(false);
    }
  };

  // Handle Save / Update Merchant Credentials
  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShopForCredentials || isSavingCreds) return;
    setCredError('');
    setCredSuccess('');

    const targetEmail = editCredEmail.trim();
    const targetPassword = editCredPassword.trim();

    if (!targetEmail && !targetPassword) {
      setCredError('กรุณากรอกอีเมลหรือรหัสผ่านที่ต้องการแก้ไข');
      return;
    }
    if (targetEmail && (!targetEmail.includes('@') || !targetEmail.includes('.'))) {
      setCredError('รูปแบบอีเมลไม่ถูกต้อง');
      return;
    }
    if (targetPassword && targetPassword.length < 6) {
      setCredError('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
      return;
    }

    setIsSavingCreds(true);
    try {
      const updateCreds = httpsCallable<
        { shopId: string; email?: string; password?: string },
        { success: boolean; email: string; password: string }
      >(functions, 'updateMerchantCredentials');

      const res = await updateCreds({
        shopId: selectedShopForCredentials.id,
        email: targetEmail || undefined,
        password: targetPassword || undefined,
      });

      if (res.data?.success) {
        if (targetEmail) setMerchantCredEmail(targetEmail);
        if (targetPassword) {
          setMerchantCredPassword(targetPassword);
          setEditCredPassword('');
        }
        setCredSuccess('บันทึกข้อมูลเข้าสู่ระบบเรียบร้อยแล้ว! ร้านค้าสามารถนำข้อมูลนี้ไปเข้าสู่ระบบได้ทันที');
        soundAlert.playOrderCompletedSound().catch(() => {});
      } else {
        throw new Error('บันทึกข้อมูลไม่สำเร็จ');
      }
    } catch (err: any) {
      console.error('Update merchant credentials error:', err);
      setCredError(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setIsSavingCreds(false);
    }
  };

  const handleCopyCred = (text: string, field: 'email' | 'password') => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedCredField(field);
      setTimeout(() => setCopiedCredField(null), 2000);
    }).catch(() => {});
  };

  // Handle Add Menu Item by Admin
  const handleAddMenuItemByAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingMenuRef.current || isSubmittingMenu) return;
    if (!selectedShopForMenus || !newMenuName.trim() || !newMenuPrice.trim()) return;

    isSubmittingMenuRef.current = true;
    setIsSubmittingMenu(true);

    try {
      const newItemId = `m_${Date.now()}`;
      const validOptions = newMenuOptions
        .filter((o) => o.name.trim())
        .map((o) => ({ name: o.name.trim(), price: Number(o.price) || 0 }));

      const newItemData: MenuItem = {
        id: newItemId,
        shop_id: selectedShopForMenus.id,
        name: newMenuName.trim(),
        price: parseFloat(newMenuPrice) || 50,
        category: newMenuCategory,
        image_url: newMenuImage.trim() || '',
        options: validOptions,
        is_available: true,
        created_at: new Date().toISOString() as any,
      };

      await setDoc(doc(db, 'menu_items', newItemId), newItemData);

      setNewMenuName('');
      setNewMenuPrice('');
      setNewMenuImage('');
      setNewMenuOptions([]);
      setIsAddingNewMenu(false);
      alert('เพิ่มเมนูอาหารให้ร้านค้าสำเร็จแล้ว!');
    } catch (e: any) {
      console.error('Admin add menu item error:', e);
      alert(`เกิดข้อผิดพลาดในการเพิ่มเมนู: ${e?.message || ''}`);
    } finally {
      isSubmittingMenuRef.current = false;
      setIsSubmittingMenu(false);
    }
  };

  // Handle Save Edit Menu Item Details
  const handleSaveEditMenuItem = async () => {
    if (!editingMenuItem || !editMenuItemName.trim() || !editMenuItemPrice.trim()) return;
    try {
      const validOptions = editMenuItemOptions
        .filter((o) => o.name.trim())
        .map((o) => ({ name: o.name.trim(), price: Number(o.price) || 0 }));

      const updatedData = {
        name: editMenuItemName.trim(),
        price: parseFloat(editMenuItemPrice) || 0,
        category: editMenuItemCategory,
        options: validOptions,
      };
      await updateDoc(doc(db, 'menu_items', editingMenuItem.id), updatedData);
      setAllMenuItems((prev) =>
        prev.map((m) => (m.id === editingMenuItem.id ? { ...m, ...updatedData } : m))
      );
      setEditingMenuItem(null);
      alert('บันทึกการแก้ไขเมนูเรียบร้อยแล้ว!');
    } catch (e) {
      console.error('Save edit menu item error:', e);
      alert('เกิดข้อผิดพลาดในการแก้ไขเมนู');
    }
  };

  const orderCharges = chargedByOrder(creditTransactions);

  // Order Log Helper Functions
  const getOrderDate = (o: Order): Date | null => {
    if (!o.created_at) return null;
    if (o.created_at.seconds) return new Date(o.created_at.seconds * 1000);
    if (typeof o.created_at === 'string') return new Date(o.created_at);
    if (o.created_at instanceof Date) return o.created_at;
    return null;
  };

  const isSameDay = (d1: Date, d2: Date) => {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  const activeAdminOrdersCount = orders.filter(
    (o) => o.status !== 'completed' && o.status !== 'cancelled'
  ).length;
  const completedAdminOrdersCount = orders.filter((o) => o.status === 'completed').length;
  const cancelledAdminOrdersCount = orders.filter((o) => o.status === 'cancelled').length;
  const orphanedOrdersCount = orders.filter((o) => !shops.some((s) => s.id === o.shop_id)).length;

  const filteredAdminOrders = orders.filter((o) => {
    // 1. Status filter
    if (orderStatusFilter === 'active') {
      if (o.status === 'completed' || o.status === 'cancelled') return false;
    } else if (orderStatusFilter !== 'all' && o.status !== orderStatusFilter) {
      return false;
    }

    // 2. Shop filter
    if (orderShopFilter !== 'all' && o.shop_id !== orderShopFilter) {
      return false;
    }

    // 3. Search query
    if (orderSearchQuery.trim()) {
      const q = orderSearchQuery.toLowerCase();
      const matchId = o.id.toLowerCase().includes(q);
      const matchCustomer = o.customer_name?.toLowerCase().includes(q);
      const matchPhone = o.customer_phone?.includes(q);
      const matchShop = o.shop_name?.toLowerCase().includes(q);
      const matchItem = o.items?.some((it) => it.name.toLowerCase().includes(q));
      if (!matchId && !matchCustomer && !matchPhone && !matchShop && !matchItem) {
        return false;
      }
    }

    // 4. Date filter
    const orderDate = getOrderDate(o);
    if (!orderDate) return true;

    const today = new Date();
    if (orderDatePreset === 'today') {
      return isSameDay(orderDate, today);
    } else if (orderDatePreset === 'yesterday') {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return isSameDay(orderDate, yesterday);
    } else if (orderDatePreset === '7days') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return orderDate >= sevenDaysAgo;
    } else if (orderDatePreset === 'custom' && orderCustomDate) {
      const [year, month, day] = orderCustomDate.split('-').map(Number);
      return (
        orderDate.getFullYear() === year &&
        orderDate.getMonth() === month - 1 &&
        orderDate.getDate() === day
      );
    }

    return true;
  });

  const filteredOrdersTotalGMV = filteredAdminOrders
    .filter((o) => o.status === 'completed')
    .reduce((sum, o) => sum + (o.food_subtotal || 0), 0);
  const filteredOrdersAdminGP = filteredAdminOrders.filter(o => o.status === 'completed').reduce((sum, o) => sum + (orderCharges.get(o.id) ?? 0), 0);

  const handleExportCSV = () => {
    if (!creditLedgerReady) {
      alert('ยังโหลดรายการเครดิตไม่สำเร็จ กรุณาลองใหม่ก่อนส่งออกรายงาน');
      return;
    }
    if (filteredAdminOrders.length === 0) {
      alert('ไม่มีข้อมูลออเดอร์ในตัวกรองนี้');
      return;
    }

    const headers = [
      'รหัสออเดอร์',
      'วันที่และเวลา',
      'ร้านค้า',
      'ลูกค้า',
      'เบอร์โทรลูกค้า',
      'ยอดรวมทั้งหมด(บาท)',
      'ค่าอาหาร(บาท)',
      'ค่าส่ง(บาท)',
      'ค่าบริการหักเครดิตจริง(บาท)',
      'วิธีชำระ',
      'สถานะ',
      'ที่อยู่จัดส่ง',
      'รายการอาหาร'
    ];

    const rows = filteredAdminOrders.map((o) => {
      const d = getOrderDate(o);
      const dateStr = d
        ? d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) +
          ' ' +
          d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
        : '-';
      const itemsStr = o.items?.map((it) => `${it.quantity}x ${it.name}`).join(' | ') || '';

      return [
        `#${formatOrderCode(o)}`,
        `"${dateStr}"`,
        `"${o.shop_name || '-'}"`,
        `"${o.customer_name || '-'}"`,
        `"${o.customer_phone || '-'}"`,
        o.total_amount || 0,
        o.food_subtotal || 0,
        (o.delivery_fee ?? 0),
        (orderCharges.get(o.id) ?? 0),
        `"${o.payment_method === 'cash' ? 'เงินสด' : 'สแกน'}"`,
        `"${o.status}"`,
        `"${(o.delivery_address || '').replace(/"/g, '""')}"`,
        `"${itemsStr.replace(/"/g, '""')}"`
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `huai_chan_orders_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Storage & Chat Maintenance Handlers
  const getOrdersForCleanup = (days: number | 'all') => {
    return orders.filter((o) => {
      if (o.status !== 'completed' && o.status !== 'cancelled') return false;
      if (days === 'all') return true;
      const orderDate = getOrderDate(o);
      if (!orderDate) return false;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      return orderDate < cutoff;
    });
  };

  const handleCleanupOldChats = async (days: number | 'all') => {
    const targetOrders = getOrdersForCleanup(days);
    if (targetOrders.length === 0) {
      alert('ไม่พบออเดอร์ที่จบแล้วในช่วงเวลาที่เลือก');
      return;
    }

    const label = days === 'all' ? 'ที่จบแล้วทั้งหมด' : `ที่จบแล้วและเก่ากว่า ${days} วัน`;
    const confirmMsg = `ยืนยันการล้างข้อความแชทของออเดอร์${label} จำนวน ${targetOrders.length} ออเดอร์หรือไม่?\n\n*หมายเหตุ: ข้อมูลยอดขาย บิลคำสั่งซื้อ และประวัติทางบัญชีจะยังคงอยู่ถาวร 100% (ระบบจะลบเฉพาะข้อความแชท)*`;

    if (!confirm(confirmMsg)) return;

    setIsCleaningChats(true);
    setCleanupStatusMessage(`กำลังเริ่มล้างข้อความแชท (${targetOrders.length} ออเดอร์)...`);

    let totalDeletedMessages = 0;
    let processedOrders = 0;

    try {
      for (const ord of targetOrders) {
        try {
          const msgsRef = collection(db, 'orders', ord.id, 'messages');
          const msgsSnap = await getDocs(msgsRef);
          for (const mDoc of msgsSnap.docs) {
            await deleteDoc(doc(db, 'orders', ord.id, 'messages', mDoc.id));
            totalDeletedMessages++;
          }
        } catch (subErr) {
          console.warn(`Error cleaning chats for order ${ord.id}:`, subErr);
        }
        processedOrders++;
        if (processedOrders % 5 === 0 || processedOrders === targetOrders.length) {
          setCleanupStatusMessage(`กำลังดำเนินการ... (${processedOrders}/${targetOrders.length} ออเดอร์)`);
        }
      }

      alert(`ล้างข้อความแชทเก่าสำเร็จ!\n- ลบข้อความแชทเก่าไปทั้งหมด: ${totalDeletedMessages} ข้อความ\n- ดำเนินการใน: ${processedOrders} ออเดอร์\n\nข้อมูลยอดขาย บิลคำสั่งซื้อ และประวัติบัญชี 100% ยังคงปลอดภัยครบถ้วน`);
      setShowMaintenanceModal(false);
    } catch (err) {
      console.error('Cleanup chats error:', err);
      alert('เกิดข้อผิดพลาดในการล้างข้อความแชท กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsCleaningChats(false);
      setCleanupStatusMessage(null);
    }
  };

  const handleDeleteOrder = async (orderId: string, orderCode?: string) => {
    if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบออเดอร์ #${orderCode || orderId} ออกจากระบบ?\n\n*ยอดขายและประวัติของออเดอร์นี้จะถูกลบอย่างถาวร*`)) {
      return;
    }
    try {
      // 1. Delete messages
      const msgsSnap = await getDocs(collection(db, 'orders', orderId, 'messages'));
      for (const mDoc of msgsSnap.docs) {
        await deleteDoc(doc(db, 'orders', orderId, 'messages', mDoc.id));
      }
      // 2. Delete review if exists
      const reviewsSnap = await getDocs(query(collection(db, 'shop_reviews'), where('order_id', '==', orderId)));
      for (const rDoc of reviewsSnap.docs) {
        await deleteDoc(doc(db, 'shop_reviews', rDoc.id));
      }
      // 3. Delete related credit transactions
      const transSnap = await getDocs(query(collection(db, 'credit_transactions'), where('order_id', '==', orderId)));
      for (const tDoc of transSnap.docs) {
        await deleteDoc(doc(db, 'credit_transactions', tDoc.id));
      }
      // 4. Delete order
      await deleteDoc(doc(db, 'orders', orderId));
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      alert(`ลบออเดอร์ #${orderCode || orderId} เรียบร้อยแล้ว!`);
    } catch (e: any) {
      console.error('Delete order error:', e);
      alert(`ลบออเดอร์ไม่สำเร็จ: ${e.message || 'เกิดข้อผิดพลาด'}`);
    }
  };

  const handleCleanupOrphanedOrders = async () => {
    const existingShopIds = new Set(shops.map((s) => s.id));
    const orphaned = orders.filter((o) => !existingShopIds.has(o.shop_id));
    const transSnap = await getDocs(collection(db, 'credit_transactions'));
    const orphanedTrans = transSnap.docs.filter((tDoc) => {
      const data = tDoc.data();
      return !existingShopIds.has(data.shop_id) || (data.order_id && !orders.some((o) => o.id === data.order_id));
    });

    if (orphaned.length === 0 && orphanedTrans.length === 0) {
      alert('ไม่พบออเดอร์หรือรายการค่าบริการตกค้าง');
      return;
    }
    if (!confirm(`พบข้อมูลตกค้าง:\n- ออเดอร์ของร้านที่ถูกลบ: ${orphaned.length} บิล\n- รายการค่าบริการ/เครดิตตกค้าง: ${orphanedTrans.length} รายการ\n\nยืนยันการล้างข้อมูลเหล่านี้และรีเซ็ตยอดขายให้เป็น 0 หรือไม่?`)) {
      return;
    }
    setIsCleaningChats(true);
    setCleanupStatusMessage(`กำลังล้างข้อมูลตกค้าง (${orphaned.length} บิล, ${orphanedTrans.length} ธุรกรรม)...`);
    try {
      for (const ord of orphaned) {
        try {
          const msgsSnap = await getDocs(collection(db, 'orders', ord.id, 'messages'));
          for (const mDoc of msgsSnap.docs) {
            await deleteDoc(doc(db, 'orders', ord.id, 'messages', mDoc.id));
          }
        } catch (_) {}
        await deleteDoc(doc(db, 'orders', ord.id));
      }
      for (const tDoc of orphanedTrans) {
        await deleteDoc(doc(db, 'credit_transactions', tDoc.id));
      }
      setOrders((prev) => prev.filter((o) => existingShopIds.has(o.shop_id)));
      alert(`ลบข้อมูลตกค้างเรียบร้อยแล้ว!`);
      setShowMaintenanceModal(false);
    } catch (e: any) {
      console.error('Cleanup orphaned orders error:', e);
      alert(`เกิดข้อผิดพลาด: ${e.message || 'ไม่สามารถดำเนินการได้'}`);
    } finally {
      setIsCleaningChats(false);
      setCleanupStatusMessage(null);
    }
  };

  const handleResetAllOrders = async () => {
    if (!confirm(`ยืนยันการล้างข้อมูลออเดอร์ ยอดขาย และประวัติค่าบริการทั้งหมดหรือไม่?\n\n*ข้อควรระวัง: บิลคำสั่งซื้อ ยอดขาย รายการหักค่าบริการ (GP) และรีวิวทดสอบทั้งหมดจะถูกรีเซ็ตกลับเป็น 0 เพื่อเตรียมเปิดใช้งานระบบจริง*`)) {
      return;
    }
    setIsCleaningChats(true);
    setCleanupStatusMessage(`กำลังล้างออเดอร์และรีเซ็ตยอดขายทั้งหมด...`);
    try {
      // 1. Delete all orders and messages
      const allOrdersSnap = await getDocs(collection(db, 'orders'));
      for (const ord of allOrdersSnap.docs) {
        try {
          const msgsSnap = await getDocs(collection(db, 'orders', ord.id, 'messages'));
          for (const mDoc of msgsSnap.docs) {
            await deleteDoc(doc(db, 'orders', ord.id, 'messages', mDoc.id));
          }
        } catch (_) {}
        await deleteDoc(doc(db, 'orders', ord.id));
      }

      // 2. Delete all shop reviews
      const reviewsSnap = await getDocs(collection(db, 'shop_reviews'));
      for (const rDoc of reviewsSnap.docs) {
        await deleteDoc(doc(db, 'shop_reviews', rDoc.id));
      }

      // 3. Delete all credit transactions (GP & deductions)
      const transSnap = await getDocs(collection(db, 'credit_transactions'));
      for (const tDoc of transSnap.docs) {
        await deleteDoc(doc(db, 'credit_transactions', tDoc.id));
      }

      // 4. Reset counter and checkout requests
      try {
        await setDoc(doc(db, 'system_settings', 'order_counter'), {
          last_order_number: 1000,
          updated_at: serverTimestamp(),
        }, { merge: true });
      } catch (_) {}

      try {
        const idempSnap = await getDocs(collection(db, '_checkout_requests'));
        for (const iDoc of idempSnap.docs) {
          await deleteDoc(doc(db, '_checkout_requests', iDoc.id));
        }
      } catch (_) {}

      setOrders([]);
      alert('ล้างข้อมูลออเดอร์ ยอดขาย และรายได้ค่าบริการทดสอบทั้งหมดเรียบร้อยแล้ว!\n\nทุกยอดกลับมาเป็น 0.00 ฿ พร้อมเริ่มระบบใหม่');
      setShowMaintenanceModal(false);
    } catch (e: any) {
      console.error('Reset all orders error:', e);
      alert(`เกิดข้อผิดพลาด: ${e.message || 'ไม่สามารถดำเนินการได้'}`);
    } finally {
      setIsCleaningChats(false);
      setCleanupStatusMessage(null);
    }
  };

  const handleResetCreditTransactions = async () => {
    if (!confirm('ยืนยันการล้างประวัติการหักค่าบริการ (GP) และธุรกรรมเครดิตทั้งหมดหรือไม่?\n\n*ยอด "รายได้ค่าบริการระบบ" จะถูกรีเซ็ตกลับเป็น 0.00 ฿ ทันที*')) {
      return;
    }
    setIsCleaningChats(true);
    setCleanupStatusMessage('กำลังล้างประวัติค่าบริการและธุรกรรมเครดิต...');
    try {
      const transSnap = await getDocs(collection(db, 'credit_transactions'));
      for (const tDoc of transSnap.docs) {
        await deleteDoc(doc(db, 'credit_transactions', tDoc.id));
      }
      alert(`ล้างประวัติค่าบริการและธุรกรรมเครดิต (${transSnap.size} รายการ) เรียบร้อยแล้ว!\n\nยอดรายได้ค่าบริการระบบเป็น 0.00 ฿`);
      setShowMaintenanceModal(false);
    } catch (e: any) {
      console.error('Reset credit transactions error:', e);
      alert(`เกิดข้อผิดพลาด: ${e.message || 'ไม่สามารถดำเนินการได้'}`);
    } finally {
      setIsCleaningChats(false);
      setCleanupStatusMessage(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Admin Header */}
      <div className="bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 rounded-3xl p-5 text-white shadow-xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30 text-2xl">
            
          </div>
          <div>
            <span className="text-[10px] bg-rose-500/30 text-rose-300 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
              Super Admin Panel
            </span>
            <h1 className="text-xl font-black mt-0.5">huaychan • หลังบ้าน</h1>
            <p className="text-xs text-gray-300">ดูแลร้านค้า ติดตามออเดอร์ และจัดการเครดิตกับค่าบริการระบบ</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 p-1 rounded-2xl gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex-1 min-w-[100px] py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition ${
            activeTab === 'analytics' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
          }`}
        >
          <TrendingUp className="w-4 h-4 text-rose-500" />
          <span>สรุปยอดขาย</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`flex-1 min-w-[100px] py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition ${
            activeTab === 'users' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
          }`}
        >
          <Users className="w-4 h-4 text-blue-500" />
          <span>จัดการผู้ใช้ ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('shops')}
          className={`flex-1 min-w-[100px] py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition ${
            activeTab === 'shops' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
          }`}
        >
          <Store className="w-4 h-4 text-orange-500" />
          <span>จัดการร้านค้า ({shops.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          className={`flex-1 min-w-[110px] py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition ${
            activeTab === 'orders' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
          }`}
        >
          <Eye className="w-4 h-4 text-amber-500" />
          <span>มอนิเตอร์ & Log ({activeAdminOrdersCount > 0 ? `${activeAdminOrdersCount} สด` : orders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('settlement')}
          className={`flex-1 min-w-[100px] py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition ${
            activeTab === 'settlement' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
          }`}
        >
          <DollarSign className="w-4 h-4 text-emerald-500" />
          <span>เครดิต & ค่าบริการ</span>
        </button>
      </div>

      {activeTab === 'analytics' && (
        <div className="space-y-3">
          {/* Quick Action Bar for Reset / Maintenance */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-white border border-gray-150 rounded-2xl shadow-xs">
            <div className="flex items-center gap-2 text-xs text-gray-700 flex-wrap">
              <TrendingUp className="w-4 h-4 text-rose-500 shrink-0" />
              <span className="font-bold">รายงานยอดขายและสถิติภาพรวม</span>
              {orphanedOrdersCount > 0 && (
                <span className="text-rose-600 font-bold bg-rose-50 px-2.5 py-0.5 rounded-lg border border-rose-200 text-[11px] flex items-center gap-1">
                  มีออเดอร์ตกค้างจากร้านที่ลบแล้ว ({orphanedOrdersCount} บิล)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {orphanedOrdersCount > 0 && (
                <button
                  type="button"
                  onClick={handleCleanupOrphanedOrders}
                  disabled={isCleaningChats}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50"
                  title="ล้างยอดขายและออเดอร์ของร้านค้าที่ถูกลบไปแล้ว"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>ลบออเดอร์ร้านที่ลบ ({orphanedOrdersCount})</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowMaintenanceModal(true)}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition active:scale-95"
                title="จัดการพื้นที่ ล้างแชท และรีเซ็ตข้อมูลทดสอบ"
              >
                <span className="flex items-center gap-1.5"><Settings className="w-3.5 h-3.5" /> จัดการ & รีเซ็ตระบบ</span>
              </button>
            </div>
          </div>

          <SalesDashboard orders={orders} shops={shops} />
        </div>
      )}

      {/* TAB 2: USER MANAGEMENT & ROLE GRANTING */}
      {activeTab === 'users' && (
        <div className="space-y-3">
          {/* Instructions Box */}
          <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-3 text-xs text-amber-900 leading-relaxed">
            <strong>วิธีแต่งตั้งร้านค้า:</strong> ค้นหาเบอร์โทรศัพท์ของคนที่ต้องการแต่งตั้งด้านล่าง จากนั้นกดปุ่ม <strong>"+ ให้ยศร้านค้า"</strong> และกรอกชื่อร้าน ระบบจะเปิดโหมดร้านค้าให้เขาทันที
          </div>

          {/* Search by Phone & Name */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ค้นหาด้วยเบอร์โทร (เช่น 081..., 064...) หรือชื่อผู้ใช้..."
              value={userSearchQuery}
              onChange={(e) => setUserSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-white border border-gray-200 rounded-2xl text-xs focus:outline-hidden focus:ring-2 focus:ring-amber-500 shadow-xs"
            />
            {userSearchQuery && (
              <button
                type="button"
                onClick={() => setUserSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Role Filter Chips */}
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 text-xs">
            {[
              { id: 'all', label: 'ทั้งหมด', count: users.length },
              { id: 'customer', label: 'ลูกค้า', count: users.filter(u => u.role === 'customer').length },
              { id: 'merchant', label: 'ร้านค้า', count: users.filter(u => u.role === 'merchant').length },
              { id: 'admin', label: 'แอดมิน', count: users.filter(u => u.role === 'admin').length },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setUserRoleFilter(f.id as any)}
                className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap text-[11px] ${
                  userRoleFilter === f.id
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-100'
                }`}
              >
                {f.label} ({f.count})
              </button>
            ))}
          </div>

          {/* Users List */}
          <div className="grid grid-cols-1 gap-2">
            {users
              .filter((u) => {
                const q = userSearchQuery.trim().toLowerCase();
                const matchesSearch =
                  !q ||
                  (u.phone && u.phone.includes(q)) ||
                  (u.display_name && u.display_name.toLowerCase().includes(q)) ||
                  (u.line_user_id && u.line_user_id.toLowerCase().includes(q));
                const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter;
                return matchesSearch && matchesRole;
              })
              .map((u) => (
                <div
                  key={u.uid}
                  className="bg-white rounded-2xl p-3 border border-gray-100 shadow-xs flex items-center justify-between gap-2 hover:border-amber-200 transition"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-100 shrink-0 bg-slate-200">
                      <UserAvatar src={u.picture_url} alt={u.display_name} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-bold text-sm text-gray-800 truncate">{u.display_name}</h4>
                        <span className="text-[10px] font-mono font-bold text-gray-400">
                          #{getUserCode(u)}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                            u.role === 'admin'
                              ? 'bg-rose-100 text-rose-800'
                              : u.role === 'merchant'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {u.role === 'admin' ? 'แอดมิน' : u.role === 'merchant' ? 'ร้านค้า' : 'ลูกค้า'}
                        </span>
                      </div>
                      <p className="text-xs text-amber-700 font-semibold mt-0.5 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-amber-500" />
                        <span>{u.phone ? u.phone : <span className="text-gray-400 font-normal">ไม่ระบุเบอร์</span>}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {u.role === 'customer' && (
                      <button
                        type="button"
                        onClick={() => setSelectedUserForMerchant(u)}
                        className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 text-white rounded-xl font-bold text-xs shadow-xs transition active:scale-95"
                      >
                        + ให้ยศร้านค้า
                      </button>
                    )}
                    {u.role === 'merchant' && (
                      <button
                        type="button"
                        onClick={() => handleRevokeRole(u.uid)}
                        className="px-2.5 py-1 text-xs text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      >
                        ปลดสิทธิ์
                      </button>
                    )}
                    {/* Delete Account button (admin can delete anyone except self) */}
                    {u.uid !== currentUser.uid && (
                      <button
                        type="button"
                        onClick={() => handleDeleteUser(u.uid, u.display_name)}
                        className="p-1.5 text-gray-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="ลบบัญชีผู้ใช้นี้ออกจากระบบ"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>

          {/* Modal to Grant Merchant Role */}
          {selectedUserForMerchant && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3">
              <form
                onSubmit={handleGrantMerchantRole}
                className="bg-white rounded-3xl p-5 max-w-sm w-full space-y-3 shadow-2xl animate-in zoom-in-95"
              >
                <div className="flex items-center gap-2 text-gray-800">
                  <Store className="w-5 h-5 text-amber-500" />
                  <h3 className="font-bold text-base">แต่งตั้งเป็นร้านค้า</h3>
                </div>
                <p className="text-xs text-gray-500">
                  ผู้ใช้งาน: <strong>{selectedUserForMerchant.display_name}</strong>
                </p>

                <div className="space-y-2">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1">
                      ชื่อร้านค้าที่จะแสดงในแอพ
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="เช่น ส้มตำยายเพ็ญ มรภ."
                      value={newShopName}
                      onChange={(e) => setNewShopName(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-gray-50 border rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1">
                      เบอร์โทรศัพท์ของร้าน
                    </label>
                    <input
                      type="tel"
                      placeholder="08x-xxx-xxxx"
                      value={newShopPhone}
                      onChange={(e) => setNewShopPhone(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-gray-50 border rounded-xl"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedUserForMerchant(null)}
                    className="px-4 py-2 text-xs text-zinc-600 hover:bg-zinc-100 rounded-xl cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs bg-[#FF8500] hover:bg-[#E87500] text-white font-bold rounded-xl shadow-xs cursor-pointer"
                  >
                    ยืนยันการแต่งตั้ง
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* TAB: SHOP MANAGEMENT & COVER PHOTOS */}
      {activeTab === 'shops' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="font-bold text-sm text-gray-800">
                รายชื่อร้านค้าในระบบ ({shops.length} ร้าน)
              </h3>
              <p className="text-xs text-gray-400">
                จัดการข้อมูลร้านค้า, ค่าจัดส่ง, รูปหน้าร้าน, เมนู และยอดเครดิต
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowCreateMerchantModal(true);
                setCreateShopName('');
                setCreateMerchantEmail('');
                setCreateMerchantPassword('');
                setCreateShopPhone('');
                setCreateShopPromptpay('');
                setCreateShopAddress('');
                setCreateShopDeliveryFee('0');
                setCreateShopCategory('food');
                setCreateMerchantError('');
              }}
              className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ สร้างบัญชีร้านค้าใหม่</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {shops.map((shop) => (
              <div
                key={shop.id}
                className="bg-white rounded-3xl overflow-hidden border border-gray-150 shadow-xs hover:shadow-md transition flex flex-col"
              >
                {/* Storefront Image Banner */}
                <div className="relative h-44 bg-slate-100 group overflow-hidden">
                  {shop.image_url ? (
                    <img
                      key={shop.image_url}
                      src={shop.image_url}
                      alt={shop.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-amber-500 via-orange-500 to-amber-700 flex flex-col items-center justify-center text-white select-none">
                      <Store className="w-12 h-12 opacity-85 mb-1" />
                      <span className="text-xs font-bold bg-black/25 backdrop-blur-xs px-3 py-0.5 rounded-full border border-white/20">
                        ยังไม่มีรูปภาพหน้าร้าน
                      </span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10 pointer-events-none" />

                  {/* Top Bar on Banner */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleShopOpen(shop)}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 shadow-md transition active:scale-95 cursor-pointer ${
                        (shop.is_open ?? true)
                          ? 'bg-emerald-500 text-white'
                          : 'bg-red-500 text-white'
                      }`}
                    >
                      <Power className="w-3 h-3" />
                      <span>{(shop.is_open ?? true) ? 'เปิดร้าน' : 'ปิดร้านชั่วคราว'}</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedShopForCrop(shop);
                          selectedShopForCropRef.current = shop;
                          adminShopCoverInputRef.current?.click();
                        }}
                        className="px-2.5 py-1 bg-black/75 hover:bg-black/90 text-white font-bold text-xs rounded-xl backdrop-blur-xs flex items-center gap-1 shadow-md active:scale-95 transition border border-white/20 cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5 text-amber-400" />
                        <span>{shop.image_url ? 'เปลี่ยนรูป' : 'ใส่รูป'}</span>
                      </button>

                      {shop.image_url && (
                        <button
                          type="button"
                          onClick={() => handleAdminRemoveShopCover(shop)}
                          className="px-2 py-1 bg-rose-600/85 hover:bg-rose-700 text-white font-bold text-xs rounded-xl backdrop-blur-xs flex items-center gap-1 shadow-md active:scale-95 transition cursor-pointer"
                          title="ลบรูปภาพหน้าร้านนี้"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>ลบ</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Details Overlay */}
                  <div className="absolute bottom-3 left-3.5 right-3.5 text-white">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {(() => {
                        const sRevs = allShopReviews.filter((r) => r.shop_id === shop.id && Number.isInteger(r.rating) && r.rating >= 1 && r.rating <= 5);
                        const count = sRevs.length;
                        const avg = count > 0 ? (Math.round((sRevs.reduce((sum, r) => sum + r.rating, 0) / count) * 10) / 10).toFixed(1) : (shop.rating ? shop.rating.toFixed(1) : '0.0');
                        return (
                          <button
                            type="button"
                            onClick={() => setSelectedShopForReviews(shop)}
                            className="text-[10px] bg-amber-500 hover:bg-amber-600 font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 shadow-xs transition active:scale-95 cursor-pointer"
                            title="คลิกเพื่อดูและจัดการรีวิว"
                          >
                            <Star className="w-3 h-3 fill-white" /> {avg} ({count} รีวิว)
                          </button>
                        );
                      })()}
                      {(shop.sales_count ?? 0) > 0 && (
                        <span className="text-[10px] bg-orange-600 font-black px-2 py-0.5 rounded-full">
                          ขายแล้ว {shop.sales_count} ออเดอร์
                        </span>
                      )}
                    </div>
                    <h4 className="font-black text-base drop-shadow-md leading-tight">{shop.name}</h4>
                    <div className="flex items-center justify-between text-[11px] text-amber-200 mt-0.5">
                      <p className="flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3 shrink-0" /> {shop.address_detail || 'รอบ มรภ. ชัยภูมิ'}
                      </p>
                      {shop.location?.lat && shop.location?.lng && (
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${shop.location.lat},${shop.location.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-[10px] bg-white/20 hover:bg-white/30 text-white font-bold px-2 py-0.5 rounded-full border border-white/30 flex items-center gap-0.5 backdrop-blur-xs ml-1 transition"
                        >
                          <Navigation className="w-2.5 h-2.5 text-amber-300" />
                          <span>แผนที่</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Admin Management Actions Toolbar */}
                <div className="p-2.5 bg-gray-50 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedShopForReviews(shop)}
                    className="py-1.5 px-2 bg-white hover:bg-amber-50 text-gray-700 hover:text-amber-800 border border-gray-200 hover:border-amber-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition shadow-2xs active:scale-95 cursor-pointer"
                  >
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span>จัดการรีวิว ({allShopReviews.filter(r => r.shop_id === shop.id).length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedShopForMenus(shop)}
                    className="py-1.5 px-2 bg-white hover:bg-orange-50 text-gray-700 hover:text-orange-800 border border-gray-200 hover:border-orange-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition shadow-2xs active:scale-95 cursor-pointer"
                  >
                    <ChefHat className="w-3.5 h-3.5 text-orange-500" />
                    <span>จัดการเมนู ({allMenuItems.filter(m => m.shop_id === shop.id).length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedShopForEdit(shop);
                      setEditShopName(shop.name);
                      setEditShopPhone(shop.phone || '');
                      setEditShopPromptpay(shop.promptpay_number || '');
                      setEditShopAddress(shop.address_detail || '');
                      setEditShopCategory(shop.category || 'food');
                      setEditShopDeliveryFee(String(shop.delivery_fee ?? 0));
                    }}
                    className="py-1.5 px-2 bg-white hover:bg-blue-50 text-gray-700 hover:text-blue-800 border border-gray-200 hover:border-blue-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition shadow-2xs active:scale-95 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-blue-500" />
                    <span>แก้ไขข้อมูล</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenCredentialsModal(shop)}
                    className="py-1.5 px-2 bg-white hover:bg-purple-50 text-purple-900 hover:text-purple-950 border border-purple-200 hover:border-purple-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition shadow-2xs active:scale-95 cursor-pointer"
                    title="ดูและแก้ไขอีเมล/รหัสผ่านเข้าสู่ระบบของร้านค้านี้"
                  >
                    <Key className="w-3.5 h-3.5 text-purple-600" />
                    <span>รหัสผ่าน/อีเมล</span>
                  </button>
                </div>

                {/* Credit Balance & Quick Topup Row */}
                <div className="px-3.5 py-2.5 bg-emerald-50/60 border-t border-emerald-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-600 font-bold text-[11px]">เครดิตร้าน:</span>
                    <span className={`font-black text-sm ${((shop.credit_balance ?? 0) < 0) ? 'text-rose-600' : 'text-emerald-700'}`}>
                      ฿{(shop.credit_balance ?? 0).toFixed(2)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedShopForCredit(shop);
                      setTopupAmount('100');
                      setTopupType('topup');
                      setTopupNote('');
                      setCreditError(null);
                    }}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1 shadow-2xs transition active:scale-95 cursor-pointer"
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>เติม/ปรับเครดิต</span>
                  </button>
                </div>

                {/* Bottom Row */}
                <div className="p-3.5 bg-white flex items-center justify-between text-xs border-t border-gray-100">
                  <div className="space-y-0.5 text-gray-600">
                    <p className="font-medium flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-gray-400" /> {shop.phone || 'ไม่มีเบอร์โทร'}
                    </p>
                    {shop.promptpay_number && (
                      <p className="text-[11px] text-gray-400">
                        พร้อมเพย์: {shop.promptpay_number}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedShopForCrop(shop);
                        selectedShopForCropRef.current = shop;
                        adminShopCoverInputRef.current?.click();
                      }}
                      className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-xl text-xs border border-amber-200 flex items-center gap-1 transition active:scale-95 cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5 text-amber-600" />
                      <span>ตัดขอบรูปใหม่</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteShop(shop.id, shop.name)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition border border-transparent hover:border-red-200 cursor-pointer"
                      title={`ลบร้าน ${shop.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: ORDER MONITORING & COMPREHENSIVE LOGS */}
      {activeTab === 'orders' && (
        <div className="space-y-3">
          {/* 1. Status Filter Tabs */}
          <div className="flex bg-gray-100 p-1 rounded-2xl gap-1 overflow-x-auto">
            <button
              type="button"
              onClick={() => setOrderStatusFilter('all')}
              className={`flex-1 min-w-[70px] py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${
                orderStatusFilter === 'all'
                  ? 'bg-white text-gray-800 shadow-xs'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <span>ทั้งหมด ({orders.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setOrderStatusFilter('active')}
              className={`flex-1 min-w-[75px] py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${
                orderStatusFilter === 'active'
                  ? 'bg-white text-gray-800 shadow-xs'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${activeAdminOrdersCount > 0 ? 'bg-[#FF8500] animate-pulse' : 'bg-gray-300'}`} />
              <span>สด/กำลังทำ ({activeAdminOrdersCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setOrderStatusFilter('completed')}
              className={`flex-1 min-w-[75px] py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${
                orderStatusFilter === 'completed'
                  ? 'bg-white text-gray-800 shadow-xs'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>สำเร็จ ({completedAdminOrdersCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setOrderStatusFilter('cancelled')}
              className={`flex-1 min-w-[65px] py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${
                orderStatusFilter === 'cancelled'
                  ? 'bg-white text-gray-800 shadow-xs'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <span>ยกเลิก ({cancelledAdminOrdersCount})</span>
            </button>
          </div>

          {/* 2. Date Filter Controls */}
          <div className="bg-white rounded-2xl p-3 border border-gray-150 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#FF8500]" />
                <span>ช่วงวันที่แสดง Log:</span>
              </span>

              {/* Quick Date Presets */}
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setOrderDatePreset('all');
                    setOrderCustomDate('');
                  }}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition ${
                    orderDatePreset === 'all'
                      ? 'bg-[#FF8500] text-white shadow-2xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  ทั้งหมด
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOrderDatePreset('today');
                    setOrderCustomDate('');
                  }}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition ${
                    orderDatePreset === 'today'
                      ? 'bg-[#FF8500] text-white shadow-2xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  วันนี้
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOrderDatePreset('yesterday');
                    setOrderCustomDate('');
                  }}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition ${
                    orderDatePreset === 'yesterday'
                      ? 'bg-[#FF8500] text-white shadow-2xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  เมื่อวาน
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOrderDatePreset('7days');
                    setOrderCustomDate('');
                  }}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition ${
                    orderDatePreset === '7days'
                      ? 'bg-[#FF8500] text-white shadow-2xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  7 วันล่าสุด
                </button>
              </div>
            </div>

            {/* Custom Exact Date Picker + Search Bar + Export */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-100">
              {/* Direct Date Picker */}
              <div className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1.5 rounded-xl border border-gray-200 text-xs">
                <span className="text-[11px] text-gray-500 font-medium">ระบุวัน:</span>
                <input
                  type="date"
                  value={orderCustomDate}
                  onChange={(e) => {
                    setOrderCustomDate(e.target.value);
                    setOrderDatePreset(e.target.value ? 'custom' : 'all');
                  }}
                  className="text-xs bg-transparent focus:outline-hidden font-medium text-gray-700"
                />
                {orderCustomDate && (
                  <button
                    type="button"
                    onClick={() => {
                      setOrderCustomDate('');
                      setOrderDatePreset('all');
                    }}
                    className="text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
                    title="ล้างวันที่ระบุ"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Shop Filter Dropdown */}
              <select
                value={orderShopFilter}
                onChange={(e) => setOrderShopFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl bg-gray-50 border border-gray-200 text-xs font-medium text-gray-700 focus:outline-hidden"
              >
                <option value="all">ทุกร้านค้า ({shops.length})</option>
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              {/* Action Buttons: Clean Chats & Export CSV */}
              <div className="ml-auto flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowMaintenanceModal(true)}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition active:scale-95"
                  title="จัดการพื้นที่ & ล้างประวัติแชทเก่า"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                  <span>ล้างแชทเก่า</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition active:scale-95"
                  title="ส่งออกรายงาน Excel/CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>โหลด CSV</span>
                </button>
              </div>
            </div>

            {/* Search input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ค้นหา #รหัสออเดอร์, ชื่อลูกค้า, เบอร์โทร, ชื่อเมนู..."
                value={orderSearchQuery}
                onChange={(e) => setOrderSearchQuery(e.target.value)}
                className="w-full pl-8 pr-7 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-rose-500 font-medium"
              />
              {orderSearchQuery && (
                <button
                  type="button"
                  onClick={() => setOrderSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* 3. Filter Summary Ribbon */}
          <div className="bg-[#F8F9FB] border border-[#E9E9EF] rounded-xl px-3 py-2 text-[11px] flex items-center justify-between text-zinc-600 font-medium">
            <span>
              พบทั้งหมด <strong className="text-zinc-900 font-bold">{filteredAdminOrders.length}</strong> ออเดอร์
            </span>
            <span>
              ยอดอาหารรวม <strong className="text-[#FF8500] font-bold">{filteredOrdersTotalGMV} ฿</strong> (ค่าบริการหักเครดิตจริง: {creditLedgerReady ? filteredOrdersAdminGP.toFixed(2) : 'ยังไม่พร้อม'} ฿)
            </span>
          </div>

          {/* 4. Orders List */}
          {filteredAdminOrders.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center border border-[#E9E9EF] shadow-xs space-y-2">
              <div className="w-12 h-12 rounded-full bg-[#F8F9FB] text-zinc-400 border border-[#E9E9EF] flex items-center justify-center mx-auto">
                <Search className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-zinc-700 text-xs">ไม่พบรายการออเดอร์ตามเงื่อนไขที่เลือก</h4>
              <p className="text-[11px] text-zinc-400">ลองเปลี่ยนช่วงวันที่ หรือคำค้นหาใหม่อีกครั้ง</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredAdminOrders.map((o) => {
                const dateObj = getOrderDate(o);
                const dateText = dateObj
                  ? dateObj.toLocaleDateString('th-TH', {
                      day: 'numeric',
                      month: 'short',
                      year: '2-digit'
                    }) +
                    ', ' +
                    dateObj.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) +
                    ' น.'
                  : '-';

                return (
                  <div
                    key={o.id}
                    className={`bg-white rounded-2xl p-3.5 border shadow-xs transition space-y-2 ${
                      o.status === 'pending'
                        ? 'border-amber-300 ring-1 ring-amber-100'
                        : o.status === 'cooking' || o.status === 'delivering'
                        ? 'border-blue-200'
                        : o.status === 'completed'
                        ? 'border-gray-100'
                        : 'border-red-100 opacity-75'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-black text-xs text-gray-800">#{formatOrderCode(o)}</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            o.status === 'pending'
                              ? 'bg-amber-100 text-amber-800 animate-pulse'
                              : o.status === 'cooking'
                              ? 'bg-blue-100 text-blue-800'
                              : o.status === 'delivering'
                              ? 'bg-orange-100 text-orange-800'
                              : o.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {o.status === 'pending' && 'รอร้านรับ'}
                          {o.status === 'cooking' && 'กำลังปรุง'}
                          {o.status === 'delivering' && 'กำลังขี่รถไปส่ง'}
                          {o.status === 'completed' && 'ส่งสำเร็จแล้ว'}
                          {o.status === 'cancelled' && 'ยกเลิก'}
                        </span>
                        <span className="text-[10px] text-zinc-400 font-medium flex items-center gap-1"><Clock className="w-2.5 h-2.5 text-zinc-400" /> {dateText}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* Customer Call */}
                        {o.customer_phone && (
                          <a
                            href={`tel:${o.customer_phone}`}
                            className="w-7 h-7 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 flex items-center justify-center border border-gray-200 transition"
                            title="โทรหาลูกค้า"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        )}

                        {/* Audit Chat Button */}
                        <button
                          type="button"
                          onClick={() => setActiveChatOrder(o)}
                          className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg text-xs border border-rose-200 flex items-center gap-1 transition active:scale-95"
                          title="ตรวจสอบประวัติแชท"
                        >
                          <MessageSquare className="w-3 h-3" />
                          <span>ดูแชท</span>
                        </button>

                        {/* Delete Order Button */}
                        <button
                          type="button"
                          onClick={() => handleDeleteOrder(o.id, formatOrderCode(o))}
                          className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center border border-red-200 transition"
                          title="ลบออเดอร์นี้"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Order Parties: Shop -> Customer */}
                    <div className="text-xs space-y-0.5">
                      <p className="font-bold text-gray-800 flex items-center gap-1">
                        <span className="flex items-center gap-1"><Store className="w-3 h-3 text-zinc-400" /> ร้าน {o.shop_name}</span>
                        <ArrowRight className="w-3 h-3 text-zinc-300" />
                        <span className="flex items-center gap-1"><User className="w-3 h-3 text-zinc-400" /> {o.customer_name}</span>
                      </p>
                      <p className="text-[11px] text-gray-500 flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                        <span>{o.delivery_address}</span>
                      </p>
                    </div>

                    {/* Items List */}
                    <div className="bg-gray-50 rounded-xl p-2 text-[11px] space-y-1">
                      {o.items?.map((it, idx) => (
                        <div key={idx} className="flex justify-between items-start text-gray-700">
                          <div>
                            <span>
                              <strong className="text-gray-900">{it.quantity}x</strong> {it.name}
                              {it.note && <span className="text-amber-700 ml-1">({it.note})</span>}
                            </span>
                            {it.selected_options && it.selected_options.length > 0 && (
                              <div className="text-[10px] text-orange-700 pl-4 space-y-0.5 mt-0.5">
                                {it.selected_options.map((opt, optIdx) => (
                                  <div key={optIdx}>↳ + {opt.name} {opt.price > 0 ? `(+${opt.price} ฿)` : '(ฟรี)'}</div>
                                ))}
                              </div>
                            )}
                          </div>
                          <span className="font-medium shrink-0">{orderItemUnitPrice(it) * it.quantity} ฿</span>
                        </div>
                      ))}
                      <div className="pt-1 mt-1 border-t border-gray-200 flex justify-between font-bold text-gray-800">
                        <span>ยอดรวม (อาหาร {o.food_subtotal || 0} + ส่ง {(o.delivery_fee ?? 0)})</span>
                        <span className="text-rose-600 font-black">{o.total_amount} ฿</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: GP COMMISSION & MERCHANT CREDIT MANAGEMENT */}
      {activeTab === 'settlement' && (
        <div className="space-y-4">
          {/* 1. Master GP Commission Settings Card */}
          <div className="bg-white rounded-3xl p-5 border border-gray-150 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center text-xl">
                  <Settings className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-gray-900">
                    การตั้งค่าระบบค่าคอมมิชชั่น (GP Commission)
                  </h3>
                  <p className="text-xs text-gray-500">
                    เปิด/ปิด การหักค่าคอมมิชชั่นจากร้านค้า และกำหนดอัตราส่วนแบ่ง
                  </p>
                </div>
              </div>

              {/* Toggle Switch */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-600">
                  {gpEnabled ? 'เปิดเก็บ GP' : 'ปิดเก็บ GP (0%)'}
                </span>
                <button
                  type="button"
                  onClick={() => setGpEnabled(!gpEnabled)}
                  className={`w-14 h-8 rounded-full transition-colors relative p-1 cursor-pointer ${
                    gpEnabled ? 'bg-emerald-500' : 'bg-gray-300'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full bg-white shadow-md transform transition-transform ${
                      gpEnabled ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Status Banner */}
            {!gpEnabled ? (
              <div className="p-3.5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-emerald-800">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span>กำลังเปิดใช้งานโหมด &ldquo;ช่วงเปิดตัวฟรี (GP 0%)&rdquo;</span>
                </p>
                <p className="text-[11px] text-emerald-700 leading-relaxed">
                  ร้านค้าจะได้รับยอดขายอาหารเต็ม 100% โดยระบบจะไม่หักเครดิตหรือคิดค่าคอมมิชชั่นใด ๆ เมื่อออเดอร์จัดส่งสำเร็จ
                </p>
              </div>
            ) : (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-amber-800">
                  <CheckCircle2 className="w-4 h-4 text-amber-600" />
                  <span>กำลังเปิดเก็บค่าคอมมิชชั่น (GP)</span>
                </p>
                <p className="text-[11px] text-amber-700 leading-relaxed">
                  เมื่อร้านค้าจัดส่งออเดอร์สำเร็จ ระบบจะหักเครดิตของร้านค้าอัตโนมัติตามอัตรา {gpPercent}% ของยอดอาหาร
                </p>
              </div>
            )}

            {/* Settings Inputs & Save Button */}
            <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-gray-700">อัตรา GP (%):</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={gpPercent}
                  onChange={(e) => setGpPercent(parseFloat(e.target.value) || 0)}
                  className="w-20 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <button
                type="button"
                disabled={isSavingGp}
                onClick={handleSaveGpSettings}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition active:scale-95 flex items-center gap-1.5 cursor-pointer ml-auto"
              >
                {isSavingGp ? (
                  <span>กำลังบันทึก...</span>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>บันทึกการตั้งค่า GP</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 2. Merchant Credit Balances Overview */}
          <div className="bg-white rounded-3xl p-5 border border-gray-150 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black text-sm text-gray-900 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  <span>ยอดเครดิตคงเหลือของร้านค้า ({shops.length} ร้าน)</span>
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  ร้านค้าติดต่อแอดมินเพื่อเติมเครดิตผ่าน LINE Official (@887nrlyw)
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {shops.map((shop) => (
                <div
                  key={shop.id}
                  className="p-3.5 rounded-2xl bg-gray-50 border border-gray-150 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <h4 className="font-bold text-xs text-gray-800 truncate">{shop.name}</h4>
                    <p className="text-[11px] text-gray-400">
                      โทร: {shop.phone || '-'} • ขายแล้ว {shop.sales_count || 0} ออเดอร์
                    </p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="text-[11px] font-medium text-gray-500">เครดิต:</span>
                      <span
                        className={`text-sm font-black ${
                          (shop.credit_balance ?? 0) < 0 ? 'text-rose-600' : 'text-emerald-700'
                        }`}
                      >
                        ฿{(shop.credit_balance ?? 0).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedShopForCredit(shop);
                      setTopupAmount('100');
                      setTopupType('topup');
                      setTopupNote('');
                      setCreditError(null);
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1 shadow-2xs transition active:scale-95 shrink-0 cursor-pointer"
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>เติม/ปรับเครดิต</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Recent Credit Transactions Log */}
          <div className="bg-white rounded-3xl p-5 border border-gray-150 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-sm text-gray-900 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>ประวัติธุรกรรมเครดิตล่าสุด ({creditTransactions.length} รายการ)</span>
              </h3>
            </div>

            {creditTransactions.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">ยังไม่มีประวัติการทำรายการเครดิต</p>
            ) : (
              <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto pr-1">
                {creditTransactions.map((tx) => {
                  const txDate = tx.created_at?.seconds
                    ? new Date(tx.created_at.seconds * 1000)
                    : tx.created_at
                    ? new Date(tx.created_at)
                    : null;

                  return (
                    <div key={tx.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-800 truncate">{tx.shop_name || tx.shop_id}</span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              tx.type === 'topup'
                                ? 'bg-emerald-100 text-emerald-800'
                                : tx.type === 'gp_deduct'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {tx.type === 'topup'
                              ? 'เติมเครดิต'
                              : tx.type === 'gp_deduct'
                              ? 'หัก GP อัตโนมัติ'
                              : 'ปรับลดยอด'}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                          {tx.note || '-'}
                          {txDate && ` • ${formatThaiDateWithTime(txDate)}`}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`text-sm font-black ${
                            tx.amount > 0 ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {tx.amount > 0 ? `+฿${tx.amount.toFixed(2)}` : `-฿${Math.abs(tx.amount).toFixed(2)}`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Audit Chat Modal for Admin */}
      {activeChatOrder && (
        <ChatModal
          orderId={activeChatOrder.id}
          orderCode={formatOrderCode(activeChatOrder)}
          shopName={activeChatOrder.shop_name || 'ร้านค้า'}
          shopImage={activeChatOrder.shop_image}
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

      {/* Storage Maintenance & Chat Cleanup Modal */}
      {showMaintenanceModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-150 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center text-xl shadow-xs">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-gray-900 text-base">จัดการพื้นที่ & รีเซ็ตข้อมูล</h3>
                  <p className="text-[11px] text-gray-500">ล้างข้อความแชท, ออเดอร์ตกค้าง หรือรีเซ็ตระบบทดสอบ</p>
                </div>
              </div>
              <button
                type="button"
                disabled={isCleaningChats}
                onClick={() => setShowMaintenanceModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Section 1: Orphaned Orders & Reset Test Data */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                  <Trash2 className="w-3.5 h-3.5 text-zinc-400 inline mr-1" />
                  <span>จัดการข้อมูลทดสอบ & ยอดขาย</span>
                </span>
                <span className="text-[10px] bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full">
                  Admin เท่านั้น
                </span>
              </div>

              {/* Clean Orphaned Orders (From Deleted Shops) */}
              <button
                type="button"
                disabled={isCleaningChats || orphanedOrdersCount === 0}
                onClick={handleCleanupOrphanedOrders}
                className={`w-full text-left p-3.5 rounded-2xl border transition group flex items-center justify-between disabled:opacity-50 ${
                  orphanedOrdersCount > 0
                    ? 'border-rose-300 bg-rose-50/70 hover:bg-rose-100/70'
                    : 'border-gray-200 bg-gray-50 text-gray-400'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${orphanedOrdersCount > 0 ? 'text-rose-900 group-hover:text-rose-800' : 'text-gray-500'}`}>
                      ล้างออเดอร์ของร้านค้าที่ถูกลบ
                    </span>
                    {orphanedOrdersCount > 0 && (
                      <span className="text-[10px] bg-rose-600 text-white px-2 py-0.5 rounded-full font-bold animate-pulse">
                        {orphanedOrdersCount} บิลตกค้าง
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    ลบออเดอร์และยอดขายที่ค้างจากร้านค้าที่เคยถูกลบออกจากระบบ เพื่อให้ยอดสรุปเป็น 0
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <Trash2 className={`w-4 h-4 ${orphanedOrdersCount > 0 ? 'text-rose-600' : 'text-gray-300'}`} />
                </div>
              </button>

              {/* Reset All Test Orders & Sales */}
              <button
                type="button"
                disabled={isCleaningChats}
                onClick={handleResetAllOrders}
                className="w-full text-left p-3.5 rounded-2xl border border-red-200 bg-red-50/40 hover:bg-red-100/60 transition group flex items-center justify-between disabled:opacity-50"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-red-900 group-hover:text-red-800">
                      ล้างออเดอร์ & รีเซ็ตยอดขายและค่าบริการทั้งหมด
                    </span>
                    <span className="text-[10px] bg-red-200 text-red-800 px-2 py-0.5 rounded-full font-bold">
                      ล้างหมด
                    </span>
                  </div>
                  <p className="text-[11px] text-red-700/80 mt-0.5">
                    ลบข้อมูลออเดอร์ บิล ค่าบริการ GP และรีวิวทดสอบทั้งหมด พร้อมรีเซ็ตเลขออเดอร์เริ่มต้น
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-extrabold text-red-800">{orders.length}</span>
                  <span className="text-[10px] text-red-500 block">บิล</span>
                </div>
              </button>

              {/* Reset Credit & GP Transactions Only */}
              <button
                type="button"
                disabled={isCleaningChats}
                onClick={handleResetCreditTransactions}
                className="w-full text-left p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/40 hover:bg-emerald-100/60 transition group flex items-center justify-between disabled:opacity-50"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-900 group-hover:text-emerald-800">
                      ล้างประวัติหักค่าบริการ (GP) และธุรกรรมเครดิต
                    </span>
                    <span className="text-[10px] bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                      รีเซ็ต GP
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-700/80 mt-0.5">
                    ลบประวัติการหักค่าบริการ GP และยอดเติม/ตัดเครดิตทั้งหมด เพื่อให้ "รายได้ค่าบริการระบบ" กลับเป็น 0.00 ฿
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-extrabold text-emerald-800">0.00 ฿</span>
                </div>
              </button>
            </div>

            {/* Section 2: Clean Old Chats */}
            <div className="pt-2 border-t border-gray-150 space-y-2">
              <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-zinc-400 inline mr-1" />
                <span>ล้างเฉพาะข้อความแชท (ไม่กระทบยอดขาย)</span>
              </span>

              {/* Options List */}
              <div className="space-y-1.5">
                {/* 30 days */}
                <button
                  type="button"
                  disabled={isCleaningChats}
                  onClick={() => handleCleanupOldChats(30)}
                  className="w-full text-left p-2.5 rounded-2xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition group flex items-center justify-between disabled:opacity-50"
                >
                  <div>
                    <span className="text-xs font-bold text-gray-800">เก่ากว่า 30 วัน</span>
                    <p className="text-[10px] text-gray-400">ล้างแชทออเดอร์ที่เสร็จสิ้นก่อน 1 เดือนที่แล้ว</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold text-gray-600">{getOrdersForCleanup(30).length} ออเดอร์</span>
                  </div>
                </button>

                {/* All completed/cancelled */}
                <button
                  type="button"
                  disabled={isCleaningChats}
                  onClick={() => handleCleanupOldChats('all')}
                  className="w-full text-left p-2.5 rounded-2xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition group flex items-center justify-between disabled:opacity-50"
                >
                  <div>
                    <span className="text-xs font-bold text-gray-800">แชทที่จบแล้วทั้งหมด</span>
                    <p className="text-[10px] text-gray-400">ล้างแชททุกออเดอร์ที่ส่งสำเร็จหรือยกเลิกแล้ว</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold text-gray-600">{getOrdersForCleanup('all').length} ออเดอร์</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Progress / Spinner during cleanup */}
            {isCleaningChats && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin shrink-0" />
                <span className="text-xs font-bold text-amber-900">
                  {cleanupStatusMessage || 'กำลังดำเนินการ กรุณารอสักครู่...'}
                </span>
              </div>
            )}

            {/* Close button */}
            <div className="pt-2">
              <button
                type="button"
                disabled={isCleaningChats}
                onClick={() => setShowMaintenanceModal(false)}
                className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs transition disabled:opacity-50"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. Admin Shop Reviews Management Modal (ลบรีวิวที่ไม่เป็นธรรม) */}
      {selectedShopForReviews && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-150 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#FFF5E8] text-[#FF8500] border border-orange-100 flex items-center justify-center shrink-0 shadow-xs">
                  <Star className="w-5 h-5 text-[#FF8500] fill-[#FF8500]" />
                </div>
                <div>
                  <h3 className="font-black text-gray-900 text-base">จัดการรีวิว • {selectedShopForReviews.name}</h3>
                  <p className="text-[11px] text-gray-500">ตรวจสอบและลบรีวิวที่ไม่เป็นธรรมหรือกลั่นแกล้งร้านค้า</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedShopForReviews(null)}
                className="w-8 h-8 rounded-full bg-[#F8F9FB] hover:bg-zinc-100 border border-[#E9E9EF] flex items-center justify-center text-zinc-500 hover:text-zinc-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Rating Summary Banner */}
            <div className="bg-[#FFF5E8] border border-orange-100 rounded-2xl p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-[#FF8500] flex items-center gap-1">
                  <Star className="w-6 h-6 text-[#FF8500] fill-[#FF8500]" />
                  {(selectedShopForReviews.rating || 5.0).toFixed(1)}
                </span>
                <span className="text-xs text-zinc-700 font-medium">
                  จากทั้งหมด {allShopReviews.filter((r) => r.shop_id === selectedShopForReviews.id).length} รีวิว
                </span>
              </div>
              <span className="text-[10px] bg-white border border-[#E9E9EF] text-zinc-700 font-bold px-2.5 py-1 rounded-full">
                คำนวณดาวใหม่อัตโนมัติเมื่อลบ
              </span>
            </div>

            {/* Reviews List */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 max-h-[400px]">
              {allShopReviews.filter((r) => r.shop_id === selectedShopForReviews.id).length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-xs">
                  ยังไม่มีรีวิวสำหรับร้านค้านี้
                </div>
              ) : (
                allShopReviews
                  .filter((r) => r.shop_id === selectedShopForReviews.id)
                  .map((rev) => (
                    <div
                      key={rev.id}
                      className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200 space-y-2 hover:border-gray-300 transition"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {rev.customer_avatar ? (
                            <img
                              src={rev.customer_avatar}
                              alt=""
                              className="w-7 h-7 rounded-full object-cover ring-1 ring-gray-200"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-zinc-100 text-zinc-600 font-bold text-xs flex items-center justify-center">
                              {rev.customer_name?.charAt(0) || <User className="w-3.5 h-3.5" />}
                            </div>
                          )}
                          <div>
                            <p className="text-xs font-bold text-gray-800 leading-tight">
                              {rev.customer_name || 'ลูกค้า'}
                            </p>
                            <div className="flex items-center gap-0.5 text-amber-500">
                              {[1, 2, 3, 4, 5].map((st) => (
                                <Star
                                  key={st}
                                  className={`w-3 h-3 ${
                                    st <= (rev.rating || 5)
                                      ? 'fill-amber-400 text-amber-400'
                                      : 'text-gray-300'
                                  }`}
                                />
                              ))}
                              <span className="text-[10px] text-gray-500 ml-1 font-bold">
                                {rev.rating} ดาว
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Delete unfair review button */}
                        <button
                          type="button"
                          onClick={() =>
                            handleDeleteReview(
                              rev.id,
                              selectedShopForReviews.id,
                              rev.customer_name || 'ลูกค้า'
                            )
                          }
                          className="px-2.5 py-1 text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl text-[11px] font-bold flex items-center gap-1 transition active:scale-95 cursor-pointer"
                          title="ลบรีวิวที่ไม่เป็นธรรมนี้"
                        >
                          <Trash2 className="w-3 h-3 text-red-500" />
                          <span>ลบรีวิวนี้</span>
                        </button>
                      </div>

                      {/* Comment text */}
                      <p className="text-xs text-gray-700 bg-white p-2.5 rounded-xl border border-gray-150 leading-relaxed">
                        &ldquo;{rev.comment || 'ไม่มีข้อความ'}&rdquo;
                      </p>
                    </div>
                  ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setSelectedShopForReviews(null)}
                className="w-full py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Admin Edit Shop Details Modal */}
      {selectedShopForEdit && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-gray-150 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 shadow-xs">
                  <Edit3 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-black text-gray-900 text-base">แก้ไขข้อมูลร้าน • {selectedShopForEdit.name}</h3>
                  <p className="text-[11px] text-gray-500">ปรับเปลี่ยนชื่อ เบอร์โทร หรือพิกัดร้านค้า</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedShopForEdit(null)}
                className="w-8 h-8 rounded-full bg-[#F8F9FB] hover:bg-zinc-100 border border-[#E9E9EF] flex items-center justify-center text-zinc-500 hover:text-zinc-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveShopDetails} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-gray-700 block mb-1">ชื่อร้านค้า:</label>
                <input
                  type="text"
                  required
                  value={editShopName}
                  onChange={(e) => setEditShopName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#FF8500] font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-gray-700 block mb-1">เบอร์โทรศัพท์ร้าน:</label>
                  <input
                    type="tel"
                    value={editShopPhone}
                    onChange={(e) => setEditShopPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#FF8500] font-medium"
                    placeholder="08x-xxx-xxxx"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-700 block mb-1">เลขพร้อมเพย์ร้าน:</label>
                  <input
                    type="text"
                    value={editShopPromptpay}
                    onChange={(e) => setEditShopPromptpay(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#FF8500] font-medium"
                    placeholder="08x-xxx-xxxx"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-700 block mb-1">ที่อยู่ / จุดสังเกตร้าน:</label>
                <input
                  type="text"
                  value={editShopAddress}
                  onChange={(e) => setEditShopAddress(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#FF8500] font-medium"
                  placeholder="เช่น ซอย 3 ตรงข้ามประตู 1 มรภ."
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-700 block mb-1">หมวดหมู่หลัก:</label>
                <select
                  value={editShopCategory}
                  onChange={(e) => setEditShopCategory(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-xl focus:outline-hidden font-medium"
                >
                  <option value="food">อาหารจานเดียว / กับข้าว</option>
                  <option value="drink_dessert">เครื่องดื่ม & ของหวาน</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-700 block mb-1">
                  ค่าจัดส่งของร้าน (บาท):
                </label>
                <div className="flex gap-1.5 mb-1.5">
                  {[0, 10, 15, 20].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setEditShopDeliveryFee(String(preset))}
                      className={`flex-1 py-1 text-[10px] font-bold rounded-lg border transition ${
                        editShopDeliveryFee === String(preset)
                          ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                          : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                      }`}
                    >
                      {preset === 0 ? 'ส่งฟรี (0฿)' : `${preset} ฿`}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="0"
                  value={editShopDeliveryFee}
                  onChange={(e) => setEditShopDeliveryFee(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium"
                  placeholder="0 (ส่งฟรี)"
                />
                <span className="text-[10px] text-gray-400 mt-0.5 block">
                  * กำหนด 0 บาทหากร้านส่งฟรี หรือใส่ตามระยะทางจริง (GP ไม่หักค่าส่ง)
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-150">
                <button
                  type="button"
                  onClick={() => setSelectedShopForEdit(null)}
                  className="px-4 py-2 text-xs text-gray-500 hover:bg-gray-100 rounded-xl font-medium"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSavingShopDetails}
                  className="px-5 py-2 text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isSavingShopDetails ? 'กำลังบันทึก...' : 'บันทึกข้อมูลร้าน'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Create Merchant Account Modal */}
      {showCreateMerchantModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-150 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center text-xl shadow-xs">
                  <Store className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-black text-gray-900 text-base">สร้างบัญชีร้านค้าใหม่</h3>
                  <p className="text-[11px] text-gray-500">สร้าง User Auth และข้อมูลร้านค้าพร้อมใช้งานทันที</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateMerchantModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createMerchantError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-600 font-medium flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{createMerchantError}</span>
              </div>
            )}

            <form onSubmit={handleCreateMerchantSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-gray-700 block mb-1">
                  ชื่อร้านค้า <span className="text-red-500">*</span>:
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น ส้มตำป้าศรี, กาแฟสดต้นปาล์ม"
                  value={createShopName}
                  onChange={(e) => setCreateShopName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-gray-700 block mb-1">
                    อีเมลสำหรับเข้าสู่ระบบ <span className="text-red-500">*</span>:
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="shop@example.com"
                    value={createMerchantEmail}
                    onChange={(e) => setCreateMerchantEmail(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-700 block mb-1">
                    รหัสผ่านเริ่มต้น <span className="text-red-500">*</span>:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="อย่างน้อย 6 ตัวอักษร"
                    value={createMerchantPassword}
                    onChange={(e) => setCreateMerchantPassword(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-gray-700 block mb-1">เบอร์โทรศัพท์ร้าน:</label>
                  <input
                    type="tel"
                    placeholder="08x-xxx-xxxx"
                    value={createShopPhone}
                    onChange={(e) => setCreateShopPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-700 block mb-1">เลขพร้อมเพย์ร้าน:</label>
                  <input
                    type="text"
                    placeholder="08x-xxx-xxxx"
                    value={createShopPromptpay}
                    onChange={(e) => setCreateShopPromptpay(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-700 block mb-1">ที่อยู่ / จุดสังเกตร้าน:</label>
                <input
                  type="text"
                  placeholder="เช่น ซอย 3 ตรงข้ามประตู 1 มรภ."
                  value={createShopAddress}
                  onChange={(e) => setCreateShopAddress(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-gray-700 block mb-1">หมวดหมู่ร้าน:</label>
                  <select
                    value={createShopCategory}
                    onChange={(e) => setCreateShopCategory(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-xl focus:outline-hidden font-medium"
                  >
                    <option value="food">อาหารจานเดียว / กับข้าว</option>
                    <option value="drink_dessert">เครื่องดื่ม & ของหวาน</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-700 block mb-1">ค่าจัดส่งของร้าน (บาท):</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0 (ส่งฟรี)"
                    value={createShopDeliveryFee}
                    onChange={(e) => setCreateShopDeliveryFee(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium"
                  />
                </div>
              </div>

              <div className="flex gap-1.5 pt-1">
                {[0, 10, 15, 20].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setCreateShopDeliveryFee(String(preset))}
                    className={`flex-1 py-1 text-[10px] font-bold rounded-lg border transition ${
                      createShopDeliveryFee === String(preset)
                        ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                        : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    {preset === 0 ? 'ส่งฟรี (0฿)' : `${preset} ฿`}
                  </button>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-150">
                <button
                  type="button"
                  onClick={() => setShowCreateMerchantModal(false)}
                  className="px-4 py-2 text-xs text-gray-500 hover:bg-gray-100 rounded-xl font-medium"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isCreatingMerchant}
                  className="px-5 py-2.5 text-xs bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isCreatingMerchant ? 'กำลังสร้างบัญชี...' : 'ยืนยันสร้างบัญชีร้านค้า'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Admin Shop Menus Management Modal */}
      {selectedShopForMenus && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-150 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#FFF5E8] text-[#FF8500] border border-orange-100 flex items-center justify-center shrink-0 shadow-xs"><ChefHat className="w-5 h-5" /></div>
                <div>
                  <h3 className="font-black text-gray-900 text-base">จัดการเมนูอาหาร • {selectedShopForMenus.name}</h3>
                  <p className="text-[11px] text-gray-500">เพิ่ม ลบ หรือแก้ไขสถานะของหมดแทนร้านค้าได้</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedShopForMenus(null);
                  setIsAddingNewMenu(false);
                }}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Add New Menu Button / Form */}
            {!isAddingNewMenu ? (
              <button
                type="button"
                onClick={() => {
                  setIsAddingNewMenu(true);
                  setNewMenuImage('');
                  setNewMenuName('');
                  setNewMenuPrice('');
                  setNewMenuOptions([]);
                }}
                className="w-full py-2.5 bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-200 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-98"
              >
                <Plus className="w-4 h-4 text-orange-600" />
                <span>+ เพิ่มเมนูใหม่ให้ร้านนี้</span>
              </button>
            ) : (
              <form onSubmit={handleAddMenuItemByAdmin} className="p-3.5 bg-orange-50/70 border border-orange-200 rounded-2xl space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-orange-950 flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-orange-600" /> เพิ่มเมนูใหม่
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingNewMenu(false);
                      setNewMenuImage('');
                      setNewMenuOptions([]);
                    }}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    ยกเลิก
                  </button>
                </div>

                {/* Image Picker Section */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-gray-700 flex items-center gap-1">
                      <Camera className="w-3.5 h-3.5 text-orange-600" /> รูปภาพเมนูอาหาร
                    </label>
                    {newMenuImage && (
                      <button
                        type="button"
                        onClick={() => setNewMenuImage('')}
                        className="text-[11px] text-red-500 font-semibold hover:underline"
                      >
                        ลบรูปภาพ
                      </button>
                    )}
                  </div>

                  {newMenuImage ? (
                    <div className="relative w-full h-36 rounded-2xl overflow-hidden border border-orange-200 shadow-2xs group">
                      <img src={newMenuImage} alt="Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setCropTarget('new_menu');
                            setRawImageForCrop(newMenuImage);
                          }}
                          className="px-3 py-1.5 bg-white text-gray-800 text-xs font-bold rounded-xl shadow-xs hover:bg-gray-100 transition flex items-center gap-1"
                        >
                          <Scissors className="w-3.5 h-3.5 text-orange-600" /> ตัดขอบใหม่
                        </button>
                        <button
                          type="button"
                          onClick={() => adminMenuImageInputRef.current?.click()}
                          className="px-3 py-1.5 bg-orange-600 text-white text-xs font-bold rounded-xl shadow-xs hover:bg-orange-700 transition flex items-center gap-1"
                        >
                          <Camera className="w-3.5 h-3.5" /> เปลี่ยนรูป
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => adminMenuImageInputRef.current?.click()}
                      className="w-full py-4 border-2 border-dashed border-orange-200 hover:border-orange-400 bg-white hover:bg-orange-50/50 rounded-2xl text-xs font-medium text-orange-900 flex flex-col items-center justify-center gap-1.5 transition active:scale-98"
                    >
                      <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-sm shadow-2xs">
                        
                      </div>
                      <span className="font-bold text-xs text-orange-950">เลือกรูป / ถ่ายรูปอาหาร (สี่เหลี่ยม 1:1)</span>
                      <span className="text-[10px] text-gray-400">รองรับการซูมและตัดขอบภาพให้พอดีสวยงาม</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-gray-600 block mb-1">ชื่อเมนู</label>
                    <input
                      type="text"
                      required
                      placeholder="เช่น ตำป่า, ผัดกะเพรา"
                      value={newMenuName}
                      onChange={(e) => setNewMenuName(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-600 block mb-1">ราคา (บาท)</label>
                    <input
                      type="number"
                      required
                      placeholder="เช่น 60"
                      value={newMenuPrice}
                      onChange={(e) => setNewMenuPrice(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-600 block mb-1">หมวดหมู่อาหาร</label>
                  <select
                    value={newMenuCategory}
                    onChange={(e) => setNewMenuCategory(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-xl"
                  >
                    <option value="food">หมวดอาหาร</option>
                    <option value="drink_dessert">หมวดเครื่องดื่ม/ของหวาน</option>
                  </select>
                </div>

                {/* Add Toppings / Options */}
                <div className="bg-white/90 p-2.5 rounded-xl border border-orange-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-orange-950 flex items-center gap-1">
                      ตัวเลือกเสริม / ท็อปปิ้ง (ไม่บังคับ)
                    </span>
                    <button
                      type="button"
                      onClick={() => setNewMenuOptions([...newMenuOptions, { name: '', price: 10 }])}
                      className="text-[10px] font-bold text-orange-700 bg-orange-100 hover:bg-orange-200 px-2 py-0.5 rounded-lg transition active:scale-95 flex items-center gap-0.5"
                    >
                      <Plus className="w-3 h-3" />
                      <span>เพิ่มท็อปปิ้ง</span>
                    </button>
                  </div>

                  {newMenuOptions.length === 0 ? (
                    <p className="text-[10px] text-gray-400 italic">
                      ยังไม่มีตัวเลือกเสริม (เช่น เพิ่มไข่ดาว, พิเศษ, เพิ่มไข่มุก) กดปุ่ม "+ เพิ่มท็อปปิ้ง"
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {newMenuOptions.map((opt, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 animate-in fade-in">
                          <input
                            type="text"
                            placeholder="ชื่อ เช่น ไข่ดาว"
                            value={opt.name}
                            onChange={(e) => {
                              const updated = [...newMenuOptions];
                              updated[idx].name = e.target.value;
                              setNewMenuOptions(updated);
                            }}
                            className="flex-1 px-2 py-1 text-xs bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-orange-500 font-medium"
                          />
                          <div className="flex items-center gap-1 w-20 shrink-0">
                            <input
                              type="number"
                              placeholder="+บาท"
                              value={opt.price}
                              onChange={(e) => {
                                const updated = [...newMenuOptions];
                                updated[idx].price = parseFloat(e.target.value) || 0;
                                setNewMenuOptions(updated);
                              }}
                              className="w-full px-1.5 py-1 text-xs bg-white border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-orange-500 text-right font-bold text-orange-600"
                            />
                            <span className="text-[10px] text-gray-400">฿</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setNewMenuOptions(newMenuOptions.filter((_, i) => i !== idx))}
                            className="p-1 text-gray-400 hover:text-red-500 rounded-md hover:bg-red-50 transition shrink-0"
                            title="ลบตัวเลือกนี้"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-1 border-t border-orange-200">
                  <button
                    type="button"
                    disabled={isSubmittingMenu}
                    onClick={() => {
                      setIsAddingNewMenu(false);
                      setNewMenuImage('');
                      setNewMenuOptions([]);
                    }}
                    className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-xl disabled:opacity-50"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingMenu}
                    className="px-4 py-1.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition active:scale-95 flex items-center gap-1 cursor-pointer"
                  >
                    {isSubmittingMenu ? (
                      <span>กำลังบันทึก...</span>
                    ) : (
                      <span>บันทึกเมนู</span>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Menu List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[360px]">
              {allMenuItems.filter((m) => m.shop_id === selectedShopForMenus.id).length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-xs">
                  ร้านนี้ยังไม่มีรายการเมนูอาหาร
                </div>
              ) : (
                allMenuItems
                  .filter((m) => m.shop_id === selectedShopForMenus.id)
                  .map((item) => (
                    <div
                      key={item.id}
                      className="p-3 bg-gray-50 rounded-2xl border border-gray-200 space-y-2.5 hover:border-gray-300 transition"
                    >
                      {editingMenuItem?.id === item.id ? (
                        /* Inline Edit Mode */
                        <div className="space-y-2 animate-in fade-in">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] font-bold text-gray-600 block mb-0.5">ชื่อเมนู</label>
                              <input
                                type="text"
                                value={editMenuItemName}
                                onChange={(e) => setEditMenuItemName(e.target.value)}
                                className="w-full px-2.5 py-1 text-xs bg-white border border-gray-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-gray-600 block mb-0.5">ราคา (บาท)</label>
                              <input
                                type="number"
                                value={editMenuItemPrice}
                                onChange={(e) => setEditMenuItemPrice(e.target.value)}
                                className="w-full px-2.5 py-1 text-xs bg-white border border-gray-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-gray-600 block mb-0.5">หมวดหมู่</label>
                            <select
                              value={editMenuItemCategory}
                              onChange={(e) => setEditMenuItemCategory(e.target.value as any)}
                              className="w-full px-2.5 py-1 text-xs bg-white border border-gray-300 rounded-xl focus:outline-hidden"
                            >
                              <option value="food">อาหาร</option>
                              <option value="drink_dessert">เครื่องดื่ม/ของหวาน</option>
                            </select>
                          </div>

                          {/* Edit Toppings */}
                          <div className="bg-orange-50/70 p-2.5 rounded-xl border border-orange-200 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-zinc-900 flex items-center gap-1.5"><Sparkles className="w-3 h-3 text-[#FF8500]" /> ท็อปปิ้ง / ตัวเลือกเสริม</span>
                              <button
                                type="button"
                                onClick={() => setEditMenuItemOptions([...editMenuItemOptions, { name: '', price: 10 }])}
                                className="text-[10px] font-bold text-orange-700 bg-white px-2 py-0.5 rounded-lg border border-orange-200 hover:bg-orange-100 transition active:scale-95"
                              >
                                + เพิ่มท็อปปิ้ง
                              </button>
                            </div>
                            {editMenuItemOptions.length === 0 ? (
                              <p className="text-[10px] text-gray-400 italic">ยังไม่มีท็อปปิ้ง</p>
                            ) : (
                              <div className="space-y-1">
                                {editMenuItemOptions.map((opt, oIdx) => (
                                  <div key={oIdx} className="flex items-center gap-1">
                                    <input
                                      type="text"
                                      placeholder="ชื่อ เช่น ไข่ดาว"
                                      value={opt.name}
                                      onChange={(e) => {
                                        const updated = [...editMenuItemOptions];
                                        updated[oIdx].name = e.target.value;
                                        setEditMenuItemOptions(updated);
                                      }}
                                      className="flex-1 px-2 py-1 text-xs bg-white border border-gray-200 rounded-lg"
                                    />
                                    <input
                                      type="number"
                                      placeholder="+บาท"
                                      value={opt.price}
                                      onChange={(e) => {
                                        const updated = [...editMenuItemOptions];
                                        updated[oIdx].price = parseFloat(e.target.value) || 0;
                                        setEditMenuItemOptions(updated);
                                      }}
                                      className="w-16 px-1.5 py-1 text-xs bg-white border border-gray-200 rounded-lg text-right font-bold text-orange-600"
                                    />
                                    <span className="text-[10px] text-gray-400">฿</span>
                                    <button
                                      type="button"
                                      onClick={() => setEditMenuItemOptions(editMenuItemOptions.filter((_, i) => i !== oIdx))}
                                      className="p-1 text-gray-400 hover:text-red-500 rounded-md"
                                      title="ลบตัวเลือกนี้"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="flex justify-end gap-1.5 pt-1 border-t border-gray-200">
                            <button
                              type="button"
                              onClick={() => setEditingMenuItem(null)}
                              className="px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-200 rounded-xl font-medium"
                            >
                              ยกเลิก
                            </button>
                            <button
                              type="button"
                              onClick={handleSaveEditMenuItem}
                              className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl shadow-xs"
                            >
                              บันทึก
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* View Mode */
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {/* Thumbnail with camera button overlay */}
                            <div className="relative group/img shrink-0">
                              {item.image_url ? (
                                <img
                                  key={item.image_url}
                                  src={item.image_url}
                                  alt=""
                                  className="w-12 h-12 rounded-xl object-cover ring-1 ring-gray-200 shadow-2xs"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-xl bg-orange-100 text-orange-600 font-bold text-base flex items-center justify-center">
                                  {item.category === 'drink_dessert' ? <Coffee className="w-5 h-5 text-zinc-400" /> : <Utensils className="w-5 h-5 text-zinc-400" />}
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingMenuItemForImage(item);
                                  editingMenuItemForImageRef.current = item;
                                  setCropTarget('edit_menu');
                                  adminMenuEditImageInputRef.current?.click();
                                }}
                                className="absolute inset-0 bg-black/60 text-white rounded-xl opacity-0 group-hover/img:opacity-100 transition flex flex-col items-center justify-center text-[9px] font-bold"
                                title="คลิกเพื่อเปลี่ยนรูปอาหาร"
                              >
                                <Camera className="w-3.5 h-3.5 mb-0.5" />
                                <span>{item.image_url ? 'เปลี่ยนรูป' : 'ใส่รูป'}</span>
                              </button>
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-gray-800 truncate">{item.name}</p>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <span className="text-xs font-extrabold text-orange-600">{item.price} บาท</span>
                                <span
                                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                    item.is_available ?? true
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-red-100 text-red-800'
                                  }`}
                                >
                                  {item.is_available ?? true ? 'มีของ' : 'ของหมด'}
                                </span>
                                {!item.image_url ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingMenuItemForImage(item);
                                      editingMenuItemForImageRef.current = item;
                                      setCropTarget('edit_menu');
                                      adminMenuEditImageInputRef.current?.click();
                                    }}
                                    className="text-[10px] text-orange-600 hover:underline font-semibold flex items-center gap-0.5 cursor-pointer"
                                  >
                                    <Camera className="w-2.5 h-2.5" /> + ใส่รูป
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleAdminRemoveMenuImage(item)}
                                    className="text-[10px] text-rose-500 hover:underline font-semibold flex items-center gap-0.5 cursor-pointer"
                                    title="ลบรูปภาพเมนูนี้"
                                  >
                                    <Trash2 className="w-2.5 h-2.5" /> ลบรูป
                                  </button>
                                )}
                              </div>
                              {item.options && item.options.length > 0 && (
                                <div className="text-[10px] text-orange-700 bg-orange-100/60 px-2 py-0.5 rounded-md mt-1 border border-orange-200/60 inline-flex items-center gap-1 max-w-full">
                                  <span className="font-semibold shrink-0 flex items-center gap-1"><Sparkles className="w-3 h-3 text-[#FF8500]" /> ท็อปปิ้ง ({item.options.length}):</span>
                                  <span className="truncate">{item.options.map((o) => `${o.name} (+${o.price}฿)`).join(', ')}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {/* Edit details button */}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingMenuItem(item);
                                setEditMenuItemName(item.name);
                                setEditMenuItemPrice(String(item.price));
                                setEditMenuItemCategory(item.category || 'food');
                                setEditMenuItemOptions(item.options ? JSON.parse(JSON.stringify(item.options)) : []);
                              }}
                              className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition"
                              title="แก้ไขชื่อ/ราคาเมนู"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Toggle stock */}
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await updateDoc(doc(db, 'menu_items', item.id), {
                                    is_available: !(item.is_available ?? true),
                                  });
                                  setAllMenuItems((prev) =>
                                    prev.map((m) =>
                                      m.id === item.id ? { ...m, is_available: !(item.is_available ?? true) } : m
                                    )
                                  );
                                } catch (e) {
                                  console.error(e);
                                }
                              }}
                              className={`px-2 py-1 text-[11px] font-bold rounded-xl border transition ${
                                item.is_available ?? true
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                              }`}
                            >
                              {item.is_available ?? true ? 'สลับของหมด' : 'สลับมีของ'}
                            </button>

                            {/* Delete menu item */}
                            <button
                              type="button"
                              onClick={async () => {
                                if (confirm(`ยืนยันการลบเมนู "${item.name}" หรือไม่?`)) {
                                  try {
                                    await deleteDoc(doc(db, 'menu_items', item.id));
                                    setAllMenuItems((prev) => prev.filter((m) => m.id !== item.id));
                                  } catch (e) {
                                    console.error(e);
                                  }
                                }
                              }}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition"
                              title="ลบเมนูนี้"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setSelectedShopForMenus(null);
                  setIsAddingNewMenu(false);
                }}
                className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top-Up Merchant Credit Modal */}
      {selectedShopForCredit && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-gray-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <h3 className="font-black text-base text-gray-900 flex items-center gap-1.5">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                  <span>เติม / ปรับยอดเครดิตร้านค้า</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">ร้าน: {selectedShopForCredit.name}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedShopForCredit(null);
                  setCreditError(null);
                }}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-150 flex items-center justify-between text-xs">
              <span className="text-gray-500 font-medium">ยอดเครดิตปัจจุบัน:</span>
              <span
                className={`text-base font-black ${
                  (selectedShopForCredit.credit_balance ?? 0) < 0 ? 'text-rose-600' : 'text-emerald-700'
                }`}
              >
                ฿{(selectedShopForCredit.credit_balance ?? 0).toFixed(2)}
              </span>
            </div>

            <form onSubmit={handleTopUpCreditSubmit} className="space-y-4">
              {/* Type Switcher */}
              <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setTopupType('topup')}
                  className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                    topupType === 'topup'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <span>+ เติมเครดิต (เพิ่มยอด)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTopupType('deduct')}
                  className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                    topupType === 'deduct'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <span>- ปรับลด (หักยอด)</span>
                </button>
              </div>

              {/* Amount Input */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  จำนวนเงิน (บาท)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">
                    ฿
                  </span>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    required
                    value={topupAmount}
                    onChange={(e) => setTopupAmount(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-base font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="100"
                  />
                </div>
              </div>

              {/* Quick Amount Buttons */}
              <div className="flex gap-1.5">
                {['50', '100', '200', '500', '1000'].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setTopupAmount(amt)}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      topupAmount === amt
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    +{amt}
                  </button>
                ))}
              </div>

              {/* Note / Memo */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  หมายเหตุ / บันทึกช่วยจำ (ไม่บังคับ)
                </label>
                <input
                  type="text"
                  value={topupNote}
                  onChange={(e) => setTopupNote(e.target.value)}
                  className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="เช่น ร้านโอนผ่านกสิกรไทย 14:30 น."
                />
              </div>

              {creditError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
                  {creditError}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedShopForCredit(null);
                    setCreditError(null);
                  }}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-2xl transition cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCredit}
                  className={`flex-1 py-2.5 font-bold text-xs rounded-2xl text-white shadow-md transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer ${
                    topupType === 'topup'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {isSubmittingCredit ? (
                    <span>กำลังบันทึก...</span>
                  ) : (
                    <span>ยืนยัน{topupType === 'topup' ? 'เติมเครดิต' : 'ปรับลดยอด'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Admin View & Edit Merchant Credentials Modal */}
      {selectedShopForCredentials && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150 border border-gray-100 my-8">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-150">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-gray-900">
                    ข้อมูลเข้าสู่ระบบร้านค้า
                  </h3>
                  <p className="text-xs text-gray-500 font-medium">
                    ร้าน: {selectedShopForCredentials.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedShopForCredentials(null);
                  setCredError('');
                  setCredSuccess('');
                }}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Fetching loading state */}
            {isFetchingCreds ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-purple-600">
                <div className="w-7 h-7 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-bold text-gray-600">กำลังดึงข้อมูลบัญชีร้านค้า...</span>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Current Active Credentials Card */}
                <div className="bg-gradient-to-br from-purple-50 to-indigo-50/50 p-4 rounded-2xl border border-purple-100 space-y-3">
                  <span className="text-xs font-black text-purple-950 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-purple-600" />
                    ข้อมูลที่บันทึกไว้ในปัจจุบัน
                  </span>

                  {/* Email */}
                  <div className="bg-white p-2.5 rounded-xl border border-purple-100 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] text-gray-400 font-bold block">อีเมลเข้าระบบ</span>
                      <span className="text-xs font-mono font-bold text-gray-800 break-all select-all">
                        {merchantCredEmail || '(ยังไม่มีอีเมล)'}
                      </span>
                    </div>
                    {merchantCredEmail && (
                      <button
                        type="button"
                        onClick={() => handleCopyCred(merchantCredEmail, 'email')}
                        className="px-2 py-1 bg-purple-100 hover:bg-purple-200 text-purple-800 font-bold text-[11px] rounded-lg transition shrink-0 flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{copiedCredField === 'email' ? 'คัดลอกแล้ว!' : 'คัดลอก'}</span>
                      </button>
                    )}
                  </div>

                  {/* Password */}
                  <div className="bg-white p-2.5 rounded-xl border border-purple-100 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] text-gray-400 font-bold block">รหัสผ่าน</span>
                      {merchantCredPassword ? (
                        <span className="text-xs font-mono font-bold text-gray-800 break-all select-all">
                          {showCredPassword ? merchantCredPassword : '••••••••••••'}
                        </span>
                      ) : (
                        <span className="text-[11px] text-amber-700 italic block mt-0.5">
                          (ยังไม่ได้บันทึกรหัสผ่านเดิม สามารถตั้งรหัสผ่านใหม่ด้านล่างนี้ได้ทันที)
                        </span>
                      )}
                    </div>
                    {merchantCredPassword && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setShowCredPassword(!showCredPassword)}
                          className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition cursor-pointer"
                          title={showCredPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                        >
                          {showCredPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyCred(merchantCredPassword, 'password')}
                          className="px-2 py-1 bg-purple-100 hover:bg-purple-200 text-purple-800 font-bold text-[11px] rounded-lg transition flex items-center gap-1 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{copiedCredField === 'password' ? 'คัดลอกแล้ว!' : 'คัดลอก'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Edit Form */}
                <form onSubmit={handleSaveCredentials} className="space-y-3 pt-1 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-gray-800">
                      แก้ไข / เปลี่ยนอีเมลและรหัสผ่าน
                    </span>
                    <span className="text-[10px] text-gray-400">
                      (ซิงค์กับระบบล็อกอินทันที)
                    </span>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-gray-700 block mb-1">
                      อีเมลร้านค้า
                    </label>
                    <input
                      type="email"
                      value={editCredEmail}
                      onChange={(e) => setEditCredEmail(e.target.value)}
                      placeholder="เช่น shop@huaychan.com"
                      className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-gray-700 block mb-1">
                      ตั้งรหัสผ่านใหม่ <span className="text-gray-400 font-normal">(เว้นว่างไว้หากไม่ต้องการเปลี่ยน)</span>
                    </label>
                    <input
                      type="text"
                      value={editCredPassword}
                      onChange={(e) => setEditCredPassword(e.target.value)}
                      placeholder="รหัสผ่านใหม่อย่างน้อย 6 ตัวอักษร"
                      className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono font-medium"
                    />
                  </div>

                  {credError && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                      <span>{credError}</span>
                    </div>
                  )}

                  {credSuccess && (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                      <span>{credSuccess}</span>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      disabled={isSavingCreds}
                      onClick={() => {
                        setSelectedShopForCredentials(null);
                        setCredError('');
                        setCredSuccess('');
                      }}
                      className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition cursor-pointer"
                    >
                      ปิด
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingCreds}
                      className="flex-1 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isSavingCreds ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>กำลังบันทึก...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>บันทึกการเปลี่ยนแปลง</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hidden file inputs for Admin */}
      <input
        ref={adminShopCoverInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleAdminShopCoverFileChange}
      />
      <input
        ref={adminMenuImageInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleAdminMenuImageFileChange}
      />
      <input
        ref={adminMenuEditImageInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleAdminMenuEditFileChange}
      />

      {/* Admin Image Crop Modal (renders on top of all modals) */}
      {rawImageForCrop && (
        <ImageCropModal
          imageSrc={rawImageForCrop}
          title={
            (cropTargetRef.current || cropTarget) === 'shop_cover'
              ? `ตัดขอบรูปหน้าร้าน "${(selectedShopForCrop || selectedShopForCropRef.current)?.name || ''}" (แนวนอน 16:9)`
              : (cropTargetRef.current || cropTarget) === 'edit_menu'
              ? `ตัดขอบรูปเมนู "${(editingMenuItemForImage || editingMenuItemForImageRef.current)?.name || ''}" (สี่เหลี่ยมจัตุรัส 1:1)`
              : 'ตัดขอบรูปภาพอาหาร/เครื่องดื่ม (สี่เหลี่ยมจัตุรัส 1:1)'
          }
          initialAspectRatio={(cropTargetRef.current || cropTarget) === 'shop_cover' ? '16:9' : '1:1'}
          onCropComplete={handleAdminCropComplete}
          onCancel={() => {
            setRawImageForCrop(null);
            if ((cropTargetRef.current || cropTarget) === 'shop_cover') {
              setSelectedShopForCrop(null);
              selectedShopForCropRef.current = null;
            }
            if ((cropTargetRef.current || cropTarget) === 'edit_menu') {
              setEditingMenuItemForImage(null);
              editingMenuItemForImageRef.current = null;
            }
          }}
        />
      )}
    </div>
  );
}
