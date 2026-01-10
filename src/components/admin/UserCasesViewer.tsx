import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Users, Calendar, Search, MapPin, Scale } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DateSelector } from '@/components/dashboard/DateSelector';

interface UserProfile {
  id: string;
  full_name: string | null;
  role: string | null;
  bench: string | null;
}

/**
 * Admin component to view any user's case docket
 */
export function UserCasesViewer() {
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  
  const formattedDate = format(selectedDate, 'yyyy-MM-dd');

  // Fetch all user profiles
  const { data: users, isLoading: loadingUsers } = useQuery({
    queryKey: ['admin-all-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, bench')
        .order('full_name');
      
      if (error) throw error;
      return data as UserProfile[];
    },
  });

  // Fetch cases for selected user
  const { data: cases, isLoading: loadingCases } = useQuery({
    queryKey: ['admin-user-cases', selectedUserId, formattedDate],
    queryFn: async () => {
      if (!selectedUserId) return [];
      
      const { data, error } = await supabase
        .from('daily_court_docket')
        .select('*')
        .eq('matched_profile_id', selectedUserId)
        .eq('date', formattedDate)
        .order('court_room_no')
        .order('item_no');
      
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!selectedUserId,
  });

  // Filter cases by search term
  const filteredCases = cases?.filter(c => 
    !searchTerm || 
    c.case_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.petitioner?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.respondent?.toLowerCase().includes(searchTerm.toLowerCase())
  ) ?? [];

  // Get user display name
  const selectedUser = users?.find(u => u.id === selectedUserId);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            View User Cases
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* User Selection */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Select Lawyer</label>
              {loadingUsers ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a lawyer..." />
                  </SelectTrigger>
                  <SelectContent>
                    {users?.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        <div className="flex items-center gap-2">
                          <span>{user.full_name || 'Unknown'}</span>
                          {user.role && (
                            <Badge variant="outline" className="text-xs">
                              {user.role}
                            </Badge>
                          )}
                          {user.bench && (
                            <Badge variant="secondary" className="text-xs">
                              {user.bench}
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Date</label>
              <DateSelector 
                selectedDate={selectedDate} 
                onDateChange={setSelectedDate}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Filter Cases</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search case number, parties..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          {/* Stats Summary */}
          {selectedUserId && cases && (
            <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">
                  {selectedUser?.full_name || 'Selected User'}
                </span>
              </div>
              <Badge variant="secondary">
                {cases.length} case{cases.length !== 1 ? 's' : ''} on {format(selectedDate, 'dd MMM yyyy')}
              </Badge>
              {searchTerm && (
                <Badge variant="outline">
                  {filteredCases.length} matching filter
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cases List */}
      {selectedUserId && (
        <Card>
          <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5 text-primary" />
            Cases for {format(selectedDate, 'EEEE, dd MMMM yyyy')}
          </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingCases ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : filteredCases.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Scale className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No cases found for this user on the selected date</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredCases.map((item) => (
                  <div 
                    key={item.id} 
                    className="p-4 border border-border rounded-lg hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-mono text-sm font-semibold text-primary">
                            {item.case_number || 'N/A'}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            Court {item.court_room_no}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            Item #{item.item_no}
                          </Badge>
                          <Badge 
                            variant={item.list_type === 'SUPPLEMENTARY' ? 'destructive' : 'default'}
                            className="text-xs"
                          >
                            {item.list_type}
                          </Badge>
                          <Badge 
                            variant={item.matched_role === 'petitioner' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {item.matched_role === 'petitioner' ? '🟢 Petitioner' : '🔵 Respondent'}
                          </Badge>
                        </div>

                        {/* Lawyers */}
                        <div className="text-sm text-muted-foreground mb-1">
                          <span className={item.matched_role === 'petitioner' ? 'font-medium text-foreground' : ''}>
                            {item.petitioner_lawyer || 'N/A'}
                          </span>
                          <span className="mx-2">vs</span>
                          <span className={item.matched_role === 'respondent' ? 'font-medium text-foreground' : ''}>
                            {item.respondent_lawyer || 'N/A'}
                          </span>
                        </div>

                        {/* Parties */}
                        <div className="text-xs text-muted-foreground truncate">
                          {item.petitioner} vs {item.respondent}
                        </div>

                        {/* Judge */}
                        {item.judge_names && (
                          <div className="text-xs text-muted-foreground mt-1">
                            <span className="text-primary/70">Judge:</span> {item.judge_names}
                          </div>
                        )}
                      </div>

                      {/* Location */}
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant="outline" className="shrink-0">
                          <MapPin className="h-3 w-3 mr-1" />
                          {item.court_location}
                        </Badge>
                        <Badge 
                          variant={
                            item.status === 'done' ? 'default' :
                            item.status === 'active' ? 'destructive' :
                            'secondary'
                          }
                          className="text-xs"
                        >
                          {item.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* No User Selected */}
      {!selectedUserId && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Select a lawyer to view their cases</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
