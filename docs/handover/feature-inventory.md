# NyayHub / Vakalat-OS — Complete Feature Inventory

> Honest, audited inventory of every shipped feature. Companion to
> `docs/handover/causelist-and-matching-pipeline.md`.
> Scope: Rajasthan High Court (Jaipur + Jodhpur). Generated 2026-06-26.

**Status legend:** Working · Partial (works with gaps) · Stub (UI/table exists, no real logic) · Dead (no caller).

---

## 1. Auth & Onboarding

### 1.1 Sign-In / Sign-Up — **Working**
- `src/pages/Auth.tsx`, `src/hooks/useAuth.ts`
- Email/password via Supabase Auth. Role (SENIOR / JUNIOR / CLERK) captured at signup, not changeable post-hoc (UI-enforced only).
- Network-aware error messages. 7-click logo opens `HiddenAdminPortal`.

### 1.2 Onboarding Wizard — **Working**
- `src/pages/Onboarding.tsx`, `src/components/onboarding/*`
- 5 steps: Consent → Profile → AliasManager → Chamber → CourtScan.
- Writes `user_consents` (insert uses `supabase as any` — table not in generated types).

### 1.3 BCI Verification — **Working (manual only)**
- `src/components/admin/BciVerificationQueue.tsx`, `profiles.bci_verification_status`, RPC `set_bci_verification_status`.
- 100 % manual admin review. No external Bar Council API.

### 1.4 Roles — **Working**
- `user_roles` table (canonical), `profiles.role` (display only). Roles: SENIOR, JUNIOR, CLERK, ADMIN, INTERN.
- `get_user_role` RPC, `has_role` SQL function used in RLS.

### 1.5 Idle Logout Guard — **Working**
- `src/components/layout/IdleLogoutGuard.tsx`.

---

## 2. Dashboard & Five Modes

### 2.1 Dashboard Shell — **Working**
- `src/pages/Dashboard.tsx`. Three-pane, draggable right-column widgets (Framer Motion Reorder), URL-synced tabs, role-based default, IndexedDB hydration.

### 2.2 Morning Brief (Mode 1) — **Working** (with one stub)
- `src/hooks/useMorningBrief.ts`, `src/components/morning-brief/*`, `src/lib/briefExport.ts`.
- Readiness score, attend/delegate/monitor classification, "Up Next", legal-size PDF export.
- **`AiStrategyPanel` is a STUB** — `setTimeout` returning hardcoded dummy text, no API call.

### 2.3 War Room (Mode 2) — **Mostly Working**
- `/war-room/:caseId`, `src/pages/WarRoom.tsx`.
- Arguments, Documents (approval workflow), History, AI Insights, JudgeIntelligence, JudgmentReferences, PostCourtNote, WhisperDrawer, SmartPdfViewer.
- Hardcoded fallback `pdfobject.com/pdf/sample.pdf` at `WarRoom.tsx:44` when no docs.

### 2.4 Control Deck (Mode 3, Junior) — **Working**
- `/control-deck/:caseId`. Distance-to-call countdown, document upload, WhisperInput, panic indicator at ≤5 items.

### 2.5 Courtroom Mode (Mode 4) — **Working**
- `/courtroom`. Read-only full-screen snapshot, cached to IndexedDB.

### 2.6 Post-Court Capture (Mode 5) — **Working**
- `post_court_notes` keyed on `case_fingerprint` + `hearing_date`. Skip-all in sessionStorage.

---

## 3. Cause List Ingestion

Full detail in `causelist-and-matching-pipeline.md`. Channels: admin upload (PDF/HTML), Telegram webhook, web scrapers (orphaned). Worker: `ai-worker` (Gemini → OpenAI → OpenRouter). Auto-match: SQL trigger (live), `match-docket-aliases` cron (degraded), `auto-match-aliases` + `backfill-alias-matches` (dead).

---

## 4. Docket Views

### 4.1 Daily Docket — **Working**
- `src/hooks/useDocket.ts`, `DocketCard`, `DualStreamCaseList`.
- 4 dashboard tabs: daily, supplementary, upcoming, search. Bench-filtered client-side. Force Active = admin/senior override of `matched_profile_id`.

