/**
 * Server-Side Usage Limit Enforcement
 *
 * SECURITY: Prevents subscription tier bypass by enforcing limits server-side
 * Client-side limits can be bypassed, so we validate on the server
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type SubscriptionTier = 'free' | 'solo' | 'crew' | 'business';
export type UsageType = 'quotes' | 'invoices' | 'jobs' | 'emails' | 'sms' | 'clients';

/**
 * Usage limits per tier per month
 * These MUST match the client-side limits in src/lib/tierLimits.ts
 */
const TIER_LIMITS: Record<SubscriptionTier, Record<UsageType, number | null>> = {
  free: {
    quotes: 5,
    invoices: 5,
    jobs: 10,
    emails: 20,
    sms: 0,
    clients: 10,
  },
  solo: {
    quotes: null, // Unlimited
    invoices: null,
    jobs: null,
    emails: null,
    sms: 100,
    clients: null,
  },
  crew: {
    quotes: null,
    invoices: null,
    jobs: null,
    emails: null,
    sms: 500,
    clients: null,
  },
  business: {
    quotes: null,
    invoices: null,
    jobs: null,
    emails: null,
    sms: null,
    clients: null,
  },
};

/**
 * Map usage type to usage_tracking column name
 */
const USAGE_TYPE_TO_COLUMN: Record<UsageType, string> = {
  quotes: 'quotes_created',
  invoices: 'invoices_created',
  jobs: 'jobs_created',
  emails: 'emails_sent',
  sms: 'sms_sent',
  clients: 'clients_created',
};

/**
 * Get current month-year string for usage tracking
 */
function getCurrentMonthYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Check if a user can perform an action based on their tier limits
 * @returns Object with allowed status and details
 */
export async function checkUsageLimit(
  supabase: SupabaseClient,
  userId: string,
  usageType: UsageType
): Promise<{
  allowed: boolean;
  tier: SubscriptionTier;
  used: number;
  limit: number | null;
  remaining: number | null;
  error?: string;
}> {
  try {
    // Get user's subscription tier from profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      return {
        allowed: false,
        tier: 'free',
        used: 0,
        limit: 0,
        remaining: 0,
        error: 'Failed to fetch user profile',
      };
    }

    const tier = (profile.subscription_tier as SubscriptionTier) || 'free';
    const limit = TIER_LIMITS[tier][usageType];

    // If limit is null, it's unlimited
    if (limit === null) {
      return {
        allowed: true,
        tier,
        used: 0,
        limit: null,
        remaining: null,
      };
    }

    // Get current usage for this month
    const monthYear = getCurrentMonthYear();
    const column = USAGE_TYPE_TO_COLUMN[usageType];

    const { data: usage, error: usageError } = await supabase
      .from('usage_tracking')
      .select(column)
      .eq('user_id', userId)
      .eq('month_year', monthYear)
      .maybeSingle();

    if (usageError) {
      console.error('Error fetching usage:', usageError);
      // Allow on error to prevent blocking users due to DB issues
      // But log this for monitoring
      return {
        allowed: true,
        tier,
        used: 0,
        limit,
        remaining: limit,
        error: 'Failed to fetch usage data',
      };
    }

    const used = usage?.[column] || 0;
    const remaining = limit - used;

    return {
      allowed: remaining > 0,
      tier,
      used,
      limit,
      remaining,
    };
  } catch (error) {
    console.error('Error checking usage limit:', error);
    // Fail open to prevent blocking users
    return {
      allowed: true,
      tier: 'free',
      used: 0,
      limit: 0,
      remaining: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Increment usage count for a user
 * Should be called after successfully creating an entity
 */
export async function incrementUsage(
  supabase: SupabaseClient,
  userId: string,
  usageType: UsageType
): Promise<{ success: boolean; error?: string }> {
  try {
    const monthYear = getCurrentMonthYear();
    const column = USAGE_TYPE_TO_COLUMN[usageType];

    // Try to get existing record
    const { data: existing } = await supabase
      .from('usage_tracking')
      .select('*')
      .eq('user_id', userId)
      .eq('month_year', monthYear)
      .maybeSingle();

    if (existing) {
      // Update existing record
      const { error } = await supabase
        .from('usage_tracking')
        .update({
          [column]: (existing[column] || 0) + 1,
        })
        .eq('user_id', userId)
        .eq('month_year', monthYear);

      if (error) {
        console.error('Error updating usage:', error);
        return { success: false, error: error.message };
      }
    } else {
      // Create new record
      const { error } = await supabase
        .from('usage_tracking')
        .insert({
          user_id: userId,
          month_year: monthYear,
          [column]: 1,
          quotes_created: column === 'quotes_created' ? 1 : 0,
          invoices_created: column === 'invoices_created' ? 1 : 0,
          jobs_created: column === 'jobs_created' ? 1 : 0,
          emails_sent: column === 'emails_sent' ? 1 : 0,
          sms_sent: column === 'sms_sent' ? 1 : 0,
          clients_created: column === 'clients_created' ? 1 : 0,
        });

      if (error) {
        console.error('Error creating usage record:', error);
        return { success: false, error: error.message };
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Error incrementing usage:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Validate usage limit and return error response if exceeded
 * Use this in edge functions before creating entities
 */
export async function enforceUsageLimit(
  supabase: SupabaseClient,
  userId: string,
  usageType: UsageType
): Promise<{ allowed: boolean; response?: Response }> {
  const check = await checkUsageLimit(supabase, userId, usageType);

  if (!check.allowed) {
    const limitText = check.limit === null ? 'unlimited' : check.limit.toString();
    const message = check.limit === 0
      ? `Your ${check.tier} plan does not include ${usageType}. Please upgrade your subscription.`
      : `You've reached your monthly limit of ${limitText} ${usageType}. Please upgrade your subscription or wait until next month.`;

    return {
      allowed: false,
      response: new Response(
        JSON.stringify({
          error: 'Usage limit exceeded',
          message,
          details: {
            tier: check.tier,
            used: check.used,
            limit: check.limit,
            remaining: check.remaining || 0,
          },
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      ),
    };
  }

  return { allowed: true };
}
