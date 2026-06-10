-- =============================================================
-- AI Job Application Agent — Initial Schema
-- Run this in Supabase: Dashboard → SQL Editor → New query
-- =============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================
-- user_profile
-- Stores resume text and job search preferences.
-- One row per user. Seed with your resume before first run.
-- =============================================================
CREATE TABLE IF NOT EXISTS user_profile (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_text      TEXT NOT NULL,
  target_roles     TEXT[]  DEFAULT ARRAY['Software Engineer'],
  target_locations TEXT[]  DEFAULT ARRAY['Remote'],
  min_score        INT     DEFAULT 60 CHECK (min_score BETWEEN 0 AND 100),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================
-- search_runs
-- Audit log for every agent pipeline run (scheduled or manual).
-- =============================================================
CREATE TABLE IF NOT EXISTS search_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by    TEXT NOT NULL CHECK (triggered_by IN ('scheduler', 'manual')),
  status          TEXT NOT NULL DEFAULT 'running'
                    CHECK (status IN ('running', 'completed', 'failed')),
  jobs_scraped    INT NOT NULL DEFAULT 0,
  jobs_scored     INT NOT NULL DEFAULT 0,
  jobs_queued     INT NOT NULL DEFAULT 0,
  jobs_tailored   INT NOT NULL DEFAULT 0,
  error_message   TEXT,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

-- =============================================================
-- job_listings
-- Every job scraped from any source. URL is the dedup key.
-- =============================================================
CREATE TABLE IF NOT EXISTS job_listings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source          TEXT NOT NULL CHECK (source IN ('linkedin', 'indeed', 'glassdoor', 'company')),
  url             TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  company         TEXT NOT NULL,
  location        TEXT,
  job_type        TEXT,
  salary_range    TEXT,
  description     TEXT NOT NULL,
  posted_at       TIMESTAMPTZ,
  scraped_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  search_run_id   UUID REFERENCES search_runs(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_job_listings_source ON job_listings(source);
CREATE INDEX IF NOT EXISTS idx_job_listings_scraped_at ON job_listings(scraped_at DESC);

-- =============================================================
-- job_matches
-- Gemini CV analysis result for each listing. One per listing.
-- =============================================================
CREATE TABLE IF NOT EXISTS job_matches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id      UUID NOT NULL REFERENCES job_listings(id) ON DELETE CASCADE UNIQUE,
  match_score     INT NOT NULL CHECK (match_score BETWEEN 0 AND 100),
  decision        TEXT NOT NULL CHECK (decision IN ('APPLY', 'APPLY_WITH_CAUTION', 'SKIP')),
  analysis        JSONB NOT NULL,
  scored_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_matches_score ON job_matches(match_score DESC);
CREATE INDEX IF NOT EXISTS idx_job_matches_decision ON job_matches(decision);

-- =============================================================
-- applications
-- Central tracker. One row per job the agent tailors.
-- Status moves: pending_review → approved → applying → applied
--                                         ↘ failed
--               pending_review → skipped
-- =============================================================
CREATE TABLE IF NOT EXISTS applications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id        UUID NOT NULL REFERENCES job_listings(id) ON DELETE CASCADE UNIQUE,
  status            TEXT NOT NULL DEFAULT 'pending_review'
                      CHECK (status IN (
                        'pending_review',
                        'approved',
                        'applying',
                        'applied',
                        'failed',
                        'skipped'
                      )),
  tailored_resume   JSONB,
  cover_letter      TEXT,
  notes             TEXT,
  error_message     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at       TIMESTAMPTZ,
  applied_at        TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_created_at ON applications(created_at DESC);

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_applications_updated_at
  BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_user_profile_updated_at
  BEFORE UPDATE ON user_profile
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================
-- Seed: insert your profile
-- Replace the resume_text, target_roles, and target_locations
-- with your actual data before running the agent for the first time.
-- =============================================================
INSERT INTO user_profile (resume_text, target_roles, target_locations, min_score)
VALUES (
  'PASTE YOUR RESUME TEXT HERE',
  ARRAY['Software Engineer', 'Backend Developer', 'Full Stack Developer'],
  ARRAY['Remote', 'New York, NY'],
  60
)
ON CONFLICT DO NOTHING;
