// Subscription tier limits configuration
export type SubscriptionTier = 'free' | 'solo' | 'crew' | 'pro';

export interface TierLimits {
  quotes: number;
  invoices: number;
  jobs: number;
  sms: number;
  emails: number;
  clients: number;
}

export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  // The free tier is deliberately asymmetric: generous on quotes, tight on
  // invoices.
  //
  // Usage resets monthly (usage_tracking is keyed by month_year), so any limit
  // here is a permanent allowance, not a one-off trial. At the previous
  // 5 invoices/month a solo operator doing four or five jobs a month — exactly
  // the person the $29 Solo tier is for — could run their whole business on
  // free indefinitely and never meet a paywall.
  //
  // Quotes are how a tradie *wins* work, so being generous there is aligned
  // with their success and costs us nothing. Invoices are how they *get paid* —
  // that is where the product proves its value, and where the upgrade belongs.
  // Two invoices is enough to send a real one to a real customer and see it
  // work, and not enough to run on.
  free: {
    quotes: 5,
    invoices: 2,
    jobs: 3,
    sms: 5,
    emails: 10,
    clients: 10,
  },
  solo: {
    quotes: -1, // -1 = unlimited
    invoices: -1,
    jobs: -1,
    sms: 50,
    emails: -1,
    clients: -1,
  },
  crew: {
    quotes: -1,
    invoices: -1,
    jobs: -1,
    sms: 200,
    emails: -1,
    clients: -1,
  },
  pro: {
    quotes: -1,
    invoices: -1,
    jobs: -1,
    sms: 500,
    emails: -1,
    clients: -1,
  },
};

export const TIER_NAMES: Record<SubscriptionTier, string> = {
  free: 'Free',
  solo: 'Solo ($29/mo)',
  crew: 'Crew ($49/mo)',
  pro: 'Pro ($79/mo)',
};

export type UsageType = keyof TierLimits;

export function getLimit(tier: SubscriptionTier, usageType: UsageType): number {
  return TIER_LIMITS[tier]?.[usageType] ?? TIER_LIMITS.free[usageType];
}

export function isUnlimited(limit: number): boolean {
  return limit === -1;
}

export function formatLimit(limit: number): string {
  return limit === -1 ? 'Unlimited' : limit.toString();
}
