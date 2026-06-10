# AI Job Application Agent — Production Upgrade Plan

## Vision

An autonomous daily agent that scrapes LinkedIn, Indeed, Glassdoor, and company career pages, scores every listing against your resume, tailors your documents for the best matches, and presents a review dashboard where you approve jobs before the agent submits the applications. Every job touched is tracked end-to-end.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    SCHEDULER (node-cron)                 │
│              Daily 9am  +  Manual trigger                │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│                  SCRAPER SERVICE                         │
│   Apify actors → LinkedIn / Indeed / Glassdoor /        │
│   Company pages → deduplicate by URL → save to DB       │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              SCORING PIPELINE (batched)                  │
│   Gemini analyzeCV × each new listing (parallel, max 5) │
│   Score ≥ 60 → queue for tailoring                      │
│   Score < 60 → mark SKIP, still stored                  │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              TAILORING PIPELINE                          │
│   generateTailoredResume + generateCoverLetter           │
│   per qualifying job → store JSON in applications table  │
│   Status: pending_review                                 │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│                  DASHBOARD (React)                       │
│   Pipeline view: Scraped → Scored → Tailored →          │
│   Pending Review → Applied / Skipped                    │
│   Per-job card: score, tailored docs, Approve / Skip    │
│   Application tracker: full history with status + dates  │
└──────────────────────┬──────────────────────────────────┘
                       │ User clicks Approve
                       ▼
