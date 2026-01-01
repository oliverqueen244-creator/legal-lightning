import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { DocketCard } from '@/components/dashboard/DocketCard';
import { LiveTicker } from '@/components/dashboard/LiveTicker';
import { LiveCourtWidget } from '@/components/dashboard/LiveCourtWidget';
import { CaseTimeEstimator } from '@/components/dashboard/CaseTimeEstimator';
import { LawyerSearchPanel } from '@/components/dashboard/LawyerSearchPanel';
import { ScraperStatusWidget } from '@/components/dashboard/ScraperStatusWidget';
import { CourtMetadataWidget } from '@/components/dashboard/CourtMetadataWidget';
import { CauseListNotesWidget } from '@/components/dashboard/CauseListNotesWidget';
import { DateSelector } from '@/components/dashboard/DateSelector';
import { AppHeader } from '@/components/layout/AppHeader';
import { AuthGuard } from '@/components/layout/AuthGuard';
import { MorningBriefPanel } from '@/components/morning-brief/MorningBriefPanel';
import { PostCourtCapturePanel } from '@/components/post-court/PostCourtCapturePanel';
import { useDocket } from '@/hooks/useDocket';
import { useLiveBoard } from '@/hooks/useLiveBoard';
import { useAuth } from '@/hooks/useAuth';
import { useMorningBrief } from '@/hooks/useMorningBrief';
import { usePendingCaptures } from '@/hooks/usePostCourtCapture';
import { useUpcomingCases } from '@/hooks/useUpcomingCases';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Scale, AlertCircle, Search, Sun, Gavel, Calendar, CheckCircle, Upload, MessageCircle, ClipboardList } from 'lucide-react';
import { LiveBoardSimulator } from '@/components/dashboard/LiveBoardSimulator';

