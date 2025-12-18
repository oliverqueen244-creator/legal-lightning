import { useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import type { PostCourtNote } from './usePostCourtCapture';

interface ClientUpdateInput {
  caseNumber: string;
  hearingDate: string;
  whatHappened?: string | null;
  nextDirection?: string | null;
}

/**
 * Hook for generating client-safe updates from post-court notes.
 * SENIOR role only - plain text, factual, no predictions.
 */
export function useClientUpdate() {
  const generateUpdate = useCallback((input: ClientUpdateInput): string => {
    const formattedDate = format(parseISO(input.hearingDate), 'dd MMMM yyyy');
    
    let update = `Case: ${input.caseNumber}\n`;
    update += `Hearing Date: ${formattedDate}\n\n`;
    
    if (input.whatHappened && input.whatHappened.trim()) {
      update += `Update:\n${input.whatHappened.trim()}\n\n`;
    }
    
    if (input.nextDirection && input.nextDirection.trim()) {
      update += `Next:\n${input.nextDirection.trim()}\n`;
    }
    
    if (!input.whatHappened && !input.nextDirection) {
      update += `The matter was heard today. Further details to follow.\n`;
    }
    
    return update.trim();
  }, []);

  const generateFromNote = useCallback((
    note: PostCourtNote,
    caseNumber: string
  ): string => {
    return generateUpdate({
      caseNumber,
      hearingDate: note.hearing_date,
      whatHappened: note.what_happened,
      nextDirection: note.next_direction,
    });
  }, [generateUpdate]);

  return {
    generateUpdate,
    generateFromNote,
  };
}
