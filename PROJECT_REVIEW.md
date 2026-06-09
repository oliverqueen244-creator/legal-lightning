# Nyay-Hub — End-to-End Project Review

_Audit date: 2026-06-09 · Branch: `claude/busy-cannon-tc23k6` (working tree clean) · Last commit: 2026-05-23 · Read-only audit, no code changed._

This review was produced by mapping the repository first (orientation → architecture → data model) and only then judging it. Every claim cites a real file path; where something could not be verified from the repository alone, it is marked **Unverified** rather than guessed.

---

## 1. What this project is

**Nyay-Hub** is a litigation operating system (a connection-aware Progressive Web App) for lawyers, clerks, and supervised interns practising at the **Rajasthan High Court** (Jaipur & Jodhpur benches). It ingests daily court causelists from two sources — scraped eCourts HTML and PDFs forwarded through a Telegram bot — parses them with an AI fallback chain, matches each case to a lawyer's name/alias profile, and serves a per-user real-time "daily docket" with hearing-likelihood estimates, a live courtroom board, judgment/order tracking, document war-rooms, and post-court capture.

It is a **Supabase-backed single-page app**: all business logic lives either in the React client (talking to Postgres directly through Row-Level Security) or in 38 Deno edge functions that handle scraping, AI parsing, CAPTCHA solving, and scheduled jobs. There is no separate application server.

> README (`README.md:1-11`) describes the product; the owner is listed as "Izafa Labs" (`README.md:71`). Project provenance is visible in git history: it began as a Lovable / gpt-engineer build (63 of 81 commits are from `gpt-engineer-app[bot]`) and was later hand-hardened (13 commits from `Claude`, 5 from the repo owner).

---

## 2. Stack & architecture overview

### Stack (verified from `package.json`, `vite.config.ts`, `supabase/`)
| Layer | Technology |
| --- | --- |
| Build / runtime | Vite 5 + `@vitejs/plugin-react-swc`, TypeScript 5.8, ES modules, Node 22 local / Node 20 in CI |
| UI | React 18.3, Tailwind 3.4, shadcn-ui (Radix primitives), framer-motion, lucide-react |
| Data/state | TanStack Query 5, `@supabase/supabase-js` 2.86, `idb` (IndexedDB offline cache), react-hook-form + zod |
| PWA | `vite-plugin-pwa` (Workbox `generateSW`), i18next (EN/HI) |
| Backend | Supabase: Postgres + RLS + Auth + Storage + Deno edge functions; `pg_cron` + `pg_net` + `pgcrypto` |
| AI | Google Gemini (primary) → OpenAI → OpenRouter fallback chain |
| External | 2Captcha, Firecrawl, Browserless, Telegram Bot API, Indian Kanoon API, Stripe (subscriptions, partial) |
| Package manager | npm (`package-lock.json`, 494 KB) |
| Tests | Vitest 4 + Testing Library + jsdom |

### Entry points
- **Client bootstrap:** `src/main.tsx` → `src/App.tsx`. `App.tsx:49` creates the `QueryClient`; `App.tsx:122-137` defines all 14 routes inside `<BrowserRouter>`. Critical pages (`Dashboard`, `Auth`) load eagerly; the rest are `React.lazy` code-split (`App.tsx:12-23`).
- **Supabase client singleton:** `src/integrations/supabase/client.ts` — reads `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`.
- **Edge functions:** 38 `Deno.serve` handlers under `supabase/functions/*/index.ts` + a `_shared/` helper module.
- **Scheduled jobs:** `pg_cron` entries in `supabase/migrations/20260518000003_daily_cron_jobs.sql` and `..._alert_p0_errors_cron.sql`, firing edge functions via `pg_net`.
- **CI:** `.github/workflows/ci.yml` (the only workflow).

