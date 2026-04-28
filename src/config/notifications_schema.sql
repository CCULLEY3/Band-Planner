-- =============================================================================
--  Band Planner — Notifications Schema
--  notifications_schema.sql
--  Depends on: schema.sql (users, gigs tables)
-- =============================================================================

CREATE TABLE IF NOT EXISTS notification_preferences (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  band_id      UUID        NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  email_24h    BOOLEAN     DEFAULT TRUE,
  email_1h     BOOLEAN     DEFAULT FALSE,
  email_new_gig BOOLEAN    DEFAULT TRUE,
  email_rsvp   BOOLEAN     DEFAULT FALSE,
  push_24h     BOOLEAN     DEFAULT TRUE,
  push_1h      BOOLEAN     DEFAULT FALSE,
  push_new_gig BOOLEAN     DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, band_id)
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         UUID  PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint   TEXT  NOT NULL UNIQUE,
  p256dh     TEXT  NOT NULL,
  auth       TEXT  NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);

CREATE TABLE IF NOT EXISTS notification_history (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        REFERENCES users(id) ON DELETE SET NULL,
  gig_id     UUID        REFERENCES gigs(id)  ON DELETE SET NULL,
  channel    VARCHAR(20) NOT NULL CHECK (channel IN ('email','push')),
  type       VARCHAR(30) NOT NULL,
  subject    VARCHAR(255),
  status     VARCHAR(20) DEFAULT 'sent',
  error      TEXT,
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nh_user ON notification_history(user_id);
CREATE INDEX IF NOT EXISTS idx_nh_gig  ON notification_history(gig_id);
