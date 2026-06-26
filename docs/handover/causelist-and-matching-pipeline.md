# NyayHub — Cause-List & Case-Matching Pipeline Handover

> Honest technical handover. Documents what the code **actually** does in production,
> not the intent in design docs or memory notes. Generated 2026-06-26.

---

## 0. Status legend

| Tag | Meaning |
| --- | --- |
| **Working** | In the live request path, exercised on every relevant run. |
| **Partial** | Runs, but with known gaps, silent failures, or limited coverage. |
| **Stub** | File exists, wired to UI or cron, but does not perform its advertised function. |
| **Dead** | Code present, no caller / trigger / cron / UI reference. Safe to delete after review. |

---

## 1. Cause-list ingestion — three competing paths

### Path A — Telegram (primary, production)   **Working / Partial**

```
Telegram channel
   └─> telegram-webhook  (edge fn)
         └─> download-causelists
               ├─> stores PDF in Supabase Storage
               ├─> writes row in raw_causelists
               └─> fan-out:
                     ├─> extract-causelist-notes   (first 2–3 pages, NOTE/IMPORTANT/DIRECTION)
                     └─> scan-lawyer-names         (per-profile, string match, no AI)
                           └─> pdf-extract-chunk    (pdfjs-serverless, 30 pages/chunk, self-chains)
                                 └─> enqueue rows in case_parse_queue
                                       └─> parse-case  (worker, cron)
                                             ├─ primary:  Google Gemini 2.0 Flash (raw base64 PDF)
                                             ├─ fallback: OpenAI gpt-4o-mini
                                             └─ tertiary: OpenRouter
```

Notes:
- `parse-case` sends the **raw base64 PDF** to Gemini — biggest single Lovable Cloud cost driver.
- `pdf-extract-chunk` self-chains; failures mid-PDF leave partial `raw_causelists.text_content`.
- Output rows land in `daily_court_docket` with `matched_profile_id` set.

### Path B — Admin manual upload   **Working** (most reliable)

```
Admin UI → upload-causelist
   ├─ PDF  → same parsers as Path A
   └─ HTML → html-causelist-parse   (pure regex, zero AI)
```

The HTML path is the only fully-deterministic ingestion path. No token spend.

### Path C — Web scrape   **Dead**

- `scrape-causelist` — POSTs to `hcraj.nic.in`, `MAX_COURTS=3`, requires session cookies. **No cron, no caller.**
- `scrape-telegram-causelist` — Firecrawl against the public Telegram web preview. **No cron, no caller.**

Both are orphaned. Either delete or wire to a scheduler; today they consume code surface only.

---

## 2. Stored schema — `daily_court_docket`

- 39 columns total; **~18 reliably populated** by the live pipeline.
- `matched_profile_id` — **the** field everything downstream filters on. Account isolation hinges on it.
- Unique constraint: `(court_location, court_no, case_number, date, matched_profile_id)`
  → the **same matter is duplicated per matched profile** (intentional, supports co-counsel rollups).
- `chamber_id` — almost always **NULL**. No ingestion path writes it.
- `case_context` — defaults to `'personal'`. **No code path sets `'chamber'`.**

Key consequence: chamber rollup queries return empty even when the schema suggests they should work.

---

## 3. Lawyer-name extraction & normalization

Raw strings look like:

```
MANISH PITLIYA-P RAMESH PUROHIT-R 603
```

`normalizeLawyerName()` exists in **two implementations** (TS + SQL) that must stay in sync:

- Strips: `ADV`, `ADVOCATE`, `MR`, `DR`, `SHRI`, `SMT`, `SENIOR ADV`, `JR ADV`, `LEARNED`.
- Collapses whitespace, trims punctuation.
- SQL version was **patched to escape `%`** to keep `LIKE` safe — TS version has no such guard
  but is only used for storage, not query construction.

---

## 4. Alias system — `lawyer_aliases`

Schema gaps:
- No `verified` column.
- No `source` column (cannot tell which aliases came from user vs. auto-extraction).
- No uniqueness across profiles.

Client-side rules (`useAliases.ts`):
- Normalizes before insert.
- Enforces a **5-character minimum** — **client-side only**. A direct insert via SQL or another
  surface bypasses it.

**Collision vector:** two lawyers with overlapping aliases (e.g. both register `"SHARMA"`) will
**both silently get matched to the same cases**. There is no warning, no review, no de-dupe.

---

## 5. Matching — five implementations, only some live

| # | Where | Trigger | Confidence | First-name gate | Status |
| - | ----- | ------- | ---------- | --------------- | ------ |
| 1 | SQL trigger `auto_match_on_insert` (BEFORE INSERT on `daily_court_docket`) | every insert | hardcoded **0.95** | no | **Working — this is what runs in production** |
| 2 | `match-docket-aliases` edge fn (cron */30) | 7-day lookback, max 5,000 rows | tiered 0.95 / 0.95 / 0.85 / 0.80 | yes (at 0.85 tier) | **Partial — skips rows already matched by #1, so the trigger permanently locks it out** |
| 3 | `auto-match-aliases` edge fn | `pg_net` trigger | — | — | **Dead — trigger dropped in migration** |
| 4 | `backfill-alias-matches` edge fn | `pg_net` trigger | — | — | **Dead — trigger dropped in migration** |
| 5 | `admin_match_cases_for_profile` SQL fn | admin manual | — | — | **Working, admin-only** |

Logic of #1 (live path):

