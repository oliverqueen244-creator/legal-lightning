import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CaseArgument } from '@/types/database';

export function useArguments(docketId: string) {
  return useQuery({
    queryKey: ['arguments', docketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('case_arguments')
        .select('*')
        .eq('docket_id', docketId)
        .order('linked_page_number', { ascending: true });

      if (error) throw error;
      return data as CaseArgument[];
    },
    enabled: !!docketId,
  });
}
