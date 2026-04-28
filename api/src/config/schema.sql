-- =============================================================================
--  Band Planner — Complete Database Schema
--  schema.sql
--
--  All statements use IF NOT EXISTS — safe to run multiple times.
--  Run via: npm run migrate  (or npm run migrate:all for all schema files)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────
--  USERS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(120)  NOT NULL,
  email         VARCHAR(255)  NOT NULL,
  password_hash TEXT          NOT NULL,
  -- Legacy single role (kept for backwards compat with original authController)
  role          VARCHAR(30)   NOT NULL DEFAULT 'musician',
  bio           TEXT,
  avatar_url    TEXT,
  -- Auth module additions
  email_verified BOOLEAN      DEFAULT FALSE,
  last_login_at  TIMESTAMPTZ,
  avatar_color   CHAR(7)      DEFAULT '#f0522a',
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(LOWER(email));

-- ─────────────────────────────────────────
--  BANDS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bands (
  id         UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       VARCHAR(120) NOT NULL,
  genre      VARCHAR(80),
  bio        TEXT,
  logo_url   TEXT,
  owner_id   UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Junction: users ↔ bands with RBAC roles
CREATE TABLE IF NOT EXISTS band_members (
  id         UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  band_id    UUID         NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  user_id    UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Instrument/position (e.g. "guitarist") — kept from original schema
  role       VARCHAR(80)  NOT NULL DEFAULT 'band_member',
  joined_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (band_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_band_members_band ON band_members(band_id);
CREATE INDEX IF NOT EXISTS idx_band_members_user ON band_members(user_id);

-- ─────────────────────────────────────────
--  VENUES
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS venues (
  id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(150) NOT NULL,
  address       TEXT,
  city          VARCHAR(100),
  state         VARCHAR(100),
  country       VARCHAR(100) DEFAULT 'US',
  zip           VARCHAR(20),
  lat           DECIMAL(9,6),
  lng           DECIMAL(9,6),
  capacity      INT,
  contact_name  VARCHAR(120),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(30),
  website       VARCHAR(255),
  notes         TEXT,
  created_by    UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_venues_created_by ON venues(created_by);

-- ─────────────────────────────────────────
--  TOURS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tours (
  id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  band_id     UUID         NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  name        VARCHAR(150) NOT NULL,
  description TEXT,
  start_date  DATE,
  end_date    DATE,
  status      VARCHAR(30)  NOT NULL DEFAULT 'planning',
                           -- planning | active | completed | cancelled
  color       CHAR(7)      DEFAULT '#f0522a',
  total_miles DECIMAL(10,2) DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tours_band_id ON tours(band_id);

-- Tour stops — ordered legs with distance between consecutive cities
CREATE TABLE IF NOT EXISTS tour_stops (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tour_id          UUID        NOT NULL REFERENCES tours(id)  ON DELETE CASCADE,
  gig_id           UUID        NOT NULL,  -- FK added after gigs table (see below)
  stop_order       INT         NOT NULL DEFAULT 0,
  miles_from_prev  DECIMAL(10,2),
  drive_time_min   INT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tour_id, gig_id)
);

CREATE INDEX IF NOT EXISTS idx_tour_stops_tour ON tour_stops(tour_id);

-- ─────────────────────────────────────────
--  GIGS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gigs (
  id               UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  band_id          UUID          NOT NULL REFERENCES bands(id)  ON DELETE CASCADE,
  venue_id         UUID          REFERENCES venues(id)          ON DELETE SET NULL,
  tour_id          UUID          REFERENCES tours(id)           ON DELETE SET NULL,
  title            VARCHAR(200)  NOT NULL,
  description      TEXT,
  gig_date         DATE          NOT NULL,
  load_in_time     TIME,
  soundcheck_time  TIME,
  start_time       TIME,
  end_time         TIME,
  status           VARCHAR(30)   NOT NULL DEFAULT 'confirmed',
                                 -- inquiry | confirmed | cancelled | completed
  deal_type        VARCHAR(30),  -- flat | percentage | guarantee_vs_door
  deal_amount      NUMERIC(10,2),
  ticket_price     NUMERIC(8,2),
  notes            TEXT,
  -- Analytics additions (actual figures recorded after the show)
  actual_payment   NUMERIC(10,2),
  actual_expenses  NUMERIC(10,2),
  attendance       INT,
  tour_stop_order  INT,
  created_by       UUID          REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gigs_band_id  ON gigs(band_id);
CREATE INDEX IF NOT EXISTS idx_gigs_tour_id  ON gigs(tour_id);
CREATE INDEX IF NOT EXISTS idx_gigs_gig_date ON gigs(gig_date);

-- Add the gig FK to tour_stops now that gigs table exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'tour_stops_gig_id_fkey'
  ) THEN
    ALTER TABLE tour_stops ADD CONSTRAINT tour_stops_gig_id_fkey
      FOREIGN KEY (gig_id) REFERENCES gigs(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ─────────────────────────────────────────
--  COLLABORATION — RSVPs, comments, reactions, activity feed
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS participants (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  gig_id     UUID        NOT NULL REFERENCES gigs(id)  ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rsvp       VARCHAR(20) NOT NULL DEFAULT 'pending',
                         -- yes | no | maybe | pending
  role       VARCHAR(50),
  notes      TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (gig_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_participants_gig  ON participants(gig_id);
CREATE INDEX IF NOT EXISTS idx_participants_user ON participants(user_id);

CREATE TABLE IF NOT EXISTS comments (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  gig_id     UUID        NOT NULL REFERENCES gigs(id)  ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id  UUID        REFERENCES comments(id) ON DELETE CASCADE,
  body       TEXT        NOT NULL,
  is_pinned  BOOLEAN     DEFAULT FALSE,
  edited_at  TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_gig    ON comments(gig_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);

CREATE TABLE IF NOT EXISTS comment_reactions (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id UUID        NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  emoji      VARCHAR(10) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (comment_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS activity_feed (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  gig_id     UUID        REFERENCES gigs(id)  ON DELETE CASCADE,
  user_id    UUID        REFERENCES users(id) ON DELETE SET NULL,
  action     VARCHAR(60) NOT NULL,
  meta       JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_gig ON activity_feed(gig_id);

-- ─────────────────────────────────────────
--  SETLISTS  (optional, tied to a gig)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS setlists (
  id         UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  gig_id     UUID         REFERENCES gigs(id)  ON DELETE CASCADE,
  band_id    UUID         NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  name       VARCHAR(150) NOT NULL DEFAULT 'Set 1',
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS setlist_songs (
  id         UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  setlist_id UUID         NOT NULL REFERENCES setlists(id) ON DELETE CASCADE,
  title      VARCHAR(200) NOT NULL,
  artist     VARCHAR(150),
  duration_s INT,
  position   SMALLINT     NOT NULL DEFAULT 0,
  notes      TEXT
);

-- ─────────────────────────────────────────
--  ATTACHMENTS  (contracts, riders, flyers)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attachments (
  id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type VARCHAR(30)  NOT NULL,   -- gig | tour | venue | band
  entity_id   UUID         NOT NULL,
  uploaded_by UUID         REFERENCES users(id) ON DELETE SET NULL,
  file_name   VARCHAR(255) NOT NULL,
  file_path   TEXT         NOT NULL,
  mime_type   VARCHAR(100),
  size_bytes  BIGINT,
  label       VARCHAR(100),            -- contract | rider | flyer | invoice | other
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attachments_entity ON attachments(entity_type, entity_id);

-- ─────────────────────────────────────────
--  updated_at trigger
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','bands','venues','tours','gigs'] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%1$s_upd ON %1$s;
       CREATE TRIGGER trg_%1$s_upd
       BEFORE UPDATE ON %1$s
       FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t);
  END LOOP;
END $$;
