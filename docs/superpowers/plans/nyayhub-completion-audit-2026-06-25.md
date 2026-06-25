# NyayHub — Completion & Launch Audit

**Date:** 2026-06-25
**Scope:** Full-codebase audit to take NyayHub (Litigation OS for the Rajasthan High Court) from beta/trial to a sellable product.
**Method:** Read of all 38 edge functions, 112 migrations, RLS policies, frontend hooks/components, PWA layer, and config/secrets. Findings below are verified against current code with file:line references. Read-only pass — nothing was modified.

> **One-line state of the product:** The *court-data ingestion spine* (Telegram PDF → Gemini parse → docket → alias match → realtime UI) is genuinely built and largely works. Almost everything sold *around* it — billing, the "AI" features, WhatsApp alerts, on-demand eCourts retrieval — is either a `setTimeout` stub, a `console.log` no-op, or broken by an architectural defect. The security posture is not yet safe for real user PII.

---

## 1. SHIP-BLOCKERS (must fix before any paying user)

### 1.1 Billing does not exist — CONFIRMED

- **`src/hooks/useSubscription.ts:46-52`** — `upgradeToPro` and `cancelSubscription` are pure no-ops:
  ```ts
  // Placeholder for future Stripe integration
  upgradeToPro: () => { console.log('Stripe integration pending - upgrade to pro'); },
  cancelSubscription: () => { console.log('Stripe integration pending - cancel subscription'); },
  ```
  Neither is ever even *called* anywhere in `src` (dead beyond the definition).
- **`subscriptions` table** (`supabase/migrations/20251229182944_f2dbf775...sql:54-68`) has `stripe_customer_id`, `stripe_subscription_id`, `plan_type` (`'free'|'individual'|'chamber'`), `status`. **No code ever writes this table** — no insert/update/upsert anywhere in `src` or `supabase/functions`. Every user is therefore permanently `isFree`.
- **No payment edge function exists** (no razorpay/stripe/create-order/webhook function among the 38). The string `razorpay` appears **nowhere** in the repo.
- **No feature gating exists.** `isPro`/`isFree` are consumed only by `src/components/subscription/SubscriptionBadge.tsx`, which is itself never mounted. Nothing in the app is gated on plan.
- **Bug:** `useSubscription.ts:36` checks `plan_type === 'pro'`, but the DB CHECK constraint only allows `'free'|'individual'|'chamber'` — so `isPro` can never be true even with valid data.
- Status is openly documented as a placeholder at `src/pages/ProductDossier.tsx:681` and `src/components/admin/OperationsConsole.tsx:370-377`.

**Why it blocks launch:** There is no way to take money and no way to restrict anything if you did.

**Razorpay wiring scope (~16–24h of focused build, excluding what-to-gate product decision):**
1. **Migration** (~1–2h): add `razorpay_customer_id`, `razorpay_payment_id`, `razorpay_subscription_id` to `subscriptions`; reconcile `plan_type` values with what you actually sell; add a `payment_orders` table (order id, user, amount, currency, status) for idempotency/audit, with user-read-own + service-role RLS.
2. **`razorpay-create-order` edge function** (~2–3h): `verify_jwt = true`, derive amount server-side from plan (never trust client), call Razorpay Orders API, insert `payment_orders`, return `order_id` + key id.
3. **`razorpay-webhook` edge function** (~3–4h): `verify_jwt = false`, verify `X-Razorpay-Signature` (HMAC-SHA256 over raw body with `RAZORPAY_WEBHOOK_SECRET`, constant-time compare), handle `payment.captured`/`subscription.*`, upsert `subscriptions` via service role, idempotent on event id.
4. **`config.toml` + `.env.example`** (~15m): register functions; document `RAZORPAY_KEY_ID/KEY_SECRET/WEBHOOK_SECRET`.
5. **Client checkout** (~2–3h): replace the `useSubscription` stubs — invoke create-order, open Razorpay checkout.js, refetch on success.
6. **Billing UI + a real plan-picker route** (~3–4h).
7. **Feature gating** (~2–4h): greenfield — decide what paid unlocks, add gates, optionally wire `has_active_subscription()` (already defined, never called) into RLS for server-enforced gating.

**External gate:** Razorpay KYC/merchant activation (days–weeks, outside our control).

---

### 1.2 Fake-AI surfaces presenting hardcoded text as real AI — CONFIRMED

