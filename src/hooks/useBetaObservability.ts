import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ObservabilityStats {
  activeChambers: number;
  activeDelegations: number;
  delegatedActions24h: number;
  blockedActions24h: number;
}

interface SecurityEvent {
  id: string;
  event_type: string;
  user_id: string | null;
  user_role: string | null;
  attempted_action: string;
  target_table: string | null;
  target_id: string | null;
  reason: string;
  created_at: string;
}

interface InvariantHealth {
  invalidContexts: number;
  clerkOwnershipViolations: number;
  delegationScopeViolations: number;
  unattributedMutations: number;
  isHealthy: boolean;
}

export function useBetaObservability() {
  // Fetch counts
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['beta-observability-stats'],
    queryFn: async (): Promise<ObservabilityStats> => {
      const [chambers, delegations, delegatedActions, securityEvents] = await Promise.all([
        supabase.from('chambers').select('id', { count: 'exact', head: true }),
        supabase.from('clerk_delegations').select('id', { count: 'exact', head: true }).is('revoked_at', null),
        supabase.from('delegated_actions').select('id', { count: 'exact', head: true }).gte('performed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
        supabase.from('security_events').select('id', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
      ]);

      return {
        activeChambers: chambers.count || 0,
        activeDelegations: delegations.count || 0,
        delegatedActions24h: delegatedActions.count || 0,
        blockedActions24h: securityEvents.count || 0,
      };
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch last 50 security events
  const { data: securityEvents, isLoading: eventsLoading, refetch: refetchEvents } = useQuery({
    queryKey: ['beta-security-events'],
    queryFn: async (): Promise<SecurityEvent[]> => {
      const { data, error } = await supabase
        .from('security_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []) as SecurityEvent[];
    },
    refetchInterval: 30000,
  });

  // Fetch invariant health checks
  const { data: invariantHealth, isLoading: healthLoading, refetch: refetchHealth } = useQuery({
    queryKey: ['beta-invariant-health'],
    queryFn: async (): Promise<InvariantHealth> => {
      // Query each audit view
      const [contexts, ownership, delegation, unattributed] = await Promise.all([
        supabase.from('v_invalid_case_contexts').select('id', { count: 'exact', head: true }),
        supabase.from('v_clerk_ownership_violations').select('id', { count: 'exact', head: true }),
        supabase.from('v_delegation_scope_violations').select('id', { count: 'exact', head: true }),
        supabase.from('v_unattributed_mutations').select('id', { count: 'exact', head: true }),
      ]);

      const invalidContexts = contexts.count || 0;
      const clerkOwnershipViolations = ownership.count || 0;
      const delegationScopeViolations = delegation.count || 0;
      const unattributedMutations = unattributed.count || 0;

      return {
        invalidContexts,
        clerkOwnershipViolations,
        delegationScopeViolations,
        unattributedMutations,
        isHealthy: invalidContexts === 0 && clerkOwnershipViolations === 0 && 
                   delegationScopeViolations === 0 && unattributedMutations === 0,
      };
    },
    refetchInterval: 60000, // Refresh every minute
  });

  const refetchAll = () => {
    refetchStats();
    refetchEvents();
    refetchHealth();
  };

  return {
    stats: stats || { activeChambers: 0, activeDelegations: 0, delegatedActions24h: 0, blockedActions24h: 0 },
    securityEvents: securityEvents || [],
    invariantHealth: invariantHealth || { 
      invalidContexts: 0, 
      clerkOwnershipViolations: 0, 
      delegationScopeViolations: 0, 
      unattributedMutations: 0, 
      isHealthy: true 
    },
    isLoading: statsLoading || eventsLoading || healthLoading,
    refetchAll,
  };
}
