'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X, Send, User, Store, ShieldCheck, Clock, Camera, Maximize2, Loader2,
  Sparkles, QrCode, Copy, Check, CreditCard, Receipt, FileText, Download, Image as ImageIcon
} from 'lucide-react';
import { ChatMessage, UserRole } from '@/types';
import { db, functions } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { soundAlert } from '@/lib/soundAlert';
import UserAvatar from './UserAvatar';

export interface ShopPaymentInfo {
  bank_name?: string;
  bank_account_number?: string;
  bank_account_name?: string;
  promptpay_number?: string;
  promptpay_qr_url?: string;
}

interface ChatModalProps {
  orderId: string;
  orderCode?: string;
  shopName: string;
  shopImage?: string;
  shopPaymentInfo?: ShopPaymentInfo;
  orderTotal?: number;
  customerName: string;
  customerImage?: string;
  currentUser: {
    uid: string;
    name: string;
    role: UserRole;
    picture_url?: string;
  };
  onClose: () => void;
}

// Client-side auto compression for zero-storage waste
const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('กรุณาเลือกไฟล์รูปภาพเท่านั้น'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 800; // 800px max width/height is crystal clear for slips and drop-off proof
        let { width, height } = img;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // ~30-50 KB per photo, high quality JPEG
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.76);
        resolve(compressedBase64);
      };
      img.onerror = () => reject(new Error('โหลดรูปภาพไม่สำเร็จ'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'));
    reader.readAsDataURL(file);
  });
};

