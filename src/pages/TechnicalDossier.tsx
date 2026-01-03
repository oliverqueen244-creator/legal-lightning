import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Database, Server, Code, Shield, Users, Zap, FileText, Bell, Globe, Layers, Settings, Clock, AlertTriangle, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

const TechnicalDossier = () => {
  const navigate = useNavigate();

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-white text-black print:bg-white print:text-black">
      {/* Header - hidden in print */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-300 print:hidden">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => navigate(-1)} className="border-gray-300 text-black hover:bg-gray-100">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-black">Technical Dossier</h1>
              <p className="text-xs text-gray-500">Complete System Documentation</p>
            </div>
          </div>
          <Button onClick={handlePrint} className="gap-2 bg-black text-white hover:bg-gray-800">
            <Download className="h-4 w-4" />
            Save as PDF
          </Button>
        </div>
      </header>

      <ScrollArea className="h-[calc(100vh-64px)] print:h-auto">
        <div className="container mx-auto px-4 py-8 max-w-5xl print:max-w-none print:px-8">
          
          {/* Title Page */}
          <div className="text-center mb-12 print:mb-8 print:page-break-after">
            <h1 className="text-4xl font-bold text-black mb-4">NYAY-HUB</h1>
            <h2 className="text-2xl text-gray-600 mb-2">Technical Dossier</h2>
            <p className="text-lg text-black font-medium mb-4">Complete Technical & Workflow Documentation</p>
            <p className="text-sm text-gray-500">
              Generated: {new Date().toLocaleDateString('en-IN', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Built by Izafa Labs • Confidential
            </p>
          </div>

          {/* Table of Contents */}
          <section className="mb-10 print:page-break-after">
            <h2 className="text-2xl font-bold text-black mb-4 flex items-center gap-2">
              <FileText className="h-6 w-6" />
              Table of Contents
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="border border-gray-300 rounded-lg p-4">
                <h3 className="font-semibold text-black mb-2">Part I: Technical Architecture</h3>
                <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
                  <li>System Architecture Overview</li>
                  <li>Database Schema & Relationships</li>
                  <li>Edge Functions Reference</li>
                  <li>Authentication & Authorization</li>
                  <li>Real-time Systems</li>
                  <li>AI/ML Integration</li>
                  <li>Security Architecture</li>
                </ol>
              </div>
              <div className="border border-gray-300 rounded-lg p-4">
                <h3 className="font-semibold text-black mb-2">Part II: Workflows & Processes</h3>
                <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600" start={8}>
                  <li>User Onboarding Flow</li>
                  <li>Cause List Ingestion Pipeline</li>
                  <li>Case Matching Algorithm</li>
                  <li>Live Board Monitoring</li>
                  <li>Notification & Escalation</li>
                  <li>Chamber Management</li>
                  <li>Offline-First Architecture</li>
                  <li>PWA Update Strategy</li>
                  <li>Court Focus Mode</li>
                  <li>Indian Kanoon Integration</li>
                  <li>Sync Conflict Resolution</li>
                  <li>Network Status Monitoring</li>
                </ol>
              </div>
            </div>
          </section>

          <Separator className="my-8" />

          {/* PART I: TECHNICAL ARCHITECTURE */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-black mb-6 text-center bg-gray-100 py-4 rounded-lg">
              PART I: TECHNICAL ARCHITECTURE
            </h2>
          </div>

          {/* Section 1: System Architecture */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-black mb-4 flex items-center gap-2">
              <Layers className="h-6 w-6" />
              1. System Architecture Overview
            </h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-black mb-2">Technology Stack</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="border border-gray-300 rounded-lg p-4">
                    <h4 className="font-medium text-black mb-2">Frontend</h4>
                    <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                      <li><strong>React 18</strong> - UI framework with concurrent features</li>
                      <li><strong>TypeScript</strong> - Type-safe development</li>
                      <li><strong>Vite</strong> - Build tool with HMR</li>
                      <li><strong>TailwindCSS</strong> - Utility-first styling</li>
                      <li><strong>Shadcn/UI</strong> - Component library</li>
                      <li><strong>TanStack Query</strong> - Server state management</li>
                      <li><strong>React Router v6</strong> - Client-side routing</li>
                      <li><strong>Framer Motion</strong> - Animations</li>
                    </ul>
                  </div>
                  <div className="border border-gray-300 rounded-lg p-4">
                    <h4 className="font-medium text-black mb-2">Backend (Supabase)</h4>
                    <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                      <li><strong>PostgreSQL</strong> - Primary database</li>
                      <li><strong>PostgREST</strong> - Auto-generated REST API</li>
                      <li><strong>Supabase Auth</strong> - JWT-based authentication</li>
                      <li><strong>Supabase Storage</strong> - File storage (PDFs)</li>
                      <li><strong>Supabase Realtime</strong> - WebSocket subscriptions</li>
                      <li><strong>Edge Functions</strong> - Deno-based serverless</li>
                      <li><strong>Row Level Security</strong> - Data isolation</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">High-Level Architecture Diagram</h3>
                <div className="bg-gray-100 p-4 rounded-lg border border-gray-300 font-mono text-xs overflow-x-auto">
                  <pre className="text-gray-700 whitespace-pre">
{`┌─────────────────────────────────────────────────────────────────────────────────┐
│                              NYAY-HUB ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                            CLIENT LAYER (PWA)                                ││
│  ├─────────────────────────────────────────────────────────────────────────────┤│
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       ││
│  │  │Dashboard │  │ War Room │  │  Ctrl    │  │Courtroom │  │  Admin   │       ││
│  │  │   (/)    │  │/war-room │  │  Deck    │  │  Mode    │  │  Panel   │       ││
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘       ││
│  │       └─────────────┴─────────────┴─────────────┴─────────────┘             ││
│  │                                   │                                          ││
│  │  ┌────────────────────────────────┴────────────────────────────────────┐    ││
│  │  │                    SHARED HOOKS & STATE                              │    ││
│  │  │  • useAuth        • useDocket       • useLiveBoard                   │    ││
│  │  │  • useUserRole    • useChambers     • useNotifications               │    ││
│  │  │  • useOfflineCache • useSyncHealth  • usePWAUpdate                   │    ││
│  │  └────────────────────────────────┬────────────────────────────────────┘    ││
│  │                                   │                                          ││
│  │  ┌────────────────────────────────┴────────────────────────────────────┐    ││
│  │  │                    OFFLINE LAYER (IndexedDB)                         │    ││
│  │  │  • Courtroom Snapshot    • Threshold Memory    • Pending Sync Queue  │    ││
│  │  └─────────────────────────────────────────────────────────────────────┘    ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                      │                                           │
│                            ┌─────────▼─────────┐                                │
│                            │   SUPABASE SDK    │                                │
│                            │  (supabase-js)    │                                │
│                            └─────────┬─────────┘                                │
│                                      │                                           │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                          SUPABASE CLOUD                                      ││
│  ├─────────────────────────────────────────────────────────────────────────────┤│
│  │                                                                              ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     ││
│  │  │   PostgREST  │  │    Auth      │  │   Storage    │  │   Realtime   │     ││
│  │  │   REST API   │  │    (JWT)     │  │   (S3-like)  │  │  (WebSocket) │     ││
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     ││
│  │         └─────────────────┴─────────────────┴─────────────────┘             ││
│  │                                   │                                          ││
│  │  ┌────────────────────────────────┴────────────────────────────────────┐    ││
│  │  │                      POSTGRESQL + RLS                                │    ││
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │    ││
│  │  │  │profiles  │ │ docket   │ │live_board│ │chambers  │ │ai_jobs   │   │    ││
│  │  │  │user_roles│ │documents │ │_cache    │ │memberships│ │parse_cache│   │    ││
│  │  │  │aliases   │ │arguments │ │sync_status│ │invites   │ │jobs_queue│   │    ││
│  │  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘   │    ││
│  │  └─────────────────────────────────────────────────────────────────────┘    ││
│  │                                                                              ││
│  │  ┌─────────────────────────────────────────────────────────────────────┐    ││
│  │  │                      EDGE FUNCTIONS (Deno)                           │    ││
│  │  │  • telegram-webhook     • parse-case          • ai-worker            │    ││
│  │  │  • download-causelists  • auto-match-aliases  • search-indian-kanoon │    ││
│  │  │  • sync-live-board      • scrape-live-board   • escalate-whatsapp    │    ││
│  │  └─────────────────────────────────────────────────────────────────────┘    ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                      │                                           │
│  ┌───────────────────────────────────┴───────────────────────────────────────┐  │
│  │                         EXTERNAL INTEGRATIONS                              │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │  │
│  │  │ Telegram │  │ Google   │  │  Indian  │  │ WhatsApp │  │  Court   │     │  │
│  │  │   Bot    │  │ Gemini   │  │  Kanoon  │  │ Business │  │ Website  │     │  │
│  │  │   API    │  │   API    │  │   API    │  │   API    │  │ Scraping │     │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘`}
                  </pre>
                </div>
              </div>
            </div>
          </section>

          <Separator className="my-8" />

          {/* Section 2: Database Schema */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-black mb-4 flex items-center gap-2">
              <Database className="h-6 w-6" />
              2. Database Schema & Relationships
            </h2>

            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-black mb-2">Core Tables Summary</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 p-2 text-left">Table</th>
                        <th className="border border-gray-300 p-2 text-left">Purpose</th>
                        <th className="border border-gray-300 p-2 text-left">Key Fields</th>
                        <th className="border border-gray-300 p-2 text-left">RLS</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-gray-300 p-2 font-mono">profiles</td>
                        <td className="border border-gray-300 p-2">User profile data</td>
                        <td className="border border-gray-300 p-2">id, full_name, bench, whatsapp_number</td>
                        <td className="border border-gray-300 p-2">✅ User-scoped</td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 p-2 font-mono">user_roles</td>
                        <td className="border border-gray-300 p-2">Role assignment (RBAC)</td>
                        <td className="border border-gray-300 p-2">user_id, role (enum)</td>
                        <td className="border border-gray-300 p-2">✅ User-scoped</td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 p-2 font-mono">lawyer_aliases</td>
                        <td className="border border-gray-300 p-2">Name variations for matching</td>
                        <td className="border border-gray-300 p-2">profile_id, alias_name, is_primary</td>
                        <td className="border border-gray-300 p-2">✅ User-scoped</td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 p-2 font-mono">daily_court_docket</td>
                        <td className="border border-gray-300 p-2">Parsed case entries</td>
                        <td className="border border-gray-300 p-2">date, case_number, matched_profile_id</td>
                        <td className="border border-gray-300 p-2">✅ Profile-matched</td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 p-2 font-mono">case_documents</td>
                        <td className="border border-gray-300 p-2">Uploaded case files</td>
                        <td className="border border-gray-300 p-2">docket_id, file_url, document_type</td>
                        <td className="border border-gray-300 p-2">✅ Docket-linked</td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 p-2 font-mono">case_arguments</td>
                        <td className="border border-gray-300 p-2">Argument preparation</td>
                        <td className="border border-gray-300 p-2">docket_id, title, linked_page_number</td>
                        <td className="border border-gray-300 p-2">✅ Docket-linked</td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 p-2 font-mono">live_board_cache</td>
                        <td className="border border-gray-300 p-2">Real-time court status</td>
                        <td className="border border-gray-300 p-2">court_no, current_item, status</td>
                        <td className="border border-gray-300 p-2">🌐 Public read</td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 p-2 font-mono">chambers</td>
                        <td className="border border-gray-300 p-2">Law office teams</td>
                        <td className="border border-gray-300 p-2">name, owner_id</td>
                        <td className="border border-gray-300 p-2">✅ Member-scoped</td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 p-2 font-mono">judge_observations</td>
                        <td className="border border-gray-300 p-2">Private judicial notes</td>
                        <td className="border border-gray-300 p-2">lawyer_id, judge_name, observation_text</td>
                        <td className="border border-gray-300 p-2">✅ Lawyer-private</td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 p-2 font-mono">ai_jobs</td>
                        <td className="border border-gray-300 p-2">AI task queue</td>
                        <td className="border border-gray-300 p-2">job_type, status, payload, result</td>
                        <td className="border border-gray-300 p-2">⚙️ Service role</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">Enum Types</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="border border-gray-300 rounded-lg p-3">
                    <h4 className="font-medium text-black mb-1 text-sm">app_role</h4>
                    <p className="text-xs text-gray-600 font-mono">SENIOR | JUNIOR | CLERK | ADMIN</p>
                  </div>
                  <div className="border border-gray-300 rounded-lg p-3">
                    <h4 className="font-medium text-black mb-1 text-sm">chamber_role</h4>
                    <p className="text-xs text-gray-600 font-mono">senior | junior | clerk</p>
                  </div>
                  <div className="border border-gray-300 rounded-lg p-3">
                    <h4 className="font-medium text-black mb-1 text-sm">document_type</h4>
                    <p className="text-xs text-gray-600 font-mono">PETITION | REPLY | REJOINDER | ORDER | ...</p>
                  </div>
                  <div className="border border-gray-300 rounded-lg p-3">
                    <h4 className="font-medium text-black mb-1 text-sm">board_status</h4>
                    <p className="text-xs text-gray-600 font-mono">hearing | passover | lunch | adjourned</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">Database Functions</h3>
                <div className="space-y-2">
                  <div className="border-l-4 border-black pl-4">
                    <code className="text-sm font-mono">handle_new_user()</code>
                    <p className="text-xs text-gray-600">Trigger: Creates profile + assigns role on auth.users INSERT</p>
                  </div>
                  <div className="border-l-4 border-black pl-4">
                    <code className="text-sm font-mono">trigger_auto_match_aliases()</code>
                    <p className="text-xs text-gray-600">Trigger: Calls auto-match edge function on docket INSERT</p>
                  </div>
                  <div className="border-l-4 border-black pl-4">
                    <code className="text-sm font-mono">generate_case_fingerprint()</code>
                    <p className="text-xs text-gray-600">Generates unique case identifier for history tracking</p>
                  </div>
                  <div className="border-l-4 border-black pl-4">
                    <code className="text-sm font-mono">get_user_role(user_id)</code>
                    <p className="text-xs text-gray-600">Returns user's app_role enum value</p>
                  </div>
                  <div className="border-l-4 border-black pl-4">
                    <code className="text-sm font-mono">has_active_subscription(user_id)</code>
                    <p className="text-xs text-gray-600">Checks subscription status for feature gating</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <Separator className="my-8" />

          {/* Section 3: Edge Functions */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-black mb-4 flex items-center gap-2">
              <Server className="h-6 w-6" />
              3. Edge Functions Reference
            </h2>

            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                All edge functions run on Deno runtime with Supabase Edge Functions. Located in <code className="bg-gray-100 px-1">supabase/functions/</code>.
              </p>

              <div className="grid gap-4">
                {/* Ingestion Functions */}
                <div className="border border-gray-300 rounded-lg p-4">
                  <h3 className="font-semibold text-black mb-3">📥 Ingestion Pipeline</h3>
                  <div className="space-y-3">
                    <div className="border-l-4 border-blue-500 pl-3">
                      <code className="text-sm font-mono font-bold">telegram-webhook</code>
                      <p className="text-xs text-gray-600 mt-1">Receives PDF attachments from Telegram bot, validates webhook secret, queues for processing</p>
                      <p className="text-xs text-gray-500">Auth: Bot token validation | JWT: No (webhook)</p>
                    </div>
                    <div className="border-l-4 border-blue-500 pl-3">
                      <code className="text-sm font-mono font-bold">download-causelists</code>
                      <p className="text-xs text-gray-600 mt-1">Downloads PDF from Telegram, stores in Supabase Storage, creates raw_causelists record</p>
                      <p className="text-xs text-gray-500">Auth: Service role | Trigger: telegram-webhook</p>
                    </div>
                    <div className="border-l-4 border-blue-500 pl-3">
                      <code className="text-sm font-mono font-bold">parse-case / parse-all-cases</code>
                      <p className="text-xs text-gray-600 mt-1">AI-powered PDF parsing using Google Gemini, extracts structured case data</p>
                      <p className="text-xs text-gray-500">Auth: Service role | AI: Gemini 2.5 Flash</p>
                    </div>
                    <div className="border-l-4 border-blue-500 pl-3">
                      <code className="text-sm font-mono font-bold">auto-match-aliases</code>
                      <p className="text-xs text-gray-600 mt-1">Matches extracted lawyer names against user aliases, updates docket records</p>
                      <p className="text-xs text-gray-500">Auth: Trigger secret | Trigger: DB trigger</p>
                    </div>
                  </div>
                </div>

                {/* Live Monitoring Functions */}
                <div className="border border-gray-300 rounded-lg p-4">
                  <h3 className="font-semibold text-black mb-3">📡 Live Monitoring</h3>
                  <div className="space-y-3">
                    <div className="border-l-4 border-green-500 pl-3">
                      <code className="text-sm font-mono font-bold">scrape-live-board</code>
                      <p className="text-xs text-gray-600 mt-1">Scrapes court display board website for current item numbers</p>
                      <p className="text-xs text-gray-500">Auth: Service role | Schedule: Every 30s during court hours</p>
                    </div>
                    <div className="border-l-4 border-green-500 pl-3">
                      <code className="text-sm font-mono font-bold">sync-live-board</code>
                      <p className="text-xs text-gray-600 mt-1">Synchronizes scraped data to live_board_cache table</p>
                      <p className="text-xs text-gray-500">Auth: Service role | Realtime: Broadcasts updates</p>
                    </div>
                    <div className="border-l-4 border-green-500 pl-3">
                      <code className="text-sm font-mono font-bold">simulate-live-board</code>
                      <p className="text-xs text-gray-600 mt-1">Development/testing: Simulates live board progression</p>
                      <p className="text-xs text-gray-500">Auth: Admin only | Environment: Dev only</p>
                    </div>
                  </div>
                </div>

                {/* AI & Search Functions */}
                <div className="border border-gray-300 rounded-lg p-4">
                  <h3 className="font-semibold text-black mb-3">🤖 AI & Search</h3>
                  <div className="space-y-3">
                    <div className="border-l-4 border-purple-500 pl-3">
                      <code className="text-sm font-mono font-bold">ai-worker</code>
                      <p className="text-xs text-gray-600 mt-1">General AI job processor, handles queued AI tasks with retry logic</p>
                      <p className="text-xs text-gray-500">Auth: Service role | Providers: Gemini (primary), OpenAI (fallback)</p>
                    </div>
                    <div className="border-l-4 border-purple-500 pl-3">
                      <code className="text-sm font-mono font-bold">search-indian-kanoon</code>
                      <p className="text-xs text-gray-600 mt-1">Searches Indian Kanoon API for case law references</p>
                      <p className="text-xs text-gray-500">Auth: JWT | Rate limited: Yes</p>
                    </div>
                    <div className="border-l-4 border-purple-500 pl-3">
                      <code className="text-sm font-mono font-bold">extract-causelist-notes</code>
                      <p className="text-xs text-gray-600 mt-1">AI extraction of special notes/announcements from cause list PDFs</p>
                      <p className="text-xs text-gray-500">Auth: Service role | AI: Gemini 2.5 Flash</p>
                    </div>
                  </div>
                </div>

                {/* Utility Functions */}
                <div className="border border-gray-300 rounded-lg p-4">
                  <h3 className="font-semibold text-black mb-3">🔧 Utilities</h3>
                  <div className="space-y-3">
                    <div className="border-l-4 border-yellow-500 pl-3">
                      <code className="text-sm font-mono font-bold">health-check</code>
                      <p className="text-xs text-gray-600 mt-1">System health endpoint for monitoring</p>
                      <p className="text-xs text-gray-500">Auth: None (public) | Returns: System status</p>
                    </div>
                    <div className="border-l-4 border-yellow-500 pl-3">
                      <code className="text-sm font-mono font-bold">escalate-whatsapp</code>
                      <p className="text-xs text-gray-600 mt-1">Sends WhatsApp notifications for critical unacknowledged alerts</p>
                      <p className="text-xs text-gray-500">Auth: Service role | API: WhatsApp Business</p>
                    </div>
                    <div className="border-l-4 border-yellow-500 pl-3">
                      <code className="text-sm font-mono font-bold">data-validation</code>
                      <p className="text-xs text-gray-600 mt-1">Validates parsed data integrity, flags anomalies</p>
                      <p className="text-xs text-gray-500">Auth: Admin | Logs: data_validation_logs</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <Separator className="my-8" />

          {/* Section 4: Authentication */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-black mb-4 flex items-center gap-2">
              <Shield className="h-6 w-6" />
              4. Authentication & Authorization
            </h2>

            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-black mb-2">Authentication Flow</h3>
                <div className="bg-gray-100 p-4 rounded-lg border border-gray-300 font-mono text-xs overflow-x-auto">
                  <pre className="text-gray-700 whitespace-pre">
{`User → /auth (Email/Password)
     ↓
Supabase Auth (signUp/signIn)
     ↓
JWT Token Generated
     ↓
handle_new_user() Trigger
     ├─→ INSERT profiles (id, full_name)
     └─→ INSERT user_roles (user_id, role)
           ↓
Onboarding Check (onboarding_completed?)
     ├─→ FALSE: Redirect to /onboarding
     └─→ TRUE: Redirect to /dashboard`}
                  </pre>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">Role-Based Access Matrix</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 p-2 text-left">Feature</th>
                        <th className="border border-gray-300 p-2 text-center">SENIOR</th>
                        <th className="border border-gray-300 p-2 text-center">JUNIOR</th>
                        <th className="border border-gray-300 p-2 text-center">CLERK</th>
                        <th className="border border-gray-300 p-2 text-center">ADMIN</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td className="border border-gray-300 p-2">Dashboard</td><td className="border border-gray-300 p-2 text-center">✅</td><td className="border border-gray-300 p-2 text-center">✅</td><td className="border border-gray-300 p-2 text-center">✅</td><td className="border border-gray-300 p-2 text-center">✅</td></tr>
                      <tr><td className="border border-gray-300 p-2">War Room</td><td className="border border-gray-300 p-2 text-center">✅</td><td className="border border-gray-300 p-2 text-center">✅</td><td className="border border-gray-300 p-2 text-center">❌</td><td className="border border-gray-300 p-2 text-center">✅</td></tr>
                      <tr><td className="border border-gray-300 p-2">Control Deck</td><td className="border border-gray-300 p-2 text-center">✅</td><td className="border border-gray-300 p-2 text-center">✅</td><td className="border border-gray-300 p-2 text-center">❌</td><td className="border border-gray-300 p-2 text-center">✅</td></tr>
                      <tr><td className="border border-gray-300 p-2">Courtroom Mode</td><td className="border border-gray-300 p-2 text-center">✅</td><td className="border border-gray-300 p-2 text-center">✅</td><td className="border border-gray-300 p-2 text-center">✅</td><td className="border border-gray-300 p-2 text-center">✅</td></tr>
                      <tr><td className="border border-gray-300 p-2">Create Chamber</td><td className="border border-gray-300 p-2 text-center">✅</td><td className="border border-gray-300 p-2 text-center">❌</td><td className="border border-gray-300 p-2 text-center">❌</td><td className="border border-gray-300 p-2 text-center">✅</td></tr>
                      <tr><td className="border border-gray-300 p-2">Send Whispers</td><td className="border border-gray-300 p-2 text-center">✅</td><td className="border border-gray-300 p-2 text-center">✅</td><td className="border border-gray-300 p-2 text-center">❌</td><td className="border border-gray-300 p-2 text-center">✅</td></tr>
                      <tr><td className="border border-gray-300 p-2">Admin Panel</td><td className="border border-gray-300 p-2 text-center">❌</td><td className="border border-gray-300 p-2 text-center">❌</td><td className="border border-gray-300 p-2 text-center">❌</td><td className="border border-gray-300 p-2 text-center">✅</td></tr>
                      <tr><td className="border border-gray-300 p-2">Operations Console</td><td className="border border-gray-300 p-2 text-center">❌</td><td className="border border-gray-300 p-2 text-center">❌</td><td className="border border-gray-300 p-2 text-center">❌</td><td className="border border-gray-300 p-2 text-center">✅</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">Row Level Security Patterns</h3>
                <div className="space-y-2">
                  <div className="bg-gray-100 p-3 rounded border border-gray-300">
                    <code className="text-xs font-mono">auth.uid() = user_id</code>
                    <p className="text-xs text-gray-600 mt-1">User can only access their own records (profiles, aliases)</p>
                  </div>
                  <div className="bg-gray-100 p-3 rounded border border-gray-300">
                    <code className="text-xs font-mono">auth.uid() = matched_profile_id</code>
                    <p className="text-xs text-gray-600 mt-1">User sees only cases matched to their profile (docket)</p>
                  </div>
                  <div className="bg-gray-100 p-3 rounded border border-gray-300">
                    <code className="text-xs font-mono">has_role(auth.uid(), 'ADMIN')</code>
                    <p className="text-xs text-gray-600 mt-1">Admin-only tables (scraper_logs, ai_jobs)</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <Separator className="my-8" />

          {/* Section 5: Real-time Systems */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-black mb-4 flex items-center gap-2">
              <Zap className="h-6 w-6" />
              5. Real-time Systems
            </h2>

            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-black mb-2">Supabase Realtime Subscriptions</h3>
                <div className="space-y-3">
                  <div className="border border-gray-300 rounded-lg p-4">
                    <h4 className="font-medium text-black mb-2">live_board_cache</h4>
                    <p className="text-sm text-gray-600">Real-time court status updates</p>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded mt-2 block">
                      supabase.channel('live_board').on('postgres_changes', ...)
                    </code>
                    <ul className="text-xs text-gray-500 mt-2 list-disc list-inside">
                      <li>Triggers UI update on current_item change</li>
                      <li>Updates staleness indicator</li>
                      <li>Fires proximity notifications</li>
                    </ul>
                  </div>
                  <div className="border border-gray-300 rounded-lg p-4">
                    <h4 className="font-medium text-black mb-2">live_courtroom_feed</h4>
                    <p className="text-sm text-gray-600">Whisper messages between team members</p>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded mt-2 block">
                      supabase.channel('whispers').on('postgres_changes', ...)
                    </code>
                    <ul className="text-xs text-gray-500 mt-2 list-disc list-inside">
                      <li>Instant message delivery</li>
                      <li>Read receipt updates</li>
                      <li>Audio notification on new message</li>
                    </ul>
                  </div>
                  <div className="border border-gray-300 rounded-lg p-4">
                    <h4 className="font-medium text-black mb-2">notifications</h4>
                    <p className="text-sm text-gray-600">Proximity alerts and system notifications</p>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded mt-2 block">
                      supabase.channel('notifications').on('postgres_changes', ...)
                    </code>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">Client State Management</h3>
                <p className="text-sm text-gray-600 mb-2">TanStack Query integration with realtime invalidation:</p>
                <div className="bg-gray-100 p-3 rounded border border-gray-300 font-mono text-xs">
                  <pre>{`// Realtime subscription triggers query invalidation
channel.on('postgres_changes', (payload) => {
  queryClient.invalidateQueries({ queryKey: ['live-board'] });
});

// Optimistic updates for user actions
queryClient.setQueryData(['notifications'], (old) => [...old, newNotif]);`}</pre>
                </div>
              </div>
            </div>
          </section>

          <Separator className="my-8" />

          {/* Section 6: AI/ML Integration */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-black mb-4 flex items-center gap-2">
              <Code className="h-6 w-6" />
              6. AI/ML Integration
            </h2>

            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-black mb-2">AI Providers</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="border border-gray-300 rounded-lg p-4">
                    <h4 className="font-medium text-black mb-2">Primary: Google Gemini</h4>
                    <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                      <li>Model: gemini-2.5-flash / gemini-2.5-pro</li>
                      <li>Native PDF processing</li>
                      <li>Cause list parsing</li>
                      <li>Morning brief generation</li>
                    </ul>
                  </div>
                  <div className="border border-gray-300 rounded-lg p-4">
                    <h4 className="font-medium text-black mb-2">Fallback: OpenAI</h4>
                    <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                      <li>Used when Gemini unavailable</li>
                      <li>Higher cost, similar capability</li>
                      <li>Automatic failover in ai-worker</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">AI Job Queue Architecture</h3>
                <div className="bg-gray-100 p-4 rounded-lg border border-gray-300 font-mono text-xs overflow-x-auto">
                  <pre className="text-gray-700 whitespace-pre">
{`┌─────────────────────────────────────────────────────────────┐
│                    AI JOB PROCESSING                         │
└─────────────────────────────────────────────────────────────┘

  Job Created                ai_jobs table               Processing
  ──────────                 ────────────                ──────────

  INSERT →  ┌─────────────┐     ┌──────────┐     ┌─────────────┐
            │ job_type    │     │  status  │     │ ai-worker   │
            │ payload     │ ──► │ pending  │ ──► │ edge func   │
            │ priority    │     │ retries  │     │             │
            └─────────────┘     └──────────┘     └─────────────┘
                                     │                   │
                                     │                   ▼
                                     │         ┌─────────────────┐
                                     │         │ Gemini/OpenAI   │
                                     │         │ API Call        │
                                     │         └────────┬────────┘
                                     │                  │
                                     ▼                  ▼
                              ┌──────────┐      ┌─────────────┐
                              │ completed│ ◄─── │ result JSON │
                              │ or error │      │ tokens_used │
                              └──────────┘      └─────────────┘

  Retry Logic:
  • max_retries: 3
  • Exponential backoff: 30s, 60s, 120s
  • Provider fallback on persistent failure`}
                  </pre>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">AI Use Cases</h3>
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="border-l-4 border-purple-500 pl-3">
                    <p className="font-medium text-sm">Cause List Parsing</p>
                    <p className="text-xs text-gray-600">Extract structured case data from PDF</p>
                  </div>
                  <div className="border-l-4 border-purple-500 pl-3">
                    <p className="font-medium text-sm">Morning Brief Generation</p>
                    <p className="text-xs text-gray-600">Summarize today's docket with priorities</p>
                  </div>
                  <div className="border-l-4 border-purple-500 pl-3">
                    <p className="font-medium text-sm">Cause List Notes Extraction</p>
                    <p className="text-xs text-gray-600">Identify special announcements</p>
                  </div>
                  <div className="border-l-4 border-purple-500 pl-3">
                    <p className="font-medium text-sm">Client Update Generation</p>
                    <p className="text-xs text-gray-600">Draft client communication</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <Separator className="my-8" />

          {/* Section 7: Security */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-black mb-4 flex items-center gap-2">
              <Shield className="h-6 w-6" />
              7. Security Architecture
            </h2>

            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-black mb-2">Security Layers</h3>
                <div className="space-y-2">
                  <div className="border border-gray-300 rounded-lg p-3 flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Transport Security</p>
                      <p className="text-xs text-gray-600">All traffic over HTTPS/WSS</p>
                    </div>
                  </div>
                  <div className="border border-gray-300 rounded-lg p-3 flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Authentication</p>
                      <p className="text-xs text-gray-600">JWT tokens with Supabase Auth</p>
                    </div>
                  </div>
                  <div className="border border-gray-300 rounded-lg p-3 flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Row Level Security</p>
                      <p className="text-xs text-gray-600">Database-enforced data isolation</p>
                    </div>
                  </div>
                  <div className="border border-gray-300 rounded-lg p-3 flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Webhook Authentication</p>
                      <p className="text-xs text-gray-600">Telegram webhook validated with bot token</p>
                    </div>
                  </div>
                  <div className="border border-gray-300 rounded-lg p-3 flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Input Validation</p>
                      <p className="text-xs text-gray-600">SECURITY DEFINER functions validate inputs</p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">Data Protection Features</h3>
                <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                  <li><strong>SensitiveViewGuard:</strong> Watermarks sensitive content with user ID</li>
                  <li><strong>Copy Prevention:</strong> user-select: none on protected surfaces</li>
                  <li><strong>Context Menu Disabled:</strong> Right-click blocked on sensitive data</li>
                  <li><strong>No Bulk Export:</strong> No CSV/PDF export features by design</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">Secrets Management</h3>
                <p className="text-sm text-gray-600 mb-2">All secrets stored in Supabase Vault, accessed via <code className="bg-gray-100 px-1">Deno.env.get()</code>:</p>
                <div className="grid md:grid-cols-3 gap-2">
                  <div className="bg-gray-100 p-2 rounded text-xs font-mono">TELEGRAM_BOT_TOKEN</div>
                  <div className="bg-gray-100 p-2 rounded text-xs font-mono">GOOGLE_AI_API_KEY</div>
                  <div className="bg-gray-100 p-2 rounded text-xs font-mono">OPENAI_API_KEY</div>
                  <div className="bg-gray-100 p-2 rounded text-xs font-mono">SUPABASE_SERVICE_ROLE_KEY</div>
                  <div className="bg-gray-100 p-2 rounded text-xs font-mono">FIRECRAWL_API_KEY</div>
                  <div className="bg-gray-100 p-2 rounded text-xs font-mono">TRIGGER_SECRET</div>
                </div>
              </div>
            </div>
          </section>

          <Separator className="my-8" />

          {/* PART II: WORKFLOWS */}
          <div className="mb-8 print:page-break-before">
            <h2 className="text-3xl font-bold text-black mb-6 text-center bg-gray-100 py-4 rounded-lg">
              PART II: WORKFLOWS & PROCESSES
            </h2>
          </div>

          {/* Section 8: User Onboarding */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-black mb-4 flex items-center gap-2">
              <Users className="h-6 w-6" />
              8. User Onboarding Flow
            </h2>

            <div className="space-y-4">
              <div className="bg-gray-100 p-4 rounded-lg border border-gray-300 font-mono text-xs overflow-x-auto">
                <pre className="text-gray-700 whitespace-pre">
{`┌────────────────────────────────────────────────────────────────────────────┐
│                         USER ONBOARDING FLOW                                │
└────────────────────────────────────────────────────────────────────────────┘

  /auth (Sign Up)
       │
       ▼
  ┌─────────────────┐
  │ Supabase Auth   │
  │ signUp()        │
  └────────┬────────┘
           │ handle_new_user() trigger
           ▼
  ┌─────────────────┐
  │ Profile Created │ ◄─── Default: onboarding_completed = false
  │ Role Assigned   │ ◄─── From metadata or default JUNIOR
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐     onboarding_completed = false
  │ Redirect to     │ ─────────────────────────────────┐
  │ /onboarding     │                                  │
  └────────┬────────┘                                  │
           │                                           │
           ▼                                           │
  ┌════════════════════════════════════════════════════╧═══════════════┐
  ║                     ONBOARDING STEPS                                ║
  ╠════════════════════════════════════════════════════════════════════╣
  ║                                                                     ║
  ║  ┌─────────────────────────────────────────────────────────────┐   ║
  ║  │ STEP 1: PROFILE                                              │   ║
  ║  │ • Full name (required)                                       │   ║
  ║  │ • Bar registration number                                    │   ║
  ║  │ • Preferred bench (Jodhpur/Jaipur)                          │   ║
  ║  │ • WhatsApp number (for escalations)                          │   ║
  ║  │ • Role selection (Senior/Junior/Clerk)                       │   ║
  ║  └─────────────────────────────────────────────────────────────┘   ║
  ║                              │                                      ║
  ║                              ▼                                      ║
  ║  ┌─────────────────────────────────────────────────────────────┐   ║
  ║  │ STEP 2: ALIASES                                              │   ║
  ║  │ • Primary name (from profile)                                │   ║
  ║  │ • Add alternative spellings                                  │   ║
  ║  │ • Add abbreviations                                          │   ║
  ║  │ • Scan existing causelists to suggest matches                │   ║
  ║  └─────────────────────────────────────────────────────────────┘   ║
  ║                              │                                      ║
  ║                              ▼                                      ║
  ║  ┌─────────────────────────────────────────────────────────────┐   ║
  ║  │ STEP 3: CHAMBER (Role-dependent)                             │   ║
  ║  │                                                               │   ║
  ║  │ IF SENIOR:                                                    │   ║
  ║  │   • Create new chamber                                        │   ║
  ║  │   • Set chamber name                                          │   ║
  ║  │   • Become owner                                              │   ║
  ║  │                                                               │   ║
  ║  │ IF JUNIOR/CLERK:                                              │   ║
  ║  │   • Enter invite code to join chamber                         │   ║
  ║  │   OR                                                          │   ║
  ║  │   • Practice solo (skip chamber)                              │   ║
  ║  └─────────────────────────────────────────────────────────────┘   ║
  ║                              │                                      ║
  ╚══════════════════════════════╧══════════════════════════════════════╝
                                 │
                                 ▼
                    ┌─────────────────┐
                    │ SET             │
                    │ onboarding_     │
                    │ completed=true  │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Redirect to     │
                    │ / (Dashboard)   │
                    └─────────────────┘`}
                </pre>
              </div>
            </div>
          </section>

          <Separator className="my-8" />

          {/* Section 9: Cause List Ingestion */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-black mb-4 flex items-center gap-2">
              <FileText className="h-6 w-6" />
              9. Cause List Ingestion Pipeline
            </h2>

            <div className="space-y-4">
              <div className="bg-gray-100 p-4 rounded-lg border border-gray-300 font-mono text-xs overflow-x-auto">
                <pre className="text-gray-700 whitespace-pre">
{`┌────────────────────────────────────────────────────────────────────────────┐
│                     CAUSE LIST INGESTION PIPELINE                           │
└────────────────────────────────────────────────────────────────────────────┘

  TELEGRAM CHANNEL                     EDGE FUNCTIONS                  DATABASE
  ─────────────────                    ──────────────                  ────────

  ┌─────────────────┐
  │ Court publishes │
  │ cause list PDF  │
  └────────┬────────┘
           │ Bot receives message
           ▼
  ┌─────────────────┐     Webhook POST     ┌─────────────────────────────────┐
  │ Telegram Bot    │ ──────────────────► │ telegram-webhook                 │
  │ (causelist      │                     │                                   │
  │  channels)      │                     │ • Validate x-telegram-bot-api-   │
  └─────────────────┘                     │   secret-token (= BOT_TOKEN)     │
                                          │ • Determine bench from filename   │
                                          │ • Determine list type             │
                                          │ • Extract date                    │
                                          └───────────────┬───────────────────┘
                                                          │
                                                          ▼
                                          ┌─────────────────────────────────┐
                                          │ download-causelists              │
                                          │                                   │
                                          │ • Download PDF via Telegram API   │
                                          │ • Upload to Storage bucket        │ ───►┌──────────────┐
                                          │ • Create raw_causelists record    │     │Storage:      │
                                          │ • Trigger notes extraction        │     │causelist-pdfs│
                                          └───────────────┬───────────────────┘     └──────────────┘
                                                          │                                ↓
                                                          ▼                         raw_causelists
                                          ┌─────────────────────────────────┐      ┌──────────────┐
                                          │ extract-causelist-notes         │      │• storage_path│
                                          │                                   │      │• text_content│
                                          │ • AI extraction of special notes │ ───►│• page_count  │
                                          │ • Save to cause_list_notes       │      │• status      │
                                          └───────────────┬───────────────────┘     └──────────────┘
                                                          │                                ↓
                                                          ▼                         cause_list_notes
                                          ┌─────────────────────────────────┐      ┌──────────────┐
                                          │ parse-all-cases (CRON)          │      │• note_text   │
                                          │                                   │      │• note_type   │
                                          │ • Batch AI parsing               │      │• page_number │
                                          │ • Structure detection            │      └──────────────┘
                                          │ • Court-based splitting          │
                                          └───────────────┬───────────────────┘
                                                          │
                                                          ▼
                                          ┌─────────────────────────────────┐
                                          │ parse-case (per court/chunk)    │
                                          │                                   │
                                          │ • Gemini PDF vision              │
                                          │ • Extract: item_no, case_number, │
                                          │   petitioner, respondent,        │
                                          │   lawyers, judge_names           │
                                          │ • Insert to daily_court_docket   │ ───►┌──────────────┐
                                          └───────────────┬───────────────────┘     │daily_court   │
                                                          │                         │_docket       │
                                                          │ DB TRIGGER              └──────────────┘
                                                          ▼
                                          ┌─────────────────────────────────┐
                                          │ trigger_auto_match_aliases()    │
                                          │                                   │
                                          │ • HTTP call to auto-match-aliases │
                                          └───────────────┬───────────────────┘
                                                          │
                                                          ▼
                                          ┌─────────────────────────────────┐
                                          │ auto-match-aliases               │
                                          │                                   │
                                          │ • Fuzzy match lawyer names       │
                                          │ • Update matched_profile_id     │ ───►┌──────────────┐
                                          │ • Set match_confidence           │     │matched!      │
                                          └─────────────────────────────────┘     │profile + role│
                                                                                   └──────────────┘`}
                </pre>
              </div>
            </div>
          </section>

          <Separator className="my-8" />

          {/* Section 10: Case Matching */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-black mb-4 flex items-center gap-2">
              <Settings className="h-6 w-6" />
              10. Case Matching Algorithm
            </h2>

            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                The alias matching system ensures lawyers see cases where they appear, even with name variations in cause lists.
              </p>

              <div className="bg-gray-100 p-4 rounded-lg border border-gray-300 font-mono text-xs overflow-x-auto">
                <pre className="text-gray-700 whitespace-pre">
{`┌────────────────────────────────────────────────────────────────────────────┐
│                         CASE MATCHING ALGORITHM                             │
└────────────────────────────────────────────────────────────────────────────┘

  PARSED CASE                  MATCHING ENGINE               USER'S ALIASES
  ───────────                  ──────────────                ──────────────

  ┌─────────────────┐                                    ┌─────────────────┐
  │ petitioner_     │                                    │ lawyer_aliases  │
  │ lawyer:         │                                    │                 │
  │ "Sh. R.K. Jain" │          ┌──────────────────┐     │ profile_id: abc │
  │                 │          │                  │     │ alias: "R K JAIN"│
  │ respondent_     │ ───────► │  NORMALIZATION   │ ◄─── │ alias: "RK JAIN"│
  │ lawyer:         │          │                  │     │ alias: "R.K.JAIN"│
  │ "Adv. S. Sharma"│          └────────┬─────────┘     │ is_primary: true│
  └─────────────────┘                   │               └─────────────────┘
                                        │
                                        ▼
                              ┌──────────────────┐
                              │ NORMALIZE TEXT   │
                              │                  │
                              │ • Remove titles  │
                              │   (Sh., Adv.,    │
                              │    Mr., Mrs.)    │
                              │ • Uppercase      │
                              │ • Remove dots    │
                              │ • Collapse spaces│
                              └────────┬─────────┘
                                       │
                                       ▼
                              ┌──────────────────┐
                              │ COMPARE:         │
                              │ "RKJAIN"         │
                              │    vs            │
                              │ ["RKJAIN",       │
                              │  "RJAIN", ...]   │
                              └────────┬─────────┘
                                       │
                         ┌─────────────┴─────────────┐
                         │ EXACT                      │ FUZZY
                         ▼                            ▼
                    ┌──────────┐               ┌──────────────┐
                    │ MATCH!   │               │ Levenshtein  │
                    │ confidence│               │ distance ≤ 2 │
                    │ = 1.0    │               │              │
                    └────┬─────┘               └───────┬──────┘
                         │                             │
                         │                    ┌────────┴────────┐
                         │                    │ YES              │ NO
                         │                    ▼                  ▼
                         │             ┌──────────┐        ┌──────────┐
                         │             │ MATCH!   │        │ NO MATCH │
                         │             │ confidence│        │ needs_   │
                         │             │ = 0.8-0.95│        │ review   │
                         │             └────┬─────┘        └──────────┘
                         │                  │
                         └──────────────────┴─────────────────┐
                                                              │
                                                              ▼
                                              ┌────────────────────────────┐
                                              │ UPDATE daily_court_docket  │
                                              │                            │
                                              │ matched_profile_id = abc   │
                                              │ matched_role = "petitioner"│
                                              │ match_confidence = 0.95    │
                                              │ match_method = "alias"     │
                                              └────────────────────────────┘`}
                </pre>
              </div>
            </div>
          </section>

          <Separator className="my-8" />

          {/* Section 11: Live Board Monitoring */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-black mb-4 flex items-center gap-2">
              <Globe className="h-6 w-6" />
              11. Live Board Monitoring
            </h2>

            <div className="space-y-4">
              <div className="bg-gray-100 p-4 rounded-lg border border-gray-300 font-mono text-xs overflow-x-auto">
                <pre className="text-gray-700 whitespace-pre">
{`┌────────────────────────────────────────────────────────────────────────────┐
│                       LIVE BOARD MONITORING                                 │
└────────────────────────────────────────────────────────────────────────────┘

  COURT DISPLAY BOARD              SCRAPING LAYER             CLIENT APP
  ─────────────────                ──────────────             ──────────

  ┌─────────────────┐
  │ Physical Board  │   Every 30s during court hours
  │ in Courtroom    │ ─────────────────────────────────┐
  │                 │                                  │
  │ Shows:          │                                  ▼
  │ • Court No      │               ┌─────────────────────────────────┐
  │ • Item No       │               │ scrape-live-board               │
  │ • Status        │               │                                  │
  └─────────────────┘               │ • Browserless or Firecrawl      │
                                    │ • Parse HTML for item numbers    │
                                    │ • Detect status (hearing/lunch)  │
                                    └───────────────┬──────────────────┘
                                                    │
                                                    ▼
                                    ┌─────────────────────────────────┐
                                    │ sync-live-board                  │
                                    │                                  │
                                    │ • UPSERT to live_board_cache    │
                                    │ • Set last_updated = now()       │
                                    │ • Set source_timestamp           │
                                    └───────────────┬──────────────────┘
                                                    │
                                         ┌──────────┴──────────┐
                                         │                     │
                                         ▼                     ▼
                            ┌──────────────────┐    ┌──────────────────────┐
                            │ live_board_cache │    │ SUPABASE REALTIME    │
                            │                  │    │                      │
                            │ court_no: "1"    │    │ postgres_changes     │
                            │ current_item: 45 │ ──►│ broadcast to         │
                            │ status: hearing  │    │ subscribed clients   │
                            │ last_updated     │    │                      │
                            └──────────────────┘    └───────────┬──────────┘
                                                                │
                                                    ┌───────────┴───────────┐
                                                    ▼                       ▼
                                        ┌──────────────────┐   ┌──────────────────┐
                                        │ CLIENT A         │   │ CLIENT B         │
                                        │ (War Room)       │   │ (Dashboard)      │
                                        │                  │   │                  │
                                        │ • Update ticker  │   │ • Update widget  │
                                        │ • Check proximity│   │ • Show current   │
                                        │ • Fire alerts    │   │   court status   │
                                        └──────────────────┘   └──────────────────┘

  ┌─────────────────────────────────────────────────────────────────────┐
  │                    STALENESS INDICATOR                              │
  ├─────────────────────────────────────────────────────────────────────┤
  │                                                                     │
  │  age = now() - last_updated                                         │
  │                                                                     │
  │  ≤30 seconds  ────► Normal text "Last updated: 10:45:30 IST"       │
  │  31-90 seconds ───► ⚠️ Warning icon + muted text                    │
  │  >90 seconds  ────► ⚠️ Amber text + tooltip explanation             │
  │                                                                     │
  └─────────────────────────────────────────────────────────────────────┘`}
                </pre>
              </div>
            </div>
          </section>

          <Separator className="my-8" />

          {/* Section 12: Notification System */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-black mb-4 flex items-center gap-2">
              <Bell className="h-6 w-6" />
              12. Notification & Escalation System
            </h2>

            <div className="space-y-4">
              <div className="bg-gray-100 p-4 rounded-lg border border-gray-300 font-mono text-xs overflow-x-auto">
                <pre className="text-gray-700 whitespace-pre">
{`┌────────────────────────────────────────────────────────────────────────────┐
│                    NOTIFICATION & ESCALATION SYSTEM                         │
└────────────────────────────────────────────────────────────────────────────┘

  LIVE BOARD UPDATE               NOTIFICATION ENGINE           USER INTERFACE
  ─────────────────               ───────────────────           ──────────────

  ┌─────────────────┐
  │ current_item    │
  │ changed to 42   │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────────────────────────────────────────────┐
  │                 CALCULATE PROXIMITY                      │
  │                                                          │
  │  FOR EACH user with case in this court:                 │
  │                                                          │
  │    distance = user_item_no - current_item               │
  │                                                          │
  │    ┌─────────────────────────────────────────────────┐   │
  │    │ distance ≤ 0   ──► STATUS: RUNNING (Gold glow)  │   │
  │    │ distance 1-5   ──► STATUS: PANIC   (Red alert)  │   │
  │    │ distance 6-10  ──► STATUS: WARNING (Amber)      │   │
  │    │ distance > 10  ──► STATUS: UPCOMING (Normal)    │   │
  │    └─────────────────────────────────────────────────┘   │
  │                                                          │
  └───────────────────────────┬──────────────────────────────┘
                              │
                              ▼
                ┌────────────────────────────┐
                │ CREATE NOTIFICATION        │
                │                            │
                │ IF distance crossed        │
                │ threshold (5 or 10):       │
                │                            │
                │ INSERT INTO notifications  │
                │ • title                    │
                │ • message                  │
                │ • severity (warn/critical) │
                │ • threshold_crossed        │
                └─────────────┬──────────────┘
                              │
                   ┌──────────┴──────────┐
                   │                     │
                   ▼                     ▼
        ┌──────────────────┐   ┌──────────────────┐
        │ IN-APP ALERT     │   │ AUDIO ALERT      │
        │                  │   │                  │
        │ • Toast popup    │   │ • Warning beep   │
        │ • Bell badge     │   │ • Panic siren    │
        │ • Card highlight │   │                  │
        └──────────────────┘   └──────────────────┘
                   │
                   │ IF not acknowledged within 5 min
                   │ AND severity = critical
                   ▼
        ┌──────────────────────────────────────────┐
        │ ESCALATION CHECK                         │
        │                                          │
        │ • User has whatsapp_number?              │
        │ • whatsapp_escalation_enabled = true?    │
        │ • Not already escalated today?           │
        │                                          │
        │ IF ALL YES:                              │
        └───────────────────┬──────────────────────┘
                            │
                            ▼
        ┌──────────────────────────────────────────┐
        │ escalate-whatsapp                        │
        │                                          │
        │ • WhatsApp Business API                  │
        │ • Send: "URGENT: Your case approaching"  │
        │ • Log to notification_escalations        │
        └──────────────────────────────────────────┘`}
                </pre>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">Offline Threshold Memory</h3>
                <p className="text-sm text-gray-600 mb-2">
                  Client-side tracking ensures users don't miss critical thresholds while offline:
                </p>
                <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                  <li>IndexedDB stores last known item position per case</li>
                  <li>On reconnection, compares current vs. stored position</li>
                  <li>If critical threshold crossed, creates "After Reconnect" alert</li>
                  <li>Maximum one replay alert per case per day</li>
                </ul>
              </div>
            </div>
          </section>

          <Separator className="my-8" />

          {/* Section 13: Chamber Management */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-black mb-4 flex items-center gap-2">
              <Users className="h-6 w-6" />
              13. Chamber Management
            </h2>

            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Chambers provide team coordination without compromising data privacy. Membership enables features but does NOT grant access to others' data.
              </p>

              <div className="bg-gray-100 p-4 rounded-lg border border-gray-300 font-mono text-xs overflow-x-auto">
                <pre className="text-gray-700 whitespace-pre">
{`┌────────────────────────────────────────────────────────────────────────────┐
│                        CHAMBER MANAGEMENT                                   │
└────────────────────────────────────────────────────────────────────────────┘

  CREATION (Senior only)              JOINING (Junior/Clerk)
  ─────────────────────               ─────────────────────

  ┌─────────────────┐                 ┌─────────────────┐
  │ Senior creates  │                 │ Enter invite    │
  │ chamber during  │                 │ code (8 chars)  │
  │ onboarding      │                 └────────┬────────┘
  └────────┬────────┘                          │
           │                                   ▼
           ▼                          ┌─────────────────────┐
  ┌─────────────────┐                 │ Validate code       │
  │ INSERT chambers │                 │ • Not expired (7d)  │
  │ • name          │                 │ • Not already used  │
  │ • owner_id      │                 │ • User not in       │
  └────────┬────────┘                 │   another chamber   │
           │                          └──────────┬──────────┘
           ▼                                     │
  ┌─────────────────┐                   ┌────────┴────────┐
  │ INSERT chamber_ │                   │ VALID           │ INVALID
  │ memberships     │                   ▼                 ▼
  │ • chamber_id    │         ┌─────────────────┐  ┌─────────────────┐
  │ • lawyer_id     │         │ INSERT chamber_ │  │ Error message   │
  │ • role = senior │         │ memberships     │  │ with reason     │
  └────────┬────────┘         │ • role from     │  └─────────────────┘
           │                  │   invite        │
           │                  │ • invited_by    │
           ▼                  └─────────────────┘
  ┌─────────────────┐
  │ Generate invite │
  │ code for others │
  └─────────────────┘

  ┌─────────────────────────────────────────────────────────────────────┐
  │                      CHAMBER DATA ACCESS RULES                      │
  ├─────────────────────────────────────────────────────────────────────┤
  │                                                                     │
  │  Chamber membership DOES NOT grant:                                 │
  │  ✗ Access to other lawyers' cases                                   │
  │  ✗ Access to other lawyers' documents                               │
  │  ✗ Access to other lawyers' arguments                               │
  │  ✗ Access to other lawyers' private notes                           │
  │                                                                     │
  │  Chamber membership DOES enable:                                    │
  │  ✓ Sending whispers to chamber members                              │
  │  ✓ Opt-in sharing of judge observations                             │
  │  ✓ Seeing chamber member names                                      │
  │  ✓ Future: delegation and task assignment                           │
  │                                                                     │
  └─────────────────────────────────────────────────────────────────────┘`}
                </pre>
              </div>
            </div>
          </section>

          <Separator className="my-8" />

          {/* Section 14: Offline Architecture */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-black mb-4 flex items-center gap-2">
              <AlertTriangle className="h-6 w-6" />
              14. Offline-First Architecture
            </h2>

            <div className="space-y-4">
              <div className="bg-gray-100 p-4 rounded-lg border border-gray-300 font-mono text-xs overflow-x-auto">
                <pre className="text-gray-700 whitespace-pre">
{`┌────────────────────────────────────────────────────────────────────────────┐
│                      OFFLINE-FIRST ARCHITECTURE                             │
└────────────────────────────────────────────────────────────────────────────┘

  ONLINE MODE                    TRANSITION                   OFFLINE MODE
  ───────────                    ──────────                   ────────────

  ┌─────────────────┐
  │ User triggers   │     Network loss detected
  │ "Courtroom      │ ──────────────────────────►┌─────────────────┐
  │  Snapshot"      │                            │ useCourtroomSnap│
  └────────┬────────┘                            │ shot hook       │
           │                                     └────────┬────────┘
           ▼                                              │
  ┌─────────────────┐                                     │
  │ Fetch current   │                                     ▼
  │ data:           │                            ┌─────────────────────┐
  │ • Today's cases │                            │ IndexedDB (idb)     │
  │ • Live board    │ ──────────────────────────►│                     │
  │ • Documents     │         CACHE              │ nyayhub_snapshot    │
  │ • Arguments     │                            │ • docket entries    │
  └─────────────────┘                            │ • live_board state  │
                                                 │ • document refs     │
                                                 │ • cached_at time    │
                                                 └──────────┬──────────┘
                                                            │
                                                            ▼
                                                 ┌─────────────────────┐
                                                 │ OFFLINE UI          │
                                                 │                     │
                                                 │ • Show cached data  │
                                                 │ • Display "Offline" │
                                                 │   banner            │
                                                 │ • Show cache age    │
                                                 │ • Block write ops   │
                                                 └─────────────────────┘

  ┌─────────────────────────────────────────────────────────────────────┐
  │                    OFFLINE THRESHOLD MEMORY                         │
  ├─────────────────────────────────────────────────────────────────────┤
  │                                                                     │
  │  Before going offline, record:                                      │
  │  • case_fingerprint                                                 │
  │  • last_known_item_no                                               │
  │  • last_known_current_item                                          │
  │                                                                     │
  │  On reconnection:                                                   │
  │  • Fetch current board state                                        │
  │  • Compare: did case cross critical threshold (≤5) while offline?  │
  │  • If YES: create "After Reconnect" notification                    │
  │  • One replay per case per day maximum                              │
  │                                                                     │
  └─────────────────────────────────────────────────────────────────────┘`}
                </pre>
              </div>
            </div>
          </section>

          <Separator className="my-8" />

          {/* Section 15: PWA Update Strategy */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-black mb-4 flex items-center gap-2">
              <Clock className="h-6 w-6" />
              15. PWA Update Strategy
            </h2>

            <div className="space-y-4">
              <div className="bg-gray-100 p-4 rounded-lg border border-gray-300 font-mono text-xs overflow-x-auto">
                <pre className="text-gray-700 whitespace-pre">
{`┌────────────────────────────────────────────────────────────────────────────┐
│                        PWA UPDATE STRATEGY                                  │
└────────────────────────────────────────────────────────────────────────────┘

  SERVICE WORKER               SAFETY CHECKS                  UPDATE ACTION
  ──────────────               ─────────────                  ─────────────

  ┌─────────────────┐
  │ New version     │
  │ detected        │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────────────────────────────────────────────┐
  │                 SAFETY EVALUATION                        │
  │                                                          │
  │  usePWAUpdateSafety hook checks:                         │
  │                                                          │
  │  1. hasPendingSync?                                      │
  │     └─ Are there unsynced local changes?                 │
  │                                                          │
  │  2. !isOnline?                                           │
  │     └─ Is the device offline?                            │
  │                                                          │
  │  3. hasActiveFormEdits?                                  │
  │     └─ Is user actively editing a form?                  │
  │                                                          │
  │  4. isCriticalOperation?                                 │
  │     └─ Is a critical operation in progress?              │
  │                                                          │
  │  isSafeToReload = NONE of the above are true             │
  │                                                          │
  └───────────────────────────┬──────────────────────────────┘
                              │
                   ┌──────────┴──────────┐
                   │ isSafeToReload?     │
                   └──────────┬──────────┘
                              │
               ┌──────────────┴──────────────┐
               │ YES                         │ NO
               ▼                             ▼
  ┌─────────────────────────┐   ┌─────────────────────────┐
  │ Is app visible?         │   │ Defer update            │
  └─────────────┬───────────┘   │                         │
                │               │ Show non-blocking toast:│
       ┌────────┴────────┐      │ "Update ready when     │
       │ YES             │ NO   │  safe"                  │
       ▼                 ▼      │                         │
  ┌──────────┐    ┌──────────┐  │ Re-check in 60 seconds  │
  │ Defer    │    │ SILENT   │  └─────────────────────────┘
  │ update   │    │ RELOAD   │
  │          │    │          │
  │ Wait for │    │ No UI    │
  │ hidden   │    │ disruption│
  └──────────┘    └──────────┘

  ┌─────────────────────────────────────────────────────────────────────┐
  │                    UPDATE FLOW SUMMARY                              │
  ├─────────────────────────────────────────────────────────────────────┤
  │                                                                     │
  │  1. New SW version detected                                         │
  │  2. Check safety conditions                                         │
  │  3. If safe AND app hidden → Silent reload                          │
  │  4. If safe AND app visible → Defer until hidden                    │
  │  5. If unsafe → Toast notification, retry later                     │
  │  6. Never interrupt active work or offline state                    │
  │                                                                     │
  └─────────────────────────────────────────────────────────────────────┘`}
                </pre>
              </div>
            </div>
          </section>

          <Separator className="my-8" />

          {/* Section 16: Court Focus Mode */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-black mb-4 flex items-center gap-2">
              <Zap className="h-6 w-6" />
              16. Court Focus Mode
            </h2>

            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Full-screen overlay that activates during critical court moments, eliminating distractions when a case is imminent.
              </p>

              <div className="bg-gray-100 p-4 rounded-lg border border-gray-300 font-mono text-xs overflow-x-auto">
                <pre className="text-gray-700 whitespace-pre">
{`┌────────────────────────────────────────────────────────────────────────────┐
│                          COURT FOCUS MODE                                   │
└────────────────────────────────────────────────────────────────────────────┘

  TRIGGER CONDITIONS                    OVERLAY FEATURES
  ──────────────────                    ────────────────

  ┌─────────────────────────┐           ┌─────────────────────────────────────┐
  │ useCourtFocusMode hook  │           │ CourtFocusOverlay Component         │
  │                         │           │                                     │
  │ Activates when ALL:     │           │ • Full-screen dark overlay          │
  │ • Case ≤3 items away    │ ────────► │ • Large countdown display           │
  │ • Court is in session   │           │ • Current item vs. your item        │
  │ • User hasn't dismissed │           │ • Panic alert button                │
  │ • Live board is fresh   │           │ • Case details summary              │
  └─────────────────────────┘           │ • Dismiss button (top-right)        │
                                        └─────────────────────────────────────┘

  LIFECYCLE
  ─────────

  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
  │ IDLE             │    │ FOCUS ACTIVE     │    │ DISMISSED        │
  │                  │    │                  │    │                  │
  │ Normal app view  │───►│ Overlay visible  │───►│ Returns to       │
  │                  │    │ All distractions │    │ normal view      │
  │                  │    │ blocked          │    │                  │
  └──────────────────┘    └──────────────────┘    └──────────────────┘
         │                        │                        │
         │   threshold crossed    │   user dismisses OR    │
         └────────────────────────┘   case called          │
                                                           │
                                      ┌────────────────────┘
                                      ▼
                             ┌──────────────────┐
                             │ Cooldown period  │
                             │ before re-trigger│
                             └──────────────────┘`}
                </pre>
              </div>

              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div className="border border-gray-300 rounded-lg p-4">
                  <h4 className="font-medium text-black mb-2">Trigger Logic</h4>
                  <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                    <li>Monitors live board current item position</li>
                    <li>Calculates distance to user's case item number</li>
                    <li>Activates when distance ≤ 3 items</li>
                    <li>Respects court hours and session status</li>
                  </ul>
                </div>
                <div className="border border-gray-300 rounded-lg p-4">
                  <h4 className="font-medium text-black mb-2">UX Considerations</h4>
                  <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                    <li>Cannot be accidentally dismissed</li>
                    <li>Prominent dismiss button for intentional exit</li>
                    <li>Sound/vibration alerts optional</li>
                    <li>Works even when app is in background (via notifications)</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <Separator className="my-8" />

          {/* Section 17: Indian Kanoon Integration */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-black mb-4 flex items-center gap-2">
              <FileText className="h-6 w-6" />
              17. Indian Kanoon Integration
            </h2>

            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Integrates with Indian Kanoon legal database for judgment search, reference, and attachment to case arguments.
              </p>

              <div className="bg-gray-100 p-4 rounded-lg border border-gray-300 font-mono text-xs overflow-x-auto">
                <pre className="text-gray-700 whitespace-pre">
{`┌────────────────────────────────────────────────────────────────────────────┐
│                     INDIAN KANOON INTEGRATION                               │
└────────────────────────────────────────────────────────────────────────────┘

  USER FLOW                                BACKEND PROCESSING
  ─────────                                ──────────────────

  ┌─────────────────────┐
  │ War Room            │
  │ Judgment References │
  │ Panel               │
  └──────────┬──────────┘
             │
             ▼
  ┌─────────────────────┐         ┌──────────────────────────────────┐
  │ User enters search  │         │ search-indian-kanoon             │
  │ query:              │ ───────►│ Edge Function                    │
  │ "specific relief"   │         │                                  │
  └─────────────────────┘         │ • Calls Indian Kanoon API        │
                                  │ • Parses results                 │
                                  │ • Extracts: title, date, court   │
                                  │ • Returns ranked list            │
                                  └────────────────┬─────────────────┘
                                                   │
                                                   ▼
  ┌─────────────────────┐         ┌──────────────────────────────────┐
  │ Results displayed   │◄────────│ Ranking Algorithm                │
  │ with relevance      │         │                                  │
  │ scores              │         │ • Judge name match bonus         │
  │                     │         │ • Case type similarity           │
  │ User clicks         │         │ • Recency factor                 │
  │ "Attach to Case"    │         │ • Court hierarchy weight         │
  └──────────┬──────────┘         └──────────────────────────────────┘
             │
             ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │ INSERT INTO judgment_attachments                                │
  │                                                                 │
  │ • judgment_url       (Indian Kanoon link)                       │
  │ • judgment_title     (Case name)                                │
  │ • judgment_date      (Decision date)                            │
  │ • judgment_court     (Supreme Court, High Court, etc.)          │
  │ • docket_id          (Link to user's case)                      │
  │ • argument_id        (Optional: specific argument)              │
  │ • ranking_score      (Computed relevance)                       │
  │ • attached_by        (User ID)                                  │
  └─────────────────────────────────────────────────────────────────┘`}
                </pre>
              </div>
            </div>
          </section>

          <Separator className="my-8" />

          {/* Section 18: Sync Conflict Resolution */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-black mb-4 flex items-center gap-2">
              <AlertTriangle className="h-6 w-6" />
              18. Sync Conflict Resolution
            </h2>

            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Handles data conflicts when offline edits sync with server changes, ensuring no data loss and user control.
              </p>

              <div className="bg-gray-100 p-4 rounded-lg border border-gray-300 font-mono text-xs overflow-x-auto">
                <pre className="text-gray-700 whitespace-pre">
{`┌────────────────────────────────────────────────────────────────────────────┐
│                       SYNC CONFLICT RESOLUTION                              │
└────────────────────────────────────────────────────────────────────────────┘

  CONFLICT DETECTION                       RESOLUTION FLOW
  ──────────────────                       ───────────────

  ┌─────────────────────────────────────────────────────────────────────────┐
  │ SyncConflictContext Provider                                            │
  │                                                                         │
  │ Tracks:                                                                 │
  │ • pendingLocalChanges[]   - Edits made while offline                    │
  │ • serverVersions[]        - Latest server state                         │
  │ • conflictQueue[]         - Detected conflicts awaiting resolution      │
  └──────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │ ON RECONNECTION                                                         │
  │                                                                         │
  │ For each pendingLocalChange:                                            │
  │                                                                         │
  │   1. Fetch server version with same ID                                  │
  │   2. Compare updated_at timestamps                                      │
  │                                                                         │
  │   ┌─────────────────────┐       ┌─────────────────────┐                 │
  │   │ Server unchanged    │       │ Server changed      │                 │
  │   │ (local > server)    │       │ (server > local)    │                 │
  │   └──────────┬──────────┘       └──────────┬──────────┘                 │
  │              │                             │                            │
  │              ▼                             ▼                            │
  │   ┌─────────────────────┐       ┌─────────────────────┐                 │
  │   │ Auto-sync           │       │ Add to              │                 │
  │   │ local → server      │       │ conflictQueue       │                 │
  │   └─────────────────────┘       └──────────┬──────────┘                 │
  │                                            │                            │
  └────────────────────────────────────────────┼────────────────────────────┘
                                               │
                                               ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │ ConflictResolutionDialog                                                │
  │                                                                         │
  │ Shows:                                                                  │
  │ • Side-by-side comparison of local vs server versions                   │
  │ • Field-level differences highlighted                                   │
  │ • Timestamps for both versions                                          │
  │                                                                         │
  │ Options:                                                                │
  │ ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐          │
  │ │ Keep Local      │  │ Keep Server     │  │ Keep Both       │          │
  │ │ (Overwrite      │  │ (Discard local  │  │ (Merge/Create   │          │
  │ │  server)        │  │  changes)       │  │  copy)          │          │
  │ └─────────────────┘  └─────────────────┘  └─────────────────┘          │
  └─────────────────────────────────────────────────────────────────────────┘

  SAFETY INTEGRATION
  ──────────────────

  • usePWAUpdateSafety checks hasSyncConflict before allowing reload
  • FormDirtyContext blocks navigation during active conflict
  • Conflict resolution MUST complete before critical operations`}
                </pre>
              </div>
            </div>
          </section>

          <Separator className="my-8" />

          {/* Section 19: Network Status Monitoring */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-black mb-4 flex items-center gap-2">
              <Globe className="h-6 w-6" />
              19. Network Status Monitoring
            </h2>

            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Comprehensive network monitoring with visual indicators and graceful degradation for offline-first experience.
              </p>

              <div className="bg-gray-100 p-4 rounded-lg border border-gray-300 font-mono text-xs overflow-x-auto">
                <pre className="text-gray-700 whitespace-pre">
{`┌────────────────────────────────────────────────────────────────────────────┐
│                      NETWORK STATUS MONITORING                              │
└────────────────────────────────────────────────────────────────────────────┘

  DETECTION LAYER                          UI INDICATORS
  ───────────────                          ─────────────

  ┌─────────────────────────┐
  │ useNetworkStatus hook   │
  │                         │
  │ Sources:                │
  │ • navigator.onLine      │
  │ • online/offline events │
  │ • Periodic health check │
  │   to Supabase           │
  └──────────┬──────────────┘
             │
             ├────────────────────────────────────────────────────────┐
             │                                                        │
             ▼                                                        ▼
  ┌─────────────────────────┐                          ┌─────────────────────────┐
  │ GlobalOfflineBanner     │                          │ NetworkStatusPill       │
  │                         │                          │                         │
  │ Full-width amber banner │                          │ Small indicator on      │
  │ at top of app when      │                          │ critical components     │
  │ offline                 │                          │                         │
  │                         │                          │ • Green: Connected      │
  │ "You're offline.        │                          │ • Yellow: Degraded      │
  │  Some features may be   │                          │ • Red: Offline          │
  │  limited."              │                          │                         │
  └─────────────────────────┘                          └─────────────────────────┘

  GRACEFUL DEGRADATION
  ────────────────────

  ┌─────────────────────────────────────────────────────────────────────────┐
  │ ONLINE                    │ OFFLINE                                     │
  ├───────────────────────────┼─────────────────────────────────────────────┤
  │ Real-time live board      │ Cached live board with staleness warning    │
  │ Full docket fetch         │ IndexedDB cached docket                     │
  │ AI features available     │ AI features disabled with message           │
  │ Document upload enabled   │ Upload queued for sync                      │
  │ Whisper send immediate    │ Whisper queued with pending indicator       │
  │ PWA updates may apply     │ Updates blocked until online                │
  └───────────────────────────┴─────────────────────────────────────────────┘

  RECONNECTION FLOW
  ─────────────────

  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
  │ Network restored │───►│ Sync pending     │───►│ Threshold replay │
  │                  │    │ changes          │    │ check            │
  │ Hide offline     │    │                  │    │                  │
  │ banner           │    │ Process queue    │    │ Generate missed  │
  │                  │    │                  │    │ alerts           │
  └──────────────────┘    └──────────────────┘    └──────────────────┘`}
                </pre>
              </div>

              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div className="border border-gray-300 rounded-lg p-4">
                  <h4 className="font-medium text-black mb-2">Components</h4>
                  <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                    <li><code className="bg-gray-200 px-1">GlobalOfflineBanner</code> - App-wide offline indicator</li>
                    <li><code className="bg-gray-200 px-1">NetworkStatusPill</code> - Compact status badge</li>
                    <li><code className="bg-gray-200 px-1">useNetworkStatus</code> - Core detection hook</li>
                    <li><code className="bg-gray-200 px-1">usePendingSync</code> - Queue management</li>
                  </ul>
                </div>
                <div className="border border-gray-300 rounded-lg p-4">
                  <h4 className="font-medium text-black mb-2">Integration Points</h4>
                  <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                    <li>PWA update safety checks</li>
                    <li>Form submission guards</li>
                    <li>Real-time subscription management</li>
                    <li>Cache invalidation triggers</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <Separator className="my-8" />

          {/* Footer */}
          <footer className="text-center text-sm text-gray-500 py-8 border-t border-gray-300">
            <p className="font-semibold">Nyay-Hub Technical Dossier</p>
            <p>Built by Izafa Labs</p>
            <p className="mt-2">Document Version: 2.0</p>
            <p>Generated: {new Date().toISOString()}</p>
          </footer>

        </div>
      </ScrollArea>
    </div>
  );
};

export default TechnicalDossier;