---

## 5. Live Board / VC

### 5.1 Live Board — **Working**
- `live_board_cache`, edge fns `scrape-live-board`, `sync-live-board`. Realtime with granular patch (no full invalidate).

### 5.2 Whisper Live Feed — **Working** (debt)
- `live_courtroom_feed`, channel `whisper-{docketId}`.
- Voice memos stored as base64 `[VOICE_MEMO]…` in the `message` text column. No blob storage. Size-limited by row size.

### 5.3 VC Links — **Working**
- `useVirtualCourt`, `vc_click_events`. Only renders for today + confidence ≥ 50. Interns blocked.

### 5.4 Live Board Simulator — **Working (test tool)**
- `src/components/admin/LiveBoardSimulator.tsx` AND `src/components/dashboard/LiveBoardSimulator.tsx` — second copy is in the production widget column.

---

## 6. Aliases — **Working**
- `lawyer_aliases`, `useAliases`, `AliasManager`, admin `LawyerSearchPanel`.

---

## 7. Chambers — **Working**
- `chambers`, `chamber_memberships`, `chamber_invites`. Senior-created, invite-coded with role assignment, revocable. **No chamber dashboard by design.**

---

## 8. Interns (feature-flagged: `intern-supervision-enabled`, default OFF)

| Sub-feature | Status | Note |
|---|---|---|
| Accounts (`intern_accounts`) | Working | `create-intern-account`, `revoke-expired-interns` |
| Case assignments (`intern_case_assignments`) | Working | `intern_can_access_case` RPC |
| **Intern drafts (`intern_drafts`)** | **Partial** | Review UI works; **no intern-facing draft editor exists** |
| Access log (`intern_access_log`) | Working | `log_intern_access`, `v_intern_activity_digest` |
| Permissions (`useInternPermissions`) | Working | |

---

## 9. Clerks & Delegations — **Working**
- `clerk_delegations`, `delegated_actions`. Scope allow-list with explicit forbidden scopes (`claim_ownership`, `confirm_matches`).
- RPCs: `log_delegated_action`, `get_active_delegation`, `has_delegation_scope`.
- Audit views: `v_clerk_ownership_violations`, `v_delegation_scope_violations`.

---

## 10. Notifications & Escalations

### 10.1 In-App — **Working**
- `notifications` table, `NotificationBell`, sound loop on unacked critical.

### 10.2 WhatsApp Escalation — **Partial / functionally dead**
- `escalate-whatsapp` edge fn, `notification_escalations` table.
- **No UI to set `profile.whatsapp_number`** → escalation cannot fire without manual DB edit.

---

## 11. Post-Court Notes — see §2.6.

---

## 12. Judgments

| # | Feature | Status |
|---|---|---|
| 12.1 | Judge observations (`judge_observations`) | Working |
| 12.2 | Chamber observation sharing (`judge_observation_sharing`) | Working |
| 12.3 | Judgment check jobs (`judgment_check_jobs`) | **Partial** — requires 2Captcha key; 7-day cooldown, max 10 attempts (`can_check_judgment`) |
| 12.4 | Judgment attachments (`judgment_attachments`) | **Partial** — no dedicated browse UI |
| 12.5 | Curated references (`judge_judgment_references`) + IndianKanoon search | Working |
| 12.6 | Judgment audit log (`judgment_audit_log`) | Working |

---

## 13. Court Orders / Document Sync

| # | Feature | Status |
|---|---|---|
| 13.1 | `sync-case-documents` + `synced_court_documents` (eCourts + 2Captcha) | **Partial** — needs production CAPTCHA key |
| 13.2 | `order_fetch_jobs` + `fetch-case-orders` | Partial — no dedicated queue UI |
| 13.3 | `document_processing_queue` + `pdf-extract-chunk` | Working (part of causelist pipeline) |

---

## 14. Cases (long-lived)

