// Shared types used by both the mobile app and the admin dashboard.
// Mirrors db/schema.sql — keep in sync when the schema changes.

export type Lang = 'ar' | 'en';

export type UserRole = 'customer' | 'staff' | 'owner';

export interface User {
  id: string;
  phone: string;
  phoneVerified: boolean;
  fullName?: string;
  email?: string;
  authProvider: 'phone' | 'google' | 'facebook' | 'apple';
  role: UserRole;
  preferredLang: Lang;
}

export interface Address {
  id: string;
  userId: string;
  label?: string;
  line1: string;
  line2?: string;
  city: string;
  lat?: number;
  lng?: number;
  isDefault: boolean;
}

export interface Branch {
  id: string;
  nameAr: string;
  nameEn: string;
  addressAr?: string;
  addressEn?: string;
  phone?: string;
  isActive: boolean;
}

export interface Category {
  id: string;
  nameAr: string;
  nameEn: string;
  sortOrder: number;
  isActive: boolean;
}

export interface ItemVariant {
  id: string;
  itemId: string;
  nameAr: string;
  nameEn: string;
  price: number;
  isDefault: boolean;
  /** Overrides the item's calorie count for this specific size, when calories genuinely differ by size (e.g. a rice plate at 1/2kg vs 1kg vs 2kg). */
  calories?: number;
}

export interface ItemExtra {
  id: string;
  itemId: string;
  nameAr: string;
  nameEn: string;
  price: number;
  isAvailable: boolean;
}

export interface MenuItem {
  id: string;
  categoryId: string;
  nameAr: string;
  nameEn: string;
  descriptionAr?: string;
  descriptionEn?: string;
  basePrice: number;
  imageUrl?: string;
  spiceLevelMax: number;
  isAvailable: boolean;
  /** Calories for the default size. If a variant carries its own `calories`, that takes precedence for that size. */
  calories?: number;
  variants: ItemVariant[];
  extras: ItemExtra[];
}

export type OrderStatus =
  | 'pending_payment'
  | 'received'
  | 'preparing'
  | 'out_for_delivery'
  | 'ready_for_pickup'
  | 'completed'
  | 'cancelled';

export type FulfillmentType = 'delivery' | 'pickup';
export type PaymentMethod = 'mada' | 'visa' | 'mastercard';
export type PaymentStatus = 'pending' | 'authorized' | 'captured' | 'failed' | 'refunded';

export interface CartExtra {
  extraId: string;
  nameAr: string;
  nameEn: string;
  price: number;
}

export interface CartItem {
  itemId: string;
  variantId?: string;
  nameAr: string;
  nameEn: string;
  unitPrice: number;
  quantity: number;
  spiceLevel?: number;
  notes?: string;
  extras: CartExtra[];
}

export interface OrderItem extends CartItem {
  id: string;
  lineTotal: number;
}

export interface Promotion {
  id: string;
  code?: string;
  nameAr: string;
  nameEn: string;
  termsAr?: string;
  termsEn?: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  maxDiscount?: number;
  firstNOrders?: number;
  isActive: boolean;
}

export interface Order {
  id: string;
  orderNumber: number;
  userId: string;
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
  addressId?: string;
  branchId?: string;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  discountAmount: number;
  promotionId?: string;
  total: number;
  currency: string;
  notes?: string;
  estimatedReadyAt?: string;
  createdAt: string;
  customer?: { fullName?: string; phone: string };
}

export interface Payment {
  id: string;
  orderId: string;
  gateway: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  cardLast4?: string;
  cardBrand?: string;
}

export type MessageType = 'text' | 'image' | 'video';
export type MessageSenderRole = 'customer' | 'staff';

export interface OrderMessage {
  id: string;
  orderId?: string;
  senderId: string;
  senderRole: MessageSenderRole;
  type: MessageType;
  body?: string;
  mediaUrl?: string;
  createdAt: string;
}

// The order-status pipeline the customer sees, in sequence.
export const ORDER_STATUS_FLOW: OrderStatus[] = [
  'received',
  'preparing',
  'out_for_delivery', // or ready_for_pickup, chosen based on fulfillmentType
  'completed',
];
