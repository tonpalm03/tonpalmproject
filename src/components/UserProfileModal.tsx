'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  X, Camera, User, Phone, ShieldCheck, Store, Bike, LogOut, Check, Edit2, Sparkles, Image as ImageIcon, MapPin, Navigation, Trash2, RefreshCw, FileText, MessageSquare
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import ImageCropModal from './ImageCropModal';
import MapPicker from './MapPicker';
import TermsModal from './TermsModal';
import ContactModal from './ContactModal';
import UserAvatar, { getUserCode, isCustomAvatar } from './UserAvatar';
import { readFileAsDataUrl } from '@/lib/imageUtils';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenOrderHistory?: () => void;
}

export default function UserProfileModal({ isOpen, onClose, onOpenOrderHistory }: UserProfileModalProps) {
  const { user, role, updateUserProfile, logout } = useAuth();

  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [showAddressPicker, setShowAddressPicker] = useState(false);

  // Address & Map Pin State
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [defaultAddress, setDefaultAddress] = useState('');
  const [defaultLocation, setDefaultLocation] = useState<{ lat: number; lng: number }>({
    lat: 15.8272,
    lng: 102.0298,
  });
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  // Profile Image Cropping state
  const [rawImageForCrop, setRawImageForCrop] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync state when modal opens
  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name || '');
      setPhone(user.phone || '');
      setDefaultAddress(user.default_address || '');
      if (user.default_location?.lat && user.default_location?.lng) {
        setDefaultLocation(user.default_location);
      }
    }
  }, [user, isOpen]);

  if (!isOpen || !user) return null;

  // Handle Photo Selection
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const input = e.target;

    try {
      const result = await readFileAsDataUrl(file);
      setRawImageForCrop(result);
    } catch (err: any) {
      console.error('Profile photo read error:', err);
      alert(err.message || 'ไม่สามารถอ่านไฟล์รูปภาพได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      input.value = '';
    }
  };

  // Handle Crop Complete & Save to Firestore
  const handleCropComplete = async (croppedDataUrl: string) => {
    try {
      setIsSaving(true);
      await updateUserProfile({ picture_url: croppedDataUrl });
      alert('อัปเดตรูปโปรไฟล์สำเร็จแล้ว!');
    } catch (e) {
      console.error('Update profile picture error:', e);
      alert('เกิดข้อผิดพลาดในการบันทึกรูปโปรไฟล์');
    } finally {
      setIsSaving(false);
      setRawImageForCrop(null);
    }
  };

  // Handle Remove Profile Picture (revert to default white silhouette avatar)
  const handleRemoveAvatar = async () => {
    if (!confirm('คุณต้องการลบรูปโปรไฟล์ และกลับไปใช้รูปเริ่มต้นใช่หรือไม่?')) {
      return;
    }
    try {
      setIsSaving(true);
      await updateUserProfile({ picture_url: '' });
      alert('ลบรูปโปรไฟล์เรียบร้อยแล้ว');
    } catch (e) {
      console.error('Remove profile picture error:', e);
      alert('เกิดข้อผิดพลาดในการลบรูปโปรไฟล์');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Name & Phone Update
  const handleSaveInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      alert('กรุณากรอกชื่อโปรไฟล์');
      return;
    }

    try {
      setIsSaving(true);
      await updateUserProfile({
        display_name: displayName.trim(),
        phone: phone.trim(),
      });
      setIsEditingInfo(false);
      alert('บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว!');
    } catch (e) {
      console.error('Update profile info error:', e);
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Address & Location Update
  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!defaultAddress.trim()) {
      alert('กรุณาระบุรายละเอียดที่อยู่จัดส่ง');
      return;
    }

    try {
      setIsSavingAddress(true);
      await updateUserProfile({
        default_address: defaultAddress.trim(),
        default_location: defaultLocation,
      });
      setIsEditingAddress(false);
      alert('บันทึกที่อยู่และหมุดพิกัดจัดส่งสำเร็จแล้ว!');
    } catch (e) {
      console.error('Update address error:', e);
      alert('เกิดข้อผิดพลาดในการบันทึกที่อยู่');
    } finally {
      setIsSavingAddress(false);
    }
  };

  const handleLogout = async () => {
    if (confirm('คุณต้องการออกจากระบบหรือไม่?')) {
      onClose();
      await logout();
    }
  };

  const [isClearingCache, setIsClearingCache] = useState(false);
  const handleClearCache = async () => {
    if (confirm('คุณต้องการล้างแคชและรีโหลดข้อมูลล่าสุดใช่หรือไม่? (ช่วยแก้ปัญหาภาพหรือข้อมูลไม่อัปเดต)')) {
      try {
        setIsClearingCache(true);
        if (typeof window !== 'undefined') {
          if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => caches.delete(k)));
          }
          if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            for (const r of regs) {
              await r.unregister();
            }
          }
          localStorage.removeItem('huaychan_build_version');
          window.location.reload();
        }
      } catch (err) {
        console.error('Clear cache error:', err);
        window.location.reload();
      }
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200 border border-gray-150 relative">
          
          {/* Top Banner with Gradient */}
          <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 p-6 text-white text-center relative overflow-hidden">
            {/* Background Decorative Blob */}
            <div className="absolute -right-8 -top-8 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none" />
            <div className="absolute -left-8 -bottom-8 w-28 h-28 bg-black/10 rounded-full blur-xl pointer-events-none" />

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-black/20 hover:bg-black/35 flex items-center justify-center text-white transition active:scale-95"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Avatar with Camera Overlay */}
            <div className="relative mx-auto w-24 h-24 mb-3">
              <div className="w-full h-full rounded-full p-1 bg-white/30 backdrop-blur-xs shadow-xl">
                <div className="w-full h-full rounded-full overflow-hidden ring-2 ring-white shadow-inner bg-slate-200">
                  <UserAvatar src={user.picture_url} alt={user.display_name} />
                </div>
              </div>

              {/* Camera Icon Button on Avatar */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-white hover:bg-amber-50 text-gray-800 shadow-lg flex items-center justify-center border-2 border-amber-500 active:scale-90 transition cursor-pointer"
                title="เปลี่ยนรูปโปรไฟล์"
              >
                <Camera className="w-4 h-4 text-amber-600" />
              </button>

              {/* Delete Icon Button on Avatar if user has custom picture */}
              {isCustomAvatar(user.picture_url) && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={isSaving}
                  className="absolute bottom-0 left-0 w-8 h-8 rounded-full bg-white hover:bg-rose-50 text-rose-600 shadow-lg flex items-center justify-center border-2 border-rose-500 active:scale-90 transition cursor-pointer"
                  title="ลบรูปโปรไฟล์ (กลับไปใช้รูปเริ่มต้น)"
                >
                  <Trash2 className="w-4 h-4 text-rose-600" />
                </button>
              )}
            </div>

            {/* User Name */}
            <h3 className="text-xl font-black text-white drop-shadow-sm truncate">
              {user.display_name}
            </h3>

            {/* Role Badge - Only show for merchant and admin */}
            {(role === 'admin' || role === 'merchant') && (
              <div className="mt-1.5 flex items-center justify-center gap-1.5">
                {role === 'admin' ? (
                  <span className="inline-flex items-center gap-1 bg-rose-500/80 text-white border border-rose-300/40 text-[11px] font-bold px-3 py-0.5 rounded-full shadow-2xs">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>ผู้ดูแลระบบ (Super Admin)</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 bg-emerald-600/80 text-white border border-emerald-300/40 text-[11px] font-bold px-3 py-0.5 rounded-full shadow-2xs">
                    <Store className="w-3.5 h-3.5" />
                    <span>ร้านค้าชุมชน (Merchant)</span>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Modal Body */}
          <div className="p-5 space-y-3.5 overflow-y-auto flex-1 max-h-[68vh]">
            {/* 1. Photo Action Buttons */}
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2.5 px-4 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition active:scale-98 shadow-xs cursor-pointer"
              >
                <Camera className="w-4 h-4 text-amber-600" />
                <span>เปลี่ยนรูปโปรไฟล์ (ตัดขอบได้อิสระ)</span>
              </button>

              {isCustomAvatar(user.picture_url) && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={isSaving}
                  className="w-full py-2 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-98 shadow-xs cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>ลบรูปโปรไฟล์ (ใช้รูปคนสีขาวเริ่มต้น)</span>
                </button>
              )}
            </div>

            {/* 2. Account Details Card */}
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-150 space-y-3">
              {!isEditingInfo ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                      ข้อมูลโปรไฟล์
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsEditingInfo(true)}
                      className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>แก้ไข</span>
                    </button>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between py-1 border-b border-gray-100">
                      <span className="text-gray-500 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-gray-400" /> ชื่อแสดง:
                      </span>
                      <strong className="text-gray-800 font-bold">{user.display_name}</strong>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-gray-100">
                      <span className="text-gray-500 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-gray-400" /> เบอร์โทรศัพท์:
                      </span>
                      <strong className="text-gray-800 font-bold">
                        {user.phone || <span className="text-gray-400 font-normal">ยังไม่ได้ระบุ</span>}
                      </strong>
                    </div>

                    <div className="flex items-center justify-between py-1">
                      <span className="text-gray-500">User ID:</span>
                      <span className="text-xs font-mono font-bold text-gray-700 bg-gray-200/70 px-2.5 py-0.5 rounded-lg border border-gray-200">
                        #{getUserCode(user)}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <form onSubmit={handleSaveInfo} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-gray-700">แก้ไขข้อมูล</span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingInfo(false);
                        setDisplayName(user.display_name || '');
                        setPhone(user.phone || '');
                      }}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      ยกเลิก
                    </button>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-gray-600 block mb-1">
                      ชื่อแสดงในแอพ:
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium"
                      placeholder="เช่น น้องต้นปาล์ม"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-gray-600 block mb-1">
                      เบอร์โทรศัพท์ (สำหรับคนส่งโทรหา):
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium"
                      placeholder="08x-xxx-xxxx"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1 shadow-xs transition"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}</span>
                  </button>
                </form>
              )}
            </div>

            {/* 3. Default Delivery Address & Map Pin Card */}
            <div className="bg-amber-50/60 rounded-2xl p-4 border border-amber-200/80 space-y-3">
              {!isEditingAddress ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-amber-600" />
                      ที่อยู่จัดส่งและหมุดเริ่มต้น
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsEditingAddress(true)}
                      className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-amber-200 shadow-2xs transition active:scale-95"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>{user.default_address ? 'แก้ไข' : 'ปักหมุด'}</span>
                    </button>
                  </div>

                  {user.default_address ? (
                    <div className="space-y-2 text-xs">
                      <p className="font-semibold text-gray-800 bg-white p-2.5 rounded-xl border border-amber-100 leading-relaxed shadow-2xs">
                        {user.default_address}
                      </p>
                      <div className="flex items-center justify-between text-[11px] text-gray-500 pt-0.5">
                        <span className="flex items-center gap-1 text-[10px]">
                          <Navigation className="w-3 h-3 text-amber-600" />
                          พิกัด: {user.default_location?.lat?.toFixed(4) || defaultLocation.lat.toFixed(4)}, {user.default_location?.lng?.toFixed(4) || defaultLocation.lng.toFixed(4)}
                        </span>
                        <span className="text-[10px] text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full font-bold">
                          พร้อมใช้สั่งอาหาร
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-2 text-xs text-amber-800">
                      <p className="text-[11px] text-gray-500 mb-2">ยังไม่ได้บันทึกที่อยู่จัดส่งเริ่มต้น (บันทึกไว้เพื่อความสะดวกรวดเร็วในการสั่งอาหาร)</p>
                      <button
                        type="button"
                        onClick={() => setIsEditingAddress(true)}
                        className="py-1.5 px-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-xs shadow-xs transition active:scale-95 inline-flex items-center gap-1"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        <span>ปักหมุดและบันทึกที่อยู่</span>
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <form onSubmit={handleSaveAddress} className="space-y-3">
                  <div className="flex items-center justify-between border-b border-amber-200 pb-1.5">
                    <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-amber-600" />
                      ปักหมุด & บันทึกที่อยู่เริ่มต้น
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingAddress(false);
                        setDefaultAddress(user.default_address || '');
                        if (user.default_location) setDefaultLocation(user.default_location);
                      }}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      ยกเลิก
                    </button>
                  </div>

                  {/* Interactive Map Picker */}
                  <div>
                    <label className="text-[11px] font-bold text-gray-700 block mb-1">
                      ปักหมุดตำแหน่ง (ลากหมุดหรือกด "ตำแหน่งของฉัน"):
                    </label>
                    <MapPicker
                      location={defaultLocation}
                      onChange={setDefaultLocation}
                      title="หมุดที่อยู่ประจำของคุณ"
                    />
                  </div>

                  {/* Textarea for detailed address */}
                  <div>
                    <label className="text-[11px] font-bold text-gray-700 block mb-1">
                      รายละเอียดที่อยู่ (หอพัก / บ้าน / จุดส่ง):
                    </label>
                    <textarea
                      rows={2}
                      value={defaultAddress}
                      onChange={(e) => setDefaultAddress(e.target.value)}
                      placeholder="เช่น หอพักพรเทพ ห้อง 204 ซอยข้าง 7-11 หรือ ใต้ตึก 5 คณะครุศาสตร์"
                      required
                      className="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSavingAddress}
                    className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1 shadow-xs transition active:scale-98"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isSavingAddress ? 'กำลังบันทึก...' : 'บันทึกที่อยู่จัดส่ง'}</span>
                  </button>
                </form>
              )}
            </div>

            {/* Order History Button (Customer) */}
            {onOpenOrderHistory && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenOrderHistory();
                }}
                className="w-full py-2.5 px-4 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center justify-between transition active:scale-98 shadow-xs"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-white" />
                  <span>ประวัติการสั่งซื้อของฉัน (สั่งซ้ำได้)</span>
                </div>
                <span className="text-[11px] bg-white/20 px-2 py-0.5 rounded-full font-bold">ดูรายการ</span>
              </button>
            )}

            {/* Contact Us Button */}
            <button
              type="button"
              onClick={() => setShowContact(true)}
              className="w-full py-2.5 px-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100 text-emerald-900 font-bold text-xs flex items-center justify-between transition active:scale-98"
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-700" />
                <span>ติดต่อเรา / ฝ่ายบริการ (LINE แอดมิน)</span>
              </div>
              <span className="text-[11px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded-full">แอดไลน์</span>
            </button>

            {/* Terms of Service Button */}
            <button
              type="button"
              onClick={() => setShowTerms(true)}
              className="w-full py-2.5 px-4 rounded-2xl border border-gray-200 text-gray-700 hover:bg-gray-50 font-bold text-xs flex items-center justify-between transition active:scale-98"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-500" />
                <span>ข้อกำหนดและนโยบายการให้บริการ</span>
              </div>
              <span className="text-[11px] text-amber-600 font-semibold">แตะเพื่อดู</span>
            </button>

            {/* Clear Cache & Force Update Button */}
            <button
              type="button"
              onClick={handleClearCache}
              disabled={isClearingCache}
              className="w-full py-2.5 px-4 rounded-2xl border border-amber-300 bg-amber-50/70 hover:bg-amber-100 text-amber-900 font-bold text-xs flex items-center justify-between transition active:scale-98"
            >
              <div className="flex items-center gap-2">
                <RefreshCw className={`w-3.5 h-3.5 text-amber-600 ${isClearingCache ? 'animate-spin' : ''}`} />
                <span>ล้างแคชและอัปเดตข้อมูลล่าสุด</span>
              </div>
              <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full font-bold">รีเฟรช</span>
            </button>

            {/* 4. Logout Button */}
            <button
              type="button"
              onClick={handleLogout}
              className="w-full py-2.5 px-4 rounded-2xl border border-red-200 text-red-600 hover:bg-red-50 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-98"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>ออกจากระบบ</span>
            </button>
          </div>
        </div>
      </div>

      {/* Terms Modal */}
      <TermsModal
        isOpen={showTerms}
        onClose={() => setShowTerms(false)}
        defaultTab="customer"
        onOpenContact={() => setShowContact(true)}
      />

      {/* Contact Modal */}
      <ContactModal
        isOpen={showContact}
        onClose={() => setShowContact(false)}
      />

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={handlePhotoSelect}
      />

      {/* Profile Image Crop Modal */}
      {rawImageForCrop && (
        <ImageCropModal
          imageSrc={rawImageForCrop}
          title="ตัดขอบรูปโปรไฟล์ของคุณ"
          initialAspectRatio="1:1"
          onCropComplete={handleCropComplete}
          onCancel={() => setRawImageForCrop(null)}
        />
      )}
    </>
  );
}