| Table | Status | Note |
|---|---|---|
| `case_arguments` + annotations | Working | `ArgumentsPanel`, `AnnotationToolbar`, admin `ArgumentsManager` |
| `case_hearings` | **Partial** | Hook exists; UI reads listing history from `daily_court_docket` instead |
| `case_judgments` | Working | Status-validated, triggers audit log |
| `tracked_cases` | Working | Pivot for all post-hearing flows; **no "My Tracked Cases" list page** |
| `lawyer_case_notes` | Working | Embedded inside `CaseExportPanel` (awkward) |
| Listing history | Working | `ListingHistoryPanel`, `CaseHistoryPanel` |

---

## 15. Audit & Observability

| Table / Tool | Status |
|---|---|
| `audit_runs` / `audit_findings` / `audit_risks` + AuditConsole | Working (internal dev tool) |
| `parser_confidence_runs` + ConfidenceDashboard + `DataConfidenceWarning` | Working |
| `parser_fallback_log` + FallbackDashboard | Working |
| `causelist_gap_audit` | **Stub** — table only, no frontend writer/reader |
| `docket_cleanup_log` | **Dead** — no frontend reference |
| `data_validation_logs` + DataValidationPanel + `data-validation` fn | Working |
| `scraper_logs` + ParsingHealthDashboard | Working |
| `admin_error_events` + AdminErrorConsole + `alert-p0-errors` | Working |

---

## 16. Admin Tools (`/admin`)

User Cases · Errors · Confidence · Fallback · Audit · Scraper · AI Jobs · Docket · Arguments · Court Config · Sync Monitor · Data Validation · Judgment Refs · Doc Sync Trial · Force Update · BCI Queue · **Operations Console** (via 7-click hidden portal: BetaObservabilityPanel, AI jobs, security events, subscriptions). All **Working**.

---

## 17. Settings (`/settings`)

| Tab | Status |
|---|---|
| Profile | Working |
| Aliases | Working |
| Privacy (DPDP: `request_data_export`, `account-deletion`) | Working |

- **Court Mode Settings** (`court_mode_settings`) — surfaced via `CourtModeBadge` in header, not in `/settings`. WhatsApp escalation toggle exists; phone-number input does not.
- **Notification settings** — sound toggle inline on the bell; no settings page.

---

## 18. Subscriptions / Billing — **STUB (dead pipeline)**
- `subscriptions` table read by `useSubscription`. `upgradeToPro` is a `console.log`.
- No Stripe/Paddle SDK, no webhook handler, no writer in production. Badge displays a value nothing populates.

---

## 19. PWA / Offline

### 19.1 PWA Install / Update — **Working**
- `InstallDiscoveryBanner`, `PostInstallConfirmation`, `PWAUpdateManager`, `ForceUpdateBlockedDialog`.

### 19.2 IndexedDB Cache — **Partial**
- DBs: `vakalat-os-cache` (v1, `useOfflineCache`), `nyayhub-cache` (v2, `useCacheIntegration`).
- Read cache (docket, live board, brief, upcoming, courtroom snapshot) works.
- **`pending-mutations` store defined but never written or read** — offline write queue is scaffolded, not implemented.

### 19.3 Conflict Resolution — **Stub**
- `SyncConflictContext` + `ConflictResolutionDialog` exist; no detection logic wired to mutations.

---

## 20. AI Features

| Feature | Status |
|---|---|
| `ai_jobs` queue + `ai-worker` (Gemini → OpenAI → OpenRouter, 250k tok/hr budget) | Working |
| `ai_parse_cache` (hash-keyed reuse) | Working |
| `token_usage_daily` + AiJobsMonitor | Working |
| **Morning Brief `AiStrategyPanel`** | **STUB** — hardcoded dummy via `setTimeout` |
| WarRoom `AIInsightPanel` (`summarize_case` action + IndianKanoon) | **Partial** — IndianKanoon live; `summarize_case` handler in `ai-worker` needs verification (worker is built around `parse_causelist`) |

---

## 21. Security

| Feature | Status |
|---|---|
| `captcha_queue` / `captcha_usage_log` (2Captcha) | Partial — `captcha_queue` has no admin UI |
| `security_events` + `log_security_event` | Working (passive logging) |
| `user_roles` + `has_role` | Working |
| `SensitiveViewGuard` (screen-share blur) | Working |

---

## 22. Miscellaneous

