/**
 * WAIT TIME ESTIMATE HOOK
 * 
 * Provides estimated wait time based on court-specific historical averages.
 * Falls back to a conservative default when insufficient data is available.
 * 
 * Data Source:
 * - Primary: court_avg_duration table (aggregated from case_item_durations)
 * - Fallback: DEFAULT_AVG_SECONDS (300s / 5 min)
 * 
 * Formula: estimated_time = cases_away × avg_seconds_per_case
 * 
 * Display rules:
 * - Range format (e.g., "~35–45 min")
 * - Shows confidence indicator based on sample count
 * - Never show outside court hours
 * 
 * All logic is explainable and auditable.
 */

import { useMemo } from 'react';
import { useCourtDurationAverage, getDurationConfidenceLevel } from './useCourtDurationAverage';

// Fallback: 5 minutes per case (if no historical data)
const DEFAULT_AVG_MINUTES = 5;
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
  /** Whether the estimate is reliable (has sufficient historical data) */
  isReliable: boolean;
  /** Confidence level based on sample count */
  confidenceLevel: 'high' | 'medium' | 'low';
  /** Number of historical samples used */
  sampleCount: number;
  /** Data source for audit */
  source: 'historical' | 'default' | 'insufficient_data';
  /** Average minutes per case used */
  avgMinutesPerCase: number | null;
}

/**
 * Calculate wait time estimate for a specific court
 * 
 * @param courtLocation - Court location (JODHPUR/JAIPUR)
 * @param courtNo - Court number
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
  // Fetch court-specific historical average
  const durationAvg = useCourtDurationAverage(courtLocation, courtNo);
  
  return useMemo((): WaitTimeEstimate => {
    // Don't show estimate outside session or when already at/past turn
    if (!inSession || casesAway <= 0 || !courtLocation || !courtNo) {
      return {
        estimatedMinutes: null,
        minMinutes: null,
        maxMinutes: null,
        displayText: '',
        isReliable: false,
        confidenceLevel: 'low',
        sampleCount: 0,
        source: 'insufficient_data',
        avgMinutesPerCase: null,
      };
    }

    // Use historical average if available, otherwise fallback
    const avgMinutesPerCase = durationAvg.source === 'historical'
      ? durationAvg.avgSecondsPerCase / 60
      : DEFAULT_AVG_MINUTES;
    
    const confidenceLevel = getDurationConfidenceLevel(durationAvg.sampleCount);
    
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
      isReliable: durationAvg.isReliable,
      confidenceLevel,
      sampleCount: durationAvg.sampleCount,
      source: durationAvg.source,
      avgMinutesPerCase,
    };
  }, [inSession, casesAway, courtLocation, courtNo, durationAvg]);
}

/**
 * Simple hook to check if wait time should be visible
 * Based on court session state only
 */
export function useCanShowWaitTime(inSession: boolean): boolean {
  return inSession;
}
