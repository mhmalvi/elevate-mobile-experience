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
  free: {
    quotes: 5,
    invoices: 5,
    jobs: 10,
    sms: 5,
    emails: 10,
    clients: 10,
  },
  solo: {
    quotes: 50,
    invoices: 50,
    jobs: 100,
    sms: 25,
    emails: 50,
    clients: 100,
  },
  crew: {
    quotes: -1, // -1 = unlimited
    invoices: -1,
    jobs: -1,
    sms: 100,
    emails: -1,
    clients: -1,
  },
  pro: {
    quotes: -1,
    invoices: -1,
    jobs: -1,
    sms: -1,
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
