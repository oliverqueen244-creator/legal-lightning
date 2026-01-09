/**
 * CANONICAL COURT SESSION STATE HOOK
 * 
 * This is the SINGLE SOURCE OF TRUTH for court session state.
 * All UI components MUST use this hook instead of direct checks against:
 * - isCourtHours()
 * - liveBoard.is_active
 * - liveBoard.status
 * 
 * DERIVATION RULES (STRICT ORDER):
 * 1. If liveBoard?.is_active === false → inSession = false
 * 2. Else if liveBoard?.status !== 'hearing' → inSession = false
 * 3. Else if !isCourtHours() → inSession = false
 * 4. Else → inSession = true
 */

import { useMemo } from 'react';
import { isCourtHours } from './useLiveBoard';
import type { LiveBoardCache, BoardStatus } from '@/types/database';

export type SessionReason = 'hearing' | 'lunch' | 'adjourned' | 'passover' | 'not_sitting' | 'inactive' | 'outside_hours' | 'no_data';

export interface CourtSessionState {
  /** Whether court is currently in an active hearing session */
  inSession: boolean;
  /** The reason for the current session state */
  reason: SessionReason;
  /** Whether the live board is marked as active */
  isActive: boolean;
  /** The raw board status from scraper */
  boardStatus: BoardStatus;
  /** Human-readable explanation */
  reasonText: string;
}

/**
 * CANONICAL CURRENT_ITEM FALLBACK
 * All components must use this value: 1
 * Never use 0 as fallback.
 */
export const CURRENT_ITEM_FALLBACK = 1;

/**
 * Get current item with canonical fallback
 */
export function getCurrentItem(liveBoard: LiveBoardCache | null | undefined): number {
  return liveBoard?.current_item ?? CURRENT_ITEM_FALLBACK;
}

/**
 * Compute court session state from a live board
 * This is the canonical derivation - do not duplicate this logic elsewhere
 */
export function deriveCourtSessionState(liveBoard: LiveBoardCache | null | undefined): CourtSessionState {
  // No data case
  if (!liveBoard) {
    return {
      inSession: false,
      reason: 'no_data',
      isActive: false,
      boardStatus: 'hearing',
      reasonText: 'No court data available',
    };
  }

  const boardStatus: BoardStatus = liveBoard.status ?? 'hearing';
  const isActive = liveBoard.is_active ?? false;

  // Rule 1: If is_active === false → not in session
  if (!isActive) {
    return {
      inSession: false,
      reason: 'inactive',
      isActive: false,
      boardStatus,
      reasonText: 'Court is not active',
    };
  }

  // Rule 2: If status !== 'hearing' → not in session
  if (boardStatus !== 'hearing') {
    const reasonMap: Record<BoardStatus, { reason: SessionReason; text: string }> = {
      hearing: { reason: 'hearing', text: 'Court in session' },
      lunch: { reason: 'lunch', text: 'Lunch break' },
      adjourned: { reason: 'adjourned', text: 'Court adjourned for the day' },
      passover: { reason: 'passover', text: 'Passover in progress' },
      not_sitting: { reason: 'not_sitting', text: 'Court not sitting today' },
    };

    const mapped = reasonMap[boardStatus] ?? { reason: 'inactive', text: 'Court not in hearing' };
    return {
      inSession: false,
      reason: mapped.reason,
      isActive,
      boardStatus,
      reasonText: mapped.text,
    };
  }

  // Rule 3: If outside court hours → not in session
  const courtHours = isCourtHours();
  if (!courtHours.inSession) {
    return {
      inSession: false,
      reason: 'outside_hours',
      isActive,
      boardStatus,
      reasonText: courtHours.reason,
    };
  }

  // All checks passed → in session
  return {
    inSession: true,
    reason: 'hearing',
    isActive,
    boardStatus,
    reasonText: 'Court in session',
  };
}

/**
 * Hook to get court session state for a specific live board
 * 
 * @param liveBoard - The live board data for the court
 * @returns CourtSessionState - The derived session state
 */
export function useCourtSessionState(liveBoard: LiveBoardCache | null | undefined): CourtSessionState {
  return useMemo(() => deriveCourtSessionState(liveBoard), [liveBoard]);
}

/**
 * Compute canonical RUNNING state
 * 
 * RUNNING may be shown only if:
 * - courtSession.inSession === true
 * - distance <= 0
 * 
 * @param session - The court session state
 * @param itemNo - The docket item number
 * @param liveBoard - The live board (for current item)
 * @returns Whether the case should show as RUNNING
 */
export function isRunningState(
  session: CourtSessionState,
  itemNo: number | null | undefined,
  liveBoard: LiveBoardCache | null | undefined
): boolean {
  if (!session.inSession) return false;
  if (!itemNo) return false;
  
  const currentItem = getCurrentItem(liveBoard);
  const distance = itemNo - currentItem;
  
  return distance <= 0;
}

/**
 * Compute canonical WAIT TIME visibility
 * 
 * WAIT TIME must be hidden unless:
 * - courtSession.inSession === true
 * - courtSession.reason === 'hearing'
 * 
 * @param session - The court session state
 * @returns Whether wait time should be visible
 */
export function shouldShowWaitTime(session: CourtSessionState): boolean {
  return session.inSession && session.reason === 'hearing';
}
