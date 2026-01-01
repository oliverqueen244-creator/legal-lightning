import { ReactNode } from 'react';
import { Shield, EyeOff } from 'lucide-react';
import { useSensitiveView, getSensitiveTextClasses, preventContextMenu, preventCopy } from '@/hooks/useSensitiveView';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface SensitiveViewGuardProps {
  children: ReactNode;
  /** Type of sensitive content for watermark/logging */
  contentType: 'judge-intelligence' | 'chamber-memory' | 'personal-notes' | 'judicial-outcomes';
  /** Additional className for the container */
  className?: string;
  /** Whether to show the watermark overlay */
  showWatermark?: boolean;
  /** Whether to disable text selection */
  disableSelection?: boolean;
  /** Whether to disable context menu */
  disableContextMenu?: boolean;
}

/**
 * SensitiveViewGuard - Protects sensitive content from casual capture
 * 
 * This component provides:
 * 1. Dynamic watermark overlay (lawyer name + timestamp)
 * 2. Blur/mask when page loses focus or visibility
 * 3. Text selection prevention
 * 4. Context menu prevention
 * 5. Honest disclaimer (no false security claims)
 * 
 * IMPORTANT: This does NOT block screenshots. It only provides deterrence.
 */
export function SensitiveViewGuard({
  children,
  contentType,
  className,
  showWatermark = true,
  disableSelection = true,
  disableContextMenu = true,
}: SensitiveViewGuardProps) {
  const { shouldObscure } = useSensitiveView();
  const { user } = useAuth();

  // Generate watermark text
  const watermarkText = user?.email 
    ? `${user.email.split('@')[0]} • ${format(new Date(), 'dd MMM yyyy HH:mm')}`
    : format(new Date(), 'dd MMM yyyy HH:mm');

  return (
    <div
      className={cn(
        'relative',
        disableSelection && getSensitiveTextClasses(),
        className
      )}
      onContextMenu={disableContextMenu ? preventContextMenu : undefined}
      onCopy={disableSelection ? preventCopy : undefined}
      data-sensitive-content={contentType}
    >
      {/* Main content */}
      <div
        className={cn(
          'transition-all duration-200',
          shouldObscure && 'blur-md pointer-events-none'
        )}
        aria-hidden={shouldObscure}
      >
        {children}
      </div>

      {/* Watermark overlay - subtle, always visible when content is shown */}
      {showWatermark && !shouldObscure && (
        <div
          className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.03]"
          aria-hidden="true"
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div 
              className="text-foreground font-mono text-xs whitespace-nowrap"
              style={{
                transform: 'rotate(-30deg) scale(2)',
                letterSpacing: '0.5em',
              }}
            >
              {watermarkText}
            </div>
          </div>
        </div>
      )}

      {/* Blur overlay when content should be obscured */}
      {shouldObscure && (
        <div 
          className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm rounded"
          role="alert"
          aria-live="polite"
        >
          <EyeOff className="h-6 w-6 text-muted-foreground mb-2" />
          <p className="text-xs text-muted-foreground text-center px-4">
            Sensitive content hidden
          </p>
          <p className="text-[10px] text-muted-foreground/60 text-center px-4 mt-1">
            Return focus to view
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * SensitiveContentNotice - Calm, honest warning about sensitive content
 * 
 * Does NOT claim screenshots are blocked.
 */
export function SensitiveContentNotice({ className }: { className?: string }) {
  return (
    <div 
      className={cn(
        'flex items-start gap-2 px-3 py-2 rounded-md bg-amber-500/5 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px]',
        className
      )}
      role="note"
      aria-label="Sensitive content notice"
    >
      <Shield className="h-3 w-3 flex-shrink-0 mt-0.5" aria-hidden="true" />
      <span>
        Sensitive information is displayed. Avoid screenshots or screen sharing.
      </span>
    </div>
  );
}
