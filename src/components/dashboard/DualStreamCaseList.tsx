/**
 * CP-4: Dual-Stream Case List Component
 * 
 * Displays cases in two distinct streams:
 * 1. "My Cases" - Personal cases owned by the user
 * 2. "Chamber Cases" - Cases handled through chambers
 * 
 * For Clerks, shows "Tracked Cases" without ownership claims.
 */

import { useState } from 'react';
import { Building2, User, Briefcase } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { DocketCard } from '@/components/dashboard/DocketCard';
import { useDualStreamDocket } from '@/hooks/useDualStreamDocket';
import { useRoleSemantics } from '@/hooks/useRoleSemantics';
import { useAuth } from '@/hooks/useAuth';
import { useLiveBoard } from '@/hooks/useLiveBoard';
import type { DocketItem, LiveBoardCache } from '@/types/database';

interface DualStreamCaseListProps {
  date?: string;
  showDate?: boolean;
}

export function DualStreamCaseList({ date, showDate }: DualStreamCaseListProps) {
  const { role } = useAuth();
  const { isClerkRole, isLawyerRole } = useRoleSemantics();
  const { personalCases, chamberCases, isLoading, error } = useDualStreamDocket(date);
  const { data: liveBoards = [] } = useLiveBoard();
  
  const [activeTab, setActiveTab] = useState<'personal' | 'chamber'>('personal');
  
  // Helper to get live board for a case
  const getLiveBoardForCase = (item: DocketItem): LiveBoardCache | undefined => {
    return liveBoards.find(
      (lb) => lb.court_no === item.court_room_no && lb.court_location === item.court_location
    );
  };
  
  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-muted rounded-lg" />
        ))}
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="text-center py-8 text-destructive">
        Failed to load cases: {error.message}
      </div>
    );
  }
  
  const hasPersonalCases = personalCases.length > 0;
  const hasChamberCases = chamberCases.length > 0;
  const hasBothStreams = hasPersonalCases && hasChamberCases;
  const hasAnyCases = hasPersonalCases || hasChamberCases;
  
  // Clerk view - single stream, no ownership language
  if (isClerkRole) {
    const allCases = [...personalCases, ...chamberCases];
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Briefcase className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Tracked Cases</h2>
          <Badge variant="secondary">{allCases.length}</Badge>
        </div>
        
        {allCases.length === 0 ? (
          <EmptyState message="No cases to track today" />
        ) : (
          <div className="space-y-3">
            {allCases.map((item) => (
              <DocketCard
                key={item.id}
                item={item}
                liveBoard={getLiveBoardForCase(item)}
                userRole={role}
                showDate={showDate}
              />
            ))}
          </div>
        )}
      </div>
    );
  }
  
  // Lawyer view - dual stream with tabs (if both streams have cases)
  if (!hasBothStreams) {
    // Single stream view (no tabs needed)
    const cases = hasPersonalCases ? personalCases : chamberCases;
    const streamLabel = hasPersonalCases ? 'My Cases' : 'Chamber Cases';
    const StreamIcon = hasPersonalCases ? User : Building2;
    
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <StreamIcon className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">{streamLabel}</h2>
          <Badge variant="secondary">{cases.length}</Badge>
        </div>
        
        {cases.length === 0 ? (
          <EmptyState message="No cases listed today" />
        ) : (
          <div className="space-y-3">
            {cases.map((item) => (
              <DocketCard
                key={item.id}
                item={item}
                liveBoard={getLiveBoardForCase(item)}
                userRole={role}
                showDate={showDate}
              />
            ))}
          </div>
        )}
      </div>
    );
  }
  
  // Dual stream view with tabs
  return (
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'personal' | 'chamber')}>
      <TabsList className="grid w-full grid-cols-2 mb-4">
        <TabsTrigger value="personal" className="flex items-center gap-2">
          <User className="h-4 w-4" />
          My Cases
          <Badge variant="outline" className="ml-1 text-xs">
            {personalCases.length}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="chamber" className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          Chamber Cases
          <Badge variant="outline" className="ml-1 text-xs">
            {chamberCases.length}
          </Badge>
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="personal" className="space-y-3">
        {personalCases.map((item) => (
          <DocketCard
            key={item.id}
            item={item}
            liveBoard={getLiveBoardForCase(item)}
            userRole={role}
            showDate={showDate}
          />
        ))}
      </TabsContent>
      
      <TabsContent value="chamber" className="space-y-3">
        {chamberCases.map((item) => (
          <ChamberCaseCard
            item={item}
            liveBoard={getLiveBoardForCase(item)}
            userRole={role}
            showDate={showDate}
          />
        ))}
      </TabsContent>
    </Tabs>
  );
}

/**
 * Chamber case card with additional chamber context
 */
function ChamberCaseCard({
  item,
  liveBoard,
  userRole,
  showDate,
}: {
  item: DocketItem;
  liveBoard?: LiveBoardCache;
  userRole: string | null;
  showDate?: boolean;
}) {
  return (
    <div className="relative">
      {/* Chamber indicator */}
      <div className="absolute -top-2 left-3 z-10">
        <Badge variant="secondary" className="text-xs flex items-center gap-1 bg-primary/10 text-primary border-primary/20">
          <Building2 className="h-3 w-3" />
          Chamber
        </Badge>
      </div>
      <DocketCard
        item={item}
        liveBoard={liveBoard}
        userRole={userRole as any}
        showDate={showDate}
      />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-12 text-muted-foreground">
      <Briefcase className="h-12 w-12 mx-auto mb-3 opacity-50" />
      <p>{message}</p>
    </div>
  );
}
