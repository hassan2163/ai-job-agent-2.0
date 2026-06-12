# AI Job Agent 2.0

A full-stack, multi-user SaaS platform that automates the entire job application pipeline — from scraping live job listings to generating AI-tailored resumes and cover letters, ready to download and apply.

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

- **Automated scraping** — LinkedIn, Indeed, and Glassdoor scraped via Apify on demand or on a daily schedule
- **AI scoring** — Gemini evaluates each job against your resume: match score, strengths, gaps, keywords, strategy
- **ATS-optimized resume tailoring** — role-specific resume generated per job, preserving only real experience
- **Cover letter generation** — concise, honest, first-person cover letters (100–160 words)
- **Download as PDF or Word** — one-click download for both resume and cover letter
- **Application dashboard** — review all applications, filter by status, search by title or company
- **Per-user pipeline scheduler** — set a daily run time and timezone; the agent runs automatically
- **Multi-user auth** — Supabase JWT authentication with Row Level Security; every user's data is isolated
- **Profile completeness guard** — pipeline is blocked until resume and target roles are set
- **Pipeline status polling** — live progress indicator (Scrape → Score → Tailor) while the pipeline runs

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | TanStack Start, React, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Node.js, Express 5 |
| Database & Auth | Supabase (PostgreSQL + Auth + RLS) |
| AI | Google Gemini 2.5 Flash (via `@google/genai`) |
| Scraping | Apify (LinkedIn, Indeed, Glassdoor actors) |
| Scheduling | node-cron (per-user daily scheduler) |
| Document export | docx, pdfkit |
| Frontend hosting | Cloudflare Pages (Workers SSR, advanced mode) |
| Backend hosting | Railway |

---

## Project Structure

```
ai-job-agent-2.0/
├── Backend/
│   ├── app.js                  # Express app, CORS, rate limiting
│   ├── scheduler/
│   │   └── dailyRun.js         # Per-user cron scheduler
│   ├── controllers/
│   │   ├── agentController.js  # Pipeline trigger + status
│   │   ├── dashboardController.js  # Applications CRUD + document download
│   │   └── profileController.js
│   ├── services/
│   │   ├── scraperService.js   # Apify scraping + normalization
│   │   ├── scoringService.js   # Gemini AI scoring
│   │   ├── tailoringService.js # Resume + cover letter generation
│   │   ├── aiSharedService.js  # Gemini prompts
│   │   └── aiService.js        # Gemini client + retry logic
│   ├── middleware/
│   │   └── authMiddleware.js   # Supabase JWT verification
│   ├── utils/
│   │   └── batchRun.js         # Shared batched async runner
│   └── supabase/
│       └── migration.sql       # Full DB schema
│
└── Frontend/Career Navigator/
    └── src/
        ├── routes/
        │   ├── index.tsx        # Landing page
        │   ├── dashboard.tsx    # Application dashboard
        │   ├── profile.tsx      # Profile + schedule setup
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

Run the database migration in Supabase SQL editor:
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

## Environment Variables Reference

### Backend

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Google Gemini API key |
| `APIFY_API_TOKEN` | Apify platform token for scrapers |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (backend only, never expose) |
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

## Security

- Supabase service role key is backend-only — never sent to the frontend
- All DB queries are scoped by `user_id` with Row Level Security enforced at the database level
- JWT tokens are verified server-side on every request via `supabase.auth.getUser()`
- Auth tokens are always refreshed before use (no stale token 401s)
- `.env` files are git-ignored
- CORS locked to known origins in production
- Rate limiting on all `/api` routes

---

## Deployment

### Backend → Railway

1. Connect your GitHub repo in Railway
2. Set root directory to `Backend/`
3. Add all backend environment variables (see table above)
4. Set `FRONTEND_URL` to your Cloudflare Pages production URL (e.g. `https://ai-job-agent-2-0.pages.dev`)
5. Railway auto-deploys on every push to `main`

### Frontend → Cloudflare Pages

1. Connect your GitHub repo in Cloudflare Pages
2. Set build settings:
   - **Framework preset:** None
   - **Build command:** `cd "Frontend/Career Navigator" && npm install && npm run build`
   - **Build output directory:** `Frontend/Career Navigator/dist/client`
3. Add production environment variables — **these are baked in at build time**, so a redeploy is required after any change:

   | Variable | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | Your Supabase project URL |
   | `VITE_SUPABASE_ANON_KEY` | Your Supabase anon public key |
   | `VITE_API_URL` | Your Railway backend URL (no trailing slash) |

4. Cloudflare Pages uses `_worker.js` (advanced mode) — the `wrangler.toml` and build script handle this automatically
5. After deploying, use the **production URL** (e.g. `https://ai-job-agent-2-0.pages.dev`) — preview URLs have different origins and will be blocked by CORS

> **Note:** If you add preview/branch deployment URLs, add them to `FRONTEND_URL` on Railway as comma-separated values: `https://ai-job-agent-2-0.pages.dev,https://preview-url.pages.dev`

---

## Author

**Muhammad Hassan Khan**

GitHub: [hassan2163](https://github.com/hassan2163)
