import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, Scale, Users, FileText, Bell, Shield, 
  Keyboard, Eye, Monitor, Zap, Download, Github, Code, ExternalLink,
  Database, Server, Wifi, Lock, AlertTriangle, MessageSquare, 
  Upload, Layers, Globe, Palette, Settings
} from 'lucide-react';

export default function Documentation() {
  const navigate = useNavigate();

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header - hidden in print */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40 print:hidden">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/auth')} aria-label="Go back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <Scale className="h-6 w-6 text-primary" aria-hidden="true" />
              <h1 className="font-display text-xl font-bold text-foreground">
                Vakalat-OS Documentation
              </h1>
            </div>
            <Button variant="gold" size="sm" onClick={handlePrint}>
              <Download className="h-4 w-4 mr-2" aria-hidden="true" />
              Save as PDF
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <ScrollArea className="h-full">
          {/* Title Section */}
          <div className="text-center mb-12">
            <Scale className="h-16 w-16 text-primary mx-auto mb-4" aria-hidden="true" />
            <h1 className="font-display text-4xl font-bold text-foreground mb-2">
              Vakalat-OS
            </h1>
            <p className="text-xl text-muted-foreground">
              Rajasthan High Court Case Management System
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Complete User Guide & Technical Documentation
            </p>
          </div>

          {/* Table of Contents */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
                Table of Contents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 md:grid-cols-2 text-sm">
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">User Guide</p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                    <li>Overview</li>
                    <li>System Flowcharts</li>
                    <li>User Roles & Workflows</li>
                    <li>Key Features</li>
                    <li>Accessibility Features</li>
                    <li>Security Features</li>
                    <li>Common Workflows</li>
                  </ul>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">Technical Documentation</p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                    <li>System Architecture</li>
                    <li>Database Schema</li>
                    <li>Authentication System</li>
                    <li>Real-time Synchronization</li>
                    <li>Panic Alert Logic</li>
                    <li>Whisper System</li>
                    <li>Document & Annotation System</li>
                    <li>Offline Support</li>
                    <li>Edge Functions</li>
                    <li>Design System</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* System Flowcharts */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-primary" aria-hidden="true" />
                System Flowcharts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Overall System Flow */}
              <div>
                <h3 className="font-semibold text-foreground mb-3">1. Overall System Architecture</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  High-level view of how all components interact in the Vakalat-OS ecosystem.
                </p>
                <div className="p-4 rounded bg-muted/30 border border-border font-mono text-xs overflow-x-auto">
                  <pre className="text-muted-foreground whitespace-pre">
{`┌─────────────────────────────────────────────────────────────────────────────┐
│                              VAKALAT-OS SYSTEM                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ │
│   │   SENIOR    │    │   JUNIOR    │    │   CLERK     │    │   ADMIN     │ │
│   │  ADVOCATE   │    │  ADVOCATE   │    │             │    │             │ │
│   └──────┬──────┘    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘ │
│          │                  │                  │                  │        │
│          ▼                  ▼                  ▼                  ▼        │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ │
│   │  WAR ROOM   │    │CONTROL DECK │    │  DASHBOARD  │    │ADMIN PANEL  │ │
│   │             │◄──►│             │    │             │    │             │ │
│   │ • View Docs │    │ • Upload    │    │ • View List │    │ • Manage    │ │
│   │ • Arguments │    │ • Whisper   │    │ • Status    │    │ • Configure │ │
│   │ • Receive   │    │ • Monitor   │    │             │    │ • Control   │ │
│   └──────┬──────┘    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘ │
│          │                  │                  │                  │        │
│          └──────────────────┴──────────────────┴──────────────────┘        │
│                                      │                                      │
│                           ┌──────────▼──────────┐                          │
│                           │   SUPABASE CLOUD    │                          │
│                           ├─────────────────────┤                          │
│                           │ • PostgreSQL + RLS  │                          │
│                           │ • Auth (JWT)        │                          │
│                           │ • Storage (Files)   │                          │
│                           │ • Realtime (WS)     │                          │
│                           │ • Edge Functions    │                          │
│                           └─────────────────────┘                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘`}
                  </pre>
                </div>
              </div>

              <Separator />

              {/* User Authentication Flow */}
              <div>
                <h3 className="font-semibold text-foreground mb-3">2. User Authentication Flow</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Complete authentication journey from login to role-based routing.
                </p>
                <div className="p-4 rounded bg-muted/30 border border-border font-mono text-xs overflow-x-auto">
                  <pre className="text-muted-foreground whitespace-pre">
{`┌──────────────────────────────────────────────────────────────────────────┐
│                        AUTHENTICATION FLOW                                │
└──────────────────────────────────────────────────────────────────────────┘

    ┌─────────┐
    │  USER   │
    └────┬────┘
         │
         ▼
    ┌─────────────┐     NO      ┌─────────────┐
    │ Has Account?├────────────►│ /auth       │
    └──────┬──────┘             │ (Sign Up)   │
           │ YES                └──────┬──────┘
           ▼                           │
    ┌─────────────┐                    │
    │ /auth       │                    │
    │ (Sign In)   │                    │
    └──────┬──────┘                    │
           │                           │
           ▼                           ▼
    ┌─────────────────────────────────────────┐
    │          SUPABASE AUTH                  │
    │  • Email/Password verification          │
    │  • JWT token generation                 │
    │  • Session storage                      │
    └───────────────────┬─────────────────────┘
                        │
                        ▼
    ┌─────────────────────────────────────────┐
    │      handle_new_user() TRIGGER          │
    │  • Creates profile record               │
    │  • Assigns role in user_roles table     │
    └───────────────────┬─────────────────────┘
                        │
                        ▼
    ┌─────────────────────────────────────────┐
    │          ONBOARDING CHECK               │
    │  Is onboarding_completed = true?        │
    └───────────────────┬─────────────────────┘
                        │
           ┌────────────┴────────────┐
           │ NO                      │ YES
           ▼                         ▼
    ┌─────────────┐           ┌─────────────┐
    │ /onboarding │           │  DASHBOARD  │
    │             │           │             │
    └──────┬──────┘           └──────┬──────┘
           │                         │
           ▼                         ▼
    ┌─────────────┐           ┌─────────────────────┐
    │ Complete    │           │ ROLE-BASED ROUTING  │
    │ Profile     │           ├─────────────────────┤
    └──────┬──────┘           │ SENIOR → War Room   │
           │                  │ JUNIOR → Ctrl Deck  │
           ▼                  │ ADMIN  → Admin Panel│
    ┌─────────────┐           └─────────────────────┘
    │  DASHBOARD  │
    └─────────────┘`}
                  </pre>
                </div>
              </div>

              <Separator />

              {/* Case Hearing Workflow */}
              <div>
                <h3 className="font-semibold text-foreground mb-3">3. Case Hearing Day Workflow</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Typical workflow from morning preparation to case hearing.
                </p>
                <div className="p-4 rounded bg-muted/30 border border-border font-mono text-xs overflow-x-auto">
                  <pre className="text-muted-foreground whitespace-pre">
{`┌──────────────────────────────────────────────────────────────────────────┐
│                     CASE HEARING DAY WORKFLOW                             │
└──────────────────────────────────────────────────────────────────────────┘

    MORNING                     PREPARATION                   HEARING
    ───────                     ───────────                   ───────

    ┌─────────┐
    │ Log In  │
    └────┬────┘
         │
         ▼
    ┌─────────────┐
    │  DASHBOARD  │◄─────────────────────────────────────┐
    │             │                                      │
    │ View Today's│      ┌─────────────────────────────┐ │
    │ Cases       │      │      LIVE TICKER            │ │
    └──────┬──────┘      │  Real-time court status     │ │
           │             │  • Current item number       │ │
           │             │  • Court status (hearing)    │ │
           │             └─────────────────────────────┘ │
           ▼                                             │
    ┌─────────────┐                                      │
    │ Select Case │                                      │
    └──────┬──────┘                                      │
           │                                             │
     ┌─────┴─────┐                                       │
     │           │                                       │
     ▼           ▼                                       │
┌─────────┐ ┌─────────────┐                              │
│WAR ROOM │ │CONTROL DECK │                              │
│(Senior) │ │  (Junior)   │                              │
└────┬────┘ └──────┬──────┘                              │
     │             │                                     │
     │             ▼                                     │
     │      ┌─────────────┐                              │
     │      │Upload Docs  │                              │
     │      │& Evidence   │                              │
     │      └──────┬──────┘                              │
     │             │                                     │
     ▼             ▼                                     │
┌─────────────────────────┐                              │
│   CASE PREPARATION      │                              │
│   • Review arguments    │                              │
│   • Navigate PDF pages  │                              │
│   • Add annotations     │                              │
└───────────┬─────────────┘                              │
            │                                            │
            ▼                                            │
┌─────────────────────────┐     ┌─────────────────────┐  │
│   PANIC ALERT SYSTEM    │     │  WHISPER MESSAGES   │  │
│                         │     │                     │  │
│ Case within 5 items:    │     │ Junior → Senior     │  │
│ • Red pulsing alert     │     │ Real-time updates   │  │
│ • Audio notification    │     │ Voice memos support │  │
│ • "PANIC" badge         │     │                     │  │
└───────────┬─────────────┘     └─────────────────────┘  │
            │                                            │
            ▼                                            │
┌─────────────────────────┐                              │
│    CASE RUNNING         │                              │
│    • Gold glow effect   │                              │
│    • "NOW" badge        │                              │
│    • Full focus mode    │                              │
└───────────┬─────────────┘                              │
            │                                            │
            ▼                                            │
┌─────────────────────────┐                              │
│    CASE COMPLETE        │──────────────────────────────┘
│    • Mark as done       │
│    • Return to list     │
└─────────────────────────┘`}
                  </pre>
                </div>
              </div>

              <Separator />

              {/* Real-time Data Flow */}
              <div>
                <h3 className="font-semibold text-foreground mb-3">4. Real-time Data Synchronization</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  How data flows between clients and the database in real-time.
                </p>
                <div className="p-4 rounded bg-muted/30 border border-border font-mono text-xs overflow-x-auto">
                  <pre className="text-muted-foreground whitespace-pre">
{`┌──────────────────────────────────────────────────────────────────────────┐
│                     REAL-TIME SYNCHRONIZATION                             │
└──────────────────────────────────────────────────────────────────────────┘

    CLIENT A (War Room)              SERVER                CLIENT B (Control Deck)
    ───────────────────              ──────                ────────────────────────

         │                              │                           │
         │                              │                           │
         │    WebSocket Connection      │    WebSocket Connection   │
         │◄────────────────────────────►│◄─────────────────────────►│
         │                              │                           │
         │                              │                           │
    ┌────┴────┐                    ┌────┴────┐                 ┌────┴────┐
    │ LISTEN  │                    │POSTGRES │                 │  SEND   │
    │   TO:   │                    │ CHANGES │                 │ WHISPER │
    │         │                    │         │                 │         │
    │ • live_ │                    │ • INSERT│                 │         │
    │   board │                    │ • UPDATE│                 │         │
    │   _cache│                    │ • DELETE│                 │         │
    │         │                    │         │                 │         │
    │ • live_ │                    └────┬────┘                 └────┬────┘
    │   court │                         │                           │
    │   room_ │                         │                           │
    │   feed  │                         │                           │
    └────┬────┘                         │                           │
         │                              │                           │
         │                    ┌─────────┴─────────┐                 │
         │                    │                   │                 │
         │                    ▼                   ▼                 │
         │            ┌─────────────┐     ┌─────────────┐           │
         │            │live_board   │     │live_court   │◄──────────┘
         │            │_cache       │     │room_feed    │  INSERT
         │            └──────┬──────┘     └──────┬──────┘
         │                   │                   │
         │    REALTIME       │                   │    REALTIME
         │    BROADCAST      ▼                   ▼    BROADCAST
         │◄──────────────────────────────────────────────────────────
         │
    ┌────┴────────────────────────────┐
    │      TanStack Query Cache       │
    │  • Invalidate on change         │
    │  • Refetch fresh data           │
    │  • Update UI instantly          │
    └─────────────────────────────────┘
         │
         ▼
    ┌─────────────────────────────────┐
    │         UI UPDATE               │
    │  • Toast notification           │
    │  • Sound alert                  │
    │  • Visual state change          │
    └─────────────────────────────────┘`}
                  </pre>
                </div>
              </div>

              <Separator />

              {/* Database Entity Relationships */}
              <div>
                <h3 className="font-semibold text-foreground mb-3">5. Database Entity Relationships</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  How database tables relate to each other.
                </p>
                <div className="p-4 rounded bg-muted/30 border border-border font-mono text-xs overflow-x-auto">
                  <pre className="text-muted-foreground whitespace-pre">
{`┌──────────────────────────────────────────────────────────────────────────┐
│                     DATABASE ENTITY RELATIONSHIPS                         │
└──────────────────────────────────────────────────────────────────────────┘

    ┌─────────────────┐         ┌─────────────────┐
    │   auth.users    │         │   user_roles    │
    │   (Supabase)    │         │                 │
    ├─────────────────┤         ├─────────────────┤
    │ id (PK)         │◄────────│ user_id (FK)    │
    │ email           │    1:1  │ role (enum)     │
    │ created_at      │         │ id (PK)         │
    └────────┬────────┘         └─────────────────┘
             │
             │ 1:1
             ▼
    ┌─────────────────┐
    │    profiles     │
    ├─────────────────┤
    │ id (PK/FK)      │◄─────────────────────────────────────────┐
    │ full_name       │                                          │
    │ whatsapp_number │                                          │
    │ bench           │                                          │
    │ onboarding_done │                                          │
    └────────┬────────┘                                          │
             │                                                   │
             │ 1:N                                               │
             ▼                                                   │
    ┌─────────────────┐         ┌─────────────────┐              │
    │ lawyer_aliases  │         │daily_court_docket│              │
    ├─────────────────┤         ├─────────────────┤              │
    │ id (PK)         │         │ id (PK)         │              │
    │ profile_id (FK) │         │ matched_profile │──────────────┘
    │ alias_name      │         │ _id (FK)        │
    │ is_primary      │         │ date            │
    └─────────────────┘         │ case_number     │
                                │ court_room_no   │
                                │ item_no         │
                                │ status          │
                                └────────┬────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    │ 1:N                │ 1:N                │ 1:N
                    ▼                    ▼                    ▼
           ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
           │ case_documents  │  │ case_arguments  │  │live_courtroom   │
           ├─────────────────┤  ├─────────────────┤  │    _feed        │
           │ id (PK)         │  │ id (PK)         │  ├─────────────────┤
           │ docket_id (FK)  │  │ docket_id (FK)  │  │ id (PK)         │
           │ file_url        │  │ title           │  │ docket_id (FK)  │
           │ doc_type        │  │ linked_page_no  │  │ sender_id (FK)  │
           └────────┬────────┘  │ highlight_coords│  │ message         │
                    │           └─────────────────┘  │ is_read         │
                    │ 1:N                            └─────────────────┘
                    ▼
           ┌─────────────────┐
           │ document_       │
           │ annotations     │
           ├─────────────────┤
           │ id (PK)         │
           │ document_id(FK) │
           │ page_number     │
           │ annotation_json │
           │ user_id         │
           └─────────────────┘

    STANDALONE TABLES:

    ┌─────────────────┐         ┌─────────────────┐
    │ live_board_cache│         │ court_metadata  │
    ├─────────────────┤         ├─────────────────┤
    │ court_location  │ (CPK)   │ id (PK)         │
    │ court_no        │ (CPK)   │ bench           │
    │ current_item    │         │ court_no        │
    │ status          │         │ judge_names     │
    │ is_supplementary│         │ last_updated    │
    └─────────────────┘         └─────────────────┘

    ┌─────────────────┐         ┌─────────────────┐
    │  scraper_logs   │         │   sync_status   │
    ├─────────────────┤         ├─────────────────┤
    │ id (PK)         │         │ id (PK)         │
    │ bench           │         │ source_name     │
    │ status          │         │ last_sync_at    │
    │ cases_found     │         │ status          │
    │ error_message   │         │ sync_latency_ms │
    └─────────────────┘         └─────────────────┘`}
                  </pre>
                </div>
              </div>

              <Separator />

              {/* Panic Alert Decision Tree */}
              <div>
                <h3 className="font-semibold text-foreground mb-3">6. Panic Alert Decision Logic</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  How the system determines case status and alert levels.
                </p>
                <div className="p-4 rounded bg-muted/30 border border-border font-mono text-xs overflow-x-auto">
                  <pre className="text-muted-foreground whitespace-pre">
{`┌──────────────────────────────────────────────────────────────────────────┐
│                     PANIC ALERT DECISION TREE                             │
└──────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────┐
                    │   Calculate         │
                    │   distance =        │
                    │   my_item -         │
                    │   current_item      │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Is court status     │
                    │ "hearing"?          │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │ NO             │                │
              ▼                │                ▼
    ┌─────────────────┐        │      ┌─────────────────┐
    │ Status = lunch? │        │      │ Status=passover?│
    └────────┬────────┘        │      └────────┬────────┘
             │                 │               │
    ┌────────┴────────┐        │      ┌────────┴────────┐
    │YES           NO │        │      │YES           NO │
    ▼                 ▼        │      ▼                 ▼
┌────────┐      ┌────────┐     │  ┌────────┐      ┌────────┐
│ LUNCH  │      │ADJOURNED│     │  │PASSOVER│      │ ERROR  │
│ Badge  │      │ Badge   │     │  │ Badge  │      │ State  │
│(Yellow)│      │ (Gray)  │     │  │ (Gray) │      │        │
└────────┘      └────────┘     │  └────────┘      └────────┘
                               │
                               │ YES
                               ▼
                    ┌─────────────────────┐
                    │ distance <= 0 ?     │
                    └──────────┬──────────┘
                               │
              ┌────────────────┴────────────────┐
              │ YES                             │ NO
              ▼                                 ▼
    ┌─────────────────────┐          ┌─────────────────────┐
    │      RUNNING        │          │ distance <= 5 ?     │
    │                     │          └──────────┬──────────┘
    │ • Gold glow         │                     │
    │ • "NOW" badge       │        ┌────────────┴────────────┐
    │ • Priority display  │        │ YES                    │ NO
    └─────────────────────┘        ▼                        ▼
                          ┌─────────────────┐     ┌─────────────────┐
                          │     PANIC       │     │    WAITING      │
                          │                 │     │                 │
                          │ • Red pulse     │     │ • Neutral style │
                          │ • "PANIC" badge │     │ • "X away" text │
                          │ • Audio alert   │     │ • Normal display│
                          │ • Haptic (mob)  │     │                 │
                          └─────────────────┘     └─────────────────┘`}
                  </pre>
                </div>
              </div>

              <Separator />

              {/* Document Upload Flow */}
              <div>
                <h3 className="font-semibold text-foreground mb-3">7. Document Upload & Storage Flow</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  How documents are uploaded, stored, and accessed.
                </p>
                <div className="p-4 rounded bg-muted/30 border border-border font-mono text-xs overflow-x-auto">
                  <pre className="text-muted-foreground whitespace-pre">
{`┌──────────────────────────────────────────────────────────────────────────┐
│                     DOCUMENT UPLOAD FLOW                                  │
└──────────────────────────────────────────────────────────────────────────┘

    CONTROL DECK                    SUPABASE                     WAR ROOM
    ────────────                    ────────                     ────────

    ┌─────────────┐
    │ Drag & Drop │
    │ or Select   │
    │ File        │
    └──────┬──────┘
           │
           ▼
    ┌─────────────────┐
    │ Validate File   │
    │ • Type (PDF)    │
    │ • Size (<50MB)  │
    └──────┬──────────┘
           │
           ▼
    ┌─────────────────┐
    │ Generate Path   │
    │ {docket_id}/    │
    │ {timestamp}_    │
    │ {filename}      │
    └──────┬──────────┘
           │
           ▼
    ┌─────────────────┐              ┌─────────────────┐
    │ Upload to       │─────────────►│ STORAGE BUCKET  │
    │ Supabase        │              │ case-documents  │
    │ Storage         │              │ (Public bucket) │
    └──────┬──────────┘              └────────┬────────┘
           │                                  │
           ▼                                  │
    ┌─────────────────┐                       │
    │ Create DB       │                       │
    │ Record          │                       │
    │ case_documents  │                       │
    │ table INSERT    │                       │
    └──────┬──────────┘                       │
           │                                  │
           ▼                                  │
    ┌─────────────────┐              ┌────────┴────────┐
    │ Success Toast   │              │ Get Public URL  │
    │ "File Uploaded" │              │                 │
    └─────────────────┘              └────────┬────────┘
                                              │
                                              ▼
                                     ┌─────────────────┐
                                     │ REALTIME        │
                                     │ BROADCAST       │
                                     │ to subscribers  │
                                     └────────┬────────┘
                                              │
                                              ▼
                                     ┌─────────────────┐
                                     │ War Room UI     │
                                     │ Updates         │
                                     │                 │
                                     │ • PDF Viewer    │
                                     │   loads doc     │
                                     │ • Document list │
                                     │   refreshes     │
                                     └─────────────────┘`}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Overview */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5 text-primary" aria-hidden="true" />
                Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="prose prose-invert max-w-none">
              <p className="text-muted-foreground">
                Vakalat-OS is a real-time court case management dashboard designed for advocates 
                at the Rajasthan High Court. The system provides live case tracking, panic alerts 
                for upcoming cases, document management, and seamless communication between 
                senior advocates and their juniors.
              </p>
            </CardContent>
          </Card>

          {/* User Roles */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" aria-hidden="true" />
                User Roles & Workflows
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold text-foreground mb-2">Senior Advocate (War Room View)</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>Access the War Room for comprehensive case preparation</li>
                  <li>View case documents with argument-linked page navigation</li>
                  <li>Receive real-time whisper notifications from juniors</li>
                  <li>Monitor live court board status and panic alerts</li>
                  <li>Review all arguments with direct PDF page links</li>
                </ul>
              </div>
              
              <Separator />
              
              <div>
                <h3 className="font-semibold text-foreground mb-2">Junior Advocate (Control Deck View)</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>Upload evidence and case documents</li>
                  <li>Send whisper messages to seniors during hearings</li>
                  <li>Monitor case status and court progress</li>
                  <li>Manage document organization</li>
                </ul>
              </div>

              <Separator />
              
              <div>
                <h3 className="font-semibold text-foreground mb-2">Admin</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>Manage daily court docket entries</li>
                  <li>Configure case arguments and page links</li>
                  <li>Control live board status for all courtrooms</li>
                  <li>Add, edit, and delete cases from the system</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Features */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" aria-hidden="true" />
                Key Features
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold text-foreground mb-2">1. Live Court Board</h3>
                <p className="text-muted-foreground">
                  Real-time tracking of current item numbers across all courtrooms. The system 
                  automatically calculates distance from your case and triggers panic alerts 
                  when your case is within 5 items of being called.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">2. Panic Alert System</h3>
                <p className="text-muted-foreground">
                  Visual and audio alerts when your case approaches. Cases pulse red when 
                  within 5 items, and glow gold when currently running. Status badges 
                  update in real-time.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">3. War Room</h3>
                <p className="text-muted-foreground">
                  Split-screen view with arguments panel on the left and PDF viewer on the right. 
                  Click any argument to instantly jump to the relevant page in your case documents.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">4. Whisper System</h3>
                <p className="text-muted-foreground">
                  Real-time messaging between juniors in the control deck and seniors in the 
                  courtroom. Messages appear as toast notifications without disrupting the 
                  hearing flow. Features include:
                </p>
                <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1 ml-4">
                  <li><strong>Voice Memos:</strong> Record and send audio messages with hold-to-record gesture on mobile</li>
                  <li><strong>Notification Sounds:</strong> Audio alerts for incoming messages (can be muted)</li>
                  <li><strong>Unread Counter:</strong> Badge shows number of unread messages</li>
                  <li><strong>Message History:</strong> Scrollable chat with timestamps and sender names</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">5. Document Management</h3>
                <p className="text-muted-foreground">
                  Drag-and-drop file upload for case documents. Supports PDF and other file 
                  formats. Documents are securely stored and linked to specific cases.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-2">6. Admin Panel</h3>
                <p className="text-muted-foreground">
                  Complete case management interface for administrators. Manage docket entries, 
                  configure arguments, and control live board status for all courtrooms.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Accessibility */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-primary" aria-hidden="true" />
                Accessibility Features
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 rounded-lg bg-card border border-border">
                  <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                    <Keyboard className="h-4 w-4 text-primary" aria-hidden="true" />
                    Keyboard Navigation
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Full keyboard support throughout the application. Use Tab to navigate, 
                    Enter or Space to activate buttons, and Escape to close dialogs.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-card border border-border">
                  <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                    <Eye className="h-4 w-4 text-primary" aria-hidden="true" />
                    Screen Reader Support
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    ARIA labels on all interactive elements. Live regions announce 
                    status changes. Semantic HTML structure throughout.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-card border border-border">
                  <h4 className="font-semibold text-foreground mb-2">Focus Indicators</h4>
                  <p className="text-sm text-muted-foreground">
                    Clear visible focus rings on all interactive elements. High contrast 
                    gold outline ensures visibility against dark backgrounds.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-card border border-border">
                  <h4 className="font-semibold text-foreground mb-2">Reduced Motion</h4>
                  <p className="text-sm text-muted-foreground">
                    Respects prefers-reduced-motion setting. Animations are disabled 
                    for users who prefer minimal motion.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-card border border-border">
                  <h4 className="font-semibold text-foreground mb-2">Skip Links</h4>
                  <p className="text-sm text-muted-foreground">
                    Skip to main content links allow keyboard users to bypass 
                    navigation and jump directly to page content.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-card border border-border">
                  <h4 className="font-semibold text-foreground mb-2">Color Contrast</h4>
                  <p className="text-sm text-muted-foreground">
                    WCAG AA compliant color contrast ratios. Gold on dark backgrounds 
                    provides excellent readability.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-card border border-border">
                  <h4 className="font-semibold text-foreground mb-2">Touch Targets</h4>
                  <p className="text-sm text-muted-foreground">
                    All interactive elements have minimum 44×44px touch targets for 
                    easy mobile interaction per WCAG guidelines.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-card border border-border">
                  <h4 className="font-semibold text-foreground mb-2">Audio Controls</h4>
                  <p className="text-sm text-muted-foreground">
                    Notification sounds can be muted. Voice memos include visual 
                    progress indicators. Haptic feedback on supported devices.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" aria-hidden="true" />
                Security Features
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Secure user authentication with email/password</li>
                <li>Role-based access control (RBAC) with secure role storage</li>
                <li>Row-Level Security (RLS) on all database tables</li>
                <li>Separate user_roles table to prevent privilege escalation</li>
                <li>Security definer functions for role verification</li>
                <li>Protected admin routes with server-side validation</li>
                <li>Secure file storage with access policies</li>
              </ul>
            </CardContent>
          </Card>

          {/* Workflows */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
                Common Workflows
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold text-foreground mb-2">Preparing for a Hearing</h3>
                <ol className="list-decimal list-inside text-muted-foreground space-y-1">
                  <li>Log in and view your cases on the dashboard</li>
                  <li>Check the live ticker for current court status</li>
                  <li>Click on your case to enter War Room (Senior) or Control Deck (Junior)</li>
                  <li>Review arguments and navigate to relevant document pages</li>
                  <li>Monitor panic alerts as your case approaches</li>
                </ol>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-foreground mb-2">Uploading Documents</h3>
                <ol className="list-decimal list-inside text-muted-foreground space-y-1">
                  <li>Navigate to Control Deck for your case</li>
                  <li>Drag and drop files onto the upload area</li>
                  <li>Wait for upload confirmation</li>
                  <li>Documents appear in War Room PDF viewer</li>
                </ol>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-foreground mb-2">Sending a Whisper</h3>
                <ol className="list-decimal list-inside text-muted-foreground space-y-1">
                  <li>Open Control Deck for the active case</li>
                  <li>Click the chat bubble (bottom-right) to open Whisper Chat</li>
                  <li>Type your message and click send, or press Enter</li>
                  <li>For voice memos: Hold the microphone button to record, release to send</li>
                  <li>Senior receives instant notification with sound alert in War Room</li>
                  <li>Use the speaker icon to mute/unmute notification sounds</li>
                </ol>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-foreground mb-2">Managing Cases (Admin)</h3>
                <ol className="list-decimal list-inside text-muted-foreground space-y-1">
                  <li>Access Admin Panel from the header menu</li>
                  <li>Use Docket tab to add/edit cases</li>
                  <li>Use Arguments tab to link arguments to PDF pages</li>
                  <li>Use Courts tab to configure live board status</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          {/* ============================================ */}
          {/* TECHNICAL ARCHITECTURE DOCUMENTATION SECTION */}
          {/* ============================================ */}

          <div className="my-12 py-8 border-t border-b border-primary/30">
            <h2 className="text-3xl font-display font-bold text-center text-foreground">
              Technical Architecture & System Documentation
            </h2>
            <p className="text-center text-muted-foreground mt-2">
              Detailed technical specifications for developers and maintainers
            </p>
          </div>

          {/* 1. System Architecture Overview */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5 text-primary" aria-hidden="true" />
                1. System Architecture Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold text-foreground mb-3">Technology Stack</h3>
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="p-3 rounded bg-muted/30 border border-border">
                    <p className="text-sm font-medium text-foreground">Frontend Framework</p>
                    <p className="text-sm text-muted-foreground">React 18 with TypeScript</p>
                  </div>
                  <div className="p-3 rounded bg-muted/30 border border-border">
                    <p className="text-sm font-medium text-foreground">Build Tool</p>
                    <p className="text-sm text-muted-foreground">Vite with PWA support</p>
                  </div>
                  <div className="p-3 rounded bg-muted/30 border border-border">
                    <p className="text-sm font-medium text-foreground">Styling</p>
                    <p className="text-sm text-muted-foreground">TailwindCSS + shadcn/ui</p>
                  </div>
                  <div className="p-3 rounded bg-muted/30 border border-border">
                    <p className="text-sm font-medium text-foreground">State Management</p>
                    <p className="text-sm text-muted-foreground">TanStack Query v5</p>
                  </div>
                  <div className="p-3 rounded bg-muted/30 border border-border">
                    <p className="text-sm font-medium text-foreground">Backend</p>
                    <p className="text-sm text-muted-foreground">Supabase (PostgreSQL + Auth + Storage)</p>
                  </div>
                  <div className="p-3 rounded bg-muted/30 border border-border">
                    <p className="text-sm font-medium text-foreground">Real-time</p>
                    <p className="text-sm text-muted-foreground">Supabase Realtime (WebSocket)</p>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-foreground mb-3">Application Routes</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 text-foreground">Route</th>
                        <th className="text-left py-2 text-foreground">Component</th>
                        <th className="text-left py-2 text-foreground">Access</th>
                        <th className="text-left py-2 text-foreground">Description</th>
                      </tr>
                    </thead>
                    <tbody className="text-muted-foreground">
                      <tr className="border-b border-border/50">
                        <td className="py-2 font-mono text-xs">/</td>
                        <td className="py-2">Index</td>
                        <td className="py-2">Public</td>
                        <td className="py-2">Redirect to dashboard or auth</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2 font-mono text-xs">/auth</td>
                        <td className="py-2">Auth</td>
                        <td className="py-2">Public</td>
                        <td className="py-2">Login/Signup page</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2 font-mono text-xs">/docs</td>
                        <td className="py-2">Documentation</td>
                        <td className="py-2">Public</td>
                        <td className="py-2">This documentation page</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2 font-mono text-xs">/dashboard</td>
                        <td className="py-2">Dashboard</td>
                        <td className="py-2">AuthGuard</td>
                        <td className="py-2">Main dashboard with case list</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2 font-mono text-xs">/admin</td>
                        <td className="py-2">Admin</td>
                        <td className="py-2">AuthGuard + ADMIN role</td>
                        <td className="py-2">Admin management panel</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2 font-mono text-xs">/war-room/:caseId</td>
                        <td className="py-2">WarRoom</td>
                        <td className="py-2">AuthGuard</td>
                        <td className="py-2">Senior advocate case view</td>
                      </tr>
                      <tr>
                        <td className="py-2 font-mono text-xs">/control-deck/:caseId</td>
                        <td className="py-2">ControlDeck</td>
                        <td className="py-2">AuthGuard</td>
                        <td className="py-2">Junior advocate control panel</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-foreground mb-3">Architecture Diagram</h3>
                <div className="p-4 rounded bg-muted/30 border border-border font-mono text-xs overflow-x-auto">
                  <pre className="text-muted-foreground whitespace-pre">
{`┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (React)                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │Dashboard │  │ War Room │  │  Control │  │     Admin        │ │
│  │          │  │          │  │   Deck   │  │     Panel        │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘ │
│       │             │             │                  │           │
│       └─────────────┴─────────────┴──────────────────┘           │
│                              │                                   │
│                    ┌─────────▼─────────┐                         │
│                    │  TanStack Query   │ (Cache + State)         │
│                    └─────────┬─────────┘                         │
└──────────────────────────────┼───────────────────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │   Supabase Client   │
                    └──────────┬──────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
┌────────▼────────┐  ┌─────────▼─────────┐  ┌───────▼───────┐
│   PostgreSQL    │  │  Supabase Auth    │  │    Storage    │
│   + RLS + RT    │  │                   │  │  (Documents)  │
└─────────────────┘  └───────────────────┘  └───────────────┘`}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Database Schema */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" aria-hidden="true" />
                2. Database Schema
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-muted-foreground">
                The database consists of 8 tables with Row-Level Security (RLS) enabled on all tables.
              </p>

              {/* profiles table */}
              <div className="p-4 rounded bg-muted/30 border border-border">
                <h4 className="font-semibold text-foreground mb-2 font-mono">profiles</h4>
                <p className="text-sm text-muted-foreground mb-3">Stores user profile information. Links to auth.users via id.</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-1 text-foreground">Column</th>
                        <th className="text-left py-1 text-foreground">Type</th>
                        <th className="text-left py-1 text-foreground">Default</th>
                        <th className="text-left py-1 text-foreground">Description</th>
                      </tr>
                    </thead>
                    <tbody className="text-muted-foreground font-mono">
                      <tr><td className="py-1">id</td><td>uuid</td><td>-</td><td className="font-sans">Primary key (matches auth.users.id)</td></tr>
                      <tr><td className="py-1">full_name</td><td>text</td><td>null</td><td className="font-sans">User's display name</td></tr>
                      <tr><td className="py-1">whatsapp_number</td><td>text</td><td>null</td><td className="font-sans">Contact number</td></tr>
                      <tr><td className="py-1">role</td><td>text</td><td>'JUNIOR'</td><td className="font-sans">Legacy role field (use user_roles instead)</td></tr>
                      <tr><td className="py-1">created_at</td><td>timestamptz</td><td>now()</td><td className="font-sans">Account creation time</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* user_roles table */}
              <div className="p-4 rounded bg-muted/30 border border-border">
                <h4 className="font-semibold text-foreground mb-2 font-mono">user_roles</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  <span className="text-primary font-semibold">SECURITY CRITICAL:</span> Secure role storage table. 
                  Roles MUST be stored here (not in profiles) to prevent privilege escalation attacks.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-1 text-foreground">Column</th>
                        <th className="text-left py-1 text-foreground">Type</th>
                        <th className="text-left py-1 text-foreground">Description</th>
                      </tr>
                    </thead>
                    <tbody className="text-muted-foreground font-mono">
                      <tr><td className="py-1">id</td><td>uuid</td><td className="font-sans">Primary key</td></tr>
                      <tr><td className="py-1">user_id</td><td>uuid</td><td className="font-sans">References auth.users</td></tr>
                      <tr><td className="py-1">role</td><td>app_role (enum)</td><td className="font-sans">SENIOR | JUNIOR | CLERK | ADMIN</td></tr>
                      <tr><td className="py-1">created_at</td><td>timestamptz</td><td className="font-sans">Role assignment time</td></tr>
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 p-2 bg-primary/10 rounded text-xs text-muted-foreground">
                  <strong className="text-foreground">RLS Policies:</strong> Users can only view their own roles. Insert is system-only via trigger.
                </div>
              </div>

              {/* daily_court_docket table */}
              <div className="p-4 rounded bg-muted/30 border border-border">
                <h4 className="font-semibold text-foreground mb-2 font-mono">daily_court_docket</h4>
                <p className="text-sm text-muted-foreground mb-3">Case listings for each court date.</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-1 text-foreground">Column</th>
                        <th className="text-left py-1 text-foreground">Type</th>
                        <th className="text-left py-1 text-foreground">Description</th>
                      </tr>
                    </thead>
                    <tbody className="text-muted-foreground font-mono">
                      <tr><td className="py-1">id</td><td>uuid</td><td className="font-sans">Primary key</td></tr>
                      <tr><td className="py-1">date</td><td>date</td><td className="font-sans">Court date (default: CURRENT_DATE)</td></tr>
                      <tr><td className="py-1">item_no</td><td>integer</td><td className="font-sans">Case position in queue</td></tr>
                      <tr><td className="py-1">case_number</td><td>text</td><td className="font-sans">Official case number</td></tr>
                      <tr><td className="py-1">court_location</td><td>text</td><td className="font-sans">e.g., 'JODHPUR', 'JAIPUR'</td></tr>
                      <tr><td className="py-1">court_room_no</td><td>text</td><td className="font-sans">Court room number</td></tr>
                      <tr><td className="py-1">list_type</td><td>text</td><td className="font-sans">'FRESH' | 'REGULAR' | 'MISC'</td></tr>
                      <tr><td className="py-1">petitioner_lawyer</td><td>text</td><td className="font-sans">Petitioner's advocate name</td></tr>
                      <tr><td className="py-1">respondent_lawyer</td><td>text</td><td className="font-sans">Respondent's advocate name</td></tr>
                      <tr><td className="py-1">matched_profile_id</td><td>uuid</td><td className="font-sans">FK to profiles (assigned advocate)</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* live_board_cache table */}
              <div className="p-4 rounded bg-muted/30 border border-border">
                <h4 className="font-semibold text-foreground mb-2 font-mono">live_board_cache</h4>
                <p className="text-sm text-muted-foreground mb-3">Real-time court status. Updated by Control Deck or Admin.</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-1 text-foreground">Column</th>
                        <th className="text-left py-1 text-foreground">Type</th>
                        <th className="text-left py-1 text-foreground">Description</th>
                      </tr>
                    </thead>
                    <tbody className="text-muted-foreground font-mono">
                      <tr><td className="py-1">court_location</td><td>text</td><td className="font-sans">Composite PK part 1</td></tr>
                      <tr><td className="py-1">court_no</td><td>text</td><td className="font-sans">Composite PK part 2</td></tr>
                      <tr><td className="py-1">current_item</td><td>integer</td><td className="font-sans">Current item being heard (default: 1)</td></tr>
                      <tr><td className="py-1">is_supplementary_running</td><td>boolean</td><td className="font-sans">Supplementary list active (default: false)</td></tr>
                      <tr><td className="py-1">status</td><td>text</td><td className="font-sans">'hearing' | 'passover' | 'lunch'</td></tr>
                      <tr><td className="py-1">last_updated</td><td>timestamptz</td><td className="font-sans">Last status change time</td></tr>
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 p-2 bg-primary/10 rounded text-xs text-muted-foreground">
                  <strong className="text-foreground">Composite Primary Key:</strong> (court_location, court_no) - ensures one row per courtroom.
                </div>
              </div>

              {/* live_courtroom_feed table */}
              <div className="p-4 rounded bg-muted/30 border border-border">
                <h4 className="font-semibold text-foreground mb-2 font-mono">live_courtroom_feed</h4>
                <p className="text-sm text-muted-foreground mb-3">Whisper messages between team members.</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-1 text-foreground">Column</th>
                        <th className="text-left py-1 text-foreground">Type</th>
                        <th className="text-left py-1 text-foreground">Description</th>
                      </tr>
                    </thead>
                    <tbody className="text-muted-foreground font-mono">
                      <tr><td className="py-1">id</td><td>uuid</td><td className="font-sans">Primary key</td></tr>
                      <tr><td className="py-1">docket_id</td><td>uuid</td><td className="font-sans">FK to daily_court_docket</td></tr>
                      <tr><td className="py-1">sender_id</td><td>uuid</td><td className="font-sans">FK to profiles (message sender)</td></tr>
                      <tr><td className="py-1">message</td><td>text</td><td className="font-sans">Text or '[VOICE_MEMO]url' format</td></tr>
                      <tr><td className="py-1">is_read</td><td>boolean</td><td className="font-sans">Read status (default: false)</td></tr>
                      <tr><td className="py-1">created_at</td><td>timestamptz</td><td className="font-sans">Message timestamp</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* case_documents table */}
              <div className="p-4 rounded bg-muted/30 border border-border">
                <h4 className="font-semibold text-foreground mb-2 font-mono">case_documents</h4>
                <p className="text-sm text-muted-foreground mb-3">Uploaded case files metadata.</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-1 text-foreground">Column</th>
                        <th className="text-left py-1 text-foreground">Type</th>
                        <th className="text-left py-1 text-foreground">Description</th>
                      </tr>
                    </thead>
                    <tbody className="text-muted-foreground font-mono">
                      <tr><td className="py-1">id</td><td>uuid</td><td className="font-sans">Primary key</td></tr>
                      <tr><td className="py-1">docket_id</td><td>uuid</td><td className="font-sans">FK to daily_court_docket</td></tr>
                      <tr><td className="py-1">file_url</td><td>text</td><td className="font-sans">Supabase Storage public URL</td></tr>
                      <tr><td className="py-1">doc_type</td><td>text</td><td className="font-sans">File type (e.g., 'application/pdf')</td></tr>
                      <tr><td className="py-1">uploaded_at</td><td>timestamptz</td><td className="font-sans">Upload timestamp</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* case_arguments table */}
              <div className="p-4 rounded bg-muted/30 border border-border">
                <h4 className="font-semibold text-foreground mb-2 font-mono">case_arguments</h4>
                <p className="text-sm text-muted-foreground mb-3">Arguments linked to specific PDF pages.</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-1 text-foreground">Column</th>
                        <th className="text-left py-1 text-foreground">Type</th>
                        <th className="text-left py-1 text-foreground">Description</th>
                      </tr>
                    </thead>
                    <tbody className="text-muted-foreground font-mono">
                      <tr><td className="py-1">id</td><td>uuid</td><td className="font-sans">Primary key</td></tr>
                      <tr><td className="py-1">docket_id</td><td>uuid</td><td className="font-sans">FK to daily_court_docket</td></tr>
                      <tr><td className="py-1">title</td><td>text</td><td className="font-sans">Argument title (required)</td></tr>
                      <tr><td className="py-1">linked_page_number</td><td>integer</td><td className="font-sans">PDF page to jump to (default: 1)</td></tr>
                      <tr><td className="py-1">highlight_coords</td><td>jsonb</td><td className="font-sans">Optional highlight coordinates</td></tr>
                      <tr><td className="py-1">created_at</td><td>timestamptz</td><td className="font-sans">Creation timestamp</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* document_annotations table */}
              <div className="p-4 rounded bg-muted/30 border border-border">
                <h4 className="font-semibold text-foreground mb-2 font-mono">document_annotations</h4>
                <p className="text-sm text-muted-foreground mb-3">PDF annotations (highlights, drawings, notes).</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-1 text-foreground">Column</th>
                        <th className="text-left py-1 text-foreground">Type</th>
                        <th className="text-left py-1 text-foreground">Description</th>
                      </tr>
                    </thead>
                    <tbody className="text-muted-foreground font-mono">
                      <tr><td className="py-1">id</td><td>uuid</td><td className="font-sans">Primary key</td></tr>
                      <tr><td className="py-1">document_id</td><td>uuid</td><td className="font-sans">FK to case_documents</td></tr>
                      <tr><td className="py-1">user_id</td><td>uuid</td><td className="font-sans">Creator (required)</td></tr>
                      <tr><td className="py-1">page_number</td><td>integer</td><td className="font-sans">PDF page (required)</td></tr>
                      <tr><td className="py-1">annotation_type</td><td>text</td><td className="font-sans">'highlight' | 'pen' | 'text'</td></tr>
                      <tr><td className="py-1">annotation_json</td><td>jsonb</td><td className="font-sans">Annotation data (see format below)</td></tr>
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 p-2 bg-muted/50 rounded font-mono text-xs overflow-x-auto">
                  <pre className="text-muted-foreground">
{`annotation_json: {
  color?: string;           // e.g., '#FFEB3B' for highlight
  text?: string;            // For text annotations
  coordinates?: {x, y}[];   // For pen strokes
  boundingRect?: {x, y, width, height}  // For highlights
}`}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 3. Authentication System */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" aria-hidden="true" />
                3. Authentication System
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold text-foreground mb-3">Authentication Flow</h3>
                <div className="p-4 rounded bg-muted/30 border border-border font-mono text-xs overflow-x-auto">
                  <pre className="text-muted-foreground whitespace-pre">
{`┌────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│  User Signup   │ ───▶ │  Supabase Auth   │ ───▶ │ auth.users row  │
│  (email/pass)  │      │  (auto-confirm)  │      │    created      │
└────────────────┘      └────────┬─────────┘      └────────┬────────┘
                                 │                         │
                                 ▼                         ▼
                     ┌───────────────────────┐   ┌─────────────────────┐
                     │  handle_new_user()    │   │  Trigger fires on   │
                     │  SECURITY DEFINER     │   │  auth.users INSERT  │
                     └───────────┬───────────┘   └─────────────────────┘
                                 │
              ┌──────────────────┴──────────────────┐
              │                                     │
              ▼                                     ▼
    ┌──────────────────┐               ┌───────────────────┐
    │ profiles INSERT  │               │ user_roles INSERT │
    │ (id, full_name)  │               │ (user_id, role)   │
    └──────────────────┘               └───────────────────┘`}
                  </pre>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-foreground mb-3">Database Functions</h3>
                
                <div className="space-y-4">
                  <div className="p-3 rounded bg-muted/30 border border-border">
                    <h4 className="font-mono text-sm text-foreground mb-2">handle_new_user()</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      Trigger function executed on auth.users INSERT. Creates profile and assigns role from user metadata.
                    </p>
                    <div className="font-mono text-xs bg-muted/50 p-2 rounded overflow-x-auto">
                      <pre className="text-muted-foreground">
{`RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
-- Inserts into profiles (id, full_name)
-- Inserts into user_roles (user_id, role)
-- Role defaults to 'JUNIOR' if not specified`}
                      </pre>
                    </div>
                  </div>

                  <div className="p-3 rounded bg-muted/30 border border-border">
                    <h4 className="font-mono text-sm text-foreground mb-2">get_user_role(_user_id uuid)</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      Retrieves user's role. Uses SECURITY DEFINER to bypass RLS and prevent recursive policy checks.
                    </p>
                    <div className="font-mono text-xs bg-muted/50 p-2 rounded overflow-x-auto">
                      <pre className="text-muted-foreground">
{`RETURNS app_role LANGUAGE sql STABLE SECURITY DEFINER
SELECT role FROM user_roles WHERE user_id = _user_id LIMIT 1`}
                      </pre>
                    </div>
                  </div>

                  <div className="p-3 rounded bg-muted/30 border border-border">
                    <h4 className="font-mono text-sm text-foreground mb-2">has_role(_user_id uuid, _role app_role)</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      Checks if user has specific role. Used in RLS policies for role-based access.
                    </p>
                    <div className="font-mono text-xs bg-muted/50 p-2 rounded overflow-x-auto">
                      <pre className="text-muted-foreground">
{`RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = _role)`}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-foreground mb-3">Session Management (useAuth Hook)</h3>
                <div className="p-3 rounded bg-muted/30 border border-border font-mono text-xs overflow-x-auto">
                  <pre className="text-muted-foreground">
{`// Critical: Set up listener BEFORE checking session
useEffect(() => {
  // 1. Subscribe to auth changes
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      // 2. Defer Supabase calls to prevent deadlock
      if (session?.user) {
        setTimeout(() => {
          fetchProfile(session.user.id);
          fetchRole(session.user.id);
        }, 0);
      }
    }
  );

  // 3. Then check existing session
  supabase.auth.getSession().then(({ data: { session } }) => {
    setSession(session);
    setUser(session?.user ?? null);
  });

  return () => subscription.unsubscribe();
}, []);`}
                  </pre>
                </div>
                <div className="mt-3 p-2 bg-danger/10 border border-danger/30 rounded text-xs text-muted-foreground">
                  <strong className="text-danger">Critical:</strong> Always use setTimeout(0) when calling Supabase functions 
                  inside onAuthStateChange to prevent authentication deadlocks.
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-foreground mb-3">Role Types</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="p-3 rounded bg-muted/30 border border-border">
                    <p className="font-mono text-sm text-primary">SENIOR</p>
                    <p className="text-xs text-muted-foreground">Access War Room, receive whispers, view documents</p>
                  </div>
                  <div className="p-3 rounded bg-muted/30 border border-border">
                    <p className="font-mono text-sm text-primary">JUNIOR</p>
                    <p className="text-xs text-muted-foreground">Access Control Deck, send whispers, upload documents</p>
                  </div>
                  <div className="p-3 rounded bg-muted/30 border border-border">
                    <p className="font-mono text-sm text-primary">CLERK</p>
                    <p className="text-xs text-muted-foreground">Basic access, view docket information</p>
                  </div>
                  <div className="p-3 rounded bg-muted/30 border border-border">
                    <p className="font-mono text-sm text-primary">ADMIN</p>
                    <p className="text-xs text-muted-foreground">Full access, manage docket, control live board</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 4. Real-time Synchronization */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wifi className="h-5 w-5 text-primary" aria-hidden="true" />
                4. Real-time Synchronization System
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-muted-foreground">
                Three real-time subscriptions power the live features. All use Supabase Realtime's postgres_changes events.
              </p>

              {/* Live Board Sync */}
              <div className="p-4 rounded bg-muted/30 border border-border">
                <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-success animate-pulse"></span>
                  Live Board Sync (useLiveBoard hook)
                </h4>
                <div className="font-mono text-xs bg-muted/50 p-3 rounded overflow-x-auto">
                  <pre className="text-muted-foreground">
{`const channel = supabase
  .channel('live-board-changes')
  .on('postgres_changes', {
    event: '*',                    // INSERT, UPDATE, DELETE
    schema: 'public',
    table: 'live_board_cache',
  }, () => {
    queryClient.invalidateQueries({ queryKey: ['liveBoard'] });
  })
  .subscribe();`}
                  </pre>
                </div>
                <ul className="mt-3 text-xs text-muted-foreground space-y-1">
                  <li>• <strong>Events:</strong> All (*, catches INSERT/UPDATE/DELETE)</li>
                  <li>• <strong>Scope:</strong> Global (all courtrooms)</li>
                  <li>• <strong>Action:</strong> Invalidates TanStack Query cache → triggers refetch</li>
                  <li>• <strong>Update Frequency:</strong> When admin/control deck changes court status</li>
                </ul>
              </div>

              {/* Whisper Sync */}
              <div className="p-4 rounded bg-muted/30 border border-border">
                <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                  Whisper Message Sync (useWhisperListener hook)
                </h4>
                <div className="font-mono text-xs bg-muted/50 p-3 rounded overflow-x-auto">
                  <pre className="text-muted-foreground">
{`const channel = supabase
  .channel(\`whisper-\${docketId}\`)
  .on('postgres_changes', {
    event: 'INSERT',               // Only new messages
    schema: 'public',
    table: 'live_courtroom_feed',
    filter: \`docket_id=eq.\${docketId}\`,  // Filter by case
  }, (payload) => {
    const newMessage = payload.new as WhisperMessage;
    
    // Show toast notification
    toast(newMessage.message, {
      className: 'mission-critical-toast',
      duration: 8000,
    });
    
    // Play notification sound
    playNotification('message');
    
    // Refresh messages list
    queryClient.invalidateQueries({ queryKey: ['whisper', docketId] });
  })
  .subscribe();`}
                  </pre>
                </div>
                <ul className="mt-3 text-xs text-muted-foreground space-y-1">
                  <li>• <strong>Events:</strong> INSERT only (new messages)</li>
                  <li>• <strong>Scope:</strong> Filtered by docket_id (case-specific)</li>
                  <li>• <strong>Actions:</strong> Toast notification + sound + cache invalidation</li>
                  <li>• <strong>Toast Duration:</strong> 8 seconds (mission-critical styling)</li>
                </ul>
              </div>

              {/* Annotations Sync */}
              <div className="p-4 rounded bg-muted/30 border border-border">
                <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-warning animate-pulse"></span>
                  Annotations Sync (useAnnotations hook)
                </h4>
                <div className="font-mono text-xs bg-muted/50 p-3 rounded overflow-x-auto">
                  <pre className="text-muted-foreground">
{`const channel = supabase
  .channel(\`annotations-\${documentId}\`)
  .on('postgres_changes', {
    event: '*',                    // All changes
    schema: 'public',
    table: 'document_annotations',
    filter: \`document_id=eq.\${documentId}\`,
  }, () => {
    queryClient.invalidateQueries({ 
      queryKey: ['annotations', documentId] 
    });
  })
  .subscribe();`}
                  </pre>
                </div>
                <ul className="mt-3 text-xs text-muted-foreground space-y-1">
                  <li>• <strong>Events:</strong> All (INSERT/UPDATE/DELETE)</li>
                  <li>• <strong>Scope:</strong> Filtered by document_id</li>
                  <li>• <strong>Purpose:</strong> Collaborative annotation editing</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-foreground mb-3">Network Status Indicator</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="p-3 rounded bg-success/10 border border-success/30">
                    <p className="font-semibold text-success text-sm flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-success animate-ping"></span>
                      Live Sync
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Online - Real-time updates active. Animated ping indicator.
                    </p>
                  </div>
                  <div className="p-3 rounded bg-danger/10 border border-danger/30">
                    <p className="font-semibold text-danger text-sm flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-danger"></span>
                      Bunker Mode
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Offline - Using cached data. Mutations queued for sync.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 5. Panic Alert System Logic */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-primary" aria-hidden="true" />
                5. Panic Alert System Logic
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold text-foreground mb-3">Distance Calculation Formula</h3>
                <div className="p-4 rounded bg-muted/30 border border-border font-mono text-sm">
                  <pre className="text-muted-foreground">
{`// Core calculation
const myItemNumber = docketItem.item_no;        // Your case position
const currentItem = liveBoard.current_item;     // Court's current item
const distance = myItemNumber - currentItem;    // Items until your case

// Status determination
const isPanic = distance > 0 && distance <= 5 && status === 'hearing';
const isRunning = distance <= 0 && status === 'hearing';
const isWaiting = distance > 5;`}
                  </pre>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-foreground mb-3">Status States & Visual Indicators</h3>
                <div className="space-y-3">
                  <div className="p-3 rounded border-2 border-danger bg-danger/10 flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full bg-danger animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
                    <div>
                      <p className="font-semibold text-danger">PANIC (1-5 items away)</p>
                      <p className="text-xs text-muted-foreground">Red pulsing glow, urgent badge, CSS: panic-pulse animation</p>
                    </div>
                  </div>
                  
                  <div className="p-3 rounded border-2 border-primary bg-primary/10 flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full bg-primary shadow-[0_0_10px_rgba(251,191,36,0.5)]"></div>
                    <div>
                      <p className="font-semibold text-primary">RUNNING (0 or less)</p>
                      <p className="text-xs text-muted-foreground">Gold glow effect, "NOW" badge, CSS: gold-glow shadow</p>
                    </div>
                  </div>
                  
                  <div className="p-3 rounded border border-border flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full bg-muted"></div>
                    <div>
                      <p className="font-semibold text-foreground">WAITING (6+ items away)</p>
                      <p className="text-xs text-muted-foreground">Neutral styling, shows "X items away" text</p>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-foreground mb-3">Court Status Modifiers</h3>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="p-3 rounded bg-muted/30 border border-border text-center">
                    <p className="font-mono text-sm text-success">hearing</p>
                    <p className="text-xs text-muted-foreground mt-1">Normal operation, panic alerts active</p>
                  </div>
                  <div className="p-3 rounded bg-muted/30 border border-border text-center">
                    <p className="font-mono text-sm text-muted-foreground">passover</p>
                    <p className="text-xs text-muted-foreground mt-1">Case skipped, grayscale styling</p>
                  </div>
                  <div className="p-3 rounded bg-muted/30 border border-border text-center">
                    <p className="font-mono text-sm text-warning">lunch</p>
                    <p className="text-xs text-muted-foreground mt-1">Break time, yellow styling</p>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-foreground mb-3">CSS Animations</h3>
                <div className="font-mono text-xs bg-muted/30 p-3 rounded overflow-x-auto">
                  <pre className="text-muted-foreground">
{`/* Panic pulse animation */
@keyframes panic-pulse {
  0%, 100% { 
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
    transform: scale(1);
  }
  50% { 
    box-shadow: 0 0 20px 10px rgba(239, 68, 68, 0.2);
    transform: scale(1.02);
  }
}

.animate-panic-pulse {
  animation: panic-pulse 1.5s ease-in-out infinite;
}

/* Gold glow for running cases */
.gold-glow {
  box-shadow: 0 0 20px rgba(251, 191, 36, 0.4);
}`}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 6. Whisper System Technical Flow */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" aria-hidden="true" />
                6. Whisper System Technical Flow
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Text Messages */}
              <div>
                <h3 className="font-semibold text-foreground mb-3">Text Message Flow</h3>
                <div className="p-4 rounded bg-muted/30 border border-border font-mono text-xs overflow-x-auto">
                  <pre className="text-muted-foreground whitespace-pre">
{`┌───────────────┐     ┌─────────────────────┐     ┌─────────────────┐
│ Junior types  │ ──▶ │ useSendWhisper      │ ──▶ │ INSERT into     │
│ message       │     │ mutation            │     │ live_courtroom  │
└───────────────┘     └─────────────────────┘     │ _feed table     │
                                                  └────────┬────────┘
                                                           │
┌───────────────┐     ┌─────────────────────┐             │
│ Senior sees   │ ◀── │ Realtime triggers   │ ◀───────────┘
│ toast + sound │     │ useWhisperListener  │
└───────────────┘     └─────────────────────┘`}
                  </pre>
                </div>
              </div>

              <Separator />

              {/* Voice Memos */}
              <div>
                <h3 className="font-semibold text-foreground mb-3">Voice Memo Flow</h3>
                <div className="p-4 rounded bg-muted/30 border border-border font-mono text-xs overflow-x-auto">
                  <pre className="text-muted-foreground whitespace-pre">
{`┌─────────────────┐     ┌───────────────────┐     ┌─────────────────────┐
│ Hold mic button │ ──▶ │ MediaRecorder API │ ──▶ │ WebM Blob created   │
│ (200ms minimum) │     │ starts recording  │     │ (on release)        │
└─────────────────┘     └───────────────────┘     └──────────┬──────────┘
                                                             │
┌─────────────────────────────────────────────────────────────┘
│
▼
┌─────────────────────┐     ┌─────────────────────────────────────────┐
│ Upload to Storage   │ ──▶ │ Path: case-documents/whispers/          │
│ supabase.storage    │     │ voice-{docketId}-{timestamp}.webm       │
└─────────────────────┘     └────────────────────┬────────────────────┘
                                                 │
                                                 ▼
                            ┌─────────────────────────────────────────┐
                            │ INSERT message: "[VOICE_MEMO]{url}"     │
                            │ into live_courtroom_feed                │
                            └─────────────────────────────────────────┘`}
                  </pre>
                </div>
                <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                  <p><strong>Recording Specs:</strong></p>
                  <ul className="list-disc list-inside ml-2 space-y-1">
                    <li>Format: WebM (audio/webm)</li>
                    <li>Sample Rate: Browser default (typically 24kHz+)</li>
                    <li>Minimum Duration: 1 second (configurable)</li>
                    <li>Hold Threshold: 200ms before recording starts</li>
                  </ul>
                </div>
              </div>

              <Separator />

              {/* Notification Sound */}
              <div>
                <h3 className="font-semibold text-foreground mb-3">Notification Sound System (Web Audio API)</h3>
                <div className="font-mono text-xs bg-muted/30 p-3 rounded overflow-x-auto">
                  <pre className="text-muted-foreground">
{`// useNotificationSound hook
const playNotification = (type: 'message' | 'urgent') => {
  const audioContext = audioContextRef.current;
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  if (type === 'message') {
    // Gentle chime: 800Hz, 0.1s
    oscillator.type = 'sine';
    oscillator.frequency.value = 800;
    gainNode.gain.value = 0.1;
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.1);
  } else {
    // Urgent two-tone: 600Hz → 800Hz, 0.15s each
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.15);
    gainNode.gain.value = 0.15;
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.3);
  }
};`}
                  </pre>
                </div>
                <div className="mt-3 p-2 bg-primary/10 rounded text-xs text-muted-foreground">
                  <strong className="text-foreground">Note:</strong> AudioContext is initialized on first user interaction 
                  (click/touch) to comply with browser autoplay policies.
                </div>
              </div>

              <Separator />

              {/* Haptic Feedback */}
              <div>
                <h3 className="font-semibold text-foreground mb-3">Haptic Feedback (Mobile)</h3>
                <div className="font-mono text-xs bg-muted/30 p-3 rounded">
                  <pre className="text-muted-foreground">
{`// Recording start vibration
navigator.vibrate(50);              // Short 50ms pulse

// Message sent success
navigator.vibrate([50, 50, 50]);    // Triple pulse pattern`}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 7. Document & Annotation System */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" aria-hidden="true" />
                7. Document & Annotation System
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Document Upload */}
              <div>
                <h3 className="font-semibold text-foreground mb-3">Document Upload Flow</h3>
                <div className="p-4 rounded bg-muted/30 border border-border font-mono text-xs overflow-x-auto">
                  <pre className="text-muted-foreground whitespace-pre">
{`┌──────────────────┐     ┌──────────────────────┐     ┌───────────────────┐
│ File selected    │ ──▶ │ supabase.storage     │ ──▶ │ Public URL        │
│ (drag-drop/pick) │     │ .upload()            │     │ generated         │
└──────────────────┘     └──────────────────────┘     └─────────┬─────────┘
                                                                │
Storage Path: case-documents/{docketId}/{timestamp}.{ext}       │
                                                                ▼
                                                  ┌──────────────────────────┐
                                                  │ INSERT into case_docs    │
                                                  │ (docket_id, file_url,    │
                                                  │  doc_type)               │
                                                  └──────────────────────────┘`}
                  </pre>
                </div>
                <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                  <p><strong>Supported Formats:</strong> PDF, DOC, DOCX, JPG, JPEG, PNG</p>
                  <p><strong>Storage Bucket:</strong> case-documents (public)</p>
                  <p><strong>File Naming:</strong> {'{docketId}/{timestamp}.{extension}'}</p>
                </div>
              </div>

              <Separator />

              {/* PDF Viewer */}
              <div>
                <h3 className="font-semibold text-foreground mb-3">PDF Viewer Features (react-pdf)</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="p-3 rounded bg-muted/30 border border-border">
                    <p className="font-semibold text-foreground text-sm">Zoom Controls</p>
                    <p className="text-xs text-muted-foreground">50% to 300% scale, pinch-to-zoom on touch devices</p>
                  </div>
                  <div className="p-3 rounded bg-muted/30 border border-border">
                    <p className="font-semibold text-foreground text-sm">Page Navigation</p>
                    <p className="text-xs text-muted-foreground">Arrow buttons, argument-linked jumps</p>
                  </div>
                  <div className="p-3 rounded bg-muted/30 border border-border">
                    <p className="font-semibold text-foreground text-sm">Annotation Overlay</p>
                    <p className="text-xs text-muted-foreground">Canvas layer for highlights and pen strokes</p>
                  </div>
                  <div className="p-3 rounded bg-muted/30 border border-border">
                    <p className="font-semibold text-foreground text-sm">Fallback PDF</p>
                    <p className="text-xs text-muted-foreground">Test PDF shown when no documents uploaded</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Annotation Types */}
              <div>
                <h3 className="font-semibold text-foreground mb-3">Annotation Types</h3>
                <div className="space-y-3">
                  <div className="p-3 rounded bg-yellow-500/20 border border-yellow-500/30">
                    <p className="font-mono text-sm text-yellow-500">highlight</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Yellow semi-transparent background. Stores boundingRect {'{x, y, width, height}'}.
                      Created by click-drag selection.
                    </p>
                  </div>
                  <div className="p-3 rounded bg-red-500/20 border border-red-500/30">
                    <p className="font-mono text-sm text-red-500">pen</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Red stroke drawing. Stores coordinates array [{'{x, y}'}, ...].
                      Created by freehand drawing on canvas.
                    </p>
                  </div>
                  <div className="p-3 rounded bg-muted/30 border border-border">
                    <p className="font-mono text-sm text-muted-foreground">text (planned)</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Text note annotations. Will store text content and position.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 8. Offline Support System */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" aria-hidden="true" />
                8. Offline Support System (IndexedDB)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold text-foreground mb-3">IndexedDB Schema (useOfflineCache hook)</h3>
                <div className="font-mono text-xs bg-muted/30 p-3 rounded overflow-x-auto">
                  <pre className="text-muted-foreground">
{`// Database: vakalat-os-cache
// Version: 1

Object Stores:
┌─────────────────────┬────────────────────────────────────────┐
│ Store Name          │ Purpose                                │
├─────────────────────┼────────────────────────────────────────┤
│ docket-items        │ Cached daily_court_docket rows         │
│ case-documents      │ Document metadata (not file blobs)     │
│ case-arguments      │ Cached case_arguments rows             │
│ pending-mutations   │ Queued write operations for sync       │
└─────────────────────┴────────────────────────────────────────┘

Pending Mutation Format:
{
  id: string,           // UUID
  type: 'INSERT' | 'UPDATE' | 'DELETE',
  table: string,        // Target table name
  data: object,         // Mutation payload
  timestamp: number     // Created timestamp (ms)
}`}
                  </pre>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-foreground mb-3">Network Detection</h3>
                <div className="font-mono text-xs bg-muted/30 p-3 rounded">
                  <pre className="text-muted-foreground">
{`// Browser events for online/offline detection
window.addEventListener('online', () => {
  setIsOnline(true);
  // Sync pending mutations
  processPendingMutations();
});

window.addEventListener('offline', () => {
  setIsOnline(false);
  // Switch to cached data
});

// Initial state from navigator
const [isOnline, setIsOnline] = useState(navigator.onLine);`}
                  </pre>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-foreground mb-3">Offline-First Write Pattern</h3>
                <div className="p-4 rounded bg-muted/30 border border-border font-mono text-xs overflow-x-auto">
                  <pre className="text-muted-foreground whitespace-pre">
{`┌──────────────┐     ┌─────────────────────┐
│ User action  │ ──▶ │ Is online?          │
│ (write data) │     └──────────┬──────────┘
└──────────────┘                │
                    ┌───────────┴───────────┐
                    │                       │
                    ▼ YES                   ▼ NO
         ┌──────────────────┐    ┌──────────────────────┐
         │ Write to Supabase│    │ Queue in IndexedDB   │
         │ immediately      │    │ pending-mutations    │
         └──────────────────┘    └──────────────────────┘
                    │                       │
                    ▼                       ▼
         ┌──────────────────┐    ┌──────────────────────┐
         │ Update local     │    │ When back online:    │
         │ cache            │    │ Process queue FIFO   │
         └──────────────────┘    └──────────────────────┘`}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 9. Data Fetching Patterns */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-primary" aria-hidden="true" />
                9. Data Fetching Patterns (TanStack Query)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold text-foreground mb-3">Query Key Structure</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 text-foreground">Query Key</th>
                        <th className="text-left py-2 text-foreground">Hook</th>
                        <th className="text-left py-2 text-foreground">Data Source</th>
                      </tr>
                    </thead>
                    <tbody className="text-muted-foreground font-mono">
                      <tr className="border-b border-border/50">
                        <td className="py-2">['docket', date]</td>
                        <td className="py-2 font-sans">useDocket</td>
                        <td className="py-2 font-sans">daily_court_docket</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2">['docket', caseId]</td>
                        <td className="py-2 font-sans">useDocketItem</td>
                        <td className="py-2 font-sans">daily_court_docket (single)</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2">['liveBoard']</td>
                        <td className="py-2 font-sans">useLiveBoard</td>
                        <td className="py-2 font-sans">live_board_cache</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2">['whisper', docketId]</td>
                        <td className="py-2 font-sans">useWhisperFeed</td>
                        <td className="py-2 font-sans">live_courtroom_feed</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2">['case-documents', docketId]</td>
                        <td className="py-2 font-sans">useCaseDocuments</td>
                        <td className="py-2 font-sans">case_documents</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2">['arguments', docketId]</td>
                        <td className="py-2 font-sans">useArguments</td>
                        <td className="py-2 font-sans">case_arguments</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2">['annotations', documentId]</td>
                        <td className="py-2 font-sans">useAnnotations</td>
                        <td className="py-2 font-sans">document_annotations</td>
                      </tr>
                      <tr>
                        <td className="py-2">['user-role', userId]</td>
                        <td className="py-2 font-sans">useUserRole</td>
                        <td className="py-2 font-sans">get_user_role RPC</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-foreground mb-3">Cache Invalidation Strategy</h3>
                <div className="font-mono text-xs bg-muted/30 p-3 rounded">
                  <pre className="text-muted-foreground">
{`// Automatic invalidation on realtime events
supabase.channel('...').on('postgres_changes', {...}, () => {
  queryClient.invalidateQueries({ queryKey: ['liveBoard'] });
});

// Manual invalidation after mutations
const mutation = useMutation({
  mutationFn: async (data) => { /* insert/update */ },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['whisper', docketId] });
  }
});`}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 10. Edge Functions */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5 text-primary" aria-hidden="true" />
                10. Edge Functions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold text-foreground mb-3">simulate-live-board</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Serverless function for admin control of live board status. Uses service role key for elevated permissions.
                </p>
                <div className="font-mono text-xs bg-muted/30 p-3 rounded overflow-x-auto">
                  <pre className="text-muted-foreground">
{`// Endpoint: /functions/v1/simulate-live-board
// Method: POST
// Auth: Supabase anon key (public)

Request Actions:
┌─────────────────────┬──────────────────────────────────────────────┐
│ Action              │ Payload                                      │
├─────────────────────┼──────────────────────────────────────────────┤
│ increment           │ { court_location, court_no, increment: ±n } │
│ toggle_supplementary│ { court_location, court_no }                 │
│ get_status          │ { }                                          │
└─────────────────────┴──────────────────────────────────────────────┘

Response:
{
  success: boolean,
  data?: object,
  error?: string
}`}
                  </pre>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-foreground mb-3">CORS Configuration</h3>
                <div className="font-mono text-xs bg-muted/30 p-3 rounded">
                  <pre className="text-muted-foreground">
{`const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 
    'authorization, x-client-info, apikey, content-type',
};

// OPTIONS preflight handler
if (req.method === 'OPTIONS') {
  return new Response(null, { headers: corsHeaders });
}`}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 11. Design System */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" aria-hidden="true" />
                11. Design System - "Golden Gavel" Theme
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold text-foreground mb-3">Color Palette (HSL)</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="p-3 rounded border border-border flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-primary"></div>
                    <div>
                      <p className="font-mono text-xs text-foreground">--primary</p>
                      <p className="text-xs text-muted-foreground">Royal Gold: 43 96% 56%</p>
                    </div>
                  </div>
                  <div className="p-3 rounded border border-border flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-background border border-border"></div>
                    <div>
                      <p className="font-mono text-xs text-foreground">--background</p>
                      <p className="text-xs text-muted-foreground">Deep Midnight: 222 47% 9%</p>
                    </div>
                  </div>
                  <div className="p-3 rounded border border-border flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-danger"></div>
                    <div>
                      <p className="font-mono text-xs text-foreground">--danger</p>
                      <p className="text-xs text-muted-foreground">Court Red: 0 84% 60%</p>
                    </div>
                  </div>
                  <div className="p-3 rounded border border-border flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-success"></div>
                    <div>
                      <p className="font-mono text-xs text-foreground">--success</p>
                      <p className="text-xs text-muted-foreground">Court Green: 142 76% 36%</p>
                    </div>
                  </div>
                  <div className="p-3 rounded border border-border flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-warning"></div>
                    <div>
                      <p className="font-mono text-xs text-foreground">--warning</p>
                      <p className="text-xs text-muted-foreground">Court Orange: 38 92% 50%</p>
                    </div>
                  </div>
                  <div className="p-3 rounded border border-border flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-card border border-border"></div>
                    <div>
                      <p className="font-mono text-xs text-foreground">--card</p>
                      <p className="text-xs text-muted-foreground">Card Surface: 222 47% 13%</p>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-foreground mb-3">Typography</h3>
                <div className="space-y-3">
                  <div className="p-3 rounded bg-muted/30 border border-border">
                    <p className="font-display text-lg text-foreground">font-display: "Playfair Display"</p>
                    <p className="text-xs text-muted-foreground">Used for headings and titles</p>
                  </div>
                  <div className="p-3 rounded bg-muted/30 border border-border">
                    <p className="font-sans text-lg text-foreground">font-sans: "Inter"</p>
                    <p className="text-xs text-muted-foreground">Used for body text and UI elements</p>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-foreground mb-3">Custom CSS Classes</h3>
                <div className="font-mono text-xs bg-muted/30 p-3 rounded overflow-x-auto">
                  <pre className="text-muted-foreground">
{`/* Glassmorphism card effect */
.glass-card {
  background: rgba(var(--card), 0.8);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(var(--border), 0.5);
}

/* Giant number display (Live Board) */
.giant-number {
  font-size: clamp(4rem, 15vw, 9rem);
  text-shadow: 0 0 40px hsl(var(--primary) / 0.5);
}

/* Gold glow effect */
.gold-glow {
  box-shadow: 0 0 20px hsl(var(--primary) / 0.4);
}

/* Mission-critical toast */
.mission-critical-toast {
  border: 2px solid hsl(var(--primary));
  box-shadow: 0 0 20px hsl(var(--primary) / 0.4);
}`}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 12. Security Architecture */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" aria-hidden="true" />
                12. Security Architecture
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold text-foreground mb-3">Row-Level Security (RLS) Summary</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 text-foreground">Table</th>
                        <th className="text-left py-2 text-foreground">SELECT</th>
                        <th className="text-left py-2 text-foreground">INSERT</th>
                        <th className="text-left py-2 text-foreground">UPDATE</th>
                        <th className="text-left py-2 text-foreground">DELETE</th>
                      </tr>
                    </thead>
                    <tbody className="text-muted-foreground">
                      <tr className="border-b border-border/50">
                        <td className="py-2 font-mono">profiles</td>
                        <td className="py-2 text-success">Public</td>
                        <td className="py-2 text-warning">Own only</td>
                        <td className="py-2 text-warning">Own only</td>
                        <td className="py-2 text-danger">Denied</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2 font-mono">user_roles</td>
                        <td className="py-2 text-warning">Own only</td>
                        <td className="py-2 text-muted-foreground">System</td>
                        <td className="py-2 text-danger">Denied</td>
                        <td className="py-2 text-danger">Denied</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2 font-mono">daily_court_docket</td>
                        <td className="py-2 text-success">Public</td>
                        <td className="py-2 text-success">Auth</td>
                        <td className="py-2 text-success">Auth</td>
                        <td className="py-2 text-danger">Denied</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2 font-mono">live_board_cache</td>
                        <td className="py-2 text-success">Public</td>
                        <td className="py-2 text-success">Auth</td>
                        <td className="py-2 text-success">Auth</td>
                        <td className="py-2 text-danger">Denied</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2 font-mono">live_courtroom_feed</td>
                        <td className="py-2 text-success">Public</td>
                        <td className="py-2 text-success">Auth</td>
                        <td className="py-2 text-success">Auth</td>
                        <td className="py-2 text-danger">Denied</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2 font-mono">case_documents</td>
                        <td className="py-2 text-success">Public</td>
                        <td className="py-2 text-success">Auth</td>
                        <td className="py-2 text-danger">Denied</td>
                        <td className="py-2 text-danger">Denied</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2 font-mono">case_arguments</td>
                        <td className="py-2 text-success">Public</td>
                        <td className="py-2 text-success">Auth</td>
                        <td className="py-2 text-success">Auth</td>
                        <td className="py-2 text-success">Auth</td>
                      </tr>
                      <tr>
                        <td className="py-2 font-mono">document_annotations</td>
                        <td className="py-2 text-success">Public</td>
                        <td className="py-2 text-success">Auth</td>
                        <td className="py-2 text-warning">Own only</td>
                        <td className="py-2 text-warning">Own only</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 flex gap-4 text-xs">
                  <span className="text-success">● Public = Anyone</span>
                  <span className="text-warning">● Own only = auth.uid() match</span>
                  <span className="text-success">● Auth = Authenticated</span>
                  <span className="text-danger">● Denied = No policy</span>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-foreground mb-3">Security Best Practices Implemented</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-success mt-1">✓</span>
                    <span><strong>Separate Role Storage:</strong> Roles stored in user_roles table (not profiles) to prevent privilege escalation via profile updates.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-success mt-1">✓</span>
                    <span><strong>SECURITY DEFINER Functions:</strong> Role checks use SECURITY DEFINER to bypass RLS recursion and provide consistent access control.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-success mt-1">✓</span>
                    <span><strong>Client-Side Auth Guard:</strong> AuthGuard component protects routes, but server-side RLS provides true security.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-success mt-1">✓</span>
                    <span><strong>Service Role Isolation:</strong> Service role key only used in edge functions, never exposed to client.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-success mt-1">✓</span>
                    <span><strong>Email Redirect URL:</strong> Signup uses window.location.origin for emailRedirectTo to prevent open redirect attacks.</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* 13. Accessibility Implementation */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-primary" aria-hidden="true" />
                13. Accessibility Implementation (WCAG 2.1 AA)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold text-foreground mb-3">ARIA Implementation</h3>
                <div className="font-mono text-xs bg-muted/30 p-3 rounded overflow-x-auto">
                  <pre className="text-muted-foreground">
{`<!-- Live regions for status updates -->
<div aria-live="polite" aria-atomic="true">
  {statusMessage}
</div>

<!-- Urgent alerts -->
<div aria-live="assertive" role="alert">
  {panicAlert}
</div>

<!-- Interactive elements -->
<button aria-label="Send whisper message" aria-describedby="whisper-help">
  <SendIcon aria-hidden="true" />
</button>

<!-- Skip link -->
<a href="#main-content" className="skip-link">
  Skip to main content
</a>`}
                  </pre>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-foreground mb-3">Touch & Click Targets</h3>
                <div className="font-mono text-xs bg-muted/30 p-3 rounded">
                  <pre className="text-muted-foreground">
{`/* Minimum 44x44px touch targets (WCAG 2.5.5) */
.min-touch-target {
  min-width: 44px;
  min-height: 44px;
}

/* Tailwind utilities */
.min-h-touch { min-height: 44px; }
.min-w-touch { min-width: 44px; }`}
                  </pre>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-foreground mb-3">Reduced Motion Support</h3>
                <div className="font-mono text-xs bg-muted/30 p-3 rounded">
                  <pre className="text-muted-foreground">
{`@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}`}
                  </pre>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-foreground mb-3">Focus Management</h3>
                <div className="font-mono text-xs bg-muted/30 p-3 rounded">
                  <pre className="text-muted-foreground">
{`/* Visible focus indicators */
:focus-visible {
  outline: 2px solid hsl(var(--primary));
  outline-offset: 2px;
}

/* Ring utility classes */
.focus:ring-2 { --tw-ring-width: 2px; }
.ring-primary { --tw-ring-color: hsl(var(--primary)); }
.ring-offset-2 { --tw-ring-offset-width: 2px; }`}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ============================= */}
          {/* END TECHNICAL DOCUMENTATION   */}
          {/* ============================= */}

          {/* Scraper Troubleshooting & Error Documentation */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-primary" aria-hidden="true" />
                Causelist Scraper - Error Documentation & Attempted Approaches
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              <p className="text-muted-foreground">
                This section documents all the approaches attempted to scrape court causelists 
                from the Rajasthan High Court website, including the errors encountered and 
                the technical challenges that prevented successful PDF extraction.
              </p>

              {/* Current Status Summary */}
              <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                <h4 className="font-semibold text-foreground mb-3">Current Status Summary</h4>
                <div className="grid gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-green-500"></span>
                    <span className="text-foreground">Working:</span>
                    <span className="text-muted-foreground">Court metadata & judge names extraction (48 courts: 24 JAIPUR + 24 JODHPUR)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-500"></span>
                    <span className="text-foreground">Blocked:</span>
                    <span className="text-muted-foreground">PDF case data extraction (0 cases - requires session-based browser automation)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                    <span className="text-foreground">Scraper Runs:</span>
                    <span className="text-muted-foreground">102 success • 58 warning • 38 failed</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Approach 1: Direct PDF URL Fetch */}
              <div>
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <span className="px-2 py-1 rounded bg-red-500/20 text-red-400 text-xs">FAILED</span>
                  Approach 1: Direct PDF URL Fetch
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Attempted to construct and fetch PDF URLs directly from the server.
                </p>
                <div className="p-4 rounded bg-muted/30 border border-border font-mono text-xs overflow-x-auto">
                  <pre className="text-muted-foreground whitespace-pre">
{`┌──────────────────────────────────────────────────────────────────────────┐
│                    APPROACH 1: DIRECT PDF URL FETCH                       │
└──────────────────────────────────────────────────────────────────────────┘

    ┌─────────────┐
    │  Edge Func  │
    └──────┬──────┘
           │
           ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │  Constructed URL Pattern:                                           │
    │  https://hcraj.nic.in/hcraj/daily-causelist/jaipur/JAIPUR_1_D.pdf   │
    │  https://hcraj.nic.in/hcraj/Causelist_Display.php?court_id=1&...    │
    └──────────────────────────────┬──────────────────────────────────────┘
                                   │
                                   ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │  HTTP Request (fetch)                                               │
    │  Headers: User-Agent, Referer, Accept                               │
    └──────────────────────────────┬──────────────────────────────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │     ❌ ERROR RESPONSE        │
                    ├──────────────────────────────┤
                    │  Status: 200 (misleading)    │
                    │  Content: HTML "Access       │
                    │  Denied" page                │
                    │                              │
                    │  Reason: Server requires     │
                    │  valid session cookie from   │
                    │  prior page navigation       │
                    └──────────────────────────────┘

ERROR: "Access Denied" - Server blocks direct URL access without session`}
                  </pre>
                </div>
              </div>

              <Separator />

              {/* Approach 2: Base64 Path Decoding */}
              <div>
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <span className="px-2 py-1 rounded bg-red-500/20 text-red-400 text-xs">FAILED</span>
                  Approach 2: Base64 data-pdfpath Decoding
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Decoded the base64-encoded PDF paths from button data attributes.
                </p>
                <div className="p-4 rounded bg-muted/30 border border-border font-mono text-xs overflow-x-auto">
                  <pre className="text-muted-foreground whitespace-pre">
{`┌──────────────────────────────────────────────────────────────────────────┐
│                 APPROACH 2: BASE64 PATH DECODING                          │
└──────────────────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────────────────┐
    │  Step 1: Scrape Quick Download Page HTML                            │
    └──────────────────────────────┬──────────────────────────────────────┘
                                   │
                                   ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │  Step 2: Extract Button Attributes                                  │
    │                                                                     │
    │  <a class="view-button" href="javascript:void(0)"                   │
    │     data-pdfpath="base64_encoded_path_here">D</a>                   │
    │                                                                     │
    │  Found: data-pdfpath="L2NhdXNlbGlzdC9qYWlwdXIvMjAyNS8xMi8wNi8x..."  │
    └──────────────────────────────┬──────────────────────────────────────┘
                                   │
                                   ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │  Step 3: Base64 Decode                                              │
    │                                                                     │
    │  atob("L2NhdXNlbGlzdC9qYWlwdXIvMjAyNS8xMi8wNi8xX0QucGRm")          │
    │  = "/causelist/jaipur/2025/12/06/1_D.pdf"                          │
    └──────────────────────────────┬──────────────────────────────────────┘
                                   │
                                   ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │  Step 4: Construct Full URL & Fetch                                 │
    │  URL: https://hcraj.nic.in/causelist/jaipur/2025/12/06/1_D.pdf     │
    └──────────────────────────────┬──────────────────────────────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │     ❌ ERROR RESPONSE        │
                    ├──────────────────────────────┤
                    │  Same "Access Denied"        │
                    │                              │
                    │  The decoded path is valid   │
                    │  but server still requires   │
                    │  session authentication      │
                    └──────────────────────────────┘

ERROR: Session validation blocks even decoded direct paths`}
                  </pre>
                </div>
              </div>

              <Separator />

              {/* Approach 3: Firecrawl with Actions */}
              <div>
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <span className="px-2 py-1 rounded bg-red-500/20 text-red-400 text-xs">FAILED</span>
                  Approach 3: Firecrawl with Browser Actions
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Used Firecrawl's browser actions to simulate user interactions.
                </p>
                <div className="p-4 rounded bg-muted/30 border border-border font-mono text-xs overflow-x-auto">
                  <pre className="text-muted-foreground whitespace-pre">
{`┌──────────────────────────────────────────────────────────────────────────┐
│               APPROACH 3: FIRECRAWL WITH ACTIONS                          │
└──────────────────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────────────────┐
    │  Firecrawl v1 API Request                                           │
    │                                                                     │
    │  POST https://api.firecrawl.dev/v1/scrape                          │
    │  {                                                                  │
    │    url: "https://hcraj.nic.in/quick-causelist-jp",                 │
    │    formats: ["markdown", "screenshot"],                             │
    │    actions: [                                                       │
    │      { type: "wait", milliseconds: 1000 },                         │
    │      { type: "select", selector: "#day", value: "6" },             │
    │      { type: "select", selector: "#month", value: "12" },          │
    │      { type: "click", selector: "button[type=submit]" },           │
    │      { type: "wait", milliseconds: 4000 },                         │
    │      { type: "click", selector: ".view-button" }                   │
    │    ]                                                                │
    │  }                                                                  │
    └──────────────────────────────┬──────────────────────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
                    ▼                             ▼
    ┌─────────────────────────┐    ┌─────────────────────────┐
    │  ❌ ERROR 1             │    │  ❌ ERROR 2             │
    ├─────────────────────────┤    ├─────────────────────────┤
    │  "Unrecognized key      │    │  "Element not found"    │
    │   in body"              │    │                         │
    │                         │    │  Actions like "select"  │
    │  The "evaluate" action  │    │  and "evaluate" are not │
    │  is not supported in    │    │  valid Firecrawl v1     │
    │  Firecrawl v1 API       │    │  action types           │
    └─────────────────────────┘    └─────────────────────────┘
                                   
                                   │
                                   ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │  CORE LIMITATION:                                                   │
    │                                                                     │
    │  The D/S buttons use: href="javascript:void(0)"                    │
    │  They trigger client-side JS that:                                  │
    │  1. Reads data-pdfpath attribute                                   │
    │  2. Decodes Base64                                                  │
    │  3. Uses XMLHttpRequest with session cookies                        │
    │  4. Loads PDF in iframe/new tab                                     │
    │                                                                     │
    │  Firecrawl actions cannot replicate this JS execution              │
    └─────────────────────────────────────────────────────────────────────┘

ERROR: Firecrawl actions limited, cannot execute custom JS`}
                  </pre>
                </div>
              </div>

              <Separator />

              {/* Approach 4: Firecrawl with Screenshot + AI Vision */}
              <div>
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <span className="px-2 py-1 rounded bg-yellow-500/20 text-yellow-400 text-xs">PARTIAL</span>
                  Approach 4: Firecrawl Screenshot + Gemini Vision
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Attempted to take screenshots and use AI vision to extract case data.
                </p>
                <div className="p-4 rounded bg-muted/30 border border-border font-mono text-xs overflow-x-auto">
                  <pre className="text-muted-foreground whitespace-pre">
{`┌──────────────────────────────────────────────────────────────────────────┐
│            APPROACH 4: SCREENSHOT + AI VISION EXTRACTION                  │
└──────────────────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────────────────┐
    │  Step 1: Firecrawl scrape with formats: ["screenshot"]              │
    └──────────────────────────────┬──────────────────────────────────────┘
                                   │
                                   ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │  Step 2: Get base64 screenshot of page                              │
    │  ✅ Successfully captures Quick Download landing page               │
    └──────────────────────────────┬──────────────────────────────────────┘
                                   │
                                   ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │  Step 3: Send to Gemini Vision API                                  │
    │                                                                     │
    │  Prompt: "Extract all case data from this causelist image..."      │
    │  Image: base64 screenshot                                          │
    └──────────────────────────────┬──────────────────────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
                    ▼                             ▼
    ┌─────────────────────────┐    ┌─────────────────────────┐
    │  ⚠️ LIMITATION          │    │  ✅ WORKS FOR          │
    ├─────────────────────────┤    ├─────────────────────────┤
    │  Screenshot shows       │    │  Court metadata table   │
    │  landing page, NOT      │    │  • Court numbers        │
    │  the PDF content        │    │  • Judge names          │
    │                         │    │  • D/S button presence  │
    │  Cannot navigate to     │    │                         │
    │  click buttons via      │    │  Successfully extracted │
    │  screenshot alone       │    │  20 courts with judges  │
    └─────────────────────────┘    └─────────────────────────┘

PARTIAL: Extracts court metadata, but NOT PDF case data`}
                  </pre>
                </div>
              </div>

              <Separator />

              {/* Approach 5: Browserless.io */}
              <div>
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <span className="px-2 py-1 rounded bg-red-500/20 text-red-400 text-xs">FAILED</span>
                  Approach 5: Browserless.io Headless Chrome
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Attempted to use Browserless for full Puppeteer-like browser control.
                </p>
                <div className="p-4 rounded bg-muted/30 border border-border font-mono text-xs overflow-x-auto">
                  <pre className="text-muted-foreground whitespace-pre">
{`┌──────────────────────────────────────────────────────────────────────────┐
│              APPROACH 5: BROWSERLESS.IO HEADLESS CHROME                   │
└──────────────────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────────────────┐
    │  Browserless /scrape Endpoint                                       │
    │                                                                     │
    │  POST https://chrome.browserless.io/scrape                         │
    │  Authorization: Basic <BROWSERLESS_API_KEY>                        │
    │  {                                                                  │
    │    url: "https://hcraj.nic.in/quick-causelist-jp",                 │
    │    gotoOptions: { waitUntil: "networkidle0" },                     │
    │    elements: [{ selector: ".view-button", ... }],                  │
    │    evaluate: "async () => { /* click buttons, get PDF */ }"        │
    │  }                                                                  │
    └──────────────────────────────┬──────────────────────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
                    ▼                             ▼
    ┌─────────────────────────┐    ┌─────────────────────────┐
    │  ❌ ERROR 1             │    │  ❌ ERROR 2             │
    ├─────────────────────────┤    ├─────────────────────────┤
    │  "require is not        │    │  HTTP 429               │
    │   defined"              │    │  "Too Many Requests"    │
    │                         │    │                         │
    │  Browserless v2 API     │    │  Rate limiting on       │
    │  format differs from    │    │  free tier when         │
    │  older Puppeteer        │    │  processing multiple    │
    │  connect style          │    │  courts sequentially    │
    └─────────────────────────┘    └─────────────────────────┘

    ┌─────────────────────────────────────────────────────────────────────┐
    │  ADDITIONAL CHALLENGES:                                             │
    │                                                                     │
    │  1. Browserless free tier has strict rate limits                   │
    │  2. API format changed between v1 and v2                           │
    │  3. Edge function environment doesn't support require()            │
    │  4. Would need proper Puppeteer script format                      │
    └─────────────────────────────────────────────────────────────────────┘

ERROR: API format issues and rate limiting`}
                  </pre>
                </div>
              </div>

              <Separator />

              {/* Root Cause Analysis */}
              <div>
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Lock className="h-4 w-4 text-red-400" />
                  Root Cause Analysis
                </h3>
                <div className="p-4 rounded bg-muted/30 border border-border font-mono text-xs overflow-x-auto">
                  <pre className="text-muted-foreground whitespace-pre">
{`┌──────────────────────────────────────────────────────────────────────────┐
│                      ROOT CAUSE: WEBSITE ARCHITECTURE                     │
└──────────────────────────────────────────────────────────────────────────┘

    WEBSITE SECURITY LAYERS:
    ═══════════════════════

    ┌─────────────────────────────────────────────────────────────────────┐
    │  LAYER 1: Session-Based Access Control                              │
    │                                                                     │
    │  • PHP session required for all PDF access                          │
    │  • Session created on initial page load                            │
    │  • Session ID stored in cookies                                     │
    │  • All subsequent requests validated against session                │
    └─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │  LAYER 2: JavaScript-Only Navigation                                │
    │                                                                     │
    │  Button HTML: <a href="javascript:void(0)"                         │
    │                  data-pdfpath="base64_encoded_path"                │
    │                  onclick="loadPdf(this)">D</a>                     │
    │                                                                     │
    │  The loadPdf() function:                                            │
    │  1. Decodes base64 path                                            │
    │  2. Makes XHR request WITH session cookies                         │
    │  3. Receives PDF blob                                              │
    │  4. Opens in viewer/iframe                                         │
    └─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │  LAYER 3: Server-Side Validation                                    │
    │                                                                     │
    │  • Checks Referer header                                            │
    │  • Validates session cookie                                         │
    │  • Verifies request came from their domain                         │
    │  • Returns "Access Denied" HTML for invalid requests               │
    └─────────────────────────────────────────────────────────────────────┘

    WHY SCRAPING FAILS:
    ═══════════════════

    ┌────────────────────────┐
    │ Direct URL Fetch       │────► No session cookie ────► Access Denied
    └────────────────────────┘

    ┌────────────────────────┐
    │ Firecrawl Actions      │────► Cannot execute custom JS ────► No PDF
    └────────────────────────┘

    ┌────────────────────────┐
    │ API-based scraping     │────► No browser context ────► No cookies
    └────────────────────────┘

    WHAT WOULD WORK:
    ════════════════

    ┌────────────────────────┐     ┌────────────────────────┐
    │ Full Puppeteer         │────►│ Maintain browser       │────► ✅
    │ (self-hosted)          │     │ session + cookies      │
    └────────────────────────┘     └────────────────────────┘

    ┌────────────────────────┐     ┌────────────────────────┐
    │ Manual PDF Upload      │────►│ User downloads PDF,    │────► ✅
    │ Feature                │     │ uploads to system      │
    └────────────────────────┘     └────────────────────────┘`}
                  </pre>
                </div>
              </div>

              <Separator />

              {/* What's Working */}
              <div>
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <span className="px-2 py-1 rounded bg-green-500/20 text-green-400 text-xs">SUCCESS</span>
                  What's Currently Working
                </h3>
                <div className="p-4 rounded bg-muted/30 border border-border font-mono text-xs overflow-x-auto">
                  <pre className="text-muted-foreground whitespace-pre">
{`┌──────────────────────────────────────────────────────────────────────────┐
│                        SUCCESSFUL FUNCTIONALITY                           │
└──────────────────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────────────────┐
    │  ✅ COURT METADATA EXTRACTION (48 Courts Total)                     │
    │                                                                     │
    │  Source: Quick Download Page HTML Table                             │
    │  Method: Firecrawl markdown scrape + regex parsing                 │
    │                                                                     │
    │  Database Stats:                                                    │
    │  ┌───────────────────────────────────────────────────────────────┐ │
    │  │ Bench     │ Courts │ Status                                    │ │
    │  ├───────────┼────────┼───────────────────────────────────────────┤ │
    │  │ JAIPUR    │ 24     │ ✅ Metadata extracted                     │ │
    │  │ JODHPUR   │ 24     │ ✅ Metadata extracted                     │ │
    │  └───────────┴────────┴───────────────────────────────────────────┘ │
    │                                                                     │
    │  Scraper Run Statistics:                                            │
    │  ┌───────────────────────────────────────────────────────────────┐ │
    │  │ Status    │ Count │ Description                                │ │
    │  ├───────────┼───────┼────────────────────────────────────────────┤ │
    │  │ Success   │ 102   │ Full metadata extracted                    │ │
    │  │ Warning   │ 58    │ Partial data (PDF access blocked)          │ │
    │  │ Failed    │ 38    │ Rate limits / network errors               │ │
    │  └───────────┴───────┴────────────────────────────────────────────┘ │
    │                                                                     │
    │  Storage: court_metadata table in Supabase                         │
    │  Refresh: Every 30 minutes via useScrapeOnLogin hook               │
    └─────────────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────────────────┐
    │  ❌ CASE DATA EXTRACTION (0 Cases)                                  │
    │                                                                     │
    │  Status: BLOCKED - PDF access requires session authentication       │
    │  Cause: Website uses JavaScript-only navigation with cookies       │
    │  Impact: Cannot auto-populate daily_court_docket table             │
    └─────────────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────────────────┐
    │  ✅ CAUSELIST TYPE DETECTION                                        │
    │                                                                     │
    │  Detects which courts have:                                         │
    │  • [D] Daily Cause List - Regular matters                          │
    │  • [S] Supplementary List - Urgent/New matters                     │
    │                                                                     │
    │  Example: Court 4 has both D and S, Court 6 has only D             │
    └─────────────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────────────────┐
    │  ✅ AUTO-SCRAPE ON LOGIN                                            │
    │                                                                     │
    │  Trigger: User login event                                          │
    │  Interval: Every 30 minutes while logged in                        │
    │  Benches: JAIPUR and JODHPUR                                       │
    │  Hook: useScrapeOnLogin.ts                                         │
    └─────────────────────────────────────────────────────────────────────┘`}
                  </pre>
                </div>
              </div>

              <Separator />

              {/* Recommended Solutions */}
              <div>
                <h3 className="font-semibold text-foreground mb-3">Recommended Solutions</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="p-4 rounded-lg bg-card border border-border">
                    <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                      <Upload className="h-4 w-4 text-primary" />
                      Option 1: Manual PDF Upload
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Build a feature where users can manually download PDFs from the HC website 
                      and upload them to Vakalat-OS. AI vision (Gemini) extracts case data.
                    </p>
                    <div className="mt-2 text-xs text-green-400">
                      ✅ Feasible with current tech stack
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-card border border-border">
                    <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                      <Server className="h-4 w-4 text-primary" />
                      Option 2: Self-Hosted Puppeteer
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Deploy a self-hosted Puppeteer instance that can maintain browser sessions 
                      and execute JavaScript to navigate and download PDFs.
                    </p>
                    <div className="mt-2 text-xs text-yellow-400">
                      ⚠️ Requires additional infrastructure
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="text-center py-8 text-muted-foreground text-sm">
            <p>Vakalat-OS v1.0 | Rajasthan High Court Dashboard</p>
            <p className="mt-1">© {new Date().getFullYear()} All Rights Reserved</p>
          </div>
        </ScrollArea>
      </main>

      {/* Print Styles */}
      <style>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          * {
            color: black !important;
            background: white !important;
            border-color: #ccc !important;
          }
        }
      `}</style>
    </div>
  );
}
