# JobFit AI — Handoff Document
_Last updated: 2026-06-11_

---

## Project Overview

**AI Job Agent 2.0 / JobFit AI** — a full-stack multi-user SaaS that automates job applications end-to-end: scrapes LinkedIn/Indeed/Glassdoor via Apify, scores jobs against the user's resume with Gemini AI, generates tailored resumes + cover letters, and serves them via a dashboard where users review and download applications.

**Live URL:** https://ai-job-agent-2-0.pages.dev  
**Repo:** https://github.com/hassan2163/ai-job-agent-2.0  
**Backend:** https://ai-job-agent-20-production.up.railway.app  
**Supabase project:** `dilfivtnhfrxgdswesrq` (region: us-west-2)

---

## Stack

| Layer | Technology | Hosting |
|---|---|---|
| Frontend | TanStack Start (SSR), React 19, TypeScript, Tailwind CSS v4, shadcn/ui | Cloudflare Pages (advanced mode, `_worker.js`) |
| Backend | Node.js, Express 5 | Railway (free tier) |
| Database + Auth | Supabase (PostgreSQL + Auth + RLS) | Supabase |
| AI | Google Gemini 2.5 Flash (`@google/genai`) | — |
| Scraping | Apify (LinkedIn, Indeed, Glassdoor actors) | — |
| Scheduling | node-cron (per-user daily scheduler) | — |
| Document export | docx, pdfkit | — |

**Critical constraint:** Do NOT switch from Gemini API — user has existing Gemini purchases.

---

## Repository Structure

```
D:\Projects\AI Agents\          ← git root (moved from OneDrive to avoid lock files)
├── Backend/
│   ├── app.js                  ← Express app, CORS, rate limiting
│   ├── scheduler/dailyRun.js   ← Per-user cron scheduler
│   ├── controllers/
│   │   ├── agentController.js  ← Pipeline trigger + status polling
│   │   ├── dashboardController.js ← Applications CRUD + document download
│   │   └── profileController.js   ← GET/PATCH profile (upsert for new users)
│   ├── services/
│   │   ├── scraperService.js
│   │   ├── scoringService.js
│   │   ├── tailoringService.js
│   │   ├── aiSharedService.js
│   │   └── aiService.js
│   ├── middleware/authMiddleware.js
│   ├── utils/batchRun.js
│   └── supabase/migration.sql
└── Frontend/Career Navigator/
    └── src/
        ├── routes/
        │   ├── __root.tsx       ← branded "JobFit AI", not "Lovable App"
        │   ├── index.tsx        ← landing page
        │   ├── dashboard.tsx
        │   ├── profile.tsx
        │   ├── login.tsx        ← has "Forgot password?" link
        │   ├── signup.tsx
        │   ├── forgot-password.tsx  ← NEW (not yet pushed)
        │   └── reset-password.tsx   ← NEW (not yet pushed)
        ├── components/dashboard/
        │   ├── ApplicationCard.tsx
        │   ├── ApplicationDrawer.tsx
        │   └── StatsBar.tsx
        └── lib/
            ├── auth-context.tsx
            ├── dashboard-api.ts  ← API factory, clean JSON error parsing
            └── supabase.ts
```

---

## Cloudflare Pages — Critical Architecture

The frontend uses **advanced mode** (`_worker.js`). In this mode, the Cloudflare Worker intercepts ALL requests including static assets. The build pipeline:

1. `vite build` → outputs `dist/server/` + `dist/client/`
2. `cp dist/server/server.js dist/client/_worker.js` — worker entry point
3. `cp dist/server/server.js dist/client/server.js` — required because `dist/server/assets/start-*.js` imports `"../server.js"`
4. `cp -r dist/server/assets/. dist/client/assets/` — SSR assets

**`src/server.ts`** must proxy static assets via `env.ASSETS.fetch()` BEFORE doing SSR — without this, CSS/JS files return empty responses.

**`wrangler.toml`** must be TOML format (not `.jsonc`):
```toml
name = "tanstack-start-app"
compatibility_date = "2025-09-24"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = "dist/client"
```

**VITE_ env vars are baked in at build time** — any change requires a redeploy in Cloudflare Pages.

---

