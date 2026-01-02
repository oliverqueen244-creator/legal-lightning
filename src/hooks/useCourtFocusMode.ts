import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './useAuth';
import { useCourtMode } from './useCourtMode';
import { useLiveBoard } from './useLiveBoard';
import { useDocket } from './useDocket';
import { useCourtNotifications, getThresholdForDistance, calculateItemDistance } from './useCourtNotifications';
import { useNetworkStatus } from './useNetworkStatus';
import type { DocketItem, LiveBoardCache } from '@/types/database';

export interface FocusModeCase {
  docketItem: DocketItem;
  liveBoard: LiveBoardCache | null;
  distance: number;
  status: 'running' | 'next' | 'approaching' | 'waiting' | 'skipped' | 'passed_over';
  isActive: boolean;
}

export interface CourtFocusModeState {
  isActive: boolean;
  activationReason: 'manual' | 'case_running' | 'case_imminent' | 'critical_notification' | null;
  focusCase: FocusModeCase | null;
  canAutoActivate: boolean;
}

// ACTIVATION RULES (NON-NEGOTIABLE)
// Auto-activate when:
// - User's matched case status is RUNNING (distance = 0)
// - User's case is within ≤3 items of current live board item
// - A critical notification fires (immediate / exception threshold)

const AUTO_ACTIVATION_DISTANCE = 3;

export function useCourtFocusMode() {
  const { user } = useAuth();
  const { isCourtModeEnabled, settings: courtModeSettings } = useCourtMode();
  const { data: liveBoards, dataUpdatedAt: liveBoardUpdatedAt } = useLiveBoard();
  const { data: docketItems, dataUpdatedAt: docketUpdatedAt } = useDocket();
  const { criticalUnacknowledged } = useCourtNotifications();
  const { isOnline } = useNetworkStatus();

  const [isManuallyActive, setIsManuallyActive] = useState(false);
  const [wasAutoDismissed, setWasAutoDismissed] = useState(false);
  const [lastExitedAt, setLastExitedAt] = useState<number | null>(null);

  // Check if running in standalone PWA mode
  const isPWAStandalone = useMemo(() => {
    return window.matchMedia('(display-mode: standalone)').matches ||
           (window.navigator as any).standalone === true;
  }, []);

  // Get the user's matched cases with their current status
  const matchedCasesWithStatus = useMemo((): FocusModeCase[] => {
    if (!docketItems?.length || !user?.id) return [];

    return docketItems
      .filter(item => item.matched_profile_id === user.id)
      .map(item => {
        const liveBoard = liveBoards?.find(
          (lb: LiveBoardCache) =>
            lb.court_location === item.court_location &&
            lb.court_no === item.court_room_no
        ) || null;

        const currentItem = liveBoard?.current_item || 1;
        const distance = item.item_no ? calculateItemDistance(item.item_no, currentItem) : 999;

        // Determine status
        let status: FocusModeCase['status'] = 'waiting';
        if (distance === 0 && liveBoard?.is_active) {
          status = 'running';
        } else if (distance > 0 && distance <= 3) {
          status = 'next';
        } else if (distance > 3 && distance <= 10) {
          status = 'approaching';
        } else if (distance < 0) {
          // Case was skipped or passed over
          status = item.status === 'passover' ? 'passed_over' : 'skipped';
        }

        return {
          docketItem: item,
          liveBoard,
          distance,
          status,
          isActive: liveBoard?.is_active ?? false,
        };
      })
      .sort((a, b) => {
        // Priority: running > next > approaching > waiting > skipped
        const priority = { running: 0, next: 1, approaching: 2, waiting: 3, passed_over: 4, skipped: 5 };
        return priority[a.status] - priority[b.status];
      });
  }, [docketItems, liveBoards, user?.id]);

  // Determine the primary focus case (most urgent)
  const focusCase = useMemo((): FocusModeCase | null => {
    if (!matchedCasesWithStatus.length) return null;
    // Return the most urgent case (first after sorting)
    return matchedCasesWithStatus[0];
  }, [matchedCasesWithStatus]);

  // Check if auto-activation conditions are met
  const shouldAutoActivate = useMemo(() => {
    if (!isCourtModeEnabled || !focusCase) return false;
    if (wasAutoDismissed) return false; // Don't re-activate if user manually exited

    // Condition 1: Case is running now
    if (focusCase.status === 'running') return true;

    // Condition 2: Case is within ≤3 items
    if (focusCase.distance >= 0 && focusCase.distance <= AUTO_ACTIVATION_DISTANCE && focusCase.isActive) return true;

    // Condition 3: Critical notification fired
    if (criticalUnacknowledged.length > 0) {
      const hasCriticalForMyCase = criticalUnacknowledged.some(
        n => n.threshold_crossed === 'immediate' || n.threshold_crossed === 'exception'
      );
      if (hasCriticalForMyCase) return true;
    }

    return false;
  }, [isCourtModeEnabled, focusCase, criticalUnacknowledged, wasAutoDismissed]);

  // Determine activation reason
  const activationReason = useMemo(() => {
    if (isManuallyActive) return 'manual';
    if (!shouldAutoActivate) return null;

    if (focusCase?.status === 'running') return 'case_running';
    if (focusCase && focusCase.distance >= 0 && focusCase.distance <= AUTO_ACTIVATION_DISTANCE) return 'case_imminent';
    if (criticalUnacknowledged.length > 0) return 'critical_notification';

    return null;
  }, [isManuallyActive, shouldAutoActivate, focusCase, criticalUnacknowledged]);

  // Final active state
  const isActive = isManuallyActive || shouldAutoActivate;

  // Check if auto-exit conditions are met
  useEffect(() => {
    if (!isActive || isManuallyActive) return;

    // Auto-exit when:
    // - All matched cases are done/adjourned AND
    // - No cases remain active
    const allCasesDone = matchedCasesWithStatus.every(
      c => c.status === 'skipped' || c.status === 'passed_over' || c.docketItem.status === 'done'
    );

    if (allCasesDone && matchedCasesWithStatus.length > 0) {
      // Don't auto-exit immediately, wait for user acknowledgement
      // This is a safety measure - lawyer should explicitly exit
    }
  }, [isActive, isManuallyActive, matchedCasesWithStatus]);

  // Enter focus mode manually
  const enterFocusMode = useCallback(() => {
    setIsManuallyActive(true);
    setWasAutoDismissed(false);
  }, []);

  // Exit focus mode
  const exitFocusMode = useCallback(() => {
    setIsManuallyActive(false);
    setWasAutoDismissed(true);
    setLastExitedAt(Date.now());

    // Reset auto-dismiss after 5 minutes to allow re-triggering
    setTimeout(() => {
      setWasAutoDismissed(false);
    }, 5 * 60 * 1000);
  }, []);

  // Get last updated timestamp for freshness
  const lastUpdatedAt = useMemo(() => {
    const timestamps = [liveBoardUpdatedAt, docketUpdatedAt].filter(Boolean);
    return timestamps.length > 0 ? Math.max(...timestamps) : null;
  }, [liveBoardUpdatedAt, docketUpdatedAt]);

  return {
    // State
    isActive,
    activationReason,
    focusCase,
    allMatchedCases: matchedCasesWithStatus,
    canAutoActivate: !wasAutoDismissed && isCourtModeEnabled,

    // Metadata
    isCourtModeEnabled,
    isPWAStandalone,
    isOnline,
    lastUpdatedAt,

    // Actions
    enterFocusMode,
    exitFocusMode,

    // For testing
    _shouldAutoActivate: shouldAutoActivate,
  };
}
