import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar } from 'lucide-react';
import { NetworkStatusPill } from './NetworkStatusPill';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { CourtModeBadge } from '@/components/court-mode/CourtModeBadge';
import { PersistentLiveBoard } from './PersistentLiveBoard';
import { UserMenu } from './UserMenu';
import { LanguageToggle } from './LanguageToggle';
import { OperationsConsole } from '@/components/admin/OperationsConsole';
import { DelegationBadge } from '@/components/delegation';
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
  const { t } = useTranslation();
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
      className="border-b border-border bg-background/50 backdrop-blur-xl sticky top-0 z-40 h-16 flex items-center"
      role="banner"
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Section Context / Breadcrumbs */}
          <div className="hidden lg:flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Workspace</span>
            <span className="text-muted-foreground/50">/</span>
            <span className="font-medium text-foreground">Rajasthan High Court</span>
          </div>

          {/* Center: Persistent Live Board Status - Primary Focus */}
          <div className="flex-1 max-w-xl">
            <PersistentLiveBoard />
          </div>

          {/* Right: Status Pills & User Menu */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-3 pr-3 border-r border-border/50">
              <LanguageToggle />
              <NetworkStatusPill />
              <NotificationBell
                liveBoards={liveBoards ?? []}
                userCases={docket ?? []}
              />
            </div>

            <UserMenu />
          </div>
        </div>
      </div>


      {/* Mobile: Persistent Live Board below header */}
      <div className="md:hidden mt-3">
        <PersistentLiveBoard />
      </div>

      {/* Hidden Operations Console */}
      <OperationsConsole
        isOpen={showOperationsConsole}
        onClose={() => setShowOperationsConsole(false)}
      />
    </header>
  );
}
