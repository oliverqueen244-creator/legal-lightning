# NyayHub — Name Parsing & Cause-List Matching: Domain Extraction

**Date:** 2026-06-25
**Purpose:** A precise, honest read of how advocate-name parsing and cause-list filtering work today, for extraction before a clean rebuild. Traced from actual execution, not comments/names. No code was modified. Every claim cites `file:line`.

**Two corrections to the brief up front (don't take these on faith — they're load-bearing for the rebuild):**
1. The handover said "five uncoordinated implementations." There are **six** name-matching code locations (the sixth is a client-side write-time normalizer that silently shapes what every server matcher sees). More importantly, the **single matcher that actually runs for the common docket INSERT is the *worst* of them** (an unanchored SQL `ILIKE '%alias%'` substring match), and the most-correct one only runs as a second pass on the HTML path.
2. You described a chamber-scoped model where "a senior sees their juniors' listings." The chamber roll-up **schema, RLS, hooks, and UI badge all exist — but nothing in the codebase ever sets `case_context='chamber'` or populates `chamber_id` on a docket row.** Every auto-matched/parsed row keeps the default `case_context='personal'`. So today there is effectively **no working chamber roll-up**; it is scaffolding with no writer. Details in §5.

---

## 1. INGESTION SHAPE

**Two entry points, two completely different downstream paths. Both ultimately write `daily_court_docket`.**

**Entry point A — Telegram (PDF only).** `telegram-webhook/index.ts:146-148` receives a Telegram `update` JSON; proceeds only if a PDF-ish document is attached (`:172-184`). It does **not** parse — it `fetch`es `download-causelists` with the Telegram `file_id` (`:195-212`) and returns (`:224-228`). The same file contains a full self-parsing pipeline (`processDocument`, base64 → `gemini-2.5-flash`, `:338-477,483`), **but that path is dead in the live flow** — it's only reachable via the `action=process-queue` branch (`:137-142`), not the webhook. So the live Telegram input form is a **PDF binary** fetched from Telegram's file API.

**Entry point B — Admin upload (PDF or HTML).** `upload-causelist/index.ts:59-63` reads a multipart form (`file`, `bench`, `list_type`, `list_date`), admin-gated (`:44-56`), accepting PDF or HTML (`:92-93`; HTML decoded inline `:155`).

There is **no plain-text or pre-parsed-JSON entry point.** Raw inputs are PDF binary or raw HTML.

**The hops (live paths):**
```
Telegram update JSON
 → telegram-webhook → download-causelists (PDF→storage bucket causelist-pdfs, INSERT raw_causelists status='downloaded')
 → download-causelists fires scan-lawyer-names (+ extract-causelist-notes)
 → scan-lawyer-names: PDF lacks text → fires pdf-extract-chunk (pdfjs-serverless, 30 pp/chunk, self-chains, fills raw_causelists.text_content)
 → pdf-extract-chunk completion → scan-lawyer-names again
 → scan-lawyer-names: classify, split text by "Court No" into court blocks, filter blocks containing a matched alias → INSERT ai_jobs (one per block, job_type 'court_parse')
 → ai-worker (cron): claim_next_ai_job → Gemini/OpenAI/OpenRouter prompt → parse JSON → insertParsedCases → INSERT daily_court_docket

Admin HTML upload
 → upload-causelist (INSERT raw_causelists input_format=HTML, text_content)
 → html-causelist-parse (deterministic regex, NO AI) → batchUpsertCases → UPSERT daily_court_docket
Admin PDF upload → same as Telegram from pdf-extract-chunk onward.
```
(Citations: `download-causelists/index.ts:44-144`; `scan-lawyer-names/index.ts:332-362,371-414,449-553`; `pdf-extract-chunk/index.ts:4,7,119-237`; `ai-worker/index.ts:102-103,142-143,441-541,746-790`; `html-causelist-parse/index.ts:1130-1227`.)

**Structured single-case entry.** `daily_court_docket` has **three** non-identical insert shapes:

