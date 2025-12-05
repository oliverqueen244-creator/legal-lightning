import { DocketCard } from '@/components/dashboard/DocketCard';
import { LiveTicker } from '@/components/dashboard/LiveTicker';
import { LiveCourtWidget } from '@/components/dashboard/LiveCourtWidget';
import { Header } from '@/components/layout/Header';
import { AuthGuard } from '@/components/layout/AuthGuard';
import { useDocket } from '@/hooks/useDocket';
import { useLiveBoard } from '@/hooks/useLiveBoard';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { Scale } from 'lucide-react';
import { LiveBoardSimulator } from '@/components/dashboard/LiveBoardSimulator';

export default function Dashboard() {
  const { data: docket, isLoading: docketLoading } = useDocket();
  const { data: liveBoards, isLoading: liveBoardLoading } = useLiveBoard();
  const { role } = useAuth();

  const supplementaryItems = docket?.filter((item) => item.list_type === 'SUPPLEMENTARY') ?? [];
  const dailyItems = docket?.filter((item) => item.list_type === 'DAILY') ?? [];

  const getLiveBoardForItem = (item: { court_location: string; court_room_no: string }) => {
    return liveBoards?.find(
      (board) => board.court_location === item.court_location && board.court_no === item.court_room_no
    );
  };

  // Get first case's live board for the widget
  const firstCase = dailyItems[0] || supplementaryItems[0];
  const primaryLiveBoard = firstCase ? getLiveBoardForItem(firstCase) : liveBoards?.[0];

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Header />

        {/* Main Content */}
        <main className="container mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Cause List */}
            <div className="lg:col-span-2 space-y-6">
              {/* Supplementary List */}
              {supplementaryItems.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-3 w-3 rounded-full bg-court-warning animate-pulse" />
                    <h2 className="font-display text-xl font-semibold text-court-warning tracking-wide">
                      Supplementary List
                    </h2>
                  </div>
                  <div className="space-y-3">
                    {supplementaryItems.map((item) => (
                      <DocketCard
                        key={item.id}
                        item={item}
                        liveBoard={getLiveBoardForItem(item)}
                        userRole={role}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Daily List */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-3 w-3 rounded-full bg-primary" />
                  <h2 className="font-display text-xl font-semibold text-foreground tracking-wide">
                    My Cause List
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
                    <p>No cases on today's list</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dailyItems.map((item) => (
                      <DocketCard
                        key={item.id}
                        item={item}
                        liveBoard={getLiveBoardForItem(item)}
                        userRole={role}
                      />
                    ))}
                  </div>
                )}
              </section>
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
                  />
                ) : null}

                {/* Live Ticker */}
                {liveBoardLoading ? (
                  <Skeleton className="h-64 w-full rounded-lg" />
                ) : (
                  <LiveTicker liveBoards={liveBoards ?? []} />
                )}
                
                {/* Live Board Simulator for testing */}
                <LiveBoardSimulator liveBoards={liveBoards ?? []} />
              </div>
            </div>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}