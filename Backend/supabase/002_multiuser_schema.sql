-- =============================================================
-- AI Job Agent — Multi-User Schema (v2)
-- Run in Supabase: Dashboard → SQL Editor → New query
-- WARNING: Drops all existing data from v1 tables.
-- =============================================================

-- ─── Drop old tables ──────────────────────────────────────────
DROP TABLE IF EXISTS applications  CASCADE;
DROP TABLE IF EXISTS job_matches   CASCADE;
DROP TABLE IF EXISTS job_listings  CASCADE;
DROP TABLE IF EXISTS search_runs   CASCADE;
DROP TABLE IF EXISTS user_profile  CASCADE;

-- ─── Extensions ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================
-- user_profile
-- One row per auth user. Auto-created on signup via trigger.
-- =============================================================
CREATE TABLE user_profile (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  full_name           TEXT,
  resume_text         TEXT    NOT NULL DEFAULT '',
  target_roles        TEXT[]  NOT NULL DEFAULT ARRAY[]::TEXT[],
  target_locations    TEXT[]  NOT NULL DEFAULT ARRAY[]::TEXT[],
  min_score           INT     NOT NULL DEFAULT 60 CHECK (min_score BETWEEN 0 AND 100),
  schedule_time       TIME    NOT NULL DEFAULT '09:00',
  schedule_timezone   TEXT    NOT NULL DEFAULT 'America/Chicago',
  schedule_enabled    BOOLEAN NOT NULL DEFAULT false,
  onboarded           BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create a blank profile for every new signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_profile (user_id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================================
-- search_runs
-- =============================================================
CREATE TABLE search_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  triggered_by    TEXT NOT NULL CHECK (triggered_by IN ('scheduler', 'manual')),
  status          TEXT NOT NULL DEFAULT 'running'
                    CHECK (status IN ('running', 'completed', 'failed')),
  jobs_scraped    INT  NOT NULL DEFAULT 0,
  jobs_scored     INT  NOT NULL DEFAULT 0,
  jobs_queued     INT  NOT NULL DEFAULT 0,
  jobs_tailored   INT  NOT NULL DEFAULT 0,
  error_message   TEXT,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_search_runs_user ON search_runs(user_id);

-- =============================================================
-- job_listings
-- =============================================================
CREATE TABLE job_listings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source          TEXT NOT NULL CHECK (source IN ('linkedin', 'indeed', 'glassdoor', 'company')),
  url             TEXT NOT NULL,
  title           TEXT NOT NULL,
  company         TEXT NOT NULL,
  location        TEXT,
  job_type        TEXT,
  salary_range    TEXT,
  description     TEXT NOT NULL,
  posted_at       TIMESTAMPTZ,
  scraped_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  search_run_id   UUID REFERENCES search_runs(id) ON DELETE SET NULL,
  UNIQUE (user_id, url)           -- dedup is per-user, not global
);

CREATE INDEX idx_job_listings_user  ON job_listings(user_id);
CREATE INDEX idx_job_listings_scraped ON job_listings(scraped_at DESC);

-- =============================================================
-- job_matches
-- =============================================================
CREATE TABLE job_matches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id      UUID NOT NULL REFERENCES job_listings(id) ON DELETE CASCADE,
  match_score     INT  NOT NULL CHECK (match_score BETWEEN 0 AND 100),
  decision        TEXT NOT NULL CHECK (decision IN ('APPLY', 'APPLY_WITH_CAUTION', 'SKIP')),
  analysis        JSONB NOT NULL,
  scored_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, listing_id)
);

CREATE INDEX idx_job_matches_user  ON job_matches(user_id);
CREATE INDEX idx_job_matches_score ON job_matches(match_score DESC);

-- =============================================================
-- applications
-- =============================================================
CREATE TABLE applications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id        UUID NOT NULL REFERENCES job_listings(id) ON DELETE CASCADE,
  status            TEXT NOT NULL DEFAULT 'pending_review'
                      CHECK (status IN (
                        'pending_review', 'approved', 'applying',
                        'applied', 'failed', 'skipped'
                      )),
  tailored_resume   JSONB,
  cover_letter      TEXT,
  notes             TEXT,
  error_message     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at       TIMESTAMPTZ,
  applied_at        TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, listing_id)
);

CREATE INDEX idx_applications_user   ON applications(user_id);
CREATE INDEX idx_applications_status ON applications(status);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_applications_updated_at
  BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_user_profile_updated_at
  BEFORE UPDATE ON user_profile
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================
-- Row Level Security
-- Backend uses service role (bypasses RLS).
-- RLS protects direct client access as a safety net.
-- =============================================================
ALTER TABLE user_profile  ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_runs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_listings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_matches   ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications  ENABLE ROW LEVEL SECURITY;

-- user_profile: users can only read/write their own row
CREATE POLICY "own profile"  ON user_profile  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own runs"     ON search_runs   FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own listings" ON job_listings  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own matches"  ON job_matches   FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own apps"     ON applications  FOR ALL USING (auth.uid() = user_id);