- **AI writer** (`ai-worker/index.ts:766-780`): sets `date, court_location, court_room_no(String), item_no, case_number (built as "{case_type}.{case_number}/{year}"), petitioner, respondent, petitioner_lawyer (array.join(', ')), respondent_lawyer (array.join(', ')), matched_profile_id, source_url ('ai_job:{id}'), status:'pending', list_type`.
- **HTML writer** (`html-causelist-parse/index.ts:1452-1479`): sets `court_location, court_room_no, case_number, date, item_no, petitioner, respondent, petitioner_lawyer (CSV string), respondent_lawyer, judge_names, list_type, status:'pending', origin:'HTML_FULL_CAUSELIST', confidence_source:'court_structure', structure_confidence:0.9, raw_causelist_id, source_url ('html:{id}'), case_title_raw, vc_provider/vc_meeting_id/vc_join_url/vc_source/vc_extracted_at/vc_confidence` (Webex VC fields).
- **Telegram `processDocument` writer** (`telegram-webhook/index.ts:456-464`) — **not reached at runtime.**

Note: `petitioner_lawyer`/`respondent_lawyer` are always stored as a **single comma-joined string** in the table, even though `ai-worker` holds them as arrays pre-insert.

**Representative row** (HTML writer; field set is exactly `html-causelist-parse/index.ts:1452-1479`; values illustrative — no captured real DB row exists in-repo):
```
court_location: "JODHPUR"          court_room_no: "5"        item_no: 33
case_number:    "S.B.C.W.P. 1234/2024"
petitioner:     "RAMESH KUMAR"     respondent: "STATE OF RAJASTHAN"
petitioner_lawyer: "RAMESH CHANDRA PUROHIT"   respondent_lawyer: "ANIL KUMAR"
judge_names:    "DINESH MEHTA"     date: "2026-06-25"        list_type: "DAILY"
status: "pending"  origin: "HTML_FULL_CAUSELIST"  structure_confidence: 0.9
case_title_raw: "RAMESH KUMAR STATE OF RAJASTHAN (Revenue Dept)"
vc_provider: "webex"  vc_meeting_id: "1234567890"  vc_confidence: 85
```

---

## 2. ADVOCATE NAME EXTRACTION

The universal role marker across every parser is the suffix **`-P`/`-R`** (or `(P)`/`(R)`): `-P` = petitioner's advocate, `-R` = respondent's advocate.

**(i) HTML path — deterministic regex** (`html-causelist-parse/index.ts:777-799`), the only non-AI extractor:
```js
const petLawyerMatches = cellText.match(/([A-Z][A-Za-z\s\.]+)\s*[-–]\s*P(?:\b|$)/gi);
if (petLawyerMatches) petLawyers.push(...petLawyerMatches.map(m => m.replace(/[-–]\s*P$/i,'').trim()));
const respLawyerMatches = cellText.match(/([A-Z][A-Za-z\s\.]+)\s*[-–]\s*R(?:\b|$)/gi);
...
parsedCase.petitioner_lawyer  = [...new Set(petLawyers)].join(', ');   // :795
parsedCase.respondent_lawyer = [...new Set(respLawyers)].join(', ');   // :798
```
Cleaning here = strip the `-P/-R` suffix, `trim`, dedupe via `Set`, join with `", "`. **No honorific stripping at parse time.** A "hard lawyer-marker exclusion gate" `LAWYER_MARKER_PATTERN = /-\s*[PR]\b/i` (`:692`) keeps lawyer cells from being misread as party titles.

**(ii) PDF/AI path — the Gemini prompt** (`ai-worker/index.ts:462-466`, verbatim):
```
- Advocate suffix rules:
  - "-P" or "(P)" → petitioner lawyer
  - "-R" or "(R)" → respondent lawyer
- Remove -P / -R from names in output
```
Emits arrays `advocate_petitioner`/`advocate_respondent` (`:484-485`), mapped to `petitioner_lawyer`/`respondent_lawyer` (`:707-710`). The legacy `parse-case` prompt is richer (`parse-case/index.ts:558-571`): it additionally lists honorifics to ignore when matching (`Sh.`, `Shri`, `Mr.`, `Ms.`, `Adv.`, `Advocate`) and govt-advocate labels (`AAG`, `GA`, `Govt. Adv.`).

