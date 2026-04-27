-- Remove guest_stripe_pm_id column and relax guest order constraint.
-- Guest orders now use Stripe Checkout Session (payment confirmed via webhook)
-- instead of storing a payment method ID for deferred auto-charge.

ALTER TABLE "public"."orders" DROP COLUMN IF EXISTS "guest_stripe_pm_id";

ALTER TABLE "public"."orders" DROP CONSTRAINT IF EXISTS "orders_orderer_or_guest";
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_orderer_or_guest"
  CHECK (("orderer_id" IS NOT NULL) OR ("guest_name" IS NOT NULL));

-- Allow payee_id to be NULL for guest payments created before a swiper accepts.
-- (The existing FK already uses ON DELETE SET NULL, which requires nullability.)
ALTER TABLE "public"."payments" ALTER COLUMN "payee_id" DROP NOT NULL;
