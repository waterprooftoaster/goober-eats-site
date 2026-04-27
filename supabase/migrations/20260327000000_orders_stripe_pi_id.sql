-- Replace stripe_checkout_session_id (if it exists) with stripe_payment_intent_id.
-- Orders are now created by the payment_intent.succeeded webhook, so the PI ID
-- is the natural idempotency key. A unique constraint prevents duplicate orders
-- on webhook retry when the payment insert fails after order creation.

DROP INDEX IF EXISTS idx_orders_stripe_checkout_session_id;
ALTER TABLE orders DROP COLUMN IF EXISTS stripe_checkout_session_id;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_stripe_payment_intent_id
  ON orders (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;
