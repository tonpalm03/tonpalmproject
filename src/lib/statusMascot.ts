/** น้องพุงเด้ง sticker for each order status, shown wherever the customer follows an order. */
export const STATUS_MASCOT: Record<string, { src: string; alt: string }> = {
  pending: { src: '/mascots/status/pending.webp', alt: 'น้องพุงเด้งรอร้านรับออเดอร์' },
  cooking: { src: '/mascots/status/cooking.webp', alt: 'น้องพุงเด้งกำลังทำอาหาร' },
  delivering: { src: '/mascots/status/delivering.webp', alt: 'น้องพุงเด้งกำลังขี่รถไปส่ง' },
  completed: { src: '/mascots/status/completed.webp', alt: 'น้องพุงเด้งส่งอาหารถึงแล้ว' },
};