export default function ChatModal({
  orderId,
  orderCode,
  shopName,
  shopImage,
  shopPaymentInfo,
  orderTotal,
  customerName,
  customerImage,
  currentUser,
  onClose,
}: ChatModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState(() => {
    try {
      return sessionStorage.getItem(`hchk_chat_draft_${orderId}`) || '';
    } catch (_) {
      return '';
    }
  });
  const [isSending, setIsSending] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [selectedImageForView, setSelectedImageForView] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Sync draft
  useEffect(() => {
    try {
      if (inputText) {
        sessionStorage.setItem(`hchk_chat_draft_${orderId}`, inputText);
      } else {
        sessionStorage.removeItem(`hchk_chat_draft_${orderId}`);
      }
    } catch (_) {}
  }, [inputText, orderId]);

  // Live shop payment info & order total fallback if not in props
  const [livePaymentInfo, setLivePaymentInfo] = useState<ShopPaymentInfo | null>(shopPaymentInfo || null);
  const [liveOrderTotal, setLiveOrderTotal] = useState<number | undefined>(orderTotal);

  // Target avatar (other party in chat)
  const [targetAvatar, setTargetAvatar] = useState<string | null>(
    currentUser.role === 'merchant' ? (customerImage || null) : (shopImage || null)
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isFirstLoadRef = useRef(true);
  const playedMsgIdsRef = useRef<Set<string>>(new Set());

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, selectedImage]);

  // Clear unread notification on parent order when chat is opened or tab becomes active
  const clearUnreadStatus = () => {
    if (!orderId) return;
    try {
      if (currentUser.role === 'merchant') {
        updateDoc(doc(db, 'orders', orderId), { has_unread_message: false }).catch(() => {});
      } else if (currentUser.role === 'customer') {
        updateDoc(doc(db, 'orders', orderId), { has_customer_unread_message: false }).catch(() => {});
      }
    } catch (e) {}
  };

  useEffect(() => {
    clearUnreadStatus();
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        clearUnreadStatus();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [orderId, currentUser.role]);

  // Auto-fetch profile picture or shop payment info from Firestore if missing
  useEffect(() => {
    if (!orderId) return;

    let isMounted = true;
    const fetchDetails = async () => {
      try {
        const orderSnap = await getDoc(doc(db, 'orders', orderId));
        if (!orderSnap.exists()) return;
        const o = orderSnap.data();

        if (o.total_amount && !liveOrderTotal && isMounted) {
          setLiveOrderTotal(o.total_amount);
        }

        if (currentUser.role === 'merchant') {
          if (o.customer_avatar && isMounted) setTargetAvatar(o.customer_avatar);
        } else {
          if (o.shop_image && isMounted) setTargetAvatar(o.shop_image);
        }

        // Fetch Shop info if needed for payment
        if (o.shop_id && !livePaymentInfo) {
          const sSnap = await getDoc(doc(db, 'shops', o.shop_id));
          if (sSnap.exists() && isMounted) {
            const sData = sSnap.data();
            if (sData.image_url && !targetAvatar && currentUser.role === 'customer') {
              setTargetAvatar(sData.image_url);
            }
            setLivePaymentInfo({
              bank_name: sData.bank_name,
              bank_account_number: sData.bank_account_number,
              bank_account_name: sData.bank_account_name,
              promptpay_number: sData.promptpay_number,
              promptpay_qr_url: sData.promptpay_qr_url,
            });
          }
        }
      } catch (err) {
        console.warn('Could not load chat details:', err);
      }
    };

    fetchDetails();
    return () => {
      isMounted = false;
    };
  }, [orderId, currentUser.role, shopPaymentInfo, orderTotal]);

  // Firestore Realtime Listener
  useEffect(() => {
    if (!orderId) return;

    try {
      const messagesRef = collection(db, 'orders', orderId, 'messages');
      const q = query(messagesRef, orderBy('created_at', 'asc'));

      const unsub = onSnapshot(q, (snapshot) => {
        const loaded: ChatMessage[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          loaded.push({
            id: doc.id,
            order_id: orderId,
            sender_uid: data.sender_uid,
            sender_name: data.sender_name,
            sender_role: data.sender_role,
            sender_avatar: data.sender_avatar,
            text: data.text,
            image_url: data.image_url,
            created_at: data.created_at?.toDate ? data.created_at.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'เมื่อสักครู่',
            is_read: data.is_read || false,
          });
        });

        if (loaded.length > 0) {
          // Play notification chime for new incoming messages and deduplicate
          if (isFirstLoadRef.current) {
            isFirstLoadRef.current = false;
            loaded.forEach((m) => playedMsgIdsRef.current.add(m.id));
          } else {
            const incomingUnplayed = loaded.filter((m) => !playedMsgIdsRef.current.has(m.id));
            if (incomingUnplayed.length > 0) {
              incomingUnplayed.forEach((m) => playedMsgIdsRef.current.add(m.id));
              const latest = incomingUnplayed[incomingUnplayed.length - 1];
              if (latest && latest.sender_uid !== currentUser.uid && latest.sender_uid !== 'system') {
                soundAlert.playMessageSound();
              }
            }
          }

          // Dynamic unread clearing while chat modal is currently visible
          if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
            if (currentUser.role === 'merchant') {
              updateDoc(doc(db, 'orders', orderId), { has_unread_message: false }).catch(() => {});
            } else if (currentUser.role === 'customer') {
              updateDoc(doc(db, 'orders', orderId), { has_customer_unread_message: false }).catch(() => {});
            }
          }

          setMessages(loaded);
        } else {
          isFirstLoadRef.current = false;
          // Formal & courteous initial welcome message if chat is empty
          setMessages([
            {
              id: 'init_welcome',
              order_id: orderId,
              sender_uid: 'system',
              sender_name: 'ระบบ huaychan',
              sender_role: 'admin',
              text: `ระบบแชทประสานงานออเดอร์ #${orderCode || orderId.slice(0, 5)} ระหว่างคุณ ${customerName} และร้าน ${shopName} สามารถพิมพ์ข้อความหรือส่งรูปถ่ายยืนยันจุดรับส่ง/สลิปโอนเงินได้ตลอดเวลาครับ`,
              created_at: 'ตอนนี้',
              is_read: true,
            },
          ]);
        }
      }, (err) => {
        console.warn('Firestore messages realtime subscription fallback:', err);
        const cached = localStorage.getItem(`chat_${orderId}`);
        if (cached) {
          setMessages(JSON.parse(cached));
        }
      });

      return () => unsub();
    } catch (e) {
      console.error(e);
    }
  }, [orderId, currentUser.uid, currentUser.role]); // Stable dependencies

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsCompressing(true);
      const compressed = await compressImage(file);
      setSelectedImage(compressed);
    } catch (err: any) {
      alert(err.message || 'ไม่สามารถโหลดรูปภาพได้');
    } finally {
      setIsCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const sendMessageDirect = async (textToSend: string, imageToSend?: string) => {
    if (isSending) return;
    setIsSending(true);

    const newMsg: Record<string, any> = {
      order_id: orderId,
      sender_uid: currentUser.uid || 'guest_user',
      sender_name: currentUser.name || (currentUser.role === 'merchant' ? shopName : customerName || 'ผู้ใช้งาน'),
      sender_role: currentUser.role || 'customer',
      text: textToSend,
      is_read: false,
      created_at: serverTimestamp(),
    };

    if (currentUser.picture_url) {
      newMsg.sender_avatar = currentUser.picture_url;
    }
    if (imageToSend) {
      newMsg.image_url = imageToSend;
    }

    try {
      await addDoc(collection(db, 'orders', orderId, 'messages'), newMsg);

      const unreadUpdate: Record<string, unknown> = {
        last_message: textToSend.slice(0, 40) || 'ส่งรูปภาพ',
        last_message_sender: currentUser.role,
        last_message_at: serverTimestamp(),
      };
      if (currentUser.role === 'customer') {
        unreadUpdate.has_unread_message = true;
      } else if (currentUser.role === 'admin') {
        unreadUpdate.has_unread_message = true;
        unreadUpdate.has_customer_unread_message = true;
      } else {
        unreadUpdate.has_customer_unread_message = true;
      }
      await updateDoc(doc(db, 'orders', orderId), unreadUpdate).catch(console.warn);

      // Trigger FCM push notification asynchronously if message from customer or admin
      if (currentUser.role === 'customer' || currentUser.role === 'admin') {
        const notifyFn = httpsCallable(functions, 'notifyChatMessage');
        notifyFn({ orderId, text: textToSend || 'ส่งรูปภาพ', senderName: currentUser.name }).catch((err) => {
          console.warn('notifyChatMessage callable fallback:', err);
        });
      }
    } catch (err) {
      console.warn('Direct message send fallback:', err);
      const fallbackMsg: ChatMessage & { is_failed?: boolean } = {
        id: `failed_${Date.now()}`,
        order_id: orderId,
        sender_uid: currentUser.uid,
        sender_name: currentUser.name,
        sender_role: currentUser.role,
        sender_avatar: currentUser.picture_url || undefined,
        text: textToSend,
        image_url: imageToSend || undefined,
        created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        is_read: false,
        is_failed: true,
      };
      setMessages((prev) => {
        const next = [...prev, fallbackMsg];
        localStorage.setItem(`chat_${orderId}`, JSON.stringify(next));
        return next;
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleRetrySend = async (failedMsg: ChatMessage & { is_failed?: boolean }) => {
    setMessages((prev) => prev.filter((m) => m.id !== failedMsg.id));
    await sendMessageDirect(failedMsg.text || '', failedMsg.image_url);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputText.trim() && !selectedImage) || isSending || isCompressing) return;

    const textToSend = inputText.trim();
    const imageToSend = selectedImage;

    setInputText('');
    setSelectedImage(null);
    await sendMessageDirect(textToSend, imageToSend || undefined);
  };

  const handleSendPaymentInfo = async () => {
    const bankName = livePaymentInfo?.bank_name || shopPaymentInfo?.bank_name;
    const accNum = livePaymentInfo?.bank_account_number || shopPaymentInfo?.bank_account_number;
    const accName = livePaymentInfo?.bank_account_name || shopPaymentInfo?.bank_account_name;
    const ppNum = livePaymentInfo?.promptpay_number || shopPaymentInfo?.promptpay_number;
    const qrUrl = livePaymentInfo?.promptpay_qr_url || shopPaymentInfo?.promptpay_qr_url;
    const total = liveOrderTotal || orderTotal;

    if (!bankName && !accNum && !ppNum && !qrUrl) {
      alert('ยังไม่ได้บันทึกข้อมูลการรับเงินของร้านค้า กรุณาไปที่หน้า "ข้อมูลร้านค้า" เพื่อใส่เลขบัญชีหรือรูป QR Code ก่อนครับ');
      return;
    }

    const lines = [
      `ข้อมูลชำระเงินสำหรับออเดอร์ #${orderCode || orderId.slice(0, 6)}`,
    ];
    if (total) lines.push(`ยอดรวมที่ต้องชำระ: ฿${total}`);
    if (bankName) lines.push(`ธนาคาร: ${bankName}`);
    if (accNum) lines.push(`เลขที่บัญชี: ${accNum}`);
    if (accName) lines.push(`ชื่อบัญชี: ${accName}`);
    if (ppNum) lines.push(`พร้อมเพย์: ${ppNum}`);
    lines.push(`\nเมื่อโอนเงินแล้ว กรุณากดปุ่มแนบสลิปส่งในแชทนี้ เพื่อให้ร้านค้าเริ่มปรุงอาหารครับ`);

    await sendMessageDirect(lines.join('\n'), qrUrl || undefined);
  };

  const handleCopyText = (text: string, key: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    } catch (err) {
      console.warn('Copy failed:', err);
    }
  };

  const handleDownloadImage = async (imageUrl: string, filename = 'qr_payment.jpg') => {
    try {
      if (imageUrl.startsWith('data:')) {
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const res = await fetch(imageUrl);
        const blob = await res.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      }
    } catch (err) {
      console.warn('Download image fallback:', err);
      window.open(imageUrl, '_blank');
    }
  };

  // Concise, essential & polite Quick Reply shortcuts
  const quickReplies = currentUser.role === 'merchant'
    ? [
        'กำลังทำอาหารครับ',
        'กำลังไปส่งครับ',
        'ถึงแล้วครับ',
        'ส่งเรียบร้อยแล้วครับ',
      ]
    : currentUser.role === 'admin'
    ? [
        'กำลังตรวจสอบให้ครับ',
        'ประสานงานร้านให้แล้วครับ',
        'สอบถามเพิ่มเติมได้ครับ',
      ]
    : [
        'โอนเงินแล้วครับ แนบสลิปแล้ว',
        'รอรับอาหารหน้าหอพักครับ',
        'ถ้าถึงแล้วโทรหาได้เลยครับ',
      ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3">
      <div className="bg-white w-full max-w-md h-[88vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-4 text-white flex items-center justify-between shadow-md shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-white/60 shadow-md shrink-0 bg-slate-200">
              <UserAvatar
                src={targetAvatar}
                alt={currentUser.role === 'merchant' ? customerName : shopName}
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-base leading-tight">
                  {currentUser.role === 'merchant' ? customerName : shopName}
                </h3>
                {currentUser.role === 'admin' && (
                  <span className="bg-rose-500 text-[10px] font-bold px-1.5 py-0.5 rounded text-white flex items-center gap-0.5">
                    <ShieldCheck className="w-3 h-3" /> แอดมินตรวจสอบ
                  </span>
                )}
              </div>
              <p className="text-xs text-amber-100">
                ออเดอร์ #{orderCode || orderId.slice(0, 6)} • สั่งส่งตรงถึงหอพัก
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-black/10 hover:bg-black/20 flex items-center justify-center transition active:scale-95"
            title="ปิดหน้าต่างแชท"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Top Sticky Payment Instructions Banner */}
        <div className="bg-amber-50 border-b border-amber-200 px-3.5 py-2 flex items-center justify-between text-xs text-amber-950 shrink-0 shadow-2xs">
          <div className="flex items-center gap-2 min-w-0">
            <CreditCard className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="truncate text-[11px] font-medium">
              {currentUser.role === 'merchant'
                ? 'กดปุ่ม "ส่ง QR รับเงิน" ด้านล่าง เพื่อส่งยอดและบัญชีให้ลูกค้าโอนจ่าย'
                : 'โอนชำระเงินกับร้านค้า & ส่งสลิปในแชทนี้ ร้านจะเริ่มปรุงอาหารเมื่อได้รับยอดครับ'}
            </span>
          </div>
          {liveOrderTotal && (
            <span className="font-black text-amber-700 bg-white px-2 py-0.5 rounded-md border border-amber-300 text-[11px] shrink-0 ml-2 shadow-2xs">
              ฿{liveOrderTotal}
            </span>
          )}
        </div>

        {/* Message History */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
          {messages.map((msg) => {
            const isMe = msg.sender_uid === currentUser.uid;
            const isAdmin = msg.sender_role === 'admin';

            if (isAdmin && msg.sender_uid === 'system') {
              return (
                <div key={msg.id} className="text-center my-2">
                  <span className="text-[11px] leading-relaxed bg-amber-100/90 text-amber-900 px-3.5 py-1.5 rounded-2xl border border-amber-200 inline-block max-w-[90%] shadow-2xs">
                    {msg.text}
                  </span>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                {/* Sender badge */}
                {!isMe && (
                  <div className="flex items-center gap-1.5 mb-1 text-[11px] text-gray-500">
                    {msg.sender_avatar ? (
                      <div className="w-4 h-4 rounded-full overflow-hidden border border-gray-300 shrink-0 bg-slate-200">
                        <UserAvatar src={msg.sender_avatar} alt={msg.sender_name} />
                      </div>
                    ) : msg.sender_role === 'merchant' ? (
                      <Store className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                    ) : msg.sender_role === 'admin' ? (
                      <ShieldCheck className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    ) : (
                      <User className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    )}
                    <span className="font-semibold text-gray-700">{msg.sender_name}</span>
                    <span className="text-[10px] px-1 py-0.5 rounded bg-gray-200 text-gray-600">
                      {msg.sender_role === 'merchant' ? 'ร้านค้า' : msg.sender_role === 'admin' ? 'แอดมิน' : 'ลูกค้า'}
                    </span>
                  </div>
                )}

                {/* Bubble */}
                <div
                  className={`max-w-[85%] p-3 rounded-2xl text-sm shadow-xs break-words ${
                    isMe
                      ? 'bg-amber-500 text-white rounded-br-xs'
                      : isAdmin
                      ? 'bg-rose-50 border border-rose-200 text-rose-900 rounded-bl-xs'
                      : 'bg-white border border-gray-200 text-gray-800 rounded-bl-xs'
                  }`}
                >
                  {/* Photo Attachment if present */}
                  {msg.image_url && (
                    <div className="mb-2 space-y-1.5">
                      <div
                        className="relative group cursor-pointer overflow-hidden rounded-xl bg-black/10 transition active:scale-98"
                        onClick={() => setSelectedImageForView(msg.image_url || null)}
                        title="แตะเพื่อดูรูปภาพขนาดเต็ม / สแกน QR"
                      >
                        <img
                          src={msg.image_url}
                          alt="รูปภาพแนบในแชท"
                          className="max-h-64 w-auto max-w-full rounded-xl object-contain mx-auto"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs gap-1 font-medium pointer-events-none">
                          <Maximize2 className="w-3.5 h-3.5" /> แตะเพื่อขยายรูป / สแกน QR
                        </div>
                      </div>

                      {/* Direct 1-Click Save button below photo */}
                      <button
                        type="button"
                        onClick={() => handleDownloadImage(msg.image_url!, `qr_payment_${orderCode || orderId.slice(0, 6)}.jpg`)}
                        className={`w-full py-1.5 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 border shadow-xs ${
                          isMe
                            ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-400'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500'
                        }`}
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>บันทึกรูป QR Code ลงเครื่อง</span>
                      </button>
                    </div>
                  )}

                  {/* Text if present */}
                  {msg.text && (
                    <div className={`${msg.image_url ? 'px-0.5 pt-0.5' : ''} whitespace-pre-line leading-relaxed font-normal`}>
                      {msg.text}
                    </div>
                  )}

                  {/* 1-Click Copy helper for bank account or promptpay */}
                  {Boolean(msg.text && (msg.text.includes('เลขที่บัญชี:') || msg.text.includes('พร้อมเพย์:') || msg.text.includes('ข้อมูลชำระเงิน'))) && (() => {
                    const currentText = msg.text || '';
                    const accMatch = currentText.match(/เลขที่บัญชี:\s*([0-9-]+)/);
                    const ppMatch = currentText.match(/พร้อมเพย์:\s*([0-9-]+)/);
                    if (!accMatch && !ppMatch) return null;

                    return (
                      <div className="mt-2.5 pt-2 border-t border-black/10 flex flex-wrap gap-1.5">
                        {accMatch && (
                          <button
                            type="button"
                            onClick={() => handleCopyText(accMatch[1].replace(/[^0-9]/g, ''), `acc_${msg.id}`)}
                            className={`text-[11px] font-bold px-2.5 py-1 rounded-lg shadow-2xs flex items-center gap-1 transition active:scale-95 border ${
                              isMe
                                ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-400'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                            }`}
                          >
                            {copiedKey === `acc_${msg.id}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedKey === `acc_${msg.id}` ? 'คัดลอกเลขบัญชีแล้ว' : 'คัดลอกเลขบัญชี'}</span>
                          </button>
                        )}
                        {ppMatch && (
                          <button
                            type="button"
                            onClick={() => handleCopyText(ppMatch[1].replace(/[^0-9]/g, ''), `pp_${msg.id}`)}
                            className={`text-[11px] font-bold px-2.5 py-1 rounded-lg shadow-2xs flex items-center gap-1 transition active:scale-95 border ${
                              isMe
                                ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-400'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                            }`}
                          >
                            {copiedKey === `pp_${msg.id}` ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedKey === `pp_${msg.id}` ? 'คัดลอกพร้อมเพย์แล้ว' : 'คัดลอกพร้อมเพย์'}</span>
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Timestamp & Status */}
                <div className="text-[10px] text-gray-400 mt-0.5 px-1 flex items-center gap-1.5">
                  <span className="flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    {msg.created_at}
                  </span>
                  {(msg as any).is_failed && isMe && (
                    <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                      <span>• ส่งไม่สำเร็จ</span>
                      <button
                        type="button"
                        onClick={() => handleRetrySend(msg as any)}
                        className="underline font-bold text-red-700 hover:text-red-900 cursor-pointer"
                      >
                        ลองใหม่
                      </button>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Action Bar / Quick Suggestions */}
        <div className="px-3 py-2 bg-white border-t border-gray-100 shrink-0">
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-[11px] font-semibold text-gray-500">
                {currentUser.role === 'merchant' ? 'ส่งด่วนร้านค้า:' : 'ตัวช่วยด่วนลูกค้า:'}
              </span>
            </div>
            {currentUser.role === 'merchant' ? (
              <button
                type="button"
                disabled={isSending}
                onClick={handleSendPaymentInfo}
                className="py-1 px-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>ส่ง QR / บัญชีรับเงิน</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="py-1 px-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs transition active:scale-95 cursor-pointer"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>แนบสลิปโอนเงิน</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {quickReplies.map((reply, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setInputText(reply)}
                className="text-xs px-2.5 py-1 bg-amber-50 hover:bg-amber-100 active:bg-amber-200 text-amber-900 rounded-xl transition border border-amber-200/80 active:scale-95 font-medium shadow-2xs"
              >
                {reply}
              </button>
            ))}
          </div>
        </div>

        {/* Pending Image Attachment Preview */}
        {selectedImage && (
          <div className="px-3 py-2 bg-amber-50/90 border-t border-amber-200 flex items-center justify-between shrink-0 animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12 rounded-xl overflow-hidden border-2 border-amber-400 shadow-sm shrink-0 bg-white">
                <img src={selectedImage} alt="Preview" className="w-full h-full object-cover" />
              </div>
              <div>
                <p className="text-xs font-bold text-amber-900 flex items-center gap-1">
                  <ImageIcon className="w-3.5 h-3.5" /> แนบรูปภาพแล้ว
                </p>
                <p className="text-[11px] text-amber-700">สามารถพิมพ์ข้อความกำกับ หรือกดส่งรูปได้ทันทีครับ</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedImage(null)}
              className="w-7 h-7 rounded-full bg-white hover:bg-rose-100 text-gray-400 hover:text-rose-600 flex items-center justify-center transition shadow-xs"
              title="ยกเลิกรูปภาพ"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Input Bar */}
        <form
          onSubmit={handleSend}
          className="p-3 bg-white border-t border-gray-100 flex items-center gap-2 shrink-0"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={handleImageFile}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isCompressing || isSending}
            className="w-10 h-10 rounded-2xl bg-gray-100 hover:bg-amber-100 text-gray-600 hover:text-amber-700 flex items-center justify-center transition active:scale-95 border border-gray-200 shrink-0"
            title="ถ่ายรูปหรือส่งรูปภาพ (สลิปโอนเงิน / จุดวางอาหาร)"
          >
            {isCompressing ? (
              <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
            ) : (
              <Camera className="w-5 h-5" />
            )}
          </button>

          <input
            type="text"
            placeholder={
              selectedImage
                ? 'พิมพ์ข้อความกำกับรูปภาพ (ไม่บังคับ)...'
                : currentUser.role === 'admin'
                ? 'พิมพ์ข้อความในฐานะแอดมิน...'
                : 'พิมพ์ข้อความคุยกับร้านค้า/ลูกค้า...'
            }
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="flex-1 px-4 py-2.5 bg-gray-100 rounded-2xl text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500 border border-transparent"
          />

          <button
            type="submit"
            disabled={(!inputText.trim() && !selectedImage) || isSending || isCompressing}
            className="w-10 h-10 rounded-2xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white flex items-center justify-center transition active:scale-95 shadow-md shrink-0"
            title="ส่งข้อความ"
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>

      </div>

      {/* Lightbox / Fullscreen Image Viewer */}
      {selectedImageForView && (
        <div
          className="fixed inset-0 z-70 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setSelectedImageForView(null)}
        >
          <div className="relative max-w-2xl w-full max-h-[90vh] flex flex-col items-center">
            <div className="w-full flex justify-between items-center text-white pb-3 px-2">
              <span className="text-xs text-white/80">แตะที่ว่างเพื่อปิด</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownloadImage(selectedImageForView, `huaychan_image_${Date.now()}.jpg`);
                  }}
                  className="px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 text-xs font-bold transition active:scale-95 shadow-md"
                >
                  <Download className="w-4 h-4" />
                  <span>บันทึกรูป</span>
                </button>
                <button
                  onClick={() => setSelectedImageForView(null)}
                  className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition active:scale-95"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
            <img
              src={selectedImageForView}
              alt="รูปภาพขนาดเต็ม"
              className="max-w-full max-h-[75vh] rounded-2xl object-contain shadow-2xl bg-black/20"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="pt-3">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownloadImage(selectedImageForView, `huaychan_image_${Date.now()}.jpg`);
                }}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 text-white rounded-2xl text-xs font-bold flex items-center gap-2 shadow-lg transition active:scale-95 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>บันทึกรูปภาพนี้ลงในเครื่อง / อัลบั้ม</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
