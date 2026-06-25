# NyayHub — Complete Systems Comprehension

**Date:** 2026-06-25
**Purpose:** An accurate, code-sourced description of how NyayHub actually works today — every subsystem, route, table, edge function, trigger, and integration. This is *not* a bug audit; where code contradicts a name/comment or a feature is fake/broken, it is flagged factually so the description stays honest, not to recommend fixes.
**Method:** Full read of the router, 14 pages, ~80 hooks, 40 edge-function directories, 112 migrations (final RLS state), `config.toml`, `vite.config.ts`, and contexts. Citations are `file:line`. Where the implementation could not be found, it says so.

---

## 1. PRODUCT OVERVIEW

NyayHub (internal/legacy names "Vakalat-OS", "Litigation Operating System"; manifest name "Nyay-Hub", `vite.config.ts:18`) is a **connection-aware PWA for advocates practising at the Rajasthan High Court**, scoped to its two benches — **Jaipur and Jodhpur** (`profiles.bench CHECK IN ('JAIPUR','JODHPUR')`, migration `20251205072130:31`). The product's central promise, visible directly in the code, is *"your cases appear automatically"*: it ingests the High Court's daily and supplementary cause-lists (as Telegram-posted PDFs and admin uploads), parses them with AI/regex into a structured docket, matches each listed case to a lawyer by their registered name aliases, and serves a real-time per-lawyer docket with court-board tracking, document prep, and hearing-outcome capture.

It serves five role types (`user_roles.role` enum: `SENIOR, JUNIOR, CLERK, ADMIN, INTERN`, migration `20251203135431:4` + `20260114120026:14`):
- **SENIOR** — lead advocate; full case ownership, the War Room hearing-prep cockpit, document approval, intern supervision.
- **JUNIOR** — associate; task-oriented "Control Deck" for uploading documents and messaging the senior.
- **CLERK** — read-mostly, can be granted *scoped* delegated actions by a senior (`clerk_delegations`).
- **ADMIN** — operates the "Sovereign Console" (`/admin`).
- **INTERN** — time-boxed, sandboxed, case-scoped read + draft-only access under a supervisor.

**A real user's session, login to end (from the code):**
1. Lands on `/auth`, signs in with **email/password** (`useAuth.ts:155`). No OAuth/magic-link exists.
2. Auth redirect effect routes by `profiles.onboarding_completed`: incomplete → `/onboarding` (5-step wizard: consent → profile → name aliases → chamber → court sync, `Onboarding.tsx:217-237`); complete → `/` (`Auth.tsx:54-68`).
3. The **Dashboard** (`/`) is the home docket. A senior sees tabs Today/Cases/Urgent/Later/Find plus a Morning Brief and a draggable widget stack (live court board, wait-time estimator, ticker); a junior sees a Tasks tab (`Dashboard.tsx:277-573`). The docket list is populated from `daily_court_docket` filtered to the lawyer's matched cases (`useDocket.ts`).
4. Drilling into a case: a senior opens **War Room** `/war-room/:caseId` (arguments, documents, AI panel, PDF viewer, judge intelligence, whisper chat); a junior opens **Control Deck** `/control-deck/:caseId` (document upload + whisper-to-senior).
5. On hearing day the lawyer switches to **Courtroom Mode** `/courtroom` — a calm, read-only, high-contrast list of today's cases with live court-board proximity, designed for use while standing in court.
6. After the hearing, a **Post-Court Capture** panel records what happened (`post_court_notes`), which becomes institutional memory and feeds `case_hearings`.
7. Throughout, **court-board notifications** warn as the lawyer's item approaches being called; unacknowledged critical alerts are *meant* to escalate to WhatsApp (but do not actually send — see §9/§11).

The genuinely working spine is **cause-list ingestion via Telegram → AI parse → docket → alias match → realtime UI** (traced in §8). Several surrounding surfaces (billing, in-UI "AI" features, WhatsApp escalation, on-demand eCourts judgment/order retrieval) are stubbed, broken, or orphaned, and are described as such throughout.

---

## 2. AUTHENTICATION & USER MODEL

### Login / signup
- **Providers: email/password only.** Sign-in `supabase.auth.signInWithPassword` (`useAuth.ts:155-158`); sign-up `supabase.auth.signUp` with `emailRedirectTo = ${origin}/` and `data:{full_name, role}` (`useAuth.ts:165-175`). No OAuth or magic-link anywhere.
- **Signup role** is restricted at the call site to `SENIOR | JUNIOR | CLERK` (`useAuth.ts:162`; UI radio `Auth.tsx:237-286`). ADMIN/INTERN cannot self-register.
- **Email confirmation:** the client passes `emailRedirectTo` but contains no confirm-handling code; whether confirmation is required is a Supabase project setting **not determinable from the repo**. Interns are created server-side auto-confirmed (`email_confirm:true`, `create-intern-account/index.ts:135`).
- **Client config** (`src/integrations/supabase/client.ts:11-17`): `auth: { storage: localStorage, persistSession: true, autoRefreshToken: true }`. URL/key from `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`.
- **Offline guard:** signup/login submit is blocked when `!navigator.onLine` (`Auth.tsx:75-82`).
- **Hidden admin portal:** clicking the logo 7× within 3s opens `HiddenAdminPortal` on the auth page (`Auth.tsx:33-51`).

### User model — `profiles`
Created `20251203133923:5`. Columns: `id uuid PK` (= `auth.users.id`, ON DELETE CASCADE), `full_name`, `role text CHECK('SENIOR','JUNIOR','CLERK')` (legacy/deprecated — authoritative role lives in `user_roles`), `whatsapp_number`, `created_at`; later added `bar_registration_number`, `bench CHECK('JAIPUR','JODHPUR')`, `is_verified`, `onboarding_completed` (`20251205072130:30-33`), and BCI verification fields `bar_council_state`, `bci_verification_status CHECK('pending','submitted','verified','rejected')`, `bci_verified_at/by`, `bci_rejection_reason` (`20260518000008:9-15`).

**Profile creation on signup** is by trigger `on_auth_user_created AFTER INSERT ON auth.users` → `handle_new_user()` (final def `20260103111010:4-42`, SECURITY DEFINER): inserts `profiles(id, full_name=COALESCE(meta.full_name,email))` and validates `meta.role` against `('SENIOR','JUNIOR','CLERK','ADMIN')`, defaulting to `JUNIOR`, then inserts into `user_roles`. On any error it `RAISE EXCEPTION` (signup fails). **Notable contradiction:** the enum includes `INTERN` (`20260114120026:14`) but `handle_new_user`'s whitelist does **not** include `INTERN` (`20260103111010:25`), so a trigger-created intern would fall through to `JUNIOR` in `user_roles`; the intern edge function sidesteps this by setting role via metadata and relying on `intern_accounts` for gating (see below). No migration adds `INTERN` to that whitelist.

### Roles & how they're checked
- `user_roles` (`20251203135431:7`): `user_id → auth.users CASCADE`, `role app_role`, `UNIQUE(user_id,role)`. RLS: SELECT own only; **INSERT `WITH CHECK(true)` (open)**.
- SQL helpers (STABLE, SECURITY DEFINER): `has_role(_user_id,_role)→bool` (`:19-30`), `get_user_role(_user_id)→app_role` returns one role (`:33-41`).
- **Frontend:** `useAuth` fetches role via RPC `get_user_role` and exposes `isSenior/isJunior/isAdmin` (`useAuth.ts:38,193-196`) — note **no `isClerk`/`isIntern` here**. `useUserRole`/`useHasRole` wrap the RPCs (`useUserRole.ts`). `useRoleSemantics` derives `isLawyerRole = SENIOR|JUNIOR|ADMIN`, `isClerkRole`, `isInternRole`, plus capability flags (`canClaimOwnership`, `canForceActive`, `canCreateChamberCases`, all `&& !intern`) and role-aware UI labels (`useRoleSemantics.ts:54-97`).

### Intern model
Tables (all `20260114120026`): `intern_accounts` (user_id, chamber_id, supervisor_id, `expires_at NOT NULL`, `revoked_at`, `intern_name`, `institution`; `CHECK(expires_at>created_at)`), `intern_case_assignments` (per-docket grants), `intern_drafts` (sandbox; `draft_type`, review workflow), `intern_access_log` (immutable audit; INSERT `WITH CHECK(true)`).
- **Creation — `create-intern-account`** (verify_jwt=false but does in-code auth): requires caller JWT, role `SENIOR`/`ADMIN`, and **chamber ownership** (`:65-111`); creates the auth user (`email_confirm:true`), inserts `profiles{role:'INTERN', onboarding_completed:true}` (interns skip onboarding), inserts `intern_accounts`, with compensating deletes on failure (`:132-205`); returns one-time `tempPassword` in JSON (`:210-221`).
- **Zero-trust DB gating:** `is_active_intern()` (expires_at>now AND revoked_at null), `intern_can_access_case()` (active + non-expired assignment) — the `daily_court_docket` SELECT policy appends `OR intern_can_access_case(...)` (`20260114120026:359-380`). Draft writes require active+can-access; interns cannot delete.
- **Frontend capabilities** (`useInternPermissions.ts:96-110`) are compile-time `false as const` for everything sensitive (`canOwnCases`, `canExport`, `canPrint`, `canDownload`, `canSeeClientContact`, `canSendWhispers`, `canAccessVirtualCourt`, …); allowed only `canViewAssignedCases`, `canCreateDrafts`, `canSubmitForReview`.
- **Revocation:** SQL `revoke_expired_intern_accounts()` (`20260114120026:387-427`) sets `revoked_at`/reason and logs; invoked daily by edge fn `revoke-expired-interns` via pg_cron (`30 0 * * *`).

### Session persistence & idle logout
Session lives in `localStorage` via the Supabase client. `useAuth` registers `onAuthStateChange` first, then `getSession()`, with a manual recovery path reading `sb-${VITE_SUPABASE_PROJECT_ID}-auth-token` and calling `setSession` if needed (`useAuth.ts:53-121`). **`useAuth` is a plain hook, not a Context** (see §7). Idle logout (`useIdleLogout.ts`): 28-min warning toast, **30-min** `signOut`, 2s debounce, on `mousedown/keydown/touchstart/scroll`; mounted via `IdleLogoutGuard` only when a session exists.

