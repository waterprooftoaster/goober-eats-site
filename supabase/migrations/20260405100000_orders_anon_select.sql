-- Fix missing RLS policy: allow anonymous users to SELECT their own orders.
-- The anon_user_id migration (20260405000000) added conversations and messages
-- policies for anon users but omitted the orders SELECT policy. Without this,
-- ChatPanelProvider's loadActiveOrders() and the Realtime subscription filter
-- on anon_user_id cannot read the order row to open/update the panel.

DROP POLICY IF EXISTS "orders_select" ON "public"."orders";

CREATE POLICY "orders_select" ON "public"."orders"
    FOR SELECT TO "authenticated"
    USING (
        (( SELECT auth.uid()) = orderer_id)
        OR
        (( SELECT auth.uid()) = swiper_id)
        OR
        (( SELECT auth.uid()) = anon_user_id)
        OR
        (status = 'open' AND swiper_id IS NULL)
    );
