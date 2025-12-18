import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface JudgmentReference {
  id: string;
  judge_name: string;
  court: string;
  case_type: string;
  judgment_date: string;
  indian_kanoon_url: string;
  lawyer_names: string[];
  added_at: string;
  advocateMatched?: boolean;
}

interface UseJudgmentReferencesParams {
  judgeName?: string | null;
  court?: string | null;
  caseType?: string | null;
  advocateNames?: string[];
}

export function useJudgmentReferences({
  judgeName,
  court,
  caseType,
  advocateNames = []
}: UseJudgmentReferencesParams) {
  return useQuery({
    queryKey: ['judgment-references', judgeName, court, caseType, advocateNames],
    queryFn: async () => {
      // Build query with filters
      let query = supabase
        .from('judge_judgment_references')
        .select('*')
        .order('judgment_date', { ascending: false });

      // Apply filters (case-insensitive matching)
      if (judgeName) {
        query = query.ilike('judge_name', `%${judgeName}%`);
      }

      if (court) {
        // Map bench names to court names
        const courtMapping: Record<string, string[]> = {
          'JAIPUR': ['Rajasthan High Court - Jaipur', 'Rajasthan High Court'],
          'JODHPUR': ['Rajasthan High Court - Jodhpur', 'Rajasthan High Court']
        };
        
        const courtNames = courtMapping[court] || [court];
        query = query.or(courtNames.map(c => `court.ilike.%${c}%`).join(','));
      }

      const { data, error } = await query;
      
      if (error) throw error;
      
      // Process results with advocate matching
      const normalizedAdvocates = advocateNames.map(name => 
        name.toLowerCase().replace(/\s+/g, ' ').trim()
      );
      
      const processedRefs: JudgmentReference[] = (data || []).map(ref => {
        // Check if any advocate from the current case appeared in this judgment
        const advocateMatched = ref.lawyer_names.some((lawyer: string) => {
          const normalizedLawyer = lawyer.toLowerCase().replace(/\s+/g, ' ').trim();
          return normalizedAdvocates.some(advocate => 
            normalizedLawyer.includes(advocate) || advocate.includes(normalizedLawyer)
          );
        });

        return {
          ...ref,
          advocateMatched
        };
      });

      // Sort: matched advocates first, then by date
      processedRefs.sort((a, b) => {
        if (a.advocateMatched && !b.advocateMatched) return -1;
        if (!a.advocateMatched && b.advocateMatched) return 1;
        return new Date(b.judgment_date).getTime() - new Date(a.judgment_date).getTime();
      });

      return processedRefs;
    },
    enabled: !!judgeName || !!court // Only fetch if we have at least one filter
  });
}

// Hook to get advocate aliases for matching
export function useAdvocateAliases(profileId?: string) {
  return useQuery({
    queryKey: ['advocate-aliases', profileId],
    queryFn: async () => {
      if (!profileId) return [];
      
      const { data, error } = await supabase
        .from('lawyer_aliases')
        .select('alias_name')
        .eq('profile_id', profileId);
      
      if (error) throw error;
      return data.map(d => d.alias_name);
    },
    enabled: !!profileId
  });
}