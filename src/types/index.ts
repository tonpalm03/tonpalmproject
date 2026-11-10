export type UserRole = 'customer' | 'merchant' | 'admin';

export interface UserProfile {
  uid: string;
  user_code?: string; // 6-digit readable User ID
  line_user_id?: string;
  display_name: string;
  picture_url?: string;
  phone?: string;
  role: UserRole;
  shop_id?: string;
  default_address?: string;
  default_location?: {
    lat: number;
    lng: number;
  };
  created_at?: any;
}

/** A shop can sell food, drinks/desserts, or both. */
export type ShopCategory = 'food' | 'drink_dessert' | 'both';

export interface MerchantApplication {
  uid: string;
  applicant_name: string;
  shop_name: string;
  phone: string;
  category: ShopCategory;
  address_detail?: string;
  location?: { lat: number; lng: number };
  note?: string;
  status: 'pending' | 'approved' | 'rejected';
  reject_reason?: string;
  shop_id?: string;
  reviewed_by?: string;
  reviewed_at?: any;
  created_at?: any;
  updated_at?: any;
}

export interface Shop {
  id: string;
  owner_uid?: string;
  name: string;
  phone: string;
  promptpay_number?: string;
  bank_name?: string;
  bank_account_number?: string;
  bank_account_name?: string;
  promptpay_qr_url?: string;
  allow_cod?: boolean;
  is_open?: boolean;
  image_url?: string;
  address_detail?: string;
  location?: {
    lat: number;
    lng: number;
  };
  category?: ShopCategory;
  rating?: number; // e.g. 4.9
  review_count?: number; // e.g. 18
  sales_count?: number; // total orders sold
  line_webhook_url?: string; // Google Apps Script / Webhook URL for LINE notifications
  delivery_fee?: number; // Delivery fee set by shop in THB (0 = free delivery)
  delivery_radius_km?: number; // Custom delivery radius in km set by shop (defaults to 1.0 km)
  created_at?: any;
}


export type MenuCategory = 'food' | 'drink_dessert';

export interface MenuItemOption {
  id?: string;
  name: string;
  price: number;
  group_id?: string;
  group_title?: string;
  option_id?: string;
}

export interface OptionItem {
  id?: string;
  name: string;
  price: number;
}

export interface OptionGroup {
  id: string;
  title: string;
  name?: string;
  required: boolean;
  type: 'single' | 'multiple';
  min_select?: number;
  max_select?: number;
  options: OptionItem[];
}

export interface MenuItem {
  id: string;
  shop_id: string;
  name: string;
  price: number;
  category: MenuCategory;
  image_url?: string;
  is_available: boolean;
  options?: MenuItemOption[];
  option_groups?: OptionGroup[];
  sales_count?: number; // Total units sold (counted per plate or cup)
  created_at?: any;
}

export type OrderStatus = 'pending' | 'cooking' | 'delivering' | 'completed' | 'cancelled';
export type PaymentMethod = 'transfer_chat' | 'cash' | 'scan_merchant';

export interface OrderItem {
  menu_id: string;
  name: string;
  price: number;
  quantity: number;
  unit_price?: number;
  selected_options?: MenuItemOption[];
  cart_item_id?: string;
  image_url?: string;
  note?: string;
  shop_id?: string;
  shop_name?: string;
  shop_phone?: string;
  shop_delivery_fee?: number;
  shop_delivery_radius_km?: number;
  shop_location?: { lat: number; lng: number };
}

export interface Order {
  id: string;
  order_number?: number;
  order_code?: string;
  group_id?: string;
  shop_id: string;
  shop_name?: string;
  shop_image?: string;
  shop_phone?: string;
  customer_uid: string;
  customer_name: string;
  customer_avatar?: string;
  customer_phone: string;
  delivery_address: string;
  location?: {
    lat: number;
    lng: number;
  };
  distance_km?: number;
  items: OrderItem[];
  food_subtotal: number;
  delivery_fee: number; // 10 THB
  total_amount: number;
  payment_method: PaymentMethod;
  cash_change_note?: string;
  status: OrderStatus;
  created_at?: any;
  completed_at?: any;
  last_message?: string;
  last_message_sender?: UserRole;
  last_message_at?: any;
  has_unread_message?: boolean;
  has_customer_unread_message?: boolean;
}

export interface ChatMessage {
  id: string;
  order_id: string;
  sender_uid: string;
  sender_name: string;
  sender_role: UserRole;
  sender_avatar?: string;
  text?: string;
  image_url?: string;
  /** id of a น้องพุงเด้ง sticker (see lib/chatStickers) */
  sticker?: string;
  created_at?: any;
  is_read: boolean;
}

export interface SystemSettings {
  delivery_fee: number; // default 10
  donate_promptpay_name?: string; // Account name shown under the donation QR
  donate_promptpay_number?: string; // PromptPay number shown (with copy) beside the QR
  donate_qr_url?: string; // Uploaded PromptPay QR image (data URL)
  platform_name?: string;
  updated_at?: any;
}

export interface DonationRequest {
  id: string;
  uid: string;
  display_name: string;
  avatar_url?: string;
  amount: number;
  message: string;
  is_anonymous: boolean;
  hide_amount: boolean;
  slip_url: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at?: any;
}

// Public, approved donation. Leaderboard totals are summed per supporter_key on the client.
export interface Donation {
  id: string;
  supporter_key: string; // uid, 'name:<name>' for admin-added non-users, or 'anon:<id>'
  display_name: string;
  avatar_url?: string;
  amount: number | null; // null when the donor hid the amount
  message: string;
  message_hidden?: boolean;
  notify: boolean; // legacy: the on-screen popup was removed; always false now
  source: 'request' | 'admin';
  request_id?: string;
  created_at?: any;
}

export interface ShopReview {
  id: string;
  shop_id: string;
  order_id?: string;
  customer_uid: string;
  customer_name: string;
  customer_avatar?: string;
  rating: number; // 1 to 5
  comment: string;
  created_at?: any;
}

