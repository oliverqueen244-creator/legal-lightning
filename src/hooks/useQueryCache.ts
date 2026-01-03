import { useRef, useCallback } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface CacheConfig {
  ttl?: number; // Time to live in milliseconds
  maxEntries?: number;
}

const DEFAULT_TTL = 30000; // 30 seconds
const DEFAULT_MAX_ENTRIES = 100;

// Global cache storage
const globalCache = new Map<string, CacheEntry<unknown>>();
const pendingRequests = new Map<string, Promise<unknown>>();

export function useQueryCache<T>(config: CacheConfig = {}) {
  const { ttl = DEFAULT_TTL, maxEntries = DEFAULT_MAX_ENTRIES } = config;
  const cacheRef = useRef(globalCache);

  const cleanExpired = useCallback(() => {
    const now = Date.now();
    for (const [key, entry] of cacheRef.current.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        cacheRef.current.delete(key);
      }
    }
  }, []);

  const enforceMaxEntries = useCallback(() => {
    if (cacheRef.current.size > maxEntries) {
      const entriesToRemove = cacheRef.current.size - maxEntries;
      const keys = Array.from(cacheRef.current.keys());
      for (let i = 0; i < entriesToRemove; i++) {
        cacheRef.current.delete(keys[i]);
      }
    }
  }, [maxEntries]);

  const get = useCallback((key: string): T | null => {
    const entry = cacheRef.current.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      cacheRef.current.delete(key);
      return null;
    }
    
    return entry.data;
  }, []);

  const set = useCallback((key: string, data: T, customTtl?: number) => {
    cleanExpired();
    enforceMaxEntries();
    
    cacheRef.current.set(key, {
      data,
      timestamp: Date.now(),
      ttl: customTtl ?? ttl,
    });
  }, [ttl, cleanExpired, enforceMaxEntries]);

  const invalidate = useCallback((keyPattern?: string | RegExp) => {
    if (!keyPattern) {
      cacheRef.current.clear();
      return;
    }
    
    for (const key of cacheRef.current.keys()) {
      if (typeof keyPattern === 'string' ? key.includes(keyPattern) : keyPattern.test(key)) {
        cacheRef.current.delete(key);
      }
    }
  }, []);

  // Deduplicated fetch - prevents duplicate in-flight requests
  const fetchWithDedup = useCallback(async <R>(
    key: string,
    fetcher: () => Promise<R>,
    options: { forceFresh?: boolean; cacheTtl?: number } = {}
  ): Promise<R> => {
    const { forceFresh = false, cacheTtl } = options;

    // Check cache first (unless forcing fresh)
    if (!forceFresh) {
      const cached = get(key);
      if (cached !== null) {
        return cached as unknown as R;
      }
    }

    // Check for pending request
    const pending = pendingRequests.get(key) as Promise<R> | undefined;
    if (pending) {
      return pending;
    }

    // Create new request
    const request = fetcher()
      .then((data) => {
        set(key, data as unknown as T, cacheTtl);
        pendingRequests.delete(key);
        return data;
      })
      .catch((error) => {
        pendingRequests.delete(key);
        throw error;
      });

    pendingRequests.set(key, request as Promise<unknown>);
    return request;
  }, [get, set]);

  return {
    get,
    set,
    invalidate,
    fetchWithDedup,
    size: cacheRef.current.size,
  };
}

// Utility to generate cache keys
export function cacheKey(...parts: (string | number | undefined | null)[]): string {
  return parts.filter(Boolean).join(':');
}
