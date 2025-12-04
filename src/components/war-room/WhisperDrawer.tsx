import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAudioRecorder, formatRecordingTime } from '@/hooks/useAudioRecorder';
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
import { MessageCircle, Send, Mic, Square, X, Play, Pause, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';

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

// Audio message prefix to identify voice memos
const VOICE_MESSAGE_PREFIX = '[VOICE_MEMO]';

function AudioPlayer({ src }: { src: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setProgress((audio.currentTime / audio.duration) * 100 || 0);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <audio ref={audioRef} src={src} preload="metadata" />
      <Button
        variant="ghost"
        size="icon"
        onClick={togglePlay}
        className="h-8 w-8 rounded-full bg-primary/20"
      >
        {isPlaying ? (
          <Pause className="h-4 w-4 text-primary" />
        ) : (
          <Play className="h-4 w-4 text-primary ml-0.5" />
        )}
      </Button>
      <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
        <div 
          className="h-full bg-primary transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export function WhisperDrawer({ docketId }: WhisperDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const {
    isRecording,
    recordingTime,
    startRecording,
    stopRecording,
    cancelRecording,
    error: recordingError,
  } = useAudioRecorder();

  // Show recording errors
  useEffect(() => {
    if (recordingError) {
      toast.error(recordingError);
    }
  }, [recordingError]);

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

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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

  const handleVoiceRecord = async () => {
    if (isRecording) {
      // Stop and send
      setIsUploading(true);
      try {
        const audioBlob = await stopRecording();
        if (!audioBlob) {
          toast.error('No audio recorded');
          return;
        }

        // Upload to Supabase storage
        const fileName = `voice-${docketId}-${Date.now()}.webm`;
        const filePath = `whispers/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('case-documents')
          .upload(filePath, audioBlob, {
            contentType: audioBlob.type,
            upsert: false,
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          toast.error('Failed to upload voice memo');
          return;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('case-documents')
          .getPublicUrl(filePath);

        // Send message with voice memo URL
        await sendMessage.mutateAsync(`${VOICE_MESSAGE_PREFIX}${urlData.publicUrl}`);
        toast.success('Voice memo sent!');
        
      } catch (err) {
        console.error('Voice send error:', err);
        toast.error('Failed to send voice memo');
      } finally {
        setIsUploading(false);
      }
    } else {
      // Start recording
      await startRecording();
    }
  };

  const parseMessage = (message: string): { isVoice: boolean; content: string } => {
    if (message.startsWith(VOICE_MESSAGE_PREFIX)) {
      return { isVoice: true, content: message.slice(VOICE_MESSAGE_PREFIX.length) };
    }
    return { isVoice: false, content: message };
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
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            <div className="space-y-4">
              {messages.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No messages yet. Start a conversation!
                </p>
              ) : (
                messages.map((msg) => {
                  const isOwn = msg.sender_id === user?.id;
                  const { isVoice, content } = parseMessage(msg.message);
                  
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
                        {isVoice ? (
                          <div className="flex items-center gap-2">
                            <Mic className="h-4 w-4 shrink-0" />
                            <AudioPlayer src={content} />
                          </div>
                        ) : (
                          content
                        )}
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

          {/* Recording indicator */}
          {isRecording && (
            <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive"></span>
                </span>
                <span className="text-sm font-medium text-destructive">
                  Recording... {formatRecordingTime(recordingTime)}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={cancelRecording}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Input */}
          <form 
            onSubmit={handleSend}
            className="p-4 border-t border-border flex gap-2"
          >
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={isRecording ? 'Recording...' : 'Type a whisper...'}
              className="flex-1 bg-secondary/50 border-border"
              aria-label="Message input"
              disabled={isRecording || isUploading}
            />
            
            {/* Voice Record Button */}
            <Button 
              type="button"
              size="icon"
              variant={isRecording ? 'destructive' : 'outline'}
              onClick={handleVoiceRecord}
              disabled={isUploading}
              className={cn(
                'min-h-touch min-w-touch transition-all',
                isRecording && 'animate-pulse'
              )}
              aria-label={isRecording ? 'Stop recording' : 'Start voice memo'}
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isRecording ? (
                <Square className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>
            
            {/* Send Text Button */}
            <Button 
              type="submit" 
              size="icon"
              disabled={!newMessage.trim() || sendMessage.isPending || isRecording || isUploading}
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