┌─────────────────────────────────────────────────────────┐
│              AUTO-APPLY SERVICE                          │
│   Apify browser actor → LinkedIn Easy Apply             │
│   Form-based submission for Indeed / others             │
│   Status: applied  →  store applied_at timestamp        │
└─────────────────────────────────────────────────────────┘
```

---

## Tech Stack Additions

| New piece | Purpose |
|---|---|
| **Supabase** | PostgreSQL DB + Auth + real-time subscriptions for live dashboard |
| **Apify** (existing MCP) | Job scraping actors + browser automation for apply |
| **BullMQ + Redis** | Job queue for scoring/tailoring pipeline (prevents Gemini overload) |
| **node-cron** | Daily scheduler inside Express |
| **Playwright** (fallback) | Direct browser control if Apify apply actor doesn't cover a site |
| **shadcn/ui + Tailwind** | Upgrade to loveable-frontend for the dashboard |

---

## Database Schema (Supabase / PostgreSQL)

### `user_profile`
Stores the user's resume and job search preferences. Single row per user.

```sql
CREATE TABLE user_profile (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users,
  resume_text   TEXT NOT NULL,
  target_roles  TEXT[],          -- e.g. ['Software Engineer', 'Backend Developer']
  target_locations TEXT[],       -- e.g. ['Remote', 'New York, NY']
  min_score     INT DEFAULT 60,  -- skip jobs below this score
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
```

### `search_runs`
Audit log for every agent run.

```sql
CREATE TABLE search_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by    TEXT CHECK (triggered_by IN ('scheduler', 'manual')),
  status          TEXT CHECK (status IN ('running', 'completed', 'failed')),
  jobs_scraped    INT DEFAULT 0,
  jobs_scored     INT DEFAULT 0,
  jobs_queued     INT DEFAULT 0,  -- qualified for tailoring
  jobs_tailored   INT DEFAULT 0,
  error_message   TEXT,
  started_at      TIMESTAMPTZ DEFAULT now(),
  completed_at    TIMESTAMPTZ
);
```

### `job_listings`
Every scraped job. URL is the dedup key.

```sql
CREATE TABLE job_listings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source          TEXT CHECK (source IN ('linkedin', 'indeed', 'glassdoor', 'company')),
  url             TEXT UNIQUE NOT NULL,
  title           TEXT NOT NULL,
  company         TEXT NOT NULL,
  location        TEXT,
  job_type        TEXT,           -- full-time, contract, etc.
  description     TEXT NOT NULL,
  posted_at       TIMESTAMPTZ,
  scraped_at      TIMESTAMPTZ DEFAULT now(),
  search_run_id   UUID REFERENCES search_runs(id)
);
```

### `job_matches`
Gemini analysis result per listing.

```sql
CREATE TABLE job_matches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id      UUID REFERENCES job_listings(id) UNIQUE,
  match_score     INT NOT NULL,
  decision        TEXT CHECK (decision IN ('APPLY', 'APPLY_WITH_CAUTION', 'SKIP')),
  analysis        JSONB NOT NULL,   -- full Gemini analysis object
  scored_at       TIMESTAMPTZ DEFAULT now()
);
```

### `applications`
One row per job the agent will attempt to apply to. Central tracker table.

```sql
CREATE TABLE applications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id        UUID REFERENCES job_listings(id) UNIQUE,
  status            TEXT CHECK (status IN (
                      'pending_review',   -- tailored, waiting for user approval
                      'approved',         -- user approved, queued for apply
                      'applying',         -- apply agent is running
                      'applied',          -- successfully submitted
                      'failed',           -- apply attempt failed
                      'skipped'           -- user skipped it
                    )) DEFAULT 'pending_review',
  tailored_resume   JSONB,            -- full tailored resume JSON
  cover_letter      TEXT,
  notes             TEXT,             -- user notes on this application
  error_message     TEXT,             -- if status = failed
  created_at        TIMESTAMPTZ DEFAULT now(),
  approved_at       TIMESTAMPTZ,
  applied_at        TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ DEFAULT now()
);
```

---

## Backend: New Services & Files

### Directory structure after upgrade

```
Backend/
├── app.js
├── config/
│   └── supabase.js           ← Supabase client init
├── controllers/
│   ├── analyzeController.js  (existing)
│   ├── agentController.js    ← NEW: trigger run, get status
│   └── applicationController.js  ← NEW: approve/skip/tracker
├── services/
│   ├── aiSharedService.js    (existing, minor fix: maxOutputTokens)
│   ├── aiService.js          (existing)
│   ├── scraperService.js     ← NEW: Apify scraping per source
│   ├── scoringService.js     ← NEW: batch scoring with concurrency limit
│   ├── tailoringService.js   ← NEW: tailor resume + cover letter per job
│   └── applyService.js       ← NEW: Apify browser apply per source
├── queues/
│   ├── scoringQueue.js       ← BullMQ queue for scoring jobs
│   └── tailoringQueue.js     ← BullMQ queue for tailoring jobs
├── scheduler/
│   └── dailyRun.js           ← node-cron: runs full pipeline at 9am
├── middleware/               (existing)
├── routes/
│   ├── ...existing routes
│   ├── agentRoutes.js        ← POST /api/agent/run, GET /api/agent/status/:runId
│   └── applicationRoutes.js  ← GET /api/applications, PATCH /api/applications/:id
└── utils/                    (existing)
```

### Key service responsibilities

**`scraperService.js`**
- One function per source: `scrapeLinkedIn(keywords, location)`, `scrapeIndeed(...)`, etc.
- Calls Apify actors via the MCP
- Deduplicates against existing URLs in `job_listings`
- Returns array of new listings saved to DB

**`scoringService.js`**
- Fetches all unscored listings for a run
- Runs `analyzeCV` in parallel batches of 5 (prevent rate limits)
- Writes results to `job_matches`
- Returns listings where `match_score >= user_profile.min_score`

**`tailoringService.js`**
- Takes qualifying listings
- Calls `generateTailoredResume` + `generateCoverLetter` sequentially per job
- Writes to `applications` with status `pending_review`

**`applyService.js`**
- Called after user approves an application
- Chooses the right Apify apply actor based on `listing.source`
- Updates `applications.status` to `applying` → `applied` or `failed`

**`dailyRun.js`**
```javascript
// Runs at 9am every day
cron.schedule('0 9 * * *', async () => {
  const run = await createSearchRun('scheduler');
  try {
    const listings = await scrapeAll(run.id);
    const qualified = await scoreAll(listings, run.id);
    await tailorAll(qualified, run.id);
    await completeSearchRun(run.id);
  } catch (err) {
    await failSearchRun(run.id, err.message);
  }
});
```

---

## New API Routes

### Agent

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/api/agent/run` | Manually trigger a full pipeline run |
| `GET` | `/api/agent/status/:runId` | Get run progress (jobs scraped/scored/tailored) |
| `GET` | `/api/agent/runs` | List all historical runs |

