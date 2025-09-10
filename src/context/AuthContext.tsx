import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabaseClient";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error?: string } | void>;
  signIn: (email: string, password: string) => Promise<{ error?: string } | void>;
  signInWithOAuth: (provider: 'google' | 'github' | 'discord') => Promise<{ error?: string } | void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Supabase client will be retrieved lazily to avoid early crashes when config isn't injected yet
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    const init = async () => {
      try {
        const supabase = getSupabase();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
        const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
          setSession(session);
          setUser(session?.user ?? null);
        });
        unsub = () => listener.subscription.unsubscribe();
      } catch (e) {
        console.warn("Supabase config missing; initializing without auth.", e);
      } finally {
        setLoading(false);
      }
    };
    init();
    return () => {
      unsub?.();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };
    } catch {
      return { error: "Supabase not configured" };
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    try {
      const supabase = getSupabase();
      const redirectUrl = `${window.location.origin}/`;
      const { error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          emailRedirectTo: redirectUrl
        }
      });
      if (error) return { error: error.message };
    } catch {
      return { error: "Supabase not configured" };
    }
  }, []);

  const signInWithOAuth = useCallback(async (provider: 'google' | 'github' | 'discord') => {
    try {
      const supabase = getSupabase();
      const redirectUrl = `${window.location.origin}/`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUrl
        }
      });
      if (error) return { error: error.message };
    } catch {
      return { error: "Supabase not configured" };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      const supabase = getSupabase();
      await supabase.auth.signOut();
    } catch {
      // ignore when not configured
    }
  }, []);

  const value = useMemo(
    () => ({ user, session, loading, signIn, signUp, signInWithOAuth, signOut }),
    [user, session, loading, signIn, signUp, signInWithOAuth, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
