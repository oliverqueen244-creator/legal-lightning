import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { useCallback, useEffect, useState } from 'react';

interface VakalatDBSchema extends DBSchema {
  'docket-items': {
    key: string;
    value: {
      id: string;
      data: any;
      cachedAt: number;
    };
    indexes: { 'by-cached-at': number };
  };
  'case-documents': {
    key: string;
    value: {
      id: string;
      url: string;
      blob: Blob;
      cachedAt: number;
    };
    indexes: { 'by-cached-at': number };
  };
  'case-arguments': {
    key: string;
    value: {
      docketId: string;
      data: any[];
      cachedAt: number;
    };
    indexes: { 'by-docket-id': string };
  };
  'pending-mutations': {
    key: number;
    value: {
      id?: number;
      type: string;
      table: string;
      data: any;
      createdAt: number;
    };
    indexes: { 'by-created-at': number };
  };
}

const DB_NAME = 'vakalat-os-cache';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<VakalatDBSchema>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<VakalatDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Docket items store
        if (!db.objectStoreNames.contains('docket-items')) {
          const docketStore = db.createObjectStore('docket-items', { keyPath: 'id' });
          docketStore.createIndex('by-cached-at', 'cachedAt');
        }

        // Case documents store
        if (!db.objectStoreNames.contains('case-documents')) {
          const docsStore = db.createObjectStore('case-documents', { keyPath: 'id' });
          docsStore.createIndex('by-cached-at', 'cachedAt');
        }

        // Case arguments store
        if (!db.objectStoreNames.contains('case-arguments')) {
          const argsStore = db.createObjectStore('case-arguments', { keyPath: 'docketId' });
          argsStore.createIndex('by-docket-id', 'docketId');
        }

        // Pending mutations store (for offline queue)
        if (!db.objectStoreNames.contains('pending-mutations')) {
          const mutationsStore = db.createObjectStore('pending-mutations', { 
            keyPath: 'id',
            autoIncrement: true 
          });
          mutationsStore.createIndex('by-created-at', 'createdAt');
        }
      },
    });
  }
  return dbPromise;
}

export function useOfflineCache() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Cache docket items
  const cacheDocketItems = useCallback(async (items: any[]) => {
    const db = await getDB();
    const tx = db.transaction('docket-items', 'readwrite');
    const now = Date.now();
    
    await Promise.all([
      ...items.map(item => 
        tx.store.put({ id: item.id, data: item, cachedAt: now })
      ),
      tx.done,
    ]);
  }, []);

  const getCachedDocketItems = useCallback(async () => {
    const db = await getDB();
    const items = await db.getAll('docket-items');
    return items.map(item => item.data);
  }, []);

  // Cache PDF documents
  const cacheDocument = useCallback(async (docId: string, url: string) => {
    try {
      const response = await fetch(url);
      if (!response.ok) return;
      
      const blob = await response.blob();
      const db = await getDB();
      
      await db.put('case-documents', {
        id: docId,
        url,
        blob,
        cachedAt: Date.now(),
      });
    } catch (error) {
      console.warn('Failed to cache document:', error);
    }
  }, []);

  const getCachedDocument = useCallback(async (docId: string): Promise<string | null> => {
    try {
      const db = await getDB();
      const doc = await db.get('case-documents', docId);
      
      if (doc?.blob) {
        return URL.createObjectURL(doc.blob);
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  // Cache arguments
  const cacheArguments = useCallback(async (docketId: string, args: any[]) => {
    const db = await getDB();
    await db.put('case-arguments', {
      docketId,
      data: args,
      cachedAt: Date.now(),
    });
  }, []);

  const getCachedArguments = useCallback(async (docketId: string) => {
    const db = await getDB();
    const cached = await db.get('case-arguments', docketId);
    return cached?.data || null;
  }, []);

  // Queue mutations for offline sync
  const queueMutation = useCallback(async (type: string, table: string, data: any) => {
    const db = await getDB();
    await db.add('pending-mutations', {
      type,
      table,
      data,
      createdAt: Date.now(),
    });
  }, []);

  const getPendingMutations = useCallback(async () => {
    const db = await getDB();
    return db.getAll('pending-mutations');
  }, []);

  const clearPendingMutation = useCallback(async (id: number) => {
    const db = await getDB();
    await db.delete('pending-mutations', id);
  }, []);

  return {
    isOnline,
    cacheDocketItems,
    getCachedDocketItems,
    cacheDocument,
    getCachedDocument,
    cacheArguments,
    getCachedArguments,
    queueMutation,
    getPendingMutations,
    clearPendingMutation,
  };
}