import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Subscription {
  id: string;
  user_id: string;
  plan_type: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
}

export function useSubscription() {
  const { user } = useAuth();

  const { data: subscription, isLoading, error } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as Subscription | null;
    },
    enabled: !!user?.id,
  });

  const isActive = subscription?.status === 'active';
  const isPro = isActive && subscription?.plan_type === 'pro';
  const isFree = !subscription || subscription.plan_type === 'free';

  return {
    subscription,
    isLoading,
    error,
    isActive,
    isPro,
    isFree,
    // Placeholder for future Stripe integration
    upgradeToPro: () => {
      console.log('Stripe integration pending - upgrade to pro');
    },
    cancelSubscription: () => {
      console.log('Stripe integration pending - cancel subscription');
    },
  };
}
