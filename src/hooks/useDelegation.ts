/**
 * CP-5: Delegation & Acting-On-Behalf Hook
 * 
 * Provides delegation state and scoped actions for clerks.
 * Clerks can only perform actions within their granted scopes.
 * All actions are attributed to the delegating lawyer.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

// CP-5: Delegation scopes - matches database enum
export type DelegationScope = 
  | 'view_cases'
  | 'upload_documents'
  | 'add_notes'
  | 'track_hearings'
  | 'mark_presence';

// Forbidden scopes that can NEVER be granted
export const FORBIDDEN_SCOPES = [
  'claim_ownership',
  'confirm_matches',
  'force_active',
  'set_matched_profile_id',
] as const;

export interface Delegation {
  id: string;
  clerk_id: string;
  lawyer_id: string;
  chamber_id: string | null;
  scopes: DelegationScope[];
  delegated_at: string;
  revoked_at: string | null;
  created_by: string | null;
  // Joined data
  lawyer_name?: string;
  chamber_name?: string;
}

export interface DelegatedAction {
  id: string;
  actor_id: string;
  on_behalf_of: string;
  chamber_id: string | null;
  delegation_id: string;
  action_type: string;
  target_table: string;
  target_id: string;
  action_details: Record<string, unknown> | null;
  performed_at: string;
}

export function useDelegation() {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const isClerk = role === 'CLERK';
  const isLawyer = role === 'SENIOR' || role === 'JUNIOR' || role === 'ADMIN';

  // Fetch active delegations for this user
  const { data: delegations = [], isLoading: delegationsLoading, refetch: refetchDelegations } = useQuery({
    queryKey: ['delegations', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      // Build query based on role
      const query = supabase
        .from('clerk_delegations')
        .select(`
          *,
          lawyer:profiles!clerk_delegations_lawyer_id_fkey(full_name),
          chamber:chambers(name)
        `)
        .is('revoked_at', null);
      
      // Clerks see delegations granted TO them
      // Lawyers see delegations they've CREATED
      if (isClerk) {
        query.eq('clerk_id', user.id);
      } else if (isLawyer) {
        query.eq('lawyer_id', user.id);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('[useDelegation] Failed to fetch delegations:', error);
        return [];
      }
      
      return (data || []).map(d => {
        // Handle joined relations - lawyer comes as object, chamber comes as object
        const lawyerData = d.lawyer as unknown as { full_name: string } | null;
        const chamberData = d.chamber as unknown as { name: string } | null;
        return {
          ...d,
          lawyer_name: lawyerData?.full_name || 'Unknown',
          chamber_name: chamberData?.name || null,
        } as Delegation;
      });
    },
    enabled: !!user && (isClerk || isLawyer),
    staleTime: 30000,
    refetchOnWindowFocus: true,
  });

  // Get the primary delegation (for UI display)
  const primaryDelegation = useMemo(() => {
    if (!delegations.length) return null;
    // Return first active delegation
    return delegations[0];
  }, [delegations]);

  // Check if clerk has a specific scope with a specific lawyer
  const hasScope = useCallback((lawyerId: string, scope: DelegationScope): boolean => {
    if (!isClerk) return false;
    const delegation = delegations.find(d => d.lawyer_id === lawyerId);
    if (!delegation) return false;
    return delegation.scopes.includes(scope);
  }, [delegations, isClerk]);

  // Check if clerk has any active delegation
  const hasDelegation = useMemo(() => {
    return isClerk && delegations.length > 0;
  }, [isClerk, delegations]);

  // Get all scopes clerk has with any lawyer
  const allScopes = useMemo((): DelegationScope[] => {
    if (!isClerk) return [];
    const scopeSet = new Set<DelegationScope>();
    delegations.forEach(d => {
      d.scopes.forEach(s => scopeSet.add(s));
    });
    return Array.from(scopeSet);
  }, [delegations, isClerk]);

  // Log a delegated action
  const logDelegatedAction = useCallback(async (
    lawyerId: string,
    actionType: string,
    targetTable: string,
    targetId: string,
    actionDetails?: Record<string, unknown>
  ): Promise<string | null> => {
    if (!user || !isClerk) return null;
    
    try {
      const { data, error } = await supabase.rpc('log_delegated_action', {
        _actor_id: user.id,
        _on_behalf_of: lawyerId,
        _action_type: actionType,
        _target_table: targetTable,
        _target_id: targetId,
        _action_details: actionDetails ? JSON.parse(JSON.stringify(actionDetails)) : null,
      });
      
      if (error) {
        console.error('[useDelegation] Failed to log action:', error);
        return null;
      }
      
      return data as string;
    } catch (err) {
      console.error('[useDelegation] Log action error:', err);
      return null;
    }
  }, [user, isClerk]);

  // Create a new delegation (lawyer only)
  const createDelegation = useMutation({
    mutationFn: async (params: { 
      clerkId: string; 
      scopes: DelegationScope[]; 
      chamberId?: string;
    }) => {
      if (!user || !isLawyer) {
        throw new Error('Only lawyers can create delegations');
      }
      
      const { data, error } = await supabase
        .from('clerk_delegations')
        .insert({
          clerk_id: params.clerkId,
          lawyer_id: user.id,
          scopes: params.scopes,
          chamber_id: params.chamberId || null,
          created_by: user.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delegations'] });
      toast.success('Delegation created successfully');
    },
    onError: (error) => {
      console.error('[useDelegation] Create failed:', error);
      toast.error('Failed to create delegation');
    },
  });

  // Revoke a delegation (lawyer only)
  const revokeDelegation = useMutation({
    mutationFn: async (delegationId: string) => {
      if (!user || !isLawyer) {
        throw new Error('Only lawyers can revoke delegations');
      }
      
      const { error } = await supabase
        .from('clerk_delegations')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', delegationId)
        .eq('lawyer_id', user.id); // Ensure only own delegations
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delegations'] });
      toast.success('Delegation revoked');
    },
    onError: (error) => {
      console.error('[useDelegation] Revoke failed:', error);
      toast.error('Failed to revoke delegation');
    },
  });

  // Update delegation scopes (lawyer only)
  const updateScopes = useMutation({
    mutationFn: async (params: { delegationId: string; scopes: DelegationScope[] }) => {
      if (!user || !isLawyer) {
        throw new Error('Only lawyers can update delegations');
      }
      
      const { error } = await supabase
        .from('clerk_delegations')
        .update({ scopes: params.scopes })
        .eq('id', params.delegationId)
        .eq('lawyer_id', user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delegations'] });
      toast.success('Delegation scopes updated');
    },
    onError: (error) => {
      console.error('[useDelegation] Update scopes failed:', error);
      toast.error('Failed to update delegation scopes');
    },
  });

  // Subscribe to delegation changes for immediate revocation effect
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('delegation-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clerk_delegations',
          filter: isClerk ? `clerk_id=eq.${user.id}` : `lawyer_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[useDelegation] Delegation changed:', payload.eventType);
          refetchDelegations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isClerk, refetchDelegations]);

  return {
    // State
    delegations,
    primaryDelegation,
    hasDelegation,
    allScopes,
    isLoading: delegationsLoading,
    
    // Checks
    hasScope,
    isClerk,
    isLawyer,
    
    // Actions
    logDelegatedAction,
    createDelegation,
    revokeDelegation,
    updateScopes,
    refetchDelegations,
  };
}

/**
 * CP-5: Get role-aware "acting as" label
 */
export function getActingAsLabel(
  isClerk: boolean,
  delegation: Delegation | null
): string {
  if (!isClerk || !delegation) return '';
  return `Assisting Adv. ${delegation.lawyer_name || 'Unknown'}`;
}

/**
 * CP-5: Check if a scope is in the forbidden list
 */
export function isForbiddenScope(scope: string): boolean {
  return (FORBIDDEN_SCOPES as readonly string[]).includes(scope);
}
