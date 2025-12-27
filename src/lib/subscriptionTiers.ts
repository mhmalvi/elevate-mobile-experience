// Subscription tier configuration with Stripe price IDs
// NOTE: Update these price IDs after creating products in Stripe Dashboard

export interface TierConfig {
  id: 'free' | 'solo' | 'crew' | 'pro';
  name: string;
  price: number; // Monthly price in AUD
  stripePriceId: string | null;
  googlePlayProductId: string | null;
  appleProductId: string | null;
  features: string[];
  highlighted?: boolean;
}

export const SUBSCRIPTION_TIERS: TierConfig[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    stripePriceId: null,
    googlePlayProductId: null,
    appleProductId: null,
    features: [
      '5 quotes per month',
      '5 invoices per month',
      '10 jobs per month',
      '5 SMS notifications',
      '10 emails per month',
      '10 clients',
    ],
  },
  {
    id: 'solo',
    name: 'Solo',
    price: 19,
    stripePriceId: 'price_solo_monthly', // TODO: Update with real Stripe price ID
    googlePlayProductId: 'solo_monthly',
    appleProductId: 'solo_monthly',
    features: [
      '50 quotes per month',
      '50 invoices per month',
      '100 jobs per month',
      '25 SMS notifications',
      '50 emails per month',
      '100 clients',
    ],
  },
  {
    id: 'crew',
    name: 'Crew',
    price: 49,
    stripePriceId: 'price_crew_monthly', // TODO: Update with real Stripe price ID
    googlePlayProductId: 'crew_monthly',
    appleProductId: 'crew_monthly',
    highlighted: true,
    features: [
      'Unlimited quotes',
      'Unlimited invoices',
      'Unlimited jobs',
      '100 SMS notifications',
      'Unlimited emails',
      'Unlimited clients',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 99,
    stripePriceId: 'price_pro_monthly', // TODO: Update with real Stripe price ID
    googlePlayProductId: 'pro_monthly',
    appleProductId: 'pro_monthly',
    features: [
      'Everything in Crew',
      'Unlimited SMS',
      'Priority support',
      'Custom branding',
      'API access',
      'Team features (coming soon)',
    ],
  },
];

export function getTierById(id: string): TierConfig | undefined {
  return SUBSCRIPTION_TIERS.find(tier => tier.id === id);
}

export function getTierByStripePriceId(priceId: string): TierConfig | undefined {
  return SUBSCRIPTION_TIERS.find(tier => tier.stripePriceId === priceId);
}
