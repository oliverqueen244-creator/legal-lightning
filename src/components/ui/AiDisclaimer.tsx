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
    <div 
      className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 border border-border/50 text-muted-foreground text-xs"
      role="note"
      aria-label="AI disclaimer"
    >
      <Info className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
      <span>System-generated assistance. Verify against official court records.</span>
    </div>
  );
}
