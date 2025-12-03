import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { FileText, ChevronRight } from 'lucide-react';
import type { CaseArgument } from '@/types/database';
import { cn } from '@/lib/utils';

interface ArgumentsPanelProps {
  arguments: CaseArgument[];
  selectedArg: CaseArgument | null;
  onSelectArg: (arg: CaseArgument) => void;
}

export function ArgumentsPanel({ arguments: args, selectedArg, onSelectArg }: ArgumentsPanelProps) {
  return (
    <div className="h-full flex flex-col bg-card border-r border-border">
      <div className="p-4 border-b border-border">
        <h2 className="font-display text-xl font-bold text-primary flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Arguments
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Click to jump to page
        </p>
      </div>
      
      <ScrollArea className="flex-1 legal-scroll">
        <div className="p-4 space-y-2">
          {args.length === 0 ? (
            <p className="text-muted-foreground text-sm">No arguments added yet</p>
          ) : (
            args.map((arg, index) => (
              <Button
                key={arg.id}
                variant="ghost"
                className={cn(
                  'w-full justify-start text-left h-auto py-3 px-4 group',
                  selectedArg?.id === arg.id && 'bg-primary/10 border border-primary'
                )}
                onClick={() => onSelectArg(arg)}
              >
                <div className="flex items-start gap-3 w-full">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                      {arg.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Page {arg.linked_page_number}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0 mt-1" />
                </div>
              </Button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
