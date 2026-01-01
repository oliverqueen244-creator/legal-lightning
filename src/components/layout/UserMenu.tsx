import { useNavigate } from 'react-router-dom';
import {
  User,
  LogOut,
  MapPin,
  Fingerprint,
  Shield,
  Check,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Role-Aware User Menu (Top Right Dropdown)
 * 
 * AUDIT FIX: Removed all non-functional menu items.
 * Only functional, implemented routes and handlers are included.
 * 
 * Bench selection now properly mutates profile state and refetches data.
 */
export function UserMenu() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, profile, role, isAdmin, signOut } = useAuth();

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error('Failed to sign out');
    } else {
      toast.success('Signed out successfully');
      navigate('/auth');
    }
  };

  // SUPPORT FIX: Clear cache & reload for recovery
  const handleClearCache = async () => {
    try {
      // Clear service worker caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }

      // Clear IndexedDB (offline cache)
      const databases = await indexedDB.databases();
      for (const db of databases) {
        if (db.name) {
          indexedDB.deleteDatabase(db.name);
        }
      }

      // Unregister service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(r => r.unregister()));
      }

      toast.success('Cache cleared', {
        description: 'Reloading application...',
      });

      // Reload after a brief delay
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error('Failed to clear cache:', error);
      toast.error('Failed to clear cache');
    }
  };

  // Handle bench selection - actually mutates profile and refetches data
  const handleBenchChange = async (bench: 'JAIPUR' | 'JODHPUR' | 'JAIPUR,JODHPUR') => {
    if (!user?.id) return;

    const { error } = await supabase
      .from('profiles')
      .update({ bench })
      .eq('id', user.id);

    if (error) {
      toast.error('Failed to update bench');
      return;
    }

    toast.success(`Bench updated to ${bench === 'JAIPUR,JODHPUR' ? 'Both Benches' : bench}`);
    
    // Invalidate and refetch relevant queries
    queryClient.invalidateQueries({ queryKey: ['profile'] });
    queryClient.invalidateQueries({ queryKey: ['docket'] });
    queryClient.invalidateQueries({ queryKey: ['live-board'] });
    queryClient.invalidateQueries({ queryKey: ['morning-brief'] });
  };

  const isSenior = role === 'SENIOR';
  const currentBench = profile?.bench || 'JODHPUR';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className="flex items-center gap-2 min-h-touch" 
          aria-label="User menu"
        >
          <User className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline max-w-[120px] truncate">
            {profile?.full_name || 'User'}
          </span>
          <Badge 
            variant={isSenior || isAdmin ? 'gold' : 'secondary'} 
            className="ml-1"
          >
            {role || 'USER'}
          </Badge>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64 glass-card">
        {/* Profile Section */}
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{profile?.full_name}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {role} • {currentBench || 'No bench'}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Functional Menu Items Only */}
        <DropdownMenuGroup>
          <DropdownMenuItem 
            onClick={() => navigate('/onboarding')}
            className="min-h-touch"
          >
            <User className="mr-2 h-4 w-4" />
            Profile
          </DropdownMenuItem>

          {/* Bench Selection - FUNCTIONAL: updates profile and refetches data */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="min-h-touch">
              <MapPin className="mr-2 h-4 w-4" />
              Bench
              <Badge variant="outline" className="ml-auto text-xs">
                {currentBench === 'JAIPUR,JODHPUR' ? 'Both' : currentBench}
              </Badge>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="glass-card">
              <DropdownMenuItem onClick={() => handleBenchChange('JAIPUR')}>
                {currentBench === 'JAIPUR' && <Check className="mr-2 h-4 w-4" />}
                {currentBench !== 'JAIPUR' && <span className="mr-6" />}
                Jaipur Bench
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleBenchChange('JODHPUR')}>
                {currentBench === 'JODHPUR' && <Check className="mr-2 h-4 w-4" />}
                {currentBench !== 'JODHPUR' && <span className="mr-6" />}
                Jodhpur Bench
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleBenchChange('JAIPUR,JODHPUR')}>
                {currentBench === 'JAIPUR,JODHPUR' && <Check className="mr-2 h-4 w-4" />}
                {currentBench !== 'JAIPUR,JODHPUR' && <span className="mr-6" />}
                Both Benches
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {/* Alias Management - FUNCTIONAL: navigates to onboarding with aliases step */}
          <DropdownMenuItem 
            onClick={() => navigate('/onboarding?step=aliases')}
            className="min-h-touch"
          >
            <Fingerprint className="mr-2 h-4 w-4" />
            Name Aliases
          </DropdownMenuItem>
        </DropdownMenuGroup>

        {/* Admin Panel - Only for Admins - FUNCTIONAL */}
        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => navigate('/admin')}
              className="min-h-touch"
            >
              <Shield className="mr-2 h-4 w-4" />
              Admin Panel
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator />

        {/* SUPPORT FIX: Clear Cache & Reload - for support recovery */}
        <DropdownMenuItem 
          onClick={handleClearCache} 
          className="text-muted-foreground min-h-touch"
        >
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          Clear cache & reload
        </DropdownMenuItem>

        {/* Sign Out - FUNCTIONAL */}
        <DropdownMenuItem 
          onClick={handleSignOut} 
          className="text-destructive min-h-touch"
        >
          <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
