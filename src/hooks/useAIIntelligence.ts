import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useAIIntelligence() {
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [summary, setSummary] = useState<string | null>(null);

    const summarizeCase = async (docketId: string, pdfUrl: string) => {
        setIsSummarizing(true);
        try {
            const { data, error } = await supabase.functions.invoke('ai-worker', {
                body: {
                    action: 'summarize_case',
                    docketId,
                    pdfUrl
                }
            });

            if (error) throw error;
            setSummary(data.summary);
            toast.success('AI Summary Generated');
        } catch (error) {
            console.error('[AI] Summarization failed:', error);
            toast.error('Failed to generate AI summary');
        } finally {
            setIsSummarizing(false);
        }
    };

    const findPrecedents = async (query: string) => {
        // Implementation for Indian Kanoon search via edge function
        try {
            const { data, error } = await supabase.functions.invoke('search-indian-kanoon', {
                body: { query }
            });
            if (error) throw error;
            return data.results;
        } catch (error) {
            console.error('[AI] Precedent search failed:', error);
            return [];
        }
    };

    return {
        isSummarizing,
        summary,
        summarizeCase,
        findPrecedents
    };
}
