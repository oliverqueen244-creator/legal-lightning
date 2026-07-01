# NyayHub Completion & Launch Audit
**Date:** 2026-06-25  
**Auditor:** Read-only pass; no code modified  
**Codebase:** 38 edge functions, 112 migrations, 196 components, 80+ hooks  
**Project ref:** pwpnnixoscppfzjogcgj  

---

## 1. SHIP-BLOCKERS

> Must be fixed before any paying user touches the system.

---

### 1a. Billing does not exist

**Files:**
- `src/hooks/useSubscription.ts:47-52`
- `supabase/migrations/20251229182944_f2dbf775*.sql:55-68`
- `src/components/admin/OperationsConsole.tsx` (subscription tab — placeholder text)

**What is broken:**

`upgradeToPro()` (line 47) and `cancelSubscription()` (line 52) in `useSubscription.ts` are both literal `console.log` stubs. Neither makes an API call, triggers a redirect, nor modifies database state:

```ts
upgradeToPro: () => {
  console.log('Stripe integration pending - upgrade to pro');
},
cancelSubscription: () => {
  console.log('Stripe integration pending - cancel subscription');
},
```

The `subscriptions` table (`20251229182944*.sql:55-68`) exists with correct schema (`stripe_customer_id`, `stripe_subscription_id`, `plan_type`, `status`), and `has_active_subscription()` SQL function exists (`20251229182944*.sql:162-176`), but neither is wired to any payment processor.

**Second bug compounding this:** `useSubscription.ts:36` checks `plan_type === 'pro'` to derive `isPro`. The database `CHECK` constraint on `subscriptions.plan_type` allows `'free' | 'individual' | 'chamber'` — `'pro'` is not a valid value. `isPro` is therefore **permanently false** regardless of database state. Even manual DB updates cannot make the pro gate work.

No Razorpay edge function, no webhook handler, no redirect to any payment URL exists anywhere in the codebase.

**Why it blocks launch:** The product has no revenue mechanism. Users cannot pay.

**What Razorpay wiring takes:**
1. Fix `plan_type` CHECK to include `'pro'` OR change `isPro` to check `plan_type === 'individual'` — 30 min.
2. Create `supabase/functions/create-razorpay-subscription/index.ts` — creates a Razorpay subscription order, returns payment link. ~1 day.
3. Create `supabase/functions/razorpay-webhook/index.ts` — verifies HMAC-SHA256 signature with `RAZORPAY_WEBHOOK_SECRET`, updates `subscriptions` table on `subscription.activated` / `subscription.charged` / `subscription.cancelled` events. ~1 day.
4. Update `upgradeToPro()` to call `create-razorpay-subscription` and redirect to Razorpay checkout URL. ~2 hours.
5. Update `cancelSubscription()` to call Razorpay API and update local record. ~2 hours.
6. **External gate:** Razorpay KYC approval for subscription payments takes 3–14 business days. Start immediately — it's the longest pole.

---

### 1b. Fake-AI surfaces presenting hardcoded text as real AI

**Four confirmed fake-AI surfaces:**

#### Surface 1: AiStrategyPanel
**File:** `src/components/morning-brief/AiStrategyPanel.tsx:25-51`

`handleGenerate()` fires a `setTimeout(..., 2000)` that injects 100% hardcoded strategy content into state. The spinner reads "Running Litigation OS Neural Engine..." while waiting. Output includes hardcoded text about "jurisdictional primacy," "Limitation vs. Substantial Justice doctrine," and "Missing Rejoinder for the 3rd respondent" — content that has nothing to do with the actual case passed in. Every user gets identical strategy regardless of their case.

No AI call is made. No edge function is invoked.

```ts
// AiStrategyPanel.tsx:26-52
const handleGenerate = () => {
    setIsGenerating(true);
    // Simulate AI generation
    setTimeout(() => {
        setStrategy({
            summary: `Strategic overview for ${caseNumber}...`,
            points: [
                { title: "Core Objective", content: "Establish jurisdictional primacy..." },
                { title: "Defense Strategy", content: "Anticipate questions regarding delay..." },
                { title: "Critical Risks", content: "Missing Rejoinder for the 3rd respondent..." }
            ],
            conclusion: "Recommendation: Strongly push for an interim stay..."
        });
        setIsGenerating(false);
    }, 2000);
};
```

