-- =============================================================================
--  Band Planner — Auth Schema Extension
--  auth_schema.sql
--  Depends on: schema.sql (users, bands, band_members tables)
-- =============================================================================

-- Refresh tokens for JWT rotation
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT        NOT NULL UNIQUE,   -- SHA-256 of the raw token
  family      UUID        NOT NULL,          -- rotation-family for reuse detection
  used        BOOLEAN     NOT NULL DEFAULT FALSE,
  expires_at  TIMESTAMPTZ NOT NULL,
  user_agent  TEXT,
  ip_address  INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rt_user   ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_rt_hash   ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_rt_expiry ON refresh_tokens(expires_at);

-- Band invite links (leaders generate, members register with them)
CREATE TABLE IF NOT EXISTS band_invitations (
  id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  band_id     UUID         NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  email       VARCHAR(255) NOT NULL,
  role        VARCHAR(30)  NOT NULL DEFAULT 'band_member',
  token       TEXT         NOT NULL UNIQUE,
  invited_by  UUID         NOT NULL REFERENCES users(id),
  accepted_at TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ  NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_token ON band_invitations(token);
CREATE INDEX IF NOT EXISTS idx_inv_email ON band_invitations(email);

-- Tighten band_members.role to the RBAC values (safe to apply idempotently)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'chk_band_members_role'
      AND table_name = 'band_members'
  ) THEN
    ALTER TABLE band_members
      ADD CONSTRAINT chk_band_members_role
      CHECK (role IN ('band_leader','band_member','manager','guest'));
  END IF;
END $$;
