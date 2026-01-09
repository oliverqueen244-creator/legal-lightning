import { useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useCourtMode } from './useCourtMode';
import { useLiveBoard } from './useLiveBoard';
import { useDocket } from './useDocket';
import { useNetworkStatus } from './useNetworkStatus';
import { useOfflineThresholdMemory } from './useOfflineThresholdMemory';
import { getRoleCaseLabel } from './useRoleSemantics';
import type { DocketItem, LiveBoardCache } from '@/types/database';

export type NotificationSeverity = 'info' | 'warning' | 'critical';
export type NotificationType = 'approaching' | 'skipped' | 'removed' | 'anomaly';
export type ThresholdLevel = 'early_warning' | 'imminent' | 'immediate' | 'exception';

export interface CourtNotification {
  id: string;
  user_id: string;
  docket_id: string | null;
  notification_type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  item_distance: number | null;
  threshold_crossed: ThresholdLevel | null;
  status: 'sent' | 'read' | 'acknowledged' | 'escalated';
  acknowledged_at: string | null;
  created_at: string;
}

interface ThresholdConfig {
  level: ThresholdLevel;
  severity: NotificationSeverity;
  minDistance: number;
  maxDistance: number;
  acknowledgementWindowMs: number;
}

// Item distance thresholds (NON-NEGOTIABLE)
const THRESHOLD_CONFIG: ThresholdConfig[] = [
  { level: 'early_warning', severity: 'warning', minDistance: 6, maxDistance: 10, acknowledgementWindowMs: 0 }, // No escalation for warning
  { level: 'imminent', severity: 'critical', minDistance: 3, maxDistance: 5, acknowledgementWindowMs: 3 * 60 * 1000 }, // 3 minutes
  { level: 'immediate', severity: 'critical', minDistance: 0, maxDistance: 2, acknowledgementWindowMs: 1 * 60 * 1000 }, // 1 minute
  { level: 'exception', severity: 'critical', minDistance: -999, maxDistance: -1, acknowledgementWindowMs: 0 }, // Immediate escalation
];

export function getThresholdForDistance(distance: number): ThresholdConfig | null {
  // No notification for > 10 items (silent in-app only)
  if (distance > 10) return null;
  
  return THRESHOLD_CONFIG.find(
    t => distance >= t.minDistance && distance <= t.maxDistance
  ) || null;
}

export function calculateItemDistance(caseItem: number, currentItem: number): number {
  return caseItem - currentItem;
}