### Primary data flow (causelist → docket)
1. **Ingest** — `pg_cron` (`20260518000003`) calls `scrape-causelist` at 07:00/07:02 IST Mon–Sat; Telegram PDFs arrive via `telegram-webhook` → `document_processing_queue`.
2. **Store** — raw source lands in `raw_causelists` (Storage bucket `causelist-pdfs`, private per `20260518000001`).
3. **Parse** — `parse-case` / `ai-worker` run the Gemini→OpenAI→OpenRouter chain (`supabase/functions/ai-worker/index.ts`), with deterministic fallbacks in `_shared/fallbackController.ts` and a token budget (`ai-worker/index.ts:19,79-98`).
4. **Match** — alias matching writes `daily_court_docket` rows; a `BEFORE INSERT` trigger (`auto_match_on_insert`) attaches `matched_profile_id` (`20260518000000_production_fix.sql:99-152`).
5. **Serve** — the client reads its docket through RLS via hooks (`src/hooks/useDocket.ts`, `useDualStreamDocket.ts`) and TanStack Query; realtime updates via Supabase channels.
6. **Render** — `src/pages/Dashboard.tsx` (688 lines) composes the docket UI.

### Module boundaries
`src/pages` (routes) → `src/components/{domain}` (~200 components, feature-foldered) → `src/hooks` (~90 data hooks) → `src/integrations/supabase/client.ts` → Postgres. The separation is **mostly real** at the folder level, but **leaky in two ways**: (a) data-fetching is split between TanStack Query hooks and ad-hoc imperative `async` functions inside hooks; (b) one component bypasses the client singleton with a hardcoded URL (`src/components/admin/CauseListScraper.tsx:62`).

---

## 3. Data model summary

**72 tables, all with `ENABLE ROW LEVEL SECURITY`** (verified: 72 tables in `src/integrations/supabase/types.ts`, 72 distinct `ENABLE ROW LEVEL SECURITY` statements across migrations). ~40 enums, ~60 Postgres functions (mostly `SECURITY DEFINER`), 8 views. Source of truth for the final shape is the generated `src/integrations/supabase/types.ts`; history is in 112 `supabase/migrations/*.sql`.

**Domains** (representative tables):
- **Court data / causelists:** `raw_causelists`, `raw_causelists_archive`, `daily_court_docket` (core), `case_parse_queue`, `court_metadata`, `court_overrides`, `live_board_cache`, `live_courtroom_feed`, `case_item_durations`, `court_avg_duration`, `bench_procedural_patterns`, `daily_execution_policies`, `case_hearings`, `cause_list_notes`, `causelist_gap_audit`.
- **User / identity:** `profiles` (1:1 `auth.users`), **`user_roles`** (authoritative role store, enum `app_role`), `lawyer_aliases`, `lawyer_case_notes`, `profile_scan_log`, `subscriptions`, `user_consents` (DPDP).
- **Chambers / delegation / interns:** `chambers`, `chamber_memberships`, `chamber_invites`, `clerk_delegations`, `delegated_actions`, `intern_accounts`, `intern_case_assignments`, `intern_drafts`, `intern_access_log`.
- **Judgments / documents / orders:** `tracked_cases`, `case_judgments`, `judgment_check_jobs`, `judgment_audit_log`, `court_orders`, `order_fetch_jobs`, `synced_court_documents`, `captcha_queue`, `captcha_usage_log`, `case_documents`, `document_annotations`, `case_arguments`, `judgment_attachments`, `judge_judgment_references`, `judge_observations`, `judge_observation_sharing`, `post_court_notes`.
- **AI / parsing / ops:** `ai_jobs`, `ai_parse_cache`, `token_usage_daily`, `document_processing_queue`, `parser_confidence_runs`, `parser_fallback_log`, `fallback_disabled_benches`, `scraper_logs`, `sync_status`, `data_validation_logs`, `docket_cleanup_log`.
- **Audit / compliance / security:** `audit_runs`/`audit_findings`/`audit_risks`, `admin_error_events`, `security_events`, `case_access_audit`, `case_export_logs`, `notifications`/`notification_escalations`, `vc_click_events`, `app_config`.
- **Rate-limiting:** `rate_limit_counters` (PK `(user_id, action_key, window_start)`).

