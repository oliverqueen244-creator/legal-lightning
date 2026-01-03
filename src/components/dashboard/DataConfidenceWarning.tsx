import { useActiveConfidenceWarnings } from '@/hooks/useParserConfidence';
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

/**
 * Subtle warning banner for lawyers when parsing confidence is low
 * 
 * RULES:
 * - Never shows numeric scores
 * - Never blocks access
 * - Only displays when confidence < 60 (warning_issued = true)
 * - Shown subtly, not alarmingly
 */
export function DataConfidenceWarning() {
  const { data: warnings } = useActiveConfidenceWarnings();
  
  // No warnings active
  if (!warnings || warnings.length === 0) {
    return null;
  }
  
  // Count how many benches have warnings
  const warningCount = warnings.length;
  
  return (
    <Alert variant="default" className="border-yellow-200 bg-yellow-50/50 dark:bg-yellow-950/20 dark:border-yellow-800/50">
      <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
      <AlertDescription className="text-sm text-yellow-700 dark:text-yellow-400">
        {warningCount === 1 ? (
          <>Court data may be incomplete today. Verify critical cases if needed.</>
        ) : (
          <>Court data for {warningCount} benches may be incomplete today. Verify critical cases if needed.</>
        )}
      </AlertDescription>
    </Alert>
  );
}
