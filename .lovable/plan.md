## Goal

Create a single Markdown handover document that consolidates the substantive technical findings from this chat thread, so you have a durable export you can hand to another engineer.

## Deliverable

One new file:

- `docs/handover/causelist-and-matching-pipeline.md`

No code changes. No edits to existing files. Pure documentation.

## Document structure

1. **Scope & status legend** — definitions for Working / Partial / Stub / Dead, so the reader can scan honestly.
2. **Cause list ingestion**
   - Path A: Telegram → `telegram-webhook` → `download-causelists` → `extract-causelist-notes` + `scan-lawyer-names` → `pdf-extract-chunk` → `case_parse_queue` → `parse-case` (Gemini 2.0 Flash primary, gpt-4o-mini fallback, OpenRouter tertiary).
   - Path B: Admin upload → `upload-causelist` → PDF parsers or `html-causelist-parse` (regex, no AI).
   - Path C: `scrape-causelist` and `scrape-telegram-causelist` — orphaned, no scheduler.
3. **Stored schema** — `daily_court_docket`: 38 cols, ~18 reliably populated; `matched_profile_id` is the key field; `chamber_id` almost always NULL; `case_context` always `'personal'`.
4. **Lawyer name extraction & normalization** — `normalizeLawyerName()` (TS + SQL), tokens stripped, SQL version patched to escape `%`.
5. **Alias system** — `lawyer_aliases` has no `verified`/`source`; 5-char min is client-side only; no cross-profile uniqueness → silent duplicate matches possible.
6. **Matching (5 implementations)**
   - SQL trigger `auto_match_on_insert` — ILIKE, hardcoded 0.95, no first-name gate. **This is what runs in production.**
   - `match-docket-aliases` cron — tiered 0.95/0.85/0.80 with first-name gate, but skipped on rows already matched by the trigger.
   - `auto-match-aliases`, `backfill-alias-matches` — dead (pg_net triggers dropped).
   - `admin_match_cases_for_profile` — admin-only.
7. **Chamber rollup** — `useDualStreamDocket.ts` queries on `case_context='chamber'` + `chamber_id`, but no ingestion path ever sets them. Wired, operationally empty.
8. **Confidence & review** — no review UI; `needs_review` written by dead functions, read by nothing; low-confidence matches silently auto-assign.
9. **Cron audit (current)** — table of jobs 15, 16, 17, 6–9, 18–23 with schedules and daily-invocation counts; flags `parse-case` (288/day) and `scan-lawyer-names` (96/day) as the dominant Lovable Cloud cost drivers.
10. **Stub / dead inventory** — `simulate-live-board`, `test-firecrawl-pdf`, `test-pdf-parse`, `LiveBoardSimulator.tsx`, `scrape-telegram-causelist`, `parse-all-cases`, `document_processing_queue`, `auto-match-aliases`, `backfill-alias-matches`, `needs_review` loop, `case_context='chamber'`/`chamber_id`.
11. **Outstanding build-mode fixes** — the 5-edit list (`tsconfig.app.json` node types; `any` casts in `BciVerificationQueue`, `PrivacySettings`, `Onboarding`; long-term regenerate `src/integrations/supabase/types.ts`).
12. **Memory note** — flag that the project memory `infrastructure/account-wise-causelist-system` describes an *intended* redesign (per-profile scan every 5 min, parse every 1 min, no global scans) that does **not** match the audited reality (trigger ILIKE is the live matcher; crons are `*/5` parse and `*/15` scan), and recommend reconciling memory vs. reality.

## What this plan does NOT do

- No verbatim chat transcript (tool outputs aren't recoverable from history).
- No code, schema, or cron changes.
- No regeneration of `supabase/types.ts`.

Approve and switch to build mode and I'll write the file in one pass.