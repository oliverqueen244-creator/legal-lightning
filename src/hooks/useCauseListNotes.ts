import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface CauseListNote {
  id: string;
  raw_causelist_id: string;
  note_type: string | null;
  note_text: string;
  page_number: number | null;
  created_at: string;
  causelist?: {
    bench: string;
    list_type: string;
    list_date: string;
  };
}

export function useCauseListNotes(date?: string, bench?: string) {
  const targetDate = date || format(new Date(), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['cause-list-notes', targetDate, bench],
    queryFn: async (): Promise<CauseListNote[]> => {
      // First get causelists for the date
      let causelistQuery = supabase
        .from('raw_causelists')
        .select('id, bench, list_type, list_date')
        .eq('list_date', targetDate);

      if (bench) {
        const benches = bench.split(',').map(b => b.trim().toUpperCase());
        causelistQuery = causelistQuery.in('bench', benches);
      }

      const { data: causelists, error: causelistError } = await causelistQuery;

      if (causelistError) {
        console.error('Error fetching causelists:', causelistError);
        return [];
      }

      if (!causelists || causelists.length === 0) {
        return [];
      }

      // Get notes for these causelists
      const causelistIds = causelists.map(c => c.id);
      const { data: notes, error: notesError } = await supabase
        .from('cause_list_notes')
        .select('*')
        .in('raw_causelist_id', causelistIds)
        .order('created_at', { ascending: true });

      if (notesError) {
        console.error('Error fetching notes:', notesError);
        return [];
      }

      // Attach causelist info to notes
      return (notes || []).map(note => ({
        ...note,
        causelist: causelists.find(c => c.id === note.raw_causelist_id)
      }));
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
