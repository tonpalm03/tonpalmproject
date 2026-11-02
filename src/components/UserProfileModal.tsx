'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  X, Camera, User, Phone, ShieldCheck, Store, Bike, LogOut, Check, Edit2, Sparkles, Image as ImageIcon, MapPin, Navigation, Trash2, FileText, MessageSquare
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import ImageCropModal from './ImageCropModal';
import MapPicker from './MapPicker';
import { DEFAULT_CAMPUS_LOCATION } from '@/lib/geolocation';
import AndroidInstallLink from './AndroidInstallLink';
import TermsModal from './TermsModal';
import ContactModal from './ContactModal';
import UserAvatar, { getUserCode, isCustomAvatar } from './UserAvatar';
import { readFileAsDataUrl } from '@/lib/imageUtils';
import MascotWatermark from './MascotWatermark';
import WavePattern from './WavePattern';

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
  const [defaultLocation, setDefaultLocation] = useState<{ lat: number; lng: number }>(DEFAULT_CAMPUS_LOCATION);
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
      const res = await updateUserProfile({ picture_url: croppedDataUrl });
      if (res && !res.success) {
        alert(res.error || 'เกิดข้อผิดพลาดในการบันทึกรูปโปรไฟล์');
      } else {
        alert('อัปเดตรูปโปรไฟล์สำเร็จแล้ว!');
      }
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
      const res = await updateUserProfile({ picture_url: '' });
      if (res && !res.success) {
        alert(res.error || 'เกิดข้อผิดพลาดในการลบรูปโปรไฟล์');
      } else {
        alert('ลบรูปโปรไฟล์เรียบร้อยแล้ว');
      }
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
      const res = await updateUserProfile({
        display_name: displayName.trim(),
        phone: phone.trim(),
      });
      if (res && !res.success) {
        alert(res.error || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
        return;
      }
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
      const res = await updateUserProfile({
        default_address: defaultAddress.trim(),
        default_location: defaultLocation,
      });
      if (res && !res.success) {
        alert(res.error || 'เกิดข้อผิดพลาดในการบันทึกที่อยู่');
        return;
      }
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

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200 border border-gray-150 relative">
          <MascotWatermark page="profile" />
          
          {/* Top Banner with Gradient */}
          <div className="bg-gradient-to-br from-[#E3F5D9] to-[#D3F0C2] border-b border-[#B0E294] p-6 text-[#14361C] text-center relative overflow-hidden isolate">
            <WavePattern className="text-white/90 -z-10" />

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-white hover:bg-brand-50 border border-[#B0E294] flex items-center justify-center text-[#177A34] transition active:scale-95"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Avatar with Camera Overlay */}
            <div className="relative mx-auto w-24 h-24 mb-3">
              <div className="w-full h-full rounded-full p-1 bg-white shadow-md">
                <div className="w-full h-full rounded-full overflow-hidden ring-2 ring-white shadow-inner bg-slate-200">
                  <UserAvatar src={user.picture_url} alt={user.display_name} />
                </div>
              </div>

              {/* Camera Icon Button on Avatar */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-white hover:bg-brand-50 text-gray-800 shadow-lg flex items-center justify-center border-2 border-brand-500 active:scale-90 transition cursor-pointer"
                title="เปลี่ยนรูปโปรไฟล์"
              >
                <Camera className="w-4 h-4 text-brand-600" />
              </button>

              {/* Delete Icon Button on Avatar if user has custom picture */}
              {isCustomAvatar(user.picture_url) && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={isSaving}
                  className="absolute bottom-0 left-0 w-8 h-8 rounded-full bg-white hover:bg-rose-50 text-rose-600 shadow-lg flex items-center justify-center border-2 border-rose-500 active:scale-90 transition cursor-pointer"
                  title="ลบรูปโปรไฟล์"
                >
                  <Trash2 className="w-4 h-4 text-rose-600" />
                </button>
              )}
            </div>

            {/* User Name */}
            <h3 className="text-xl font-black text-[#14361C] truncate">
              {user.display_name}
            </h3>

            {/* Role Badge - Only show for merchant and admin */}
            {(role === 'admin' || role === 'merchant') && (
              <div className="mt-1.5 flex items-center justify-center gap-1.5">
                {role === 'admin' ? (
                  <span className="inline-flex items-center gap-1 bg-white text-[#177A34] border border-[#B0E294] text-xs font-bold px-3 py-0.5 rounded-full shadow-2xs">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>ผู้ดูแลระบบ (Super Admin)</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 bg-white text-[#177A34] border border-[#B0E294] text-xs font-bold px-3 py-0.5 rounded-full shadow-2xs">
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
                className="w-full py-2.5 px-4 bg-brand-50 hover:bg-brand-100 text-brand-900 border border-brand-200 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition active:scale-98 shadow-xs cursor-pointer"
              >
                <Camera className="w-4 h-4 text-brand-600" />
                <span>เปลี่ยนรูปโปรไฟล์</span>
              </button>

              {isCustomAvatar(user.picture_url) && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={isSaving}
                  className="w-full py-2 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-98 shadow-xs cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>ลบรูปโปรไฟล์</span>
                </button>
              )}
            </div>

            {/* 2. Account Details Card */}
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-150 space-y-3">
              {!isEditingInfo ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      ข้อมูลโปรไฟล์
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsEditingInfo(true)}
                      className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1"
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
                    <span className="text-xs font-bold text-gray-700">แก้ไขข้อมูล</span>
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
                    <label className="text-xs font-bold text-gray-600 block mb-1">
                      ชื่อแสดงในแอพ:
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand-500 font-medium"
                      placeholder="เช่น น้องต้นปาล์ม"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">
                      เบอร์โทรศัพท์ (สำหรับคนส่งโทรหา):
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand-500 font-medium"
                      placeholder="08x-xxx-xxxx"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1 shadow-xs transition"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}</span>
                  </button>
                </form>
              )}
            </div>

            {/* 3. Default Delivery Address & Map Pin Card */}
            <div className="bg-brand-50/60 rounded-2xl p-4 border border-brand-200/80 space-y-3">
              {!isEditingAddress ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-brand-900 uppercase tracking-wider flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-brand-600" />
                      ที่อยู่จัดส่งและหมุดเริ่มต้น
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsEditingAddress(true)}
                      className="text-xs font-bold text-brand-700 hover:text-brand-800 flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-brand-200 shadow-2xs transition active:scale-95"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>{user.default_address ? 'แก้ไข' : 'ปักหมุด'}</span>
                    </button>
                  </div>

                  {user.default_address ? (
                    <div className="space-y-2 text-xs">
                      <p className="font-semibold text-gray-800 bg-white p-2.5 rounded-xl border border-brand-100 leading-relaxed shadow-2xs">
                        {user.default_address}
                      </p>
                      <div className="flex items-center justify-between gap-2 text-xs text-gray-500 pt-0.5">
                        <span className="flex items-center gap-1 text-xs">
                          <Navigation className="w-3 h-3 text-brand-600" />
                          พิกัด: {user.default_location?.lat?.toFixed(4) || defaultLocation.lat.toFixed(4)}, {user.default_location?.lng?.toFixed(4) || defaultLocation.lng.toFixed(4)}
                        </span>
                        <span className="shrink-0 whitespace-nowrap text-xs text-brand-700 bg-brand-100/80 px-2 py-0.5 rounded-full font-bold">
                          พร้อมใช้สั่งอาหาร
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-2 text-xs text-brand-800">
                      <p className="text-xs text-gray-500 mb-2">ยังไม่ได้บันทึกที่อยู่จัดส่งเริ่มต้น (บันทึกไว้เพื่อความสะดวกรวดเร็วในการสั่งอาหาร)</p>
                      <button
                        type="button"
                        onClick={() => setIsEditingAddress(true)}
                        className="py-1.5 px-3 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-bold text-xs shadow-xs transition active:scale-95 inline-flex items-center gap-1"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        <span>ปักหมุดและบันทึกที่อยู่</span>
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <form onSubmit={handleSaveAddress} className="space-y-3">
                  <div className="flex items-center justify-between border-b border-brand-200 pb-1.5">
                    <span className="text-xs font-bold text-brand-900 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-brand-600" />
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
                    <label className="text-xs font-bold text-gray-700 block mb-1">
                      ปักหมุดตำแหน่ง (ลากหมุดหรือกด "ตำแหน่งของฉัน"):
                    </label>
                    <MapPicker
                      location={defaultLocation}
                      onChange={setDefaultLocation}
                      title="หมุดที่อยู่ประจำของคุณ"
                      showRadiusCircle={false}
                      autoLocate={!user.default_location}
                    />
                  </div>

                  {/* Textarea for detailed address */}
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">
                      รายละเอียดที่อยู่ (หอพัก / บ้าน / จุดส่ง):
                    </label>
                    <textarea
                      rows={2}
                      value={defaultAddress}
                      onChange={(e) => setDefaultAddress(e.target.value)}
                      placeholder="เช่น หอพักพรเทพ ห้อง 204 ซอยข้าง 7-11 หรือ ใต้ตึก 5 คณะครุศาสตร์"
                      required
                      className="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-brand-500 font-medium resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSavingAddress}
                    className="w-full py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1 shadow-xs transition active:scale-98"
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
                className="w-full py-2.5 px-4 rounded-2xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs flex items-center justify-between transition active:scale-98 shadow-xs"
              >
                <div className="flex items-center gap-2 min-w-0 text-left">
                  <FileText className="w-4 h-4 shrink-0 text-white" />
                  <span>ประวัติการสั่งซื้อของฉัน (สั่งซ้ำได้)</span>
                </div>
                <span className="shrink-0 whitespace-nowrap ml-2 text-xs bg-white/20 px-2 py-0.5 rounded-full font-bold">ดูรายการ</span>
              </button>
            )}

            {/* Contact Us Button */}
            <button
              type="button"
              onClick={() => setShowContact(true)}
              className="w-full py-2.5 px-4 rounded-2xl border border-brand-200 bg-brand-50/70 hover:bg-brand-100 text-brand-900 font-bold text-xs flex items-center justify-between transition active:scale-98"
            >
              <div className="flex items-center gap-2 min-w-0 text-left">
                <MessageSquare className="w-4 h-4 shrink-0 text-brand-700" />
                <span>ติดต่อเรา / ฝ่ายบริการ (LINE Official)</span>
              </div>
              <span className="shrink-0 whitespace-nowrap ml-2 text-xs text-brand-700 font-bold bg-brand-100 px-2 py-0.5 rounded-full">@887nrlyw</span>
            </button>

            {/* Terms of Service Button */}
            <button
              type="button"
              onClick={() => setShowTerms(true)}
              className="w-full py-2.5 px-4 rounded-2xl border border-gray-200 text-gray-700 hover:bg-gray-50 font-bold text-xs flex items-center justify-between transition active:scale-98"
            >
              <div className="flex items-center gap-2 min-w-0 text-left">
                <FileText className="w-4 h-4 shrink-0 text-gray-500" />
                <span>ข้อกำหนดและนโยบายการให้บริการ</span>
              </div>
              <span className="shrink-0 whitespace-nowrap ml-2 text-xs text-brand-600 font-semibold">แตะเพื่อดู</span>
            </button>

            {/* Customers can apply to open a shop later */}
            {role === 'customer' && (
              <a
                href="/merchant"
                className="w-full py-2.5 px-4 rounded-2xl border border-brand-200 bg-brand-50/70 hover:bg-brand-100 text-brand-900 font-bold text-xs flex items-center justify-between transition active:scale-98"
              >
                <div className="flex items-center gap-2 min-w-0 text-left">
                  <Store className="w-3.5 h-3.5 shrink-0 text-brand-500" />
                  <span>สมัครเปิดร้านค้ากับ CPRUFood</span>
                </div>
                <span className="shrink-0 whitespace-nowrap ml-2 text-xs bg-brand-200 text-brand-900 px-2 py-0.5 rounded-full font-bold">สมัคร</span>
              </a>
            )}

            <AndroidInstallLink variant="row" />

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
