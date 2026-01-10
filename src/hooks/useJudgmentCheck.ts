import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

interface JudgmentCheckResult {
  found: boolean;
  judgment_date?: string;
  pdf_url?: string;
  stored?: boolean;
  message?: string;
  next_check_after?: string;
}

interface JudgmentCheckError {
  error: string;
  reason?: string;
  next_check_after?: string;
  retry_after?: number;
}

type CheckResult = 
  | { success: true; data: JudgmentCheckResult }
  | { success: false; error: JudgmentCheckError };

/**
 * Hook for lawyers to check if a final judgment has been uploaded for their case.
 * 
 * SCOPING RULES:
 * - Only works for cases owned by the authenticated lawyer
 * - CAPTCHA costs are attributed to the lawyer
 * - 7-day cooldown between checks
 * - Maximum 10 attempts per case
 */
export function useJudgmentCheck() {
  const { user } = useAuth();
  const [isChecking, setIsChecking] = useState(false);
  const [lastResult, setLastResult] = useState<CheckResult | null>(null);

  /**
   * Check if judgment is available for a tracked case
   * @param caseId - The tracked_case ID (not case_number)
   */
  const checkJudgment = async (caseId: string): Promise<CheckResult> => {
    if (!user) {
      const error = { error: 'Not authenticated', reason: 'no_auth' };
      setLastResult({ success: false, error });
      return { success: false, error };
    }

    setIsChecking(true);
    setLastResult(null);

    try {
      // First, check if we can even attempt this (guards)
      const { data: canCheckRaw, error: guardError } = await supabase
        .rpc('can_check_judgment', { 
          p_case_id: caseId, 
          p_lawyer_id: user.id 
        });

      if (guardError) {
        throw new Error(guardError.message);
      }

      const canCheck = canCheckRaw as { allowed: boolean; reason?: string; next_check_after?: string };

      if (!canCheck.allowed) {
        const reasonMessages: Record<string, string> = {
          'case_not_found': 'Case not found',
          'not_owner': 'This case does not belong to you',
          'judgment_already_found': 'Judgment has already been found for this case',
          'check_in_progress': 'A check is already in progress',
          'cooldown_active': `Please wait until ${canCheck.next_check_after ? new Date(canCheck.next_check_after).toLocaleDateString() : 'later'} to check again`,
          'max_attempts_exceeded': 'Maximum check attempts reached for this case',
        };

        const message = reasonMessages[canCheck.reason || 'unknown'] || canCheck.reason || 'Check not allowed';
        toast.error(message);

        const error = { 
          error: message, 
          reason: canCheck.reason,
          next_check_after: canCheck.next_check_after 
        };
        setLastResult({ success: false, error });
        return { success: false, error };
      }

      // Call the edge function to perform the actual check
      const { data: session } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('check-case-judgment', {
        body: { case_id: caseId },
        headers: {
          Authorization: `Bearer ${session?.session?.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = response.data as JudgmentCheckResult | JudgmentCheckError;

      if ('error' in result) {
        const errorResult = result as JudgmentCheckError;
        
        if (errorResult.reason === 'cooldown_active') {
          toast.info(`Check again after ${new Date(errorResult.next_check_after!).toLocaleDateString()}`);
        } else {
          toast.error(errorResult.error);
        }
        
        setLastResult({ success: false, error: errorResult });
        return { success: false, error: errorResult };
      }

      const successResult = result as JudgmentCheckResult;

      if (successResult.found) {
        toast.success('🎉 Final judgment found!', {
          description: successResult.judgment_date 
            ? `Dated: ${new Date(successResult.judgment_date).toLocaleDateString()}`
            : undefined,
        });
      } else {
        toast.info('No judgment uploaded yet', {
          description: successResult.next_check_after 
            ? `You can check again after ${new Date(successResult.next_check_after).toLocaleDateString()}`
            : undefined,
        });
      }

      setLastResult({ success: true, data: successResult });
      return { success: true, data: successResult };

    } catch (error) {
      console.error('[useJudgmentCheck] Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Check failed';
      toast.error('Judgment check failed', { description: errorMessage });

      const errorResult = { error: errorMessage, reason: 'unknown' };
      setLastResult({ success: false, error: errorResult });
      return { success: false, error: errorResult };

    } finally {
      setIsChecking(false);
    }
  };

  /**
   * Get the current judgment status for a case without triggering a check
   */
  const getJudgmentStatus = async (caseId: string) => {
    const { data, error } = await supabase
      .from('tracked_cases')
      .select(`
        judgment_status,
        last_judgment_check_at,
        judgment_check_attempts,
        judgment_found_at,
        next_judgment_check_after
      `)
      .eq('id', caseId)
      .single();

    if (error) {
      return null;
    }

    return data;
  };

  /**
   * Get the judgment PDF for a case (if found)
   */
  const getJudgment = async (caseId: string) => {
    const { data, error } = await supabase
      .from('case_judgments')
      .select('*')
      .eq('tracked_case_id', caseId)
      .single();

    if (error) {
      return null;
    }

    return data;
  };

  /**
   * Get a signed URL for downloading the judgment PDF
   */
  const getJudgmentPdfUrl = async (storedPath: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from('case-documents')
      .createSignedUrl(storedPath, 3600); // 1 hour expiry

    if (error) {
      console.error('[useJudgmentCheck] Failed to get signed URL:', error);
      return null;
    }

    return data.signedUrl;
  };

  return {
    checkJudgment,
    getJudgmentStatus,
    getJudgment,
    getJudgmentPdfUrl,
    isChecking,
    lastResult,
  };
}

/**
 * Get CAPTCHA usage statistics for the current lawyer
 */
export function useCaptchaUsage() {
  const { user } = useAuth();

  const getUsageStats = async () => {
    if (!user) return null;

    const { data, error } = await supabase
      .from('captcha_usage_log')
      .select('*')
      .eq('lawyer_id', user.id)
      .order('solved_at', { ascending: false });

    if (error) {
      console.error('[useCaptchaUsage] Error:', error);
      return null;
    }

    const totalSolves = data.length;
    const successfulSolves = data.filter(d => d.success).length;
    const totalCost = data.reduce((sum, d) => sum + (Number(d.cost_credits) || 0), 0);

    return {
      logs: data,
      totalSolves,
      successfulSolves,
      successRate: totalSolves > 0 ? (successfulSolves / totalSolves) * 100 : 0,
      totalCost,
    };
  };

  return { getUsageStats };
}