-- Add anon_user_id to orders so anonymous Supabase users can be linked to
-- their guest order. This replaces the polling-based guest chat with Realtime
-- subscriptions by giving guests a real authenticated session.
--
-- After signInAnonymously(), the client PATCHes /api/guest/orders/[orderId]
-- (validated by the existing guest_access_token cookie) to store their anon
-- user ID here. RLS policies below grant that anon user read/write access to
-- the conversation and messages for this order only.

ALTER TABLE "public"."orders"
  ADD COLUMN IF NOT EXISTS "anon_user_id" uuid REFERENCES auth.users(id);

-- conversations: anon orderer can read their conversation
CREATE POLICY "Anon orderers can view their conversations"
  ON "public"."conversations" FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "public"."orders" o
      WHERE o.id = order_id
        AND o.anon_user_id = auth.uid()
    )
  );

-- messages: anon orderer can read messages in their conversation
CREATE POLICY "Anon orderers can view their messages"
  ON "public"."messages" FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "public"."conversations" c
      JOIN "public"."orders" o ON o.id = c.order_id
      WHERE c.id = conversation_id
        AND o.anon_user_id = auth.uid()
    )
  );

-- messages: anon orderer can send messages (sender_id must match their uid)
CREATE POLICY "Anon orderers can send messages"
  ON "public"."messages" FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM "public"."conversations" c
      JOIN "public"."orders" o ON o.id = c.order_id
      WHERE c.id = conversation_id
        AND o.anon_user_id = auth.uid()
    )
  );
