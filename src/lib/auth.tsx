import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from './supabase';

export interface UserProfile {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  karma: number;
  level: string;
  avatar_url: string | null;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, username: string, displayName?: string) => Promise<{ error?: string }>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  session: null,
  loading: true,
  signUp: async () => ({}),
  signIn: async () => ({}),
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = useCallback(async (userId: string) => {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (data && !error) {
        setUserProfile(data as UserProfile);
      }
    } catch (err) {
      console.warn('Failed to fetch user profile:', err);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchUserProfile(user.id);
    }
  }, [user, fetchUserProfile]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      if (initialSession?.user) {
        fetchUserProfile(initialSession.user.id);
        try { localStorage.setItem('burnboard_current_user_id', initialSession.user.id); } catch {}
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        if (newSession?.user) {
          await fetchUserProfile(newSession.user.id);
          try { localStorage.setItem('burnboard_current_user_id', newSession.user.id); } catch {}
        } else {
          setUserProfile(null);
          try { localStorage.removeItem('burnboard_current_user_id'); } catch {}
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchUserProfile]);

  const signUp = useCallback(async (email: string, password: string, username: string, displayName?: string) => {
    if (!isSupabaseConfigured || !supabase) {
      return { error: 'Supabase not configured' };
    }

    try {
      // Check if username is taken
      const { data: existing } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('username', username)
        .single();

      if (existing) {
        return { error: 'Username already taken' };
      }

      // Sign up with Supabase Auth
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username, display_name: displayName || username }
        }
      });

      if (signUpError) {
        return { error: signUpError.message };
      }

      if (data.user) {
        // Create user profile
        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert({
            id: data.user.id,
            username,
            display_name: displayName || username,
            bio: null,
            karma: 0,
            level: 'Newbie',
            avatar_url: null,
          });

        if (profileError) {
          console.warn('Profile creation error:', profileError);
          // Don't return error - auth succeeded, profile can be created later
        }
      }

      return {};
    } catch (err: any) {
      return { error: err.message || 'Sign up failed' };
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured || !supabase) {
      return { error: 'Supabase not configured' };
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        return { error: error.message };
      }
      return {};
    } catch (err: any) {
      return { error: err.message || 'Login failed' };
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setUserProfile(null);
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        session,
        loading,
        signUp,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
