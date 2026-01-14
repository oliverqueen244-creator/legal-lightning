/**
 * useExportAudit Hook
 * 
 * Logs case exports to the audit table for accountability.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { ExportFormat, ExportType } from '@/types/export';

interface LogExportParams {
  exportType: ExportType;
  exportFormat: ExportFormat;
  casesExported: number;
  dateRangeStart?: Date;
  dateRangeEnd?: Date;
}

export function useExportAudit() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const logExport = useMutation({
    mutationFn: async (params: LogExportParams) => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      
      const { data, error } = await supabase
        .from('case_export_logs')
        .insert({
          user_id: user.id,
          export_type: params.exportType,
          export_format: params.exportFormat,
          cases_exported: params.casesExported,
          date_range_start: params.dateRangeStart?.toISOString().split('T')[0],
          date_range_end: params.dateRangeEnd?.toISOString().split('T')[0],
          user_agent: navigator.userAgent,
        })
        .select()
        .single();
      
      if (error) {
        console.error('Failed to log export:', error);
        throw error;
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['export-logs'] });
    },
  });
  
  return {
    logExport: logExport.mutateAsync,
    isLogging: logExport.isPending,
    logError: logExport.error,
  };
}

// Hook to fetch export history for a user
export function useExportHistory(limit = 10) {
  const { user } = useAuth();
  
  return {
    // Implementation for viewing export history (for admin dashboard)
    userId: user?.id,
  };
}
