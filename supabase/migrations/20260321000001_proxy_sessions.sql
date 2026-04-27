CREATE TABLE proxy_sessions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid        NOT NULL REFERENCES orders(id),
  conversation_id uuid        NOT NULL REFERENCES conversations(id),
  orderer_phone   text        NOT NULL,
  orderer_id      uuid        REFERENCES profiles(id),
  swiper_phone    text        NOT NULL,
  swiper_id       uuid        NOT NULL REFERENCES profiles(id),
  is_active       boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Partial indexes for fast webhook phone lookups (hot path)
CREATE INDEX proxy_sessions_orderer_phone_active_idx
  ON proxy_sessions(orderer_phone) WHERE is_active = true;
CREATE INDEX proxy_sessions_swiper_phone_active_idx
  ON proxy_sessions(swiper_phone) WHERE is_active = true;
CREATE INDEX proxy_sessions_order_id_idx ON proxy_sessions(order_id);

ALTER TABLE proxy_sessions ENABLE ROW LEVEL SECURITY;
-- No user-facing RLS policies; all access via service client which bypasses RLS
