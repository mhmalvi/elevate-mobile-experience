import { useState, useEffect, useRef, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { initializePurchases, setRevenueCatUserId, logOutRevenueCat } from '@/lib/purchases';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ data?: any; error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ data?: any; error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const rcInitialized = useRef(false);

  // Initialize RevenueCat with a user ID (required by Web SDK)
  const initRC = async (userId: string) => {
    if (rcInitialized.current) {
      // Already initialized - just sync the user ID
      await setRevenueCatUserId(userId).catch(() => {});
      return;
    }
    try {
      await initializePurchases(userId);
      rcInitialized.current = true;
    } catch (err: any) {
      console.warn('[RevenueCat] Init skipped:', err.message);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Initialize/sync RevenueCat on auth changes
        if (event === 'SIGNED_IN' && session?.user) {
          initRC(session.user.id);
        } else if (event === 'SIGNED_OUT') {
          logOutRevenueCat().catch(() => {});
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // Initialize RevenueCat for existing session
      if (session?.user) {
        initRC(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });
    return { data, error };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
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
