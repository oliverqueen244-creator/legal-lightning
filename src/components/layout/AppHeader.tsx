import { useState, useRef } from 'react';
import { Calendar } from 'lucide-react';
import { NetworkStatusPill } from './NetworkStatusPill';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { CourtModeBadge } from '@/components/court-mode/CourtModeBadge';
import { PersistentLiveBoard } from './PersistentLiveBoard';
import { UserMenu } from './UserMenu';
import { OperationsConsole } from '@/components/admin/OperationsConsole';
import { useLiveBoard } from '@/hooks/useLiveBoard';
import { useDocket } from '@/hooks/useDocket';
import { format } from 'date-fns';
import logoImage from '@/assets/logo.png';

/**
 * App Header - Calm, authoritative, predictable
 * Contains: Logo, Persistent Live Board, Court Mode, Notifications, User Menu
 * NO exploration-first elements - reaction-first only
 */
export function AppHeader() {
  const formattedDate = format(new Date(), 'yyyy-MM-dd');
  const { data: liveBoards } = useLiveBoard();
  const { data: docket } = useDocket(formattedDate);

  // Hidden console state - requires 7 rapid clicks on logo
  const [showOperationsConsole, setShowOperationsConsole] = useState(false);
  const clickCountRef = useRef(0);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleLogoClick = () => {
    clickCountRef.current += 1;

    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }
    clickTimeoutRef.current = setTimeout(() => {
      clickCountRef.current = 0;
    }, 2000);

    if (clickCountRef.current >= 7) {
      clickCountRef.current = 0;
      setShowOperationsConsole(true);
    }
  };

  return (
    <header 
      className="border-b border-border glass-card rounded-none sticky top-0 z-40" 
      role="banner"
    >
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo & Brand */}
          <div
            className="flex items-center gap-3 cursor-pointer select-none"
            onClick={handleLogoClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleLogoClick();
            }}
          >
            <img src={logoImage} alt="Nyay-Hub Logo" className="h-8 w-8" />
            <div className="hidden sm:block">
              <h1 className="font-display text-xl font-bold text-foreground tracking-wide">
                Nyay-Hub
              </h1>
              <p className="text-xs text-muted-foreground">
                Rajasthan High Court
              </p>
            </div>
          </div>

          {/* Center: Persistent Live Board Status - ALWAYS VISIBLE */}
          <div className="hidden md:block flex-1 max-w-md mx-4">
            <PersistentLiveBoard />
          </div>

          {/* Right: Critical Actions - One-Tap Rule */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Court Mode Badge - Always visible */}
            <CourtModeBadge />

            {/* Network Status */}
            <NetworkStatusPill />

            {/* Notification Bell - Critical alerts */}
            <NotificationBell
              liveBoards={liveBoards ?? []}
              userCases={docket ?? []}
            />

            {/* Today's Date - Context */}
            <div className="hidden lg:flex items-center gap-1.5 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" aria-hidden="true" />
              <time dateTime={new Date().toISOString().split('T')[0]}>
                {new Date().toLocaleDateString('en-IN', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })}
              </time>
            </div>

            {/* User Menu - All non-urgent actions */}
            <UserMenu />
          </div>
        </div>

        {/* Mobile: Persistent Live Board below header */}
        <div className="md:hidden mt-3">
          <PersistentLiveBoard />
        </div>
      </div>

      {/* Hidden Operations Console */}
      <OperationsConsole
        isOpen={showOperationsConsole}
        onClose={() => setShowOperationsConsole(false)}
      />
    </header>
  );
}