**Role model:** dual storage — authoritative `user_roles` (`app_role`: SENIOR | JUNIOR | CLERK | ADMIN | INTERN) checked via `has_role()`/`is_lawyer_role()`/`is_clerk_role()` SECURITY DEFINER functions (`20251203135431:19`), plus a **deprecated** free-text `profiles.role` column kept "for backward compatibility" (`20251203135431:75`) that is still read by one edge function (see §6).

**Docket trigger discipline (README claim verified):** `daily_court_docket` has **exactly 6** triggers after `20260518000000_production_fix.sql:99-152` drops all historical triggers and recreates: alias-match (BEFORE INSERT), fingerprint, match-auditability, case-context validation, ownership enforcement (BEFORE UPDATE), delegation-scope (BEFORE UPDATE).

---

## 4. Strengths (specific, with files)

1. **RLS coverage is genuinely thorough.** All 72 tables enable RLS; role checks are centralized in `SECURITY DEFINER` helpers to avoid policy recursion (`has_role`, `is_lawyer_role`, `is_clerk_role` — `supabase/migrations/20251203135431_*.sql:19-41`, `20260109213817_*.sql`). This is the correct Supabase pattern.
2. **Clerk / intern / delegation containment is well-engineered defense-in-depth** — policy + trigger + audit. Ownership fields are protected by `enforce_lawyer_ownership_updates` and clerks need an active `edit_cases` delegation enforced by `enforce_delegation_scope_on_update`, which also writes `delegated_actions` (`20260518000000_production_fix.sql`, `20260113124859_*.sql`). Interns are time-boxed and auto-revoked by cron (`revoke-expired-interns` + `20260518000003`).
3. **Money-spending endpoints are correctly gated before spend.** `check-case-judgment` enforces a per-user rate limit (5/hr) **and** an ownership guard (`can_check_judgment`) before calling 2Captcha (`supabase/functions/check-case-judgment/index.ts:118-172`); `sync-case-documents` uses a 10/hr limit + an atomic `acquire_document_sync_lock` released on every failure path (`sync-case-documents/index.ts:112-167`).
4. **The most dangerous edge functions authenticate the caller despite `verify_jwt=false`.** `create-intern-account` validates the JWT and requires SENIOR/ADMIN (`index.ts:39-84`); `account-deletion` acts only on the authenticated user's own id (`index.ts:21-62`); the trigger callbacks (`auto-match-aliases`, `backfill-alias-matches`, `revoke-expired-interns`) fail-closed on a shared secret.
5. **CORS is allow-listed, never `*`.** `_shared/cors.ts:11-23` echoes only origins in `ALLOWED_ORIGINS` and fails safe (breaks the app) on misconfiguration rather than opening up.
6. **No hardcoded secrets in source or git history.** Every credential is read via `Deno.env.get(...)`; a repo-wide scan for `sk-…`, `AIza…`, and bearer literals returned nothing in tracked code. The only committed key is the **publishable anon key** (designed to be public).
7. **PII-minimizing error telemetry.** `_shared/errorReporting.ts:85-98` strips case refs, names, and URLs before logging — appropriate for a litigation context.
8. **Connection-aware PWA caching is deliberate and correct for the domain.** Auth and realtime are `NetworkOnly`; the Supabase REST API is `NetworkFirst` with a 5-minute cap so stale court data is never served (`vite.config.ts:69-94`). Shared-device safety is explicitly handled.
9. **Concurrency-safe job queues.** `claim_next_ai_job` uses `FOR UPDATE SKIP LOCKED` (`20260518000004`); document/judgment locks use `FOR UPDATE NOWAIT` (`20260518000005`).
10. **Typecheck is clean, the build succeeds, and routes are code-split.** `tsc --noEmit` passes with zero errors; production builds strip `console.log/debug/info` (`vite.config.ts:178-180`).

---

## 5. Risks & tech debt, ranked by severity

