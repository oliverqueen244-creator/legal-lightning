/**
 * WAIT TIME ESTIMATE HOOK
 * 
 * Provides estimated wait time based on configurable average minutes per case.
 * 
 * NOTE: Due to lack of historical case progression data,
 * this uses a conservative fixed average as a baseline.
 * 
 * Formula: estimated_time = cases_away × avg_minutes_per_case
 * 
 * Display rules:
 * - Range format (e.g., "~35–45 min")
 * - "Time estimate unavailable" if data insufficient
 * - Never show outside court hours
 * 
 * No predictive AI. All logic is explainable and auditable.
 */

import { useMemo } from 'react';

// Average minutes per case (conservative estimate based on court observations)
// This should ideally come from actual data aggregation
const AVG_MINUTES_PER_CASE = 5;
const VARIANCE_FACTOR = 0.3; // ±30% variance

export interface WaitTimeEstimate {
  /** Estimated minutes (midpoint) */
  estimatedMinutes: number | null;
  /** Lower bound of estimate */
  minMinutes: number | null;
  /** Upper bound of estimate */
  maxMinutes: number | null;
  /** Formatted display string (e.g., "~35–45 min") */
  displayText: string;
  /** Whether the estimate is reliable (has sufficient data) */
  isReliable: boolean;
  /** Data source for audit */
  source: 'default_average' | 'insufficient_data';
  /** Average minutes per case used */
  avgMinutesPerCase: number | null;
}

/**
 * Calculate wait time estimate for a specific court
 * 
 * @param casesAway - Number of cases ahead in queue
 * @param inSession - Whether court is in active session
 * @returns WaitTimeEstimate with display text and reliability info
 */
export function useWaitTimeEstimate(
  courtLocation: string | undefined,
  courtNo: string | undefined,
  casesAway: number,
  inSession: boolean
): WaitTimeEstimate {
  return useMemo((): WaitTimeEstimate => {
    // Don't show estimate outside session or when already at/past turn
    if (!inSession || casesAway <= 0 || !courtLocation || !courtNo) {
      return {
        estimatedMinutes: null,
        minMinutes: null,
        maxMinutes: null,
        displayText: '',
        isReliable: false,
        source: 'insufficient_data',
        avgMinutesPerCase: null,
      };
    }

    // Use default average (in future, could pull from aggregated court stats)
    const avgMinutesPerCase = AVG_MINUTES_PER_CASE;
    
    // Calculate estimate with variance
    const baseEstimate = casesAway * avgMinutesPerCase;
    const minMinutes = Math.max(1, Math.round(baseEstimate * (1 - VARIANCE_FACTOR)));
    const maxMinutes = Math.round(baseEstimate * (1 + VARIANCE_FACTOR));
    const estimatedMinutes = Math.round(baseEstimate);

    // Format display text
    let displayText: string;
    if (maxMinutes < 5) {
      // Very short wait - just show approximate
      displayText = `~${estimatedMinutes} min`;
    } else if (maxMinutes >= 60) {
      // Over an hour - format with hours
      const minHrs = Math.floor(minMinutes / 60);
      const maxHrs = Math.floor(maxMinutes / 60);
      const minMins = minMinutes % 60;
      const maxMins = maxMinutes % 60;
      
      if (minHrs === 0) {
        displayText = `~${minMinutes}m – ${maxHrs}h${maxMins > 0 ? ` ${maxMins}m` : ''}`;
      } else if (minHrs === maxHrs) {
        displayText = `~${minHrs}h ${minMins}–${maxMins}m`;
      } else {
        displayText = `~${minHrs}h – ${maxHrs}h`;
      }
    } else {
      displayText = `~${minMinutes}–${maxMinutes} min`;
    }

    return {
      estimatedMinutes,
      minMinutes,
      maxMinutes,
      displayText,
      isReliable: false, // Mark as not reliable since using default average
      source: 'default_average',
      avgMinutesPerCase,
    };
  }, [inSession, casesAway, courtLocation, courtNo]);
}

/**
 * Simple hook to check if wait time should be visible
 * Based on court session state only
 */
export function useCanShowWaitTime(inSession: boolean): boolean {
  return inSession;
}