**(iii) `scan-lawyer-names` `isLawyerNameMatch`** (`:162-238`) does not *extract* — it's a boolean gate over raw PDF text deciding which court blocks to send to AI (patterns `\badv\.?\s*{alias}\b`, `\b{alias}\s*-\s*[PR]\b`, "Name of Advocate" column windows, pipe-table cells).

**Raw name string before cleaning.** There are **no test fixtures or captured cause-list samples in the repo** (the only `*.test.ts` files are `caseTypeMapping`, `benchNames`, `errorReporting` — none contain causelist data). Every concrete example is hardcoded inside prompts/comments: `"RAMESH PUROHIT-P"`, `"MR. SHARMA (P)"`, `"ADV. KUMAR (R)"` (`parse-case/index.ts:560-561`); `"| RAMESH CHANDRA PUROHIT-P |"` (`scan-lawyer-names/index.ts:208`); `"BRAJESH PUROHIT"` vs alias `"Ramesh Purohit"` (`match-docket-aliases/index.ts:79`). **Canonical raw form: `<NAME>-P` / `<NAME>-R`** (sometimes `(P)`/`(R)`), usually ALL CAPS, optionally prefixed `Adv./Mr./Sh.`, inside pipe- or column-delimited cells.

**Normalization at match time — two divergent implementations** (this matters for the rebuild):
- `src/lib/lawyerNameUtils.ts:54-69` `normalizeLawyerName`: `toUpperCase` → strip leading honorifics (`LAWYER_PREFIXES :7-33`: ADV./ADVOCATE/MR./MRS./MS./MISS/DR./SHRI/SMT./KU./LD./LEARNED/…) → collapse whitespace → strip trailing punctuation. No word reordering. Also `generateAliasVariations` (`:112-146`) builds initial forms (`A.K. SHARMA`, `A. SHARMA`) + bare surname.
- `match-docket-aliases/index.ts:23-29` `normalizeName`: `toLowerCase` → collapse whitespace → `replace(/[^\w\s]/g,'')` (strips **all** punctuation incl. dots) → trim. **Does not strip honorifics** ("adv" survives, handled only by substring fallback).
- The in-DB `normalize_lawyer_name()` (`20260518000000_production_fix.sql:205-233`) is a **third** normalizer: uppercases, strips ~20 honorific prefixes, escapes SQL wildcards.

So there are **three** normalizers (uppercase+honorific-strip client; lowercase+punct-strip server matcher; uppercase+honorific-strip+wildcard-escape SQL), and they do not agree — drift between them silently weakens exact matching.

---

## 3. ALIAS MODEL

**Schema** (`20251205072130_...sql:5-11`):
```sql
CREATE TABLE public.lawyer_aliases (
  id UUID PK DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  alias_name TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```
One advocate → many alias rows via `profile_id`. **No `normalized_name` column, no uniqueness constraint on `alias_name`, no per-alias role/confidence.** RLS (`:13-27`): all four ops gated `auth.uid() = profile_id` — a user sees/manages only their own aliases. There is **no array field on `profiles`** and no separate identity model (`profiles` cols confirmed at `20251203133923:5-11` + `20251205072130:30-33`); aliases live only in `lawyer_aliases`.

**Management** (`src/hooks/useAliases.ts`): `addAlias` normalizes via `normalizeLawyerName()` and stores the normalized (uppercased, prefix-stripped) form (`:37,57,62`); rejects normalized aliases < 5 chars (`:40-43`). `is_primary` is enforced in app code only — `setPrimaryAlias` clears all then sets one (`:111-122`); no DB partial-unique index. Dedup is UI-only (`AliasManager.tsx:37`, cap 10 at `:42-45`); `AliasManager` auto-seeds the normalized core name as primary if none exist (`:23-27`).

---

## 4. THE MATCHING ALGORITHM(S)