export function useCourtNotifications() {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const { isCourtModeEnabled, isWithinCourtHours, settings: courtModeSettings } = useCourtMode();
  const { data: liveBoards } = useLiveBoard();
  const { data: docketItems } = useDocket();
  const { isOnline } = useNetworkStatus();
  const { 
    trackOfflineThreshold, 
    getCasesForReplay, 
    markAsReplayed,
  } = useOfflineThresholdMemory();
  
  // Track which thresholds we've already notified for each case
  const notifiedThresholds = useRef<Map<string, ThresholdLevel>>(new Map());
  
  // Track previous item distances to detect threshold crossings
  const previousDistances = useRef<Map<string, number>>(new Map());
  
  // Track previous online state for reconnect detection
  const wasOfflineRef = useRef<boolean>(!navigator.onLine);

  // Query notifications
  const query = useQuery({
    queryKey: ['court-notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as CourtNotification[];
    },
    enabled: !!user?.id,
  });

  // Subscribe to realtime notifications
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['court-notifications'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  // Create notification
  const createNotification = useCallback(async (
    docketItem: DocketItem,
    type: NotificationType,
    distance: number,
    threshold: ThresholdConfig
  ) => {
    if (!user?.id) return;

    const caseKey = `${docketItem.id}-${threshold.level}`;
    
    // Don't create duplicate notifications for same threshold
    if (notifiedThresholds.current.has(caseKey)) {
      return;
    }

    // CORRECTNESS PLAN 3: Use role-aware case labels
    const caseLabel = getRoleCaseLabel(role);

    const title = type === 'skipped' 
      ? `Case Skipped: ${docketItem.case_number}`
      : type === 'approaching'
      ? `Case Approaching: ${docketItem.case_number}`
      : `Case Alert: ${docketItem.case_number}`;

    const message = type === 'skipped'
      ? `${caseLabel} at Item ${docketItem.item_no} in Court ${docketItem.court_room_no} was passed over.`
      : distance <= 2
      ? `${caseLabel} is ${distance === 0 ? 'NOW' : `${distance} item${distance > 1 ? 's' : ''} away`} in Court ${docketItem.court_room_no}.`
      : `${caseLabel} at Item ${docketItem.item_no} is ${distance} items away in Court ${docketItem.court_room_no}.`;

    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: user.id,
        docket_id: docketItem.id,
        notification_type: type,
        severity: threshold.severity,
        title,
        message,
        item_distance: distance,
        threshold_crossed: threshold.level,
        status: 'sent',
      });

    if (!error) {
      notifiedThresholds.current.set(caseKey, threshold.level);
      queryClient.invalidateQueries({ queryKey: ['court-notifications'] });
    }
  }, [user?.id, queryClient]);

  // Acknowledge notification
  const acknowledgeMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({
          status: 'acknowledged',
          acknowledged_at: new Date().toISOString(),
        })
        .eq('id', notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['court-notifications'] });
    },
  });

  // Mark as read
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ status: 'read' })
        .eq('id', notificationId)
        .eq('status', 'sent');

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['court-notifications'] });
    },
  });

  // Monitor live boards and detect threshold crossings
  useEffect(() => {
    if (!isCourtModeEnabled || !docketItems?.length || !liveBoards?.length) return;

    docketItems.forEach((item) => {
      const liveBoard = liveBoards.find(
        (lb: LiveBoardCache) => 
          lb.court_location === item.court_location && 
          lb.court_no === item.court_room_no &&
          lb.is_active
      );

      if (!liveBoard || !item.item_no) return;

      const distance = calculateItemDistance(item.item_no, liveBoard.current_item || 1);
      const previousDistance = previousDistances.current.get(item.id);
      
      // Store current distance for next comparison
      previousDistances.current.set(item.id, distance);

      // P0 FIX: Track thresholds while offline for later replay
      if (!isOnline && distance >= 0 && distance <= 10) {
        const caseFingerprint = (item as any).case_fingerprint || item.case_number || '';
        const hearingDate = item.date || new Date().toISOString().split('T')[0];
        trackOfflineThreshold(
          caseFingerprint,
          hearingDate,
          item.id,
          item.case_number || '',
          item.court_room_no || '',
          item.item_no,
          distance
        );
      }

      // Skip if this is the first check (no previous distance)
      if (previousDistance === undefined) return;

      // Only create notifications when ONLINE
      if (!isOnline) return;

      // Only notify when CROSSING a threshold boundary (not on every decrement)
      const previousThreshold = getThresholdForDistance(previousDistance);
      const currentThreshold = getThresholdForDistance(distance);

      // Detect threshold crossing
      if (currentThreshold && currentThreshold.level !== previousThreshold?.level) {
        // Check if we've already notified for this threshold
        const caseKey = `${item.id}-${currentThreshold.level}`;
        if (!notifiedThresholds.current.has(caseKey)) {
          createNotification(item, 'approaching', distance, currentThreshold);
        }
      }

      // Special case: skipped (distance went negative)
      if (distance < 0 && previousDistance >= 0) {
        const exceptionThreshold = THRESHOLD_CONFIG.find(t => t.level === 'exception')!;
        createNotification(item, 'skipped', distance, exceptionThreshold);
      }
    });
  }, [liveBoards, docketItems, isCourtModeEnabled, isOnline, createNotification, trackOfflineThreshold]);

  // P0 FIX: Replay notifications on reconnect
  useEffect(() => {
    // Detect online transition
    const wasOffline = wasOfflineRef.current;
    wasOfflineRef.current = !isOnline;
    
    // Only trigger replay when transitioning from offline to online
    if (!wasOffline || !isOnline || !user?.id) return;

    const casesToReplay = getCasesForReplay();
    
    casesToReplay.forEach(async (entry) => {
      // Create synthesized reconnect notification
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: user.id,
          docket_id: entry.docketId,
          notification_type: 'approaching',
          severity: 'critical',
          title: 'Court Alert (After Reconnect)',
          // CORRECTNESS PLAN 3: Use role-aware case labels
          message: `${getRoleCaseLabel(role)} crossed a critical proximity threshold while you were offline.\nPlease verify the current court status.`,
          item_distance: entry.lastKnownDistance,
          threshold_crossed: 'immediate',
          status: 'sent',
        });

      if (!error) {
        markAsReplayed(entry.caseFingerprint, entry.hearingDate);
        queryClient.invalidateQueries({ queryKey: ['court-notifications'] });
      }
    });
  }, [isOnline, user?.id, getCasesForReplay, markAsReplayed, queryClient]);

  // Get unread count
  const unreadCount = query.data?.filter(n => n.status === 'sent').length ?? 0;

  // Get critical unacknowledged notifications
  const criticalUnacknowledged = query.data?.filter(
    n => n.severity === 'critical' && n.status === 'sent'
  ) ?? [];

  return {
    notifications: query.data ?? [],
    isLoading: query.isLoading,
    unreadCount,
    criticalUnacknowledged,
    acknowledgeNotification: acknowledgeMutation.mutateAsync,
    markAsRead: markAsReadMutation.mutateAsync,
    isCourtModeEnabled,
    isWithinCourtHours: isWithinCourtHours(),
    courtModeSettings,
  };
}