A genuine multi-provider AI backend exists (Google Gemini → OpenAI → OpenRouter) in `ai-worker` and `parse-case`, plus a real Indian Kanoon search. But every "showcase" AI feature in the UI is theater:

| Surface | File:line | Mechanism (fake) | Real backend to wire to? |
|---|---|---|---|
| AiStrategyPanel | `src/components/morning-brief/AiStrategyPanel.tsx:25-52` | `// Simulate AI generation` → `setTimeout(2000)` then **hardcoded** strategy points/conclusion, identical for every case | No strategy endpoint exists — needs new function/action over the existing chain |
| SmartPdfViewer "AI Summary" | `src/components/war-room/SmartPdfViewer.tsx:131-139` | `setTimeout(2500)` returns one **hardcoded** "Section 482 CrPC / Bhajan Lal" string for *any* PDF; `pdfUrl` never read | No summarize endpoint — `pdf-extract-chunk` exists for text; needs new summarize action |
| AIInsightPanel "Points of Law" | `src/components/war-room/AIInsightPanel.tsx:86-99` | Two **hardcoded** `<div>`s (Section 482 / Article 226), identical every docket | Same as above |
| AIInsightPanel "Find Precedents" | `src/components/war-room/AIInsightPanel.tsx:67-83` | Button with **no onClick** — dead UI | **Backend fully real** (`search-indian-kanoon`, already used elsewhere) — trivially wired via the `findPrecedents` already returned by `useAIIntelligence` |
| AIInsightPanel "Case Summary" | hook `src/hooks/useAIIntelligence.ts:12` (`summarizeCase`), called at `AIInsightPanel.tsx:41` | **Broken wiring:** invokes `ai-worker` with `{action:'summarize_case'}`, but `ai-worker` has **no `action` handler** — it drains the parse queue and ignores the body, so `data.summary` is always `undefined` | Closest to working: frontend correct, just needs a `summarize_case` branch in `ai-worker` |

**Real AI infrastructure that exists (so wiring is mostly backend work, not greenfield):**
- `ai-worker` — queue-driven causelist parser, atomic claim (`claim_next_ai_job`), token budget, Google→OpenAI→OpenRouter fallback, multi-mode by `list_type`. Canonical and live.
- `parse-case` — same provider chain + response cache; legacy (see §3).
- `search-indian-kanoon` — real Indian Kanoon API + HTML fallback; actively used by `useReferenceJudgments`, `useIndianKanoonSearch`.

**Why it blocks launch:** Selling these as "AI" while they emit fixed strings is a misrepresentation a paying advocate will catch immediately (the same Bhajan Lal summary on every document). At minimum, the fake surfaces must be hidden or made real before launch.

**Fix priority:** (a) wire "Find Precedents" (trivial, backend real); (b) add `summarize_case` action to `ai-worker` and point both SmartPdfViewer + AIInsightPanel at it, delete the `setTimeout` fakes; (c) hide AiStrategyPanel / "Points of Law" until a real analyze endpoint exists.

---

### 1.3 escalate-whatsapp sends nothing while reporting success — CONFIRMED

- **`supabase/functions/escalate-whatsapp/index.ts:68-83`** — there is **no HTTP call to any messaging API**. The message is `console.log`'d, then a row is inserted with `status: 'sent'`:
  ```ts
  // TODO: Integrate with actual WhatsApp API (Twilio, WhatsApp Business API, etc.)
  console.log(`[Escalate] Would send WhatsApp to ${phoneNumber}:`);
  ...
  status: 'sent', // In production, this would be 'sent' only after confirmed delivery
  ```
- The daily-dedup logic keys on `status='sent'`, so the fake row marks the case "escalated for the day" — meaning even a *future* real integration would be suppressed by these phantom sends.

**Why it blocks launch:** A core safety promise ("you'll be alerted") silently fails. The advocate believes they were warned; they weren't.

**Scope (real WhatsApp Cloud API):** env `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_BUSINESS_ACCOUNT_ID`; `POST graph.facebook.com/v20.0/{id}/messages` with a **pre-approved Utility template** (free-form business-initiated text is rejected outside the 24h window — the fixed "Court Alert" text must be submitted as a template with `caseTitle` as `{{1}}`); only write `status:'sent'` on 2xx, else `failed`; normalize phone to E.164. ~4–6h code + **external gate: WhatsApp Business API / template approval (days–weeks).** Also fix the IDOR in §2.