#### Surface 2: SmartPdfViewer "AI Summary"
**File:** `src/components/war-room/SmartPdfViewer.tsx:131-139`

`handleSummarize()` fires a `setTimeout(..., 2500)` that injects a hardcoded summary about "a Writ Petition seeking quashing of FIR under Section 482 CrPC" and cites "State of Haryana v. Bhajan Lal." This same text appears for every PDF regardless of content. The button is labeled "AI Summary."

```ts
// SmartPdfViewer.tsx:131-139
const handleSummarize = async () => {
    if (isSummarizing) return;
    setIsSummarizing(true);
    // Simulate AI Summarization
    setTimeout(() => {
      setSummary("This document appears to be a Writ Petition seeking the quashing of a FIR under Section 482 CrPC...");
      setIsSummarizing(false);
    }, 2500);
};
```

#### Surface 3: AIInsightPanel "Points of Law"
**File:** `src/components/war-room/AIInsightPanel.tsx:86-98`

The "Points of Law" section is static JSX with two hardcoded list items:
- "Section 482 CrPC - Inherent Powers"  
- "Article 226 - Writ Jurisdiction"

These appear for every case, derived from nothing. No hook, no API call.

#### Surface 4: useAIIntelligence.summarizeCase — no handler at destination
**File:** `src/hooks/useAIIntelligence.ts:9-29`

This is the only hook that makes a real edge function call, invoking `ai-worker` with `action: 'summarize_case'`. However, `ai-worker` has **no handler for `action: 'summarize_case'`**. A grep over the full 791-line `supabase/functions/ai-worker/index.ts` returns zero matches. The worker only handles causelist parsing jobs claimed from the `ai_jobs` table. The call will receive some response but `data.summary` will be `undefined`; the `toast.success('AI Summary Generated')` fires against undefined data.

This is called from `AIInsightPanel` via the "Analyze PDF" button.

**Real AI that works and can be wired to these surfaces:**
- `ai-worker`: Multi-provider (Gemini 2.0 Flash → GPT-4o-mini → OpenRouter) — functional, handles causelist parsing
- `search-indian-kanoon`: Functional precedent search — wired in `useAIIntelligence.findPrecedents()` but the search button in `AIInsightPanel.tsx:79` has no `onClick` handler

**Fix for each surface:**
- `AiStrategyPanel`: Wire to a Gemini/GPT-4o-mini call with case data and judge history context. A direct edge function or ai-worker action is appropriate.
- `SmartPdfViewer`: Wire to `pdf-extract-chunk` → `ai-worker` with `summarize_document` action (add handler).
- `AIInsightPanel Points of Law`: Either derive from AI over case documents, or remove until implemented.
- `useAIIntelligence.summarizeCase`: Add a `summarize_case` action handler in `ai-worker`, or redirect to a dedicated edge function.

---

### 1c. escalate-whatsapp returns `status:'sent'` while sending nothing

**File:** `supabase/functions/escalate-whatsapp/index.ts:62-112`

Lines 68-71 are unambiguous:
```ts
// TODO: Integrate with actual WhatsApp API (Twilio, WhatsApp Business API, etc.)
// For now, we'll simulate the send and log the escalation
console.log(`[Escalate] Would send WhatsApp to ${phoneNumber}:`);
console.log(whatsappMessage);
```

The function then writes `status: 'sent'` to `notification_escalations` (line 80) and returns `success: true` (line 108). The user's case-running alerts are silently dropped.

**Fix scope:**
1. Choose a provider: WhatsApp Cloud API (Meta) is free per conversation but requires Business Manager approval (1–4 weeks); WATI or Interakt are resellers with faster onboarding for Indian market (~3-7 days).
2. Add `WHATSAPP_API_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` as env vars.
3. Replace the TODO block with a `fetch` to `https://graph.facebook.com/v18.0/{phone_number_id}/messages`.
4. Only write `status: 'sent'` after HTTP 200 from the API; write `status: 'failed'` on error.
5. **External gate:** WhatsApp Business API approval is the blocker; development is ~4 hours once approved.

---

### 1d. eCourts retrieval broken by session/cookie mismatch

