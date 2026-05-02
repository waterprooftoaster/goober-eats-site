-- Fires a Realtime Broadcast on the school-scoped queue topic whenever
-- orders.status changes. The swiper queue (hooks/use-swiper-queue.ts)
-- listens for these and refetches /api/swiper/pending. Broadcast bypasses
-- the orders RLS SELECT filter, which otherwise drops postgres_changes
-- UPDATE events for transitions OUT of (status='open' AND swiper_id IS NULL).
CREATE OR REPLACE FUNCTION public.broadcast_orders_queue_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM realtime.send(
    jsonb_build_object('order_id', NEW.id, 'status', NEW.status),
    'queue_changed',
    'orders:queue:' || NEW.school_id::text,
    false
  );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS orders_broadcast_queue_change ON public.orders;
CREATE TRIGGER orders_broadcast_queue_change
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.broadcast_orders_queue_change();