### Applications (Tracker)

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/api/applications` | All applications, filterable by status |
| `GET` | `/api/applications/:id` | Single application with full tailored docs |
| `PATCH` | `/api/applications/:id/approve` | Approve → triggers auto-apply |
| `PATCH` | `/api/applications/:id/skip` | Mark as skipped |
| `GET` | `/api/applications/stats` | Counts per status for dashboard summary |

---

## Frontend: Dashboard Views

Built on the existing `loveable-frontend/Career Navigator` (TypeScript + shadcn/ui).

### 1. Pipeline View (home)
Shows today's run progress and pending reviews:
- Run status banner: "Last run: today 9:04am — 47 jobs scraped, 12 qualified, 8 tailored"
- Cards for each `pending_review` application:
  - Job title, company, source badge, match score, decision badge
  - Expandable: tailored resume preview + cover letter
  - **Approve** button (green) / **Skip** button (ghost)
- Manual "Run Now" button

### 2. Application Tracker (dedicated tab)
Full history table of every application, filterable and sortable:

| Column | Details |
|--------|---------|
| Job title + company | Linked to original posting |
| Source | LinkedIn / Indeed badge |
| Score | Colour-coded (green ≥80, amber 60–79, red <60) |
| Status | Pipeline status chip |
| Applied date | Shown when status = applied |
| Actions | View docs / Notes |

Filters: status, source, date range, score range
Export: CSV download of all applications

### 3. Profile / Resume Settings
- Edit target roles, locations, min score threshold
- Upload/edit resume text
- Preview how your profile looks to the agent

---

## Implementation Phases

### Phase 1 — Foundation (do first)
1. Set up Supabase project, run schema migrations
2. Add `config/supabase.js` to backend
3. Fix existing bugs: `maxOutputTokens` → 8000, relative path in `resumeUtils`, remove `details` from prod 500s
4. Add `user_profile` seed data (your resume + target roles)

### Phase 2 — Scraper
1. Research available Apify actors for each job board
2. Implement `scraperService.js` with dedup
3. Add `agentRoutes.js` with manual trigger
4. Test: scrape → listings appear in Supabase

### Phase 3 — Scoring & Tailoring Pipeline
1. Implement `scoringService.js` (parallel batches, write to `job_matches`)
2. Implement `tailoringService.js` (write to `applications`)
3. Add BullMQ queues to prevent Gemini overload
4. Test: full pipeline run → applications in `pending_review`

### Phase 4 — Dashboard & Tracker
1. Upgrade loveable-frontend: add pipeline view + tracker tab
2. Connect to `/api/applications` endpoints
3. Implement approve/skip actions
4. Live status polling for run progress

### Phase 5 — Auto-Apply
1. Research Apify apply actors (LinkedIn Easy Apply, Indeed)
2. Implement `applyService.js`
3. Wire up approve → apply flow
4. Test on a safe staging job

### Phase 6 — Scheduler & Production
1. Add `node-cron` daily scheduler
2. Set up Render environment variables (Supabase URL, Apify key, Redis URL)
3. Add Redis (Render Redis add-on or Upstash) for BullMQ
4. Deploy and monitor first automated run

---

## Key Engineering Decisions

**Why BullMQ?** Scoring 50 jobs in parallel would saturate Gemini's rate limits. BullMQ lets you process 5 at a time with backpressure and automatic retries.

**Why keep tailored docs as JSONB?** Supabase's JSONB lets you query inside the document (e.g. `WHERE tailored_resume->>'matchScore' > '75'`) and the frontend can render any field without a schema migration.

**Why Supabase over plain Postgres?** Real-time subscriptions let the dashboard update live as the pipeline runs without polling. Auth is also built in if you want multi-user support later.

**Why review-before-apply?** Applying to jobs has real consequences. The agent scrapes and tailors autonomously (cheap, reversible) but the apply step is gated on your explicit approval.

---

## Bugs to Fix in Phase 1 (from code review)

1. `maxOutputTokens: 4000` → raise to `8000` in `aiService.js`
2. `fs.readFileSync("./data/resume.txt")` → use `path.join(__dirname, "../data/resume.txt")`
3. `details: error.message` in 500 responses → strip in production (`NODE_ENV !== 'development'`)
4. `getGeminiClient()` inside every call → instantiate client once at module load
5. Controllers redundantly check `jobDescription.trim() === ""` after middleware already validates → remove
6. Rotate Gemini API key (current one is in `.env` file)

---

## Apify Actors to Research

| Source | Actor to evaluate |
|--------|------------------|
| LinkedIn Jobs | `apify/linkedin-jobs-scraper` |
| Indeed | `misceres/indeed-scraper` or `apify/indeed-scraper` |
| Glassdoor | `bebity/glassdoor-jobs-scraper` |
| LinkedIn Easy Apply | `scrapingfish/linkedin-easy-apply` or custom Playwright |
| Indeed Apply | Custom Playwright actor |

Run `apify/actor-search` for each to confirm current ratings and input schemas before committing.
