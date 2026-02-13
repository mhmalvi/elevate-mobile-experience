import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Tables } from '@/integrations/supabase/types';

type Profile = Tables<'profiles'>;

const SUBSCRIPTION_CACHE_KEY = 'tradiemate_subscription_cache';

interface SubscriptionCache {
  subscription_tier: string;
  subscription_expires_at: string | null;
  subscription_provider: string | null;
  cached_at: number;
}

function cacheSubscription(profile: Profile) {
  try {
    const cache: SubscriptionCache = {
      subscription_tier: profile.subscription_tier || 'free',
      subscription_expires_at: profile.subscription_expires_at,
      subscription_provider: profile.subscription_provider,
      cached_at: Date.now(),
    };
    localStorage.setItem(SUBSCRIPTION_CACHE_KEY, JSON.stringify(cache));
  } catch { /* localStorage may be unavailable */ }
}

function getCachedSubscription(): SubscriptionCache | null {
  try {
    const raw = localStorage.getItem(SUBSCRIPTION_CACHE_KEY);
    if (!raw) return null;
    const cache: SubscriptionCache = JSON.parse(raw);
    // Expire cache after 7 days
    if (Date.now() - cache.cached_at > 7 * 24 * 60 * 60 * 1000) return null;
    // If subscription has an expiry date and it's passed, treat as free
    if (cache.subscription_expires_at && new Date(cache.subscription_expires_at) < new Date()) {
      return { ...cache, subscription_tier: 'free', subscription_provider: null };
    }
    return cache;
  } catch {
    return null;
  }
}

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchProfile();
    } else {
      setProfile(null);
      setLoading(false);
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!error && data) {
      setProfile(data);
      cacheSubscription(data);
    } else if (error) {
      // Offline or network error — use cached subscription data
      const cached = getCachedSubscription();
      if (cached && profile) {
        setProfile({
          ...profile,
          subscription_tier: cached.subscription_tier,
          subscription_expires_at: cached.subscription_expires_at,
          subscription_provider: cached.subscription_provider,
        });
      }
    }
    setLoading(false);
  };

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
