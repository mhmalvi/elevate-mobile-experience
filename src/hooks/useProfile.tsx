import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Tables } from '@/integrations/supabase/types';
import { cacheSubscription, getCachedSubscription } from '@/lib/subscriptionCache';

type Profile = Tables<'profiles'>;

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!error && data) {
      setProfile(data);
      // Cache subscription data for offline use (uses Capacitor Preferences with localStorage fallback)
      cacheSubscription(
        user.id,
        data.subscription_tier || 'free',
        data.subscription_provider || null,
        data.subscription_expires_at || null
      );
    } else if (error) {
      // Offline or network error — use cached subscription data
      const cached = await getCachedSubscription(user.id);
      if (cached) {
        setProfile({
          user_id: user.id,
          subscription_tier: cached.tier,
          subscription_expires_at: cached.expiresAt,
          subscription_provider: cached.provider,
        } as Partial<typeof profile>);
      }
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchProfile();
    } else {
      setProfile(null);
      setLoading(false);
    }
  }, [user, fetchProfile]);

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: new Error('Not authenticated') };

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('user_id', user.id);

    if (!error) {
      await fetchProfile();
    }
    return { error };
  };

  return { profile, loading, updateProfile, refetch: fetchProfile };
}