Six locations, four incompatible techniques, five confidence scales. For each: trigger, technique, confidence, failure modes.

### IMPL #1 — in-DB trigger `auto_match_on_insert()` — **THE LIVE PRODUCTION MATCHER**
- **Where:** function `20260110124734_...sql:4-75`; wired `CREATE TRIGGER trg_auto_match_before_insert BEFORE INSERT ON daily_court_docket` (`20260518000000_production_fix.sql:119-122`).
- **Trigger:** every `daily_court_docket` row INSERT, synchronous, in-DB, mutates `NEW`.
- **Technique (verbatim, `:33-40`):**
```sql
SELECT la.profile_id, la.alias_name INTO v_match_profile_id, v_matched_alias
FROM lawyer_aliases la
WHERE normalize_lawyer_name(la.alias_name) IS NOT NULL
  AND v_pet_normalized ILIKE '%' || normalize_lawyer_name(la.alias_name) || '%'
ORDER BY LENGTH(la.alias_name) DESC
LIMIT 1;
```
Petitioner first (`:33-46`), respondent only if no petitioner hit (`:49-62`). **Unanchored `ILIKE '%alias%'` substring containment**, longest-alias-first.
- **Confidence:** hardcoded `0.95` (`:44,60`), `match_method='auto_match'` (`:68`); **never sets `needs_review`** and never sets `case_context`/`chamber_id`.
- **Failure modes:** No word boundary → `"RAVI"` matches `"RAVINDRA"`/`"PARAVIND"`, `"SHAH"` matches `"SHAHANI"` (silent false positives). Longest-alias-first ≠ best-match-first. No fuzzy/OCR tolerance (false negatives). Flat 0.95 — a sloppy substring hit is indistinguishable from an exact hit, and nothing is flagged.

### IMPL #2 — edge fn `auto-match-aliases` — **ORPHANED (dead for dockets)**
- **Where:** `auto-match-aliases/index.ts` (`normalize :39-46`, `exactWordBoundaryMatch :70-76`, `jaroWinklerSimilarity :82-128`, `fuzzyMatch :135-164`, `matchLawyerField :173-247`).
- **Trigger:** *was* pg_net async from the old docket triggers — **all dropped** at `production_fix.sql:100-104`. Nothing re-invokes it; also gated by `x-trigger-secret` (`:267-276`). Dead for docket inserts.
- **Technique:** word-boundary exact (space-pad + `includes`, `:72-75`) conf `1.0` (`:215`); else Jaro-Winkler **only for ≥2-word aliases**, threshold `>= 0.92` (`:234`); single-word aliases never fuzzy (`:137-138`). Sets `needs_review = confidence < 0.95` (`:351`).
- **Failure modes (if it ran):** safer than #1 (no unanchored substring), but JW 0.92 over a multi-word segment can conflate similar names; single-word aliases get zero OCR tolerance.

