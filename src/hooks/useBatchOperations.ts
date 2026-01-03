import { useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface BatchConfig {
  maxBatchSize?: number;
  flushInterval?: number; // ms
  onError?: (error: Error, operations: BatchOperation[]) => void;
}

interface BatchOperation {
  table: string;
  operation: 'insert' | 'update' | 'upsert';
  data: Record<string, unknown> | Record<string, unknown>[];
  onConflict?: string;
  match?: Record<string, unknown>;
  resolve?: (result: unknown) => void;
  reject?: (error: Error) => void;
}

const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_FLUSH_INTERVAL = 100; // 100ms

export function useBatchOperations(config: BatchConfig = {}) {
  const {
    maxBatchSize = DEFAULT_BATCH_SIZE,
    flushInterval = DEFAULT_FLUSH_INTERVAL,
    onError,
  } = config;

  const batchQueueRef = useRef<Map<string, BatchOperation[]>>(new Map());
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isFlushing = useRef(false);

  const flush = useCallback(async () => {
    if (isFlushing.current || batchQueueRef.current.size === 0) return;
    
    isFlushing.current = true;
    const queues = new Map(batchQueueRef.current);
    batchQueueRef.current.clear();

    for (const [tableKey, operations] of queues) {
      const [table, operation] = tableKey.split(':');
      
      try {
        // Group by operation type and execute
        if (operation === 'insert') {
          const allData = operations.flatMap(op => 
            Array.isArray(op.data) ? op.data : [op.data]
          );
          
          // Use type assertion for dynamic table names
          const { data, error } = await (supabase
            .from(table as 'daily_court_docket')
            .insert(allData as never[]) as unknown as Promise<{ data: unknown[] | null; error: Error | null }>);
          
          if (error) throw error;
          
          // Resolve all promises
          operations.forEach((op, idx) => {
            op.resolve?.((data as unknown[])?.[idx]);
          });
        } else if (operation === 'upsert') {
          const allData = operations.flatMap(op => 
            Array.isArray(op.data) ? op.data : [op.data]
          );
          
          const onConflict = operations[0]?.onConflict;
          
          const { data, error } = await (supabase
            .from(table as 'daily_court_docket')
            .upsert(allData as never[], { onConflict }) as unknown as Promise<{ data: unknown[] | null; error: Error | null }>);
          
          if (error) throw error;
          
          operations.forEach((op, idx) => {
            op.resolve?.((data as unknown[])?.[idx]);
          });
        } else if (operation === 'update') {
          // Updates need to be executed individually due to different match conditions
          for (const op of operations) {
            try {
              const { data, error } = await (supabase
                .from(table as 'daily_court_docket')
                .update(op.data as never)
                .match(op.match || {})
                .select()
                .single() as unknown as Promise<{ data: unknown; error: Error | null }>);
              
              if (error) throw error;
              op.resolve?.(data);
            } catch (err) {
              op.reject?.(err as Error);
            }
          }
        }
      } catch (error) {
        onError?.(error as Error, operations);
        operations.forEach(op => op.reject?.(error as Error));
      }
    }

    isFlushing.current = false;
  }, [onError]);

  const scheduleFlush = useCallback(() => {
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
    }
    flushTimeoutRef.current = setTimeout(flush, flushInterval);
  }, [flush, flushInterval]);

  const addToBatch = useCallback(<T>(
    table: string,
    operation: 'insert' | 'update' | 'upsert',
    data: Record<string, unknown>,
    options?: { onConflict?: string; match?: Record<string, unknown> }
  ): Promise<T> => {
    return new Promise((resolve, reject) => {
      const key = `${table}:${operation}`;
      
      if (!batchQueueRef.current.has(key)) {
        batchQueueRef.current.set(key, []);
      }
      
      const queue = batchQueueRef.current.get(key)!;
      queue.push({
        table,
        operation,
        data,
        onConflict: options?.onConflict,
        match: options?.match,
        resolve: resolve as (result: unknown) => void,
        reject,
      });

      // Flush immediately if batch is full
      if (queue.length >= maxBatchSize) {
        flush();
      } else {
        scheduleFlush();
      }
    });
  }, [maxBatchSize, flush, scheduleFlush]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
      }
      // Flush remaining operations
      flush();
    };
  }, [flush]);

  return {
    insert: <T>(table: string, data: Record<string, unknown>) => 
      addToBatch<T>(table, 'insert', data),
    
    update: <T>(table: string, data: Record<string, unknown>, match: Record<string, unknown>) => 
      addToBatch<T>(table, 'update', data, { match }),
    
    upsert: <T>(table: string, data: Record<string, unknown>, onConflict?: string) => 
      addToBatch<T>(table, 'upsert', data, { onConflict }),
    
    flush,
    
    pendingCount: Array.from(batchQueueRef.current.values())
      .reduce((sum, ops) => sum + ops.length, 0),
  };
}
