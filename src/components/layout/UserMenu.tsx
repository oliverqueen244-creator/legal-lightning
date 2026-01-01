import { useNavigate } from 'react-router-dom';
import {
  User,
  LogOut,
  Settings,
  Bell,
  Users,
  CreditCard,
  MapPin,
  Clock,
  Fingerprint,
  Shield,
  HelpCircle,
  FileText,
  Calendar,
  ChevronRight,
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
import { toast } from 'sonner';

/**
 * Role-Aware User Menu (Top Right Dropdown)
 * All non-urgent and configuration actions live here
 * NEVER surface settings during execution
 */
export function UserMenu() {
  const navigate = useNavigate();
  const { profile, role, isAdmin, signOut } = useAuth();

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error('Failed to sign out');
    } else {
      toast.success('Signed out successfully');
      navigate('/auth');
    }
  };

  const isSenior = role === 'SENIOR';
  const isJunior = role === 'JUNIOR';

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
              {role} • {profile?.bench || 'No bench'}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Common Menu Items */}
        <DropdownMenuGroup>
          <DropdownMenuItem 
            onClick={() => navigate('/onboarding')}
            className="min-h-touch"
          >
            <User className="mr-2 h-4 w-4" />
            Profile
            <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
          </DropdownMenuItem>

          {/* Bench Selection */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="min-h-touch">
              <MapPin className="mr-2 h-4 w-4" />
              Bench
              <Badge variant="outline" className="ml-auto text-xs">
                {profile?.bench || 'JODHPUR'}
              </Badge>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="glass-card">
              <DropdownMenuItem>Jaipur Bench</DropdownMenuItem>
              <DropdownMenuItem>Jodhpur Bench</DropdownMenuItem>
              <DropdownMenuItem>Both Benches</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {/* Alias Management */}
          <DropdownMenuItem 
            onClick={() => navigate('/onboarding?step=aliases')}
            className="min-h-touch"
          >
            <Fingerprint className="mr-2 h-4 w-4" />
            Name Aliases
            <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {/* Settings Groups */}
        <DropdownMenuGroup>
          {/* Court Settings */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="min-h-touch">
              <Clock className="mr-2 h-4 w-4" />
              Court Settings
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="glass-card w-56">
              <DropdownMenuItem>Court Hours</DropdownMenuItem>
              <DropdownMenuItem>Court Mode Auto-Enable</DropdownMenuItem>
              <DropdownMenuItem>Escalation Preferences</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {/* Notification Settings */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="min-h-touch">
              <Bell className="mr-2 h-4 w-4" />
              Notifications
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="glass-card w-56">
              <DropdownMenuItem>Alert Types</DropdownMenuItem>
              <DropdownMenuItem>WhatsApp Escalation</DropdownMenuItem>
              <DropdownMenuItem>Quiet Hours</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuGroup>

        {/* Senior-Only Items */}
        {isSenior && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Senior Options
              </DropdownMenuLabel>
              <DropdownMenuItem className="min-h-touch">
                <Users className="mr-2 h-4 w-4" />
                Team Overview
                <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
              </DropdownMenuItem>
              <DropdownMenuItem className="min-h-touch">
                <Settings className="mr-2 h-4 w-4" />
                AI Preferences
                <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
              </DropdownMenuItem>
              <DropdownMenuItem className="min-h-touch">
                <FileText className="mr-2 h-4 w-4" />
                Export Notes
              </DropdownMenuItem>
              <DropdownMenuItem className="min-h-touch">
                <Calendar className="mr-2 h-4 w-4" />
                Archive / History
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        )}

        {/* Junior-Only Items */}
        {isJunior && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Junior Options
              </DropdownMenuLabel>
              <DropdownMenuItem className="min-h-touch">
                <Users className="mr-2 h-4 w-4" />
                Assigned Seniors
                <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
              </DropdownMenuItem>
              <DropdownMenuItem className="min-h-touch">
                <FileText className="mr-2 h-4 w-4" />
                Task History
              </DropdownMenuItem>
              <DropdownMenuItem className="min-h-touch">
                <Clock className="mr-2 h-4 w-4" />
                Availability Status
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        )}

        <DropdownMenuSeparator />

        {/* Account & Support */}
        <DropdownMenuGroup>
          <DropdownMenuItem className="min-h-touch">
            <CreditCard className="mr-2 h-4 w-4" />
            Subscription
            <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
          </DropdownMenuItem>
          <DropdownMenuItem className="min-h-touch">
            <HelpCircle className="mr-2 h-4 w-4" />
            Help & Support
          </DropdownMenuItem>
        </DropdownMenuGroup>

        {/* Admin Panel - Only for Admins */}
        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => navigate('/admin')}
              className="min-h-touch"
            >
              <Shield className="mr-2 h-4 w-4" />
              Admin Panel
              <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator />

        {/* Sign Out */}
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
