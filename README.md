# JobFit AI — AI Job Agent 2.0

[![Live Demo](https://img.shields.io/badge/Live%20Demo-ai--job--agent--2--0.pages.dev-blue?style=flat-square)](https://ai-job-agent-2-0.pages.dev)
[![Node.js](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-green?style=flat-square)](https://nodejs.org)
[![React](https://img.shields.io/badge/Frontend-React%20%2B%20TypeScript-61DAFB?style=flat-square)](https://react.dev)
[![Supabase](https://img.shields.io/badge/Database-Supabase-3ECF8E?style=flat-square)](https://supabase.com)
[![Gemini](https://img.shields.io/badge/AI-Gemini%202.5%20Flash-4285F4?style=flat-square)](https://ai.google.dev/gemini-api)

> A full-stack, multi-user SaaS platform that automates the entire job application pipeline — from scraping live job listings to generating AI-tailored resumes and cover letters, ready to download and apply.

---

## The Problem

Job searching at scale is repetitive and time-consuming: manually checking LinkedIn, Indeed, and Glassdoor for new postings, reading each description to judge fit, and rewriting your resume and cover letter for every application — often for dozens of jobs a week. Most candidates either burn hours on this grind or send the same generic resume everywhere, which hurts both ATS match rates and response rates.

**JobFit AI removes that grind.** It surfaces fresh, relevant postings daily, scores each one against your real resume so you only spend time on jobs worth pursuing, and generates a tailored, ATS-optimized resume and cover letter per job — so you can review and apply in minutes instead of hours.

---

## How It Works

1. **Set up your profile** — paste your resume, add target roles and locations, set a minimum match score
2. **Run the pipeline** — the agent scrapes LinkedIn, Indeed, and Glassdoor for fresh listings
3. **AI scores each job** — Gemini analyzes your resume against every listing and assigns a match score with a detailed fit report
4. **AI tailors your documents** — qualifying jobs get a custom resume and cover letter generated automatically
5. **Review and apply** — open each application in the dashboard, read the AI analysis, download the resume/cover letter as PDF or Word, then apply directly on the company's site
6. **Track status** — mark applications as Approved, Applied, or Skipped

---

## Features

| Feature | Details |
|---|---|
| **Automated scraping** | LinkedIn, Indeed, and Glassdoor scraped via Apify on demand or on a daily schedule |
| **AI scoring** | Gemini evaluates each job against your resume: match score, strengths, gaps, keywords, strategy |
| **ATS-optimized resume tailoring** | Role-specific resume generated per job, preserving only real experience |
| **Cover letter generation** | Concise, honest, first-person cover letters (100–160 words) |
| **PDF + Word export** | One-click download for both resume and cover letter |
| **Application dashboard** | Review all applications, filter by status, search by title or company |
| **Per-user scheduler** | Set a daily run time and timezone; the agent runs automatically |
| **Multi-user auth** | Supabase JWT authentication with Row Level Security — every user's data is fully isolated |
| **Pipeline status polling** | Live progress indicator (Scrape → Score → Tailor) while the pipeline runs |
| **Profile completeness guard** | Pipeline is blocked until resume and target roles are configured |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | TanStack Start, React, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Node.js, Express 5 |
| Database & Auth | Supabase (PostgreSQL + Auth + RLS) |
| AI | Google Gemini 2.5 Flash |
| Scraping | Apify (LinkedIn, Indeed, Glassdoor actors) |
| Scheduling | node-cron (per-user daily scheduler) |
| Document export | docx, pdfkit |
| Frontend hosting | Cloudflare Pages (Workers SSR, advanced mode) |
| Backend hosting | Railway |

---

## Architecture

```
User → Cloudflare Pages (SSR) → Railway (Express API)
                                      ↓
                              Supabase (PostgreSQL + Auth)
                                      ↓
                    ┌─────────────────────────────────┐
                    │         Agent Pipeline           │
                    │  Apify Scrape → Gemini Score     │
                    │       → Gemini Tailor            │
                    └─────────────────────────────────┘
```

---

## Project Structure

```
ai-job-agent-2.0/
├── Backend/
│   ├── app.js                      # Express app, CORS, rate limiting
│   ├── scheduler/
│   │   └── dailyRun.js             # Per-user cron scheduler
│   ├── controllers/
│   │   ├── agentController.js      # Pipeline trigger + status
│   │   ├── dashboardController.js  # Applications CRUD + document download
│   │   └── profileController.js
│   ├── services/
│   │   ├── scraperService.js       # Apify scraping + normalization
│   │   ├── scoringService.js       # Gemini AI scoring
│   │   ├── tailoringService.js     # Resume + cover letter generation
│   │   ├── aiSharedService.js      # Gemini prompts
│   │   └── aiService.js            # Gemini client + retry logic
│   ├── middleware/
│   │   └── authMiddleware.js       # Supabase JWT verification
│   ├── utils/
│   │   └── batchRun.js             # Shared batched async runner
│   └── supabase/
│       └── migration.sql           # Full DB schema
│
└── Frontend/Career Navigator/
    └── src/
        ├── routes/
        │   ├── index.tsx            # Landing page
        │   ├── dashboard.tsx        # Application dashboard
        │   ├── profile.tsx          # Profile + schedule setup
        │   ├── login.tsx
        │   └── signup.tsx
        ├── components/dashboard/
        │   ├── ApplicationCard.tsx
        │   ├── ApplicationDrawer.tsx  # Resume, cover letter, analysis, downloads
        │   └── StatsBar.tsx
        └── lib/
            ├── auth-context.tsx
            ├── dashboard-api.ts
            └── supabase.ts
```

---

## Local Development

### Prerequisites

- Node.js 18+
- Supabase project (free tier works)
- Apify account + API token
- Google Gemini API key

### 1. Clone the repo

```bash
git clone https://github.com/hassan2163/ai-job-agent-2.0.git
cd ai-job-agent-2.0
```

### 2. Backend setup

```bash
cd Backend
npm install
```

Create `Backend/.env`:

```env
GEMINI_API_KEY=your_gemini_api_key
APIFY_API_TOKEN=your_apify_token
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
FRONTEND_URL=http://localhost:5173
PORT=5000
NODE_ENV=development
```

Run the database migration in your Supabase SQL editor:

```
Backend/supabase/migration.sql
```

Start the backend:

```bash
npm run dev
```

### 3. Frontend setup

```bash
cd "Frontend/Career Navigator"
npm install
```

Create `Frontend/Career Navigator/.env`:

```env
VITE_API_URL=http://localhost:5000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

Start the frontend:

```bash
npm run dev
```

---

## Environment Variables

### Backend

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Google Gemini API key |
| `APIFY_API_TOKEN` | Apify platform token for scrapers |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (backend only — never expose) |
| `FRONTEND_URL` | Allowed CORS origin |
| `PORT` | Server port (default: 5000) |
| `NODE_ENV` | `development` or `production` |
| `RATE_LIMIT_MAX` | Override rate limit (default: 500 dev / 100 prod) |

### Frontend

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend URL |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (public, safe to expose) |

---

## Deployment

### Backend → Railway

1. Connect your GitHub repo in Railway
2. Set root directory to `Backend/`
3. Add all backend environment variables
4. Set `FRONTEND_URL` to your Cloudflare Pages URL
5. Railway auto-deploys on every push to `main`

### Frontend → Cloudflare Pages

1. Connect repo in Cloudflare Pages
2. Build settings:
   - **Build command:** `cd "Frontend/Career Navigator" && npm install && npm run build`
   - **Output directory:** `Frontend/Career Navigator/dist/client`
3. Add environment variables (baked in at build time — redeploy required after changes)
4. Use the production URL only — preview URLs are blocked by CORS

> To allow preview URLs, add them comma-separated to `FRONTEND_URL` on Railway.

---

## Security

- Supabase service role key is backend-only — never sent to the client
- All DB queries scoped by `user_id` with Row Level Security enforced at the database level
- JWT tokens verified server-side on every request via `supabase.auth.getUser()`
- Auth tokens refreshed before use to prevent stale 401s
- CORS locked to known origins in production
- Rate limiting on all `/api` routes
- `.env` files are git-ignored

---

## Author

**Muhammad Hassan Khan**

[![GitHub](https://img.shields.io/badge/GitHub-hassan2163-181717?style=flat-square&logo=github)](https://github.com/hassan2163)
[![Live Project](https://img.shields.io/badge/Live-JobFit%20AI-blue?style=flat-square)](https://ai-job-agent-2-0.pages.dev)
