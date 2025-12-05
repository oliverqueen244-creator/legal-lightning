import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAliases } from '@/hooks/useAliases';
import { Plus, X, Star, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface AliasManagerProps {
  defaultName: string;
}

export default function AliasManager({ defaultName }: AliasManagerProps) {
  const { aliases, isLoading, addAlias, removeAlias, setPrimaryAlias } = useAliases();
  const [newAlias, setNewAlias] = useState('');

  // Auto-add default name as primary alias if no aliases exist
  useEffect(() => {
    if (!isLoading && aliases.length === 0 && defaultName) {
      addAlias.mutate({ aliasName: defaultName, isPrimary: true });
    }
  }, [isLoading, aliases.length, defaultName]);

  const handleAddAlias = () => {
    if (!newAlias.trim()) {
      toast.error('Please enter a name variation');
      return;
    }

    if (aliases.some((a) => a.alias_name.toLowerCase() === newAlias.trim().toLowerCase())) {
      toast.error('This alias already exists');
      return;
    }

    if (aliases.length >= 10) {
      toast.error('Maximum 10 aliases allowed');
      return;
    }

    addAlias.mutate(
      { aliasName: newAlias.trim() },
      {
        onSuccess: () => {
          setNewAlias('');
          toast.success('Alias added');
        },
        onError: () => {
          toast.error('Failed to add alias');
        },
      }
    );
  };

  const handleRemoveAlias = (aliasId: string, isPrimary: boolean) => {
    if (isPrimary && aliases.length > 1) {
      toast.error('Cannot remove primary alias. Set another as primary first.');
      return;
    }

    removeAlias.mutate(aliasId, {
      onError: () => {
        toast.error('Failed to remove alias');
      },
    });
  };

  const handleSetPrimary = (aliasId: string) => {
    setPrimaryAlias.mutate(aliasId, {
      onSuccess: () => {
        toast.success('Primary alias updated');
      },
      onError: () => {
        toast.error('Failed to update primary alias');
      },
    });
  };

  const suggestions = [
    `Adv. ${defaultName.split(' ').pop()}`,
    defaultName.split(' ').map((n) => n[0]).join('.') + '. ' + defaultName.split(' ').pop(),
    defaultName.split(' ').slice(0, -1).map((n) => n[0] + '.').join('') + ' ' + defaultName.split(' ').pop(),
  ].filter((s) => s && !aliases.some((a) => a.alias_name.toLowerCase() === s.toLowerCase()));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Court records may list your name differently. Add all variations so we can find your cases.
        </p>
      </div>

      {/* Current Aliases */}
      <div className="space-y-3">
        <p className="text-sm font-medium">Your Name Variations ({aliases.length}/10)</p>
        <div className="flex flex-wrap gap-2">
          {aliases.map((alias) => (
            <Badge
              key={alias.id}
              variant={alias.is_primary ? 'default' : 'secondary'}
              className="flex items-center gap-1 py-1.5 px-3 text-sm"
            >
              {alias.is_primary && <Star className="w-3 h-3 fill-current" />}
              {alias.alias_name}
              {!alias.is_primary && (
                <button
                  onClick={() => handleSetPrimary(alias.id)}
                  className="ml-1 hover:text-primary"
                  title="Set as primary"
                >
                  <Star className="w-3 h-3" />
                </button>
              )}
              <button
                onClick={() => handleRemoveAlias(alias.id, alias.is_primary)}
                className="ml-1 hover:text-destructive"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      </div>

      {/* Add New Alias */}
      <div className="flex gap-2">
        <Input
          placeholder="Add name variation (e.g., A.K. Sharma)"
          value={newAlias}
          onChange={(e) => setNewAlias(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddAlias()}
          className="bg-background/50"
        />
        <Button
          onClick={handleAddAlias}
          disabled={addAlias.isPending || aliases.length >= 10}
        >
          {addAlias.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Suggestions:</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <Button
                key={suggestion}
                variant="outline"
                size="sm"
                onClick={() => setNewAlias(suggestion)}
                className="text-xs"
              >
                + {suggestion}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
