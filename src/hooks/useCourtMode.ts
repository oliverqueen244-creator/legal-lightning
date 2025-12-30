import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface CourtModeSettings {
  id: string;
  user_id: string;
  court_mode_enabled: boolean;
  court_mode_bench: 'JODHPUR' | 'JAIPUR' | 'BOTH' | null;
  court_mode_start: string;
  court_mode_end: string;
  whatsapp_escalation_enabled: boolean;
  created_at: string;
  updated_at: string;
}

const DEFAULT_SETTINGS: Partial<CourtModeSettings> = {
  court_mode_enabled: false,
  court_mode_bench: null,
  court_mode_start: '10:30:00',
  court_mode_end: '17:00:00',
  whatsapp_escalation_enabled: false,
};

export function useCourtMode() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['court-mode-settings', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('court_mode_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data as CourtModeSettings | null;
    },
    enabled: !!user?.id,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<CourtModeSettings>) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { data: existing } = await supabase
        .from('court_mode_settings')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('court_mode_settings')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('court_mode_settings')
          .insert({
            user_id: user.id,
            ...DEFAULT_SETTINGS,
            ...updates,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['court-mode-settings'] });
    },
    onError: (error) => {
      console.error('Failed to update court mode settings:', error);
      toast.error('Failed to update Court Mode settings');
    },
  });

  const enableCourtMode = async (bench: 'JODHPUR' | 'JAIPUR' | 'BOTH') => {
    await updateMutation.mutateAsync({
      court_mode_enabled: true,
      court_mode_bench: bench,
    });
    toast.success('Court Mode enabled');
  };

  const disableCourtMode = async () => {
    await updateMutation.mutateAsync({
      court_mode_enabled: false,
    });
    toast.success('Court Mode disabled');
  };

  const updateSettings = async (updates: Partial<CourtModeSettings>) => {
    await updateMutation.mutateAsync(updates);
  };

  // Check if currently within court hours
  const isWithinCourtHours = (): boolean => {
    const settings = query.data;
    if (!settings?.court_mode_enabled) return false;

    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 8);
    
    return currentTime >= settings.court_mode_start && 
           currentTime <= settings.court_mode_end;
  };

  return {
    settings: query.data,
    isLoading: query.isLoading,
    isCourtModeEnabled: query.data?.court_mode_enabled ?? false,
    isWithinCourtHours,
    enableCourtMode,
    disableCourtMode,
    updateSettings,
    isUpdating: updateMutation.isPending,
  };
}