## Environment Variables

### Cloudflare Pages (Production)
| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://dilfivtnhfrxgdswesrq.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | legacy anon public key from Supabase |
| `VITE_API_URL` | `https://ai-job-agent-20-production.up.railway.app` (no trailing slash) |

### Railway (Backend)
| Variable | Value |
|---|---|
| `FRONTEND_URL` | `https://ai-job-agent-2-0.pages.dev` |
| `GEMINI_API_KEY` | user's Gemini key |
| `APIFY_API_TOKEN` | user's Apify token |
| `SUPABASE_URL` | `https://dilfivtnhfrxgdswesrq.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | backend only, never expose to frontend |
| `NODE_ENV` | `production` |

**CORS note:** `FRONTEND_URL` must be exact origin (no trailing slash). Preview deployment URLs (e.g. `https://bdac645d.ai-job-agent-2-0.pages.dev`) are blocked unless added comma-separated.

---

## Key Fixes Made This Session

### Deployment fixes
- `../server.js` resolution error → added `cp dist/server/server.js dist/client/server.js` to build script
- CSS not loading → added `env.ASSETS.fetch()` static asset passthrough in `src/server.ts`
- Double slash in API URL → user had trailing slash in `VITE_API_URL`
- "Failed to fetch" CORS → user was on preview URL `bdac645d.ai-job-agent-2-0.pages.dev`, not production URL

### UX fixes
- New user profile load error → silent catch (no toast for new users)
- New user dashboard error → silent catch in `fetchData`, empty state shown instead
- Profile save for new users → backend uses `upsert` instead of `update`
- Pipeline 409 error → frontend now resumes polling the existing run silently
- Raw JSON in error toasts → `dashboard-api.ts` now parses JSON error body and extracts `.error` field only

### New features
- Forgot password page (`/forgot-password`)
- Reset password page (`/reset-password`) — handles `PASSWORD_RECOVERY` auth event
- "Forgot password?" link on login page

---

## Pending / Not Yet Pushed

These files are modified locally but not committed:
```
Frontend/Career Navigator/src/routes/forgot-password.tsx  ← new
Frontend/Career Navigator/src/routes/reset-password.tsx   ← new
Frontend/Career Navigator/src/routes/login.tsx            ← forgot password link
Frontend/Career Navigator/src/routes/dashboard.tsx        ← silent catch + 409 handling
Frontend/Career Navigator/src/lib/dashboard-api.ts        ← clean error messages
README.md                                                  ← updated for Cloudflare/Railway
```

Push command:
```powershell
cd "D:\Projects\AI Agents"
git add .
git commit -m "feat: password reset flow, clean error handling, updated README"
git push origin main
```

---

## Supabase Auth — Still To Do

- Set Site URL → `https://ai-job-agent-2-0.pages.dev`
- Add Redirect URL → `https://ai-job-agent-2-0.pages.dev/**`
- Custom SMTP (Resend recommended) → Project Settings → Auth → SMTP Provider
- Custom email template → Auth → Email Templates → Reset Password
- Link expiry → set OTP expiry to `3600` (1 hour)

---

## GitHub Repo Improvements Needed

- Add repo description + website URL in GitHub Settings
- Add topics: `ai`, `job-search`, `react`, `nodejs`, `supabase`, `cloudflare-pages`, `gemini`
- Delete stale `render.yaml` (leftover from v1 Render deployment)
- Add `Backend/.env.example` and `Frontend/Career Navigator/.env.example`
- Add `LICENSE` (MIT)
- Replace old v1 screenshots in `/screenshots/` with new app screenshots
- Create GitHub Release tagged `v2.0.0`

---

## Known Gotchas

1. **Git must be run from PowerShell** — bash sandbox can't write to Windows git index
2. **OneDrive causes git lock files** — project was moved to `D:\Projects\AI Agents` to avoid this
3. **Cloudflare preview URLs are blocked by CORS** — always test on production URL
4. **VITE_ vars require redeploy** — saving in Cloudflare Pages UI does nothing until next build
5. **Railway free tier sleeps** — cold start may cause first request to fail
6. **`@lovable.dev/vite-tanstack-config`** — logs "No Lovable context detected" on every build, harmless
