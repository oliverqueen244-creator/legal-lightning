# Nyay-Hub

Litigation Operating System for the Rajasthan High Court — a connection-aware PWA that ingests court causelists (HTML + Telegram PDFs), matches them to lawyer profiles, tracks judgments, and serves a real-time docket to lawyers, clerks, and supervised interns.

## Stack

- **Frontend**: Vite + React + TypeScript, Tailwind, shadcn-ui, TanStack Query, `vite-plugin-pwa` (Workbox)
- **Backend**: Supabase (Postgres + RLS + Auth + Storage), Deno edge functions
- **AI providers**: Google AI (Gemini), OpenAI, OpenRouter — fallback chain in `supabase/functions/ai-worker` and `parse-case`
- **Scrapers**: `scrape-causelist` (eCourts), `scrape-live-board`, `scrape-telegram-causelist`
- **CAPTCHA**: 2Captcha (for judgment + document sync)

## Local development

```sh
npm install
npm run dev          # Vite dev server on :8080
npm run build        # Production build
npm run lint         # ESLint
```

Frontend env vars (in `.env`, prefixed `VITE_`):

```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_PROJECT_ID=<project-ref>
VITE_SUPABASE_PUBLISHABLE_KEY=<anon-key>
```

`.env` is git-ignored. **Never commit secret keys (service-role, AI providers, 2Captcha) — those belong only in Supabase edge function env.**

## Supabase

Migrations live in `supabase/migrations/`. Apply via the Supabase CLI or the dashboard SQL editor. The chain assumes a clean Postgres + `pg_cron`, `pg_net`, `pgcrypto`, `uuid-ossp` extensions.

### Required edge function env

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` | Standard |
| `ALLOWED_ORIGINS` | Comma-separated browser origins allowed by `_shared/cors.ts` |
| `GOOGLE_AI_API_KEY` | Primary AI provider |
| `OPENAI_API_KEY` | Fallback |
| `OPENROUTER_API_KEY` | Secondary fallback |
| `TWOCAPTCHA_API_KEY` | CAPTCHA solving for judgment + document sync |
| `TELEGRAM_BOT_TOKEN`, `ADMIN_TELEGRAM_CHAT_ID` | P0 alerts (`alert-p0-errors`) |
| `TRIGGER_SECRET` | Verified by `auto-match-aliases` / `backfill-alias-matches` callbacks |

### Required database settings

Set via `ALTER DATABASE … SET app.settings.* = '…'` or the Supabase dashboard:

- `app.settings.supabase_url`
- `app.settings.supabase_service_key`
- `app.settings.supabase_anon_key`
- `app.settings.trigger_secret`

## Deploying

There's no committed deployment config yet — the frontend is a static SPA suitable for any host (Vercel, Cloudflare Pages, Netlify, S3 + CloudFront). Edge functions deploy via `supabase functions deploy <name>`.

## Architecture notes

- **Auth cache**: Workbox does NOT cache `/auth/` responses (shared devices in court complexes).
- **Storage bucket `causelist-pdfs`** is private; edge functions access via service role.
- **Rate limiting** lives in Postgres (`check_rate_limit` RPC) — applied to credit-consuming endpoints (judgment checks, document syncs).
- **Trigger discipline**: `daily_court_docket` has exactly 6 triggers — alias match (BEFORE INSERT), fingerprint, match auditability, case-context validation, ownership enforcement (BEFORE UPDATE), delegation scope. Don't add more without reviewing the existing chain.

## Owner

Izafa Labs.
