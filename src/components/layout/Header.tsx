import { useState, useEffect, useRef } from 'react';
import { Scale, Calendar, MapPin, LogOut, User, Settings, Download, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { NetworkStatusPill } from './NetworkStatusPill';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { useLiveBoard } from '@/hooks/useLiveBoard';
import { useDocket } from '@/hooks/useDocket';
import { supabase } from '@/integrations/supabase/client';
import { OperationsConsole } from '@/components/admin/OperationsConsole';

type Bench = 'JAIPUR' | 'JODHPUR';

export function Header() {
  const { profile, role, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const { data: liveBoards } = useLiveBoard();
  const { data: docket } = useDocket();
  
  // Parse user's selected benches (could be comma-separated)
  const userBenches = profile?.bench?.split(',').map(b => b.trim().toUpperCase()) ?? [];
  const displayBench = userBenches.length > 1 ? 'BOTH' : userBenches[0] || 'JODHPUR';
  
  // Bench selection state - defaults to profile bench or JODHPUR
  const [selectedBench, setSelectedBench] = useState<Bench | 'BOTH'>(
    displayBench as Bench | 'BOTH'
  );
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  
  // Hidden console state - requires 7 rapid clicks on logo
  const [showOperationsConsole, setShowOperationsConsole] = useState(false);
  const clickCountRef = useRef(0);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const handleLogoClick = () => {
    clickCountRef.current += 1;
    
    // Reset click count after 2 seconds of inactivity
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }
    clickTimeoutRef.current = setTimeout(() => {
      clickCountRef.current = 0;
    }, 2000);
    
    // Open console after 7 rapid clicks
    if (clickCountRef.current >= 7) {
      clickCountRef.current = 0;
      setShowOperationsConsole(true);
    }
  };

  // Update selected bench when profile loads
  useEffect(() => {
    if (profile?.bench) {
      const benches = profile.bench.split(',').map(b => b.trim().toUpperCase());
      setSelectedBench(benches.length > 1 ? 'BOTH' : benches[0] as Bench);
    }
  }, [profile?.bench]);

  // Fetch last sync time
  useEffect(() => {
    const fetchSyncStatus = async () => {
      const { data } = await supabase
        .from('sync_status')
        .select('last_sync_at')
        .order('last_sync_at', { ascending: false })
        .limit(1)
        .single();
      
      if (data?.last_sync_at) {
        setLastSyncTime(new Date(data.last_sync_at));
      }
    };
    
    fetchSyncStatus();
    
    // Refresh every minute
    const interval = setInterval(fetchSyncStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error('Failed to sign out');
    } else {
      toast.success('Signed out successfully');
      navigate('/auth');
    }
  };

  const handleBenchChange = async (bench: Bench | 'BOTH') => {
    setSelectedBench(bench);
    
    // For database storage, convert BOTH to comma-separated value
    const benchForDb = bench === 'BOTH' ? 'JAIPUR,JODHPUR' : bench;
    
    // Update profile if user has permission
    if (profile?.id) {
      await supabase
        .from('profiles')
        .update({ bench: benchForDb })
        .eq('id', profile.id);
    }
    
    toast.success(`Switched to ${bench === 'BOTH' ? 'Both Benches' : bench + ' Bench'}`);
  };

  // Format last sync time
  const formatLastSync = () => {
    if (!lastSyncTime) return 'Never';
    
    const now = new Date();
    const diffMs = now.getTime() - lastSyncTime.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    
    return lastSyncTime.toLocaleDateString('en-IN');
  };

  return (
    <header className="border-b border-border glass-card rounded-none sticky top-0 z-40" role="banner">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div 
            className="flex items-center gap-3 cursor-pointer select-none" 
            onClick={handleLogoClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') handleLogoClick(); }}
          >
            <Scale className="h-8 w-8 text-primary" aria-hidden="true" />
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground tracking-wide">
                Vakalat-OS
              </h1>
              <p className="text-sm text-muted-foreground">
                Rajasthan High Court
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Active Bench Indicator */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/30">
              <MapPin className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">
                {selectedBench === 'BOTH' ? (
                  <>
                    <Badge variant="gold" className="mr-1">JAIPUR</Badge>
                    <Badge variant="gold">JODHPUR</Badge>
                  </>
                ) : (
                  <Badge variant="gold">{selectedBench}</Badge>
                )}
              </span>
            </div>

            {/* Bench Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="hidden lg:flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Switch Bench</span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="glass-card">
                <DropdownMenuLabel>Select Bench</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => handleBenchChange('JAIPUR')}
                  className={selectedBench === 'JAIPUR' ? 'bg-primary/10' : ''}
                >
                  <MapPin className="h-4 w-4 mr-2" />
                  Jaipur Bench
                  {selectedBench === 'JAIPUR' && (
                    <Badge variant="gold" className="ml-auto">Active</Badge>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => handleBenchChange('JODHPUR')}
                  className={selectedBench === 'JODHPUR' ? 'bg-primary/10' : ''}
                >
                  <MapPin className="h-4 w-4 mr-2" />
                  Jodhpur Bench
                  {selectedBench === 'JODHPUR' && (
                    <Badge variant="gold" className="ml-auto">Active</Badge>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => handleBenchChange('BOTH')}
                  className={selectedBench === 'BOTH' ? 'bg-primary/10' : ''}
                >
                  <MapPin className="h-4 w-4 mr-2" />
                  Both Benches
                  {selectedBench === 'BOTH' && (
                    <Badge variant="gold" className="ml-auto">Active</Badge>
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Last Sync Time */}
            <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground">
              <span>Last Synced:</span>
              <Badge variant="secondary" className="font-mono">
                {formatLastSync()}
              </Badge>
            </div>

            {/* Network Status Pill */}
            <NetworkStatusPill />

            {/* Notification Bell */}
            <NotificationBell 
              liveBoards={liveBoards ?? []} 
              userCases={docket ?? []} 
            />

            <div className="hidden md:flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" aria-hidden="true" />
                <time dateTime={new Date().toISOString().split('T')[0]}>
                  {new Date().toLocaleDateString('en-IN', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
                </time>
              </span>
            </div>

            {isAdmin && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate('/admin')}
                aria-label="Go to admin panel"
                className="min-h-touch"
              >
                <Settings className="h-4 w-4 mr-2" aria-hidden="true" />
                <span className="hidden sm:inline">Admin</span>
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 min-h-touch" aria-label="User menu">
                  <User className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">{profile?.full_name || 'User'}</span>
                  <Badge variant={role === 'SENIOR' || role === 'ADMIN' ? 'gold' : 'secondary'} className="ml-1">
                    {role || 'USER'}
                  </Badge>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 glass-card">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="flex items-center gap-2 min-h-touch">
                  <User className="h-4 w-4" aria-hidden="true" />
                  {profile?.full_name}
                </DropdownMenuItem>
                <DropdownMenuItem className="text-muted-foreground text-xs">
                  Role: {role}
                </DropdownMenuItem>
                <DropdownMenuItem className="text-muted-foreground text-xs">
                  Bench: {selectedBench}
                </DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate('/admin')} className="min-h-touch">
                      <Settings className="h-4 w-4 mr-2" aria-hidden="true" />
                      Admin Panel
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => navigate('/documentation#download')} 
                  className="min-h-touch"
                  aria-label="Download complete portal source code"
                >
                  <Download className="h-4 w-4 mr-2" aria-hidden="true" />
                  Download Source Code
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive min-h-touch">
                  <LogOut className="h-4 w-4 mr-2" aria-hidden="true" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
      
      {/* Hidden Operations Console - activated by 7 clicks on logo */}
      <OperationsConsole 
        isOpen={showOperationsConsole} 
        onClose={() => setShowOperationsConsole(false)} 
      />
    </header>
  );
}
