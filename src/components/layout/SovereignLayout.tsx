import { Sidebar } from "./Sidebar";
import { AppHeader } from "./AppHeader";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

interface SovereignLayoutProps {
    children: React.ReactNode;
}

export function SovereignLayout({ children }: SovereignLayoutProps) {
    const location = useLocation();
    const isAuthPage = location.pathname === '/auth';

    if (isAuthPage) {
        return <>{children}</>;
    }

    return (
        <div className="flex min-h-screen bg-background relative overflow-x-hidden">
            {/* Sidebar - Fixed on the left */}
            <Sidebar />

            {/* Main Content Area */}
            <div className={cn(
                "flex-1 flex flex-col min-w-0 transition-all duration-300",
                "md:ml-[80px]" // Initial offset for collapsed sidebar
            )}>
                {/* We'll handle the expanded offset dynamically in a real app, 
            but for now, a fixed offset for the sidebar is fine.
            Actually, let's make it consistent. 
        */}

                {/* The AppHeader can stay at the top for some global actions, 
            or we can merge it into the Sidebar. 
            For the "Sovereign" feel, let's keep a slim top bar for the Live Board.
        */}
                <AppHeader />

                <main className="flex-1 relative">
                    {children}
                </main>
            </div>
        </div>
    );
}
