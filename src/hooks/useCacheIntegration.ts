import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { DocketItem, LiveBoardCache } from '@/types/database';
import type { MorningBrief } from './useMorningBrief';

// ============================================================================
// PHASE 1: IndexedDB → React Query Cache Integration
// This hook hydrates React Query with cached data on startup for instant render
// ============================================================================

interface NyayHubCacheSchema extends DBSchema {
  'query-cache': {
    key: string;
    value: {
      queryKey: string;
      data: any;
      cachedAt: number;
      userId?: string;
    };
    indexes: { 'by-cached-at': number };
  };
}

const CACHE_DB_NAME = 'nyayhub-query-cache';
const CACHE_DB_VERSION = 1;
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

let cacheDbPromise: Promise<IDBPDatabase<NyayHubCacheSchema>> | null = null;

function getCacheDB() {
  if (!cacheDbPromise) {
    cacheDbPromise = openDB<NyayHubCacheSchema>(CACHE_DB_NAME, CACHE_DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('query-cache')) {
          const store = db.createObjectStore('query-cache', { keyPath: 'queryKey' });
          store.createIndex('by-cached-at', 'cachedAt');
        }
      },
    });
  }
  return cacheDbPromise;
}

// Cache key generators for consistent keys
export function getDocketCacheKey(userId: string | undefined, date: string): string {
  return `docket-${userId || 'anonymous'}-${date}`;
}

export function getLiveBoardCacheKey(): string {
  return 'liveBoard';
}

export function getMorningBriefCacheKey(userId: string | undefined): string {
  return `morning-brief-${userId || 'anonymous'}`;
}

export function getUpcomingCacheKey(userId: string | undefined): string {
  return `upcoming-${userId || 'anonymous'}`;
}

// Check if cached data exists (for splash screen decision)
export async function hasCachedDashboardData(userId?: string): Promise<boolean> {
  try {
    const db = await getCacheDB();
    const today = new Date().toISOString().split('T')[0];
    const docketKey = getDocketCacheKey(userId, today);
    const liveBoardKey = getLiveBoardCacheKey();
    
    const [docket, liveBoard] = await Promise.all([
      db.get('query-cache', docketKey),
      db.get('query-cache', liveBoardKey),
    ]);
    
    const now = Date.now();
    const hasValidDocket = docket && (now - docket.cachedAt) < CACHE_MAX_AGE;
    const hasValidLiveBoard = liveBoard && (now - liveBoard.cachedAt) < CACHE_MAX_AGE;
    
    return !!(hasValidDocket || hasValidLiveBoard);
  } catch {
    return false;
  }
}

// Save data to IndexedDB cache
export async function saveToCache(
  queryKey: string,
  data: any,
  userId?: string
): Promise<void> {
  try {
    const db = await getCacheDB();
    await db.put('query-cache', {
      queryKey,
      data,
      cachedAt: Date.now(),
      userId,
    });
  } catch (error) {
    console.warn('[Cache] Failed to save:', queryKey, error);
  }
}

// Load data from IndexedDB cache
export async function loadFromCache<T>(queryKey: string): Promise<{ data: T; cachedAt: number } | null> {
  try {
    const db = await getCacheDB();
    const cached = await db.get('query-cache', queryKey);
    
    if (!cached) return null;
    
    // Check if cache is expired
    const age = Date.now() - cached.cachedAt;
    if (age > CACHE_MAX_AGE) {
      // Delete expired cache
      await db.delete('query-cache', queryKey);
      return null;
    }
    
    return { data: cached.data as T, cachedAt: cached.cachedAt };
  } catch {
    return null;
  }
}

// Clean up old cache entries
export async function cleanupExpiredCache(): Promise<void> {
  try {
    const db = await getCacheDB();
    const tx = db.transaction('query-cache', 'readwrite');
    const index = tx.store.index('by-cached-at');
    const cutoff = Date.now() - CACHE_MAX_AGE;
    
    let cursor = await index.openCursor(IDBKeyRange.upperBound(cutoff));
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    
    await tx.done;
  } catch (error) {
    console.warn('[Cache] Cleanup failed:', error);
  }
}

/**
 * Hook to integrate IndexedDB cache with React Query
 * Hydrates cache on mount and saves updates
 */
export function useCacheHydration(userId: string | undefined) {
  const queryClient = useQueryClient();
  const hydratedRef = useRef(false);

  // Hydrate React Query cache from IndexedDB on startup
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;

    const hydrate = async () => {
      const today = new Date().toISOString().split('T')[0];
      
      // Load all cached data in parallel
      const [docketCache, liveBoardCache, briefCache, upcomingCache] = await Promise.all([
        loadFromCache<DocketItem[]>(getDocketCacheKey(userId, today)),
        loadFromCache<LiveBoardCache[]>(getLiveBoardCacheKey()),
        loadFromCache<MorningBrief>(getMorningBriefCacheKey(userId)),
        loadFromCache<DocketItem[]>(getUpcomingCacheKey(userId)),
      ]);

      // Hydrate React Query cache with stale data
      if (docketCache?.data) {
        queryClient.setQueryData(['docket', userId, today], docketCache.data);
        console.log('[Cache] Hydrated docket from IndexedDB');
      }
      
      if (liveBoardCache?.data) {
        queryClient.setQueryData(['liveBoard'], liveBoardCache.data);
        console.log('[Cache] Hydrated liveBoard from IndexedDB');
      }
      
      if (briefCache?.data) {
        queryClient.setQueryData(['morning-brief', userId], briefCache.data);
        console.log('[Cache] Hydrated morning-brief from IndexedDB');
      }
      
      if (upcomingCache?.data) {
        queryClient.setQueryData(['upcoming-cases', userId], upcomingCache.data);
        console.log('[Cache] Hydrated upcoming-cases from IndexedDB');
      }
      
      // Cleanup old entries periodically
      cleanupExpiredCache();
    };

    hydrate();
  }, [userId, queryClient]);

  // Save docket data when it changes
  const saveDocketCache = useCallback(
    async (data: DocketItem[], date: string) => {
      await saveToCache(getDocketCacheKey(userId, date), data, userId);
    },
    [userId]
  );

  // Save live board data when it changes
  const saveLiveBoardCache = useCallback(async (data: LiveBoardCache[]) => {
    await saveToCache(getLiveBoardCacheKey(), data);
  }, []);

  // Save morning brief when it changes
  const saveMorningBriefCache = useCallback(
    async (data: MorningBrief) => {
      await saveToCache(getMorningBriefCacheKey(userId), data, userId);
    },
    [userId]
  );

  // Save upcoming cases when it changes
  const saveUpcomingCache = useCallback(
    async (data: DocketItem[]) => {
      await saveToCache(getUpcomingCacheKey(userId), data, userId);
    },
    [userId]
  );

  return {
    saveDocketCache,
    saveLiveBoardCache,
    saveMorningBriefCache,
    saveUpcomingCache,
  };
}
