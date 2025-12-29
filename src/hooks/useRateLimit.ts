import { useState, useCallback, useRef } from 'react';

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

interface RateLimitState {
  isLimited: boolean;
  remainingRequests: number;
  resetTime: number | null;
}

const DEFAULT_CONFIGS: Record<string, RateLimitConfig> = {
  aliasEdit: { maxRequests: 10, windowMs: 60000 }, // 10 per minute
  dashboardRefresh: { maxRequests: 30, windowMs: 60000 }, // 30 per minute
  search: { maxRequests: 20, windowMs: 60000 }, // 20 per minute
  default: { maxRequests: 60, windowMs: 60000 }, // 60 per minute
};

const requestTimestamps: Record<string, number[]> = {};

export function useRateLimit(actionType: keyof typeof DEFAULT_CONFIGS = 'default') {
  const config = DEFAULT_CONFIGS[actionType] || DEFAULT_CONFIGS.default;
  const [state, setState] = useState<RateLimitState>({
    isLimited: false,
    remainingRequests: config.maxRequests,
    resetTime: null,
  });

  const checkAndRecord = useCallback((): boolean => {
    const now = Date.now();
    const key = actionType;
    
    // Initialize if needed
    if (!requestTimestamps[key]) {
      requestTimestamps[key] = [];
    }
    
    // Clean old timestamps
    requestTimestamps[key] = requestTimestamps[key].filter(
      ts => now - ts < config.windowMs
    );
    
    // Check if limited
    if (requestTimestamps[key].length >= config.maxRequests) {
      const oldestRequest = requestTimestamps[key][0];
      const resetTime = oldestRequest + config.windowMs;
      
      setState({
        isLimited: true,
        remainingRequests: 0,
        resetTime,
      });
      
      return false;
    }
    
    // Record this request
    requestTimestamps[key].push(now);
    
    setState({
      isLimited: false,
      remainingRequests: config.maxRequests - requestTimestamps[key].length,
      resetTime: null,
    });
    
    return true;
  }, [actionType, config]);

  const executeWithLimit = useCallback(
    async <T>(fn: () => Promise<T>): Promise<T | null> => {
      if (!checkAndRecord()) {
        return null;
      }
      return fn();
    },
    [checkAndRecord]
  );

  return {
    ...state,
    checkAndRecord,
    executeWithLimit,
  };
}

// Utility to get remaining time until reset
export function getTimeUntilReset(resetTime: number | null): number {
  if (!resetTime) return 0;
  return Math.max(0, resetTime - Date.now());
}
