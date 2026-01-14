/**
 * INTERN INTEGRATION PHASE 2A: Supervisor Control Hooks
 * 
 * Provides hooks for supervisors to manage their interns.
 * 
 * SCOPE CONSTRAINTS:
 * - Only shows interns supervised by the current user
 * - No global intern list
 * - No bulk actions
 * - No stats/analytics
 * - Feature-flagged per chamber
 * 
 * SECURITY REVIEW: 2026-01-14
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface SupervisedIntern {
  id: string;
  user_id: string;
  intern_name: string;
  institution: string | null;
  chamber_id: string;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
}

export interface InternCaseAssignment {
  id: string;
  intern_account_id: string;
  docket_id: string;
  assigned_by: string;
  assigned_at: string;
  expires_at: string | null;
  notes: string | null;
  // Joined docket info
  docket?: {
    case_number: string | null;
    petitioner: string | null;
    respondent: string | null;
    court_room_no: string | null;
    date: string;
  };
}

export interface InternDraft {
  id: string;
  intern_account_id: string;
  docket_id: string;
  draft_type: string;
  content: string;
  created_at: string;
  updated_at: string;
  submitted_for_review: boolean;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_status: string | null;
  review_notes: string | null;
  // Joined data
  intern?: {
    intern_name: string;
  };
  docket?: {
    case_number: string | null;
  };
}

/**
 * Check if intern supervision feature is enabled
 */
export function useInternSupervisionEnabled() {
  return useQuery({
    queryKey: ['feature-flag', 'intern-supervision'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'feature_intern_supervision_enabled')
        .maybeSingle();
      
      if (error) {
        console.error('Failed to fetch intern supervision feature flag:', error);
        return false;
      }
      
      return data?.value === true;
    },
    staleTime: 60000, // Check every minute
  });
}

/**
 * Fetch interns supervised by the current user
 * Only returns active, non-expired, non-revoked interns
 */
export function useSupervisedInterns() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['supervised-interns', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('intern_accounts')
        .select('*')
        .eq('supervisor_id', user.id)
        .is('revoked_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as SupervisedIntern[];
    },
    enabled: !!user?.id,
  });
}

/**
 * Fetch case assignments for a specific intern
 */
export function useInternAssignments(internAccountId: string | undefined) {
  return useQuery({
    queryKey: ['intern-assignments', internAccountId],
    queryFn: async () => {
      if (!internAccountId) return [];
      
      const { data, error } = await supabase
        .from('intern_case_assignments')
        .select(`
          id,
          intern_account_id,
          docket_id,
          assigned_by,
          assigned_at,
          expires_at,
          notes,
          daily_court_docket:docket_id (
            case_number,
            petitioner,
            respondent,
            court_room_no,
            date
          )
        `)
        .eq('intern_account_id', internAccountId)
        .order('assigned_at', { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map(a => ({
        ...a,
        docket: a.daily_court_docket as unknown as InternCaseAssignment['docket']
      }));
    },
    enabled: !!internAccountId,
  });
}

/**
 * Fetch drafts submitted for review by supervised interns
 * Only shows submitted drafts, not work-in-progress
 */
export function useSubmittedDrafts() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['submitted-drafts', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      // Get drafts from interns supervised by this user
      const { data, error } = await supabase
        .from('intern_drafts')
        .select(`
          id,
          intern_account_id,
          docket_id,
          draft_type,
          content,
          created_at,
          updated_at,
          submitted_for_review,
          submitted_at,
          reviewed_by,
          reviewed_at,
          review_status,
          review_notes,
          intern_accounts:intern_account_id (
            intern_name,
            supervisor_id
          ),
          daily_court_docket:docket_id (
            case_number
          )
        `)
        .eq('submitted_for_review', true)
        .order('submitted_at', { ascending: false });
      
      if (error) throw error;
      
      // Filter to only interns supervised by this user
      const filtered = (data || []).filter(d => {
        const intern = d.intern_accounts as unknown as { intern_name: string; supervisor_id: string };
        return intern?.supervisor_id === user.id;
      });
      
      return filtered.map(d => ({
        id: d.id,
        intern_account_id: d.intern_account_id,
        docket_id: d.docket_id,
        draft_type: d.draft_type,
        content: d.content,
        created_at: d.created_at,
        updated_at: d.updated_at,
        submitted_for_review: d.submitted_for_review,
        submitted_at: d.submitted_at,
        reviewed_by: d.reviewed_by,
        reviewed_at: d.reviewed_at,
        review_status: d.review_status,
        review_notes: d.review_notes,
        intern: { intern_name: (d.intern_accounts as unknown as { intern_name: string })?.intern_name },
        docket: d.daily_court_docket as unknown as { case_number: string | null }
      })) as InternDraft[];
    },
    enabled: !!user?.id,
  });
}

/**
 * Assign a case to an intern
 */
export function useAssignCaseToIntern() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      internAccountId, 
      docketId,
      notes 
    }: { 
      internAccountId: string; 
      docketId: string;
      notes?: string;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('intern_case_assignments')
        .insert({
          intern_account_id: internAccountId,
          docket_id: docketId,
          assigned_by: user.id,
          notes: notes || null
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['intern-assignments', variables.internAccountId] });
      toast.success('Case assigned to intern');
    },
    onError: (error) => {
      console.error('Failed to assign case:', error);
      toast.error('Failed to assign case');
    }
  });
}

/**
 * Remove a case assignment from an intern
 */
export function useRemoveCaseAssignment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      assignmentId, 
      internAccountId 
    }: { 
      assignmentId: string; 
      internAccountId: string;
    }) => {
      const { error } = await supabase
        .from('intern_case_assignments')
        .delete()
        .eq('id', assignmentId);
      
      if (error) throw error;
      return internAccountId;
    },
    onSuccess: (internAccountId) => {
      queryClient.invalidateQueries({ queryKey: ['intern-assignments', internAccountId] });
      toast.success('Assignment removed');
    },
    onError: (error) => {
      console.error('Failed to remove assignment:', error);
      toast.error('Failed to remove assignment');
    }
  });
}

/**
 * Review an intern draft (approve or reject)
 * Uses the database function for security
 */
export function useReviewDraft() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      draftId, 
      status, 
      notes 
    }: { 
      draftId: string; 
      status: 'approved' | 'rejected';
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .rpc('review_intern_draft', {
          p_draft_id: draftId,
          p_status: status,
          p_notes: notes || null
        });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['submitted-drafts'] });
      toast.success(`Draft ${variables.status}`);
    },
    onError: (error) => {
      console.error('Failed to review draft:', error);
      toast.error('Failed to review draft');
    }
  });
}