### IMPL #3 — edge fn `backfill-alias-matches` — **LIVE only on new-alias insert**
- **Where:** `backfill-alias-matches/index.ts` (`matchesAlias :118-157`; same normalize/word-boundary/JW as #2).
- **Trigger:** pg_net from `trigger_backfill_on_alias_insert()` on **`lawyer_aliases` INSERT** (`20260113115647_...sql:2-35`) — **not** on docket insert; not dropped by production_fix. Scans last-90-day unmatched dockets (limit 500, max 100) when a user adds an alias.
- **Technique:** identical to #2; writes `match_method` as literal `'exact'`/`'fuzzy'` (`:268-269`); sets `needs_review = confidence < 0.95` (`:261`).
- **Failure modes:** same as #2; plus `'exact'/'fuzzy'` method strings are not in the auditability allow-list referenced at `20260113124859_...sql:90` — latent mismatch.

### IMPL #4 — edge fn `match-docket-aliases` — **LIVE for HTML path (post-insert second pass)**
- **Where:** `match-docket-aliases/index.ts` (`normalizeName :23-29`, `splitLawyerNames :32-38`, `matchSingleLawyer :42-140`).
- **Trigger:** `invoke('match-docket-aliases')` from `html-causelist-parse/index.ts:1643-1645` (Phase 4, after HTML rows inserted). Only updates rows still `matched_profile_id IS NULL` (`:377`) — a second-chance matcher for what #1 missed. So on the HTML path, #1 (per-row) then #4 (cleanup) both run.
- **Technique:** 4-tier token matcher with a **first-name gate**. `normalizeName` strips all non-word chars (`:27`). Tiers: exact normalized equality → 0.95 (`:65-68`); **first-name gate** `aliasWords[0]` must be a token in the lawyer name else reject (`:80-86`); all words consecutive → 0.95 (`:92-119`); all words present non-consecutive → 0.85 (`:123-130`); substring `includes` → 0.80 (`:133-136`). Splits multi-lawyer fields on `, ; AND &` (`:32-38`).
- **Confidence:** 0.95/0.85/0.80, but writes `match_method='alias_exact'` for **all** tiers (`:373`) and **never sets `needs_review`**.
- **Failure modes:** first-name gate **over-rejects initials** — alias `"R PUROHIT"` vs `"RAMESH PUROHIT"` → `"R" !== "RAMESH"` → rejected (common Indian abbreviation, false negative). Tier-4 substring re-introduces containment (lower risk, gated by first-name). `splitLawyerNames` doesn't split on `/` or newlines.

### IMPL #5 — edge fn `scan-lawyer-names` `isLawyerNameMatch` — block-selector, not a docket matcher
- **Where:** `scan-lawyer-names/index.ts:162-238`. **Trigger:** PDF ingestion (`download-causelists:134`, `html-extract:101`, `pdf-extract-chunk:217`), on raw text before any docket row exists.
- **Technique:** boolean context regex; skips aliases < 4 chars (`:167`) and a blacklist (`:173`); on match enqueues an `ai_jobs` row (`:511-553`) — **never writes `matched_profile_id`**. Orthogonal to docket matching (it only gates which blocks the AI reads).
- **Failure modes:** pattern 5 (`:224-234`) matches an alias on any line merely containing "advocate"/"counsel" (broad false positives); 4-char floor drops short surnames.

### IMPL #6 — client `normalizeLawyerName()` — write-time input shaper
- **Where:** `src/lib/lawyerNameUtils.ts:54-69`, used at `useAliases.ts:37`. **Trigger:** user adds an alias. Not a matcher, but it decides the stored alias form (uppercased, prefix-stripped). Its prefix list (`:7-33`) is a near-duplicate of — but **not identical to** — the SQL `normalize_lawyer_name` list. Drift between the two silently weakens #1's exact substring.

### What actually runs in production
- **Normal docket INSERT (PDF-scrape path): only IMPL #1 runs** — the sole surviving INSERT-time matcher after production_fix dropped all pg_net trigger variants and recreated exactly one. It is the loosest, least safe matcher of the six.
- **HTML path:** IMPL #1 per-row, then IMPL #4 as a `matched_profile_id IS NULL` cleanup pass.
- **New-alias event:** IMPL #3 (on `lawyer_aliases` insert).
- **#2 orphaned; #5 block-selection only; #6 at alias write-time.**

### Most-correct to canonicalize
**IMPL #4 (`match-docket-aliases/matchSingleLawyer`, `match-docket-aliases/index.ts:42-140`)** — with one fix. It's the only tokenized, word-boundary-aware matcher (avoids #1's `"RAVI"→"RAVINDRA"` bug), has a graded confidence scale review logic can use, splits multi-lawyer fields, and has a real first-name precision gate against same-surname collisions. **The required fix:** relax the first-name gate to accept single-initial equivalence (`"R" ≡ "RAMESH"`), since Indian cause-lists routinely abbreviate first names — that gate is its main false-negative source versus #2's Jaro-Winkler tolerance. Honest caveat: #4 currently writes a flat `match_method='alias_exact'` and never sets `needs_review`, so its confidence tiers are computed but thrown away downstream — the rebuild must actually consume them.

---

## 5. FILTERING / SCOPING

**The filter column is `matched_profile_id`** on `daily_court_docket` (`20251203133923_...sql:30`).
- `useDocket.ts:33` filters `.eq('matched_profile_id', user.id)` (comment: "frontend filter is primary defense," RLS secondary, `:27-28`).
- `useDualStreamDocket.ts`: `usePersonalDocket` filters `matched_profile_id=user.id AND case_context='personal'` (`:45-46`); `useChamberDocket` filters `case_context='chamber' AND chamber_id IN (owned ∪ member chambers)` (`:69-73,84-85`).

**Chamber/team roll-up — built but not populated (HONEST CORRECTION TO YOUR BRIEF):**
- The model exists: `case_context` enum `('personal','chamber')` default `'personal'` + `chamber_id → chambers` (`20260110080233_...sql:49-60`); SQL `can_view_chamber_cases(user, chamber)` returns true for the chamber owner or an active `chamber_memberships` row (`:78-100`); the production RLS SELECT policy includes the chamber branch (`20260518000000_production_fix.sql:180-199`); the hooks and a `DocketCard` chamber badge (`DocketCard.tsx:214`) all consume it.
- **But nothing sets it.** Grep across `supabase/functions` for `case_context|chamber_id` hits only `create-intern-account` (unrelated); no parser/matcher/trigger assigns chamber context, and `auto_match_on_insert()` sets only the match fields (`20260110124734_...sql:66-70`). So **every auto-matched/parser-inserted row stays `case_context='personal'`**, and `useChamberDocket` would return nothing. A `validate_case_context()` trigger even **forbids** migrating a row personal→chamber (`20260113124859_...sql:151-153`). Net: roll-up is scaffolding with no writer in this repo — there is no working "senior sees juniors' listings" path today. Scoping in practice is **individual-advocate only**, by `matched_profile_id`.

---

## 6. FALSE-MATCH HANDLING

**Columns** (`20251229154949_...sql:1-17`): `matched_role` (CHECK petitioner/respondent), `match_method` (**CHECK only `('exact','fuzzy')`**), `match_confidence decimal(4,3)`, `needs_review bool default false` + partial index where true. The auditability trigger `enforce_match_method_on_profile()` requires `match_method` non-null whenever `matched_profile_id` is set (`20260109205256_...sql:5-15`).
- **Latent inconsistency (flagged, not fully resolved):** the `check_match_method` constraint allows only `'exact'/'fuzzy'`, yet matchers write `'auto_match'`, `'alias_exact'`, `'court_scan_manual'`, and `enforce_lawyer_ownership_updates()` expects `('auto_match','system_backfill','trigger_match')` (`20260113124859_...sql:90`). No migration relaxing/dropping `check_match_method` was found in the repo. Either the CHECK was dropped outside these migrations or inserts would violate it — **worth verifying against the live DB**; I could not resolve it from the migrations alone.

**Confidence by matcher:** #1 hardcodes 0.95, no `needs_review`; #4 writes 0.80–0.95, no `needs_review`; #2/#3 set `needs_review = confidence < 0.95`.

**Human-in-the-loop:** the **only** human attribution step is onboarding self-claim — `CourtScan.tsx:162-173` writes `matched_profile_id=user.id, match_method='court_scan_manual', match_confidence:0.9, needs_review:true` after alias verification (`:134-150`). **There is no `needs_review` consumer anywhere on the dashboard** (grep finds only generated types + that one CourtScan write). **There is no claim / reject / unclaim / "this isn't my case" UI** — `DocketCard.tsx` only *displays* chamber/role badges (`:214-224`); no match-correction control exists.

**Silent mis-attribution paths:**
1. **`auto_match_on_insert()` (primary production path)** — `ILIKE '%alias%'` substring, longest alias, hardcoded 0.95, sets `matched_profile_id` with no `needs_review`, no human check (`20260110124734_...sql:32-71`). A short alias embedded in a different longer name attaches silently.
2. **`match-docket-aliases`** — writes `matched_profile_id` for matches as low as 0.80 with **no `needs_review`** (`:368-377`); appears as confirmed.
3. **`auto-match-aliases`/`backfill-alias-matches`** — set `needs_review` when < 0.95, but since **no UI reads it**, even flagged matches display silently as the user's cases.

Idempotency guard (prevents *overwrite*, not initial wrong attribution): edge matchers update `.is('matched_profile_id', null)` and the trigger early-returns if already matched (`match-docket-aliases:377`, `backfill-alias-matches:273`, `20260110124734_...sql:19-21`).

---

## 7. WHAT TO CARRY FORWARD

**Extract (close to verbatim):**
- **`match-docket-aliases/matchSingleLawyer` (`:42-140`)** as the canonical matcher *algorithm* — tokenized, word-boundary, graded confidence, field-splitting, first-name gate. Fix before reuse: (a) accept single-initial equivalence in the first-name gate; (b) actually persist and consume the graded confidence + a `needs_review` flag.
- **`splitLawyerNames` (`match-docket-aliases:32-38`)** — but extend the delimiter set to include `/` and newlines.
- **The `-P`/`-R` (and `(P)`/`(R)`) suffix convention** as the role-marker contract — it's consistent across every parser and is real signal worth keeping.
- **`lawyerNameUtils.generateAliasVariations` (`:112-146`)** — the initials/surname variant generation is useful for building an alias set, if collapsed onto one shared normalizer.
- The **HTML deterministic parser's column logic** (`html-causelist-parse`) is the most reliable *extraction* path (no AI variance) and worth keeping as the preferred ingestion route where HTML is available.

**Discard / do not carry:**
- **`auto_match_on_insert()` SQL trigger (IMPL #1)** — the unanchored `ILIKE '%alias%'` substring matcher. It is the live production matcher and it is the single biggest source of silent wrong matches. Do not reuse the technique.
- **`auto-match-aliases` (IMPL #2)** and **`parse-case`/`parse-all-cases`** parsers — orphaned/dead; keep only the prompt wording if useful.
- **The three divergent normalizers** (client `lawyerNameUtils`, server `match-docket-aliases.normalizeName`, SQL `normalize_lawyer_name`) — collapse into **one** shared normalizer (decide case, honorific list, punctuation, initials handling once).
- **`scan-lawyer-names.isLawyerNameMatch`** as a *matcher* — it's only a block-selector; its broad line-level patterns shouldn't inform identity matching.

**What the rebuild must do differently for a reliable chamber-scoped model:**
1. **One normalizer, one matcher.** A single canonical normalize + a single tokenized, initial-aware, word-boundary matcher with a real graded confidence — not six implementations across SQL/edge/client.
2. **Persist confidence and route low-confidence to a review queue.** Today `needs_review` is written by some matchers but **read by nothing**. The clerk-confirmation step you want requires a UI that actually consumes `needs_review`/confidence and offers confirm/reject/unclaim (none exists).
3. **Make chamber roll-up real.** The schema/RLS/hooks exist but **no code sets `case_context='chamber'`/`chamber_id`** — and a trigger forbids personal→chamber migration. The rebuild must, at match time, decide chamber vs personal and populate `chamber_id` so the chamber stream is non-empty. Model: register a chamber's advocates + aliases once; match the full daily ingest against the union of all chamber members' aliases; tag the row with both the matched advocate and their chamber; let a clerk confirm anything below the confidence threshold.
4. **Match against an alias set, not a single name, and against all chamber members at once** — the current per-field, per-profile loop (`match-docket-aliases` is O(cases×profiles×aliases) with per-row awaits) won't scale to a whole-chamber daily filter; design the canonical matcher to take the chamber's full alias index in one pass.
5. **Keep `-P/-R` extraction and the HTML deterministic path; treat AI parsing as a fallback** for PDF-only lists, since AI parsing introduces variance the deterministic HTML path doesn't.

**Things in the brief that don't exist as implied:** there is no working chamber roll-up (no writer), no `needs_review`/confirmation UI, and no claim/reject/unclaim flow — the only human confirmation is the one-time onboarding self-claim in `CourtScan.tsx`.
