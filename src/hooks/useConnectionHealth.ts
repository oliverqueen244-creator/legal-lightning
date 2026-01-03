import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ConnectionHealth {
  isHealthy: boolean;
  latency: number | null;
  lastCheck: Date | null;
  consecutiveFailures: number;
  realtimeStatus: 'connected' | 'connecting' | 'disconnected';
}

interface ConnectionHealthConfig {
  checkInterval?: number; // ms
  maxLatency?: number; // ms - threshold for "unhealthy"
  maxFailures?: number; // consecutive failures before marking unhealthy
}

const DEFAULT_CHECK_INTERVAL = 30000; // 30 seconds
const DEFAULT_MAX_LATENCY = 5000; // 5 seconds
const DEFAULT_MAX_FAILURES = 3;

export function useConnectionHealth(config: ConnectionHealthConfig = {}) {
  const {
    checkInterval = DEFAULT_CHECK_INTERVAL,
    maxLatency = DEFAULT_MAX_LATENCY,
    maxFailures = DEFAULT_MAX_FAILURES,
  } = config;

  const [health, setHealth] = useState<ConnectionHealth>({
    isHealthy: true,
    latency: null,
    lastCheck: null,
    consecutiveFailures: 0,
    realtimeStatus: 'connecting',
  });

  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const checkHealth = useCallback(async () => {
    const startTime = Date.now();
    
    try {
      // Simple health check query
      const { error } = await supabase
        .from('profiles')
        .select('id')
        .limit(1)
        .maybeSingle();
      
      const latency = Date.now() - startTime;
      const isHealthy = !error && latency < maxLatency;

      setHealth(prev => ({
        ...prev,
        isHealthy,
        latency,
        lastCheck: new Date(),
        consecutiveFailures: isHealthy ? 0 : prev.consecutiveFailures + 1,
      }));
    } catch {
      setHealth(prev => ({
        ...prev,
        isHealthy: prev.consecutiveFailures + 1 < maxFailures,
        latency: null,
        lastCheck: new Date(),
        consecutiveFailures: prev.consecutiveFailures + 1,
      }));
    }
  }, [maxLatency, maxFailures]);

  // Monitor realtime connection status
  useEffect(() => {
    realtimeChannelRef.current = supabase
      .channel('health-monitor')
      .subscribe((status) => {
        setHealth(prev => ({
          ...prev,
          realtimeStatus: status === 'SUBSCRIBED' ? 'connected' : 
                          status === 'CLOSED' ? 'disconnected' : 'connecting',
        }));
      });

    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
      }
    };
  }, []);

  // Periodic health checks
  useEffect(() => {
    checkHealth(); // Initial check

    checkIntervalRef.current = setInterval(checkHealth, checkInterval);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [checkHealth, checkInterval]);

  const forceCheck = useCallback(() => {
    checkHealth();
  }, [checkHealth]);

  return {
    ...health,
    forceCheck,
  };
}

// Export metrics for monitoring
export function getConnectionMetrics() {
  return {
    activeSubscriptions: 0, // Would be populated by subscription manager
    pendingRequests: 0, // Would be populated by query cache
  };
}
