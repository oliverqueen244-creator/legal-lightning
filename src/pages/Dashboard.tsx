import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { DocketCard } from '@/components/dashboard/DocketCard';
import { LiveTicker } from '@/components/dashboard/LiveTicker';
import { LiveCourtWidget } from '@/components/dashboard/LiveCourtWidget';
import { CaseTimeEstimator } from '@/components/dashboard/CaseTimeEstimator';
import { LawyerSearchPanel } from '@/components/dashboard/LawyerSearchPanel';
import { ScraperStatusWidget } from '@/components/dashboard/ScraperStatusWidget';
import { CourtMetadataWidget } from '@/components/dashboard/CourtMetadataWidget';
import { DateSelector } from '@/components/dashboard/DateSelector';
import { Header } from '@/components/layout/Header';
import { AuthGuard } from '@/components/layout/AuthGuard';
import { MorningBriefPanel } from '@/components/morning-brief/MorningBriefPanel';
import { PostCourtCapturePanel } from '@/components/post-court/PostCourtCapturePanel';
import { useDocket } from '@/hooks/useDocket';
import { useLiveBoard } from '@/hooks/useLiveBoard';
import { useAuth } from '@/hooks/useAuth';
import { useMorningBrief } from '@/hooks/useMorningBrief';
import { usePendingCaptures } from '@/hooks/usePostCourtCapture';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Scale, AlertCircle, Search, Sun, Gavel } from 'lucide-react';
import { LiveBoardSimulator } from '@/components/dashboard/LiveBoardSimulator';

