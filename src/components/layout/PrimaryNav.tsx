import { NavLink, useLocation } from 'react-router-dom';
import { Scale, Calendar, FileText, MessageCircle, Gavel, Briefcase } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useDocket } from '@/hooks/useDocket';
import { format } from 'date-fns';

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  isActive?: boolean;
}

function NavItem({ to, icon, label, badge, isActive }: NavItemProps) {
  return (
    <NavLink
      to={to}
      className={cn(
        'flex flex-col items-center gap-1 px-4 py-3 rounded-lg transition-colors min-h-touch min-w-touch',
        'hover:bg-primary/10',
        isActive && 'bg-primary/15 text-primary'
      )}
    >
      <div className="relative">
        {icon}
        {badge !== undefined && badge > 0 && (
          <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-medium">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </div>
      <span className="text-xs font-medium">{label}</span>
    </NavLink>
  );
}

/**
 * Sacred Primary Navigation - Contains ONLY court-day critical surfaces
 * DO NOT add Settings, History, Billing, AI config, Admin tools here
 */
export function PrimaryNav() {
  const location = useLocation();
  const { role } = useAuth();
  const formattedDate = format(new Date(), 'yyyy-MM-dd');
  const { data: docket } = useDocket(formattedDate);

  // Calculate today's case count
  const todayCaseCount = docket?.length ?? 0;

  // Check if Court Mode is active (would come from useCourtroomSnapshot or similar)
  const isInCourtMode = location.pathname === '/courtroom';

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-50 md:relative md:bottom-auto glass-card border-t md:border-t-0 md:border-b border-border"
      role="navigation"
      aria-label="Primary navigation"
    >
      <div className="container mx-auto px-2 md:px-4">
        <div className="flex items-center justify-around md:justify-start md:gap-2 py-1 md:py-2">
          {/* Today - Primary landing for Seniors */}
          <NavItem
            to="/"
            icon={<Calendar className="h-5 w-5" />}
            label="Today"
            badge={todayCaseCount}
            isActive={isActive('/')}
          />

          {/* Cases - Case list and search */}
          <NavItem
            to="/?tab=search"
            icon={<Briefcase className="h-5 w-5" />}
            label="Cases"
            isActive={location.search.includes('tab=search')}
          />

          {/* Messages/Whispers - Communication hub */}
          <NavItem
            to="/?tab=messages"
            icon={<MessageCircle className="h-5 w-5" />}
            label="Messages"
            isActive={location.search.includes('tab=messages')}
          />

          {/* Court Mode - Only visible when enabled or active */}
          <NavItem
            to="/courtroom"
            icon={<Gavel className={cn('h-5 w-5', isInCourtMode && 'text-primary')} />}
            label="Court"
            isActive={isInCourtMode}
          />
        </div>
      </div>
    </nav>
  );
}
