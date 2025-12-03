import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'SENIOR' | 'JUNIOR' | 'CLERK' | 'ADMIN';

export function useUserRole(userId: string | undefined) {
  return useQuery({
    queryKey: ['user-role', userId],
    queryFn: async () => {
      if (!userId) return null;
      
      const { data, error } = await supabase
        .rpc('get_user_role', { _user_id: userId });

      if (error) {
        console.error('Error fetching user role:', error);
        return null;
      }
      
      return data as AppRole | null;
    },
    enabled: !!userId,
  });
}

export function useHasRole(userId: string | undefined, role: AppRole) {
  return useQuery({
    queryKey: ['has-role', userId, role],
    queryFn: async () => {
      if (!userId) return false;
      
      const { data, error } = await supabase
        .rpc('has_role', { _user_id: userId, _role: role });

      if (error) {
        console.error('Error checking user role:', error);
        return false;
      }
      
      return data as boolean;
    },
    enabled: !!userId,
  });
}