### First vs returning login
The gate is `profiles.onboarding_completed` (`Auth.tsx:54-68`, `AuthGuard.tsx:76-84`). First login (flag false / no profile) → `/onboarding`; returning (flag true) → `/`. Interns are created with the flag true (skip onboarding). Account deletion (`account-deletion` → RPC `request_account_deletion`) anonymises `full_name='Deleted user'`, resets the flag, records a consent-revocation row, then `admin.deleteUser` (`20260518000007:79-106`; `account-deletion/index.ts:34-62`).

---

## 3. FULL UX FLOW — SCREEN BY SCREEN

### Router & enforcement model
Routes are defined in `src/App.tsx:122-137` inside `BrowserRouter`. `Dashboard` and `Auth` are eager; all others are `React.lazy` behind a `Suspense` spinner (`App.tsx:8-23,115-119`). **There is no central `ProtectedRoute` wrapper** — protection is per-page via `<AuthGuard>` (`src/components/layout/AuthGuard.tsx`): if `!loading && !isAuthenticated` → `/auth` (`:69-72`); if `requireOnboarding` (default true) and onboarding incomplete and not already on `/onboarding` → `/onboarding` (`:76-84`); during load it shows a skeleton, and after a 15s timeout a recovery screen (`:100-125`). All routes are wrapped in `<SovereignLayout>` (`App.tsx:120`), which renders `/auth` bare and gives every other route the persistent `Sidebar`+`AppHeader` (`SovereignLayout.tsx:12-37`) — but does **not** itself auth-gate. Global overlays mounted above routing: SplashScreen, Toaster, GlobalOfflineBanner, IdleLogoutGuard, InstallDiscoveryBanner, PWAUpdateManager, SmartPrefetcher, plus GlobalCommandPalette + CourtFocusOverlay (`App.tsx:89-114`).

**Sidebar nav** (`Sidebar.tsx:77-82`) exposes only: Docket `/`, "Technical Dossier" → **`/dossier`** (note: this points to *ProductDossier*, not `/technical-dossier`), Admin `/admin`, Documentation `/docs`; plus a non-functional "Quick Whisper" (`onClick(){}`, `:138-145`) and sign-out (`:187`).

| Route | Component | Protected | Role gate | What it is |
|---|---|---|---|---|
| `/` | Dashboard | ✅ AuthGuard (`Dashboard.tsx:214`) | UI shaping by role; admin-only simulator widget | Home docket (primary) |
| `/auth` | Auth | ❌ (inverse-redirects if authed) | — | Login/signup (primary) |
| `/onboarding` | Onboarding | self-guard (`:56-60`) | — | 5-step setup (primary) |
| `/settings` | Settings | ✅ (`:84`) | — | Profile/Aliases/Privacy tabs |
| `/docs` | Documentation | ❌ public | — | Static help (no remote data) |
| `/dossier` | ProductDossier | ❌ public | — | Static marketing/spec (945 lines) |
| `/technical-dossier` | TechnicalDossier | ❌ public | — | Static tech doc; **not linked in sidebar** |
| `/admin` | Admin | ✅ + **ADMIN-only** (`Admin.tsx:39-52`) | client-side `isAdmin` | "Sovereign Console", 15 tabs |
| `/war-room/:caseId` | WarRoom | ✅ (`:116,126,138`) | upload panel SENIOR/ADMIN (`:250`) | Senior hearing-prep cockpit (primary) |
| `/control-deck/:caseId` | ControlDeck | ✅ (`:50,60,72`) | — | Junior upload/messaging deck (primary) |
| `/courtroom` | CourtroomMode | ✅ (`:27,38,144`) | — | Read-only in-court list (primary) |
| `/install` | Install | ❌ public | — | PWA install UX |
| `/privacy` | Privacy | ❌ public | — | DPDP privacy policy (static) |
| `*` | NotFound | ❌ public | — | 404, hard-nav back to `/` |

**Dashboard `/`** (`Dashboard.tsx`): default tab JUNIOR→`tasks` else `brief`. Loads `useDocket(date)` (`daily_court_docket`), `useLiveBoard()` (`live_board_cache`), `useMorningBrief(date)`, `usePendingCaptures`, `useUpcomingCases`, `useCourtMode`, and hydrates IndexedDB via `useCacheHydration` (`:113-147`). Lists are bench-filtered from `profile.bench` (`:150-174`). Right column is a draggable `Reorder.Group` widget stack (`:584-679`). Juniors' task cards navigate to `/control-deck/:id` (`:371`); "Court Mode" → `/courtroom` (`:268`).

**Auth `/`** renders bare; redirects authed users by onboarding state; signup navigates to `/onboarding` (`Auth.tsx:125`).

**Onboarding** writes: consent rows to `user_consents` (privacy + AI required, `:41-52,102-109`), `profiles` update (full_name, bar_registration_number, bench; sets `bci_verification_status='submitted'` if BCI details), and finally `onboarding_completed=true` → `/` (`:131-146`). "BOTH" bench is stored as JAIPUR (`:79`).

**War Room `/war-room/:caseId`**: status bar with "N ITEMS AWAY"/"MARKED RUNNING" badges; left pane tabs Args (`ArgumentsPanel`)/Docs (`DocumentReviewPanel`, upload for SENIOR/ADMIN)/AI (`AIInsightPanel`)/Hits (`ListingHistoryPanel`+`PostCourtNoteCard`); below, `JudgeIntelligencePanel`+`JudgmentReferencesPanel`; right 70% `SmartPdfViewer`; plus `WhisperDrawer` (`WarRoom.tsx:148-320`). Selecting an argument jumps the PDF to its `linked_page_number` (`:98-99,317`). Loads `useDocketItem`, `useArguments`, `useExtendedDocuments`/`useDocumentReview` (`case_documents`), `useListingHistory`, `usePostCourtNotes`, `useEffectiveJudge`, `useCourtSessionState`.

**Control Deck `/control-deck/:caseId`**: header badges + FreshnessIndicator + NetworkStatusPill; body `DocumentUploadForm` + document-status card + recent whisper messages; bottom `WhisperInput` (`ControlDeck.tsx:78-247`). Uploads via `useDocumentUpload` (storage `case-documents` + `case_documents` row), whispers to the senior.

**Courtroom Mode `/courtroom`**: static `/courtroom` (no `:caseId`) — shows today's whole snapshot from `useCourtroomSnapshot()` (reads `lawyer_aliases`, `daily_court_docket`, `case_documents`, `case_arguments`; key `['courtroom-snapshot', userId]`). Read-only `CaseCard`s, large item numbers, matched side highlighted; `regenerate()` (online only); Exit → `/`. Deliberately non-interactive.

**Settings** (Profile/Aliases/Privacy) writes `profiles` directly (`Settings.tsx:48-73`). **Documentation/ProductDossier/TechnicalDossier/Privacy** are fully static (no remote data). **Install** drives the PWA install prompt. **NotFound** logs the path and offers a hard-nav back to `/` (`NotFound.tsx`).

**Caveats:** (1) No central route guard — `/docs`, `/dossier`, `/technical-dossier`, `/install`, `/privacy`, and `*` (NotFound) are reachable anonymously. (2) Sidebar "Technical Dossier" → `/dossier` (ProductDossier); the real `/technical-dossier` is unlinked. (3) Admin's role check is client-side; data protection relies on RLS.

---

## 4. DATA MODEL — COMPLETE TABLE INVENTORY

**71 base tables + 8 views.** The last schema migration `20260518000000_production_fix.sql` is authoritative for RLS: it **dropped permissive "service role can manage/insert/update" policies** on `ai_jobs`, `raw_causelists`, `cause_list_notes`, `case_parse_queue`, `court_overrides`, `ai_parse_cache`, `case_item_durations`, `court_avg_duration`, `document_processing_queue` (writes now occur only via service role, which bypasses RLS), and **rewrote the `daily_court_docket` SELECT policy** into a scope-enforced one. `service_role` bypasses RLS entirely, so "service-role only" ≈ "no user-facing policy."

