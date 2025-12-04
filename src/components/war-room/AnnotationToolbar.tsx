import { Button } from '@/components/ui/button';
import { Highlighter, PenTool, Eraser, Search, X } from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';

export type AnnotationTool = 'highlighter' | 'pen' | 'eraser' | 'search' | null;

interface AnnotationToolbarProps {
  activeTool: AnnotationTool;
  onToolChange: (tool: AnnotationTool) => void;
  onSearch?: (query: string) => void;
}

export function AnnotationToolbar({ 
  activeTool, 
  onToolChange,
  onSearch 
}: AnnotationToolbarProps) {
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleToolClick = (tool: AnnotationTool) => {
    if (tool === 'search') {
      setShowSearch(!showSearch);
      onToolChange(showSearch ? null : 'search');
    } else {
      setShowSearch(false);
      onToolChange(activeTool === tool ? null : tool);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.(searchQuery);
  };

  const tools = [
    { 
      id: 'highlighter' as const, 
      icon: Highlighter, 
      label: 'Highlight (Yellow)',
      color: 'text-yellow-400',
      activeClass: 'bg-yellow-400/20 border-yellow-400',
    },
    { 
      id: 'pen' as const, 
      icon: PenTool, 
      label: 'Pen (Red)',
      color: 'text-court-danger-light',
      activeClass: 'bg-court-danger/20 border-court-danger-light',
    },
    { 
      id: 'eraser' as const, 
      icon: Eraser, 
      label: 'Eraser',
      color: 'text-muted-foreground',
      activeClass: 'bg-secondary border-muted-foreground',
    },
    { 
      id: 'search' as const, 
      icon: Search, 
      label: 'Search',
      color: 'text-primary',
      activeClass: 'bg-primary/20 border-primary',
    },
  ];

  return (
    <div className="floating-toolbar" role="toolbar" aria-label="PDF annotation tools">
      {tools.map(({ id, icon: Icon, label, color, activeClass }) => (
        <Button
          key={id}
          variant="ghost"
          size="icon"
          className={`
            min-h-touch min-w-touch transition-all
            ${activeTool === id ? activeClass : 'hover:bg-white/10'}
            ${activeTool === id ? 'border' : ''}
          `}
          onClick={() => handleToolClick(id)}
          aria-label={label}
          aria-pressed={activeTool === id}
        >
          <Icon className={`h-5 w-5 ${activeTool === id ? color : 'text-foreground'}`} />
        </Button>
      ))}

      {/* Search input */}
      {showSearch && (
        <form 
          onSubmit={handleSearchSubmit}
          className="flex items-center gap-2 ml-2 animate-fade-in"
        >
          <Input
            type="text"
            placeholder="Search in document..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-48 bg-white/10 border-white/20 text-sm"
            autoFocus
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="min-h-[36px] min-w-[36px]"
            onClick={() => {
              setShowSearch(false);
              setSearchQuery('');
              onToolChange(null);
            }}
            aria-label="Close search"
          >
            <X className="h-4 w-4" />
          </Button>
        </form>
      )}
    </div>
  );
}