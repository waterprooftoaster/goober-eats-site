/**
 * @file database.ts
 * @description TypeScript interfaces for all Goober Eats database entities.
 *   Called by: throughout the codebase wherever entity types are needed
 */

export interface Profile {
  id: string
  full_name: string
  email: string
  school_id: string | null
  is_swiper: boolean
  created_at: string
  updated_at: string
}

export type OrderStatus =
  | 'open'
  | 'in_progress'
  | 'completed'
  | 'cancelled'

export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded'

export interface Order {
  id: string
  orderer_id: string | null
  swiper_id: string | null
  school_id: string
  restaurant_name: string
  cart_screenshot_urls: string[]
  stripe_payment_intent_id: string | null
  status: OrderStatus
  subtotal_cents: number
  total_cents: number
  guest_name: string | null
  guest_phone: string | null
  guest_access_token: string | null
  anon_user_id: string | null
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
