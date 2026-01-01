import { Bell, BellRing, Zap, AlertTriangle, SkipForward, Volume2, VolumeX, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotificationSound, NotificationSoundType } from '@/hooks/useNotificationSound';
import { useCourtNotifications, type CourtNotification } from '@/hooks/useCourtNotifications';
import type { LiveBoardCache, DocketItem } from '@/types/database';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';

interface NotificationBellProps {
  liveBoards: LiveBoardCache[];
  userCases: DocketItem[];
}

/**
 * NotificationBell Component
 * 
 * AUDIT FIX: Now uses database-backed notifications via useCourtNotifications hook.
 * Notifications persist across page refresh and navigation.
 * Database owns the notifications, React state only mirrors for display.
 */
export function NotificationBell({ liveBoards, userCases }: NotificationBellProps) {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const { playNotification, setEnabled } = useNotificationSound();
  
  // Use database-backed notifications hook
  const {
    notifications,
    isLoading,
    unreadCount,
    criticalUnacknowledged,
    acknowledgeNotification,
    markAsRead,
  } = useCourtNotifications();

  // Update sound enabled state
  useEffect(() => {
    setEnabled(soundEnabled);
  }, [soundEnabled, setEnabled]);

  // Play sound for new critical notifications
  useEffect(() => {
    if (criticalUnacknowledged.length > 0 && soundEnabled) {
      const latest = criticalUnacknowledged[0];
      const soundMap: Record<string, NotificationSoundType> = {
        'approaching': 'urgent',
        'skipped': 'passover',
      };
      playNotification(soundMap[latest.notification_type] || 'urgent');
    }
  }, [criticalUnacknowledged.length, soundEnabled, playNotification]);

  const handleNotificationClick = async (notification: CourtNotification) => {
    if (notification.status === 'sent') {
      await markAsRead(notification.id);
    }
  };

  const handleAcknowledge = async (e: React.MouseEvent, notification: CourtNotification) => {
    e.stopPropagation();
    await acknowledgeNotification(notification.id);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'approaching':
        return <Zap className="h-4 w-4 text-primary" />;
      case 'skipped':
        return <SkipForward className="h-4 w-4 text-court-warning" />;
      case 'anomaly':
        return <AlertTriangle className="h-4 w-4 text-court-danger-light" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getNotificationBg = (notification: CourtNotification) => {
    if (notification.status !== 'sent') return 'bg-muted/30';
    switch (notification.severity) {
      case 'critical':
        return 'bg-court-danger/10 border-l-2 border-l-court-danger-light';
      case 'warning':
        return 'bg-court-warning/10 border-l-2 border-l-court-warning';
      default:
        return 'bg-primary/10 border-l-2 border-l-primary';
    }
  };

  const hasUnread = unreadCount > 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative min-h-touch min-w-touch"
          aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        >
          {hasUnread ? (
            <BellRing className="h-5 w-5 text-primary animate-pulse" />
          ) : (
            <Bell className="h-5 w-5" />
          )}
          {unreadCount > 0 && (
            <Badge 
              variant="danger" 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent align="end" className="w-80 p-0 glass-card">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <h3 className="font-display font-semibold">Notifications</h3>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setSoundEnabled(!soundEnabled)}
              aria-label={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
            >
              {soundEnabled ? (
                <Volume2 className="h-4 w-4" />
              ) : (
                <VolumeX className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
        </div>
        
        <ScrollArea className="h-80">
          {isLoading ? (
            <div className="p-6 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50 animate-pulse" />
              <p className="text-sm">Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No notifications yet</p>
              <p className="text-xs mt-1">Court alerts will appear here</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    'p-3 transition-colors cursor-pointer hover:bg-secondary/30',
                    getNotificationBg(notification)
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {getNotificationIcon(notification.notification_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-sm font-medium',
                        notification.status !== 'sent' ? 'text-muted-foreground' : 'text-foreground'
                      )}>
                        {notification.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {notification.message}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-xs text-muted-foreground/70">
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                        </p>
                        {notification.status === 'sent' && notification.severity === 'critical' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={(e) => handleAcknowledge(e, notification)}
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Acknowledge
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
