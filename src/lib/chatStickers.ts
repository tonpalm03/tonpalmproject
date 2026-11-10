/** น้องพุงเด้ง stickers for order chat. The id is stored on the message and maps to /stickers/{id}.webp. */
export interface ChatSticker {
  id: string;
  label: string;
}

export const MERCHANT_STICKERS: ChatSticker[] = [
  { id: '01-accepted', label: 'รับออเดอร์แล้ว' },
  { id: '02-cooking', label: 'กำลังทำ' },
  { id: '03-on-the-way', label: 'กำลังไปส่ง' },
  { id: '04-arrived', label: 'ถึงแล้ว' },
  { id: '05-wait', label: 'รอแป๊บนะ' },
  { id: '06-sold-out', label: 'ของหมด' },
  { id: '07-thanks-customer', label: 'ขอบคุณที่อุดหนุน' },
  { id: '08-closed', label: 'ร้านปิดแล้ว' },
];

export const CUSTOMER_STICKERS: ChatSticker[] = [
  { id: '09-hello', label: 'สวัสดี' },
  { id: '10-hungry', label: 'หิวแล้ว' },
  { id: '11-paid', label: 'โอนแล้ว' },
  { id: '12-where', label: 'ถึงไหนแล้ว' },
  { id: '13-delicious', label: 'อร่อยมาก' },
  { id: '14-thank-you', label: 'ขอบคุณ' },
  { id: '15-ok', label: 'โอเค' },
  { id: '16-no-rush', label: 'ไม่รีบนะ' },
];

const ALL = [...MERCHANT_STICKERS, ...CUSTOMER_STICKERS];

export const findSticker = (id?: string) => ALL.find((s) => s.id === id);
export const stickerSrc = (id: string) => `/stickers/${id}.webp`;
