import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { LawyerAlias } from '@/types/database';

export function useAliases() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

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

      const { data, error } = await supabase
        .from('lawyer_aliases')
        .insert({
          profile_id: user.id,
          alias_name: aliasName,
          is_primary: isPrimary,
        })
        .select()
        .single();

      if (error) throw error;
      return data as LawyerAlias;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aliases', user?.id] });
    },
  });

  const removeAlias = useMutation({
    mutationFn: async (aliasId: string) => {
      const { error } = await supabase
        .from('lawyer_aliases')
        .delete()
        .eq('id', aliasId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aliases', user?.id] });
    },
  });

  const setPrimaryAlias = useMutation({
    mutationFn: async (aliasId: string) => {
      if (!user?.id) throw new Error('Not authenticated');

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
  };
}
