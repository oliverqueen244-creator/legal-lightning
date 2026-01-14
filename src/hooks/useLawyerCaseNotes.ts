/**
 * useLawyerCaseNotes Hook
 * 
 * Manages lawyer case notes (in-system notes).
 * Notes are stored per lawyer + case_fingerprint.
 * Max 1000 characters, plain text only.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { MAX_NOTES_LENGTH } from '@/types/export';
import { toast } from 'sonner';

interface LawyerCaseNote {
  id: string;
  lawyer_id: string;
  case_fingerprint: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export function useLawyerCaseNotes(caseFingerprints: string[] = []) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Fetch notes for given case fingerprints
  const { data: notes, isLoading, error, refetch } = useQuery({
    queryKey: ['lawyer-case-notes', user?.id, caseFingerprints],
    queryFn: async () => {
      if (!user?.id || caseFingerprints.length === 0) {
        return new Map<string, string>();
      }
      
      const { data, error: fetchError } = await supabase
        .from('lawyer_case_notes')
        .select('*')
        .eq('lawyer_id', user.id)
        .in('case_fingerprint', caseFingerprints);
      
      if (fetchError) throw fetchError;
      
      // Return as Map for easy lookup
      const noteMap = new Map<string, string>();
      for (const note of (data || []) as LawyerCaseNote[]) {
        noteMap.set(note.case_fingerprint, note.notes);
      }
      return noteMap;
    },
    enabled: !!user?.id && caseFingerprints.length > 0,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
  
  // Save or update a note
  const saveNoteMutation = useMutation({
    mutationFn: async ({ caseFingerprint, noteText }: { caseFingerprint: string; noteText: string }) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      // Validate length
      if (noteText.length > MAX_NOTES_LENGTH) {
        throw new Error(`Notes cannot exceed ${MAX_NOTES_LENGTH} characters`);
      }
      
      // Upsert the note
      const { error: upsertError } = await supabase
        .from('lawyer_case_notes')
        .upsert({
          lawyer_id: user.id,
          case_fingerprint: caseFingerprint,
          notes: noteText.trim(),
        }, {
          onConflict: 'lawyer_id,case_fingerprint',
        });
      
      if (upsertError) throw upsertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lawyer-case-notes'] });
      toast.success('Note saved');
    },
    onError: (error) => {
      toast.error('Failed to save note', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });
  
  // Delete a note
  const deleteNoteMutation = useMutation({
    mutationFn: async (caseFingerprint: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { error: deleteError } = await supabase
        .from('lawyer_case_notes')
        .delete()
        .eq('lawyer_id', user.id)
        .eq('case_fingerprint', caseFingerprint);
      
      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lawyer-case-notes'] });
      toast.success('Note deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete note', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    },
  });
  
  return {
    notes: notes || new Map<string, string>(),
    isLoading,
    error,
    refetch,
    saveNote: (caseFingerprint: string, noteText: string) => 
      saveNoteMutation.mutateAsync({ caseFingerprint, noteText }),
    deleteNote: (caseFingerprint: string) => 
      deleteNoteMutation.mutateAsync(caseFingerprint),
    isSaving: saveNoteMutation.isPending,
    isDeleting: deleteNoteMutation.isPending,
  };
}
