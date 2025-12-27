// Subscription tier configuration with Stripe price IDs
// Configure these in your .env file:
// - VITE_STRIPE_PRICE_ID_SOLO
// - VITE_STRIPE_PRICE_ID_CREW
// - VITE_STRIPE_PRICE_ID_PRO
//
// To create these price IDs:
// 1. Go to https://dashboard.stripe.com/products
// 2. Create products for Solo ($19 AUD/month), Crew ($49 AUD/month), Pro ($99 AUD/month)
// 3. Copy the price IDs (starting with 'price_') and add them to your .env file

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
    stripePriceId: import.meta.env.VITE_STRIPE_PRICE_ID_SOLO || null,
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
    stripePriceId: import.meta.env.VITE_STRIPE_PRICE_ID_CREW || null,
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
    stripePriceId: import.meta.env.VITE_STRIPE_PRICE_ID_PRO || null,
    googlePlayProductId: 'pro_monthly',
    appleProductId: 'pro_monthly',
    features: [
      'Everything in Crew',
      'Unlimited SMS',
      'Priority support',
      'API access',
    ],
  },
];

export function getTierById(id: string): TierConfig | undefined {
  return SUBSCRIPTION_TIERS.find(tier => tier.id === id);
}

export function getTierByStripePriceId(priceId: string): TierConfig | undefined {
  return SUBSCRIPTION_TIERS.find(tier => tier.stripePriceId === priceId);
}
