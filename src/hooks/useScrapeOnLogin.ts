import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useScrapeOnLogin(userId: string | undefined) {
  const hasScrapedRef = useRef(false);

  useEffect(() => {
    if (userId && !hasScrapedRef.current) {
      hasScrapedRef.current = true;
      
      // Trigger scraper for both benches in background (don't block UI)
      const scrapeAll = async () => {
        try {
          console.log('[login-scrape] Triggering scraper for both benches...');
          
          const [jaipur, jodhpur] = await Promise.all([
            supabase.functions.invoke('scrape-causelist', {
              body: { action: 'scrape', bench: 'JAIPUR' }
            }),
            supabase.functions.invoke('scrape-causelist', {
              body: { action: 'scrape', bench: 'JODHPUR' }
            })
          ]);

          console.log('[login-scrape] Results:', {
            jaipur: jaipur.error ? 'error' : 'success',
            jodhpur: jodhpur.error ? 'error' : 'success'
          });
        } catch (err) {
          console.error('[login-scrape] Error triggering scraper:', err);
        }
      };

      // Run in background without blocking
      scrapeAll();
    }
  }, [userId]);
}
