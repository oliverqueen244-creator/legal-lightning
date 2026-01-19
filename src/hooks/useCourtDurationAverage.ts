/**
 * COURT DURATION AVERAGE HOOK
 * 
 * Fetches court-specific average case duration from historical data.
 * Falls back to default values when insufficient data is available.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CourtDurationAverage {
  avgSecondsPerCase: number;
  sampleCount: number;
  isReliable: boolean;
  lastUpdated: string | null;
  source: 'historical' | 'default';
}

// Default fallback: 5 minutes per case
const DEFAULT_AVG_SECONDS = 300;
const MIN_SAMPLES_FOR_RELIABILITY = 20;

/**
 * Fetch court-specific average duration
 */
export function useCourtDurationAverage(
  courtLocation: string | undefined,
  courtNo: string | undefined
): CourtDurationAverage {
  const { data } = useQuery({
    queryKey: ['court-avg-duration', courtLocation, courtNo],
    queryFn: async () => {
      if (!courtLocation || !courtNo) return null;
      
      const { data, error } = await supabase
        .from('court_avg_duration')
        .select('avg_seconds_per_case, sample_count, last_updated')
        .eq('court_location', courtLocation)
        .eq('court_no', courtNo)
        .maybeSingle();
      
      if (error) {
        console.warn('Failed to fetch court duration average:', error);
        return null;
      }
      
      return data;
    },
    enabled: !!courtLocation && !!courtNo,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
  
  // Return historical data if available and has sufficient samples
  if (data?.avg_seconds_per_case && data.sample_count >= 10) {
    return {
      avgSecondsPerCase: Number(data.avg_seconds_per_case),
      sampleCount: data.sample_count,
      isReliable: data.sample_count >= MIN_SAMPLES_FOR_RELIABILITY,
      lastUpdated: data.last_updated,
      source: 'historical',
    };
  }
  
  // Fallback to default
  return {
    avgSecondsPerCase: DEFAULT_AVG_SECONDS,
    sampleCount: 0,
    isReliable: false,
    lastUpdated: null,
    source: 'default',
  };
}

/**
 * Get confidence level description for UI
 */
export function getDurationConfidenceLevel(
  sampleCount: number
): 'high' | 'medium' | 'low' {
  if (sampleCount >= 50) return 'high';
  if (sampleCount >= 20) return 'medium';
  return 'low';
}

/**
 * Get confidence color class
 */
export function getDurationConfidenceColor(
  level: 'high' | 'medium' | 'low'
): string {
  switch (level) {
    case 'high':
      return 'text-court-success';
    case 'medium':
      return 'text-court-warning';
    case 'low':
      return 'text-muted-foreground';
  }
}