### 🔴 Critical
| # | Finding | File | One-line fix |
| --- | --- | --- | --- |
| C1 | **Privilege escalation: any authenticated user can make themselves ADMIN.** The only write policy on `user_roles` is `"System can insert roles" FOR INSERT WITH CHECK (true)`, never tightened in any later migration. `supabase.from('user_roles').insert({user_id: <self>, role:'ADMIN'})` succeeds; `has_role()` then returns true, flipping all 38 `has_role('ADMIN')`-gated policies and unlocking every admin panel. Exploitable by anyone who can self-register (signup is enabled on `/auth`). | `supabase/migrations/20251203135431_*.sql:47-48` | Change to `WITH CHECK (false)` (or restrict `TO service_role`); seed roles only through the `handle_new_user` SECURITY DEFINER trigger. |

### 🟠 High
| # | Finding | File | One-line fix |
| --- | --- | --- | --- |
| H1 | **Self-assign role at signup.** `handle_new_user` seeds the role from client-controlled `raw_user_meta_data->>'role'`, validating only that it is a legal enum value — so `ADMIN` is accepted. The UI restricts choices, but `supabase.auth.signUp` is callable directly with `data:{role:'ADMIN'}`. | `supabase/migrations/20260103111010_*.sql:22-29`; `src/hooks/useAuth.ts:162-177` | Ignore client role; hard-default to `JUNIOR`; elevate only via an admin-only path. |
| H2 | **`telegram-webhook` secret check fails open.** The secret is enforced only if the header is present; a missing header passes with a `console.warn`. The "secret" is the bot token itself (leaked in fetch URLs). Lets an attacker inject fabricated causelist data and drive AI spend. | `supabase/functions/telegram-webhook/index.ts:93-106,116` | Fail-closed on a missing/incorrect dedicated secret. |
| H3 | **Internet-reachable money-spending workers with no caller auth.** `ai-worker`, `parse-case`, `parse-all-cases`, `scrape-causelist`, `scrape-telegram-causelist`, and the open proxy `search-indian-kanoon` are `verify_jwt=false` and do no in-code auth; anyone hitting the URL burns AI / Firecrawl / Indian-Kanoon quota. | `supabase/config.toml`; `ai-worker/index.ts:65-78`; `search-indian-kanoon/index.ts:313-333` | Add the existing `TRIGGER_SECRET`/`CRON_SECRET` gate (as `auto-match-aliases` does). |
| H4 | **SSRF in `download-order-pdf`.** A caller-controlled `source_pdf_url` is fetched with service-role context and stored, with no scheme/host allow-list — reachable by any logged-in user (can hit cloud-metadata/internal URLs). | `supabase/functions/download-order-pdf/index.ts:33-34,74` | Allow-list the eCourts host before `fetch()`. |
| H5 | **All access control is client-side; the only backstop is RLS — which C1 defeats.** `/admin` is gated solely by `if (!isAdmin)` (`Admin.tsx:39`); per-page `AuthGuard` is opt-in, so any new route added to `App.tsx` is public by default. A pre-auth `HiddenAdminPortal` opens after 7 logo clicks on `/auth`. | `src/pages/Admin.tsx:39`; `src/App.tsx:122-137`; `src/pages/Auth.tsx:33-51` | Fix C1; add a centralized route guard; security-review the hidden portal. |
| H6 | **19 dependency vulnerabilities (11 high).** Runtime-relevant: `react-router-dom`/`@remix-run/router` (HIGH — XSS via open redirect / external redirect on untrusted paths). Rest are build/dev transitive (vite, esbuild, lodash, minimatch, serialize-javascript, ws, yaml). | `package.json` (`npm audit`) | `npm audit fix` / bump `react-router-dom`; re-audit. |

