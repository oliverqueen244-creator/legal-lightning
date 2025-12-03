import { Scale, Calendar, MapPin } from 'lucide-react';
import { DocketCard } from '@/components/dashboard/DocketCard';
import { LiveTicker } from '@/components/dashboard/LiveTicker';
import { useDocket } from '@/hooks/useDocket';
import { useLiveBoard } from '@/hooks/useLiveBoard';
import { Skeleton } from '@/components/ui/skeleton';

export default function Dashboard() {
  const { data: docket, isLoading: docketLoading } = useDocket();
  const { data: liveBoards, isLoading: liveBoardLoading } = useLiveBoard();

  const supplementaryItems = docket?.filter((item) => item.list_type === 'SUPPLEMENTARY') ?? [];
  const dailyItems = docket?.filter((item) => item.list_type === 'DAILY') ?? [];

  const getLiveBoardForItem = (item: { court_location: string; court_room_no: string }) => {
    return liveBoards?.find(
      (board) => board.court_location === item.court_location && board.court_no === item.court_room_no
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Scale className="h-8 w-8 text-primary" />
              <div>
                <h1 className="font-display text-2xl font-bold text-foreground">
                  Vakalat-OS
                </h1>
                <p className="text-sm text-muted-foreground">
                  Rajasthan High Court Dashboard
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {new Date().toLocaleDateString('en-IN', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                Jodhpur Bench
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Cause List */}
          <div className="lg:col-span-2 space-y-6">
            {/* Supplementary List */}
            {supplementaryItems.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-3 w-3 rounded-full bg-orange-500 animate-pulse" />
                  <h2 className="font-display text-xl font-semibold text-orange-400">
                    Supplementary List
                  </h2>
                </div>
                <div className="space-y-3">
                  {supplementaryItems.map((item) => (
                    <DocketCard
                      key={item.id}
                      item={item}
                      liveBoard={getLiveBoardForItem(item)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Daily List */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-3 w-3 rounded-full bg-primary" />
                <h2 className="font-display text-xl font-semibold text-foreground">
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
                <div className="text-center py-12 text-muted-foreground">
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
                    />
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Right: Live Ticker */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              {liveBoardLoading ? (
                <Skeleton className="h-64 w-full rounded-lg" />
              ) : (
                <LiveTicker liveBoards={liveBoards ?? []} />
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
