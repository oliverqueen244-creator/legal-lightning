export interface DossierSection {
    id: string;
    title: string;
    icon: string;
    content: string | any;
}

export const dossierData = {
    metadata: {
        title: "NYAY-HUB",
        subtitle: "Technical Dossier",
        caption: "Complete Technical & Workflow Documentation",
    },
    toc: [
        {
            title: "Part I: Technical Architecture",
            items: [
                "System Architecture Overview",
                "Database Schema & Relationships",
                "Edge Functions Reference",
                "Authentication & Authorization",
                "Real-time Systems",
                "Automation & ML Integration",
                "Security Architecture"
            ]
        },
        {
            title: "Part II: Workflows & Processes",
            start: 8,
            items: [
                "User Onboarding Flow",
                "Cause List Ingestion Pipeline",
                "Case Matching Algorithm",
                "Live Board Monitoring",
                "Notification & Escalation",
                "Chamber Management",
                "Offline-First Architecture",
                "PWA Update Strategy",
                "Court Focus Mode",
                "Indian Kanoon Integration",
                "Sync Conflict Resolution",
                "Network Status Monitoring",
                "Hearing Likelihood Derivation",
                "Confidence Scoring Engine",
                "Parser Fallback System",
                "Error Reporting System",
                "HTML Cause List Parsing",
                "Codebase Statistics"
            ]
        }
    ],
    architecture: {
        frontend: [
            { name: "React 18", desc: "UI framework with concurrent features" },
            { name: "TypeScript", desc: "Type-safe development" },
            { name: "Vite", desc: "Build tool with HMR" },
            { name: "TailwindCSS", desc: "Utility-first styling" },
            { name: "Shadcn/UI", desc: "Component library" },
            { name: "TanStack Query", desc: "Server state management" },
            { name: "React Router v6", desc: "Client-side routing" },
            { name: "Framer Motion", desc: "Animations" }
        ],
        backend: [
            { name: "PostgreSQL", desc: "Primary database" },
            { name: "PostgREST", desc: "Auto-generated REST API" },
            { name: "Supabase Auth", desc: "JWT-based authentication" },
            { name: "Supabase Storage", desc: "File storage (PDFs)" },
            { name: "Supabase Realtime", desc: "WebSocket subscriptions" },
            { name: "Edge Functions", desc: "Deno-based serverless" },
            { name: "Row Level Security", desc: "Data isolation" }
        ]
    },
    tables: [
        { name: "profiles", purpose: "User profile data", fields: "id, full_name, bench, whatsapp_number", rls: "✅ User-scoped" },
        { name: "user_roles", purpose: "Role assignment (RBAC)", fields: "user_id, role (enum)", rls: "✅ User-scoped" },
        { name: "lawyer_aliases", purpose: "Name variations for matching", fields: "profile_id, alias_name, is_primary", rls: "✅ User-scoped" },
        { name: "daily_court_docket", purpose: "Parsed case entries", fields: "date, case_number, matched_profile_id", rls: "✅ Profile-matched" },
        { name: "case_documents", purpose: "Uploaded case files", fields: "docket_id, file_url, document_type", rls: "✅ Docket-linked" },
        { name: "live_board_cache", purpose: "Real-time court status", fields: "court_no, current_item, status", rls: "🌐 Public read" },
        { name: "ai_jobs", purpose: "Automation task queue", fields: "job_type, status, payload, result", rls: "⚙️ Service role" }
    ]
};
