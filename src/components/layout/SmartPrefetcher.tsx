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
        if (!brief || brief.cases.length === 0) return;

        // Prefetch documents for top 5 most imminent cases
        const prefetchDocs = () => {
            // Sort by item number to prioritize early cases
            const imminentCases = [...brief.cases]
                .sort((a, b) => a.item_no - b.item_no)
                .slice(0, 5);

            imminentCases.forEach(caseItem => {
                caseItem.documents.forEach(doc => {
                    if (doc.file_url) {
                        // Use low priority fetch to seed the cache
                        // The service worker will intercept this and store it in 'pdf-cache'
                        fetch(doc.file_url, { priority: 'low' as any })
                            .then(() => {
                                console.log(`[SmartPrefetcher] Cached: ${doc.document_type || 'DOC'} for Case ${caseItem.case_number}`);
                            })
                            .catch(err => {
                                console.warn(`[SmartPrefetcher] Prefetch failed for ${caseItem.case_number}:`, err);
                            });
                    }
                });
            });
        };

        // Delay prefetch slightly to ensure main thread is free
        const timer = setTimeout(prefetchDocs, 5000);
        return () => clearTimeout(timer);
    }, [brief]);

    return null; // Invisible component
}
