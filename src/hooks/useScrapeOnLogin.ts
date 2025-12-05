import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Scrape interval: 30 minutes (in milliseconds)
const SCRAPE_INTERVAL_MS = 30 * 60 * 1000;

export function useScrapeOnLogin(userId: string | undefined) {
  const hasScrapedRef = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const scrapeAll = useCallback(async (reason: string) => {
    try {
      console.log(`[auto-scrape] Triggering scraper (${reason}) for both benches...`);
      
      const [jaipur, jodhpur] = await Promise.all([
        supabase.functions.invoke('scrape-causelist', {
          body: { action: 'scrape', bench: 'JAIPUR' }
        }),
        supabase.functions.invoke('scrape-causelist', {
          body: { action: 'scrape', bench: 'JODHPUR' }
        })
      ]);

      console.log(`[auto-scrape] Results (${reason}):`, {
        jaipur: jaipur.error ? `error: ${jaipur.error.message}` : 'success',
        jodhpur: jodhpur.error ? `error: ${jodhpur.error.message}` : 'success'
      });
    } catch (err) {
      console.error('[auto-scrape] Error triggering scraper:', err);
    }
  }, []);

  useEffect(() => {
    if (userId) {
      // Scrape on login (only once per session)
      if (!hasScrapedRef.current) {
        hasScrapedRef.current = true;
        scrapeAll('login');
      }

      // Set up interval scraping while logged in
      if (!intervalRef.current) {
        console.log(`[auto-scrape] Setting up interval scraping every ${SCRAPE_INTERVAL_MS / 60000} minutes`);
        
        intervalRef.current = setInterval(() => {
          scrapeAll('interval');
        }, SCRAPE_INTERVAL_MS);
      }
    }

    // Cleanup interval on unmount or logout
    return () => {
      if (intervalRef.current) {
        console.log('[auto-scrape] Clearing scrape interval');
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [userId, scrapeAll]);

  // Reset when user logs out
  useEffect(() => {
    if (!userId) {
      hasScrapedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [userId]);
}
