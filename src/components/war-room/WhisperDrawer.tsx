import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { MessageCircle, Send, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface WhisperMessage {
  id: string;
  message: string;
  sender_id: string;
  docket_id: string;
  is_read: boolean;
  created_at: string;
  sender_name?: string;
}

interface WhisperDrawerProps {
  docketId: string;
}

export function WhisperDrawer({ docketId }: WhisperDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();

  // Fetch messages
  const { data: messages = [] } = useQuery({
    queryKey: ['whispers', docketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('live_courtroom_feed')
        .select(`
          id,
          message,
          sender_id,
          docket_id,
          is_read,
          created_at
        `)
        .eq('docket_id', docketId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Get sender profiles
      const senderIds = [...new Set(data.map(m => m.sender_id).filter(Boolean))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', senderIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);

      return data.map(m => ({
        ...m,
        sender_name: m.sender_id ? profileMap.get(m.sender_id) || 'Unknown' : 'System',
      })) as WhisperMessage[];
    },
    enabled: !!docketId,
  });

  // Count unread messages
  const unreadCount = messages.filter(m => !m.is_read && m.sender_id !== user?.id).length;

  // Subscribe to realtime updates
  useEffect(() => {
    if (!docketId) return;

    const channel = supabase
      .channel(`whispers-${docketId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_courtroom_feed',
          filter: `docket_id=eq.${docketId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['whispers', docketId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [docketId, queryClient]);

  // Mark messages as read when drawer opens
  useEffect(() => {
    if (isOpen && unreadCount > 0) {
      const unreadIds = messages
        .filter(m => !m.is_read && m.sender_id !== user?.id)
        .map(m => m.id);

      if (unreadIds.length > 0) {
        supabase
          .from('live_courtroom_feed')
          .update({ is_read: true })
          .in('id', unreadIds)
          .then(() => {
            queryClient.invalidateQueries({ queryKey: ['whispers', docketId] });
          });
      }
    }
  }, [isOpen, messages, user?.id, docketId, queryClient, unreadCount]);

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async (message: string) => {
      const { error } = await supabase
        .from('live_courtroom_feed')
        .insert({
          message,
          sender_id: user?.id,
          docket_id: docketId,
          is_read: false,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      setNewMessage('');
      queryClient.invalidateQueries({ queryKey: ['whispers', docketId] });
    },
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim()) {
      sendMessage.mutate(newMessage.trim());
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full glass-card shadow-lg hover:shadow-xl transition-all z-50"
          aria-label={`Open whisper chat${unreadCount > 0 ? `, ${unreadCount} unread messages` : ''}`}
        >
          <MessageCircle className="h-6 w-6 text-primary" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs font-bold animate-pulse"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      
      <SheetContent 
        side="right" 
        className="w-full sm:w-[400px] p-0 glass-card border-l border-border"
      >
        <SheetHeader className="p-4 border-b border-border">
          <SheetTitle className="font-display text-xl tracking-wide flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            Whisper Chat
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col h-[calc(100vh-80px)]">
          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No messages yet. Start a conversation!
                </p>
              ) : (
                messages.map((msg) => {
                  const isOwn = msg.sender_id === user?.id;
                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        'flex flex-col gap-1 max-w-[85%]',
                        isOwn ? 'ml-auto items-end' : 'items-start'
                      )}
                    >
                      <span className="text-xs text-muted-foreground">
                        {isOwn ? 'You' : msg.sender_name}
                      </span>
                      <div
                        className={cn(
                          'rounded-lg px-4 py-2 text-sm',
                          isOwn
                            ? 'bg-primary text-primary-foreground'
                            : 'glass-card'
                        )}
                      >
                        {msg.message}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(msg.created_at), 'HH:mm')}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <form 
            onSubmit={handleSend}
            className="p-4 border-t border-border flex gap-2"
          >
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a whisper..."
              className="flex-1 bg-secondary/50 border-border"
              aria-label="Message input"
            />
            <Button 
              type="submit" 
              size="icon"
              disabled={!newMessage.trim() || sendMessage.isPending}
              className="min-h-touch min-w-touch"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}