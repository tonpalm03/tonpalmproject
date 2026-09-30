'use client';

import React from 'react';

export const DEFAULT_AVATAR_SVG = `data:image/svg+xml;utf8,<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="%23cbd5e1"/><circle cx="50" cy="38" r="18" fill="%23ffffff"/><path d="M50 62c-18 0-28 12-30 28a50 50 0 0 0 60 0c-2-16-12-28-30-28z" fill="%23ffffff"/></svg>`;

export function isCustomAvatar(url?: string | null): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.includes('photo-1534528741775') || trimmed.includes('photo-1556910103')) return false;
  return true;
}

export function getUserCode(user?: { uid?: string; user_code?: string } | null): string {
  if (!user || !user.uid) return '100001';
  if (user.user_code) return String(user.user_code);
  let hash = 0;
  for (let i = 0; i < user.uid.length; i++) {
    hash = (hash * 31 + user.uid.charCodeAt(i)) >>> 0;
  }
  const codeNum = 100000 + (hash % 900000);
  return String(codeNum);
}

interface UserAvatarProps {
  src?: string | null;
  alt?: string;
  className?: string;
}

export default function UserAvatar({
  src,
  alt = 'ผู้ใช้งาน',
  className = 'w-full h-full',
}: UserAvatarProps) {
  if (isCustomAvatar(src)) {
    return (
      <img
        src={src!}
        alt={alt}
        className={`${className} object-cover`}
        onError={(e) => {
          (e.target as HTMLImageElement).src = DEFAULT_AVATAR_SVG;
        }}
      />
    );
  }

  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} shrink-0 select-none block`}
      aria-label={alt}
    >
      {/* Background Circle: sleek neutral slate-300 */}
      <circle cx="50" cy="50" r="50" fill="#cbd5e1" />
      {/* Faceless Person Head: Pure White */}
      <circle cx="50" cy="38" r="18" fill="#ffffff" />
      {/* Faceless Person Body / Shoulders: Pure White */}
      <path
        d="M50 62c-18 0-28 12-30 28a50 50 0 0 0 60 0c-2-16-12-28-30-28z"
        fill="#ffffff"
      />
    </svg>
  );
}
