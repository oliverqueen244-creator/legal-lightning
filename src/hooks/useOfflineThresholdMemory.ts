import { useRef, useCallback, useEffect } from 'react';
import { useNetworkStatus } from './useNetworkStatus';

/**
 * P0 FIX: Offline Threshold Memory
 * 
 * Tracks proximity thresholds crossed while offline.
 * On reconnect, enables safe replay of ONE notification per case.
 * 
 * Core Principle: Never fabricate alerts. Only acknowledge that a 
 * threshold WOULD HAVE been crossed while offline.
 */

interface OfflineThresholdEntry {
  lastKnownDistance: number;
  highestThresholdCrossed: 'warning' | 'critical' | null;
  caseFingerprint: string;
  hearingDate: string;
  docketId: string;
  caseNumber: string;
  courtRoomNo: string;
  itemNo: number;
}

// In-memory store keyed by case_fingerprint + hearing_date
type OfflineThresholdStore = Map<string, OfflineThresholdEntry>;

export function useOfflineThresholdMemory() {
  const { isOnline } = useNetworkStatus();
  const storeRef = useRef<OfflineThresholdStore>(new Map());
  const wasOfflineRef = useRef<boolean>(!navigator.onLine);
  const replayedTodayRef = useRef<Set<string>>(new Set());

  /**
   * Track a case's threshold while offline.
   * Called by notification system when detecting threshold crossings.
   */
  const trackOfflineThreshold = useCallback((
    caseFingerprint: string,
    hearingDate: string,
    docketId: string,
    caseNumber: string,
    courtRoomNo: string,
    itemNo: number,
    distance: number
  ) => {
    // Only track when offline
    if (navigator.onLine) return;

    const key = `${caseFingerprint}-${hearingDate}`;
    const existing = storeRef.current.get(key);

    // Determine threshold level based on distance
    let thresholdLevel: 'warning' | 'critical' | null = null;
    if (distance >= 6 && distance <= 10) {
      thresholdLevel = 'warning';
    } else if (distance >= 0 && distance <= 5) {
      thresholdLevel = 'critical';
    }

    // Only upgrade threshold, never downgrade
    const shouldUpdate = !existing || 
      (thresholdLevel === 'critical' && existing.highestThresholdCrossed !== 'critical') ||
      (thresholdLevel === 'warning' && !existing.highestThresholdCrossed);

    if (shouldUpdate && thresholdLevel) {
      storeRef.current.set(key, {
        lastKnownDistance: distance,
        highestThresholdCrossed: thresholdLevel === 'critical' ? 'critical' : 
          (existing?.highestThresholdCrossed === 'critical' ? 'critical' : thresholdLevel),
        caseFingerprint,
        hearingDate,
        docketId,
        caseNumber,
        courtRoomNo,
        itemNo,
      });
    }
  }, []);

  /**
   * Get cases that need replay notification on reconnect.
   * Only returns CRITICAL thresholds crossed while offline.
   * One replay per case per day max.
   */
  const getCasesForReplay = useCallback((): OfflineThresholdEntry[] => {
    const today = new Date().toISOString().split('T')[0];
    const casesToReplay: OfflineThresholdEntry[] = [];

    storeRef.current.forEach((entry, key) => {
      // Only replay critical thresholds
      if (entry.highestThresholdCrossed !== 'critical') return;
      
      // Only replay for today's hearings
      if (entry.hearingDate !== today) return;

      // One replay per case per day
      const replayKey = `${key}-${today}`;
      if (replayedTodayRef.current.has(replayKey)) return;

      casesToReplay.push(entry);
    });

    return casesToReplay;
  }, []);

  /**
   * Mark a case as replayed (prevents duplicate notifications)
   */
  const markAsReplayed = useCallback((caseFingerprint: string, hearingDate: string) => {
    const today = new Date().toISOString().split('T')[0];
    const key = `${caseFingerprint}-${hearingDate}`;
    const replayKey = `${key}-${today}`;
    
    replayedTodayRef.current.add(replayKey);
    storeRef.current.delete(key);
  }, []);

  /**
   * Clear all stored thresholds (e.g., on logout or day change)
   */
  const clearStore = useCallback(() => {
    storeRef.current.clear();
    replayedTodayRef.current.clear();
  }, []);

  // Track online/offline transitions
  useEffect(() => {
    wasOfflineRef.current = !isOnline;
  }, [isOnline]);

  /**
   * Check if we just came back online (for triggering replay)
   */
  const justReconnected = useCallback(() => {
    const wasOffline = wasOfflineRef.current;
    const nowOnline = isOnline;
    return wasOffline && nowOnline;
  }, [isOnline]);

  return {
    trackOfflineThreshold,
    getCasesForReplay,
    markAsReplayed,
    clearStore,
    justReconnected,
    isOnline,
  };
}
