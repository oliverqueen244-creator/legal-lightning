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
  const [profileLoading, setProfileLoading] = useState(false);

  const fetchProfile = useCallback(async (userId: string) => {
    setProfileLoading(true);
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
    } finally {
      setProfileLoading(false);
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

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Use setTimeout to avoid potential deadlock with Supabase client
          setTimeout(() => {
            if (isMounted) {
              fetchProfile(session.user.id);
              fetchRole(session.user.id);
            }
          }, 0);
        } else {
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
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Wait for profile to load before setting loading to false
          await Promise.all([
            fetchProfile(session.user.id),
            fetchRole(session.user.id)
          ]);
        }
      } catch (err) {
        console.error('[useAuth] Session initialization error:', err);
      } finally {
        if (isMounted) {
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

  // Combined loading state: auth loading OR profile still loading after auth
  const isFullyLoaded = !loading && (!session || !profileLoading);

  return {
    user,
    session,
    profile,
    role,
    loading: !isFullyLoaded,
    signIn,
    signUp,
    signOut,
    isAuthenticated: !!session,
    isSenior: role === 'SENIOR',
    isJunior: role === 'JUNIOR',
    isAdmin: role === 'ADMIN',
  };
}
