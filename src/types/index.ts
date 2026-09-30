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

export interface Shop {
  id: string;
  owner_uid?: string;
  name: string;
  merchant_email?: string;
  merchant_password?: string;
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
  category?: 'food' | 'drink_dessert';
  rating?: number; // e.g. 4.9
  review_count?: number; // e.g. 18
  sales_count?: number; // total orders sold
  line_webhook_url?: string; // Google Apps Script / Webhook URL for LINE notifications
  credit_balance?: number; // Prepaid credit balance in THB
  delivery_fee?: number; // Delivery fee set by shop in THB (0 = free delivery)
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
  items: OrderItem[];
  food_subtotal: number;
  delivery_fee: number; // 10 THB
  total_amount: number;
  gp_amount: number; // 5% of food_subtotal
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
  created_at?: any;
  is_read: boolean;
}

export interface WeeklySettlement {
  id: string;
  shop_id: string;
  shop_name?: string;
  cycle_id?: string;
  cycle_label?: string;
  week_start: any;
  week_end: any;
  total_food_sales: number;
  delivery_earnings?: number;
  order_count?: number;
  gp_due: number; // 5%
  status: 'unpaid' | 'pending_approval' | 'paid';
  slip_url?: string;
  confirmed_by?: string;
  paid_at?: any;
  updated_at?: any;
}

export interface SystemSettings {
  gp_enabled?: boolean; // Toggle master GP commission ON/OFF
  gp_percent: number; // default 5
  delivery_fee: number; // default 10
  admin_promptpay_name?: string;
  admin_promptpay_number?: string;
  platform_name?: string;
  updated_at?: any;
}

export interface CreditTransaction {
  id: string;
  shop_id: string;
  shop_name?: string;
  order_id?: string;
  order_number?: number | null;
  amount: number;
  type: 'topup' | 'deduct' | 'gp_deduct';
  note?: string;
  created_by?: string;
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

