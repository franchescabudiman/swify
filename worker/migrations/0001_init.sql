-- Swify booking backend (Cloudflare D1 / SQLite)

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL              -- JSON
);

-- Independent cleaning businesses in the referral network.
-- Each provider sets its OWN rates (rates JSON), edited only through the provider portal.
CREATE TABLE IF NOT EXISTS providers (
  id               TEXT PRIMARY KEY,
  business_name    TEXT NOT NULL,  -- name the provider operates under (shown to clients)
  legal_name       TEXT,           -- LLC / entity name
  email            TEXT NOT NULL,
  phone            TEXT,
  license_no       TEXT,           -- business license / tax registration
  insurance_expires TEXT,          -- YYYY-MM-DD
  zips             TEXT NOT NULL DEFAULT '[]',  -- JSON array of ZIPs served
  active           INTEGER NOT NULL DEFAULT 1,  -- admin can pause referrals
  stripe_account   TEXT,           -- Stripe Connect account id (acct_...)
  charges_enabled  INTEGER NOT NULL DEFAULT 0,  -- from Stripe (account.updated)
  token_hash       TEXT,           -- SHA-256 of the provider's private portal token
  rates            TEXT NOT NULL DEFAULT '{}',  -- JSON rate card, set by the provider
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bookings (
  id               TEXT PRIMARY KEY,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  status           TEXT NOT NULL,  -- pending_payment | paid | accepted | declined | cancelled | refunded | expired
  provider_id      TEXT NOT NULL,
  answers          TEXT NOT NULL,  -- JSON: service, size, bathrooms, frequency, addons, date, window, zip, custom answers
  contact          TEXT NOT NULL,  -- JSON: name, email, phone, address, unit, notes
  summary          TEXT NOT NULL,  -- JSON price breakdown at time of booking
  provider_amount  INTEGER NOT NULL,  -- cents, provider's own rate (paid to provider in full)
  fee_amount       INTEGER NOT NULL,  -- cents, Swify booking fee paid by the client
  total_amount     INTEGER NOT NULL,
  currency         TEXT NOT NULL,
  stripe_session   TEXT,
  payment_intent   TEXT,
  provider_note    TEXT
);

CREATE INDEX IF NOT EXISTS bookings_provider ON bookings(provider_id, created_at);
CREATE INDEX IF NOT EXISTS bookings_session ON bookings(stripe_session);
CREATE INDEX IF NOT EXISTS providers_token ON providers(token_hash);
