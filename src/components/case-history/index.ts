/**
 * Case History Components
 * 
 * SEMANTIC CORRECTION:
 * - ListingHistoryPanel shows cause list LISTINGS (system-ingested)
 * - Hearings are overlaid on listings when lawyer confirms (via post-court note)
 * 
 * The old "CaseHistoryPanel" is maintained for backward compatibility
 * but now re-exports ListingHistoryPanel.
 */

export { ListingHistoryPanel, CaseHistoryPanel } from './ListingHistoryPanel';
export type { ListingHistory, ListingEntry } from '@/hooks/useListingHistory';
