export const documentationContent = {
    flowcharts: [
        {
            title: "1. Overall System Architecture",
            description: "High-level view of how all components interact in the Nyay-Hub ecosystem.",
            chart: `┌─────────────────────────────────────────────────────────────────────────────┐
│                               NYAY-HUB SYSTEM                                │
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
└─────────────────────────────────────────────────────────────────────────────┘`
        },
        {
            title: "2. User Authentication Flow",
            description: "Complete authentication journey from login to role-based routing.",
            chart: `┌──────────────────────────────────────────────────────────────────────────┐
│                        AUTHENTICATION FLOW                                │
└──────────────────────────────────────────────────────────────────────────┘

    ┌─────────┐
    │  USER   │
    └────┬────┘
         │
         ▼
    ┌─────────────┐     NO      ┌─────────────┐
    │ Has Account?├────────────►│ /auth       │
    │             │             │ (Sign Up)   │
    └──────┬──────┘             └──────┬──────┘
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
    └─────────────┘`
        }
    ],
    roles: [
        {
            title: "Senior Advocate (War Room View)",
            items: [
                "Access the War Room for comprehensive case preparation",
                "View case documents with argument-linked page navigation",
                "Receive real-time whisper notifications from juniors",
                "Monitor live court board status and panic alerts",
                "Review all arguments with direct PDF page links"
            ]
        },
        {
            title: "Junior Advocate (Control Deck View)",
            items: [
                "Upload evidence and case documents",
                "Send whisper messages to seniors during hearings",
                "Monitor case status and court progress",
                "Manage document organization"
            ]
        },
        {
            title: "Admin",
            items: [
                "Manage daily court docket entries",
                "Configure case arguments and page links",
                "Control live board status for all courtrooms",
                "Add, edit, and delete cases from the system"
            ]
        }
    ],
    features: [
        {
            title: "1. Live Court Board",
            text: "Real-time tracking of current item numbers across all courtrooms. The system automatically calculates distance from your case and triggers panic alerts when your case is within 5 items of being called."
        },
        {
            title: "2. Panic Alert System",
            text: "Visual and audio alerts when your case approaches. Cases pulse red when within 5 items, and glow gold when currently running. Status badges update in real-time."
        },
        {
            title: "3. War Room",
            text: "Split-screen view with arguments panel on the left and PDF viewer on the right. Click any argument to instantly jump to the relevant page in your case documents."
        },
        {
            title: "4. Whisper System",
            text: "Real-time messaging between juniors in the control deck and seniors in the courtroom. Messages appear as toast notifications without disrupting the hearing flow."
        }
    ]
};
