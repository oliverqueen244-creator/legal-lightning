import { Badge } from '@/components/ui/badge';
import { useSubscription } from '@/hooks/useSubscription';
import { Crown, Sparkles } from 'lucide-react';

export function SubscriptionBadge() {
  const { isPro, isFree, isLoading } = useSubscription();

  if (isLoading) {
    return null;
  }

  if (isPro) {
    return (
      <Badge variant="default" className="gap-1">
        <Crown className="h-3 w-3" />
        Pro
      </Badge>
    );
  }

  if (isFree) {
    return (
      <Badge variant="secondary" className="gap-1">
        <Sparkles className="h-3 w-3" />
        Free
      </Badge>
    );
  }

  return null;
}
