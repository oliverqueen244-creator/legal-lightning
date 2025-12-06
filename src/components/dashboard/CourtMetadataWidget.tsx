import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Users, Scale, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';

interface CourtMetadataWidgetProps {
  bench?: string;
}

interface CourtMetadata {
  id: string;
  bench: string;
  court_no: string;
  sitting_judges: string | null;
  last_updated: string | null;
}

export function CourtMetadataWidget({ bench }: CourtMetadataWidgetProps) {
  const { data: courts, isLoading } = useQuery({
    queryKey: ['court-metadata', bench],
    queryFn: async () => {
      let query = supabase
        .from('court_metadata')
        .select('*')
        .order('court_no', { ascending: true });

      if (bench) {
        const benches = bench.split(',').map(b => b.trim().toUpperCase());
        if (benches.length === 1) {
          query = query.eq('bench', benches[0]);
        } else if (benches.length > 1) {
          query = query.in('bench', benches);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CourtMetadata[];
    },
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <Card className="glass-card border-border/50">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!courts || courts.length === 0) {
    return null;
  }

  // Group courts by bench
  const courtsByBench = courts.reduce((acc, court) => {
    if (!acc[court.bench]) acc[court.bench] = [];
    acc[court.bench].push(court);
    return acc;
  }, {} as Record<string, CourtMetadata[]>);

  const lastUpdate = courts[0]?.last_updated
    ? formatDistanceToNow(new Date(courts[0].last_updated), { addSuffix: true })
    : 'Unknown';

  return (
    <Card className="glass-card border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Scale className="h-4 w-4 text-primary" />
            Courts Active Today
          </CardTitle>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {lastUpdate}
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {Object.entries(courtsByBench).map(([benchName, benchCourts]) => (
          <div key={benchName} className="mb-3 last:mb-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs">
                {benchName}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {benchCourts.length} courts
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {benchCourts.slice(0, 6).map((court) => (
                <div
                  key={court.id}
                  className="flex items-start gap-2 p-2 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">
                    {court.court_no}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-tight">
                      {court.sitting_judges 
                        ? court.sitting_judges.replace(/^(THE JUSTICE |MR\. JUSTICE |MS\. JUSTICE |DR\. JUSTICE )/gi, '').substring(0, 60)
                        : 'Judge info pending'
                      }
                      {court.sitting_judges && court.sitting_judges.length > 60 && '...'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {benchCourts.length > 6 && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                +{benchCourts.length - 6} more courts
              </p>
            )}
          </div>
        ))}
        
        {courts.length === 0 && (
          <div className="text-center py-4 text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No court data available</p>
            <p className="text-xs">Refresh to fetch latest cause list</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
