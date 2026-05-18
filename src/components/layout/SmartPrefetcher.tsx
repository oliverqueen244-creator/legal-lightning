import { useEffect } from 'react';
import { useMorningBrief } from '@/hooks/useMorningBrief';

/**
 * SmartPrefetcher Component
 * 
 * Background task that pre-caches documents for today's cases.
 * Ensures that when a lawyer opens a PDF in court, it's already local.
 * This is critical for Phase 4: Advanced PWA Resilience.
 */
export function SmartPrefetcher() {
    const { data: brief } = useMorningBrief();

    useEffect(() => {
        // Request persistent storage if supported
        if (navigator.storage && navigator.storage.persist) {
            navigator.storage.persist().then(persistent => {
                if (persistent) {
                    if (import.meta.env.DEV) console.log('[SmartPrefetcher] Storage is persistent');
                } else {
                    if (import.meta.env.DEV) console.log('[SmartPrefetcher] Storage is not persistent');
                }
            });
        }
    }, []);

    useEffect(() => {
        if (!brief || brief.cases.length === 0) return;

        const prefetchDocs = async () => {
            // Sort by item number to prioritize early cases
            const imminentCases = [...brief.cases]
                .sort((a, b) => a.item_no - b.item_no)
                .slice(0, 8); // Pre-fetch more cases in Sovereign mode

            let cachedCount = 0;

            for (const caseItem of imminentCases) {
                const docsToFetch = caseItem.documents.filter(d => d.file_url);

                for (const doc of docsToFetch) {
                    try {
                        // Check if already in cache before fetching
                        const pdfCache = await caches.open('pdf-cache');
                        const cachedResponse = await pdfCache.match(doc.file_url!);

                        if (cachedResponse) continue;

                        // Use low priority fetch to seed the cache
                        // Service worker will intercept and put in 'pdf-cache'
                        await fetch(doc.file_url!, {
                            priority: 'low' as any,
                            mode: 'no-cors'
                        });

                        cachedCount++;
                    } catch (err) {
                        console.warn(`[SmartPrefetcher] Prefetch error for ${caseItem.case_number}:`, err);
                    }
                }
            }

            if (cachedCount > 0) {
                if (import.meta.env.DEV) console.log(`[SmartPrefetcher] ${cachedCount} documents pre-warmed for today.`);
            }
        };

        // Delay prefetch slightly to ensure main thread is free
        const timer = setTimeout(prefetchDocs, 3000);
        return () => clearTimeout(timer);
    }, [brief]);

    return null; // Invisible component
}
