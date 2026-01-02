import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export type ChamberRole = 'senior' | 'junior' | 'clerk';

export interface Chamber {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}

export interface ChamberMembership {
  id: string;
  chamber_id: string;
  lawyer_id: string;
  role_in_chamber: ChamberRole;
  invited_by: string | null;
  joined_at: string;
  revoked_at: string | null;
  // Joined data
  chamber?: Chamber;
  lawyer?: {
    id: string;
    full_name: string | null;
  };
}

export interface ChamberInvite {
  id: string;
  chamber_id: string;
  invite_code: string;
  invited_email: string | null;
  role_in_chamber: ChamberRole;
  created_by: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  used_by: string | null;
}

/**
 * Fetch chambers the user owns
 */
export function useOwnedChambers() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['chambers', 'owned', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('chambers')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Chamber[];
    },
    enabled: !!user?.id
  });
}

/**
 * Fetch chambers the user is a member of (not owner)
 */
export function useMemberChambers() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['chambers', 'member', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('chamber_memberships')
        .select(`
          id,
          chamber_id,
          role_in_chamber,
          joined_at,
          revoked_at,
          chambers:chamber_id (
            id,
            name,
            owner_id,
            created_at
          )
        `)
        .eq('lawyer_id', user.id)
        .is('revoked_at', null);
      
      if (error) throw error;
      
      // Filter out chambers where user is owner (they see those in ownedChambers)
      return (data || []).filter(m => {
        const chamber = m.chambers as unknown as Chamber;
        return chamber && chamber.owner_id !== user.id;
      }).map(m => ({
        ...m,
        chamber: m.chambers as unknown as Chamber
      }));
    },
    enabled: !!user?.id
  });
}

/**
 * Fetch members of a specific chamber (owner only)
 */
export function useChamberMembers(chamberId: string | undefined) {
  return useQuery({
    queryKey: ['chamber-members', chamberId],
    queryFn: async () => {
      if (!chamberId) return [];
      
      const { data, error } = await supabase
        .from('chamber_memberships')
        .select(`
          id,
          chamber_id,
          lawyer_id,
          role_in_chamber,
          joined_at,
          revoked_at,
          profiles:lawyer_id (
            id,
            full_name
          )
        `)
        .eq('chamber_id', chamberId)
        .is('revoked_at', null)
        .order('joined_at', { ascending: true });
      
      if (error) throw error;
      return (data || []).map(m => ({
        ...m,
        lawyer: m.profiles as unknown as { id: string; full_name: string | null }
      }));
    },
    enabled: !!chamberId
  });
}

/**
 * Fetch pending invites for a chamber (owner only)
 */
export function useChamberInvites(chamberId: string | undefined) {
  return useQuery({
    queryKey: ['chamber-invites', chamberId],
    queryFn: async () => {
      if (!chamberId) return [];
      
      const { data, error } = await supabase
        .from('chamber_invites')
        .select('*')
        .eq('chamber_id', chamberId)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as ChamberInvite[];
    },
    enabled: !!chamberId
  });
}

/**
 * Create a new chamber
 */
export function useCreateChamber() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (name: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('chambers')
        .insert({ name, owner_id: user.id })
        .select()
        .single();
      
      if (error) throw error;
      return data as Chamber;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chambers'] });
      toast.success('Chamber created');
    },
    onError: (error) => {
      console.error('Failed to create chamber:', error);
      toast.error('Failed to create chamber');
    }
  });
}

/**
 * Delete a chamber (owner only)
 */
export function useDeleteChamber() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (chamberId: string) => {
      const { error } = await supabase
        .from('chambers')
        .delete()
        .eq('id', chamberId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chambers'] });
      toast.success('Chamber deleted');
    },
    onError: (error) => {
      console.error('Failed to delete chamber:', error);
      toast.error('Failed to delete chamber');
    }
  });
}

/**
 * Create an invite for a chamber
 */
export function useCreateInvite() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      chamberId, 
      email, 
      role 
    }: { 
      chamberId: string; 
      email?: string; 
      role: ChamberRole;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('chamber_invites')
        .insert({
          chamber_id: chamberId,
          invited_email: email || null,
          role_in_chamber: role,
          created_by: user.id
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as ChamberInvite;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['chamber-invites', variables.chamberId] });
      toast.success('Invite created');
    },
    onError: (error) => {
      console.error('Failed to create invite:', error);
      toast.error('Failed to create invite');
    }
  });
}

/**
 * Revoke a chamber invite
 */
export function useRevokeInvite() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ inviteId, chamberId }: { inviteId: string; chamberId: string }) => {
      const { error } = await supabase
        .from('chamber_invites')
        .delete()
        .eq('id', inviteId);
      
      if (error) throw error;
      return chamberId;
    },
    onSuccess: (chamberId) => {
      queryClient.invalidateQueries({ queryKey: ['chamber-invites', chamberId] });
      toast.success('Invite revoked');
    },
    onError: (error) => {
      console.error('Failed to revoke invite:', error);
      toast.error('Failed to revoke invite');
    }
  });
}

/**
 * Join a chamber via invite code
 */
export function useJoinChamber() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (inviteCode: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      // Find the invite
      const { data: invite, error: findError } = await supabase
        .from('chamber_invites')
        .select('*')
        .eq('invite_code', inviteCode)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .single();
      
      if (findError || !invite) {
        throw new Error('Invalid or expired invite code');
      }
      
      // Check if already a member
      const { data: existing } = await supabase
        .from('chamber_memberships')
        .select('id')
        .eq('chamber_id', invite.chamber_id)
        .eq('lawyer_id', user.id)
        .is('revoked_at', null)
        .maybeSingle();
      
      if (existing) {
        throw new Error('You are already a member of this chamber');
      }
      
      // Create membership
      const { error: memberError } = await supabase
        .from('chamber_memberships')
        .insert({
          chamber_id: invite.chamber_id,
          lawyer_id: user.id,
          role_in_chamber: invite.role_in_chamber,
          invited_by: invite.created_by
        });
      
      if (memberError) throw memberError;
      
      // Mark invite as used
      await supabase
        .from('chamber_invites')
        .update({ used_at: new Date().toISOString(), used_by: user.id })
        .eq('id', invite.id);
      
      return invite.chamber_id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chambers'] });
      toast.success('Joined chamber successfully');
    },
    onError: (error) => {
      console.error('Failed to join chamber:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to join chamber');
    }
  });
}

/**
 * Leave a chamber (self-revoke membership)
 */
export function useLeaveChamber() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (chamberId: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      // Soft revoke by setting revoked_at
      const { error } = await supabase
        .from('chamber_memberships')
        .update({ revoked_at: new Date().toISOString() })
        .eq('chamber_id', chamberId)
        .eq('lawyer_id', user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chambers'] });
      toast.success('Left chamber');
    },
    onError: (error) => {
      console.error('Failed to leave chamber:', error);
      toast.error('Failed to leave chamber');
    }
  });
}

/**
 * Revoke a member's access (owner only)
 */
export function useRevokeMember() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ membershipId, chamberId }: { membershipId: string; chamberId: string }) => {
      const { error } = await supabase
        .from('chamber_memberships')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', membershipId);
      
      if (error) throw error;
      return chamberId;
    },
    onSuccess: (chamberId) => {
      queryClient.invalidateQueries({ queryKey: ['chamber-members', chamberId] });
      toast.success('Member access revoked');
    },
    onError: (error) => {
      console.error('Failed to revoke member:', error);
      toast.error('Failed to revoke member');
    }
  });
}
