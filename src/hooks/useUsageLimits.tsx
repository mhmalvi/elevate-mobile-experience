import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { getLimit, isUnlimited, UsageType, SubscriptionTier } from '@/lib/tierLimits';
import { format } from 'date-fns';

interface UsageData {
  quotes_created: number;
  invoices_created: number;
  jobs_created: number;
  emails_sent: number;
  sms_sent: number;
  clients_created: number;
}

interface UsageLimitsResult {
  loading: boolean;
  canCreate: boolean;
  used: number;
  limit: number;
  remaining: number;
  isUnlimited: boolean;
  tier: SubscriptionTier;
  incrementUsage: () => Promise<void>;
  refreshUsage: () => Promise<void>;
}

const usageTypeToColumn: Record<UsageType, keyof UsageData> = {
  quotes: 'quotes_created',
  invoices: 'invoices_created',
  jobs: 'jobs_created',
  emails: 'emails_sent',
  sms: 'sms_sent',
  clients: 'clients_created',
};

export function useUsageLimits(usageType: UsageType): UsageLimitsResult {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [loading, setLoading] = useState(true);
  const [usageData, setUsageData] = useState<UsageData | null>(null);

  const tier = (profile?.subscription_tier as SubscriptionTier) || 'free';
  const monthYear = format(new Date(), 'yyyy-MM');

  const fetchUsage = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('usage_tracking')
        .select('*')
        .eq('user_id', user.id)
        .eq('month_year', monthYear)
        .maybeSingle();

      if (error) {
        console.error('Error fetching usage:', error);
      }

      setUsageData(data || {
        quotes_created: 0,
        invoices_created: 0,
        jobs_created: 0,
        emails_sent: 0,
        sms_sent: 0,
        clients_created: 0,
      });
    } catch (err) {
      console.error('Error fetching usage:', err);
    } finally {
      setLoading(false);
    }
  }, [user, monthYear]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  const incrementUsage = useCallback(async () => {
    if (!user) return;

    const column = usageTypeToColumn[usageType];

    try {
      // Try to upsert the usage record
      const { data: existing } = await supabase
        .from('usage_tracking')
        .select('*')
        .eq('user_id', user.id)
        .eq('month_year', monthYear)
        .maybeSingle();

      if (existing) {
        // Update existing record
        await supabase
          .from('usage_tracking')
          .update({ [column]: (existing[column] || 0) + 1 })
          .eq('user_id', user.id)
          .eq('month_year', monthYear);
      } else {
        // Insert new record
        await supabase
          .from('usage_tracking')
          .insert({
            user_id: user.id,
            month_year: monthYear,
            [column]: 1,
          });
      }

      // Refresh local state
      await fetchUsage();
    } catch (err) {
      console.error('Error incrementing usage:', err);
    }
  }, [user, usageType, monthYear, fetchUsage]);

  const column = usageTypeToColumn[usageType];
  const used = usageData?.[column] || 0;
  const limit = getLimit(tier, usageType);
  const unlimited = isUnlimited(limit);
  const remaining = unlimited ? Infinity : Math.max(0, limit - used);
  const canCreate = unlimited || used < limit;

  return {
    loading,
    canCreate,
    used,
    limit,
    remaining,
    isUnlimited: unlimited,
    tier,
    incrementUsage,
    refreshUsage: fetchUsage,
  };
}

// Hook to get all usage limits at once
export function useAllUsageLimits() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [loading, setLoading] = useState(true);
  const [usageData, setUsageData] = useState<UsageData | null>(null);

  const tier = (profile?.subscription_tier as SubscriptionTier) || 'free';
  const monthYear = format(new Date(), 'yyyy-MM');

  useEffect(() => {
    async function fetchUsage() {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const { data } = await supabase
          .from('usage_tracking')
          .select('*')
          .eq('user_id', user.id)
          .eq('month_year', monthYear)
          .maybeSingle();

        setUsageData(data || {
          quotes_created: 0,
          invoices_created: 0,
          jobs_created: 0,
          emails_sent: 0,
          sms_sent: 0,
          clients_created: 0,
        });
      } catch (err) {
        console.error('Error fetching usage:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchUsage();
  }, [user, monthYear]);

  const getUsageForType = (type: UsageType) => {
    const column = usageTypeToColumn[type];
    const used = usageData?.[column] || 0;
    const limit = getLimit(tier, type);
    const unlimited = isUnlimited(limit);
    return {
      used,
      limit,
      remaining: unlimited ? Infinity : Math.max(0, limit - used),
      canCreate: unlimited || used < limit,
      isUnlimited: unlimited,
    };
  };

  return {
    loading,
    tier,
    getUsageForType,
    quotes: getUsageForType('quotes'),
    invoices: getUsageForType('invoices'),
    jobs: getUsageForType('jobs'),
    emails: getUsageForType('emails'),
    sms: getUsageForType('sms'),
    clients: getUsageForType('clients'),
  };
}
