import { Button } from "@/components/ui/button";
import { ArrowLeft, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

const ProductDossier = () => {
  const navigate = useNavigate();

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header - hidden in print */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border print:hidden">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Product System Dossier</h1>
              <p className="text-xs text-muted-foreground">Built by Izafa Labs</p>
            </div>
          </div>
          <Button onClick={handlePrint} className="gap-2">
            <Download className="h-4 w-4" />
            Save as PDF
          </Button>
        </div>
      </header>

      <ScrollArea className="h-[calc(100vh-64px)] print:h-auto">
        <div className="container mx-auto px-4 py-8 max-w-4xl print:max-w-none print:px-8">
          
          {/* Title Page */}
          <div className="text-center mb-12 print:mb-8 print:page-break-after">
            <h1 className="text-4xl font-bold text-foreground mb-4">📘 VAKALAT-OS</h1>
            <h2 className="text-2xl text-muted-foreground mb-6">Product System Dossier</h2>
            <p className="text-lg text-primary font-medium">Built by Izafa Labs</p>
            <p className="text-sm text-muted-foreground mt-4">
              Generated: {new Date().toLocaleDateString('en-IN', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Confidential — For Archival & Reference Only
            </p>
          </div>

          <Separator className="my-8" />

          {/* Section 1 */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
              1️⃣ PRODUCT OVERVIEW
            </h2>
            
            <div className="space-y-4 text-foreground/90">
              <div>
                <h3 className="font-semibold text-foreground mb-2">What is Vakalat-OS?</h3>
                <p>Vakalat-OS is a litigation workflow operating system purpose-built for advocates practicing at Rajasthan High Court (Jodhpur and Jaipur benches). It transforms the daily operational burden of tracking cause lists, monitoring live court boards, and preparing for hearings into an automated, role-aware digital workflow.</p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">Who Izafa Labs Built It For</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li><strong>Senior Advocates</strong> — need instant visibility into their docket without manual tracking</li>
                  <li><strong>Junior Advocates</strong> — manage multiple seniors' cases, need clear task delegation</li>
                  <li><strong>Clerks</strong> — handle document organization and basic case monitoring</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">Real-World Problem Solved</h3>
                <p>Daily cause lists at Rajasthan HC are published as multi-hundred-page PDFs. Lawyers manually search for their names across courts, track item numbers, monitor live boards for when their case is called, and coordinate with juniors — all while preparing arguments. Vakalat-OS automates this entirely.</p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">What Izafa Labs Intentionally Chose NOT to Solve</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Case filing and e-filing integration</li>
                  <li>Legal research and case law lookup</li>
                  <li>Client billing and accounts management</li>
                  <li>Multi-court expansion beyond Rajasthan HC</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">Design Philosophy</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li><strong>Lawyer-first UX</strong> — designed for courtroom conditions (poor connectivity, stress, time pressure)</li>
                  <li><strong>Offline-capable</strong> — critical data cached locally via IndexedDB</li>
                  <li><strong>Role-based delegation</strong> — seniors delegate, juniors execute, clerks support</li>
                  <li><strong>Minimal manual entry</strong> — aliases auto-match; cases appear automatically</li>
                </ul>
              </div>
            </div>
          </section>

          <Separator className="my-8" />

          {/* Section 2 */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
              2️⃣ USER TYPES & ROLES
            </h2>

            <div className="space-y-6">
              <div className="border border-border rounded-lg p-4">
                <h3 className="font-bold text-foreground mb-2">SENIOR (Senior Advocate)</h3>
                <p className="text-sm text-muted-foreground mb-2"><strong>Purpose:</strong> Primary decision-maker; owns the docket</p>
                <p className="text-sm text-muted-foreground mb-2"><strong>Permissions:</strong> Full access to own cases, documents, arguments, whispers</p>
                <p className="text-sm text-muted-foreground mb-2"><strong>Visible Features:</strong> Dashboard, War Room, Control Deck, Courtroom Mode, Morning Brief</p>
                <p className="text-sm text-muted-foreground"><strong>Restricted:</strong> Cannot access Admin Panel or Operations Console</p>
              </div>

              <div className="border border-border rounded-lg p-4">
                <h3 className="font-bold text-foreground mb-2">JUNIOR (Junior Advocate)</h3>
                <p className="text-sm text-muted-foreground mb-2"><strong>Purpose:</strong> Executes tasks delegated by seniors; manages case preparation</p>
                <p className="text-sm text-muted-foreground mb-2"><strong>Permissions:</strong> Upload documents, send whispers, capture post-court notes</p>
                <p className="text-sm text-muted-foreground mb-2"><strong>Visible Features:</strong> Dashboard, War Room, Control Deck, Courtroom Mode</p>
                <p className="text-sm text-muted-foreground"><strong>Restricted:</strong> Cannot modify senior's aliases or access admin functions</p>
              </div>

              <div className="border border-border rounded-lg p-4">
                <h3 className="font-bold text-foreground mb-2">CLERK</h3>
                <p className="text-sm text-muted-foreground mb-2"><strong>Purpose:</strong> Document organization and basic monitoring</p>
                <p className="text-sm text-muted-foreground mb-2"><strong>Permissions:</strong> View docket, upload documents, view live board</p>
                <p className="text-sm text-muted-foreground mb-2"><strong>Visible Features:</strong> Dashboard, Document upload, Live board view</p>
                <p className="text-sm text-muted-foreground"><strong>Restricted:</strong> Cannot send whispers, access War Room, or capture post-court notes</p>
              </div>

              <div className="border border-border rounded-lg p-4">
                <h3 className="font-bold text-foreground mb-2">ADMIN</h3>
                <p className="text-sm text-muted-foreground mb-2"><strong>Purpose:</strong> System operator; manages scraping, parsing, validation</p>
                <p className="text-sm text-muted-foreground mb-2"><strong>Permissions:</strong> Full system access including Operations Console</p>
                <p className="text-sm text-muted-foreground mb-2"><strong>Visible Features:</strong> All user features + Admin Panel + Operations Console</p>
                <p className="text-sm text-muted-foreground"><strong>Restricted:</strong> None (highest privilege level)</p>
              </div>
            </div>
          </section>

          <Separator className="my-8" />

          {/* Section 3 */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
              3️⃣ USER-FACING PORTAL WALKTHROUGH
            </h2>

            <div className="space-y-4 text-foreground/90">
              <div>
                <h3 className="font-semibold text-foreground mb-2">Entry Points</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li><strong>/auth</strong> — Login/signup via email (auto-confirmed)</li>
                  <li><strong>/onboarding</strong> — First-time setup: profile, bench selection, alias configuration</li>
                  <li><strong>/</strong> — Dashboard (post-onboarding default)</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">Main Screens</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li><strong>Dashboard (/)</strong> — Today's docket, live court widgets, cause list notes, scraper status</li>
                  <li><strong>War Room (/war-room)</strong> — PDF viewer, arguments panel, judgment references, annotations</li>
                  <li><strong>Control Deck (/control-deck)</strong> — Whisper system, voice memo recording, message history</li>
                  <li><strong>Courtroom Mode (/courtroom)</strong> — Panic alert, live board display, offline snapshot</li>
                  <li><strong>Admin Panel (/admin)</strong> — Cause list scraper, docket manager, data validation (ADMIN only)</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">Navigation Structure</h3>
                <p>Fixed bottom navigation bar on mobile; sidebar on desktop. Role-based visibility: Admin tab hidden from non-admins.</p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">Actions Users CAN Perform</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Add/edit lawyer name aliases</li>
                  <li>Upload case documents (PDF, images)</li>
                  <li>Annotate documents (highlights, notes)</li>
                  <li>Create and organize arguments</li>
                  <li>Send whispers (text/voice) to team members</li>
                  <li>Capture post-court notes</li>
                  <li>Generate client update messages</li>
                  <li>Trigger courtroom snapshot for offline use</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">Actions Users CANNOT Perform</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Manually add cases to docket (system-driven via cause list matching)</li>
                  <li>Edit parsed case details (read-only from source)</li>
                  <li>Access other users' documents or whispers</li>
                  <li>Modify live board data</li>
                  <li>Trigger cause list scraping (admin only)</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">Empty States</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>No cases today → "No cases scheduled" message with suggestion to check aliases</li>
                  <li>No documents uploaded → Upload prompt with drag-and-drop zone</li>
                  <li>No cause list available → "Cause list not yet published" with last update timestamp</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">Loading & Processing States</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Skeleton loaders for docket cards and widgets</li>
                  <li>Processing indicators for AI parsing ("Parsing cause list...")</li>
                  <li>Sync status badges showing live/stale/error states</li>
                </ul>
              </div>
            </div>
          </section>

          <Separator className="my-8" />

          {/* Section 4 */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
              4️⃣ CORE FEATURES & CAPABILITIES
            </h2>

            <div className="space-y-6">
              <div className="border-l-4 border-primary pl-4">
                <h3 className="font-bold text-foreground mb-2">Cause List Ingestion</h3>
                <p className="text-sm text-muted-foreground"><strong>What:</strong> Automatically downloads and parses daily cause list PDFs</p>
                <p className="text-sm text-muted-foreground"><strong>When:</strong> Triggered via Telegram webhook when court publishes PDFs</p>
                <p className="text-sm text-muted-foreground"><strong>Frequency:</strong> Multiple times daily (main list, supplementary lists)</p>
                <p className="text-sm text-muted-foreground"><strong>Data Dependency:</strong> Telegram bot subscription, PDF text extraction, AI parsing</p>
                <p className="text-sm text-muted-foreground"><strong>Output:</strong> Parsed cases in `daily_court_docket` table, matched to user profiles</p>
              </div>

              <div className="border-l-4 border-primary pl-4">
                <h3 className="font-bold text-foreground mb-2">Lawyer Name Matching</h3>
                <p className="text-sm text-muted-foreground"><strong>What:</strong> Matches extracted lawyer names against user-defined aliases</p>
                <p className="text-sm text-muted-foreground"><strong>When:</strong> Runs automatically after cause list parsing</p>
                <p className="text-sm text-muted-foreground"><strong>Frequency:</strong> Per case, per cause list</p>
                <p className="text-sm text-muted-foreground"><strong>Data Dependency:</strong> `lawyer_aliases` table, parsed case lawyer fields</p>
                <p className="text-sm text-muted-foreground"><strong>Output:</strong> `matched_profile_id`, `matched_role`, `match_confidence` in docket</p>
              </div>

              <div className="border-l-4 border-primary pl-4">
                <h3 className="font-bold text-foreground mb-2">Live Board Monitoring</h3>
                <p className="text-sm text-muted-foreground"><strong>What:</strong> Tracks real-time court display board showing current item number</p>
                <p className="text-sm text-muted-foreground"><strong>When:</strong> Continuous during court hours</p>
                <p className="text-sm text-muted-foreground"><strong>Frequency:</strong> 3-second refresh interval</p>
                <p className="text-sm text-muted-foreground"><strong>Data Dependency:</strong> Court display board scraping or simulation</p>
                <p className="text-sm text-muted-foreground"><strong>Output:</strong> `live_board_cache` with current item, status, timestamp</p>
              </div>

              <div className="border-l-4 border-primary pl-4">
                <h3 className="font-bold text-foreground mb-2">Morning Brief Generation</h3>
                <p className="text-sm text-muted-foreground"><strong>What:</strong> AI-generated summary of today's docket with priorities and alerts</p>
                <p className="text-sm text-muted-foreground"><strong>When:</strong> On-demand when user opens Morning Brief panel</p>
                <p className="text-sm text-muted-foreground"><strong>Frequency:</strong> Once per day per user (cached)</p>
                <p className="text-sm text-muted-foreground"><strong>Data Dependency:</strong> Today's matched cases, document status, historical patterns</p>
                <p className="text-sm text-muted-foreground"><strong>Output:</strong> Structured brief with readiness scores, suggested focus areas</p>
              </div>

              <div className="border-l-4 border-primary pl-4">
                <h3 className="font-bold text-foreground mb-2">Post-Court Capture</h3>
                <p className="text-sm text-muted-foreground"><strong>What:</strong> Quick-entry system for capturing hearing outcomes</p>
                <p className="text-sm text-muted-foreground"><strong>When:</strong> After each hearing (user-initiated)</p>
                <p className="text-sm text-muted-foreground"><strong>Frequency:</strong> Per case per hearing</p>
                <p className="text-sm text-muted-foreground"><strong>Data Dependency:</strong> Docket ID, case fingerprint, user input</p>
                <p className="text-sm text-muted-foreground"><strong>Output:</strong> `post_court_notes` record with what_happened, next_direction, note_for_next</p>
              </div>

              <div className="border-l-4 border-primary pl-4">
                <h3 className="font-bold text-foreground mb-2">Courtroom Snapshot</h3>
                <p className="text-sm text-muted-foreground"><strong>What:</strong> Bundles critical case data for offline access during hearings</p>
                <p className="text-sm text-muted-foreground"><strong>When:</strong> User-triggered before entering courtroom</p>
                <p className="text-sm text-muted-foreground"><strong>Frequency:</strong> On-demand</p>
                <p className="text-sm text-muted-foreground"><strong>Data Dependency:</strong> Active case documents, arguments, annotations</p>
                <p className="text-sm text-muted-foreground"><strong>Output:</strong> IndexedDB-cached bundle accessible without network</p>
              </div>
            </div>
          </section>

          <Separator className="my-8" />

          {/* Section 5 */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
              5️⃣ DATA & INFORMATION FLOW
            </h2>

            <div className="space-y-4 text-foreground/90">
              <div>
                <h3 className="font-semibold text-foreground mb-2">Data Sources</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li><strong>Telegram Bot</strong> — Receives cause list PDFs from court channels</li>
                  <li><strong>Court Display Boards</strong> — Scraped or simulated for live item tracking</li>
                  <li><strong>User Input</strong> — Aliases, documents, annotations, whispers, notes</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">Ingestion Flow</h3>
                <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`Telegram PDF → document_processing_queue → download-causelists
    → raw_causelists (storage + text) → parse-case (AI)
    → daily_court_docket → auto-match-aliases (trigger)
    → matched_profile_id populated`}
                </pre>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">Storage Architecture</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li><strong>raw_causelists</strong> — Archived PDF storage paths and extracted text</li>
                  <li><strong>daily_court_docket</strong> — Parsed, per-case records (daily ephemeral + persistent)</li>
                  <li><strong>case_documents</strong> — User-uploaded files in Supabase Storage</li>
                  <li><strong>live_board_cache</strong> — Hot cache of current court status (3-second TTL concept)</li>
                  <li><strong>ai_jobs</strong> — Queue and results of AI processing tasks</li>
                  <li><strong>scraper_logs</strong> — Audit trail of all scraping operations</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">Data Exposure (RLS-Enforced)</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Users see only cases matched to their profile</li>
                  <li>Documents, annotations, whispers scoped to owner</li>
                  <li>Live board and court metadata publicly readable</li>
                  <li>Scraper logs, AI jobs, raw causelists restricted to admins</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">Data Lifecycle</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li><strong>Daily:</strong> Docket entries created, live board updated continuously</li>
                  <li><strong>Persistent:</strong> Documents, annotations, post-court notes retained indefinitely</li>
                  <li><strong>Archived:</strong> Raw causelists moved to archive after 30 days</li>
                  <li><strong>Deleted:</strong> Scraper logs cleaned after 7 days</li>
                </ul>
              </div>
            </div>
          </section>

          <Separator className="my-8" />

          {/* Section 6 */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
              6️⃣ BACKGROUND PROCESSES & AUTOMATION
            </h2>

            <div className="space-y-6">
              <div className="border border-border rounded-lg p-4">
                <h3 className="font-bold text-foreground mb-2">Telegram Webhook Handler</h3>
                <p className="text-sm text-muted-foreground"><strong>Trigger:</strong> Incoming Telegram message with PDF attachment</p>
                <p className="text-sm text-muted-foreground"><strong>Action:</strong> Queues document in `document_processing_queue`</p>
                <p className="text-sm text-muted-foreground"><strong>Failure Handling:</strong> Logged to scraper_logs with error message; does not retry automatically</p>
                <p className="text-sm text-muted-foreground"><strong>User Impact:</strong> Cause list may not appear until manually re-triggered</p>
              </div>

              <div className="border border-border rounded-lg p-4">
                <h3 className="font-bold text-foreground mb-2">Auto-Match Aliases Trigger</h3>
                <p className="text-sm text-muted-foreground"><strong>Trigger:</strong> INSERT into daily_court_docket</p>
                <p className="text-sm text-muted-foreground"><strong>Action:</strong> Scans all lawyer_aliases for matches; updates docket record</p>
                <p className="text-sm text-muted-foreground"><strong>Failure Handling:</strong> Silent failure; case remains unmatched</p>
                <p className="text-sm text-muted-foreground"><strong>User Impact:</strong> Case may not appear in user's docket until alias added</p>
              </div>

              <div className="border border-border rounded-lg p-4">
                <h3 className="font-bold text-foreground mb-2">Live Board Scraper</h3>
                <p className="text-sm text-muted-foreground"><strong>Trigger:</strong> Scheduled or continuous polling</p>
                <p className="text-sm text-muted-foreground"><strong>Action:</strong> Updates live_board_cache with current item number</p>
                <p className="text-sm text-muted-foreground"><strong>Failure Handling:</strong> Stale data indicator shown; last known value persisted</p>
                <p className="text-sm text-muted-foreground"><strong>User Impact:</strong> May see outdated court position</p>
              </div>

              <div className="border border-border rounded-lg p-4">
                <h3 className="font-bold text-foreground mb-2">Cleanup Functions</h3>
                <p className="text-sm text-muted-foreground"><strong>archive_old_causelists:</strong> Moves causelists older than 30 days to archive table</p>
                <p className="text-sm text-muted-foreground"><strong>cleanup_old_scraper_logs:</strong> Deletes logs older than 7 days</p>
                <p className="text-sm text-muted-foreground"><strong>Expected Schedule:</strong> Daily via pg_cron (requires manual setup)</p>
              </div>

              <div className="border border-border rounded-lg p-4">
                <h3 className="font-bold text-foreground mb-2">AI Job Processing</h3>
                <p className="text-sm text-muted-foreground"><strong>Queue:</strong> ai_jobs table with priority-based ordering</p>
                <p className="text-sm text-muted-foreground"><strong>Retries:</strong> Up to 3 attempts with exponential backoff</p>
                <p className="text-sm text-muted-foreground"><strong>Token Budget:</strong> Tracked in token_usage_daily; can hit daily limits</p>
                <p className="text-sm text-muted-foreground"><strong>Failure Handling:</strong> Marked as 'failed' with error_message; visible in admin panel</p>
              </div>
            </div>
          </section>

          <Separator className="my-8" />

          {/* Section 7 */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
              7️⃣ ACCESS CONTROL & SECURITY MODEL
            </h2>

            <div className="space-y-4 text-foreground/90">
              <div>
                <h3 className="font-semibold text-foreground mb-2">Authentication Flow</h3>
                <p>Supabase Auth with email/password. Auto-confirm enabled for development. On first login, user is redirected to /onboarding if profile incomplete.</p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">Role-Based Access Control</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Roles stored in `user_roles` table: SENIOR, JUNIOR, CLERK, ADMIN</li>
                  <li>Role checked via `get_user_role()` and `has_role()` database functions</li>
                  <li>Frontend guards via `useUserRole` hook</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">Row-Level Security (RLS)</h3>
                <p className="mb-2">Every user-facing table has RLS enabled with policies ensuring:</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Users can only read/write their own data</li>
                  <li>Admins have elevated access to operational tables</li>
                  <li>Public tables (court_metadata, live_board_cache) readable by all authenticated users</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">Separation Between Users and Operators</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Operations Console hidden behind 7-click activation (not in navigation)</li>
                  <li>Admin panel at /admin visible only to ADMIN role</li>
                  <li>Scraper controls, AI job management, validation tools restricted</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">Public vs Restricted Data</h3>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div className="border border-border rounded p-3">
                    <h4 className="font-medium text-sm mb-2">Public (Read by All)</h4>
                    <ul className="text-xs space-y-1">
                      <li>• court_metadata</li>
                      <li>• live_board_cache</li>
                    </ul>
                  </div>
                  <div className="border border-border rounded p-3">
                    <h4 className="font-medium text-sm mb-2">Restricted</h4>
                    <ul className="text-xs space-y-1">
                      <li>• daily_court_docket (own only)</li>
                      <li>• case_documents (own only)</li>
                      <li>• whispers (own only)</li>
                      <li>• ai_jobs (admin only)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <Separator className="my-8" />

          {/* Section 8 */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
              8️⃣ SUBSCRIPTION / ACCESS STATES
            </h2>

            <div className="space-y-4 text-foreground/90">
              <div>
                <h3 className="font-semibold text-foreground mb-2">Access States</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse border border-border">
                    <thead>
                      <tr className="bg-muted">
                        <th className="border border-border p-2 text-left">State</th>
                        <th className="border border-border p-2 text-left">Meaning</th>
                        <th className="border border-border p-2 text-left">User Behavior</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-border p-2 font-mono">free</td>
                        <td className="border border-border p-2">Default tier, limited features</td>
                        <td className="border border-border p-2">Basic dashboard, limited AI usage</td>
                      </tr>
                      <tr>
                        <td className="border border-border p-2 font-mono">active</td>
                        <td className="border border-border p-2">Paid subscription active</td>
                        <td className="border border-border p-2">Full feature access</td>
                      </tr>
                      <tr>
                        <td className="border border-border p-2 font-mono">trialing</td>
                        <td className="border border-border p-2">Trial period active</td>
                        <td className="border border-border p-2">Full access, trial badge shown</td>
                      </tr>
                      <tr>
                        <td className="border border-border p-2 font-mono">canceled</td>
                        <td className="border border-border p-2">Subscription canceled, period remaining</td>
                        <td className="border border-border p-2">Full access until period_end</td>
                      </tr>
                      <tr>
                        <td className="border border-border p-2 font-mono">expired</td>
                        <td className="border border-border p-2">Subscription ended</td>
                        <td className="border border-border p-2">Reverts to free tier</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">State Transitions</h3>
                <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`free → trialing (starts trial)
trialing → active (converts)
trialing → expired (trial ends without conversion)
active → canceled (user cancels)
canceled → expired (period ends)
expired → active (re-subscribes)`}
                </pre>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  <strong>Note:</strong> Stripe integration is currently a placeholder. Subscription state management is in place but payment processing is not live.
                </p>
              </div>
            </div>
          </section>

          <Separator className="my-8" />

          {/* Section 9 */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
              9️⃣ ADMIN / OPERATOR CONSOLE
            </h2>

            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-foreground mb-2">Visible Admin Panel (/admin)</h3>
                <p className="text-sm text-muted-foreground mb-3">Accessible to ADMIN role users via navigation</p>
                <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                  <li><strong>Cause List Scraper</strong> — Manual trigger for PDF download and parsing</li>
                  <li><strong>Docket Manager</strong> — View/edit parsed cases, force-match profiles</li>
                  <li><strong>Court Config</strong> — Manage court metadata, judge assignments</li>
                  <li><strong>Data Validation</strong> — Run integrity checks, view validation logs</li>
                  <li><strong>AI Jobs Monitor</strong> — Queue status, retry failed jobs</li>
                  <li><strong>Arguments Manager</strong> — Bulk manage case arguments</li>
                  <li><strong>Judgment References</strong> — Curate judge-specific case law</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">Hidden Operations Console</h3>
                <p className="text-sm text-muted-foreground mb-3">Activated by clicking logo 7 times rapidly. Not visible in navigation.</p>
                <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                  <li><strong>Sync Health Monitor</strong> — Real-time sync status across all sources</li>
                  <li><strong>Token Budget Dashboard</strong> — AI token usage with budget controls</li>
                  <li><strong>Scraper Status Widget</strong> — Abstracted scraper health (no URLs)</li>
                  <li><strong>Docket Cleanup Controls</strong> — Purge duplicate/orphan records</li>
                  <li><strong>Audit Logging</strong> — All admin actions logged with timestamp</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">Intentionally Hidden from End Users</h3>
                <ul className="list-disc list-inside space-y-1 ml-4 text-sm text-muted-foreground">
                  <li>Raw cause list text content</li>
                  <li>AI parsing prompts and responses</li>
                  <li>Scraper source URLs and technical details</li>
                  <li>Token usage metrics and costs</li>
                  <li>Failed job details and error messages</li>
                </ul>
              </div>
            </div>
          </section>

          <Separator className="my-8" />

          {/* Section 10 */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
              🔟 FAILURE MODES & EDGE CASES
            </h2>

            <div className="space-y-4 text-foreground/90">
              <div>
                <h3 className="font-semibold text-foreground mb-2">Known Failure Scenarios</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li><strong>Telegram unavailable</strong> — Cause lists not ingested; manual upload required</li>
                  <li><strong>AI provider outage</strong> — Parsing queue backs up; manual retry needed</li>
                  <li><strong>Firecrawl credits exhausted</strong> — PDF extraction fails; warning status shown</li>
                  <li><strong>Court board offline</strong> — Live board shows stale data with warning</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">Partial/Delayed Data Conditions</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Supplementary cause list not yet published → incomplete docket for day</li>
                  <li>Parsing in progress → some cases visible, others pending</li>
                  <li>Alias not configured → valid cases missing from user's view</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">Inconsistencies Users May Observe</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Item number in live board vs cause list may differ due to passovers</li>
                  <li>Lawyer name variations may cause missed matches</li>
                  <li>Judge assignments may change intraday without notification</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">Safeguards Implemented</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Idempotent ingestion — duplicate Telegram messages don't create duplicates</li>
                  <li>Stuck job detection — jobs in processing &gt;10 minutes flagged</li>
                  <li>Offline cache — critical data available even without network</li>
                  <li>Retry with backoff — transient failures auto-retried</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">Acceptable vs Critical Failures</h3>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div className="border border-green-500/30 bg-green-500/10 rounded p-3">
                    <h4 className="font-medium text-sm mb-2 text-green-600 dark:text-green-400">Acceptable</h4>
                    <ul className="text-xs space-y-1">
                      <li>• Delayed cause list (hours)</li>
                      <li>• Stale live board (minutes)</li>
                      <li>• Unmatched cases (alias issue)</li>
                    </ul>
                  </div>
                  <div className="border border-red-500/30 bg-red-500/10 rounded p-3">
                    <h4 className="font-medium text-sm mb-2 text-red-600 dark:text-red-400">Critical</h4>
                    <ul className="text-xs space-y-1">
                      <li>• Authentication failure</li>
                      <li>• Data corruption</li>
                      <li>• Complete sync failure (&gt;1 day)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <Separator className="my-8" />

          {/* Section 11 */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
              1️⃣1️⃣ SYSTEM BOUNDARIES & DISCLAIMERS
            </h2>

            <div className="space-y-4 text-foreground/90">
              <div>
                <h3 className="font-semibold text-foreground mb-2">What the System Does NOT Guarantee</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>100% accuracy in cause list parsing</li>
                  <li>Real-time synchronization with court boards</li>
                  <li>Complete capture of all lawyer name variations</li>
                  <li>Availability during court website outages</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">What the System Does NOT Verify</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>User identity beyond email authentication</li>
                  <li>Bar registration validity</li>
                  <li>Authority to represent in listed cases</li>
                  <li>Accuracy of user-uploaded documents</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">External Dependencies</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li><strong>Telegram Bot API</strong> — For receiving cause list PDFs</li>
                  <li><strong>Firecrawl</strong> — For PDF text extraction</li>
                  <li><strong>Google Gemini / OpenAI</strong> — For AI parsing and generation</li>
                  <li><strong>Rajasthan HC Website</strong> — Ultimate source of cause lists</li>
                </ul>
              </div>

              <div className="bg-muted p-4 rounded-lg">
                <h3 className="font-semibold text-foreground mb-2">Legal Disclaimers</h3>
                <p className="text-sm text-muted-foreground">
                  Vakalat-OS is a workflow tool, not a legal service. It does not provide legal advice. 
                  Users are responsible for verifying all case information against official court records. 
                  Izafa Labs is not liable for missed hearings, incorrect data interpretation, or any 
                  professional consequences arising from system use.
                </p>
              </div>
            </div>
          </section>

          <Separator className="my-8" />

          {/* Section 12 */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
              1️⃣2️⃣ OPERATIONAL REALITIES
            </h2>

            <div className="space-y-4 text-foreground/90">
              <div>
                <h3 className="font-semibold text-foreground mb-2">Expected Daily Usage</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Peak: 8:30 AM - 10:30 AM (before court starts)</li>
                  <li>Secondary peak: 1:30 PM - 2:30 PM (post-lunch resumption)</li>
                  <li>Active users concentrated in Jaipur/Jodhpur timezone</li>
                  <li>Minimal usage on weekends and court holidays</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">Scaling Behavior</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Edge functions auto-scale with Supabase</li>
                  <li>Database connections pooled; may hit limits at ~1000 concurrent</li>
                  <li>AI token budget acts as natural rate limiter</li>
                  <li>Live board subscriptions scale with Supabase Realtime limits</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">Cost Drivers</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li><strong>AI Tokens</strong> — Primary variable cost; ~2000 tokens per cause list page</li>
                  <li><strong>Firecrawl</strong> — PDF extraction credits; ~10 credits per cause list</li>
                  <li><strong>Supabase</strong> — Database storage, edge function invocations</li>
                  <li><strong>Storage</strong> — PDF and document storage in Supabase Storage</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">Maintenance Requirements</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Monitor AI token budget daily during court sessions</li>
                  <li>Check scraper logs for failures after each cause list publication</li>
                  <li>Review stuck jobs in AI queue weekly</li>
                  <li>Verify cleanup jobs running (archive, log deletion)</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">What Fails First Under Load</h3>
                <ol className="list-decimal list-inside space-y-1 ml-4">
                  <li>AI token budget exhaustion</li>
                  <li>Edge function cold starts during traffic spikes</li>
                  <li>Realtime subscription limits for live board</li>
                  <li>Database connection pool saturation</li>
                </ol>
              </div>
            </div>
          </section>

          <Separator className="my-8" />

          {/* Section 13 */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
              1️⃣3️⃣ KNOWN LIMITATIONS & FUTURE CONSTRAINTS
            </h2>

            <div className="space-y-4 text-foreground/90">
              <div>
                <h3 className="font-semibold text-foreground mb-2">Current Limitations</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Rajasthan High Court only (Jaipur and Jodhpur benches)</li>
                  <li>No native mobile app (PWA-only)</li>
                  <li>No offline document viewing (cache for metadata only)</li>
                  <li>Voice memos not transcribed automatically</li>
                  <li>No integration with e-filing systems</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">Intentional Trade-offs</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li><strong>Automation over accuracy</strong> — Accepts ~5% parsing error rate for speed</li>
                  <li><strong>Simplicity over completeness</strong> — Core workflow first, edge cases later</li>
                  <li><strong>Speed over cost</strong> — Uses capable AI models even at higher token cost</li>
                  <li><strong>Privacy over convenience</strong> — Strict RLS even if it complicates queries</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">Postponed Capabilities</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Multi-court expansion (Supreme Court, other High Courts)</li>
                  <li>Native mobile applications</li>
                  <li>WhatsApp integration for notifications</li>
                  <li>Advanced analytics and reporting</li>
                  <li>Client-facing portal for case updates</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">Structural Constraints</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Dependent on court's cause list publication schedule</li>
                  <li>Alias matching limited by OCR quality of source PDFs</li>
                  <li>Live board accuracy dependent on court's display system</li>
                  <li>AI parsing quality varies with PDF formatting changes</li>
                </ul>
              </div>
            </div>
          </section>

          <Separator className="my-8" />

          {/* Section 14 */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
              1️⃣4️⃣ SUMMARY FOR EXTERNAL STORAGE
            </h2>

            <div className="bg-muted p-6 rounded-lg space-y-4 text-foreground/90">
              <div>
                <h3 className="font-semibold text-foreground mb-2">What Izafa Labs Has Built</h3>
                <p>Vakalat-OS is a litigation workflow operating system that automates the daily operational burden of advocates practicing at Rajasthan High Court. It ingests cause lists automatically via Telegram, parses them using AI, matches cases to lawyers via configurable aliases, and provides real-time court board monitoring — all through a role-aware, offline-capable progressive web application.</p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">Why It Exists</h3>
                <p>Indian High Courts publish multi-hundred-page cause lists daily. Lawyers spend significant time manually searching for their cases, tracking court progress, and coordinating with team members. Vakalat-OS eliminates this overhead, allowing lawyers to focus on legal work rather than administrative tasks.</p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">What Makes It Reliable</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Idempotent data ingestion prevents duplicates</li>
                  <li>Retry mechanisms with exponential backoff handle transient failures</li>
                  <li>Offline caching ensures critical data availability</li>
                  <li>Row-level security enforces strict data isolation</li>
                  <li>Audit logging tracks all operational actions</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">What Assumptions It Depends On</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Rajasthan HC continues publishing cause lists as PDFs via accessible channels</li>
                  <li>Court display boards remain scrapeable or simulatable</li>
                  <li>AI providers (Gemini/OpenAI) maintain service availability</li>
                  <li>Users maintain accurate and complete lawyer name aliases</li>
                  <li>Supabase infrastructure remains operational</li>
                </ul>
              </div>
            </div>

            <div className="mt-8 text-center text-sm text-muted-foreground">
              <p>— End of Document —</p>
              <p className="mt-2">Vakalat-OS Product System Dossier v1.0</p>
              <p>Built by Izafa Labs • {new Date().getFullYear()}</p>
            </div>
          </section>

        </div>
      </ScrollArea>

      {/* Print Styles */}
      <style>{`
        @media print {
          body { 
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print\\:hidden { display: none !important; }
          .print\\:h-auto { height: auto !important; }
          .print\\:max-w-none { max-width: none !important; }
          .print\\:px-8 { padding-left: 2rem !important; padding-right: 2rem !important; }
          .print\\:mb-8 { margin-bottom: 2rem !important; }
          .print\\:page-break-after { page-break-after: always; }
          .print\\:page-break-inside-avoid { page-break-inside: avoid; }
          
          @page {
            size: A4;
            margin: 1.5cm;
          }
        }
      `}</style>
    </div>
  );
};

export default ProductDossier;
