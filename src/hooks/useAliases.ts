import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useRateLimit } from './useRateLimit';
import { toast } from 'sonner';
import type { LawyerAlias } from '@/types/database';

export function useAliases() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { isLimited, remainingRequests, executeWithLimit } = useRateLimit('aliasEdit');

  const { data: aliases = [], isLoading } = useQuery({
    queryKey: ['aliases', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('lawyer_aliases')
        .select('*')
        .eq('profile_id', user.id)
        .order('is_primary', { ascending: false });

      if (error) throw error;
      return data as LawyerAlias[];
    },
    enabled: !!user?.id,
  });

  const addAlias = useMutation({
    mutationFn: async ({ aliasName, isPrimary = false }: { aliasName: string; isPrimary?: boolean }) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      // SAFETY: Minimum alias length to prevent false matches
      const trimmedName = aliasName.trim();
      if (trimmedName.length < 5) {
        toast.error('Alias must be at least 5 characters to prevent false matches.');
        throw new Error('Alias too short');
      }

      // Rate limit check
      if (isLimited) {
        toast.error('Too many requests. Please wait a moment.');
        throw new Error('Rate limited');
      }

      const result = await executeWithLimit(async () => {
        const { data, error } = await supabase
          .from('lawyer_aliases')
          .insert({
            profile_id: user.id,
            alias_name: trimmedName,
            is_primary: isPrimary,
          })
          .select()
          .single();

        if (error) throw error;
        return data as LawyerAlias;
      });

      if (!result) throw new Error('Rate limited');
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aliases', user?.id] });
    },
  });

  const removeAlias = useMutation({
    mutationFn: async (aliasId: string) => {
      if (isLimited) {
        toast.error('Too many requests. Please wait a moment.');
        throw new Error('Rate limited');
      }

      await executeWithLimit(async () => {
        const { error } = await supabase
          .from('lawyer_aliases')
          .delete()
          .eq('id', aliasId);

        if (error) throw error;
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aliases', user?.id] });
    },
  });

  const setPrimaryAlias = useMutation({
    mutationFn: async (aliasId: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      if (isLimited) {
        toast.error('Too many requests. Please wait a moment.');
        throw new Error('Rate limited');
      }

      await executeWithLimit(async () => {
        // First, set all aliases to non-primary
        await supabase
          .from('lawyer_aliases')
          .update({ is_primary: false })
          .eq('profile_id', user.id);

        // Then set the selected one as primary
        const { error } = await supabase
          .from('lawyer_aliases')
          .update({ is_primary: true })
          .eq('id', aliasId);

        if (error) throw error;
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aliases', user?.id] });
    },
  });

  return {
    aliases,
    isLoading,
    addAlias,
    removeAlias,
    setPrimaryAlias,
    isRateLimited: isLimited,
    remainingRequests,
  };
}