export default function Dashboard() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const { data: docket, isLoading: docketLoading, refetch } = useDocket();
  const { data: liveBoards, isLoading: liveBoardLoading } = useLiveBoard();
  const { role, profile } = useAuth();
  const { data: morningBrief, isLoading: briefLoading, refetch: refetchBrief } = useMorningBrief();
  const { data: pendingCaptures } = usePendingCaptures();
  const [activeTab, setActiveTab] = useState('brief');
  
  // Format date for API calls
  const formattedDate = format(selectedDate, 'yyyy-MM-dd');

  // Get user's selected benches (could be "JAIPUR", "JODHPUR", or "JAIPUR,JODHPUR")
  const userBenches = profile?.bench?.split(',').map(b => b.trim().toUpperCase()) ?? [];

  // Filter live boards by user's selected bench(es)
  const filteredLiveBoards = liveBoards?.filter((board) => {
    if (userBenches.length === 0) return true; // Show all if no bench selected
    return userBenches.some(bench => 
      board.court_location?.toUpperCase().includes(bench)
    );
  }) ?? [];

  // Filter docket items by user's selected bench(es)
  const filteredDocket = docket?.filter((item) => {
    if (userBenches.length === 0) return true;
    return userBenches.some(bench => 
      item.court_location?.toUpperCase().includes(bench)
    );
  }) ?? [];

  const supplementaryItems = filteredDocket.filter((item) => item.list_type === 'SUPPLEMENTARY');
  const dailyItems = filteredDocket.filter((item) => item.list_type === 'DAILY');

  const getLiveBoardForItem = (item: { court_location: string; court_room_no: string }) => {
    return filteredLiveBoards.find(
      (board) => board.court_location === item.court_location && board.court_no === item.court_room_no
    );
  };

  // Get first case's live board for the widget based on active tab
  const activeItems = activeTab === 'supplementary' ? supplementaryItems : dailyItems;
  const firstCase = activeItems[0] || (activeTab === 'supplementary' ? dailyItems[0] : supplementaryItems[0]);
  const primaryLiveBoard = firstCase ? getLiveBoardForItem(firstCase) : filteredLiveBoards[0];

  // Handle Force Active callback to refetch data
  const handleForceActive = () => {
    refetch();
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Header />

        {/* Post-Court Capture - shows after court hours for pending cases */}
        {pendingCaptures && pendingCaptures.length > 0 && (
          <div className="container mx-auto px-4 pt-4">
            <PostCourtCapturePanel />
          </div>
        )}

        {/* Main Content */}
        <main className="container mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Cause List with Tabs */}
            <div className="lg:col-span-2 space-y-4">
              {/* Quick Actions Bar */}
              <div className="flex flex-wrap items-center gap-3">
                <DateSelector 
                  selectedDate={selectedDate}
                  onDateChange={setSelectedDate}
                />
                <ScraperStatusWidget 
                  bench={profile?.bench || undefined} 
                  selectedDate={formattedDate}
                  onRefreshComplete={refetch}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/courtroom')}
                  className="ml-auto flex items-center gap-2"
                >
                  <Gavel className="h-4 w-4" />
                  Court Mode
                </Button>
              </div>
              
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-4 mb-4">
                  <TabsTrigger value="brief" className="flex items-center gap-2">
                    <Sun className="h-3 w-3" />
                    Today
                    {morningBrief && morningBrief.summary.high_risk_count > 0 && (
                      <Badge variant="danger" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                        {morningBrief.summary.high_risk_count}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="daily" className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    Daily
                    <Badge variant="secondary" className="ml-1">
                      {dailyItems.length}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="supplementary" className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-court-warning animate-pulse" />
                    Urgent
                    {supplementaryItems.length > 0 && (
                      <Badge variant="danger" className="ml-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {supplementaryItems.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="search" className="flex items-center gap-2">
                    <Search className="h-3 w-3" />
                    Find
                  </TabsTrigger>
                </TabsList>

                {/* Morning Brief Tab */}
                <TabsContent value="brief" className="mt-0">
                  <MorningBriefPanel
                    brief={morningBrief}
                    isLoading={briefLoading}
                    onRefresh={refetchBrief}
                  />
                </TabsContent>

                <TabsContent value="daily" className="space-y-3 mt-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="font-display text-lg font-semibold text-foreground tracking-wide">
                      My Daily Cause List
                    </h2>
                    <span className="text-muted-foreground text-sm">
                      ({dailyItems.length} matters)
                    </span>
                  </div>
                  
                  {docketLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-28 w-full rounded-lg" />
                      ))}
                    </div>
                  ) : dailyItems.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground glass-card rounded-lg">
                      <Scale className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No cases on today's daily list</p>
                      <p className="text-xs mt-2">Check the Supplementary tab for urgent additions</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {dailyItems.map((item) => (
                        <DocketCard
                          key={item.id}
                          item={item}
                          liveBoard={getLiveBoardForItem(item)}
                          userRole={role}
                          onForceActive={handleForceActive}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="supplementary" className="space-y-3 mt-0">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-3 w-3 rounded-full bg-court-warning animate-pulse" />
                    <h2 className="font-display text-lg font-semibold text-court-warning tracking-wide">
                      Supplementary List
                    </h2>
                    <Badge variant="supplementary" className="ml-2">
                      🔴 URGENT
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">
                    ⚡ Supplementary lists move faster! Panic alerts trigger at 10 items away.
                  </p>
                  
                  {docketLoading ? (
                    <div className="space-y-3">
                      {[1, 2].map((i) => (
                        <Skeleton key={i} className="h-28 w-full rounded-lg" />
                      ))}
                    </div>
                  ) : supplementaryItems.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground glass-card rounded-lg">
                      <Scale className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No supplementary cases today</p>
                      <p className="text-xs mt-2">Supplementary lists are published around 9:30 AM</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {supplementaryItems.map((item) => (
                        <DocketCard
                          key={item.id}
                          item={item}
                          liveBoard={getLiveBoardForItem(item)}
                          userRole={role}
                          onForceActive={handleForceActive}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="search" className="mt-0">
                  <LawyerSearchPanel />
                </TabsContent>
              </Tabs>
            </div>

            {/* Right: Live Court Widget & Ticker */}
            <div className="lg:col-span-1 space-y-6">
              <div className="sticky top-24 space-y-6">
                {/* Live Court Widget - Giant Status Display */}
                {liveBoardLoading ? (
                  <Skeleton className="h-80 w-full rounded-lg" />
                ) : primaryLiveBoard ? (
                  <LiveCourtWidget
                    courtRoom={primaryLiveBoard.court_no}
                    currentItem={primaryLiveBoard.current_item}
                    myItemNumber={firstCase?.item_no}
                    status={primaryLiveBoard.status || 'hearing'}
                    courtLocation={primaryLiveBoard.court_location}
                    liveBoard={primaryLiveBoard}
                    isSupplementary={activeTab === 'supplementary' || firstCase?.list_type === 'SUPPLEMENTARY'}
                  />
                ) : null}

                {/* Case Time Estimator - Shows estimated wait time for next case */}
                {firstCase && primaryLiveBoard && (
                  <CaseTimeEstimator 
                    docketItem={firstCase} 
                    liveBoard={primaryLiveBoard}
                  />
                )}

                {/* Live Ticker */}
                {liveBoardLoading ? (
                  <Skeleton className="h-64 w-full rounded-lg" />
                ) : (
                  <LiveTicker liveBoards={filteredLiveBoards} />
                )}
                
                {/* Court Metadata Widget - Shows active courts */}
                <CourtMetadataWidget bench={profile?.bench || undefined} />
                
                {/* Live Board Simulator for testing */}
                <LiveBoardSimulator liveBoards={filteredLiveBoards} />
              </div>
            </div>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
