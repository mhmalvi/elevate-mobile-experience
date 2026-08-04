import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Tables } from '@/integrations/supabase/types';
import { cacheSubscription, getCachedSubscription } from '@/lib/subscriptionCache';
import { setLocaleSettings, resetLocaleSettings } from '@/lib/money';
import { getCountry } from '@/lib/countries';

type Profile = Tables<'profiles'>;

/**
 * Publish the business's currency/tax/locale so `formatCurrency`,
 * `calculateTax` and `formatDate` render correctly everywhere without each
 * call site needing the profile.
 */
function publishLocaleSettings(profile: Profile) {
  const country = getCountry(profile.country_code);
  setLocaleSettings({
    countryCode: profile.country_code || country.code,
    currency: profile.currency_code || country.currency,
    // A profile-level locale override wins; otherwise use the country default.
    locale: profile.locale || country.locale,
    taxRate: typeof profile.tax_rate === 'number' ? profile.tax_rate : country.taxRate,
    taxLabel: profile.tax_label || country.taxLabel,
    taxInclusive:
      typeof profile.tax_inclusive_pricing === 'boolean'
        ? profile.tax_inclusive_pricing
        : country.taxInclusivePricing,
  });
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
      resetLocaleSettings();
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
      publishLocaleSettings(data);
      // Cache subscription data for offline use (uses Capacitor Preferences with localStorage fallback)
      cacheSubscription(
        user.id,
        data.subscription_tier || 'free',
        data.subscription_provider || null,
        data.subscription_expires_at || null
      );
    } else if (error) {
      // Offline or network error — fall back to cached subscription data.
      //
      // This previously read `if (cached && profile)`, but on a cold offline
      // start `profile` is still null, so the guard never passed and the user
      // dropped to no profile at all instead of their cached tier. Merge onto
      // whatever we have, using functional state so we read the current value
      // rather than the one captured when this closure was created.
      const cached = await getCachedSubscription(user.id);
      if (cached) {
        setProfile(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            subscription_tier: cached.tier,
            subscription_expires_at: cached.expiresAt,
            subscription_provider: cached.provider,
          };
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