```sql
lawyer_field ILIKE '%' || normalize(alias) || '%'
-- confidence := 0.95
```

This matches **any substring**. With a 5-char alias `"SHARM"`, `"SHARMA"`, `"SHARMAN"`, and a
typo `"SHARM A"` (post-collapse) all match. No first-name disambiguation.

**Key architectural problem:** because #1 stamps `matched_profile_id` immediately at INSERT,
the higher-quality matcher #2 sees the row as "already matched" and skips it. The cron's
first-name gate and tiered scoring never get a chance to override a bad ILIKE hit.

---

## 6. Chamber rollup   **Stub**

- `useDualStreamDocket.ts` queries:
  ```ts
  .eq('case_context', 'chamber')
  .in('chamber_id', userChambers)
  ```
- **No ingestion path ever writes `case_context='chamber'` or sets `chamber_id`.**
- Net effect: a senior advocate does **not** see junior listings rolled up. The rollup is
  structurally wired in the UI and operationally empty in the data.

---

## 7. Confidence & human review   **Stub**

- `needs_review` column exists on `daily_court_docket`.
- Written **only by dead functions** (#3, #4 above).
- **Zero components read it** — no review queue, no admin UI surface.
- Low-confidence and outright wrong matches **auto-assign silently**.

There is currently no mechanism to detect, surface, or correct a misassigned case other than
manual SQL.

---

## 8. Cron audit (current state)

| Job ID | Function | Schedule | Daily invocations | Notes |
| ------ | -------- | -------- | ----------------- | ----- |
| 15 | `parse-case` | `*/5 * * * *` | **288** | Dominant cost — Gemini on raw PDFs |
| 16 | `scan-lawyer-names` | `*/15 * * * *` | **96** | Runs 24/7, no value overnight |
| 17 | `match-docket-aliases` | `*/30 * * * *` | 48 | Mostly no-op (see §5) |
| 6–9 | `scrape-causelist` | every 3 h | 32 total | Limited to 3 courts |
| 18–23 | `scrape-live-board` | optimized | — | Active only during court hours |

Recommended cuts (not applied — documentation only):
- Restrict 15, 16, 17 to Mon–Fri 06:00–21:00 IST → ~60–70 % reduction.
- Or make 15, 16 trigger-based off `raw_causelists` inserts and disable the crons.

---

## 9. Stub / dead inventory

Delete or finish — none of these are pulling weight today:

- `simulate-live-board` — test harness, not gated behind a flag.
- `test-firecrawl-pdf`, `test-pdf-parse` — leftover probes.
- `LiveBoardSimulator.tsx` — imported by `Dashboard.tsx:672`, renders fake data into the live UI.
- `scrape-telegram-causelist` — orphaned (§1 Path C).
- `parse-all-cases` — only fires on legacy `status='scanned'` rows; effectively dormant.
- `document_processing_queue` table — referenced by docs, not by live writers.
- `auto-match-aliases`, `backfill-alias-matches` — dead (§5 #3, #4).
- `needs_review` write/read loop — broken on both ends (§7).
- `case_context='chamber'` + `chamber_id` fields — never populated (§2, §6).

---

## 10. Outstanding build-mode fixes (from prior audit)

Not yet applied. Small, mechanical, type-only:

1. `tsconfig.app.json` — add `"types": ["node"]` to `compilerOptions.types`
   (resolves `NodeJS` / `process` errors).
2. `src/components/admin/BciVerificationQueue.tsx` — cast `supabase` to `any` for the
   `profiles` query and the `set_bci_verification_status` RPC.
3. `src/components/PrivacySettings.tsx` — cast `supabase.rpc` to `any` for `request_data_export`.
4. `src/pages/Onboarding.tsx` — cast `supabase` to `any` for the
   `user_consents.insert(rows)` call.
5. **Long-term:** regenerate `src/integrations/supabase/types.ts` from the live schema so the
   `any` casts above can be removed. Not a code change — a workflow change.

---

## 11. Memory vs. reality

The project memory `infrastructure/account-wise-causelist-system` describes an **intended
redesign**:

- "scan-lawyer-names every 5 minutes, parse-case every 1 minute"
- "All scans and parsing per user profile only, no global alias scans"
- "Scanning enqueues parse tasks, doesn't insert final records"

Audited reality differs:

- `parse-case` runs **every 5 min**, not every minute.
- `scan-lawyer-names` runs **every 15 min**, not every 5.
- The **live matcher is the SQL trigger** (§5 #1), which is a global ILIKE — not per-profile.
- The trigger inserts directly into `daily_court_docket` with `matched_profile_id` already
  set, bypassing the queue-then-match model the memory describes.

**Recommendation for the next maintainer:** reconcile the memory with the code before
trusting either. Pick one model (trigger-based vs. queue-based) and delete the other.

---

## 12. Quick-reference: what to fix first

Ranked by leverage:

1. **Disable or guard the `auto_match_on_insert` trigger** so `match-docket-aliases` can
   actually do its job. Today the trigger is the silent reason for most miscassignments.
2. **Add cross-profile uniqueness or a review queue for `lawyer_aliases`.** The 5-char
   client-side rule is not a defense.
3. **Cut `parse-case` cron to business hours** — single biggest Cloud-cost win.
4. **Delete dead functions** (§9) so future audits aren't slowed by ghost code.
5. **Decide on chamber rollup** — either populate `case_context`/`chamber_id` at ingest, or
   remove the dual-stream UI path.

---

*End of handover.*
