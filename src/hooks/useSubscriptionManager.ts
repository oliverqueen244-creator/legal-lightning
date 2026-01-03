import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type SubscriptionCallback = (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;

interface SubscriptionConfig {
  table: string;
  schema?: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  filter?: string;
}

interface ManagedSubscription {
  channel: RealtimeChannel;
  callbacks: Set<SubscriptionCallback>;
  refCount: number;
}

// Global subscription registry to consolidate channels
const subscriptionRegistry = new Map<string, ManagedSubscription>();

function getSubscriptionKey(config: SubscriptionConfig): string {
  return `${config.schema || 'public'}:${config.table}:${config.event || '*'}:${config.filter || ''}`;
}

export function useSubscriptionManager() {
  const activeSubscriptionsRef = useRef<Set<string>>(new Set());

  const subscribe = useCallback((
    config: SubscriptionConfig,
    callback: SubscriptionCallback
  ): (() => void) => {
    const key = getSubscriptionKey(config);
    
    let managed = subscriptionRegistry.get(key);
    
    if (!managed) {
      // Create new channel with proper typing
      const channelConfig = {
        event: config.event || '*',
        schema: config.schema || 'public',
        table: config.table,
        filter: config.filter,
      } as const;

      const channel = supabase
        .channel(`managed:${key}`)
        .on(
          'postgres_changes' as const,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          channelConfig as any,
          (payload: unknown) => {
            // Notify all callbacks
            const sub = subscriptionRegistry.get(key);
            if (sub) {
              sub.callbacks.forEach(cb => cb(payload as RealtimePostgresChangesPayload<Record<string, unknown>>));
            }
          }
        )
        .subscribe();

      managed = {
        channel,
        callbacks: new Set(),
        refCount: 0,
      };
      subscriptionRegistry.set(key, managed);
    }

    // Add callback and increment ref count
    managed.callbacks.add(callback);
    managed.refCount++;
    activeSubscriptionsRef.current.add(key);

    // Return unsubscribe function
    return () => {
      const sub = subscriptionRegistry.get(key);
      if (sub) {
        sub.callbacks.delete(callback);
        sub.refCount--;
        activeSubscriptionsRef.current.delete(key);

        // Clean up if no more subscribers
        if (sub.refCount <= 0) {
          supabase.removeChannel(sub.channel);
          subscriptionRegistry.delete(key);
        }
      }
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      activeSubscriptionsRef.current.forEach((key) => {
        const sub = subscriptionRegistry.get(key);
        if (sub) {
          sub.refCount--;
          if (sub.refCount <= 0) {
            supabase.removeChannel(sub.channel);
            subscriptionRegistry.delete(key);
          }
        }
      });
    };
  }, []);

  return {
    subscribe,
    activeCount: subscriptionRegistry.size,
  };
}

// Hook for common table subscriptions with automatic management
export function useTableSubscription(
  config: SubscriptionConfig,
  callback: SubscriptionCallback,
  deps: unknown[] = []
) {
  const { subscribe } = useSubscriptionManager();

  useEffect(() => {
    const unsubscribe = subscribe(config, callback);
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.table, config.event, config.filter, ...deps]);
}
