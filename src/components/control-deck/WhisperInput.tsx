import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, MessageSquare, WifiOff } from 'lucide-react';
import { useSendWhisper } from '@/hooks/useWhisper';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface WhisperInputProps {
  docketId: string;
}

export function WhisperInput({ docketId }: WhisperInputProps) {
  const [message, setMessage] = useState('');
  const sendWhisper = useSendWhisper();
  const { isOnline } = useNetworkStatus();

  const handleSend = async () => {
    if (!message.trim()) return;
    
    // P0 FIX: Check online status before sending
    if (!isOnline) {
      toast.error('Internet connection required', {
        description: 'Cannot send message while offline.',
      });
      return;
    }

    try {
      await sendWhisper.mutateAsync({ docketId, message: message.trim() });
      setMessage('');
      toast.success('Message sent to Senior');
    } catch (error: any) {
      // Error handling is done in useSendWhisper for OFFLINE_BLOCKED
      if (error.message !== 'OFFLINE_BLOCKED') {
        toast.error('Failed to send message');
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4 z-50">
      {/* P1 FIX: Connection status indicator */}
      {!isOnline && (
        <div className="max-w-4xl mx-auto mb-2 flex items-center gap-2 text-sm text-destructive">
          <WifiOff className="h-4 w-4" />
          <span>Offline — Messaging requires internet connection</span>
        </div>
      )}
      <div className="max-w-4xl mx-auto flex items-center gap-3">
        <MessageSquare className={cn(
          "h-5 w-5 shrink-0",
          isOnline ? "text-primary" : "text-muted-foreground"
        )} />
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isOnline ? "Type note to Senior..." : "Offline — Cannot send messages"}
          className="flex-1 bg-background border-border focus:border-primary"
          disabled={!isOnline}
        />
        <Button
          variant="gold"
          onClick={handleSend}
          disabled={!message.trim() || sendWhisper.isPending || !isOnline}
          title={!isOnline ? "Messaging requires internet connection" : undefined}
        >
          <Send className="h-4 w-4 mr-2" />
          Send
        </Button>
      </div>
    </div>
  );
}
