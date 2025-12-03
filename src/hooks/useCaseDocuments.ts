import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CaseDocument } from '@/types/database';

export function useCaseDocuments(docketId: string) {
  return useQuery({
    queryKey: ['case-documents', docketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('case_documents')
        .select('*')
        .eq('docket_id', docketId)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      return data as CaseDocument[];
    },
    enabled: !!docketId,
  });
}
