import { Button } from "@/components/ui/button";
import { ArrowLeft, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";

const ProductDossier = () => {
  const navigate = useNavigate();

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-white text-black">
      {/* Header - hidden in print */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-300 print:hidden">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => navigate(-1)} className="border-gray-300 text-black hover:bg-gray-100">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-black">Product System Dossier</h1>
              <p className="text-xs text-gray-500">Built by Izafa Labs</p>
            </div>
          </div>
          <Button onClick={handlePrint} className="gap-2 bg-black text-white hover:bg-gray-800">
            <Download className="h-4 w-4" />
            Save as PDF
          </Button>
        </div>
      </header>

      <ScrollArea className="h-[calc(100vh-64px)] print:h-auto">
        <div className="container mx-auto px-4 py-8 max-w-4xl print:max-w-none print:px-8">
          
          {/* Title Page */}
          <div className="text-center mb-12 print:mb-8 print:page-break-after">
            <h1 className="text-4xl font-bold text-black mb-4">NYAY-HUB</h1>
            <h2 className="text-2xl text-gray-600 mb-6">Product System Dossier</h2>
            <p className="text-lg text-black font-medium">Built by Izafa Labs</p>
            <p className="text-sm text-gray-500 mt-4">
              Generated: {new Date().toLocaleDateString('en-IN', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Confidential — For Archival & Reference Only
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Document Version: 3.0 • Complete Feature Coverage
            </p>
          </div>

          <hr className="my-8 border-gray-300" />

          {/* Section 1 */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-black mb-4">1. PRODUCT OVERVIEW</h2>
            
            <div className="space-y-4 text-gray-800">
              <div>
                <h3 className="font-semibold text-black mb-2">What is Nyay-Hub?</h3>
                <p>Nyay-Hub is a litigation workflow operating system purpose-built for advocates practicing at Rajasthan High Court (Jodhpur and Jaipur benches). It transforms the daily operational burden of tracking cause lists, monitoring live court boards, and preparing for hearings into an automated, role-aware digital workflow.</p>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">Who Izafa Labs Built It For</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li><strong>Senior Advocates</strong> — need instant visibility into their docket without manual tracking</li>
                  <li><strong>Junior Advocates</strong> — manage multiple seniors' cases, need clear task delegation</li>
                  <li><strong>Clerks</strong> — handle document organization and basic case monitoring</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">Real-World Problem Solved</h3>
                <p>Daily cause lists at Rajasthan HC are published as multi-hundred-page PDFs. Lawyers manually search for their names across courts, track item numbers, monitor live boards for when their case is called, and coordinate with juniors — all while preparing arguments. Nyay-Hub automates this entirely.</p>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">What Izafa Labs Intentionally Chose NOT to Solve</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Case filing and e-filing integration</li>
                  <li>Legal research and case law lookup</li>
                  <li>Client billing and accounts management</li>
                  <li>Multi-court expansion beyond Rajasthan HC</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">Design Philosophy</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li><strong>Lawyer-first UX</strong> — designed for courtroom conditions (poor connectivity, stress, time pressure)</li>
                  <li><strong>Offline-capable</strong> — critical data cached locally via IndexedDB</li>
                  <li><strong>Role-based delegation</strong> — seniors delegate, juniors execute, clerks support</li>
                  <li><strong>Minimal manual entry</strong> — aliases auto-match; cases appear automatically</li>
                  <li><strong>Trust-first design</strong> — never mislead about data freshness or system status</li>
                </ul>
              </div>
            </div>
          </section>

          <hr className="my-8 border-gray-300" />

          {/* Section 2 */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-black mb-4">2. USER TYPES & ROLES</h2>

            <div className="space-y-6">
              <div className="border border-gray-300 rounded-lg p-4">
                <h3 className="font-bold text-black mb-2">SENIOR (Senior Advocate)</h3>
                <p className="text-sm text-gray-600 mb-1"><strong>Purpose:</strong> Primary decision-maker; owns the docket</p>
                <p className="text-sm text-gray-600 mb-1"><strong>Permissions:</strong> Full access to own cases, documents, arguments, whispers; can create chambers</p>
                <p className="text-sm text-gray-600 mb-1"><strong>Visible Features:</strong> Dashboard, War Room, Control Deck, Courtroom Mode, Morning Brief, Judge Intelligence</p>
                <p className="text-sm text-gray-600"><strong>Restricted:</strong> Cannot access Admin Panel or Operations Console</p>
              </div>

              <div className="border border-gray-300 rounded-lg p-4">
                <h3 className="font-bold text-black mb-2">JUNIOR (Junior Advocate)</h3>
                <p className="text-sm text-gray-600 mb-1"><strong>Purpose:</strong> Executes tasks delegated by seniors; manages case preparation</p>
                <p className="text-sm text-gray-600 mb-1"><strong>Permissions:</strong> Upload documents, send whispers, capture post-court notes; can join chambers via invite</p>
                <p className="text-sm text-gray-600 mb-1"><strong>Visible Features:</strong> Dashboard, War Room, Control Deck, Courtroom Mode</p>
                <p className="text-sm text-gray-600"><strong>Restricted:</strong> Cannot create chambers, modify senior's aliases, or access admin functions</p>
              </div>

              <div className="border border-gray-300 rounded-lg p-4">
                <h3 className="font-bold text-black mb-2">CLERK</h3>
                <p className="text-sm text-gray-600 mb-1"><strong>Purpose:</strong> Document organization and basic monitoring</p>
                <p className="text-sm text-gray-600 mb-1"><strong>Permissions:</strong> View docket, upload documents, view live board; can join chambers via invite</p>
                <p className="text-sm text-gray-600 mb-1"><strong>Visible Features:</strong> Dashboard, Document upload, Live board view</p>
                <p className="text-sm text-gray-600"><strong>Restricted:</strong> Cannot create chambers, send whispers, access War Room, or capture post-court notes</p>
              </div>

              <div className="border border-gray-300 rounded-lg p-4">
                <h3 className="font-bold text-black mb-2">ADMIN</h3>
                <p className="text-sm text-gray-600 mb-1"><strong>Purpose:</strong> System operator; manages scraping, parsing, validation</p>
                <p className="text-sm text-gray-600 mb-1"><strong>Permissions:</strong> Full system access including Operations Console</p>
                <p className="text-sm text-gray-600 mb-1"><strong>Visible Features:</strong> All user features + Admin Panel + Operations Console</p>
                <p className="text-sm text-gray-600"><strong>Restricted:</strong> None (highest privilege level)</p>
              </div>
            </div>
          </section>

          <hr className="my-8 border-gray-300" />

          {/* Section 3 */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-black mb-4">3. USER-FACING PORTAL WALKTHROUGH</h2>

            <div className="space-y-4 text-gray-800">
              <div>
                <h3 className="font-semibold text-black mb-2">Entry Points</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li><strong>/auth</strong> — Login/signup via email (auto-confirmed)</li>
                  <li><strong>/onboarding</strong> — First-time setup: profile, bench selection, alias configuration, chamber setup</li>
                  <li><strong>/</strong> — Dashboard (post-onboarding default)</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">Onboarding Flow (3 Steps)</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li><strong>Step 1: Profile</strong> — Full name, bar registration, preferred bench, WhatsApp number, role selection</li>
                  <li><strong>Step 2: Aliases</strong> — Configure lawyer name variations for cause list matching</li>
                  <li><strong>Step 3: Chamber</strong> — Seniors create chambers; Juniors/Clerks join via invite code or practice solo</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">Main Screens</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li><strong>Dashboard (/)</strong> — Today's docket, live court widgets, cause list notes, scraper status, morning brief</li>
                  <li><strong>War Room (/war-room)</strong> — PDF viewer, arguments panel, judgment references, annotations, judge intelligence</li>
                  <li><strong>Control Deck (/control-deck)</strong> — Whisper system, voice memo recording, message history</li>
                  <li><strong>Courtroom Mode (/courtroom)</strong> — Panic alert, live board display, offline snapshot</li>
                  <li><strong>Admin Panel (/admin)</strong> — Cause list scraper, docket manager, data validation, audit console (ADMIN only)</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">Actions Users CAN Perform</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Add/edit lawyer name aliases</li>
                  <li>Upload case documents (PDF, images)</li>
                  <li>Annotate documents (highlights, notes)</li>
                  <li>Create and organize arguments</li>
                  <li>Send whispers (text/voice) to team members</li>
                  <li>Capture post-court notes</li>
                  <li>Generate client update messages</li>
                  <li>Trigger courtroom snapshot for offline use</li>
                  <li>Record judge observations (lawyer-private by default)</li>
                  <li>Create chambers (seniors) or join via invite (juniors/clerks)</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">Actions Users CANNOT Perform</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Manually add cases to docket (system-driven via cause list matching)</li>
                  <li>Edit parsed case details (read-only from source)</li>
                  <li>Access other users' documents or whispers</li>
                  <li>Modify live board data</li>
                  <li>Trigger cause list scraping (admin only)</li>
                  <li>Export data in bulk (no CSV/PDF export by design)</li>
                  <li>View other lawyers' judge observations without explicit consent</li>
                </ul>
              </div>
            </div>
          </section>

          <hr className="my-8 border-gray-300" />

          {/* Section 4 */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-black mb-4">4. CORE FEATURES & CAPABILITIES</h2>

            <div className="space-y-6">
              <div className="border-l-4 border-black pl-4">
                <h3 className="font-bold text-black mb-2">Cause List Ingestion</h3>
                <p className="text-sm text-gray-600"><strong>What:</strong> Automatically downloads and parses daily cause list PDFs</p>
                <p className="text-sm text-gray-600"><strong>When:</strong> Triggered via Telegram webhook when court publishes PDFs</p>
                <p className="text-sm text-gray-600"><strong>Output:</strong> Parsed cases in daily_court_docket table, matched to user profiles</p>
              </div>

              <div className="border-l-4 border-black pl-4">
                <h3 className="font-bold text-black mb-2">Lawyer Name Matching</h3>
                <p className="text-sm text-gray-600"><strong>What:</strong> Matches extracted lawyer names against user-defined aliases</p>
                <p className="text-sm text-gray-600"><strong>When:</strong> Runs automatically after cause list parsing</p>
                <p className="text-sm text-gray-600"><strong>Output:</strong> matched_profile_id, matched_role, match_confidence in docket</p>
              </div>

              <div className="border-l-4 border-black pl-4">
                <h3 className="font-bold text-black mb-2">Live Board Monitoring</h3>
                <p className="text-sm text-gray-600"><strong>What:</strong> Tracks real-time court display board showing current item number</p>
                <p className="text-sm text-gray-600"><strong>Frequency:</strong> 3-second refresh interval during court hours</p>
                <p className="text-sm text-gray-600"><strong>Output:</strong> live_board_cache with current item, status, timestamp</p>
                <p className="text-sm text-gray-600"><strong>Trust Feature:</strong> Staleness indicator shows "Last updated" timestamp with visual warnings</p>
              </div>

              <div className="border-l-4 border-black pl-4">
                <h3 className="font-bold text-black mb-2">Morning Brief Generation</h3>
                <p className="text-sm text-gray-600"><strong>What:</strong> AI-generated summary of today's docket with priorities and alerts</p>
                <p className="text-sm text-gray-600"><strong>When:</strong> On-demand when user opens Morning Brief panel</p>
                <p className="text-sm text-gray-600"><strong>Output:</strong> Structured brief with readiness scores, suggested focus areas</p>
                <p className="text-sm text-gray-600"><strong>Trust Feature:</strong> Shows "Prepared at [time]" with staleness warning if older than 5 minutes</p>
              </div>

              <div className="border-l-4 border-black pl-4">
                <h3 className="font-bold text-black mb-2">Post-Court Capture</h3>
                <p className="text-sm text-gray-600"><strong>What:</strong> Quick-entry system for capturing hearing outcomes</p>
                <p className="text-sm text-gray-600"><strong>Output:</strong> post_court_notes record with what_happened, next_direction, note_for_next</p>
              </div>

              <div className="border-l-4 border-black pl-4">
                <h3 className="font-bold text-black mb-2">Courtroom Snapshot</h3>
                <p className="text-sm text-gray-600"><strong>What:</strong> Bundles critical case data for offline access during hearings</p>
                <p className="text-sm text-gray-600"><strong>Output:</strong> IndexedDB-cached bundle accessible without network</p>
              </div>

              <div className="border-l-4 border-black pl-4">
                <h3 className="font-bold text-black mb-2">Judge Intelligence</h3>
                <p className="text-sm text-gray-600"><strong>What:</strong> Private memory system for judicial observations and patterns</p>
                <p className="text-sm text-gray-600"><strong>Scope:</strong> Lawyer-private by default; opt-in chamber sharing with explicit consent</p>
                <p className="text-sm text-gray-600"><strong>Includes:</strong> Observation recording, procedural patterns, judgment references</p>
                <p className="text-sm text-gray-600"><strong>Protected by:</strong> SensitiveViewGuard with watermarking and legal disclaimers</p>
              </div>

              <div className="border-l-4 border-black pl-4">
                <h3 className="font-bold text-black mb-2">Chamber System</h3>
                <p className="text-sm text-gray-600"><strong>What:</strong> Team coordination structure for law offices</p>
                <p className="text-sm text-gray-600"><strong>Roles:</strong> Senior (owner), Junior (member), Clerk (support)</p>
                <p className="text-sm text-gray-600"><strong>Joining:</strong> Via 8-character invite codes with 7-day expiry</p>
                <p className="text-sm text-gray-600"><strong>Privacy:</strong> Chamber membership does NOT grant access to case data — only coordination and observation sharing (with consent)</p>
              </div>

              <div className="border-l-4 border-black pl-4">
                <h3 className="font-bold text-black mb-2">Notification & Escalation System</h3>
                <p className="text-sm text-gray-600"><strong>What:</strong> Proximity-based alerts when cases approach on live board</p>
                <p className="text-sm text-gray-600"><strong>Thresholds:</strong> Warning (6-10 items away), Critical (≤5 items away)</p>
                <p className="text-sm text-gray-600"><strong>Trust Feature:</strong> Offline threshold memory creates reconnection alerts for missed thresholds</p>
                <p className="text-sm text-gray-600"><strong>Escalation:</strong> WhatsApp escalation available for unacknowledged critical alerts</p>
              </div>

              <div className="border-l-4 border-black pl-4">
                <h3 className="font-bold text-black mb-2">Court Focus Mode</h3>
                <p className="text-sm text-gray-600"><strong>What:</strong> Full-screen overlay for critical court moments requiring undivided attention</p>
                <p className="text-sm text-gray-600"><strong>Trigger:</strong> Activated when case is imminent (≤3 items away) during court hours</p>
                <p className="text-sm text-gray-600"><strong>Features:</strong> Eliminates distractions, large countdown display, panic alert button</p>
                <p className="text-sm text-gray-600"><strong>Exit:</strong> User dismisses when safe, or auto-dismisses after case is called</p>
              </div>

              <div className="border-l-4 border-black pl-4">
                <h3 className="font-bold text-black mb-2">Indian Kanoon Integration</h3>
                <p className="text-sm text-gray-600"><strong>What:</strong> Search and reference judgments from Indian Kanoon legal database</p>
                <p className="text-sm text-gray-600"><strong>Use Case:</strong> Find relevant precedents while preparing arguments in War Room</p>
                <p className="text-sm text-gray-600"><strong>Features:</strong> Keyword search, attach judgments to arguments, ranking by relevance</p>
                <p className="text-sm text-gray-600"><strong>Output:</strong> judgment_attachments linked to cases and arguments</p>
              </div>

              <div className="border-l-4 border-black pl-4">
                <h3 className="font-bold text-black mb-2">Network Status Monitoring</h3>
                <p className="text-sm text-gray-600"><strong>What:</strong> Real-time network connectivity monitoring with visual indicators</p>
                <p className="text-sm text-gray-600"><strong>Display:</strong> Global offline banner, status pills on critical components</p>
                <p className="text-sm text-gray-600"><strong>Behavior:</strong> Graceful degradation to cached data when offline</p>
                <p className="text-sm text-gray-600"><strong>Recovery:</strong> Auto-sync and threshold replay on reconnection</p>
              </div>

              <div className="border-l-4 border-black pl-4">
                <h3 className="font-bold text-black mb-2">Sync Conflict Resolution</h3>
                <p className="text-sm text-gray-600"><strong>What:</strong> Handles data conflicts when offline edits sync with server changes</p>
                <p className="text-sm text-gray-600"><strong>Detection:</strong> Compares timestamps and version markers on sync</p>
                <p className="text-sm text-gray-600"><strong>Resolution:</strong> User-facing dialog to choose between local and server versions</p>
                <p className="text-sm text-gray-600"><strong>Safety:</strong> Blocks unsafe operations (like PWA update) during conflict resolution</p>
              </div>

              <div className="border-l-4 border-black pl-4">
                <h3 className="font-bold text-black mb-2">PWA Safe Update System</h3>
                <p className="text-sm text-gray-600"><strong>What:</strong> Progressive Web App updates that never interrupt critical work</p>
                <p className="text-sm text-gray-600"><strong>Safety Checks:</strong> Pending sync, form edits, court mode, network status, visibility</p>
                <p className="text-sm text-gray-600"><strong>Behavior:</strong> Silent updates when app is hidden and safe; deferred otherwise</p>
                <p className="text-sm text-gray-600"><strong>User Trust:</strong> Never loses data, never interrupts hearings</p>
              </div>
            </div>
          </section>

          <hr className="my-8 border-gray-300" />

          {/* Section 5 */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-black mb-4">5. DATA & INFORMATION FLOW</h2>

            <div className="space-y-4 text-gray-800">
              <div>
                <h3 className="font-semibold text-black mb-2">Data Sources</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li><strong>Telegram Bot</strong> — Receives cause list PDFs from court channels</li>
                  <li><strong>Court Display Boards</strong> — Scraped or simulated for live item tracking</li>
                  <li><strong>User Input</strong> — Aliases, documents, annotations, whispers, notes, observations</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">Ingestion Flow</h3>
                <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto border border-gray-300">
{`Telegram PDF → document_processing_queue → download-causelists
    → raw_causelists (storage + text) → parse-case (AI)
    → daily_court_docket → auto-match-aliases (trigger)
    → matched_profile_id populated`}
                </pre>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">Storage Architecture</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li><strong>raw_causelists</strong> — Archived PDF storage paths and extracted text</li>
                  <li><strong>daily_court_docket</strong> — Parsed, per-case records</li>
                  <li><strong>case_documents</strong> — User-uploaded files in Storage</li>
                  <li><strong>live_board_cache</strong> — Hot cache of current court status</li>
                  <li><strong>ai_jobs</strong> — Queue and results of AI processing tasks</li>
                  <li><strong>judge_observations</strong> — Lawyer-private judicial notes</li>
                  <li><strong>chambers / chamber_memberships</strong> — Team structure and relationships</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">Data Lifecycle</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li><strong>Daily:</strong> Docket entries created, live board updated continuously</li>
                  <li><strong>Persistent:</strong> Documents, annotations, post-court notes, observations retained indefinitely</li>
                  <li><strong>Archived:</strong> Raw causelists moved to archive after 30 days</li>
                  <li><strong>Deleted:</strong> Scraper logs cleaned after 7 days</li>
                </ul>
              </div>
            </div>
          </section>

          <hr className="my-8 border-gray-300" />

          {/* Section 6 */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-black mb-4">6. BACKGROUND PROCESSES & AUTOMATION</h2>

            <div className="space-y-6">
              <div className="border border-gray-300 rounded-lg p-4">
                <h3 className="font-bold text-black mb-2">Telegram Webhook Handler</h3>
                <p className="text-sm text-gray-600"><strong>Trigger:</strong> Incoming Telegram message with PDF attachment</p>
                <p className="text-sm text-gray-600"><strong>Action:</strong> Queues document in document_processing_queue</p>
                <p className="text-sm text-gray-600"><strong>Failure Handling:</strong> Logged to scraper_logs with error message</p>
              </div>

              <div className="border border-gray-300 rounded-lg p-4">
                <h3 className="font-bold text-black mb-2">Auto-Match Aliases Trigger</h3>
                <p className="text-sm text-gray-600"><strong>Trigger:</strong> INSERT into daily_court_docket</p>
                <p className="text-sm text-gray-600"><strong>Action:</strong> Scans all lawyer_aliases for matches; updates docket record</p>
              </div>

              <div className="border border-gray-300 rounded-lg p-4">
                <h3 className="font-bold text-black mb-2">Live Board Scraper</h3>
                <p className="text-sm text-gray-600"><strong>Trigger:</strong> Scheduled or continuous polling during court hours</p>
                <p className="text-sm text-gray-600"><strong>Action:</strong> Updates live_board_cache with current item number and timestamp</p>
                <p className="text-sm text-gray-600"><strong>Court Hours:</strong> Summer (Apr 15 - Jun 27): 8 AM - 1 PM; Winter: 10:30 AM - 1 PM + 2 PM - 4:30 PM IST</p>
              </div>

              <div className="border border-gray-300 rounded-lg p-4">
                <h3 className="font-bold text-black mb-2">AI Job Processing</h3>
                <p className="text-sm text-gray-600"><strong>Queue:</strong> ai_jobs table with priority-based ordering</p>
                <p className="text-sm text-gray-600"><strong>Retries:</strong> Up to 3 attempts with exponential backoff</p>
                <p className="text-sm text-gray-600"><strong>Providers:</strong> Google Gemini (primary), OpenAI (fallback)</p>
              </div>

              <div className="border border-gray-300 rounded-lg p-4">
                <h3 className="font-bold text-black mb-2">Notification Generator</h3>
                <p className="text-sm text-gray-600"><strong>Trigger:</strong> Live board update when user has case in affected court</p>
                <p className="text-sm text-gray-600"><strong>Action:</strong> Creates notification if case crosses threshold (warning: 6-10, critical: ≤5)</p>
                <p className="text-sm text-gray-600"><strong>Offline Memory:</strong> Client-side tracking replays critical thresholds on reconnection</p>
              </div>
            </div>
          </section>

          <hr className="my-8 border-gray-300" />

          {/* Section 7 */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-black mb-4">7. ACCESS CONTROL & SECURITY MODEL</h2>

            <div className="space-y-4 text-gray-800">
              <div>
                <h3 className="font-semibold text-black mb-2">Authentication Flow</h3>
                <p>Supabase Auth with email/password. Auto-confirm enabled for development. On first login, user is redirected to /onboarding if profile incomplete. Three-step onboarding includes profile, aliases, and chamber setup.</p>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">Role-Based Access Control</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Roles stored in user_roles table: SENIOR, JUNIOR, CLERK, ADMIN</li>
                  <li>Role checked via get_user_role() and has_role() database functions</li>
                  <li>Frontend guards via useUserRole hook</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">Row-Level Security (RLS)</h3>
                <p className="mb-2">Every user-facing table has RLS enabled with policies ensuring:</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Users can only read/write their own data</li>
                  <li>Case visibility: only matched_profile_id can see case details</li>
                  <li>Judge observations: lawyer_id scoped with opt-in chamber sharing</li>
                  <li>Chambers: membership-based access with role-specific permissions</li>
                  <li>Admins have elevated access to operational tables</li>
                  <li>Public tables (court_metadata, live_board_cache) readable by all authenticated users</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">Data Protection Measures</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li><strong>No bulk export</strong> — No CSV, PDF, or batch download features</li>
                  <li><strong>Copy/selection disabled</strong> — user-select: none on sensitive content</li>
                  <li><strong>Context menu blocked</strong> — Right-click disabled on protected surfaces</li>
                  <li><strong>Watermarking</strong> — SensitiveViewGuard applies visible watermarks with user ID</li>
                  <li><strong>Screenshot deterrence</strong> — Visual watermark persists in screenshots (advisory)</li>
                </ul>
              </div>
            </div>
          </section>

          <hr className="my-8 border-gray-300" />

          {/* Section 8 */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-black mb-4">8. CHAMBER SYSTEM</h2>

            <div className="space-y-4 text-gray-800">
              <div>
                <h3 className="font-semibold text-black mb-2">What is a Chamber?</h3>
                <p>A chamber represents a law office or advocacy team. It provides coordination without granting data access — membership enables team features but does NOT allow viewing other lawyers' cases or documents.</p>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">Chamber Roles</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li><strong>Senior (Owner)</strong> — Creates chamber, generates invite codes, manages members</li>
                  <li><strong>Junior (Member)</strong> — Joins via invite, participates in chamber features</li>
                  <li><strong>Clerk (Support)</strong> — Joins via invite, limited to support functions</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">Joining a Chamber</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Invite codes are 8 characters, valid for 7 days</li>
                  <li>Juniors and Clerks can join during onboarding (Step 3) or later</li>
                  <li>Solo practice option available for those not in a chamber</li>
                  <li>Users cannot be in multiple chambers simultaneously</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">Chamber-Enabled Features</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li><strong>Judge Observation Sharing</strong> — Opt-in sharing of judicial observations within chamber</li>
                  <li><strong>Whisper Targeting</strong> — Send messages to chamber members</li>
                  <li><strong>Future:</strong> Delegation, task assignment, shared preparation</li>
                </ul>
              </div>

              <div className="bg-gray-100 border border-gray-300 rounded-lg p-4">
                <p className="text-sm text-gray-700">
                  <strong>Critical Isolation Rule:</strong> Chamber membership NEVER grants access to another lawyer's case data, documents, arguments, or notifications. It only enables coordination features that require explicit user action.
                </p>
              </div>
            </div>
          </section>

          <hr className="my-8 border-gray-300" />

          {/* Section 9 */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-black mb-4">9. TRUST & FRESHNESS SYSTEM</h2>

            <div className="space-y-4 text-gray-800">
              <div>
                <h3 className="font-semibold text-black mb-2">Design Principle</h3>
                <p>The system is designed to never mislead users about data freshness. All surfaces that could contain stale data explicitly show their last update time with visual warnings.</p>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">Live Board Staleness Indicator</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Shows "Last updated: [time] IST" below court status</li>
                  <li>≤30 seconds: Normal muted text</li>
                  <li>31-90 seconds: Muted text with ⚠️ warning icon</li>
                  <li>&gt;90 seconds: Amber text with tooltip explanation</li>
                  <li>Tooltip: "Court position updates depend on live board availability. Verify if data appears delayed."</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">Morning Brief Freshness Indicator</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Shows "Prepared at [time] IST" below brief title</li>
                  <li>If older than 5 minutes: Muted text with tooltip</li>
                  <li>Tooltip: "This brief is based on the last available court data and may not reflect recent changes."</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">Offline Threshold Memory</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Tracks proximity thresholds while user is offline</li>
                  <li>On reconnection, creates synthesized notification if critical threshold was crossed</li>
                  <li>Notification title: "Court Alert (After Reconnect)"</li>
                  <li>Notification body: "Your case crossed a critical proximity threshold while you were offline. Please verify the current court status."</li>
                  <li>Footer: "This alert was generated after reconnection. Always verify against official court records."</li>
                  <li>One replay per case per day maximum</li>
                </ul>
              </div>

              <div className="bg-gray-100 border border-gray-300 rounded-lg p-4">
                <p className="text-sm text-gray-700">
                  <strong>Never Fabricate:</strong> The system never creates fake "real-time" alerts. Reconnection alerts explicitly state they are synthesized after the fact.
                </p>
              </div>
            </div>
          </section>

          <hr className="my-8 border-gray-300" />

          {/* Section 10 */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-black mb-4">10. SUBSCRIPTION / ACCESS STATES</h2>

            <div className="space-y-4 text-gray-800">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 p-2 text-left">State</th>
                      <th className="border border-gray-300 p-2 text-left">Meaning</th>
                      <th className="border border-gray-300 p-2 text-left">User Behavior</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-300 p-2 font-mono">free</td>
                      <td className="border border-gray-300 p-2">Default tier, limited features</td>
                      <td className="border border-gray-300 p-2">Basic dashboard, limited AI usage</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 p-2 font-mono">active</td>
                      <td className="border border-gray-300 p-2">Paid subscription active</td>
                      <td className="border border-gray-300 p-2">Full feature access</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 p-2 font-mono">trialing</td>
                      <td className="border border-gray-300 p-2">Trial period active</td>
                      <td className="border border-gray-300 p-2">Full access, trial badge shown</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 p-2 font-mono">canceled</td>
                      <td className="border border-gray-300 p-2">Subscription canceled</td>
                      <td className="border border-gray-300 p-2">Full access until period_end</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 p-2 font-mono">expired</td>
                      <td className="border border-gray-300 p-2">Subscription ended</td>
                      <td className="border border-gray-300 p-2">Reverts to free tier</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="bg-gray-100 border border-gray-300 rounded-lg p-4">
                <p className="text-sm text-gray-700">
                  <strong>Note:</strong> Stripe integration is currently a placeholder. Subscription state management is in place but payment processing is not live.
                </p>
              </div>
            </div>
          </section>

          <hr className="my-8 border-gray-300" />

          {/* Section 11 */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-black mb-4">11. ADMIN / OPERATOR CONSOLE</h2>

            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-black mb-2">Visible Admin Panel (/admin)</h3>
                <p className="text-sm text-gray-600 mb-3">Accessible to ADMIN role users via navigation</p>
                <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                  <li><strong>Cause List Scraper</strong> — Manual trigger for PDF download and parsing</li>
                  <li><strong>Docket Manager</strong> — View/edit parsed cases, force-match profiles</li>
                  <li><strong>Court Config</strong> — Manage court metadata, judge assignments</li>
                  <li><strong>Data Validation</strong> — Run integrity checks, view validation logs</li>
                  <li><strong>AI Jobs Monitor</strong> — Queue status, retry failed jobs</li>
                  <li><strong>Arguments Manager</strong> — View and manage case arguments across users</li>
                  <li><strong>Judgment References Manager</strong> — Manage saved judgment references</li>
                  <li><strong>Audit Console</strong> — Create and review system audits with findings and risks</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">Hidden Operations Console</h3>
                <p className="text-sm text-gray-600 mb-3">Activated by clicking logo 7 times rapidly. Not visible in navigation.</p>
                <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                  <li><strong>Sync Health Monitor</strong> — Real-time sync status across all sources</li>
                  <li><strong>Token Budget Dashboard</strong> — AI token usage with budget controls</li>
                  <li><strong>Docket Cleanup Controls</strong> — Purge duplicate/orphan records</li>
                </ul>
              </div>
            </div>
          </section>

          <hr className="my-8 border-gray-300" />

          {/* Section 12 */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-black mb-4">12. FAILURE MODES & EDGE CASES</h2>

            <div className="space-y-4 text-gray-800">
              <div>
                <h3 className="font-semibold text-black mb-2">Known Failure Scenarios</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li><strong>Telegram unavailable</strong> — Cause lists not ingested; manual upload required</li>
                  <li><strong>AI provider outage</strong> — Parsing queue backs up; manual retry needed</li>
                  <li><strong>Firecrawl credits exhausted</strong> — PDF extraction fails; warning status shown</li>
                  <li><strong>Court board offline</strong> — Live board shows stale data with staleness indicator</li>
                  <li><strong>User offline during case call</strong> — Threshold tracked; reconnection alert created</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">Safeguards Implemented</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Idempotent ingestion — duplicate Telegram messages don't create duplicates</li>
                  <li>Stuck job detection — jobs in processing &gt;10 minutes flagged</li>
                  <li>Offline cache — critical data available even without network</li>
                  <li>Retry with backoff — transient failures auto-retried</li>
                  <li>Staleness indicators — users always know data age</li>
                  <li>Offline threshold memory — critical alerts replayed on reconnection</li>
                </ul>
              </div>
            </div>
          </section>

          <hr className="my-8 border-gray-300" />

          {/* Section 13 */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-black mb-4">13. SYSTEM BOUNDARIES & DISCLAIMERS</h2>

            <div className="space-y-4 text-gray-800">
              <div>
                <h3 className="font-semibold text-black mb-2">What the System Does NOT Guarantee</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>100% accuracy in cause list parsing</li>
                  <li>Real-time synchronization with court boards</li>
                  <li>Complete capture of all lawyer name variations</li>
                  <li>Availability during court website outages</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">External Dependencies</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li><strong>Telegram Bot API</strong> — For receiving cause list PDFs</li>
                  <li><strong>Firecrawl</strong> — For PDF text extraction</li>
                  <li><strong>Google Gemini / OpenAI</strong> — For AI parsing and generation</li>
                  <li><strong>Rajasthan HC Website</strong> — Ultimate source of cause lists</li>
                </ul>
              </div>

              <div className="bg-gray-100 p-4 rounded-lg border border-gray-300">
                <h3 className="font-semibold text-black mb-2">Legal Disclaimers</h3>
                <p className="text-sm text-gray-700">
                  Nyay-Hub is a workflow tool, not a legal service. It does not provide legal advice.
                  Users are responsible for verifying all case information against official court records. 
                  Izafa Labs is not liable for missed hearings, incorrect data interpretation, or any 
                  professional consequences arising from system use.
                </p>
              </div>

              <div className="bg-gray-100 p-4 rounded-lg border border-gray-300">
                <h3 className="font-semibold text-black mb-2">Judge Intelligence Disclaimer</h3>
                <p className="text-sm text-gray-700">
                  The judicial memory module stores personal, subjective observations to aid hearing preparation. 
                  It does not predict outcomes, guarantee accuracy, or constitute professional advice. 
                  All observations are private unless explicitly shared with chamber consent.
                </p>
              </div>
            </div>
          </section>

          <hr className="my-8 border-gray-300" />

          {/* Section 14 */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-black mb-4">14. OPERATIONAL REALITIES</h2>

            <div className="space-y-4 text-gray-800">
              <div>
                <h3 className="font-semibold text-black mb-2">Expected Daily Usage</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Peak: 8:30 AM - 10:30 AM (before court starts)</li>
                  <li>Secondary peak: 1:30 PM - 2:30 PM (post-lunch resumption)</li>
                  <li>Active users concentrated in Jaipur/Jodhpur timezone</li>
                  <li>Minimal usage on weekends and court holidays</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">Court Hours (Live Board Active)</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li><strong>Summer (Apr 15 - Jun 27):</strong> 8:00 AM - 1:00 PM IST</li>
                  <li><strong>Winter:</strong> 10:30 AM - 1:00 PM + 2:00 PM - 4:30 PM IST</li>
                  <li><strong>Sundays:</strong> Courts closed</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">Cost Drivers</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li><strong>AI Tokens</strong> — Primary variable cost; ~2000 tokens per cause list page</li>
                  <li><strong>Firecrawl</strong> — PDF extraction credits; ~10 credits per cause list</li>
                  <li><strong>Supabase</strong> — Database storage, edge function invocations</li>
                </ul>
              </div>
            </div>
          </section>

          <hr className="my-8 border-gray-300" />

          {/* Section 15 */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-black mb-4">15. KNOWN LIMITATIONS & FUTURE CONSTRAINTS</h2>

            <div className="space-y-4 text-gray-800">
              <div>
                <h3 className="font-semibold text-black mb-2">Current Limitations</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Rajasthan High Court only (Jaipur and Jodhpur benches)</li>
                  <li>No native mobile app (PWA-only)</li>
                  <li>No offline document viewing (cache for metadata only)</li>
                  <li>Voice memos not transcribed automatically</li>
                  <li>No integration with e-filing systems</li>
                  <li>Chamber features limited to observation sharing (no case delegation yet)</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">Intentional Trade-offs</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li><strong>Automation over accuracy</strong> — Accepts ~5% parsing error rate for speed</li>
                  <li><strong>Simplicity over completeness</strong> — Core workflow first, edge cases later</li>
                  <li><strong>Speed over cost</strong> — Uses capable AI models even at higher token cost</li>
                  <li><strong>Privacy over convenience</strong> — Strict RLS even if it complicates queries</li>
                  <li><strong>Honesty over optimism</strong> — Staleness shown rather than hidden</li>
                </ul>
              </div>
            </div>
          </section>

          <hr className="my-8 border-gray-300" />

          {/* Section 16 */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-black mb-4">16. SUMMARY FOR EXTERNAL STORAGE</h2>

            <div className="bg-gray-100 p-6 rounded-lg space-y-4 text-gray-800 border border-gray-300">
              <div>
                <h3 className="font-semibold text-black mb-2">What Izafa Labs Has Built</h3>
                <p>Nyay-Hub is a litigation workflow operating system that automates the daily operational burden of advocates practicing at Rajasthan High Court. It ingests cause lists automatically via Telegram, parses them using AI, matches cases to lawyers via configurable aliases, and provides real-time court board monitoring — all through a role-aware, offline-capable progressive web application with chamber-based team coordination.</p>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">Why It Exists</h3>
                <p>Indian High Courts publish multi-hundred-page cause lists daily. Lawyers spend significant time manually searching for their cases, tracking court progress, and coordinating with team members. Nyay-Hub eliminates this overhead, allowing lawyers to focus on legal work rather than administrative tasks.</p>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">What Makes It Reliable</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Idempotent data ingestion prevents duplicates</li>
                  <li>Retry mechanisms with exponential backoff handle transient failures</li>
                  <li>Offline caching ensures critical data availability</li>
                  <li>Row-level security enforces strict data isolation</li>
                  <li>Trust-first design with staleness indicators and honest failure messaging</li>
                  <li>Offline threshold memory prevents silent missed alerts</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">What Assumptions It Depends On</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Rajasthan HC continues publishing cause lists as PDFs via accessible channels</li>
                  <li>Court display boards remain scrapeable or simulatable</li>
                  <li>AI providers (Gemini/OpenAI) maintain service availability</li>
                  <li>Users maintain accurate and complete lawyer name aliases</li>
                </ul>
              </div>
            </div>

            <div className="mt-8 text-center text-sm text-gray-500">
              <p>— End of Document —</p>
              <p className="mt-2">Nyay-Hub Product System Dossier v3.0</p>
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
            background: white !important;
            color: black !important;
          }
          .print\\:hidden { display: none !important; }
          .print\\:h-auto { height: auto !important; }
          .print\\:max-w-none { max-width: none !important; }
          .print\\:px-8 { padding-left: 2rem !important; padding-right: 2rem !important; }
          .print\\:mb-8 { margin-bottom: 2rem !important; }
          .print\\:page-break-after { page-break-after: always; }
          .print\\:page-break-inside-avoid { page-break-inside: avoid; }
          section { page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
};

export default ProductDossier;
