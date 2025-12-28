# Configuration Values Template

Copy this file to `CONFIG_VALUES.md` (gitignored) and fill in your actual values.

**DO NOT COMMIT THIS FILE WITH REAL VALUES!**

---

## Stripe Configuration

### Price IDs (from Stripe Dashboard → Products)
```
SOLO_PRICE_ID=price_____________________
CREW_PRICE_ID=price_____________________
PRO_PRICE_ID=price_____________________
```

### API Keys (from Stripe Dashboard → Developers → API Keys)
```
STRIPE_SECRET_KEY=sk_test_____________________
# OR for production:
STRIPE_SECRET_KEY=sk_live_____________________
```

### Webhook Secrets (from Stripe Dashboard → Developers → Webhooks)
```
STRIPE_WEBHOOK_SECRET=whsec_____________________
```

---

## RevenueCat Configuration

### API Keys (from RevenueCat Dashboard → API Keys)
```
REVENUECAT_IOS_KEY=appl_____________________
REVENUECAT_ANDROID_KEY=goog_____________________
```

### Webhook Secret (from RevenueCat Dashboard → Integrations → Webhooks)
```
REVENUECAT_WEBHOOK_SECRET=_____________________
```

---

## Supabase Configuration

### Project Details
```
SUPABASE_PROJECT_ID=rucuomtojzifrvplhwja
SUPABASE_URL=https://rucuomtojzifrvplhwja.supabase.co
```

### Webhook URLs (for Stripe/RevenueCat configuration)
```
STRIPE_WEBHOOK_URL=https://rucuomtojzifrvplhwja.supabase.co/functions/v1/stripe-webhook
SUBSCRIPTION_WEBHOOK_URL=https://rucuomtojzifrvplhwja.supabase.co/functions/v1/subscription-webhook
REVENUECAT_WEBHOOK_URL=https://rucuomtojzifrvplhwja.supabase.co/functions/v1/revenuecat-webhook
```

---

## Files to Update

After filling in values above, update these files:

### 1. src/lib/subscriptionTiers.ts
Replace price IDs around line 36:
```typescript
const STRIPE_PRICES = {
  solo: { monthly: 'SOLO_PRICE_ID_HERE' },
  crew: { monthly: 'CREW_PRICE_ID_HERE' },
  pro: { monthly: 'PRO_PRICE_ID_HERE' },
};
```

### 2. supabase/functions/subscription-webhook/index.ts
Replace price-to-tier mapping around line 11:
```typescript
const PRICE_TO_TIER: Record<string, string> = {
  'SOLO_PRICE_ID_HERE': 'solo',
  'CREW_PRICE_ID_HERE': 'crew',
  'PRO_PRICE_ID_HERE': 'pro',
};
```

### 3. capacitor.config.json
Replace iOS API key around line 7:
```json
"RevenueCat": {
  "apiKey": "REVENUECAT_IOS_KEY_HERE"
}
```

### 4. src/lib/purchases.ts
Replace both API keys around line 70:
```typescript
const iosApiKey = 'REVENUECAT_IOS_KEY_HERE';
const androidApiKey = 'REVENUECAT_ANDROID_KEY_HERE';
```

---

## Environment Variables (Supabase Dashboard)

Add these in Supabase Dashboard → Settings → Edge Functions → Secrets:

```
STRIPE_SECRET_KEY=[from above]
STRIPE_WEBHOOK_SECRET=[from above]
REVENUECAT_WEBHOOK_SECRET=[from above]
```

---

## Quick Copy-Paste Commands

After filling in CONFIG_VALUES.md, use these find-replace commands:

### In src/lib/subscriptionTiers.ts:
```
Find: 'price_solo_monthly'
Replace: '[YOUR_SOLO_PRICE_ID]'

Find: 'price_crew_monthly'
Replace: '[YOUR_CREW_PRICE_ID]'

Find: 'price_pro_monthly'
Replace: '[YOUR_PRO_PRICE_ID]'
```

### In supabase/functions/subscription-webhook/index.ts:
```
Find: 'price_solo_monthly': 'solo'
Replace: '[YOUR_SOLO_PRICE_ID]': 'solo'

Find: 'price_crew_monthly': 'crew'
Replace: '[YOUR_CREW_PRICE_ID]': 'crew'

Find: 'price_pro_monthly': 'pro'
Replace: '[YOUR_PRO_PRICE_ID]': 'pro'
```

### In capacitor.config.json:
```
Find: "appl_PLACEHOLDER_IOS_API_KEY"
Replace: "[YOUR_IOS_API_KEY]"
```

### In src/lib/purchases.ts:
```
Find: 'appl_PLACEHOLDER_IOS_API_KEY'
Replace: '[YOUR_IOS_API_KEY]'

Find: 'goog_PLACEHOLDER_ANDROID_API_KEY'
Replace: '[YOUR_ANDROID_API_KEY]'
```
