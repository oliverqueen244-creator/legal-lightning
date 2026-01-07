import { useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Profile } from '@/types/database';

export type AppRole = 'SENIOR' | 'JUNIOR' | 'CLERK' | 'ADMIN';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!error && data) {
        setProfile(data as Profile);
      } else {
        console.warn('[useAuth] Profile fetch failed or not found:', error?.message);
        setProfile(null);
      }
    } catch (err) {
      console.error('[useAuth] Profile fetch error:', err);
      setProfile(null);
    }
  }, []);

  const fetchRole = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .rpc('get_user_role', { _user_id: userId });

      if (!error && data) {
        setRole(data as AppRole);
      }
    } catch (err) {
      console.error('[useAuth] Role fetch error:', err);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    let initialLoadDone = false;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;
        
        console.log('[useAuth] Auth state change:', event, !!session);
        
        setSession(session);
        setUser(session?.user ?? null);
        
        // Only fetch profile/role on auth state changes AFTER initial load
        // to avoid duplicate fetches
        if (session?.user && initialLoadDone) {
          fetchProfile(session.user.id);
          fetchRole(session.user.id);
        } else if (!session) {
          setProfile(null);
          setRole(null);
        }
      }
    );

    // THEN check for existing session
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!isMounted) return;
        
        console.log('[useAuth] Initial session:', !!session);
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Wait for profile and role to load before setting loading to false
          await Promise.all([
            fetchProfile(session.user.id),
            fetchRole(session.user.id)
          ]);
        }
      } catch (err) {
        console.error('[useAuth] Session initialization error:', err);
      } finally {
        if (isMounted) {
          initialLoadDone = true;
          setLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile, fetchRole]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string, selectedRole: 'SENIOR' | 'JUNIOR' | 'CLERK') => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          role: selectedRole,
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  return {
    user,
    session,
    profile,
    role,
    loading,
    signIn,
    signUp,
    signOut,
    isAuthenticated: !!session,
    isSenior: role === 'SENIOR',
    isJunior: role === 'JUNIOR',
    isAdmin: role === 'ADMIN',
  };
}