---

### 1.4 eCourts retrieval broken by session/cookie mismatch — CONFIRMED

eCourts binds the CAPTCHA solution to the server session cookie set when the CAPTCHA image is served. All three production retrieval functions use Deno global `fetch`, which does **not** persist cookies across calls — they GET the page, fetch the CAPTCHA image, and POST the form on three separate connections with no shared session, so the server always sees an invalid CAPTCHA.

- **`check-case-judgment/index.ts`** — GET page `:197`, fetch CAPTCHA `:237`, POST form `:314-324` (**no `Cookie` header**); the `Invalid Captcha` branch at `:329` is the normal outcome.
- **`sync-case-documents/index.ts`** — identical defect: `:200`, `:244`, `:328-338`, invalid-captcha branch `:343`.
- **`fetch-case-orders/index.ts`** — worse: does **not even attempt** submission. Single GET `:100-105`; on CAPTCHA it writes `captcha_blocked` and queues `captcha_queue` (`:131-161`); returns `manual_required` with `"automated form submission not implemented"` (`:164-185`). No 2Captcha at all.

**The working approach — `admin-doc-sync-trial/index.ts`:** runs a **Puppeteer script inside one Browserless browser context** so navigate → screenshot CAPTCHA element → fill → submit all share one cookie jar (rationale at `:5-20`; in-DOM CAPTCHA screenshot at `:277`; cookies read at `:289-296`). Caveat for honesty: the trial file's Phase 3/4 deliberately *prove* the session breaks when split across calls and stop short of a green-path single-call submit (`:484-488`, `:517-553`). What it establishes is the **correct architecture**, not a finished green path.