**Files:**
- `supabase/functions/check-case-judgment/index.ts` (stateless fetch)
- `supabase/functions/sync-case-documents/index.ts` (stateless fetch)
- `supabase/functions/fetch-case-orders/index.ts` (stateless fetch)
- `supabase/functions/admin-doc-sync-trial/index.ts` (proves the problem)

**What is broken:**

`check-case-judgment` and `sync-case-documents` use stateless `fetch()` calls. The eCourts flow requires:
1. Load page → receive `PHPSESSID` cookie + CAPTCHA image (session-bound)
2. Send CAPTCHA image to 2Captcha service (~30-90 seconds to solve)
3. Submit form with CAPTCHA solution using the **same session cookie**

Steps 1 and 3 are made with separate fetch calls. No cookie jar is maintained between them. By the time the CAPTCHA is solved, the session from step 1 has either been reused or the server has invalidated the association.

`admin-doc-sync-trial` explicitly documents this: it is a "SESSION CONTINUITY VERSION" and proves (Phase 3) that submitting a CAPTCHA solution in a new session fails. The comment in `admin-doc-sync-trial.ts:1-20` describes exactly the needed flow: single Browserless/Puppeteer session throughout.

`scrape-causelist/index.ts:641` also unconditionally falls back to Firecrawl for PDF access because Browserless session management is incomplete (the Browserless `/content` call at line 573 runs but the return value is HTML, not the evaluated JS result, so it falls back and returns empty).

**Fix scope:**
- Replace stateless fetch flows in `check-case-judgment` and `sync-case-documents` with a Browserless persistent Puppeteer session (the pattern is already proven in `admin-doc-sync-trial`)
- Requires `BROWSERLESS_API_KEY` (already in env vars)
- Effort: 2-3 days to port the `admin-doc-sync-trial` pattern into each function
- Cost per CAPTCHA: ~$0.003 (2Captcha) + ~$0.01-0.05 (Browserless per session)
- **Note:** `fetch-case-orders` has no CAPTCHA solve logic at all — it marks jobs `manual_required` immediately

---

### 1e. scrape-causelist case extraction stubbed — always returns zero cases

**File:** `supabase/functions/scrape-causelist/index.ts:550-665`

The `scrapePdfWithSession()` function (line 550) is the entry point for extracting cases from cause list PDFs. It tries Browserless first, but the Browserless call (lines 568-628) gets HTML back from `/content`, fails to parse the JS evaluation result, and falls through at line 641:

```ts
// scrape-causelist/index.ts:638-645
// For now, let's fall back to Firecrawl with better error handling
return await scrapePdfWithFirecrawl(baseUrl, courtNo, listType, ...);
```

`scrapePdfWithFirecrawl()` (line 649) is documented to return empty:
```ts
// scrape-causelist/index.ts:660-665
// The HC website requires JavaScript-based navigation that Firecrawl can't fully handle
// The D/S buttons use javascript:void(0) which triggers page JS
// Return empty - court metadata is already saved from the initial scrape
return [];
```

The comment at line 269-272 confirms this is known: "the PDF scraping will use a session-based approach" — but that approach is not implemented.

**Result:** The cron job running at 07:00 IST (via `20260518000003_daily_cron_jobs.sql`) successfully scrapes court metadata (judge names, court numbers) into `court_metadata` table but inserts **zero cases** into `daily_court_docket`. The daily scheduled pipeline is a no-op for actual case data.

**The only working ingestion path is Telegram.** A Telegram bot must be a member of a channel that forwards the HC cause list PDFs. `telegram-webhook` then processes them through `download-causelists` → AI parsing → `daily_court_docket`.

**Fix scope:** Implement `scrapePdfWithSession()` using the Browserless `/function` endpoint with a full Puppeteer script that: (1) navigates to the quick download page, (2) submits the date form, (3) clicks D/S link for each court, (4) extracts the PDF, (5) runs AI extraction. Estimated 3-5 days. Alternatively, document Telegram as the official ingestion path and remove the dead Firecrawl fallback.

---

## 2. SECURITY HARDENING

> Must fix before real user data is stored.

---

### 2a. Hardcoded anon JWT and project ref committed to git history

**Files:**
- `supabase/migrations/20251205073059_83f3c539*.sql:70`
- `supabase/migrations/20251205073111_3352141b*.sql:7`
- `supabase/migrations/20251218092302_4ffb3356*.sql:17`
- `supabase/migrations/20251229160445_06a69628*.sql:30`