| Item | Status | Note |
|---|---|---|
| `court_overrides` | Working | Judge-range overrides for parser, admin-managed |
| `fallback_disabled_benches` | Working | Per-bench fallback kill switch |
| `bench_procedural_patterns` | **Partial** | Read hook only; **no writer found** |
| `vc_click_events` | Working | |
| `case_export_logs` | Working | Audit of all exports |
| `case_item_durations` + `court_avg_duration` + `aggregate-case-durations` + `CaseTimeEstimator` | Working | |
| `raw_causelists_archive` | Working | Re-parse backup |
| Court Focus Mode (`CourtFocusOverlay`) | Working | Triggered by proximity in court mode |
| Global Command Palette (⌘K) | Working | |
| Force Update (`app_config.force_update`) | Working | |
| i18n (`src/lib/i18n.ts`, `LanguageToggle`) | **Stub** | Toggle exists, coverage minimal |
| `profile_scan_log` + onboarding `CourtScan` + `scan-causelist-listings` | Working | |
| `daily_execution_policies` | Backend-only | No frontend UI |

---

## 23. Summary Matrix

| Domain | Working | Partial | Stub / Dead |
|---|---|---|---|
| Auth & onboarding | Sign-in, wizard, consent, roles, idle guard | BCI (manual only) | — |
| Dashboard modes | Brief, WarRoom, ControlDeck, Courtroom, Post-Court | WarRoom AI Insights | **AiStrategyPanel** |
| Causelist ingestion | All live channels | Scrapers orphaned | `auto-match-aliases`, `backfill-alias-matches`, scrape-causelist crons |
| Docket views | Full | — | — |
| Live board / VC | Scraper, realtime, VC button, click log | — | LiveBoardSimulator (demo) |
| Aliases | Full | — | — |
| Chambers | Full | — | — |
| Interns | Accounts, assignments, access log | **Draft creation UI missing** | — |
| Clerks / delegation | Full | — | — |
| Notifications | In-app + sound | **WhatsApp (no phone UI)** | — |
| Post-court notes | Full | — | — |
| Judgments | Observations, sharing, references, audit | Judgment check (2Captcha), attachments UI | — |
| Court orders / doc sync | Pipeline | Needs production CAPTCHA key | — |
| Case data | Arguments, judgments, tracked, notes, history | `case_hearings` no UI, no tracked-cases page | — |
| Audit | AuditConsole, parser confidence, fallback, errors, validation | `causelist_gap_audit` | **`docket_cleanup_log`** |
| Admin tools | Full suite | — | — |
| Settings | Profile, aliases, DPDP | No WhatsApp number field | — |
| Subscriptions | — | — | **Entire billing pipeline** |
| PWA / offline | Install, update, read cache | Write queue scaffolded | Conflict resolution |
| AI | Causelist parsing pipeline | WarRoom summarise | **AiStrategyPanel** |
| Security | RLS, roles, events, screen-share guard | `captcha_queue` no UI | — |
| Misc | Court Focus, ⌘K, Force Update, durations, overrides | `bench_procedural_patterns` (no writer) | **i18n** |

---

## 24. Top Cleanup Candidates

Ranked by user-visibility risk:

1. **`AiStrategyPanel`** — ship-blocker. Hardcoded fake AI is visible to every senior user. Either implement or remove from Morning Brief.
2. **Subscriptions / billing UI** — Pro badge displays without any payment path. Either gate it behind a flag or remove until Stripe/Paddle is wired.
3. **WhatsApp escalation** — add the phone-number input or hide the toggle.
4. **Intern draft creation** — interns can't actually submit drafts despite the review queue. Either build the editor or disable the review path.
5. **Conflict resolution dialog** — currently misleading: looks like offline write support but does nothing.
6. **`LiveBoardSimulator` on the Dashboard widget column** — demo tool inside the production widget area; move to admin only.
7. **i18n** — partial Hindi coverage. Decide: complete or remove the toggle.
8. **Dead tables/functions** — `docket_cleanup_log`, `auto-match-aliases`, `backfill-alias-matches`, orphan scrapers — see §1 of causelist doc.

---

*End of inventory. Anchored to specific files and tables; treat any drift as a documentation bug.*
