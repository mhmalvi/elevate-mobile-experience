// Subscription tier configuration with Stripe price IDs
// Configure these in your .env file:
// Monthly: VITE_STRIPE_PRICE_ID_SOLO, VITE_STRIPE_PRICE_ID_CREW, VITE_STRIPE_PRICE_ID_PRO
// Annual: VITE_STRIPE_PRICE_ID_SOLO_ANNUAL, VITE_STRIPE_PRICE_ID_CREW_ANNUAL, VITE_STRIPE_PRICE_ID_PRO_ANNUAL

export interface TierConfig {
  id: 'free' | 'solo' | 'crew' | 'pro';
  name: string;
  price: number; // Monthly price in AUD
  annualPrice: number; // Monthly price when billed annually (AUD)
  stripePriceId: string | null;
  annualStripePriceId: string | null;
  googlePlayProductId: string | null;
  annualGooglePlayProductId: string | null;
  appleProductId: string | null;
  annualAppleProductId: string | null;
  userLimit: number; // Max users (-1 = unlimited)
  features: string[];
  highlighted?: boolean;
}

export const SUBSCRIPTION_TIERS: TierConfig[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    annualPrice: 0,
    stripePriceId: null,
    annualStripePriceId: null,
    googlePlayProductId: null,
    annualGooglePlayProductId: null,
    appleProductId: null,
    annualAppleProductId: null,
    userLimit: 1,
    features: [
      '5 quotes per month',
      'Basic invoicing (5/month)',
      '3 active jobs',
      '1 user',
      'Branding on documents',
      '30-day data history',
    ],
  },
  {
    id: 'solo',
    name: 'Solo',
    price: 29,
    annualPrice: 24,
    stripePriceId: import.meta.env.VITE_STRIPE_PRICE_ID_SOLO || null,
    annualStripePriceId: import.meta.env.VITE_STRIPE_PRICE_ID_SOLO_ANNUAL || null,
    googlePlayProductId: 'solo_monthly',
    annualGooglePlayProductId: 'solo_annual',
    appleProductId: 'solo_monthly',
    annualAppleProductId: 'solo_annual',
    userLimit: 1,
    features: [
      'Unlimited quotes & invoices',
      'Unlimited jobs',
      'Remove branding from documents',
      'Job costing & profitability',
      'Payment tracking',
      'Accounting integration (Xero/QuickBooks)',
      '50 SMS reminders/month',
      '1 user',
      'Priority email support',
    ],
  },
  {
    id: 'crew',
    name: 'Crew',
    price: 49,
    annualPrice: 39,
    stripePriceId: import.meta.env.VITE_STRIPE_PRICE_ID_CREW || null,
    annualStripePriceId: import.meta.env.VITE_STRIPE_PRICE_ID_CREW_ANNUAL || null,
    googlePlayProductId: 'crew_monthly',
    annualGooglePlayProductId: 'crew_annual',
    appleProductId: 'crew_monthly',
    annualAppleProductId: 'crew_annual',
    userLimit: 3,
    highlighted: true,
    features: [
      'Everything in Solo',
      'Up to 3 users',
      'Team calendar & scheduling',
      'Staff timesheets',
      'Job assignment',
      '200 SMS reminders/month',
      'Advanced reporting',
      'Dedicated onboarding call',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 79,
    annualPrice: 65,
    stripePriceId: import.meta.env.VITE_STRIPE_PRICE_ID_PRO || null,
    annualStripePriceId: import.meta.env.VITE_STRIPE_PRICE_ID_PRO_ANNUAL || null,
    googlePlayProductId: 'pro_monthly',
    annualGooglePlayProductId: 'pro_annual',
    appleProductId: 'pro_monthly',
    annualAppleProductId: 'pro_annual',
    userLimit: 10,
    features: [
      'Everything in Crew',
      'Up to 10 users',
      'Subcontractor management',
      'Custom branding (your logo everywhere)',
      '500 SMS reminders/month',
      'API access',
      'White-label option',
      'Phone support',
    ],
  },
];

export function getTierById(id: string): TierConfig | undefined {
  return SUBSCRIPTION_TIERS.find(tier => tier.id === id);
}

export function getTierByStripePriceId(priceId: string): TierConfig | undefined {
  return SUBSCRIPTION_TIERS.find(tier => tier.stripePriceId === priceId || tier.annualStripePriceId === priceId);
}