**What is committed:**
```
Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3cG5uaXhvc2NwcGZ6am9nY2dqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NTY5NzAsImV4cCI6MjA4MDMzMjk3MH0.DzT7tDz74hGo3WMHO2EACM2GkqrdXns1I3OXwHsTrRc
Project URL: https://pwpnnixoscppfzjogcgj.supabase.co
```

This is the Supabase **anon** (public) key — less dangerous than service_role, but: (1) it is in git history permanently, (2) it exposes the project reference ID, (3) it allows any caller to invoke the 12 `verify_jwt = false` edge functions with a valid-looking JWT header, (4) the `x-trigger-secret` in those functions is the only real guard, and that secret's value is not confirmed rotated.

Later migrations correctly moved to `current_setting('app.settings.supabase_anon_key')` (see `20260103111010*.sql:69`), making the hardcoded values dead. But they remain in git history.

**Risk:** If this repository is or becomes public, the project URL and anon key are exposed. Anon key enables calling any `verify_jwt = false` edge function, making the Telegram webhook injection attack (see 2b) easier.

**Fix:** 
1. Rotate the anon key from the Supabase dashboard (Settings → API → Regenerate)
2. Update `app.settings.supabase_anon_key` in the database
3. Update any VITE_ env vars in deployments
4. The hardcoded migrations cannot be rewritten (they've already run) but will no longer work after rotation
5. Flag for rotation: also audit `TRIGGER_SECRET` — its value is not in the repo but confirm it has been set and is sufficiently random

---

### 2b. telegram-webhook absent-header bypass

**File:** `supabase/functions/telegram-webhook/index.ts:87-107`

When no `x-telegram-bot-api-secret-token` header is present, the code logs a warning and **continues processing the request**:

```ts
// telegram-webhook/index.ts:102-106
} else if (!telegramSecretToken) {
    // Allow requests without secret header for backwards compatibility
    // but log a warning - webhook should be reconfigured with secret_token
    console.warn('[TELEGRAM] Warning: No webhook secret token in request...');
}
// Execution continues — request is processed
```

Any unauthenticated HTTP client can POST to the webhook URL without a secret token and inject fake Telegram updates: fake PDF documents, fake causelist data, fake status messages.

**Risk:** Attacker can inject arbitrary PDF file IDs into the download pipeline, flood the parsing queue with garbage, or trigger malformed data insertion into `daily_court_docket`.

**Fix:**
```ts
} else if (!telegramSecretToken) {
    return new Response(
        JSON.stringify({ ok: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
}
```
One line change in `telegram-webhook/index.ts:102`. The "backwards compatibility" comment has no justification — the webhook was registered with `secret_token` set to the bot token (line 116 of the setup action), so real Telegram always sends the header.

---

### 2c. profiles table world-readable by any authenticated user

**File:** `supabase/migrations/20251203133923_645b33df*.sql:15`

The founding migration creates:
```sql
create policy "Users can view all profiles" on public.profiles for select using (true);
```

This allows any authenticated (and via anon key: any unauthenticated) user to read the full `profiles` table, including:
- `whatsapp_number` (personally identifiable, used for WhatsApp escalation)
- `bar_registration_number`
- `full_name`
- `role` (SENIOR/JUNIOR/CLERK)
- `bench` preference
- `bci_verification_status`

With 112 migrations, no subsequent migration drops and replaces this policy with a scoped one. The `profiles` table is exposed.

**Risk:** Any signed-in user (or attacker using the hardcoded anon key) can `SELECT * FROM profiles` and extract all advocate data. With real paying users' data, this is a DPDP Act exposure.

**Fix:**
```sql
DROP POLICY "Users can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Chamber members can view co-member profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chamber_members cm
      WHERE cm.profile_id = profiles.id
        AND cm.chamber_id IN (
          SELECT chamber_id FROM chamber_members WHERE profile_id = auth.uid()
        )
    )
  );
```

---

### 2d. court_overrides write policies use `WITH CHECK(true)` / `USING(true)` for all authenticated users

**File:** `supabase/migrations/20251229151059_ffa0b08b*.sql:27-39`

```sql
CREATE POLICY "Service role can insert court overrides"
  ON public.court_overrides FOR INSERT WITH CHECK (true);  -- line 33

CREATE POLICY "Service role can update court overrides"  
  ON public.court_overrides FOR UPDATE USING (true);  -- line 39
```

Despite being named "Service role," these policies have no `TO service_role` clause and apply to all roles (service_role already bypasses RLS anyway). Any authenticated user can insert or update court overrides, including fake judge substitutions.

The production_fix migration (`20260518000000*.sql:165`) drops similar policies on `ai_jobs` and `raw_causelists`, but **does NOT drop these court_overrides policies**.

**Risk:** Any user can create a fake court override saying "Court 1 items 1-50 are now heard by Hon'ble Justice X" for any date, corrupting the court display for all users of that bench.

**Fix:**
```sql
DROP POLICY "Service role can insert court overrides" ON public.court_overrides;
DROP POLICY "Service role can update court overrides" ON public.court_overrides;
-- Service role bypasses RLS automatically; no replacement needed
-- Or if authenticated users genuinely need to insert (they shouldn't):
-- CREATE POLICY "Admin can manage court overrides" ON public.court_overrides
--   FOR ALL USING (public.has_role(auth.uid(), 'ADMIN'));
```

---

### 2e. causelist-pdfs bucket was public; verify migration order

**Files:**
- `supabase/migrations/20251205124413_dea34d83*.sql:3` — Created with `public = true`
- `supabase/migrations/20260518000001_private_causelist_bucket.sql:10` — Sets `public = false`

Migration `20260518000001` correctly makes the bucket private. As long as migrations run in timestamp order (they do via Supabase CLI), the bucket is currently private. Verify in Supabase dashboard → Storage → Buckets that `causelist-pdfs` shows "Private." If somehow the migration didn't run, PDFs are publicly accessible by URL.

**Fix:** Confirm via Supabase dashboard. If public, run `20260518000001` manually. Status is likely correct.

---

### 2f. create-intern-account: verify_jwt = false with weak password generation

**File:** `supabase/functions/create-intern-account/index.ts:237-249`  
**Config:** `supabase/config.toml:81-83`

`verify_jwt = false` is compensated by manual JWT validation via `supabaseAuth.auth.getUser()` — this part is correct.

However, `generateTempPassword()` creates passwords from a 24-word vocabulary × 24 words × 90 digit suffixes:
```ts
const words = [
    'court', 'judge', 'case', 'brief', 'trial', 'bench', 'legal', 'draft',
    'order', 'writ', 'plea', 'suit', 'jury', 'bail', 'bond', 'deed',
    'claim', 'file', 'rule', 'oath', 'seal', 'term', 'ward', 'will'
];
// Result: "CourtJudge42" format — 24×24×90 = 51,840 total combinations
```

An attacker who knows an intern's email (trivially discoverable from court appearances, firm websites, or LinkedIn) can exhaust the 51,840 combinations via Supabase auth in minutes.

**Fix:** Replace with `crypto.randomUUID()` or send a magic link via Supabase `auth.admin.generateLink()` instead of a password. The temp password is already shown once to the supervisor and meant to be changed — use a magic link instead and remove the password entirely.

---

### 2g. raw_causelists and case_parse_queue: `FOR ALL USING(true) WITH CHECK(true)` for "service role"

**File:** `supabase/migrations/20251219133209_d603fe19*.sql:89-101`

```sql
CREATE POLICY "Service role can manage queue"
ON public.case_parse_queue FOR ALL
USING (true)
WITH CHECK (true);
```

No `TO service_role` or `TO authenticated` clause — applies to all roles. Any authenticated user can delete, update, or truncate the case parse queue. The production_fix drops some similar policies but **not this one**.

**Risk:** A malicious or buggy client can clear the entire parsing queue, causing all pending causelist parsing to be lost.

**Fix:** Drop the policy. Service role bypasses RLS. If other roles need specific access, add scoped policies.

---

### 2h. Multiple edge functions with `verify_jwt = false` and no in-code auth

From `supabase/config.toml`, the following run with `verify_jwt = false` and have no `x-trigger-secret` or in-code JWT check:
- `scrape-causelist` — triggers court scraping (rate-limited by operation but callable by anyone)
- `ai-worker` — processes AI jobs (limited by job queue but can be called to check budget)
- `parse-case`, `parse-all-cases` — AI parsing (callable by anyone, charges tokens)
- `html-extract`, `html-causelist-parse` — HTTP fetch proxies
- `search-indian-kanoon` — billable Indian Kanoon API calls
- `scan-lawyer-names` — reads causelist text
- `aggregate-case-durations` — writes to court_avg_duration

The ones that consume paid external API credits (`ai-worker`, `parse-case`, `search-indian-kanoon`) are reachable by anyone with the endpoint URL. No rate limiting at the function level for unauthenticated callers.

**Risk:** Cost amplification attack — someone calls `ai-worker` or `search-indian-kanoon` in a loop to exhaust API credits.

**Fix (prioritized):** Add `x-trigger-secret` validation to `ai-worker`, `parse-case`, and `search-indian-kanoon`. These are backend-only functions and should never be called directly from the browser; they're invoked by cron or other edge functions. Alternatively add IP rate limiting at Supabase Edge level.

---

## 3. DEAD CODE & ARCHITECTURAL DEBT

---

### 3a. Three overlapping AI/parsing pipelines

**Files:**
- `supabase/functions/ai-worker/index.ts` — async job queue, Gemini→GPT-4o-mini→OpenRouter chain
- `supabase/functions/parse-case/index.ts` — direct synchronous AI call, lawyer-centric, with cache
- `supabase/functions/parse-all-cases/index.ts` — bulk OpenAI-only parser, no lawyer filtering

All three parse text from causelists into `daily_court_docket` rows, but via different mechanisms. The production architecture uses `ai-worker` (via job queue claims from `ai_jobs` table). `parse-case` is invoked from the Telegram path for per-lawyer processing with caching. `parse-all-cases` duplicates GPT-4o-mini calls without the provider fallback chain or caching.

**Recommendation:**
- Keep `ai-worker` as canonical async path for background batch processing
- Keep `parse-case` for lawyer-specific on-demand parsing (the caching is valuable)
- **Delete `parse-all-cases`** unless it's actively triggered; it duplicates `ai-worker` without the reliability features (retry, fallback, cache, token budget)

---

### 3b. Three inconsistent alias-matching engines

**Files:**
- `src/lib/lawyerNameUtils.ts:54-69` — Frontend, `normalizeLawyerName()`, JS/TS
- `supabase/functions/auto-match-aliases/index.ts:39-46` — Edge function, `normalize()`, Deno/TS
- `supabase/migrations/20260518000000*.sql:205-233` — Database, `normalize_lawyer_name()`, PL/pgSQL

Each strips prefixes and normalizes whitespace but with slightly different regex implementations. The DB version (production_fix) also escapes SQL wildcards. The three implementations can produce different canonical forms for the same name, causing matches in one path to fail in another.

**Recommendation:**
- The canonical version is the DB `normalize_lawyer_name()` (production_fix, also the most correct — includes wildcard escaping)
- The edge function `auto-match-aliases` now calls the DB via RPC (post production_fix, triggers use in-DB auto_match_on_insert), so the edge function normalize() is vestigial
- The frontend `normalizeLawyerName` is for display only — acceptable to keep, but document that it is display-only
- **Action:** Add a comment to `auto-match-aliases/index.ts` that its `normalize()` function is no longer the canonical path; matching is now done by `trg_auto_match_before_insert` via `auto_match_on_insert()` SQL function

---

### 3c. Unused fallbackController / parserFallback.ts

**File:** `src/lib/parserFallback.ts`

Exports `shouldTriggerFallback()`, `FallbackResult`, `FallbackLevel`, `FallbackTriggerCondition`, and related utilities. A grep across the entire `src/` directory finds **zero imports** of this file — it is never called.

The module appears designed as a "self-healing parser" that would activate when confidence scores drop, but it was never wired into any parsing flow.

**Recommendation:** **Delete** `src/lib/parserFallback.ts`. The production parsing pipeline uses `ai-worker` with exponential backoff retries and multi-provider fallback, which is the real resilience mechanism.

---

### 3d. sentryStub no-op

**File:** `src/lib/sentryStub.ts`  
**Caller:** `src/main.tsx:8`

`initSentry()` logs a dev-console notice if `VITE_SENTRY_DSN` is set, then does nothing. `@sentry/react` is not installed. Production errors go to `admin_error_events` via `reportError()` in edge functions, but frontend runtime errors (React component crashes, hook failures) are only caught by `ErrorBoundary` and not reported anywhere permanently.

**Recommendation:** Either wire Sentry (install `@sentry/react`, add user consent step per the comments in `sentryStub.ts:16`, then swap out the stub) or remove the stub entirely and add a note that frontend errors are handled by `ErrorBoundary` + manual reporting.

---

### 3e. "Coming soon" stubs blocking real user value

**CourtFocusOverlay quick notes**  
`src/components/court-focus/CourtFocusOverlay.tsx:310-320`  
The "Note" button is permanently `disabled` with `title="Quick notes coming soon"`. The overlay is the primary in-court UI.

**CourtScan manual upload**  
`src/components/onboarding/CourtScan.tsx:218-222`  
`handleManualUpload()` shows `toast.info('Manual upload feature coming soon')`. An advocate who can't find their cases via the scan has no alternative path.

**AnnotationToolbar pen and eraser — buttons work, functionality doesn't**  
`src/components/war-room/AnnotationToolbar.tsx:46-58`  
Pen and Eraser tools are rendered and clickable — they update `activeTool` state. But `SmartPdfViewer.tsx:99-102` only handles the `'highlighter'` tool:
```ts
const handleTextSelection = useCallback(() => {
    if (activeTool !== 'highlighter' || !documentId) return;
    ...
}, [activeTool, documentId, currentPage, addAnnotation]);
```
Pen and eraser do nothing when selected. There is no canvas drawing layer. This is not a placeholder — the buttons appear fully functional to the user.

**Indian Kanoon search in AIInsightPanel — input rendered, search not wired**  
`src/components/war-room/AIInsightPanel.tsx:67-83`  
Search input and button exist. The button (line 79) has no `onClick`. There is no `onSubmit` on the containing `section`. `findPrecedents()` from `useAIIntelligence` is never called from this component.

**Recommendation for each:**
- Quick notes: 1-2 days to wire to `lawyer_case_notes` table (already exists in schema)
- Manual upload: 1 day to wire to `upload-causelist` edge function
- Pen/eraser: Either add a `<canvas>` drawing layer (~3 days) or remove the tools from the toolbar to avoid misleading users
- Indian Kanoon search: 2 hours to add `onClick={() => findPrecedents(searchQuery)}` to the button

---

## 4. COMPLETION PUNCH LIST

> Dependency-ordered. Assumes ~1.5 productive hours/day solo workstream.

---

### Week 1 — Ship-blockers + Security (Critical path)

| Task | Effort | External gate |
|------|--------|---------------|
| Fix `isPro` bug: change `plan_type === 'pro'` to `=== 'individual'` in `useSubscription.ts:36` | 30 min | None |
| Restrict profiles RLS (migration drop+replace) | 1 hr | None |
| Fix telegram-webhook absent-header bypass (one line) | 30 min | None |
| Drop court_overrides `WITH CHECK(true)` write policies | 1 hr | None |
| Fix intern temp password: replace with `crypto.randomUUID()` + magic link | 2 hrs | None |
| Add `x-trigger-secret` to ai-worker, parse-case, search-indian-kanoon | 3 hrs | None |
| Rotate hardcoded anon JWT (Supabase dashboard + update app.settings) | 1 hr | None |
| **Start Razorpay KYC application** | 1 hr | Razorpay approval: 3–14 business days |
| **Apply for WhatsApp Business API** (WATI or Meta direct) | 2 hrs | WhatsApp approval: 7–30 days |
| Build `create-razorpay-subscription` and `razorpay-webhook` edge functions | 2 days | Razorpay KYC (parallel) |
| Wire `upgradeToPro()` / `cancelSubscription()` in frontend | 4 hrs | After Razorpay functions |
| Drop `parse-all-cases` (dead code) | 1 hr | None |

---

### Week 2 — Data pipeline reliability + fake AI removal

| Task | Effort | External gate |
|------|--------|---------------|
| Wire WhatsApp Cloud API in `escalate-whatsapp` | 4 hrs | WhatsApp approval |
| Port `admin-doc-sync-trial` Browserless pattern to `check-case-judgment` | 2 days | Browserless account active |
| Port same to `sync-case-documents` | 1-2 days | |
| Fix `scrapePdfWithSession()` in `scrape-causelist` or remove + document Telegram-only path | 2-3 days | 2Captcha account + Browserless |
| Add `summarize_case` action handler in `ai-worker` or dedicated function | 1 day | |
| Replace `AiStrategyPanel` setTimeout with real Gemini call | 1 day | |
| Replace `SmartPdfViewer` AI Summary setTimeout with real pdf-extract → summarize call | 1 day | |
| Remove hardcoded Points of Law from `AIInsightPanel` (replace or delete) | 2 hrs | |
| Wire Indian Kanoon search button in `AIInsightPanel` | 2 hrs | |
| Delete `src/lib/parserFallback.ts` | 30 min | |

---

### Week 3+ — Polish and depth

| Task | Effort | Notes |
|------|--------|-------|
| Wire Sentry or remove stub | 4 hrs | Needs user consent step |
| Quick notes in CourtFocusOverlay | 1-2 days | |
| Manual upload in CourtScan | 1 day | |
| Pen/eraser annotation (canvas layer) | 2-3 days | Or remove from toolbar |
| Subscription enforcement (gate premium features behind `isPro`) | 2 days | After billing is live |
| Confirm causelist-pdfs bucket is private (Supabase dashboard check) | 30 min | |
| Admin subscription management tab (currently says "Not Implemented") | 1-2 days | After billing |
| Drop `Service role can manage queue` on `case_parse_queue` | 1 hr | |

---

## 5. DATA-PIPELINE RELIABILITY ASSESSMENT

**Core promise:** "Your cases and outcomes appear automatically."

**Honest end-to-end assessment for Rajasthan HC (both benches), today:**

| Layer | Status | Notes |
|-------|--------|-------|
| Court metadata (judge names, court numbers) | ~80% working | `scrape-causelist` cron fetches this successfully |
| Case listings appearing automatically (cron path) | **0%** | `scrapePdfWithFirecrawl()` returns `[]` — stubbed |
| Case listings appearing automatically (Telegram path) | **~70-80%** (if bot is subscribed to correct channel) | Depends on HC publishing to Telegram and channel forwarding |
| Case-to-profile matching | ~65-80% | AI-based, miss rate higher for uncommon name spellings |
| WhatsApp escalation when case is called | **0%** | Stub returns status:'sent' but sends nothing |
| Document sync / judgment status check | **0%** | Session cookie mismatch makes all eCourts form submissions fail |
| AI strategy / PDF summary | **0%** | Hardcoded fake responses |

**The single most fragile dependency:** The Telegram channel operator. The entire working ingestion path for case listings depends on someone forwarding HC cause list PDFs to a Telegram channel that the bot watches. This is:
1. Not automated (HC does not officially post to Telegram)
2. Not documented in the codebase (no channel ID, no verification that the channel exists)
3. Not recoverable if the channel goes dark

**Minimum reliable guarantee on day one:** If a Telegram channel exists for Rajasthan HC cause lists and the bot is confirmed subscribed, a paying user should see their cases appear in the docket each morning — with a ~15-30% miss rate from name-matching errors. They will not receive WhatsApp escalations. They cannot check judgment status. They cannot download court documents. The "daily brief" intelligence features are fake. About 25-30% of the product's stated value proposition is working.

---

## 6. LAUNCH-READINESS VERDICT

At 1.5 productive hours/day on a single workstream, reaching the first paying user requires approximately **35–45 working days** from today. The billing ship-blocker alone (Razorpay KYC + implementation) takes a minimum of 15 calendar days due to the KYC approval queue, which is almost entirely outside your control. WhatsApp Business API approval (if you want the escalation feature, which is a core promise) adds another parallel 7–30 day wait. The eCourts session fix and fake-AI remediation each require 2–5 days of focused coding.

The riskiest assumption in that estimate is that the Telegram-based ingestion pipeline is already operational with a channel that reliably receives Rajasthan HC cause list PDFs before 9 AM IST. If that channel does not exist or is informal/unofficial, the core data pipeline does not work at all, and the launch timeline becomes undefined — it depends on finding, joining, or operating a Telegram source of PDFs, which is partly a legal and relationship question (HC does not officially sanction this). A single properly set up Telegram channel that reliably forwards both benches' PDFs every working morning is the entire foundation on which a paying user's daily experience rests. If that assumption is wrong, nothing about the launch timeline estimate holds.