**Scope to port (~1–2 days/function; `fetch-case-orders` longer as it's net-new):**
- Add `BROWSERLESS_API_KEY` to the three functions; replace the GET+fetch+POST sequence with a single Browserless `/function` Puppeteer block that navigates, screenshots `#captcha_image`, **polls 2Captcha inside the script**, fills `#case_type/#search_case_no/#rgyear/#captcha`, submits, and returns result HTML.
- **Reconcile a real discrepancy:** the trial targets `/cases/case_no.php` with `#`-selectors; the three functions target `/cases/s_kiosk_case_status.php` with flat POST params, and bench `distCode`/`courtCode` differ between files. Standardize on whichever portal/form actually resolves.
- Keep existing guards (`can_check_judgment`, `acquire/release_document_sync_lock`, rate limits) and HTML parsers — only the network/session layer changes.

**External gate:** Browserless + 2Captcha account/credit setup; court-site HTML fragility (selectors break without notice).

---

### 1.5 scrape-causelist case extraction stubbed — CONFIRMED

- **`supabase/functions/scrape-causelist/index.ts`** scrapes the court table (court numbers + judge names) into `court_metadata` successfully, but per-court case extraction is non-functional:
  - `scrapePdfWithFirecrawl` (`:650-665`) **unconditionally `return []`** with the comment "HC website requires JavaScript-based navigation that Firecrawl can't fully handle".
  - `scrapePdfWithSession` (`:551-647`) abandons Browserless and falls back to that empty stub (`:637-641`).
  - The fully-built extractors (`extractCasesFromPdfWithGemini` `:883`, `parseCauseListText` `:1050`, `scrapeCauseListPage` `:747`) are **never reached** — `scrapeCauseListPage` has no caller. So `totalCases` is always 0.
- **Real ingestion is the Telegram path — CONFIRMED:** `telegram-webhook/index.ts` (`processDocument` `:338-477`) downloads the PDF via Telegram file API, runs Gemini structure detection + per-court/chunk parsing (`callGoogleAI` `:489-548`), dedupes, and **inserts real rows into `daily_court_docket`** (`:447-471`); it delegates to `download-causelists` (`:195-212`). `scrape-telegram-causelist` is a second Firecrawl-based variant that also inserts real docket rows.

**Why it matters:** The direct-portal scraper is dead weight for cases; the product's data spine rests entirely on the Telegram bot pipeline.

---

## 2. SECURITY HARDENING (must fix before real user data)

### CRITICAL

**2.1 `profiles` is world-readable to every authenticated user — and the "fix" is a no-op.**
- Original: `supabase/migrations/20251203133923_645b33df...sql:15` — `create policy "Users can view all profiles" on public.profiles for select using (true);`
- The intended fix `20260110123953_c2ebc0f4...sql:2` runs `DROP POLICY IF EXISTS "Users can view own profile"` — **a name that never existed** — then adds an owner/admin OR-policy. Because permissive SELECT policies OR together, the original `using(true)` **still grants every user read of every lawyer's `full_name`, `whatsapp_number`, and `role`.**
- **Risk:** Any logged-in user can enumerate all advocates' names + WhatsApp numbers (PII / DPDP exposure).
- **Fix:** `DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;` (keep only the owner/admin policy).

**2.2 `subscriptions` is read/write to all authenticated users.**
- `supabase/migrations/20251229182944_f2dbf775...sql:78-79` — `CREATE POLICY "Service role can manage subscriptions" ... FOR ALL USING (true) WITH CHECK (true);` Never dropped. Service role bypasses RLS anyway, so this policy's only real effect is granting `authenticated` full access.
- **Risk:** Any user can read all customers' Stripe IDs and **self-grant a paid plan** (`UPDATE ... SET plan_type='chamber', status='active'`) or cancel others'. (Becomes acute the moment billing ships.)
- **Fix:** `DROP POLICY "Service role can manage subscriptions" ON public.subscriptions;`

### HIGH

**2.3 `user_roles` INSERT `WITH CHECK (true)` — possible privilege escalation.**
- `supabase/migrations/20251203135431_b58f20bd...sql:48` — `"System can insert roles" FOR INSERT WITH CHECK (true)`. If `user_roles` drives `has_role(...,'ADMIN')`, any authenticated user may be able to self-assign ADMIN unless a trigger blocks it. **Verify the trigger/grant.**
- **Fix:** `WITH CHECK (auth.uid() = user_id AND role <> 'ADMIN')`, or restrict to service role.

**2.4 `token_usage_daily` and `bench_procedural_patterns` FOR ALL `USING(true) WITH CHECK(true)`.**
- `20251229182944_f2dbf775...sql:51-52` and `20260101192101_22e528fa...sql:129-132`. Any user can forge AI token-budget accounting / overwrite shared judge-behavior intelligence. **Fix:** drop both policies (service role bypasses RLS; admins already have SELECT).

**2.5 Committed `TRIGGER_SECRET` literal — ROTATE.**
- `supabase/migrations/20251218092302_4ffb3356...sql:18` — `'x-trigger-secret', 'Xy9zA2bC4dE5fG6hI7jK8lM9nO0pQ1rS2tU3vW4xY5z='`. This is the live callback-auth secret for `auto-match-aliases`/`backfill-alias-matches`, in plaintext in git history. **Rotate `TRIGGER_SECRET`.**

**2.6 telegram-webhook header-absent bypass.**
- `supabase/functions/telegram-webhook/index.ts:93-106`: the mismatch rejection lives inside `if (botToken && telegramSecretToken)`. **Omit the header entirely** → falls to the `else if (!telegramSecretToken)` branch which only logs a warning and continues. An attacker can POST forged `{message:{document:{file_id}}}` to make the server download from Telegram, run Gemini parsing (spends money), and write `daily_court_docket`. (Also: the expected secret equals the bot token — a separate weakness.)
- **Fix:** reject when missing OR mismatched, against a distinct `TELEGRAM_WEBHOOK_SECRET`:
  ```ts
  if (!expected || !token || token !== expected) return 401;
  ```

**2.7 ~18 `verify_jwt=false` edge functions with no in-code auth.**
- From `config.toml`, 24 functions are `verify_jwt=false`; only 3 self-authenticate (`telegram-webhook` — broken; `auto-match-aliases`, `backfill-alias-matches` — proper `x-trigger-secret`; `revoke-expired-interns` uses `x-cron-secret`/service-role correctly). The rest run their full workload on any anonymous request. **Money-burners callable by anyone:** `parse-case`, `parse-all-cases`, `ai-worker`, `scrape-causelist`, `scrape-telegram-causelist`, `test-firecrawl-pdf`, `search-indian-kanoon`, `pdf-extract-chunk`, `scan-lawyer-names`. DB-writers callable by anyone: `html-extract`, `html-causelist-parse`, `match-docket-aliases`, `download-causelists`, `extract-causelist-notes`, `aggregate-case-durations`, `scrape-live-board`.
- **Risk:** anonymous cost-amplification (Gemini/OpenAI/Firecrawl/2Captcha/Indian Kanoon spend) and arbitrary writes to the docket.
- **Fix:** apply the existing `x-trigger-secret`/`TRIGGER_SECRET` check (the pattern already in `auto-match-aliases`) at the top of each internal function; set `verify_jwt=true` for user-facing ones.

### MEDIUM

**2.8 Residual INSERT `WITH CHECK(true)` on user-facing tables.**
- `notifications` (`20251230210302_fde59132...sql:56`) and `notification_escalations` (`:85`) — `user_id` not constrained to `auth.uid()`, so a user can forge notifications/escalations *to other users*. `synced_court_documents` (`20260110100507_dc676656...sql:86`) — any user can insert document rows for any case. Plus `parser_confidence_runs`, `causelist_gap_audit`, `docket_cleanup_log`, `parser_fallback_log`, `intern_access_log`. **Fix:** replace `WITH CHECK(true)` with a column-scoped check or rely on service-role bypass.

**2.9 `escalate-whatsapp` trusts `body.userId` (IDOR).**
- `escalate-whatsapp/index.ts:28,78` inserts `user_id: userId` from the request body; it's `verify_jwt=true` but never calls `getUser()`. Any authenticated user can log/send an escalation as another user. **Fix:** derive `userId` from `getUser()`, ignore the body.

**2.10 `case-documents` SELECT only checks `authenticated`, not ownership.**
- `20251231102948_8463b675...sql:12-18` grants read of *any* case document to *any* authenticated user (the stricter owner-folder policy is additive, not a replacement). **Fix:** drop the loose policy; keep owner-scoped.

**2.11 Intern temp password is predictable.**
- `create-intern-account/index.ts:237-249` — `Word1Word2##` from a 24-word legal vocabulary via **`Math.random()`**: 24×24×90 = **51,840 combos (~15.7 bits)**, and the password is returned in the response body. Interns are auto-confirmed (`email_confirm:true`) and can log in immediately. **Fix:** `crypto.getRandomValues` (~120 bits), force reset on first login, prefer a reset link over returning plaintext.

### LOW (rotate / hygiene)

**2.12 Anon JWT embedded in 4 migrations + committed `.env`.**
- Same anon JWT (`role:anon`, `ref:pwpnnixoscppfzjogcgj`, exp ~2035) appears in `20251218092302...:17`, `20251205073059...:70`, `20251205073111...:7`, `20251229160445...:30`. The anon key is public-by-design (low severity) but long-lived and embedded in SQL — consider rotating.
- **`.env` IS tracked in git** (`git ls-files .env` confirms) despite being in `.gitignore` — force-added in commit `67e2af3`. Contents are anon/public values, but a tracked `.env` is a process failure (next person commits a real secret). **Fix:** `git rm --cached .env`.
- `config.toml:1` and several SQL files / `src/components/admin/CauseListScraper.tsx:62` hardcode the project ref/URL — not a secret, but brittle.

**Storage buckets:** both `case-documents` and `causelist-pdfs` were created **public** early in history and are **private in the final migration state** (`20251231102948...`, `20260518000001_private_causelist_bucket.sql`). No `judgment` bucket (judgments live in `case-documents`). **No service_role key or third-party API keys are committed** — those use `app.settings.*` / `Deno.env`. Good.

---

## 3. DEAD CODE & ARCHITECTURAL DEBT

| Item | Verdict | Keep / canonical |
|---|---|---|
| **AI parse pipelines** `ai-worker` / `parse-case` / `parse-all-cases` | `parse-case` (drains `case_parse_queue`, which nothing feeds anymore) and `parse-all-cases` (no caller; its `status='scanned'` trigger condition is never set) are **DEAD** → DELETE (+ remove `case_parse_queue`/`ai_parse_cache` if unused, and the `triggerParseCase` admin button at `HiddenAdminPortal.tsx:148-159`) | **`ai-worker`** — only one fed by live ingestion, with token budget + atomic claim + provider fallback. `scan-lawyer-names:577` confirms it superseded the others. |
| **`ai-worker` cron** | **WIRE-UP** — the header comment claims cron drives it, but **no `cron.schedule` for `ai-worker` exists** in any migration; in prod the queue is drained only by the manual admin button (`AiJobsMonitor.tsx:157`). | add a schedule (or document the manual expectation) |
| **Alias matchers** (four, not three) | `auto-match-aliases` and `backfill-alias-matches` share one algorithm (Jaro-Winkler ≥0.92, multi-word only). `match-docket-aliases` uses a *different* algorithm (first-name gate, token/substring tiers, no fuzzy, different normalization `[^\w\s]`, min len 4, mislabels all matches as `alias_exact` at `:373`). `scan-lawyer-names:isLawyerNameMatch` is a 4th (boolean block-selection). Client `useAliases.ts`/`lawyerNameUtils.ts` is a 5th normalization (uppercases at write time — uncoordinated with server lowercasing). **CONSOLIDATE** into `_shared/aliasMatch.ts`. | **`auto-match-aliases`** algorithm (most defensive). Delete `match-docket-aliases`'s bespoke scorer; keep `scan-lawyer-names`'s as a distinct block-selector but reuse the shared `normalize`. |
| **`_shared/fallbackController.ts`** | **DEAD** — zero importers (grep finds only its own definition). Near-duplicate `src/lib/parserFallback.ts` also has zero importers. → DELETE both (and check `is_fallback_disabled`/`log_fallback_attempt` RPCs + tables). | none |
| **`src/lib/sentryStub.ts`** | No-op **by design** but wired at `src/main.tsx:6,8`. **KEEP** as the canonical telemetry entry point (or delete with the main.tsx lines if dropping Sentry). | itself |
| **CourtScan manual upload** | `src/components/onboarding/CourtScan.tsx:218` — toasts "coming soon", no upload. Stub. | hide or build |
| **CourtFocusOverlay quick notes** | `src/components/court-focus/CourtFocusOverlay.tsx:310-320` — button hardcoded `disabled`, `title="Quick notes coming soon"`. Stub. | hide or build |
| **Annotation pen/eraser** | `SmartPdfViewer.tsx:100` `handleTextSelection` returns early unless `highlighter`; pen/eraser are selectable in `AnnotationToolbar.tsx:46-55` but nothing draws them. Backend `useAnnotations.ts` **already supports** `annotation_type:'pen'`. → **WIRE-UP** the viewer, or remove the tools. | `useAnnotations` (backend ready) |
| **Summarization (two competing dead paths)** | `SmartPdfViewer.handleSummarize` (fake `setTimeout`) and `useAIIntelligence.summarizeCase` (calls a non-existent `ai-worker` action). **CONSOLIDATE** onto one real `summarize` action; delete the `setTimeout` fake. | a real `summarize_case` action in `ai-worker` |

Other confirmed stubs: `useSubscription.ts:46-53` (billing, §1.1), `OperationsConsole.tsx:370-377` ("Subscription System Not Implemented" panel), `ProductDossier.tsx:681` (Stripe placeholder text). Not dead code — accurate self-labeling of unbuilt areas.

---

## 4. COMPLETION PUNCH LIST (dependency-ordered, with estimates)

Effort assumes a single workstream. External gates are flagged ⛔ and must be *started first* because their calendar time dwarfs the code time.

### Week 1 — Ship-blockers + security (make it safe and chargeable)
0. ⛔ **Start external applications day 1** (gate everything): Razorpay merchant KYC, WhatsApp Business API + Utility-template submission, Browserless + 2Captcha accounts. (calendar: days–weeks; our effort ~2–3h of forms.)
1. **Security CRITICAL/HIGH** — drop `profiles` `using(true)` (§2.1), `subscriptions` FOR ALL (§2.2), `token_usage_daily`/`bench_procedural_patterns` (§2.4); fix `user_roles` INSERT (§2.3); rotate `TRIGGER_SECRET` (§2.5); fix telegram bypass (§2.6); add shared-secret auth to the ~18 open functions (§2.7); `git rm --cached .env` (§2.12). **~1–1.5 days.**
2. **Billing rail (Razorpay)** — migration + create-order + signed webhook + checkout + minimal plan UI + one real gate. **~2.5–3 days.** (Code can proceed in sandbox while KYC pends; go-live blocked on ⛔.)
3. **De-fake the AI UI** — wire "Find Precedents" to real `search-indian-kanoon` (~1h); add `summarize_case` action to `ai-worker`, point SmartPdfViewer + AIInsightPanel at it, delete `setTimeout` fakes (~0.5 day); **hide** AiStrategyPanel + "Points of Law" until real (~1h). **~1 day.**
4. **WhatsApp escalation real send** (§1.3) + IDOR fix (§2.9). **~0.5–1 day** code; ⛔ blocked on template approval to go live.

### Week 2 — Data-pipeline reliability (make the core promise true)
5. **Port single-session Browserless approach** into `check-case-judgment` + `sync-case-documents` (§1.4), reconcile the portal/selector discrepancy. **~2–3 days.** ⛔ court-site fragility.
6. **`ai-worker` cron schedule** (§3) so the queue drains without an admin clicking a button. **~0.5 day.**
7. **Consolidate alias matchers** into `_shared/aliasMatch.ts` (§3). **~1 day.**
8. **Harden the Telegram ingestion path** (the real spine): monitoring/alerting on parse failures, retry/backfill, dedup verification. **~1 day.**

### Week 3+ — Polish / depth
9. **Build `fetch-case-orders`** properly (net-new full flow) (§1.4). **~2 days.** ⛔.
10. **Decide scrape-causelist fate** — either implement PDF extraction or delete the dead extractor path and rely on Telegram (§1.5). **~0.5–2 days.**
11. **Delete dead code** — `parse-case`, `parse-all-cases`, `fallbackController.ts`, `parserFallback.ts`, `match-docket-aliases` scorer (§3). **~0.5 day.**
12. **Finish or hide remaining stubs** — annotation pen/eraser, CourtScan upload, CourtFocus quick notes (§3); tighten MEDIUM RLS (§2.8/2.10), intern password (§2.11). **~1–2 days.**

---

## 5. DATA-PIPELINE RELIABILITY ASSESSMENT

**The promise: "your cases and outcomes appear automatically."**

- **What works end-to-end today (~55–65% of the promise):** *Causelist ingestion* via Telegram is genuinely built — `telegram-webhook` → `download-causelists` → Gemini parse → `daily_court_docket` → alias match (`auto-match-aliases` trigger) → realtime UI. A lawyer's name *being listed for tomorrow* does flow through automatically when the Telegram bot receives the PDF. Court/judge metadata via `scrape-causelist` also works.
- **What does NOT work (the "outcomes" half):** *Judgments and orders* — the on-demand retrieval (`check-case-judgment`, `sync-case-documents`, `fetch-case-orders`) is broken by the session/cookie defect (§1.4), so outcomes do **not** appear automatically. Alerts that something happened don't actually send (WhatsApp, §1.3). The direct-portal causelist scraper extracts zero cases (§1.5).
- **Single most fragile dependency:** the **Telegram bot pipeline** — the entire working spine depends on someone/something posting the right HC causelist PDF to the watched channel, plus Gemini parsing it correctly. There is no cron drain for `ai-worker` (§3), no real failure alerting, and the webhook is currently bypassable (§2.6). If the Telegram channel changes or the bot stops, ingestion silently goes to zero.
- **Minimum reliable day-one path we can honestly guarantee:** *"Tomorrow's cause-list listing for your name, ingested from the Telegram PDF feed, shown in your docket with realtime updates."* That is real and defensible. We should **not** promise automatic judgment/order outcomes or WhatsApp alerts until §1.3/§1.4 land — today those are aspirational.

---

## 6. LAUNCH-READINESS VERDICT

NyayHub is a real ingestion engine wearing a coat of unfinished features. The honest distance to first paying user is **~12–16 focused working days** at ~1.5 productive hrs/day (≈18–24 productive hours): roughly Week-1 security + billing + de-faking the AI UI is the irreducible minimum to charge money without misrepresenting the product, and Week-2 pipeline work is what makes daily reliance defensible. The **riskiest assumption** in that estimate is not the code — it's the **external gates running in parallel**: Razorpay KYC, WhatsApp Business template approval, and Browserless/2Captcha against a court site that can change its form markup without notice. If any of those slips (and KYC/WhatsApp approval routinely take 1–3 weeks), calendar time to a *fully*-featured paying user stretches well past the coding estimate — which is why the right launch posture is to ship the **narrow, true promise** (Telegram-fed cause-list docket + working billing + honest, non-fake AI) on day one and add judgment-outcome automation as the gates clear, rather than waiting to ship everything at once.