### 🟡 Medium
| # | Finding | File | One-line fix |
| --- | --- | --- | --- |
| M1 | **Lint is red and non-blocking.** `eslint .` = **233 errors** (90 in `src/`, 142 in `supabase/`). CI runs `eslint src/` only, with `continue-on-error: true`, so lint never fails the build; `@typescript-eslint/no-unused-vars` is globally disabled. | `.github/workflows/ci.yml:33-35`; `eslint.config.js:23` | Fix errors, lint `supabase/` too, remove `continue-on-error`. |
| M2 | **"Removed all type-bypass casts" is false.** 49 `as any` across 18 files remain; `src/hooks/useDocumentManagement.ts` alone has 17 (wholesale-bypassing the documents table). Casts to read `case_fingerprint`/`fingerprint_matched_at` prove `types.ts` is **stale vs the live schema**. | `src/hooks/useDocumentManagement.ts`; `src/hooks/useCaseHistory.ts:47,155-156` | Regenerate types against the real DB; replace casts with generated types. |
| M3 | **Core read path swallows query errors into empty state.** `useDocket` returns `[]` on a Supabase error — a failed query is indistinguishable from "no hearings today," which is dangerous for a docket app. No shared error helper; Sentry is a stub (`src/lib/sentryStub.ts`). | `src/hooks/useDocket.ts:38-41` | Surface query errors (toast/empty-vs-error states); wire real crash reporting. |
| M4 | **Hardcoded prod Supabase URL** bypasses the env-driven client singleton, leaking the project ref into the bundle and breaking across environments. | `src/components/admin/CauseListScraper.tsx:62` | Use `import.meta.env.VITE_SUPABASE_URL`. |
| M5 | **`admin_match_cases_for_profile` is `SECURITY DEFINER`, granted to `authenticated`, with no in-function admin check** — any user can claim arbitrary unmatched dockets for any profile (RLS-bypassing). | `supabase/migrations/20260110121640_*.sql:1,58` | Add a `has_role(auth.uid(),'ADMIN')` guard inside the function. |
| M6 | **Over-broad reads.** `case_documents` metadata is readable by every authenticated user (`USING(true)`), contradicting the owner-scoped docket; `app_config` is readable by **anon**. | `20251231102948_*.sql:12`; `20260110084658_*.sql:14` | Scope `case_documents` to case ownership; require auth for `app_config`. |
| M7 | **Split-brain role source.** `create-intern-account` authorizes off the **deprecated** `profiles.role` (`index.ts:67`), while the frontend authorizes off `user_roles`. Combined with the unscoped `profiles` UPDATE policy (a user can self-edit `profiles.role`), this gate is bypassable. | `supabase/functions/create-intern-account/index.ts:67`; `20251203133923_*.sql:16` | Read role from `user_roles` / `has_role`; lock or drop `profiles.role`. |
| M8 | **Insecure transport / key-in-URL for paid APIs.** 2Captcha is called over plain `http://` (key + CAPTCHA image in cleartext); Google AI keys are passed as `?key=` query strings (leak into logs/proxies). | `check-case-judgment/index.ts:44`; `ai-worker/index.ts:548` | Use `https://2captcha.com`; pass AI keys in headers. |
| M9 | **Deployable test/debug endpoints.** `test-firecrawl-pdf` (unauth, spends Firecrawl), `test-pdf-parse` (unauth, returns stack traces), `simulate-live-board`/`admin-doc-sync-trial` (mutate prod / spend, weak/no authz). | `supabase/config.toml:45-49`; `test-pdf-parse/index.ts:87` | Delete or hard-gate behind an admin/service secret. |
| M10 | **Service key embedded via `current_setting()` in cron/trigger HTTP bodies.** Exposure depends on the GUC actually being a secret. | `20260518000003`, `20260518000002` | Confirm `app.settings.supabase_service_key` is a non-readable secret; prefer Vault. |
| M11 | **Dangerously thin test coverage.** Only 3 test files / 23 tests, all pure utils (`benchNames`, `caseTypeMapping`, `errorReporting`). ~73k LOC of hooks, components, edge functions, RLS, and triggers have **zero** automated coverage. | `src/lib/*.test.ts` | Add tests for auth/role logic, docket hooks, and the money-gating RPCs. |

