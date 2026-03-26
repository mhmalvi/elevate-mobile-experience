import { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext, ReactNode } from 'react';
import { User, Session, AuthResponse } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { initializePurchases, setRevenueCatUserId, logOutRevenueCat } from '@/lib/purchases';
import { clearSubscriptionCache } from '@/lib/subscriptionCache';
import { clearSecureStorage } from '@/lib/secureStorage';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<AuthResponse>;
  signIn: (email: string, password: string) => Promise<AuthResponse>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const rcInitialized = useRef(false);
  const initializedByListener = useRef(false);

  // Initialize RevenueCat with a user ID (required by Web SDK)
  const initRC = async (userId: string) => {
    if (rcInitialized.current) {
      await setRevenueCatUserId(userId).catch(() => {});
      return;
    }
    try {
      await initializePurchases(userId);
      rcInitialized.current = true;
    } catch (err: unknown) {
      console.warn('[RevenueCat] Init skipped:', err instanceof Error ? err.message : err);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST — this is the single source of truth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        initializedByListener.current = true;
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        if (event === 'SIGNED_IN' && session?.user) {
          initRC(session.user.id);
        } else if (event === 'SIGNED_OUT') {
          logOutRevenueCat().catch(() => {});
        }
      }
    );

    // Fallback: only use getSession if the listener hasn't fired yet
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!initializedByListener.current) {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        if (session?.user) {
          initRC(session.user.id);
        }
      }
    }).catch((err) => {
      console.error('[Auth] Failed to get session:', err);
      if (!initializedByListener.current) {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });
    return { data, error };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  }, []);

  const signOut = useCallback(async () => {
    await clearSubscriptionCache();
    await clearSecureStorage();
    await supabase.auth.signOut();
  }, []);

  const value = useMemo(() => ({
    user, session, loading, signUp, signIn, signOut,
  }), [user, session, loading, signUp, signIn, signOut]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
