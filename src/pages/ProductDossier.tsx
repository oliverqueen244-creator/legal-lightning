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
            <h1 className="text-4xl font-bold text-black mb-4">VAKALAT-OS</h1>
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
          </div>

          <hr className="my-8 border-gray-300" />

          {/* Section 1 */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-black mb-4">1. PRODUCT OVERVIEW</h2>
            
            <div className="space-y-4 text-gray-800">
              <div>
                <h3 className="font-semibold text-black mb-2">What is Vakalat-OS?</h3>
                <p>Vakalat-OS is a litigation workflow operating system purpose-built for advocates practicing at Rajasthan High Court (Jodhpur and Jaipur benches). It transforms the daily operational burden of tracking cause lists, monitoring live court boards, and preparing for hearings into an automated, role-aware digital workflow.</p>
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
                <p>Daily cause lists at Rajasthan HC are published as multi-hundred-page PDFs. Lawyers manually search for their names across courts, track item numbers, monitor live boards for when their case is called, and coordinate with juniors — all while preparing arguments. Vakalat-OS automates this entirely.</p>
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
                <p className="text-sm text-gray-600 mb-1"><strong>Permissions:</strong> Full access to own cases, documents, arguments, whispers</p>
                <p className="text-sm text-gray-600 mb-1"><strong>Visible Features:</strong> Dashboard, War Room, Control Deck, Courtroom Mode, Morning Brief</p>
                <p className="text-sm text-gray-600"><strong>Restricted:</strong> Cannot access Admin Panel or Operations Console</p>
              </div>

              <div className="border border-gray-300 rounded-lg p-4">
                <h3 className="font-bold text-black mb-2">JUNIOR (Junior Advocate)</h3>
                <p className="text-sm text-gray-600 mb-1"><strong>Purpose:</strong> Executes tasks delegated by seniors; manages case preparation</p>
                <p className="text-sm text-gray-600 mb-1"><strong>Permissions:</strong> Upload documents, send whispers, capture post-court notes</p>
                <p className="text-sm text-gray-600 mb-1"><strong>Visible Features:</strong> Dashboard, War Room, Control Deck, Courtroom Mode</p>
                <p className="text-sm text-gray-600"><strong>Restricted:</strong> Cannot modify senior's aliases or access admin functions</p>
              </div>

              <div className="border border-gray-300 rounded-lg p-4">
                <h3 className="font-bold text-black mb-2">CLERK</h3>
                <p className="text-sm text-gray-600 mb-1"><strong>Purpose:</strong> Document organization and basic monitoring</p>
                <p className="text-sm text-gray-600 mb-1"><strong>Permissions:</strong> View docket, upload documents, view live board</p>
                <p className="text-sm text-gray-600 mb-1"><strong>Visible Features:</strong> Dashboard, Document upload, Live board view</p>
                <p className="text-sm text-gray-600"><strong>Restricted:</strong> Cannot send whispers, access War Room, or capture post-court notes</p>
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
                  <li><strong>/onboarding</strong> — First-time setup: profile, bench selection, alias configuration</li>
                  <li><strong>/</strong> — Dashboard (post-onboarding default)</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">Main Screens</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li><strong>Dashboard (/)</strong> — Today's docket, live court widgets, cause list notes, scraper status</li>
                  <li><strong>War Room (/war-room)</strong> — PDF viewer, arguments panel, judgment references, annotations</li>
                  <li><strong>Control Deck (/control-deck)</strong> — Whisper system, voice memo recording, message history</li>
                  <li><strong>Courtroom Mode (/courtroom)</strong> — Panic alert, live board display, offline snapshot</li>
                  <li><strong>Admin Panel (/admin)</strong> — Cause list scraper, docket manager, data validation (ADMIN only)</li>
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
                <p className="text-sm text-gray-600"><strong>Frequency:</strong> 3-second refresh interval</p>
                <p className="text-sm text-gray-600"><strong>Output:</strong> live_board_cache with current item, status, timestamp</p>
              </div>

              <div className="border-l-4 border-black pl-4">
                <h3 className="font-bold text-black mb-2">Morning Brief Generation</h3>
                <p className="text-sm text-gray-600"><strong>What:</strong> AI-generated summary of today's docket with priorities and alerts</p>
                <p className="text-sm text-gray-600"><strong>When:</strong> On-demand when user opens Morning Brief panel</p>
                <p className="text-sm text-gray-600"><strong>Output:</strong> Structured brief with readiness scores, suggested focus areas</p>
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
                  <li><strong>User Input</strong> — Aliases, documents, annotations, whispers, notes</li>
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
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">Data Lifecycle</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li><strong>Daily:</strong> Docket entries created, live board updated continuously</li>
                  <li><strong>Persistent:</strong> Documents, annotations, post-court notes retained indefinitely</li>
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
                <p className="text-sm text-gray-600"><strong>Trigger:</strong> Scheduled or continuous polling</p>
                <p className="text-sm text-gray-600"><strong>Action:</strong> Updates live_board_cache with current item number</p>
              </div>

              <div className="border border-gray-300 rounded-lg p-4">
                <h3 className="font-bold text-black mb-2">AI Job Processing</h3>
                <p className="text-sm text-gray-600"><strong>Queue:</strong> ai_jobs table with priority-based ordering</p>
                <p className="text-sm text-gray-600"><strong>Retries:</strong> Up to 3 attempts with exponential backoff</p>
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
                <p>Supabase Auth with email/password. Auto-confirm enabled for development. On first login, user is redirected to /onboarding if profile incomplete.</p>
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
                  <li>Admins have elevated access to operational tables</li>
                  <li>Public tables (court_metadata, live_board_cache) readable by all authenticated users</li>
                </ul>
              </div>
            </div>
          </section>

          <hr className="my-8 border-gray-300" />

          {/* Section 8 */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-black mb-4">8. SUBSCRIPTION / ACCESS STATES</h2>

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

          {/* Section 9 */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-black mb-4">9. ADMIN / OPERATOR CONSOLE</h2>

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

          {/* Section 10 */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-black mb-4">10. FAILURE MODES & EDGE CASES</h2>

            <div className="space-y-4 text-gray-800">
              <div>
                <h3 className="font-semibold text-black mb-2">Known Failure Scenarios</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li><strong>Telegram unavailable</strong> — Cause lists not ingested; manual upload required</li>
                  <li><strong>AI provider outage</strong> — Parsing queue backs up; manual retry needed</li>
                  <li><strong>Firecrawl credits exhausted</strong> — PDF extraction fails; warning status shown</li>
                  <li><strong>Court board offline</strong> — Live board shows stale data with warning</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">Safeguards Implemented</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Idempotent ingestion — duplicate Telegram messages don't create duplicates</li>
                  <li>Stuck job detection — jobs in processing &gt;10 minutes flagged</li>
                  <li>Offline cache — critical data available even without network</li>
                  <li>Retry with backoff — transient failures auto-retried</li>
                </ul>
              </div>
            </div>
          </section>

          <hr className="my-8 border-gray-300" />

          {/* Section 11 */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-black mb-4">11. SYSTEM BOUNDARIES & DISCLAIMERS</h2>

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
                  Vakalat-OS is a workflow tool, not a legal service. It does not provide legal advice. 
                  Users are responsible for verifying all case information against official court records. 
                  Izafa Labs is not liable for missed hearings, incorrect data interpretation, or any 
                  professional consequences arising from system use.
                </p>
              </div>
            </div>
          </section>

          <hr className="my-8 border-gray-300" />

          {/* Section 12 */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-black mb-4">12. OPERATIONAL REALITIES</h2>

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

          {/* Section 13 */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-black mb-4">13. KNOWN LIMITATIONS & FUTURE CONSTRAINTS</h2>

            <div className="space-y-4 text-gray-800">
              <div>
                <h3 className="font-semibold text-black mb-2">Current Limitations</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Rajasthan High Court only (Jaipur and Jodhpur benches)</li>
                  <li>No native mobile app (PWA-only)</li>
                  <li>No offline document viewing (cache for metadata only)</li>
                  <li>Voice memos not transcribed automatically</li>
                  <li>No integration with e-filing systems</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">Intentional Trade-offs</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li><strong>Automation over accuracy</strong> — Accepts ~5% parsing error rate for speed</li>
                  <li><strong>Simplicity over completeness</strong> — Core workflow first, edge cases later</li>
                  <li><strong>Speed over cost</strong> — Uses capable AI models even at higher token cost</li>
                  <li><strong>Privacy over convenience</strong> — Strict RLS even if it complicates queries</li>
                </ul>
              </div>
            </div>
          </section>

          <hr className="my-8 border-gray-300" />

          {/* Section 14 */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-black mb-4">14. SUMMARY FOR EXTERNAL STORAGE</h2>

            <div className="bg-gray-100 p-6 rounded-lg space-y-4 text-gray-800 border border-gray-300">
              <div>
                <h3 className="font-semibold text-black mb-2">What Izafa Labs Has Built</h3>
                <p>Vakalat-OS is a litigation workflow operating system that automates the daily operational burden of advocates practicing at Rajasthan High Court. It ingests cause lists automatically via Telegram, parses them using AI, matches cases to lawyers via configurable aliases, and provides real-time court board monitoring — all through a role-aware, offline-capable progressive web application.</p>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">Why It Exists</h3>
                <p>Indian High Courts publish multi-hundred-page cause lists daily. Lawyers spend significant time manually searching for their cases, tracking court progress, and coordinating with team members. Vakalat-OS eliminates this overhead, allowing lawyers to focus on legal work rather than administrative tasks.</p>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">What Makes It Reliable</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Idempotent data ingestion prevents duplicates</li>
                  <li>Retry mechanisms with exponential backoff handle transient failures</li>
                  <li>Offline caching ensures critical data availability</li>
                  <li>Row-level security enforces strict data isolation</li>
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