### (a) User / Auth / Access-Control / Delegation
- **profiles** — user/lawyer profile. FK `id`↔auth.users; `bci_verified_by→auth.users SET NULL`. RLS final: **SELECT is effectively open** — the original `"Users can view all profiles" USING(true)` (`20251203133923:15`) was never dropped and coexists (OR's) with the later owner/admin policy (`20260110123953:4`); UPDATE/INSERT own only.
- **user_roles** — RBAC map. `user_id→auth.users CASCADE`, `role app_role`. RLS: SELECT own; **INSERT `WITH CHECK(true)`** (open).
- **chambers** / **chamber_memberships** / **chamber_invites** — chamber grouping, membership (soft-delete via `revoked_at`), and 7-day invite tokens (`20260102100817`). RLS scoped to owner/members; invites redeemable by matching email.
- **clerk_delegations** — senior→clerk scoped grants; `scopes delegation_scope[]` (view_cases, upload_documents, add_notes, track_hearings, mark_presence, edit_cases, manage_documents). RLS: INSERT requires `lawyer_id=uid AND (SENIOR|ADMIN)`; **DELETE `USING(false)` (blocked)** — revoke via UPDATE (`20260113124859:366`).
- **delegated_actions** — immutable audit of clerk actions; INSERT actor-only, no UPDATE/DELETE.
- **intern_accounts / intern_case_assignments / intern_drafts / intern_access_log** — see §2. `intern_access_log` INSERT `WITH CHECK(true)`.
- **lawyer_aliases** — name variations for matching; `profile_id→profiles CASCADE`; RLS all-ops self only.

### (b) Case management
- **daily_court_docket** — the central daily docket (one row per listed case item). 30+ columns incl. `date`, `court_location`, `court_room_no`, `item_no`, `case_number`, `petitioner/respondent(_lawyer)`, `matched_profile_id→profiles`, `chamber_id→chambers`, `list_type (DAILY/SUPPLEMENTARY)`, `case_fingerprint`, `match_confidence/match_method/matched_role`, `needs_review`, `hearing_likelihood`, `case_context (personal/chamber)`, VC fields (`vc_provider/meeting_id/join_url/...`), `case_title_raw`, `source_url`. RLS final (`20260518000000:180`): SELECT = ADMIN OR owner OR chamber (`can_view_chamber_cases`) OR unmatched+lawyer (claiming) OR delegated clerk OR active intern; INSERT = `is_lawyer_role AND NOT is_clerk_role`; UPDATE = owner/chamber/claim/clerk-scope; DELETE = ADMIN. 6 BEFORE triggers (§6). Unique index on `(court_location,court_room_no,case_number,date,COALESCE(matched_profile_id,'0000…'))`.
- **case_documents** — docket working documents (uploads) with versioning + senior review. `docket_id→daily_court_docket CASCADE`; enums `document_type`, `format`, `language`, `legibility`. RLS: **SELECT `USING(true)`** (open read); INSERT authenticated; UPDATE SENIOR/ADMIN; DELETE ADMIN.
- **case_arguments** — arguments linked to a docket item (`linked_page_number`, `highlight_coords`). RLS: SELECT `USING(true)`; INSERT/UPDATE/DELETE any authenticated.
- **case_hearings** — lawyer-confirmed hearing events; self-scoped; `UNIQUE(case_fingerprint,hearing_date,created_by)`.
- **lawyer_case_notes** — one note per case per lawyer; self-scoped.
- **post_court_notes** — human-verified hearing outcomes; `UNIQUE(case_fingerprint,hearing_date,author_id)`; SELECT author OR SENIOR/ADMIN.
- **tracked_cases** — cases a lawyer actively tracks, with judgment/order/doc-sync status machinery and `proceeding_status case_proceeding_status`. Owner-scoped; audited by `trg_tracked_cases_audit`.

### (c) Docket / cause-list
- **live_board_cache** — real-time per-court "current item"/status; composite key `(court_location,court_no)`; `status CHECK('hearing','passover','lunch','adjourned','not_sitting')`; SELECT `USING(true)`, INSERT/UPDATE authenticated; realtime on.
- **live_courtroom_feed** — whisper/chat per docket item; SELECT `USING(true)`; realtime on.
- **raw_causelists** — authoritative source cause-list records + extracted `text_content` + parse `status`; `telegram_message_id UNIQUE`. SELECT `USING(true)`; **write policies dropped** by production_fix (service-role writes).
- **raw_causelists_archive** — cold storage (>30 days); ADMIN read.
- **cause_list_notes** — registry/judicial NOTEs; SELECT `USING(true)`; write policy dropped.
- **case_parse_queue** — per-lawyer parse jobs; owner SELECT; manage policy dropped (now starved — see §5).
- **causelist_gap_audit** — coverage QA; ADMIN read, INSERT `WITH CHECK(true)`.
- **docket_cleanup_log** — deleted-docket audit; ADMIN read, INSERT `WITH CHECK(true)`.
- **court_metadata** — per-bench/court judges; SELECT `USING(true)`.
- **court_overrides** — manual judge substitutions from supplementary lists; SELECT `USING(true)`; write policies dropped; realtime on.
- **court_mode_settings** — per-user court-mode + escalation config; self-scoped.
- **court_orders** / **order_fetch_jobs** / **captcha_queue** / **captcha_usage_log** — court-order fetch subsystem (orders, fetch job queue with `captcha_blocked`/`manual_required` statuses, manual CAPTCHA queue ADMIN-only, 2captcha cost log). Mostly owner-scoped via tracked_cases.
- **case_item_durations** / **court_avg_duration** — court-speed telemetry + precomputed averages; SELECT `USING(true)`; write policies dropped.
- **sync_status** / **scraper_logs** / **profile_scan_log** — sync health, scraper run audit, per-lawyer scan audit. First two SELECT `USING(true)`; `profile_scan_log` self-scoped (its service-role `USING(true)` ALL policy was *not* in the drop list, so likely remains).

### (d) Documents
- **document_annotations** — PDF annotations (`annotation_type CHECK('highlight','pen','text')`, `annotation_json jsonb`); `document_id→case_documents CASCADE`; SELECT `USING(true)`, INSERT authenticated, UPDATE/DELETE owner; realtime on.
- **document_processing_queue** — Telegram sequential doc processing; `telegram_update_id UNIQUE`; manage policy dropped (service-role only).
- **synced_court_documents** — eCourts-fetched judgments/orders per tracked case; `UNIQUE(tracked_case_id,pdf_hash)`; SELECT/DELETE owner, INSERT system.

### (e) AI / parsing
- **ai_jobs** — the live AI job queue (court/lawyer parse), atomic claim added by `20260518000004`; manage policy dropped, authenticated SELECT remains.
- **ai_parse_cache** — 7-day AI response cache; `UNIQUE(text_hash,prompt_hash)`; manage policy dropped.
- **parser_confidence_runs** — per-bench/day confidence metrics; ADMIN read, INSERT/UPDATE `USING(true)`.
- **parser_fallback_log** — fallback-parser activations; ADMIN read, INSERT `WITH CHECK(true)`.
- **fallback_disabled_benches** — admin per-bench fallback toggle; ADMIN only.

### (f) Billing
- **subscriptions** — per-user tier/status; `user_id UNIQUE`, `stripe_customer_id`, `stripe_subscription_id`, `plan_type CHECK('free','individual','chamber')`, `status CHECK('active','past_due','canceled','trialing','expired')`. RLS: SELECT own/ADMIN; **ALL = service role `USING(true) WITH CHECK(true)`**. Never written by any code (see §13).
- **token_usage_daily** — daily token consumption per provider for budget; ADMIN read, ALL service-role `true`.

### (g) Audit / logging / security
- **admin_error_events** — central P0/P1/P2 error sink; ADMIN read/update; INSERT via `log_error_event()` SECURITY DEFINER; P0 alert cron.
- **audit_runs / audit_findings / audit_risks** — internal release-audit register; ADMIN only, full CRUD.
- **data_validation_logs** — data-quality results; SELECT `USING(true)`, INSERT authenticated.
- **security_events** — RLS-violation/unattributed-mutation log; ADMIN read; **INSERT `false`** (only via `log_security_event()`).
- **case_access_audit** — mutation audit on `tracked_cases` (Bar Council ethics); ADMIN or case-owner read; INSERT via trigger.
- **case_export_logs** — export audit (profile/cv/empanelment); own read, self INSERT.
- **vc_click_events** — virtual-court join-link clicks; self INSERT, ADMIN read.
- **user_consents** — versioned DPDP consents; own read, self INSERT.
- **judgment_audit_log** — immutable judgment-save audit; saver/ADMIN read.

### (h) Communication / notifications
- **notifications** — court-movement alerts (`notification_type CHECK('approaching','skipped','removed','anomaly')`, `severity`, `threshold_crossed`, `status`); `user_id→auth.users CASCADE`; SELECT/UPDATE own, INSERT service-role; realtime on.
- **notification_escalations** — WhatsApp escalation audit + per-case/day dedup (partial unique on `status='sent'`); own/ADMIN read, INSERT service-role.

### (i) Court intelligence / judgments / config / other
- **case_judgments** — final judgments per tracked case (`tracked_case_id UNIQUE`, 1:1); owner-scoped, immutable; atomic update `20260518000005`.
- **judgment_attachments** — links judgment references to arguments/dockets; SELECT `USING(true)`, INSERT authenticated, DELETE owner.
- **judge_judgment_references** — curated Indian Kanoon index (admin-managed); SELECT `USING(true)`, writes ADMIN.
- **judge_observations** / **judge_observation_sharing** — append-only personal judge notes + opt-in chamber sharing consent; self-scoped.
- **bench_procedural_patterns** — public bench cadence aggregates; SELECT `USING(true)`, writes service-role `USING(true)`.
- **judgment_check_jobs** — judgment-availability job queue; owner-scoped.
- **app_config** — KV runtime config (PWA kill-switch `force_update_version`, feature flags); SELECT `USING(true)`, writes ADMIN.
- **daily_execution_policies** — extracted judicial NOTEs driving hearing-likelihood; authenticated read, ADMIN writes.
- **rate_limit_counters** — per-user/action/window counters; PK `(user_id,action_key,window_start)`; RLS enabled, **no user-facing policy** (only via `check_rate_limit()` SECURITY DEFINER); created in production_fix `:239`.

### Views (8, read models)
`user_docket_view`, `parsing_health_summary`, `fallback_summary_view`, `v_invalid_case_contexts`, `v_clerk_ownership_violations`, `v_delegation_scope_violations`, `v_unattributed_mutations`, `v_intern_activity_digest`.

**Open-read (`USING(true)` SELECT) tables:** profiles (effectively), case_documents, case_arguments, judgment_attachments, judge_judgment_references, live_board_cache, live_courtroom_feed, raw_causelists, cause_list_notes, court_metadata, court_overrides, bench_procedural_patterns, case_item_durations, court_avg_duration, sync_status, scraper_logs, data_validation_logs, app_config, document_annotations. **Open-INSERT (`WITH CHECK(true)`):** user_roles, intern_access_log, causelist_gap_audit, docket_cleanup_log, parser_fallback_log (+ service-role-style ALL on subscriptions, token_usage_daily, bench_procedural_patterns, profile_scan_log).

---

## 5. EDGE FUNCTION INVENTORY — COMPLETE

**40 function directories** (the prompt's "38" undercounts) + `_shared/`. `config.toml` declares only **30**; the other 10 inherit Supabase default `verify_jwt=true`: `account-deletion`, `admin-doc-sync-trial`, `alert-p0-errors`, `backfill-parties`, `check-case-judgment`, `derive-hearing-likelihood`, `download-order-pdf`, `fetch-case-orders`, `scan-causelist-listings`, `sync-case-documents`.

### Cause-list ingestion
- **scrape-causelist** (jwt=false) — pg_cron daily (`30/32 1 * * 1-6`). Input `{bench,date?}`. Scrapes hcraj.nic.in court table (Firecrawl fallback), upserts `court_metadata`, iterates first 3 courts. **PARTIALLY BROKEN:** court-metadata works; per-case extraction is dead — `scrapePdfWithFirecrawl` always `return []` (`index.ts:650-665`), Browserless result discarded (`:640`), Gemini extractors never called. `cases_found` always 0.
- **download-causelists** (jwt=false) — invoked by `telegram-webhook:195`. Dedupes on `telegram_message_id`, Telegram getFile→download→store to `causelist-pdfs`, inserts `raw_causelists` (downloaded), fires `extract-causelist-notes` + `scan-lawyer-names`. **WORKING.**
- **extract-causelist-notes** (jwt=false) — invoked by download-causelists. Extracts text via `unpdf`, runs NOTE regexes → `cause_list_notes` + `daily_execution_policies`, invokes `derive-hearing-likelihood`. **WORKING.**
- **scan-lawyer-names** (jwt=false) — invoked by download-causelists / pdf-extract-chunk / html-extract. Splits DAILY text into court blocks, context-matches aliases, logs `profile_scan_log`, **enqueues `ai_jobs`** (`court_parse`/`lawyer_parse`). Explicit comment "NO LONGER triggering parse-case directly - worker handles it" (`:577`). **WORKING.**
- **upload-causelist** (jwt=true) — admin UI; ADMIN-gated; stores to `causelist-pdfs`, inserts `raw_causelists (source:'admin_upload')`, fires `html-causelist-parse` (HTML) or `pdf-extract-chunk` (PDF). **WORKING.**
- **html-causelist-parse** (jwt=false) — invoked by upload-causelist + scan-lawyer-names. Pure-regex deterministic parser → `daily_court_docket`, `court_overrides`, `causelist_gap_audit`; then invokes `derive-hearing-likelihood` + `match-docket-aliases`. **WORKING** (the live HTML path).
- **html-extract** (jwt=false) — HTML→text, then scan-lawyer-names. **WORKING.**
- **pdf-extract-chunk** (jwt=false) — `pdfjs-serverless`, 30 pages/chunk, **self-chains**, then scan-lawyer-names. **WORKING.**
- **parse-case** (jwt=false) — queue worker on `case_parse_queue`; AI fallback Gemini→OpenAI→OpenRouter + `ai_parse_cache`. **WORKING code but STARVED** — nothing seeds `case_parse_queue` anymore (scan-lawyer-names moved to `ai_jobs`); admin button `HiddenAdminPortal.tsx:150` triggers it but it returns "No pending items."
- **parse-all-cases** (jwt=false) — single-provider OpenAI whole-causelist parse. **WORKING code but DEAD/UNREFERENCED** (no caller; depends on `status='scanned'` which the pipeline doesn't emit).
- **ai-worker** (jwt=false) — invoked by `useAIIntelligence.ts:12` + `AiJobsMonitor.tsx:157`. Claims `ai_jobs` via RPC `claim_next_ai_job` (FOR UPDATE SKIP LOCKED); hourly token budget 250k; branches by `list_type` (SUPPLEMENTARY/NOTICE = rule-based regex, DAILY/SEARCH = AI); provider fallback; inserts to `daily_court_docket` + `court_overrides`; retry backoff [60,300,900]. **WORKING** — the live AI parse path. Note it has **no `summarize_case` action handler** despite the frontend calling one (§9).

### Retrieval / court-scraping (lawyer-scoped)
- **search-indian-kanoon** (jwt=false) — invoked by `useAIIntelligence`/`useIndianKanoonSearch`/`useReferenceJudgments`. API if `INDIAN_KANOON_API_KEY` else HTML scrape; multi-vector queries; no DB writes. **WORKING (graceful degradation).**
- **check-case-judgment** (jwt=true default) — `useJudgmentCheck.ts:93`. 2Captcha-gated; rate-limit 5/hr + ownership/cooldown RPCs; fetches eCourts page, solves CAPTCHA, submits, parses HTML, records result, inserts `case_judgments` metadata. **WORKING as written but dependency-gated & HTML-fragile.** (Note: this and sync-case-documents are the *production* scraping path; a separate audit found the standalone-`fetch` cookie/session handling fragile — out of scope here.)
- **sync-case-documents** (jwt=true default) — `useDocumentSync.ts:123`. Like above but downloads ALL docs; rate-limit 10/hr + `acquire_document_sync_lock`; SHA-256 dedupe → `synced_court_documents` + storage. **WORKING as written, dependency-gated.**
- **fetch-case-orders** (jwt=true default) — order-fetch job system (seeded by scan-causelist-listings). GETs eCourts orders page, detects blocking/CAPTCHA → writes `captcha_queue`, **never submits the form**; returns "Automated form submission not implemented." **PARTIAL STUB.**
- **download-order-pdf** (jwt=true default) — downloads a court-order PDF by URL, SHA-256 dedupe, stores to `case-documents` under `orders/...`, updates `court_orders`. **WORKING** (gated on something populating `source_pdf_url`, which the stubbed fetch-case-orders doesn't).

### Alias matching & hearing derivation
- **match-docket-aliases** (jwt=false) — invoked by html-causelist-parse. Token-aware matching (exact 0.95 / consecutive 0.95 / all-words 0.85 / substring 0.80; first-name gate); idempotent. **WORKING** (O(cases×profiles×aliases), slow).
- **auto-match-aliases** (jwt=false, `x-trigger-secret`) — per-docket matcher (exact 1.0 / Jaro-Winkler ≥0.92 for 2+ word aliases). **WORKING code but ORPHANED** — production_fix replaced the pg_net docket trigger with in-DB matching (§6), so it's no longer wired to docket inserts.
- **backfill-alias-matches** (jwt=false, `x-trigger-secret`) — invoked by `lawyer_aliases` AFTER-INSERT pg_net trigger; retro-matches last-90-day unmatched dockets for a new alias. **WORKING** (the one remaining live pg_net→edge trigger path).
- **backfill-parties** (jwt=true default) — manual utility; parses `case_title_raw` into petitioner/respondent; idempotent. **WORKING.**
- **derive-hearing-likelihood** (jwt=true default) — invoked by extract-causelist-notes + html-causelist-parse. Rule-based likelihood (LIKELY/CONDITIONAL/LOW_PROBABILITY/UNKNOWN) from `daily_execution_policies` → updates docket. **WORKING.**

### Live board
- **scrape-live-board** (jwt=false) — scheduled loop; IST court-hours gate; ~55s loop scraping hcraj displayboard every ~3s; upserts `live_board_cache`, tracks `case_item_durations`, writes `sync_status`. **WORKING (real scraping).**
- **sync-live-board** (jwt=true) — `useDataValidation`; `health`/`sync`/`force_sync` single-court upsert + staleness report. **WORKING.**
- **simulate-live-board** (jwt=true) — `LiveBoardSimulator`; **generates fake** live-board progress for dev/demo. **WORKING dev tool (fake data by design).**

### Telegram / notifications / accounts / ops
- **telegram-webhook** (jwt=false) — external Telegram webhook (+ `?action=setup|status|process-queue`). Soft auth: **missing `x-telegram-bot-api-secret-token` only warns** (`:102-105`). Detects PDF, delegates to download-causelists; separate queue/`processDocument` path parses with **Google Gemini 2.5 Flash** directly into `daily_court_docket`. **WORKING.**
- **scrape-telegram-causelist** (jwt=false) — scrapes public channel `t.me/s/hcrajtc` via Firecrawl; regex parse → `daily_court_docket`. **WORKING but LEGACY/likely-superseded** by the webhook→download-causelists Gemini pipeline; `aiApiKey` param read but unused.
- **escalate-whatsapp** (jwt=true) — `useNotificationEscalation.ts:56`. Daily-limit check, builds message, **inserts `notification_escalations` status `sent` and marks notification `escalated` — but never sends** (`// TODO` + `console.log`, `:68-71`). **STUB.**
- **account-deletion** (jwt=true default) — `PrivacySettings.tsx:50`. RPC `request_account_deletion` + `auth.admin.deleteUser`. **WORKING.**
- **create-intern-account** (jwt=false, in-code auth) — see §2. **WORKING** (low-entropy temp password returned in JSON).
- **revoke-expired-interns** (jwt=false, `x-cron-secret`/service-role) — pg_cron daily; RPC `revoke_expired_intern_accounts()`. **WORKING.**
- **data-validation** (jwt=true) — `useDataValidation`; validates docket + live board + cross-checks → `data_validation_logs`. **WORKING** (30s/60s staleness thresholds aggressive).
- **health-check** (jwt=false) — `CourtStatusCard.tsx:124`; DB ping + P0 count + HTTP HEAD to hcraj. **WORKING.**
- **alert-p0-errors** (jwt=true default) — pg_cron `*/15 * * * *`; posts unresolved P0 summary to Telegram. **WORKING.**
- **aggregate-case-durations** (jwt=false) — closes/clamps `case_item_durations`, RPC `refresh_court_averages()`. **WORKING** (no in-src caller found).
- **scan-causelist-listings** (jwt=true default) — once/day per bench; matches active `tracked_cases` to today's docket, sets `listed_today`, **queues three `order_fetch_jobs` per matched case at +24/48/72h** (feeds fetch-case-orders). **WORKING** (loose substring match).
- **admin-doc-sync-trial** (jwt=true default) — Browserless+2Captcha experiment that **deliberately fails** to demonstrate CAPTCHA session-binding; no DB writes. **TRIAL/DIAGNOSTIC** (latent bug: default filter `case_type='BAIL)'`, `:179`).
- **test-firecrawl-pdf / test-pdf-parse** (jwt=false) — manual test helpers, no DB writes. **TEST helpers.**
- **_shared/courtScraper.ts** — used by fetch-case-orders + download-order-pdf; `parseOrdersTable` is a CAPTCHA-blocked placeholder (`:83-97`).

---

## 6. DATABASE TRIGGERS & REALTIME

### Triggers (final/authoritative state)
`20260518000000_production_fix.sql:99-152` dropped all 15 historical `daily_court_docket` triggers and recreated **6**:

| Trigger | Event | Function | Does |
|---|---|---|---|
| `trg_auto_match_before_insert` | BEFORE INSERT | `auto_match_on_insert()` | **In-DB** alias match (normalize + ILIKE `lawyer_aliases` longest-first, sets `matched_profile_id/role/method='auto_match'/confidence=0.95`). No HTTP. (`20260110124734:4-75`) |
| `trg_set_case_fingerprint` | BEFORE INS/UPD | `auto_set_case_fingerprint()` | Deterministic case fingerprint for dedup (`20251218173835:134`) |
| `trg_enforce_match_auditability` | BEFORE INS/UPD | `enforce_match_method_on_profile()` | Requires `match_method` when `matched_profile_id` set |
| `trg_validate_case_context` | BEFORE INS/UPD | `validate_case_context()` | Requires `chamber_id` for chamber rows |
| `trg_enforce_lawyer_ownership` | BEFORE UPD | `enforce_lawyer_ownership_updates()` | Restricts non-owner field updates; logs security events |
| `trg_enforce_delegation_scope` | BEFORE UPD | `enforce_delegation_scope_on_update()` | Enforces clerk delegation scope |

**Docket trigger-chain history (requested):** Generation 1 was an `AFTER INSERT` trigger `trigger_auto_match_aliases()` using **pg_net `net.http_post`** to call the `auto-match-aliases` edge function async (`20260103111010:79-91`). Generation 2 (current) replaced it with the synchronous in-DB `auto_match_on_insert()` (comment: *"matches directly in the database … avoids the complexity of HTTP calls from triggers"*, `20260110124734:1-2`), **orphaning the `auto-match-aliases` edge function** for docket inserts. Downstream `derive-hearing-likelihood`/`match-docket-aliases` are now invoked by `html-causelist-parse` after parsing, not by triggers.

Other triggers:
- **lawyer_aliases** `trigger_backfill_on_alias` AFTER INSERT → pg_net to `backfill-alias-matches` (`20260113115647:2-29`) — the one remaining live pg_net→edge path.
- **auth.users** `on_auth_user_created` AFTER INSERT → `handle_new_user()`.
- **post_court_notes** `auto_derive_hearing_on_post_court_note` AFTER INS/UPD → `derive_hearing_from_post_court_note()` (creates/updates `case_hearings`).
- **tracked_cases** `trg_tracked_cases_audit` AFTER INS/UPD/DEL → `log_tracked_case_audit()`.
- **case_documents/case_arguments/judgment_attachments** scope-enforcement triggers (`20260113132026`).
- **case_judgments** validate + audit triggers (`20260110132359`).
- **intern_drafts** updated_at, submitted_at, and `log_intern_draft_action()` triggers.
- Generic `update_updated_at_column()` touch triggers on subscriptions, token_usage_daily, audit_findings, lawyer_case_notes, post_court_notes, court_mode_settings, case_hearings, tracked_cases.

### Realtime subscriptions (frontend, complete)
All follow `supabase.channel(name).on('postgres_changes', {...}).subscribe()` with `removeChannel` cleanup.

| # | Location | Table / event / filter | On update |
|---|---|---|---|
| 1 | `useDocket.ts:56-89` | `daily_court_docket`, `*`, `date=eq` | **conditional** invalidate `['docket',user,date]` only if `matched_profile_id===user.id` or `case_context==='chamber'` |
| 2 | `useDualStreamDocket.ts:111-151` | `daily_court_docket`, `*`, `date=eq` | invalidate `['docket','personal'/'chamber',...]` by matched record |
| 3 | `useLiveBoard.ts:86-129` | `live_board_cache`, `*` | **direct cache patch** `setQueryData(['liveBoard'])` (no refetch); full invalidate on DELETE |
| 4 | `useCourtNotifications.ts:103-125` | `notifications`, `*`, `user_id=eq` | invalidate `['court-notifications']` |
| 5 | `useWhisper.ts:29-64` | `live_courtroom_feed`, INSERT, `docket_id=eq` | toast + invalidate `['whisper',id]` |
| 6 | `useAnnotations.ts:44-67` | `document_annotations`, `*`, `document_id=eq` | invalidate `['annotations',id]` |
| 7 | `useDelegation.ts:262-285` | `clerk_delegations`, `*` | refetch (immediate revocation) |
| 8 | `useConnectionHealth.ts:73-89` | bare channel `health-monitor` | maps transport status (no postgres_changes) |
| 9 | `useSubscriptionManager.ts:47-61` | dynamic | ref-counted multiplexer (fans to callbacks) |
| 10 | `WhisperDrawer.tsx:232-256` | `live_courtroom_feed`, INSERT, `docket_id=eq` | sound + invalidate `['whispers',id]` |
| 11 | `HiddenAdminPortal.tsx:93-115` | `case_parse_queue`, `*` | **local `setState`** (not RQ) |
| 12 | `HiddenAdminPortal.tsx:118-138` | `raw_causelists`, `*` | local `setCauselists` |

Note #5 and #10 both subscribe to `live_courtroom_feed` INSERTs on the same docket with different channel names/keys (`whisper` vs `whispers`) — duplicate listeners.

**Full chain (live board):** server updates `live_board_cache` → logical replication → Supabase Realtime → channel `live-board-changes` → callback `setQueryData(['liveBoard'])` patches the matching court element (no network) → all `useLiveBoard`/`useLiveBoardForCourt` consumers re-render → downstream `useCourtNotifications` recomputes item distance, inserts `notifications` on threshold crossing → subscription #4 invalidates → bell re-renders. **Docket:** `daily_court_docket` change → channel `docket-changes-${date}` → guarded invalidate → refetch → `useDocket` consumers re-render. `useFallbackPolling` (`useSyncHealth.ts:213`) can invalidate `['liveBoard']` every 10s when realtime is degraded.

---

## 7. FRONTEND STATE MANAGEMENT & DATA FETCHING

### Auth is a plain hook, not Context
`useAuth` (`useAuth.ts:8`) holds local `useState` — **no `AuthProvider`/`AuthContext`**. All **57 files** importing it get independent instances that converge because they share the Supabase client + localStorage + the `onAuthStateChange` listener. Data hooks gate on `user?.id` from their own `useAuth()` call.

### Provider tree & React Query
`App.tsx:78-151` (outer→inner): `ErrorBoundary → DensityProvider → QueryClientProvider → TooltipProvider → FormDirtyProvider → SyncConflictProvider → (banners/guards) → BrowserRouter → KineticProvider → Suspense → SovereignLayout → Routes`. **`QueryClient` is created with zero config** (`App.tsx:49`) — all defaults stock (staleTime 0, gcTime 5min, retry 3). Tuning is per-hook: `useDocket`/`useDualStreamDocket` staleTime 30s; `useLiveBoard` 15s; `useUpcomingCases`/`useMorningBrief` 60s; `useSyncStatusHistory` refetchInterval 10s.

### Three caching layers
1. **React Query** — server state (most hooks).
2. **`useQueryCache`** — module-level `Map` TTL cache (30s default, 100-entry cap) with in-flight dedup; **not persisted**.
3. **IndexedDB** — two `idb` databases: `vakalat-os-cache` (stores `docket-items`, `case-documents` PDF Blobs, `case-arguments`, `pending-mutations`) and `nyayhub-query-cache` (24h, hydrates RQ on mount via `useCacheHydration`).

### Hooks inventory (by domain — abridged; full table in agent notes)
- **Auth/roles/permissions:** `useAuth`, `useUserRole`/`useHasRole`, `useRoleSemantics`, `useInternPermissions`/`useInternGuard`/`useInternAccessLogger`, `useDelegation` (RT), `useSensitiveView`, `useIdleLogout`.
- **Docket/cases/hearings (core):** `useDocket`/`useDocketItem` (RT; **swallows errors→[]**, `useDocket.ts:38-41`), `useDualStreamDocket` (personal+chamber, RT), `useUpcomingCases`, `useHearings*`, `useCaseHistory`, `useListingHistory`, `useMorningBrief` (batched, reads profiles+aliases+docket+docs+args+notes+RPC), `useLawyerSearch`, `useVirtualCourt`, `useCourtroomSnapshot`, `useCaseExport`.
- **Live board/court/notifications:** `useLiveBoard`/`useActiveLiveBoards`/`useLiveBoardForCourt` (RT cache-patch), `useCourtNotifications` (RT; **creates the notifications**), `useNotificationEscalation` (calls escalate-whatsapp), `useNotificationSound`, `useCourtMode`, `useCourtFocusMode`, `useCourtSessionState`, `useCourtOverrides`, `useEffectiveJudge`, `useEffectiveHearingState`, `useCourtDurationAverage`, `useWaitTimeEstimate`.
- **Documents/arguments/annotations/judgments:** `useCaseDocuments`, `useDocumentManagement` (upload/review), `useDocumentSync`, `useFileUpload`, `useAnnotations` (RT), `useArguments`, `useJudgmentCheck`, `useJudgmentRecording`, `useJudgmentAttachments`, `useJudgmentReferences`/`useReferenceJudgments`, `useIndianKanoonSearch`, `useAIIntelligence`, `useJudgeIntelligence`.
- **Aliases/notes/whisper:** `useAliases` (rate-limited), `useLawyerCaseNotes`, `useCauseListNotes`, `useWhisper*` (RT).
- **Offline/sync/network/cache:** `useNetworkStatus` (debounced 3s, `blockIfOffline` write guard), `useOfflineCache`, `usePendingSync` (**only `post_court_notes`**), `useQueryCache`, `useCacheIntegration`/`useCacheHydration`, `useSyncHealth`*, `useConnectionHealth` (RT transport), `useOfflineThresholdMemory`, `useSubscriptionManager`/`useTableSubscription` (RT multiplexer), `useRateLimit`.
- **Chambers/interns/billing/admin/observability/audit:** `useChambers`, `useInternSupervision.*`, `useSubscription`/`useSubscriptionManager`, `useAdminErrors`, `useBetaObservability`, `useAudit`, `useExportAudit`, `useParserConfidence`, `useFallbackLogs.*`, `useDataValidation.*`, `usePostCourtCapture`, `useBatchOperations`, `useClientUpdate`.
- **PWA/lifecycle/UI:** `useForceUpdate`, `usePWAUpdate`/`usePWAUpdateSafety`, `useBeforeUnloadGuard`, `useAudioRecorder`, `use-mobile`, `use-toast`.

### Loading / error handling
- One global class `ErrorBoundary` wraps the app (`App.tsx:79`); catches render errors, reports via `reportHighError('REACT_RENDER_ERROR')`, offers Refresh / Go Home / "Clear session and sign in again". Does not reset React Query.
- `main.tsx:12-26` wires `window.onerror` and `unhandledrejection` → `admin_error_events`.
- Per-hook: most query fns `throw` so RQ surfaces `isLoading`/`error`; **`useDocket` is the exception — swallows to `[]`**.
- **Toasts (`sonner`)** are the dominant feedback channel (`<Toaster position="top-center">`, `App.tsx:94`), used for mutations, offline blocks, network up/down, judgment results, escalations, sync. A second toast system (`use-toast.ts`, shadcn) also exists.
- **Contexts:** `SyncConflictContext` (blocking conflict dialog, resolves a Promise), `FormDirtyContext` (dirty-form tracking for unload/PWA-update guards), `DensityContext` (UI density).

---

## 8. THE CORE DATA PIPELINE — TELEGRAM TO UI

This is the working spine. Trace of a cause-list PDF from arrival to the lawyer's docket:

**1. Arrival.** The Rajasthan HC posts cause-list PDFs to a Telegram channel/bot. Telegram delivers an `Update` to the **`telegram-webhook`** edge function (registered via `?action=setup`). (A second, legacy route `scrape-telegram-causelist` Firecrawl-scrapes the public channel `t.me/s/hcrajtc` directly, but is superseded.) The direct-portal scraper `scrape-causelist` does **not** contribute cases (its extraction returns `[]`, §5).

**2. `telegram-webhook/index.ts`.** Soft-auths the secret-token header (**missing header only warns**, `:102-105`). On a message with a document, it identifies a causelist PDF, derives bench/list_type/list_date, and **delegates to `download-causelists`** via `fetch(.../functions/v1/download-causelists)` (`:195`). It also contains a self-contained queue path (`document_processing_queue` → `processDocument`) that parses PDFs directly with **Google Gemini 2.5 Flash** into `daily_court_docket` (`:338-477`).

**3. `download-causelists`.** Dedupes on `raw_causelists.telegram_message_id`, downloads the file via Telegram `getFile`, stores it to the **private `causelist-pdfs`** bucket at `causelists/{date}/{bench}/{list_type}_{message_id}.pdf`, inserts `raw_causelists (status='downloaded')`, and fires (fire-and-forget) `extract-causelist-notes` and `scan-lawyer-names`.

**4. Text extraction & job creation.** For PDFs, `pdf-extract-chunk` (`pdfjs-serverless`, 30 pages/chunk, self-chaining) fills `raw_causelists.text_content`, then calls `scan-lawyer-names`. `scan-lawyer-names` splits DAILY text into per-court blocks, context-matches lawyer aliases, writes `profile_scan_log`, and **enqueues `ai_jobs`** (`court_parse` per block, `lawyer_parse` for search). For HTML, `html-causelist-parse` parses deterministically (regex) straight into `daily_court_docket`.

**5. The Gemini parse.** The live AI worker **`ai-worker`** claims a job via RPC `claim_next_ai_job` (`SELECT … FOR UPDATE SKIP LOCKED`), enforces a 250k-tokens/hour budget, and parses the court block. Provider fallback chain: **Google `gemini-2.0-flash` → OpenAI `gpt-4o-mini` → OpenRouter** (`ai-worker` and `parse-case` both implement this; `telegram-webhook`'s direct path uses Gemini 2.5 Flash). Cases are extracted as structured rows. (`parse-case` and `parse-all-cases` are older parsers, now starved/dead — §5.)

**6. Write to `daily_court_docket`.** The worker inserts parsed cases (deduped). Each INSERT fires the 6 BEFORE triggers (§6); critically `auto_match_on_insert()` performs **in-DB alias matching** (normalize names, ILIKE against `lawyer_aliases` longest-first, set `matched_profile_id/matched_role/match_method='auto_match'/match_confidence=0.95`), `auto_set_case_fingerprint()` sets the dedup fingerprint, and `validate_case_context()`/auditability/ownership/delegation triggers enforce integrity. The unique index `(court_location,court_room_no,case_number,date,COALESCE(matched_profile_id,…))` prevents duplicates. (The historical async pg_net call to the `auto-match-aliases` edge function was replaced by this in-DB matching, orphaning that function — §6.) When a lawyer later adds a new alias, the `lawyer_aliases` AFTER-INSERT trigger fires `backfill-alias-matches` (pg_net) to retro-match the last 90 days.

**7. Frontend pickup — realtime.** `useDocket(date)` subscribes to channel `docket-changes-${date}` on `daily_court_docket` (`useDocket.ts:56-89`). On a change it **conditionally** invalidates `['docket', user.id, date]` only when the changed row's `matched_profile_id===user.id` or `case_context==='chamber'`, triggering a refetch of the lawyer's filtered docket. (`useDualStreamDocket` splits personal vs chamber.) This is realtime, not polling, with a 10s fallback poll if realtime degrades.

**8. What the lawyer sees.** The Dashboard's docket tabs render `DocketCard`s from the refetched `DocketItem[]` (`Dashboard.tsx:462-558`): item number, parties, court/room, judge, match confidence, hearing-likelihood, and warnings. The Morning Brief (`useMorningBrief`) computes per-case readiness/risk and attend/delegate/monitor recommendations.

**Clicking into a case (senior → War Room):** `/war-room/:caseId` loads `useDocketItem(caseId)` (`daily_court_docket` by id, `useDocket.ts:96-99`); `useArguments(caseId)` (`case_arguments`); `useExtendedDocuments(caseId)` + `useDocumentReview` (`case_documents`); `useListingHistory`/`useCaseHasListings` (aggregate of docket+docs+args+notes by fingerprint); `usePostCourtNotes`; `useEffectiveJudge` (`court_overrides`/`court_metadata`); `useCourtSessionState` (from live board). The right pane `SmartPdfViewer` loads the primary/approved document (auto-selected, `WarRoom.tsx:70-87`) via `react-pdf`; selecting an argument jumps the PDF to its `linked_page_number`. Whisper chat (`live_courtroom_feed`) is realtime. (Juniors instead open `/control-deck/:caseId` to upload documents and whisper to the senior.)

---

## 9. AI FEATURES — HONEST INVENTORY

There is a **real** multi-provider AI backend, but the in-UI "AI" surfaces are mostly fake or broken:

| Surface | UI promise | What actually happens | Verdict |
|---|---|---|---|
| AiStrategyPanel (`morning-brief/AiStrategyPanel.tsx:25-52`) | "AI Strategy Generator / Neural Engine" | `setTimeout(2000)` then **hardcoded** strategy points/conclusion, identical for every case | **FAKE** |
| SmartPdfViewer "AI Summary" (`war-room/SmartPdfViewer.tsx:131-139`) | AI summary of the open PDF | `setTimeout(2500)` returns one **hardcoded** "Section 482 CrPC / Bhajan Lal" string for any PDF; `pdfUrl` never read | **FAKE** |
| AIInsightPanel "Points of Law" (`war-room/AIInsightPanel.tsx:86-99`) | Extracted points of law | Two **hardcoded** `<div>`s | **FAKE** |
| AIInsightPanel "Find Precedents" (`:67-83`) | Precedent search | Button with **no onClick**; the real `search-indian-kanoon` backend exists and is used elsewhere | **UNWIRED** (backend real) |
| AIInsightPanel "Case Summary" (`useAIIntelligence.ts:12`, called `AIInsightPanel.tsx:41`) | AI case summary | Invokes `ai-worker` with `{action:'summarize_case'}`, but **`ai-worker` has no `action` handler** — it claims a parse job and ignores the body, so `data.summary` is always `undefined` | **BROKEN** |

**Real AI infrastructure:**
- **`ai-worker`** — the production parser/queue worker. Atomic claim via `claim_next_ai_job` (FOR UPDATE SKIP LOCKED); **token budget** 250k/hour enforced against `token_usage_daily`; provider fallback **Gemini 2.0 Flash → GPT-4o-mini → OpenRouter**; SUPPLEMENTARY/NOTICE handled by rule-based regex (no AI); writes `daily_court_docket` + `court_overrides`. Invoked by `AiJobsMonitor` and (for the broken summary) `useAIIntelligence`.
- **`parse-case`** — same provider chain + `ai_parse_cache`; **starved** (nothing feeds `case_parse_queue`).
- **`parse-all-cases`** — OpenAI-only whole-causelist parse; **dead/unreferenced**.
- **`search-indian-kanoon`** — real Indian Kanoon API (key) with HTML-scrape fallback; genuinely used by `useReferenceJudgments`/`useIndianKanoonSearch`.
- The `telegram-webhook` direct path uses **Gemini 2.5 Flash**.

So: real parsing AI exists and runs the pipeline; the "assistant"-style AI features the lawyer sees in War Room / Morning Brief are theater, one (case summary) calls a non-existent handler, and one (precedents) is simply unwired to a backend that already works.

---

## 10. DOCUMENT MANAGEMENT

### Storage buckets (both private in final state)
- **`case-documents`** — created public (`20251203134512:2`), made **private** (`20251231102948:2-4`), re-declared 50MB/PDF-only `public=false` (`20260110094421:2-10`, `ON CONFLICT DO NOTHING`). Paths: client uploads `{docketId}/{ts}.{ext}` (`useFileUpload.ts:15`) and `{docketId}/{type}_v{n}_{ts}.{ext}` (`useDocumentManagement.ts:76`); synced docs `lawyers/{lawyer_id}/cases/{case_id}/documents/{hash}.pdf` (`sync-case-documents:679`); orders `orders/{bench}/{hash}/{hash}.pdf` (`download-order-pdf:131`). Note the `20260110094421:13-21` RLS policy keys on the first folder segment being a `tracked_cases.id`, but actual paths start with `lawyers/`/`orders/`, so the governing read policy is the authenticated-only one from `20251231102948`.
- **`causelist-pdfs`** — created public (`20251205124413:2`), made **private** (`20260518000001:10`) because public filenames leaked which lawyers were tracked. Paths: Telegram `causelists/{date}/{bench}/...`, admin `admin-uploads/{bench}/{date}/...`.

### How documents enter
- **Admin upload** → `upload-causelist` → `causelist-pdfs` + `raw_causelists` (source='admin_upload').
- **Telegram** → `download-causelists` → `causelist-pdfs` + `raw_causelists`.
- **Court order PDFs** → `download-order-pdf` (URL download, SHA-256 dedupe, immutable store) updating `court_orders`.
- **eCourts judgments/orders** → `sync-case-documents` (2Captcha, SHA-256 dedupe → `synced_court_documents` + `case-documents`).
- **Client uploads:** `useFileUpload` (stores the **path** in `case_documents.file_url`, signs a 1h URL on read — bucket is private) and `useDocumentManagement.useDocumentUpload` (versioned `case_documents` insert). **Inconsistency:** `useDocumentManagement.ts:93-95` stores a `getPublicUrl` into the **private** bucket (would not resolve), unlike `useFileUpload`'s signed-URL approach — a latent bug.

### SmartPdfViewer (`war-room/SmartPdfViewer.tsx`)
- Library **`react-pdf`** (PDF.js worker from unpkg CDN, `:15`); renders one `<Page>` with text/annotation layers disabled (`:295-301`).
- **Working:** prev/next page, zoom in/out/reset, pinch-zoom, jump-to-page.
- **Annotation tools** (`AnnotationToolbar.tsx`): highlighter, pen, eraser, search. **Only the highlighter is wired** — `handleTextSelection` captures the selection rect and inserts a `highlight` annotation (`:99-129`). **Pen/eraser/search have no handlers** (state set but unread; `onSearch` never passed). The "AI Summary" button is the fake `setTimeout` (§9).

### Annotations / highlights end-to-end
`useAnnotations(documentId)` reads `document_annotations` (RQ), inserts/updates/deletes with `user_id`. A realtime channel `annotations-{documentId}` on `document_annotations` (filter `document_id`) invalidates `['annotations',documentId]` on any change; mutations also invalidate `onSuccess`. SmartPdfViewer filters by `page_number===currentPage` and renders absolutely-positioned overlay divs from `annotation_json.boundingRect`. Highlights are the only annotation type the UI can create today.

### `synced_court_documents` vs `case_documents` (vs `court_orders`)
- **`case_documents`** — docket working documents **uploaded by users**, tied to `docket_id`, with versioning + senior review. Writers: `useFileUpload`, `useDocumentManagement`; updates: `useDocumentReview`.
- **`synced_court_documents`** — court-fetched judgments/orders **auto-downloaded from eCourts**, tied to `tracked_case_id`+`lawyer_id`, hash-deduped. Writer: only `sync-case-documents` (service role). Reader: `useDocumentSync.getDocuments`.
- **`court_orders`** — a third table for tracked-case order PDFs written by `download-order-pdf`.

---

## 11. ALERTS & NOTIFICATIONS

### `notifications` table & types
`20251230210302:31-44`. `notification_type CHECK('approaching','skipped','removed','anomaly')`, `severity('info','warning','critical')`, `threshold_crossed('early_warning','imminent','immediate','exception')`, `status('sent','read','acknowledged','escalated')`; realtime on.

### What creates notifications
**No triggers or edge functions insert notifications** — creation is **client-side** in `useCourtNotifications.ts`. Its live-board monitoring effect computes `calculateItemDistance(item.item_no, liveBoard.current_item)` per matched case and, on a threshold crossing or skip, calls `createNotification` (insert into `notifications`, `:158-170,258-270`), plus a reconnect-replay insert (`:287-300`). Types `removed`/`anomaly` are allowed by the CHECK but never written.

### Frontend display
`NotificationBell.tsx` (bell + Popover, unread badge, acknowledge for critical, plays sound on new critical). Data via `useCourtNotifications` (RQ, last 50). **Realtime, not polling** — channel `notifications-changes` on `notifications` filtered by `user_id` invalidates the query (`:106-120`). No `refetchInterval`.

### `escalate-whatsapp` — honest trace
Validates input, enforces a daily-limit guard against `notification_escalations`, builds a message string, then `// TODO: Integrate with actual WhatsApp API` + `console.log("Would send WhatsApp …")` — **no fetch/Twilio/Meta call anywhere** (`:68-71`). It inserts `notification_escalations` with hardcoded `status:'sent'` (`:74-83`) and updates the source notification to `status:'escalated'` (`:100-103`), returning `{success:true}`. The client (`useNotificationEscalation.ts:127-129`) then toasts "Alert escalated via WhatsApp", reinforcing a false impression. **It sends nothing.**

### `notification_escalations`
`20251230210302:63-73`. Audit + dedup: partial unique `(user_id, case_fingerprint, escalation_date, channel) WHERE status='sent'` enforces ≤1 escalation per case/day. **Writer:** only `escalate-whatsapp`. **Reader:** no runtime reader found (only the function's own dup-check). Note the escalation key passed is `notification.docket_id`, not a human case fingerprint (`useNotificationEscalation.ts:64`).

---

## 12. ADMIN & OPERATIONS SURFACES

### `/admin` "Sovereign Console" (`Admin.tsx`)
ADMIN-gated (client-side `isAdmin`, "Access Denied" otherwise). 15 tabs → panels (`Admin.tsx:72-193`): UserCasesViewer, BciVerificationQueue, AdminErrorConsole (default), ConfidenceDashboard, FallbackDashboard, AuditConsole, CauseListScraper, AiJobsMonitor, DocketManager, ArgumentsManager, JudgmentReferencesManager, CourtConfig, SyncMonitorPanel, DataValidationPanel, ForceUpdateControl. (`LiveBoardSimulator` and `DocumentSyncTrialPanel` exist in the dir but are not mounted here.)

Panel actions (all **REAL** DB/edge actions): BCI verify/reject (RPC `set_bci_verification_status`); error resolve/bulk-resolve; fallback enable/disable per bench; audit CRUD (`audit_runs/findings/risks`); docket insert/update/delete; arguments CRUD; judgment-references insert/delete; CourtConfig upsert/reset `live_board_cache`; SyncMonitorPanel force-sync (`sync-live-board`); DataValidationPanel run-all (`data-validation`); ForceUpdateControl increments `app_config.force_update_version`.

### HiddenAdminPortal (`HiddenAdminPortal.tsx`)
Mounted only on the **Auth page** (7 logo clicks), ADMIN-gated. Shows `case_parse_queue` stats + realtime Parse Queue and Recent Causelists (realtime on both tables). **Only action: "Trigger Parse" → `invoke('parse-case')`** (`:150`) — which currently finds an empty queue (§5).

### OperationsConsole (`OperationsConsole.tsx`)
Hidden modal via 7 rapid logo clicks (mounted in `AppHeader.tsx:91-94`), ADMIN-gated. 5 tabs (Beta Observability, System Health, Parsing & AI, Data & Storage, Subscriptions). **"Unstick All"** resets stale processing `ai_jobs` to pending (REAL, `:157-173`). **Subscriptions tab is an explicit empty state "Subscription System Not Implemented"** (`:372-376`). Storage tab has only an advisory "Retention Note" TODO. No `functions.invoke`.

### AiJobsMonitor (`AiJobsMonitor.tsx`)
6 stat cards + last 50 `ai_jobs` (auto-refresh 10s). Actions: **"Trigger Worker Now" → `invoke('ai-worker')`** (`:157`), retry job, delete job. All REAL.

### CauseListScraper (`CauseListScraper.tsx`)
No "run scraper" button — ingestion is Telegram-driven. Shows recent causelists, the CauseListUploader child, a Telegram webhook status card (raw `fetch` to `telegram-webhook?action=status`, hardcoding project ref `pwpnnixoscppfzjogcgj`, `:61-64`), and recent `scraper_logs`. The ingest trigger is in CauseListUploader (raw `fetch` POST to `upload-causelist`). REAL.

### ProductDossier (`/dossier`)
A **static** 945-line marketing/spec page (Izafa Labs) with Save-as-PDF (`window.print()`); no remote data. (TechnicalDossier `/technical-dossier` is a separate static tech doc, unlinked from the sidebar.)

**Stub summary across admin:** only OperationsConsole→Subscriptions is labeled "not implemented"; plus the SmartPdfViewer AI Summary (fake) and pen/eraser/search tools (no handlers), and escalate-whatsapp (logs, never sends). No console.log-only fake buttons were found in the admin panels themselves.

---

## 13. BILLING & SUBSCRIPTION — CURRENT STATE

- **`subscriptions` table** (`20251229182944:55`): `plan_type CHECK('free','individual','chamber')`, `status CHECK('active','past_due','canceled','trialing','expired')`, plus `stripe_customer_id`, `stripe_subscription_id`. RLS: SELECT own/ADMIN; ALL = service role.
- **`useSubscription`** reads `subscriptions` (`useSubscription.ts:24`), derives `isActive = status==='active'`, `isPro = isActive && plan_type==='pro'`, `isFree = !subscription || plan_type==='free'`. **`upgradeToPro`/`cancelSubscription` are `console.log` no-ops** (`:46-52`) and are never called. Bug: `isPro` checks `'pro'`, which is not a valid `plan_type` per the DB CHECK — so `isPro` can never be true.
- **`SubscriptionBadge`** is the only consumer of `isPro/isFree`, and it is **never mounted** anywhere.
- **No code ever writes `subscriptions`** (no insert/update/upsert in `src` or `supabase/functions`). The `stripe_*` columns are never populated.
- **No payment edge function exists**; `razorpay` appears nowhere; Stripe is comment-only.
- **`has_active_subscription()` RPC** is defined (`20251229182944:163-176`) but **has no callers** in client code, RLS, or edge functions.
- **No feature gating exists** — no route/feature is conditioned on plan. OperationsConsole openly labels the subscription system "Not Implemented".

**Honest summary:** every user is effectively `isFree`, and that state gates nothing. Regardless of "plan," a user gets the full app; there is no way to pay and nothing is withheld.

---

## 14. PWA & OFFLINE BEHAVIOR

### Service worker
`vite-plugin-pwa` in **generateSW** mode, `registerType:'autoUpdate'` (`vite.config.ts:15`) — **no custom `src/sw.ts`**. Workbox: `clientsClaim`+`skipWaiting` (actual reload gated by `usePWAUpdate`), precache `**/*.{js,css,html,ico,png,svg,woff2}` (≤3MiB), `navigateFallback:/index.html` denylisting `/api` and `/supabase`. Runtime caching (`vite.config.ts:68-166`):
- Supabase **REST** → NetworkFirst, 5min, 10s timeout ("never serve stale court data").
- Supabase **realtime** and **auth** → **NetworkOnly** (auth never cached — court-complex shared devices; README claim verified, `:90-94`).
- `sync-live-board`/`scrape-live-board` → NetworkFirst 60s; other edge fns → NetworkFirst 10min.
- `*.pdf` → CacheFirst 7d; storage → StaleWhileRevalidate 1d; images → CacheFirst 30d.
- Production build strips `console.log/.debug/.info` (`:178-180`).

### IndexedDB (library `idb`; no localforage)
- **`vakalat-os-cache` v1** (`useOfflineCache.ts:46-81`): stores `docket-items`, `case-documents` (PDF **Blobs**, served via `URL.createObjectURL`), `case-arguments`, `pending-mutations` (the offline write queue).
- **`nyayhub-query-cache` v1** (`useCacheIntegration.ts:25-38`): single `query-cache` store, **24h** max age; hydrates React Query on mount (`useCacheHydration`) for docket/liveBoard/morning-brief/upcoming.
- In-memory only (lost on reload): `useQueryCache` (Map TTL) and `useOfflineThresholdMemory` (proximity-threshold crossings while offline; replays critical/today-only/once-per-case on reconnect).

### Sync engine (`usePendingSync.ts`)
Consumes `pending-mutations`. **Scope is narrow — only `post_court_notes`**; any other table throws "Unsupported table for offline sync" (`:104-106`). Conflict resolution compares server `updated_at`; on conflict surfaces a `SyncConflictContext` dialog (discard-local / keep-local). So the **only** thing that genuinely writes back from offline is post-court notes.

### PWA update flow
`usePWAUpdate` checks on load, visibility-change, and a 5-min interval (online+visible). Applies only when **safe** — `usePWAUpdateSafety.isSafeToReload` requires `pendingCount===0`, not syncing, no dirty forms, no active conflict, online, **and court-mode disabled**; otherwise defers (toast "Will apply when safe"). `useForceUpdate` is a server-driven kill-switch reading `app_config.force_update_version`; if newer and safe it clears caches (preserving auth + the two app IndexedDB DBs) and reloads, else defers to next session.

### Network awareness
`useNetworkStatus` — `navigator.onLine` + listeners, **debounced 3s** (courthouse-network flapping), exposes `blockIfOffline(action)` write-guard ("Connection required… Viewing is available"). `useConnectionHealth` — 30s `profiles` latency probe (unhealthy ≥5s or ≥3 failures) + realtime transport status; `getConnectionMetrics()` is a stub returning zeros.

### What works offline (honest)
- **Read offline:** cached dashboard data (docket, live-board snapshot, morning brief, upcoming — up to 24h old), previously cached PDFs/images/storage docs, app shell.
- **Write offline (queued):** **only post-court notes**; plus volatile proximity-threshold notifications replayed on reconnect.
- **Requires connectivity:** auth, realtime, all REST beyond the 5-min fallback, live board (60s cache → effectively online-only), every edge-function feature, and any write other than post-court notes.

---

## 15. CONFIGURATION & ENVIRONMENT

### Environment variables
**Frontend (`import.meta.env`):** `VITE_SUPABASE_URL` (`client.ts:5`), `VITE_SUPABASE_PUBLISHABLE_KEY` (`client.ts:6`), `VITE_SUPABASE_PROJECT_ID` (`useAuth.ts:92`), `VITE_SENTRY_DSN` (`sentryStub.ts:21`), `VITE_APP_VERSION` (`errorReporting.ts:160`, falls back to `'1.0.0'`, undocumented), Vite `DEV`.
**Backend (`Deno.env.get`):** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `ALLOWED_ORIGINS` (`_shared/cors.ts:11`); AI `GOOGLE_AI_API_KEY`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`; scraping `TWOCAPTCHA_API_KEY`, `FIRECRAWL_API_KEY`, `BROWSERLESS_API_KEY` (undocumented), `INDIAN_KANOON_API_KEY` (undocumented); alerts `TELEGRAM_BOT_TOKEN`, `ADMIN_TELEGRAM_CHAT_ID`; auth `TRIGGER_SECRET`, `CRON_SECRET` (undocumented). `.env` (tracked) holds anon-level frontend values; `.env.example` documents most backend vars + 4 `app.settings.*` Postgres settings. **Undocumented-in-example:** `VITE_APP_VERSION`, `BROWSERLESS_API_KEY`, `INDIAN_KANOON_API_KEY`, `CRON_SECRET`.

### `config.toml` verify_jwt
- **true:** simulate-live-board, sync-live-board, data-validation, escalate-whatsapp, upload-causelist.
- **false:** auto-match-aliases, scrape-causelist, health-check, scrape-telegram-causelist, telegram-webhook, scrape-live-board, download-causelists, extract-causelist-notes, scan-lawyer-names, parse-case, parse-all-cases, test-firecrawl-pdf, test-pdf-parse, pdf-extract-chunk, ai-worker, search-indian-kanoon, html-extract, html-causelist-parse, match-docket-aliases, backfill-alias-matches, revoke-expired-interns, create-intern-account, aggregate-case-durations.
- **Absent (default true):** account-deletion, admin-doc-sync-trial, alert-p0-errors, backfill-parties, check-case-judgment, derive-hearing-likelihood, download-order-pdf, fetch-case-orders, scan-causelist-listings, sync-case-documents.

### Cron (pg_cron)
- `alert-p0-errors` `*/15 * * * *` (`20260518000002`).
- `scrape-causelist-jaipur` `30 1 * * 1-6`, `scrape-causelist-jodhpur` `32 1 * * 1-6`, `revoke-expired-interns` `30 0 * * *` (`20260518000003`).

### External services (REAL vs STUB)
- **REAL:** Supabase; Google Gemini (`gemini-2.0-flash` in workers, `2.5-flash` in webhook); OpenAI (`gpt-4o-mini`, fallback); OpenRouter (last fallback + vision); Indian Kanoon (API + HTML fallback); Firecrawl (real, but the `scrape-causelist` PDF path is a dead `return []`); Browserless (real in `admin-doc-sync-trial`; discarded in `scrape-causelist`); 2Captcha (`check-case-judgment`, `sync-case-documents`, trial); Telegram (webhook + getFile + sendMessage).
- **STUB / ABSENT:** **WhatsApp** — stub that logs and falsely records `status:'sent'` (`escalate-whatsapp:68-79`); **Razorpay** — absent everywhere; **Stripe** — comment-only placeholders, unused `stripe_*` columns; **Sentry** — intentional no-op (`sentryStub.ts:20-24`, `@sentry/react` not installed; errors go to `admin_error_events`).

### Deployment
**No `vercel.json` / `netlify.toml`** (static SPA; edge fns via `supabase functions deploy`). Only workflow is **`.github/workflows/ci.yml`**: on push/PR to `main`, Node 20 — `npm ci`, typecheck, ESLint (`--max-warnings 0` but `continue-on-error:true`), `npm test`, `npm run build` (dummy env), and a Python check that each migration's `BEGIN;`/`COMMIT;` counts balance. **No deploy step** — verification only.

---

## 16. KNOWN GAPS & HONEST CAPABILITY STATEMENT

**What the product genuinely does today:**
- Ingests Rajasthan HC cause-lists via the **Telegram pipeline** (webhook → download → text-extract → AI/regex parse → `daily_court_docket`) and admin uploads, for the Jaipur and Jodhpur benches.
- **Matches** listed cases to lawyers by name aliases (in-DB on insert; retro-backfill on new aliases).
- Serves a **realtime per-lawyer docket**, a Morning Brief with readiness/risk scoring, and a **live court-board** with proximity tracking and in-app notifications.
- Provides hearing-prep (War Room: arguments, documents with versioning + senior review, real PDF viewer with highlights, Indian Kanoon precedent search), junior upload/whisper (Control Deck), in-court read-only Courtroom Mode, and post-court outcome capture.
- Real role/permission model with chambers, scoped clerk delegation, sandboxed time-boxed interns, DPDP consent + account deletion, and an admin console for ops.
- 2Captcha-based eCourts **judgment check** and **document sync** for tracked cases (as-written; dependency- and HTML-fragile).
- Offline read of cached dashboard data + offline capture of post-court notes; safety-gated PWA updates; courthouse-network-aware UX.

**What it shows or promises but cannot deliver:**
- **WhatsApp escalation** reports success while sending nothing (`escalate-whatsapp`) — the most material false positive; the lawyer believes a critical alert went out.
- **In-UI "AI" features** (strategy, PDF summary, points of law) are hardcoded `setTimeout` theater; "case summary" calls a non-existent `ai-worker` action; "find precedents" is unwired (though its backend works).
- **Billing**: no payment rail; every user is `isFree`; nothing is gated.
- **On-demand court orders** (`fetch-case-orders`) never submits the form (routes to a manual CAPTCHA queue); the direct-portal `scrape-causelist` extracts zero cases.
- Annotation **pen/eraser/search** tools are selectable but do nothing.
- Two AI parsers (`parse-case`, `parse-all-cases`) are starved/dead; the `auto-match-aliases` edge function is orphaned.

**Single most fragile dependency:** the **Telegram ingestion pipeline**. The entire working spine depends on the right HC cause-list PDF reaching the watched channel and Gemini parsing it correctly. There is no pg_cron drain for `ai-worker` (jobs are drained by an admin clicking "Trigger Worker Now" or an external scheduler not in this repo), the webhook secret-token check is bypassable when the header is absent, and there is no robust failure alerting on parse gaps. If the channel/bot changes or Gemini quota is exhausted, ingestion silently degrades to zero with no user-facing signal.

**What would break first under 10 advocates daily:** AI parse throughput and freshness. `ai-worker` enforces a 250k-tokens/hour budget and is not reliably cron-driven, so a morning burst of cause-lists across two benches would queue in `ai_jobs` and the docket could lag behind the day's listings — while the live board (60s cache, online-only) and notifications keep promising real-time accuracy. Secondarily, the eCourts scraping path (2Captcha + brittle HTML regex) and the always-online live board would be the next to strain on courthouse networks.
