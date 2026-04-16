export interface Profile {
  id: string
  full_name: string
  email: string
  school_id: string | null
  is_swiper: boolean
  avatar_url: string | null
  phone: string | null
  created_at: string
  updated_at: string
}

export interface Eatery {
  id: string
  school_id: string
  name: string
  image_url: string | null
  address: string
  delivery_time_label: string | null
  is_active: boolean
  latitude: number | null
  longitude: number | null
  created_at: string
  updated_at: string
}

export interface MenuItemGroup {
  id: string
  eatery_id: string
  name: string
  created_at: string
  updated_at: string
}

export interface MenuItem {
  id: string
  restaurant_id: string
  name: string
  group_id: string
  original_price_cents: number
  market_price_cents: number | null
  image_url: string | null
  is_available: boolean
  created_at: string
  updated_at: string
}

export interface MenuGroupWithItems {
  id: string
  name: string
  avg_discount_cents: number
  items: Pick<MenuItem, 'id' | 'name' | 'original_price_cents' | 'market_price_cents' | 'image_url'>[]
}

export type SelectionType = 'single' | 'multiple'

export interface MenuItemOptionGroup {
  id: string
  /** Nullable after the shared-option-groups migration; use menu_item_option_group_assignments instead */
  menu_item_id: string | null
  name: string
  selection_type: SelectionType
  is_required: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

/** Junction table row linking a menu item to a shared option group */
export interface MenuItemOptionGroupAssignment {
  menu_item_id: string
  option_group_id: string
  sort_order: number
}

export interface MenuItemOption {
  id: string
  option_group_id: string
  name: string
  additional_price_cents: number
  is_default: boolean
  sort_order: number
  /** When set, selecting this option also auto-adds the linked item to the cart */
  linked_menu_item_id: string | null
  created_at: string
  updated_at: string
}

export type OrderStatus =
  | 'open'
  | 'in_progress'
  | 'completed'
  | 'cancelled'

export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded'

export interface OrderItem {
  menu_item_id: string
  name: string
  price_cents: number
  quantity: number
}

export interface Order {
  id: string
  orderer_id: string | null
  swiper_id: string | null
  eatery_id: string
  stripe_payment_intent_id: string | null
  status: OrderStatus
  items: OrderItem[]
  total_cents: number
  tip_cents: number
  special_instructions: string | null
  guest_name: string | null
  guest_phone: string | null
  guest_access_token: string | null
  created_at: string
  updated_at: string
}

export interface Payment {
  id: string
  order_id: string
  stripe_payment_intent_id: string
  amount_cents: number
  platform_fee_cents: number
  status: PaymentStatus
  payer_id: string | null
  payee_id: string | null
  created_at: string
}

export interface StripeAccount {
  id: string
  user_id: string
  stripe_account_id: string
  onboarding_complete: boolean
  created_at: string
}

export interface Cart {
  id: string
  user_id: string | null
  session_id: string | null
  eatery_id: string
  created_at: string
  updated_at: string
}

export interface CartItem {
  id: string
  cart_id: string
  menu_item_id: string
  quantity: number
  selected_options: string[]
  added_at: string
}
