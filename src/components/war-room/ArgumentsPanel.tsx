import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { FileText, ChevronRight, Plus, Minus } from 'lucide-react';
import type { CaseArgument } from '@/types/database';
import { cn } from '@/lib/utils';

type FontSize = 'normal' | 'large' | 'xlarge';

interface ArgumentsPanelProps {
  arguments: CaseArgument[];
  selectedArg: CaseArgument | null;
  onSelectArg: (arg: CaseArgument) => void;
  fontSize?: FontSize;
  onFontSizeChange?: (size: FontSize) => void;
}

const fontSizeClasses: Record<FontSize, { title: string; page: string }> = {
  normal: { title: 'text-sm', page: 'text-xs' },
  large: { title: 'text-base', page: 'text-sm' },
  xlarge: { title: 'text-lg', page: 'text-base' },
};

export function ArgumentsPanel({ 
  arguments: args, 
  selectedArg, 
  onSelectArg,
  fontSize = 'normal',
  onFontSizeChange 
}: ArgumentsPanelProps) {
  const handleKeyDown = (e: React.KeyboardEvent, arg: CaseArgument) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelectArg(arg);
    }
  };

  const handleIncreaseFontSize = () => {
    if (!onFontSizeChange) return;
    if (fontSize === 'normal') onFontSizeChange('large');
    else if (fontSize === 'large') onFontSizeChange('xlarge');
  };

  const handleDecreaseFontSize = () => {
    if (!onFontSizeChange) return;
    if (fontSize === 'xlarge') onFontSizeChange('large');
    else if (fontSize === 'large') onFontSizeChange('normal');
  };

  const currentFontSize = fontSizeClasses[fontSize];

  return (
    <nav className="h-full flex flex-col glass-card rounded-none" aria-label="Case arguments">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display text-xl font-bold text-primary flex items-center gap-2 tracking-wide">
            <FileText className="h-5 w-5" aria-hidden="true" />
            Arguments
          </h2>
          
          {/* Font Size Controls */}
          {onFontSizeChange && (
            <div className="flex items-center gap-1" role="group" aria-label="Font size controls">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDecreaseFontSize}
                disabled={fontSize === 'normal'}
                aria-label="Decrease font size"
                className="min-h-touch min-w-touch h-9 w-9"
              >
                <span className="text-xs font-bold">A-</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleIncreaseFontSize}
                disabled={fontSize === 'xlarge'}
                aria-label="Increase font size"
                className="min-h-touch min-w-touch h-9 w-9"
              >
                <span className="text-sm font-bold">A+</span>
              </Button>
            </div>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Click to jump to page
        </p>
      </div>
      
      <ScrollArea className="flex-1 legal-scroll">
        <ul className="p-4 space-y-2" role="list" aria-label="List of arguments">
          {args.length === 0 ? (
            <li className="text-muted-foreground text-sm py-8 text-center">
              No arguments added yet
            </li>
          ) : (
            args.map((arg, index) => (
              <li key={arg.id}>
                <Button
                  variant="ghost"
                  className={cn(
                    'w-full justify-start text-left h-auto py-4 px-4 group focus-visible:ring-2 focus-visible:ring-primary min-h-touch glass-card-hover',
                    selectedArg?.id === arg.id && 'bg-primary/10 border border-primary'
                  )}
                  onClick={() => onSelectArg(arg)}
                  onKeyDown={(e) => handleKeyDown(e, arg)}
                  aria-pressed={selectedArg?.id === arg.id}
                  aria-label={`Argument ${index + 1}: ${arg.title}, page ${arg.linked_page_number}`}
                >
                  <div className="flex items-start gap-3 w-full">
                    <span 
                      className="shrink-0 w-8 h-8 rounded-full bg-primary/20 text-primary text-sm font-bold flex items-center justify-center"
                      aria-hidden="true"
                    >
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'font-medium text-foreground group-hover:text-primary transition-colors',
                        currentFontSize.title
                      )}>
                        {arg.title}
                      </p>
                      <p className={cn(
                        'text-muted-foreground mt-1',
                        currentFontSize.page
                      )}>
                        Page {arg.linked_page_number}
                      </p>
                    </div>
                    <ChevronRight 
                      className="h-5 w-5 text-muted-foreground group-hover:text-primary shrink-0 mt-1" 
                      aria-hidden="true" 
                    />
                  </div>
                </Button>
              </li>
            ))
          )}
        </ul>
      </ScrollArea>
    </nav>
  );
}