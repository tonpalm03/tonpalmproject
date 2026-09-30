'use client';

import React, { useState } from 'react';
import { Star, X, Check, MessageSquare, ThumbsUp } from 'lucide-react';
import { db } from '@/lib/firebase';
import {
  doc, setDoc, serverTimestamp
} from 'firebase/firestore';
import { UserProfile } from '@/types';

interface ReviewModalProps {
  shopId: string;
  shopName: string;
  orderId?: string;
  currentUser?: UserProfile | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ReviewModal({
  shopId,
  shopName,
  orderId,
  currentUser,
  onClose,
  onSuccess,
}: ReviewModalProps) {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const quickTags = [
    'อร่อยมากกก',
    'ส่งไวทันใจ',
    'ให้เยอะ คุ้มราคา',
    'อาหารร้อนๆ สดใหม่',
    'คนส่งพูดจาสุภาพ',
    'ชานมหวานกำลังดี',
  ];

  const handleTagClick = (tag: string) => {
    if (!comment) {
      setComment(tag);
    } else if (!comment.includes(tag)) {
      setComment((prev) => `${prev} ${tag}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.uid || !orderId) { alert('กรุณาเข้าสู่ระบบและเลือกออเดอร์ที่ส่งสำเร็จ'); return; }
    setIsSubmitting(true);

    try {
      // 1. Add to shop_reviews collection
      await setDoc(doc(db, 'shop_reviews', orderId), {
        shop_id: shopId,
        order_id: orderId || null,
        customer_uid: currentUser?.uid || 'guest_user',
        customer_name: currentUser?.display_name || 'ลูกค้า',
        customer_avatar: currentUser?.picture_url || '',
        rating,
        comment: comment.trim() || 'อาหารอร่อย ประทับใจมากครับ',
        created_at: serverTimestamp(),
      });

      alert('ขอบคุณสำหรับรีวิวของคุณ! คะแนนของคุณช่วยให้ร้านค้าพัฒนาได้ดียิ่งขึ้น');
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Submit review error:', err);
      alert('ส่งรีวิวไม่สำเร็จ กรุณาลองอีกครั้ง ข้อความของคุณยังอยู่ในหน้านี้');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
      <div className="bg-white rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl relative border border-gray-100">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center pt-2">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto shadow-inner mb-2">
            <Star className="w-7 h-7 fill-amber-500 text-amber-500" />
          </div>
          <h3 className="font-black text-lg text-gray-900">ให้คะแนนร้านค้า</h3>
          <p className="text-xs text-amber-600 font-bold mt-0.5">ร้าน {shopName}</p>
          <p className="text-[11px] text-gray-400 mt-1">
            ความพึงพอใจในรสชาติอาหารและการจัดส่ง
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Interactive Star Rating */}
          <div className="flex justify-center items-center gap-2 py-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setRating(star)}
                className="p-1 transition transform active:scale-125 hover:scale-110 focus:outline-hidden"
              >
                <Star
                  className={`w-9 h-9 transition ${
                    (hoverRating || rating) >= star
                      ? 'text-amber-400 fill-amber-400 drop-shadow-xs'
                      : 'text-gray-200'
                  }`}
                />
              </button>
            ))}
          </div>

          <div className="text-center">
            <span className="text-xs font-black text-amber-600 px-3 py-1 bg-amber-50 rounded-full inline-flex items-center gap-1">
              {rating === 5 && 'ยอดเยี่ยมมาก ประทับใจสุดๆ'}
              {rating === 4 && 'ดีมาก อร่อยถูกปาก'}
              {rating === 3 && 'พอใช้ได้ ทานได้เรื่อยๆ'}
              {rating === 2 && 'ควรปรับปรุงบางจุด'}
              {rating === 1 && 'ไม่ประทับใจ'}
            </span>
          </div>

          {/* Quick Tags */}
          <div className="space-y-1.5">
            <span className="text-[11px] text-gray-500 font-medium">กดคำชมด่วน:</span>
            <div className="flex flex-wrap gap-1.5">
              {quickTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleTagClick(tag)}
                  className="text-[10px] px-2.5 py-1 rounded-xl bg-gray-50 hover:bg-amber-100 hover:text-amber-800 text-gray-700 border border-gray-200 transition font-medium"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Comment text area */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-700 block">
              เขียนรีวิวหรือข้อความถึงแม่ค้า (ไม่บังคับ)
            </label>
            <textarea
              rows={3}
              placeholder="เช่น กะเพราหมูกรอบอร่อยมาก กรอบสะใจ ไข่ดาวเยิ้มๆ คนส่งสุภาพ ขอบคุณครับ..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-2xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 resize-none"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-2xl text-xs font-bold hover:bg-gray-50 transition"
            >
              ไว้คราวหลัง
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-2 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 text-white rounded-2xl text-xs font-black shadow-md transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'กำลังส่งรีวิว...' : 'ส่งคะแนนรีวิว'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
