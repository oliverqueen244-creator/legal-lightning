import { Info } from 'lucide-react';

/**
 * AI Disclaimer Component
 * 
 * MANDATORY: Must be displayed before or immediately above ALL AI-generated content.
 * This disclaimer is NOT dismissible and must always be visible.
 * 
 * Legal requirement: All AI outputs (Morning Brief, suggestions, summaries) 
 * must display this disclaimer to avoid implying authoritative advice.
 */
export function AiDisclaimer() {
  return (
    // DECLUTTER: Demoted to subtle inline text - no background, no border, smaller font, italic
    <p 
      className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 italic"
      role="note"
      aria-label="AI disclaimer"
    >
      <Info className="h-3 w-3 flex-shrink-0 opacity-60" aria-hidden="true" />
      <span>System-generated assistance. Verify against official court records.</span>
    </p>
  );
}
