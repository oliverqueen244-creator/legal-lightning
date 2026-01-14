import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertTriangle, ChevronDown, Video, Copy, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface VCFallbackData {
  court_location: string;
  court_room_no: string;
  vc_meeting_id: string;
  vc_provider: string | null;
}

/**
 * Beta phase warning with fallback VC meeting IDs.
 * Shows all court numbers and meeting IDs updated daily from causelists.
 */
export function VCBetaWarning({ className }: { className?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: fallbackData } = useQuery({
    queryKey: ['vc-fallback-data', today],
    queryFn: async (): Promise<VCFallbackData[]> => {
      const { data, error } = await supabase
        .from('daily_court_docket')
        .select('court_location, court_room_no, vc_meeting_id, vc_provider')
        .eq('date', today)
        .not('vc_meeting_id', 'is', null)
        .order('court_location')
        .order('court_room_no');

      if (error) {
        console.error('[VCBetaWarning] Error fetching VC data:', error);
        return [];
      }

      // Deduplicate by court_room_no (same VC per court)
      const seen = new Map<string, VCFallbackData>();
      for (const row of data || []) {
        const key = `${row.court_location}-${row.court_room_no}`;
        if (!seen.has(key)) {
          seen.set(key, row as VCFallbackData);
        }
      }

      return Array.from(seen.values()).sort((a, b) => {
        const numA = parseInt(a.court_room_no) || 0;
        const numB = parseInt(b.court_room_no) || 0;
        return numA - numB;
      });
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  const handleCopy = async (meetingId: string) => {
    try {
      await navigator.clipboard.writeText(meetingId);
      setCopiedId(meetingId);
      toast.success('Meeting ID copied');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <div className={cn('rounded-lg border border-court-warning/30 bg-court-warning/5', className)}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-court-warning/10 transition-colors rounded-lg">
            <AlertTriangle className="h-3.5 w-3.5 text-court-warning flex-shrink-0" />
            <span className="text-[11px] text-court-warning font-medium flex-1">
              BETA: Virtual Court links are auto-extracted from causelists
            </span>
            <ChevronDown className={cn(
              'h-4 w-4 text-court-warning transition-transform',
              isOpen && 'rotate-180'
            )} />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-2">
            <p className="text-[10px] text-muted-foreground">
              If auto-join fails, use these fallback Meeting IDs (updated daily with causelists):
            </p>

            {fallbackData && fallbackData.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto">
                {fallbackData.map((item) => (
                  <div
                    key={`${item.court_location}-${item.court_room_no}`}
                    className="flex items-center gap-1.5 p-1.5 rounded bg-muted/50 border border-border/50"
                  >
                    <Video className="h-3 w-3 text-court-success flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-medium text-foreground truncate">
                        Court {item.court_room_no}
                      </p>
                      <p className="text-[9px] text-muted-foreground font-mono truncate">
                        {item.vc_meeting_id}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(item.vc_meeting_id);
                      }}
                    >
                      {copiedId === item.vc_meeting_id ? (
                        <Check className="h-3 w-3 text-court-success" />
                      ) : (
                        <Copy className="h-3 w-3 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground italic">
                No VC data available for today. Check court notices.
              </p>
            )}

            <p className="text-[9px] text-muted-foreground pt-1 border-t border-border/30">
              ⚠️ Meeting IDs may change daily. Always verify with official court notice.
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

/**
 * Compact inline beta badge for VC buttons
 */
export function VCBetaBadge({ className }: { className?: string }) {
  return (
    <Badge 
      variant="outline" 
      className={cn(
        'text-[9px] px-1.5 py-0 h-4 bg-court-warning/10 border-court-warning/30 text-court-warning',
        className
      )}
    >
      <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
      BETA
    </Badge>
  );
}
