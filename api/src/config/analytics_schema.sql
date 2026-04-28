-- =============================================================================
--  Band Planner — Analytics Schema Extension
--  analytics_schema.sql
--  Depends on: schema.sql (bands, gigs, tours, users tables)
-- =============================================================================

CREATE TABLE IF NOT EXISTS financial_records (
  id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  band_id     UUID          NOT NULL REFERENCES bands(id)  ON DELETE CASCADE,
  gig_id      UUID          REFERENCES gigs(id)   ON DELETE SET NULL,
  tour_id     UUID          REFERENCES tours(id)  ON DELETE SET NULL,
  record_type VARCHAR(20)   NOT NULL CHECK (record_type IN ('payment','expense')),
  category    VARCHAR(60)   NOT NULL DEFAULT 'misc',
              -- payment categories: guarantee | merch | sponsorship | tips
              -- expense categories: travel | lodging | food | gear | promo | misc
  amount      DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  currency    CHAR(3)       NOT NULL DEFAULT 'USD',
  description TEXT,
  record_date DATE          NOT NULL,
  created_by  UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fin_band     ON financial_records(band_id);
CREATE INDEX IF NOT EXISTS idx_fin_gig      ON financial_records(gig_id);
CREATE INDEX IF NOT EXISTS idx_fin_type_date ON financial_records(record_type, record_date);