### 🟢 Low
| # | Finding | File |
| --- | --- | --- |
| L1 | **`.env` is tracked by git** despite being in `.gitignore` (it predates the ignore rule). Contents are only the anon key/URL (intended-public), so impact is low, but it leaks the project ref and is poor hygiene. | `.env` (tracked; first added in commit `67e2af3`) |
| L2 | **~20 dead modules**, incl. a 426-line `DocumentSyncTrialPanel.tsx`, a dead `admin/LiveBoardSimulator.tsx` that writes directly to `live_board_cache`, the entire `useJudgmentCheck` feature, and an unused shadcn toast stack duplicating `sonner` (used in 62 files). | `src/components/admin/DocumentSyncTrialPanel.tsx`, `src/components/admin/LiveBoardSimulator.tsx`, `src/hooks/useJudgmentCheck.ts`, `src/hooks/use-toast.ts` |
| L3 | **Large main bundle:** `index` chunk 1.34 MB (392 KB gzip), `WarRoom` 547 KB — past Vite's 500 KB warning. | build output (`vite.config.ts`) |
| L4 | **Oversized files / convention drift:** `ProductDossier.tsx` (945), `Dashboard.tsx` (688), `WhisperDrawer.tsx` (611), `useInternSupervision.ts` (563); mixed default/named exports; two data-fetch styles; scattered magic timeouts. | `src/pages/ProductDossier.tsx`, etc. |
| L5 | **Migration churn:** 112 migrations; `daily_court_docket` policies dropped/recreated in 7+ files; `production_fix` relies on `CREATE OR REPLACE` of earlier function bodies → fresh-rebuild risk. | `supabase/migrations/` |
| L6 | **No env validation in the client singleton** — `createClient(undefined, undefined)` if vars are missing (silent failure). | `src/integrations/supabase/client.ts:5-11` |
| L7 | **`parse-case` catch-all marks ALL `processing` rows failed** (no id filter) — can wrongly fail a sibling worker under concurrency. | `supabase/functions/parse-case/index.ts:822-829` |

---

## 6. Security findings (consolidated)

**Secrets / config.** No service-role or third-party keys are committed or hardcoded; all are read from `Deno.env` (edge) or `import.meta.env` (client). The only client-exposed values are the intended-public Supabase URL/anon key — **except** the hardcoded prod URL in `CauseListScraper.tsx:62` (M4) and the tracked `.env` (L1). **Nothing that must stay server-side (service key, AI keys, 2Captcha) is exposed to the client.** *Unverified:* whether `ALLOWED_ORIGINS`, `TRIGGER_SECRET`, and the API keys are actually set in the deployed environment — only code usage is visible.

**Auth / authorization.** The model is "thin client + RLS." It is correctly designed (centralized `SECURITY DEFINER` role checks, owner-scoped policies, strong clerk/intern containment), but it has **one critical hole that collapses the whole model**: the open `user_roles` INSERT policy (C1), reinforced by the signup-metadata path (H1) and the split-brain `profiles.role` gate (M7). Frontend gating is purely cosmetic (H5). Fixing C1 + H1 is the single highest-leverage action in this audit.

**Injection / SSRF / input.** No raw SQL anywhere (everything goes through the query builder / parameterized RPCs); a prior SQL-wildcard issue in `normalize_lawyer_name` was already fixed in `production_fix`. Live SSRF surface is `download-order-pdf` (H4), with secondary exposure in the CAPTCHA/PDF-URL resolvers that pass absolute scraped URLs through unchanged (`sync-case-documents/index.ts:492-496`). Input validation is uneven — excellent in `simulate-live-board`, weak/absent in `escalate-whatsapp`, `fetch-case-orders`, `search-indian-kanoon`.

