import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Scale, User, Wifi, WifiOff } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface CourtStatusCardProps {
  bench: string;
  courtNo: string;
  currentItem?: number;
  status?: string;
}

interface CourtMetadata {
  id: string;
  bench: string;
  court_no: string;
  sitting_judges: string | null;
  last_updated: string | null;
}

export function CourtStatusCard({ bench, courtNo, currentItem, status }: CourtStatusCardProps) {
  const { data: courtMetadata, isLoading } = useQuery({
    queryKey: ['court-metadata-single', bench, courtNo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('court_metadata')
        .select('*')
        .eq('bench', bench.toUpperCase())
        .eq('court_no', courtNo)
        .maybeSingle();
      
      if (error) throw error;
      return data as CourtMetadata | null;
    },
    refetchInterval: 60000,
  });

  const formatJudgeName = (name: string | null): string => {
    if (!name) return 'Judge info pending';
    
    // Clean up common prefixes while keeping Hon'ble
    return name
      .replace(/^(THE\s+)/gi, '')
      .replace(/MR\.\s*/gi, '')
      .replace(/MS\.\s*/gi, '')
      .replace(/DR\.\s*/gi, '')
      .trim();
  };

  if (isLoading) {
    return (
      <Card className="glass-card border-border/50">
        <CardContent className="p-4">
          <Skeleton className="h-5 w-24 mb-2" />
          <Skeleton className="h-4 w-48" />
        </CardContent>
      </Card>
    );
  }

  const statusColors: Record<string, string> = {
    hearing: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    passover: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    lunch: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    adjourned: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  };

  return (
    <Card className="glass-card border-border/50 overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 text-primary">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">
                  Court No. {courtNo}
                </span>
                <Badge variant="outline" className="text-xs">
                  {bench}
                </Badge>
                {status && (
                  <Badge className={`text-xs ${statusColors[status] || ''}`}>
                    {status.toUpperCase()}
                  </Badge>
                )}
              </div>
              
              {/* Judge Name with Gold Accent */}
              <div className="flex items-center gap-1.5 mt-1">
                <User className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-sm text-amber-500 font-medium">
                  Presiding: {formatJudgeName(courtMetadata?.sitting_judges || null)}
                </span>
              </div>
            </div>
          </div>
          
          {currentItem !== undefined && (
            <div className="text-right">
              <span className="text-xs text-muted-foreground">Current Item</span>
              <div className="text-2xl font-bold text-primary">{currentItem}</div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Health check badge for onboarding
interface PortalHealthBadgeProps {
  bench: 'JAIPUR' | 'JODHPUR';
}

export function PortalHealthBadge({ bench }: PortalHealthBadgeProps) {
  const { data: health, isLoading } = useQuery({
    queryKey: ['portal-health', bench],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('health-check', {
        body: { bench }
      });
      
      if (error) throw error;
      return data as { online: boolean; latency_ms: number };
    },
    staleTime: 30000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <Badge variant="outline" className="animate-pulse">
        <Wifi className="h-3 w-3 mr-1" />
        Checking...
      </Badge>
    );
  }

  if (health?.online) {
    return (
      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
        <Wifi className="h-3 w-3 mr-1" />
        High Court Connection Active
        <span className="ml-1 text-xs opacity-70">({health.latency_ms}ms)</span>
      </Badge>
    );
  }

  return (
    <Badge variant="destructive" className="bg-rose-500/20 text-rose-400 border-rose-500/30">
      <WifiOff className="h-3 w-3 mr-1" />
      Portal Unavailable
    </Badge>
  );
}