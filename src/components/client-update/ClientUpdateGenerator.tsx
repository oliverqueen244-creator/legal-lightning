import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Copy, Check, FileEdit, AlertCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import { useClientUpdate } from '@/hooks/useClientUpdate';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import type { PostCourtNote } from '@/hooks/usePostCourtCapture';

interface ClientUpdateGeneratorProps {
  postCourtNote: PostCourtNote | null;
  caseNumber: string;
  onClose?: () => void;
}

export function ClientUpdateGenerator({
  postCourtNote,
  caseNumber,
  onClose,
}: ClientUpdateGeneratorProps) {
  const { user } = useAuth();
  const { data: role, isLoading: roleLoading } = useUserRole(user?.id);
  const { generateFromNote } = useClientUpdate();
  
  const [generatedText, setGeneratedText] = useState('');
  const [copied, setCopied] = useState(false);

  // Only SENIOR can access
  const isSenior = role === 'SENIOR';

  useEffect(() => {
    if (postCourtNote && caseNumber) {
      const text = generateFromNote(postCourtNote, caseNumber);
      setGeneratedText(text);
    }
  }, [postCourtNote, caseNumber, generateFromNote]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedText);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  if (roleLoading) {
    return null;
  }

  // Access control - only SENIOR
  if (!isSenior) {
    return null;
  }

  // No post-court note available
  if (!postCourtNote) {
    return (
      <Card className="glass-card border-muted/30">
        <CardContent className="py-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <p className="text-sm">
              Add a post-court note to generate a client update.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm font-display tracking-wide">
          <div className="flex items-center gap-2">
            <FileEdit className="h-4 w-4 text-primary" />
            Client-Friendly Summary
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              Editable
            </Badge>
            {onClose && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={generatedText}
          onChange={(e) => setGeneratedText(e.target.value)}
          className="min-h-[120px] font-mono text-sm bg-background/50 border-border/50 resize-none"
          placeholder="Generated update will appear here..."
        />
        
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Plain text only • Review before sending
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="gap-2"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