**Abuse / cost.** Strong per-user gating on the 2Captcha endpoints (see Strengths #3); but the open AI/scrape workers (H3) and unauthenticated test endpoints (M9) can drive third-party spend, bounded only by `ai-worker`'s hourly token budget.

**Dependencies.** 19 known vulns (11 high / 8 moderate / 0 critical); the runtime-relevant one is `react-router-dom` open-redirect/XSS (H6).

---

## 7. Build / test / ops status

| Gate | Result | Detail |
| --- | --- | --- |
| **Typecheck** (`npm run typecheck`) | ✅ Pass | `tsc --noEmit` — 0 errors. |
| **Lint** (`eslint .`) | ❌ Fail | 233 errors / 21 warnings (90 src, 142 supabase). CI only lints `src/` and is `continue-on-error` (M1). |
| **Unit tests** (`npm test`) | ✅ Pass | 3 files, 23 tests, all pure utils. ~73k LOC otherwise untested (M11). |
| **Build** (`npm run build`) | ✅ Pass | Builds in ~12s; 51 PWA precache entries; main chunk 1.34 MB / 392 KB gzip (L3). |
| **Dependency audit** (`npm audit`) | ⚠️ 19 vulns | 11 high, 8 moderate, 0 critical (H6). |
| **Migrations sanity** | ✅ (CI) | CI checks BEGIN/COMMIT balance only — not real SQL validity. |

**CI/CD (`.github/workflows/ci.yml`):** runs on push/PR to `main` only (the working branch won't trigger it). Steps: `npm ci` → typecheck → lint (non-blocking) → test → build (with dummy env) → BEGIN/COMMIT migration check. **There is no CD.** No deployment config exists (no `vercel.json`, `netlify.toml`, `Dockerfile`, etc. — confirms `README.md:60`). Path to production is manual: static SPA to any host; edge functions via `supabase functions deploy <name>`; migrations via Supabase CLI/dashboard; numerous secrets and `app.settings.*` GUCs must be set out-of-band (`README.md:36-57`).

**Repo health:** 81 commits, 3 contributors (gpt-engineer-app bot 63, Claude 13, owner 5), working tree clean, last commit 2026-05-23.

---

## 8. Top 5 things to fix first (priority order)

1. **Close the `user_roles` privilege-escalation hole (C1).** Change the INSERT policy to `WITH CHECK (false)` / service-role-only so roles can only be set by the `handle_new_user` trigger. This is one line and it is the difference between "RLS protects the app" and "any signup is an admin."
2. **Stop trusting client-supplied roles at signup (H1) and unify the role source (M7).** Hard-default new users to `JUNIOR` in `handle_new_user`; make every authorization read `user_roles`/`has_role`; lock or drop `profiles.role`.
3. **Authenticate or remove the open backend endpoints (H2, H3, H4, M9).** Make `telegram-webhook` fail-closed on a dedicated secret; add the `TRIGGER_SECRET` gate to the AI/scrape workers; host-allow-list `download-order-pdf`; delete the `test-*` functions.
4. **Make quality gates real (M1, M2, H6).** Remove `continue-on-error` from lint, lint `supabase/` too, fix the 233 errors, regenerate `types.ts` against the live DB to kill the stale-schema casts, and `npm audit fix` (bump `react-router-dom`).
5. **Add tests for the security-critical paths and fix the silent docket failure (M11, M3).** At minimum: role/auth logic, the money-gating RPCs (`can_check_judgment`, rate limits), and docket hooks — and make `useDocket` distinguish "query failed" from "no hearings."

---

### Verification notes / limits
- RLS, trigger, and role claims were cross-checked by two independent passes (the migration files and the generated `types.ts`) and agree.
- **Unverified by design:** whether required env vars/GUCs are set in the deployed Supabase project; whether public signup is enabled in Supabase Auth settings (the `/auth` UI offers it, implying yes); the exact body of `auto_match_on_insert()` (referenced but not defined in the reviewed migrations — its "no HTTP" claim could not be confirmed); whether the `case_documents` **storage bucket** was privatized like the causelist bucket was (`20251203134512:6` vs `20260518000001`).
- Counts are from the repository as audited: 72 tables, 112 migrations, 38 edge functions, ~90 hooks, ~200 components, ~73k LOC of TS/TSX (57.7k `src` + 15.6k functions).
