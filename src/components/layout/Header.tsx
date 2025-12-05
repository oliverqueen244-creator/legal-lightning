import { Scale, Calendar, MapPin, LogOut, User, Settings, Download } from 'lucide-react';
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

export function Header() {
  const { profile, role, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error('Failed to sign out');
    } else {
      toast.success('Signed out successfully');
      navigate('/auth');
    }
  };

  return (
    <header className="border-b border-border glass-card rounded-none sticky top-0 z-40" role="banner">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Scale className="h-8 w-8 text-primary" aria-hidden="true" />
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground tracking-wide">
                Vakalat-OS
              </h1>
              <p className="text-sm text-muted-foreground">
                Rajasthan High Court Dashboard
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Network Status Pill */}
            <NetworkStatusPill />

            <div className="hidden md:flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" aria-hidden="true" />
                <time dateTime={new Date().toISOString().split('T')[0]}>
                  {new Date().toLocaleDateString('en-IN', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </time>
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" aria-hidden="true" />
                Jodhpur Bench
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
    </header>
  );
}