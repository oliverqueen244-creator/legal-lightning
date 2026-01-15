import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAliases } from '@/hooks/useAliases';
import { Plus, X, Star, Loader2, Info } from 'lucide-react';
import { toast } from 'sonner';
import { normalizeLawyerName, generateAliasVariations } from '@/lib/lawyerNameUtils';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AliasManagerProps {
  defaultName: string;
}

export default function AliasManager({ defaultName }: AliasManagerProps) {
  const { aliases, isLoading, addAlias, removeAlias, setPrimaryAlias } = useAliases();
  const [newAlias, setNewAlias] = useState('');

  // Get the normalized core name (without prefixes)
  const coreName = normalizeLawyerName(defaultName);

  // Auto-add normalized core name as primary alias if no aliases exist
  useEffect(() => {
    if (!isLoading && aliases.length === 0 && coreName) {
      addAlias.mutate({ aliasName: coreName, isPrimary: true });
    }
  }, [isLoading, aliases.length, coreName]);

  const handleAddAlias = () => {
    if (!newAlias.trim()) {
      toast.error('Please enter a name variation');
      return;
    }

    // Normalize for comparison
    const normalizedNew = normalizeLawyerName(newAlias);
    if (aliases.some((a) => a.alias_name.toUpperCase() === normalizedNew)) {
      toast.error('This name variation already exists');
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
          toast.success('Name variation added');
        },
        onError: () => {
          toast.error('Failed to add name variation');
        },
      }
    );
  };

  const handleRemoveAlias = (aliasId: string, isPrimary: boolean) => {
    if (isPrimary && aliases.length > 1) {
      toast.error('Cannot remove primary name. Set another as primary first.');
      return;
    }

    removeAlias.mutate(aliasId, {
      onError: () => {
        toast.error('Failed to remove name variation');
      },
    });
  };

  const handleSetPrimary = (aliasId: string) => {
    setPrimaryAlias.mutate(aliasId, {
      onSuccess: () => {
        toast.success('Primary name updated');
      },
      onError: () => {
        toast.error('Failed to update primary name');
      },
    });
  };

  // Generate name variations based on core name
  const suggestions = generateAliasVariations(coreName)
    .filter((s) => !aliases.some((a) => a.alias_name.toUpperCase() === s.toUpperCase()))
    .slice(0, 4); // Limit to 4 suggestions

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Alert className="border-primary/20 bg-primary/5">
        <Info className="h-4 w-4 text-primary" />
        <AlertDescription className="text-sm">
          Prefixes like "Adv.", "Mr.", "Mrs." are automatically removed for better matching. 
          Court records often list names without these titles.
        </AlertDescription>
      </Alert>

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

      {/* Detected name variations */}
      {suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Detected variations:</p>
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
