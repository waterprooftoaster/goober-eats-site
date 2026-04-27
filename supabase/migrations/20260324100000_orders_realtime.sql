-- Enable Realtime streaming for the orders table so clients can subscribe
-- to UPDATE events (used by the chat widget to detect order acceptance).
ALTER PUBLICATION supabase_realtime ADD TABLE "public"."orders";
