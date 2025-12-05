import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ValidationResult {
  type: string;
  status: 'pass' | 'warning' | 'fail';
  message: string;
  details?: Record<string, unknown>;
}

export interface ValidationResponse {
  results: ValidationResult[];
  summary: {
    total: number;
    pass: number;
    warning: number;
    fail: number;
  };
  timestamp: string;
}

export function useDataValidation() {
  const queryClient = useQueryClient();

  const runValidation = useMutation({
    mutationFn: async (action: 'validate_all' | 'validate_causelist' | 'validate_live_board' | 'cross_validate') => {
      const { data, error } = await supabase.functions.invoke('data-validation', {
        body: { action }
      });

      if (error) throw error;
      return data as ValidationResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['validationLogs'] });
    }
  });

  return {
    runValidation,
    isValidating: runValidation.isPending
  };
}

export function useValidationLogs() {
  return useQuery({
    queryKey: ['validationLogs'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('data-validation', {
        body: { action: 'get_logs' }
      });

      if (error) throw error;
      return data.logs as Array<{
        id: string;
        validation_type: string;
        status: string;
        details: Record<string, unknown>;
        court_location: string | null;
        court_no: string | null;
        created_at: string;
      }>;
    },
    refetchInterval: 30000 // Refetch every 30 seconds
  });
}

export function useSyncLiveBoard() {
  const queryClient = useQueryClient();

  const syncBoard = useMutation({
    mutationFn: async (params: {
      action: 'sync' | 'health' | 'force_sync';
      court_location?: string;
      court_no?: string;
      current_item?: number;
      status?: string;
      is_supplementary_running?: boolean;
    }) => {
      const { data, error } = await supabase.functions.invoke('sync-live-board', {
        body: params
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['liveBoard'] });
      queryClient.invalidateQueries({ queryKey: ['syncStatusHistory'] });
    }
  });

  const getHealth = useQuery({
    queryKey: ['syncHealth'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('sync-live-board', {
        body: { action: 'health' }
      });

      if (error) throw error;
      return data;
    },
    refetchInterval: 10000 // Check health every 10 seconds
  });

  return {
    syncBoard,
    getHealth,
    isSyncing: syncBoard.isPending
  };
}
