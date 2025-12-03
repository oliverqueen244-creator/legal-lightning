import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, MessageSquare } from 'lucide-react';
import { useSendWhisper } from '@/hooks/useWhisper';
import { toast } from 'sonner';

interface WhisperInputProps {
  docketId: string;
}

export function WhisperInput({ docketId }: WhisperInputProps) {
  const [message, setMessage] = useState('');
  const sendWhisper = useSendWhisper();

  const handleSend = async () => {
    if (!message.trim()) return;

    try {
      await sendWhisper.mutateAsync({ docketId, message: message.trim() });
      setMessage('');
      toast.success('Message sent to Senior');
    } catch (error) {
      toast.error('Failed to send message');
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
      <div className="max-w-4xl mx-auto flex items-center gap-3">
        <MessageSquare className="h-5 w-5 text-primary shrink-0" />
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type note to Senior..."
          className="flex-1 bg-background border-border focus:border-primary"
        />
        <Button
          variant="gold"
          onClick={handleSend}
          disabled={!message.trim() || sendWhisper.isPending}
        >
          <Send className="h-4 w-4 mr-2" />
          Send
        </Button>
      </div>
    </div>
  );
}