export default function Dashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  // Role-based default tab: SENIOR -> brief (Today View), JUNIOR -> tasks (Assigned Work)
  const { role, profile, isAdmin } = useAuth();
  const defaultTab = role === 'JUNIOR' ? 'tasks' : 'brief';
  const tabFromUrl = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabFromUrl || defaultTab);

  // Sync tab with URL
  useEffect(() => {
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };
  
  // Format date for API calls - must be before useDocket
  const formattedDate = format(selectedDate, 'yyyy-MM-dd');
  
  const { data: docket, isLoading: docketLoading, refetch } = useDocket(formattedDate);
  const { data: liveBoards, isLoading: liveBoardLoading } = useLiveBoard();
  const { data: morningBrief, isLoading: briefLoading, refetch: refetchBrief } = useMorningBrief();
  const { data: pendingCaptures } = usePendingCaptures();
  const { data: upcomingCases, isLoading: upcomingLoading } = useUpcomingCases();

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

  // Filter upcoming cases by user's selected bench(es)
  const filteredUpcoming = upcomingCases?.filter((item) => {
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

  // Check if user is a Junior (for showing assigned work view)
  const isJunior = role === 'JUNIOR';
  const isSenior = role === 'SENIOR' || role === 'ADMIN';

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background pb-20 md:pb-0">
        <AppHeader />

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
              
              <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                <TabsList className={`grid w-full gap-1 mb-4 h-auto p-1.5 ${isJunior ? 'grid-cols-5' : 'grid-cols-5'}`}>
                  {/* Junior-First: Assigned Work Tab */}
                  {isJunior && (
                    <TabsTrigger value="tasks" className="flex items-center gap-1.5 px-2 py-2 text-xs sm:text-sm">
                      <ClipboardList className="h-3 w-3 shrink-0" />
                      <span className="hidden xs:inline">Tasks</span>
                    </TabsTrigger>
                  )}
                  
                  {/* Senior-First: Morning Brief */}
                  <TabsTrigger value="brief" className="flex items-center gap-1.5 px-2 py-2 text-xs sm:text-sm">
                    <Sun className="h-3 w-3 shrink-0" />
                    <span className="hidden xs:inline">{isSenior ? 'Today' : 'Brief'}</span>
                    {morningBrief && morningBrief.summary.high_risk_count > 0 && (
                      <span className="h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-medium">
                        {morningBrief.summary.high_risk_count}
                      </span>
                    )}
                  </TabsTrigger>
                  
                  <TabsTrigger value="daily" className="flex items-center gap-1.5 px-2 py-2 text-xs sm:text-sm">
                    <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                    <span className="hidden xs:inline">Cases</span>
                    <span className="text-muted-foreground text-[10px]">
                      {dailyItems.length}
                    </span>
                  </TabsTrigger>
                  
                  <TabsTrigger value="supplementary" className="flex items-center gap-1.5 px-2 py-2 text-xs sm:text-sm">
                    <div className="h-2 w-2 rounded-full bg-court-warning shrink-0" />
                    <span className="hidden xs:inline">Urgent</span>
                    {supplementaryItems.length > 0 && (
                      <span className="h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-medium">
                        {supplementaryItems.length}
                      </span>
                    )}
                  </TabsTrigger>
                  
                  {!isJunior && (
                    <TabsTrigger value="upcoming" className="flex items-center gap-1.5 px-2 py-2 text-xs sm:text-sm">
                      <Calendar className="h-3 w-3 shrink-0" />
                      <span className="hidden xs:inline">Later</span>
                    </TabsTrigger>
                  )}
                  
                  <TabsTrigger value="search" className="flex items-center gap-1.5 px-2 py-2 text-xs sm:text-sm">
                    <Search className="h-3 w-3 shrink-0" />
                    <span className="hidden xs:inline">Find</span>
                  </TabsTrigger>
                </TabsList>

                {/* Junior: Assigned Work Tab - Action-First View */}
                {/* AUDIT FIX: Removed non-functional quick action buttons from header */}
                {/* Navigation to control-deck provides access to functional upload/whisper */}
                {isJunior && (
                  <TabsContent value="tasks" className="mt-0 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="font-display text-lg font-semibold text-foreground tracking-wide">
                          Your Assigned Work
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          Click on a case to upload documents or send notes
                        </p>
                      </div>
                    </div>
                    
                    {/* Today's Cases as Tasks */}
                    <div className="space-y-3">
                      {docketLoading ? (
                        <div className="space-y-3">
                          {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-24 w-full rounded-lg" />
                          ))}
                        </div>
                      ) : dailyItems.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground glass-card rounded-lg">
                          <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No assigned tasks today</p>
                          <p className="text-xs mt-2">Check with your senior for new assignments</p>
                        </div>
                      ) : (
                        dailyItems.map((item) => (
                          <div 
                            key={item.id}
                            className="glass-card p-4 rounded-lg space-y-2 cursor-pointer hover:bg-secondary/50 transition-colors"
                            onClick={() => navigate(`/control-deck/${item.id}`)}
                          >
                            <div className="flex items-center justify-between">
                              <Badge variant="outline" className="text-xs">
                                Item #{item.item_no}
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                Court {item.court_room_no}
                              </Badge>
                            </div>
                            <h3 className="font-medium text-foreground">
                              {item.case_number}
                            </h3>
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {item.petitioner} vs {item.respondent}
                            </p>
                            <p className="text-xs text-primary mt-2">
                              Tap to view case details →
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </TabsContent>
                )}

                {/* Morning Brief Tab - SENIOR's Today View */}
                <TabsContent value="brief" className="mt-0">
                  {isSenior && (
                    <div className="mb-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">Today's Overview:</span> {dailyItems.length} cases scheduled, {supplementaryItems.length} supplementary
                      </p>
                    </div>
                  )}
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
                    <div className="h-3 w-3 rounded-full bg-court-warning" />
                    <h2 className="font-display text-lg font-semibold text-court-warning tracking-wide">
                      Supplementary List
                    </h2>
                    {supplementaryItems.length > 0 && (
                      <Badge variant="supplementary" className="ml-2">
                        URGENT
                      </Badge>
                    )}
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

                <TabsContent value="upcoming" className="space-y-3 mt-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    <h2 className="font-display text-lg font-semibold text-foreground tracking-wide">
                      Upcoming Cases
                    </h2>
                    <span className="text-muted-foreground text-sm">
                      ({filteredUpcoming.length} matters)
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">
                    📅 Cases scheduled for future dates from published causelists
                  </p>
                  
                  {upcomingLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-28 w-full rounded-lg" />
                      ))}
                    </div>
                  ) : filteredUpcoming.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground glass-card rounded-lg">
                      <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No upcoming cases found</p>
                      <p className="text-xs mt-2">Cases will appear here when causelists for future dates are published</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredUpcoming.map((item) => (
                        <DocketCard
                          key={item.id}
                          item={item}
                          liveBoard={undefined}
                          userRole={role}
                          onForceActive={handleForceActive}
                          showDate={true}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="search" className="mt-0">
                  <LawyerSearchPanel selectedDate={formattedDate} />
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
                
                {/* Cause List Notes - Registry announcements */}
                <CauseListNotesWidget 
                  date={formattedDate} 
                  bench={profile?.bench || undefined} 
                />
                
                {/* Court Metadata Widget - Shows active courts */}
                <CourtMetadataWidget bench={profile?.bench || undefined} />
                
                {/* Live Board Simulator - Admin Only */}
                {isAdmin && <LiveBoardSimulator liveBoards={filteredLiveBoards} />}
              </div>
            </div>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
