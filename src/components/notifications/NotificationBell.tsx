import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, BellRing, Zap, AlertTriangle, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotificationSound, NotificationSoundType } from '@/hooks/useNotificationSound';
import type { LiveBoardCache, DocketItem } from '@/types/database';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  type: 'fast_moving' | 'passover' | 'panic' | 'case_soon';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  courtNo?: string;
  itemNo?: number;
}

interface NotificationBellProps {
  liveBoards: LiveBoardCache[];
  userCases: DocketItem[];
}

interface BoardHistory {
  item: number;
  timestamp: number;
}

export function NotificationBell({ liveBoards, userCases }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hasUnread, setHasUnread] = useState(false);
  const { playNotification, setEnabled } = useNotificationSound();
  
  // Track board history for gap detection
  const boardHistoryRef = useRef<Map<string, BoardHistory[]>>(new Map());
  const previousBoardsRef = useRef<Map<string, number>>(new Map());

  // Add notification helper
  const addNotification = useCallback((
    type: Notification['type'],
    title: string,
    message: string,
    courtNo?: string,
    itemNo?: number
  ) => {
    const id = `${type}-${Date.now()}-${Math.random()}`;
    
    setNotifications(prev => [{
      id,
      type,
      title,
      message,
      timestamp: new Date(),
      read: false,
      courtNo,
      itemNo,
    }, ...prev.slice(0, 49)]); // Keep last 50 notifications
    
    setHasUnread(true);
    
    // Play appropriate sound
    if (soundEnabled) {
      const soundMap: Record<Notification['type'], NotificationSoundType> = {
        fast_moving: 'fast_moving',
        passover: 'passover',
        panic: 'panic',
        case_soon: 'urgent',
      };
      playNotification(soundMap[type]);
    }
  }, [soundEnabled, playNotification]);

  // Monitor live boards for changes
  useEffect(() => {
    const now = Date.now();
    
    liveBoards.forEach(board => {
      const boardKey = `${board.court_location}-${board.court_no}`;
      const currentItem = board.current_item;
      const previousItem = previousBoardsRef.current.get(boardKey);
      
      // Skip if no previous data
      if (previousItem === undefined) {
        previousBoardsRef.current.set(boardKey, currentItem);
        boardHistoryRef.current.set(boardKey, [{ item: currentItem, timestamp: now }]);
        return;
      }
      
      // Track history
      const history = boardHistoryRef.current.get(boardKey) || [];
      history.push({ item: currentItem, timestamp: now });
      
      // Keep only last 2 minutes of history
      const twoMinutesAgo = now - 2 * 60 * 1000;
      const recentHistory = history.filter(h => h.timestamp > twoMinutesAgo);
      boardHistoryRef.current.set(boardKey, recentHistory);
      
      // GAP DETECTION: If item jumped by > 5 in under 2 minutes
      if (recentHistory.length >= 2) {
        const oldestRecent = recentHistory[0];
        const itemDiff = currentItem - oldestRecent.item;
        const timeDiff = now - oldestRecent.timestamp;
        
        if (itemDiff > 5 && timeDiff < 2 * 60 * 1000) {
          addNotification(
            'fast_moving',
            '⚡ FAST MOVING COURT',
            `Court ${board.court_no} jumped ${itemDiff} items in under 2 minutes!`,
            board.court_no,
            currentItem
          );
        }
      }
      
      // Update previous ref
      previousBoardsRef.current.set(boardKey, currentItem);
    });
  }, [liveBoards, addNotification]);

  // Monitor user cases for passover and panic states
  useEffect(() => {
    userCases.forEach(userCase => {
      const board = liveBoards.find(
        b => b.court_location === userCase.court_location && b.court_no === userCase.court_room_no
      );
      
      if (!board) return;
      
      const distance = userCase.item_no - board.current_item;
      const isSupplementary = userCase.list_type === 'SUPPLEMENTARY';
      const panicThreshold = isSupplementary ? 10 : 5;
      
      // PASSOVER DETECTION: Current item passed user's case and status isn't done
      if (distance < 0 && board.status === 'hearing' && userCase.status !== 'done') {
        const notifKey = `passover-${userCase.id}`;
        const alreadyNotified = notifications.some(n => n.id.startsWith(notifKey));
        
        if (!alreadyNotified) {
          addNotification(
            'passover',
            '⚠️ CASE LIKELY PASSED OVER',
            `${userCase.case_number} in Court ${userCase.court_room_no} may have been passed over`,
            userCase.court_room_no,
            userCase.item_no
          );
        }
      }
      
      // PANIC ALERT: Case is within threshold
      if (distance > 0 && distance <= panicThreshold && board.status === 'hearing') {
        const notifKey = `panic-${userCase.id}-${distance}`;
        const alreadyNotified = notifications.some(n => n.id.includes(`panic-${userCase.id}`));
        
        if (!alreadyNotified && distance <= 3) {
          addNotification(
            'panic',
            '🚨 CASE IMMINENT',
            `${userCase.case_number} is only ${distance} item${distance !== 1 ? 's' : ''} away!`,
            userCase.court_room_no,
            userCase.item_no
          );
        }
      }
    });
  }, [userCases, liveBoards, notifications, addNotification]);

  // Update sound enabled state
  useEffect(() => {
    setEnabled(soundEnabled);
  }, [soundEnabled, setEnabled]);

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setHasUnread(false);
  };

  const clearNotifications = () => {
    setNotifications([]);
    setHasUnread(false);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'fast_moving':
        return <Zap className="h-4 w-4 text-primary" />;
      case 'passover':
        return <SkipForward className="h-4 w-4 text-court-warning" />;
      case 'panic':
        return <AlertTriangle className="h-4 w-4 text-court-danger-light" />;
      case 'case_soon':
        return <Bell className="h-4 w-4 text-primary" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getNotificationBg = (type: Notification['type'], read: boolean) => {
    if (read) return 'bg-muted/30';
    switch (type) {
      case 'fast_moving':
        return 'bg-primary/10 border-l-2 border-l-primary';
      case 'passover':
        return 'bg-court-warning/10 border-l-2 border-l-court-warning';
      case 'panic':
        return 'bg-court-danger/10 border-l-2 border-l-court-danger-light';
      case 'case_soon':
        return 'bg-primary/10 border-l-2 border-l-primary';
      default:
        return 'bg-secondary/50';
    }
  };

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
            {notifications.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={markAllRead}
                className="text-xs"
              >
                Mark all read
              </Button>
            )}
          </div>
        </div>
        
        <ScrollArea className="h-80">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No notifications yet</p>
              <p className="text-xs mt-1">Court alerts will appear here</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map(notification => (
                <div
                  key={notification.id}
                  className={cn(
                    'p-3 transition-colors',
                    getNotificationBg(notification.type, notification.read)
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-sm font-medium',
                        notification.read ? 'text-muted-foreground' : 'text-foreground'
                      )}>
                        {notification.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        {notification.timestamp.toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        
        {notifications.length > 0 && (
          <div className="p-2 border-t border-border">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearNotifications}
              className="w-full text-xs text-muted-foreground"
            >
              Clear all notifications
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
