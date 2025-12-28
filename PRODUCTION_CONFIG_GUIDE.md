# Production Configuration Guide - TradieMate

**Time Required:** ~40 minutes
**Difficulty:** Beginner-friendly
**Prerequisites:**
- Stripe account (free to create)
- RevenueCat account (free to create)
- Supabase project access

---

## 🎯 Overview

This guide will walk you through configuring production payment systems for TradieMate. Follow these steps in order:

1. **Stripe Setup** (15 minutes) - Payment processing
2. **RevenueCat Setup** (15 minutes) - Mobile in-app purchases
3. **Environment Variables** (5 minutes) - Connect everything
4. **Testing** (5 minutes) - Verify it works

---

## Part 1: Stripe Configuration (15 minutes)

### Step 1.1: Create Stripe Account

1. Go to [https://stripe.com](https://stripe.com)
2. Click "Start now" or "Sign up"
3. Create account with your email
4. **Complete business verification:**
   - Business name: "TradieMate" (or your company name)
   - Business type: "Software/SaaS"
   - Country: Australia
   - Currency: AUD

### Step 1.2: Create Products

1. **Navigate to Products**
   - Dashboard → Products → "+ Add product"

2. **Create Solo Tier Product**
   - Name: `TradieMate Solo`
   - Description: `Unlimited quotes & invoices for solo tradies`
   - Click "Add pricing"
   - Pricing model: `Recurring`
   - Price: `29` AUD
   - Billing period: `Monthly`
   - Click "Add product"
   - **COPY THE PRICE ID** (looks like `price_1234ABCD...`)
   - Save it as: `SOLO_PRICE_ID`

3. **Create Crew Tier Product**
   - Name: `TradieMate Crew`
   - Description: `Team features for crews up to 3 users`
   - Pricing: `49` AUD monthly
   - **COPY THE PRICE ID**
   - Save it as: `CREW_PRICE_ID`

4. **Create Pro Tier Product**
   - Name: `TradieMate Pro`
   - Description: `Full features for teams up to 10 users`
   - Pricing: `79` AUD monthly
   - **COPY THE PRICE ID**
   - Save it as: `PRO_PRICE_ID`

### Step 1.3: Get Stripe Secret Key

1. **Navigate to API Keys**
   - Dashboard → Developers → API keys

2. **Get Secret Key**
   - Look for "Secret key" section
   - Click "Reveal test key" (for testing) OR "Reveal live key" (for production)
   - **COPY THE KEY** (starts with `sk_test_...` or `sk_live_...`)
   - Save it as: `STRIPE_SECRET_KEY`

   ⚠️ **IMPORTANT:** Keep this key secure! Never commit to Git.

### Step 1.4: Create Webhook Endpoint

1. **Navigate to Webhooks**
   - Dashboard → Developers → Webhooks
   - Click "+ Add endpoint"

2. **Configure Stripe Webhook**
   - Endpoint URL: `https://YOUR_PROJECT_ID.supabase.co/functions/v1/stripe-webhook`
     - Replace `YOUR_PROJECT_ID` with your Supabase project ID (e.g., `rucuomtojzifrvplhwja`)
   - Description: `TradieMate invoice payments`
   - Events to send:
     - ✅ `checkout.session.completed`
     - ✅ `payment_intent.succeeded`
   - Click "Add endpoint"

3. **Get Webhook Secret**
   - Click on the newly created endpoint
   - Under "Signing secret", click "Reveal"
   - **COPY THE SECRET** (starts with `whsec_...`)
   - Save it as: `STRIPE_WEBHOOK_SECRET`

4. **Configure Subscription Webhook**
   - Click "+ Add endpoint" again
   - Endpoint URL: `https://YOUR_PROJECT_ID.supabase.co/functions/v1/subscription-webhook`
   - Events to send:
     - ✅ `customer.subscription.created`
     - ✅ `customer.subscription.updated`
     - ✅ `customer.subscription.deleted`
   - Click "Add endpoint"
   - **COPY THE WEBHOOK SECRET** for this endpoint too
   - Save it as: `STRIPE_SUBSCRIPTION_WEBHOOK_SECRET` (same as above, can reuse)

### Step 1.5: Update Code with Stripe Price IDs

**File to edit:** `src/lib/subscriptionTiers.ts`

Find this section (around line 36):
```typescript
// Stripe price IDs (from Stripe Dashboard > Products)
const STRIPE_PRICES = {
  solo: {
    monthly: 'price_solo_monthly',  // ← REPLACE THIS
  },
  crew: {
    monthly: 'price_crew_monthly',  // ← REPLACE THIS
  },
  pro: {
    monthly: 'price_pro_monthly',   // ← REPLACE THIS
  },
};
```

Replace with your actual price IDs:
```typescript
const STRIPE_PRICES = {
  solo: {
    monthly: 'price_1234ABCD...',  // Your SOLO_PRICE_ID from Step 1.2
  },
  crew: {
    monthly: 'price_5678EFGH...',  // Your CREW_PRICE_ID from Step 1.2
  },
  pro: {
    monthly: 'price_9012IJKL...',  // Your PRO_PRICE_ID from Step 1.2
  },
};
```

**File to edit:** `supabase/functions/subscription-webhook/index.ts`

Find this section (around line 11):
```typescript
const PRICE_TO_TIER: Record<string, string> = {
  'price_solo_monthly': 'solo',   // ← REPLACE KEY
  'price_crew_monthly': 'crew',   // ← REPLACE KEY
  'price_pro_monthly': 'pro',     // ← REPLACE KEY
};
```

Replace with your actual price IDs:
```typescript
const PRICE_TO_TIER: Record<string, string> = {
  'price_1234ABCD...': 'solo',   // Your SOLO_PRICE_ID
  'price_5678EFGH...': 'crew',   // Your CREW_PRICE_ID
  'price_9012IJKL...': 'pro',    // Your PRO_PRICE_ID
};
```

✅ **Stripe Configuration Complete!**

---

## Part 2: RevenueCat Configuration (15 minutes)

### Step 2.1: Create RevenueCat Account

1. Go to [https://app.revenuecat.com](https://app.revenuecat.com)
2. Sign up with email
3. Verify email address

### Step 2.2: Create Project

1. Click "Create a project"
2. Project name: `TradieMate`
3. Click "Create"

### Step 2.3: Create iOS App

1. In your project, click "Apps"
2. Click "+ New app"
3. Platform: `iOS`
4. App name: `TradieMate iOS`
5. Bundle ID: `app.lovable.29b56e3ce10143329011635f02c5ef86` (from capacitor.config.json)
   - **OR** use your custom bundle ID if you've changed it
6. Click "Create app"

### Step 2.4: Get iOS API Key

1. Navigate to "API Keys" (in left sidebar under Settings)
2. Look for "Apple App Store" section
3. **COPY THE API KEY** (starts with `appl_...`)
4. Save it as: `REVENUECAT_IOS_KEY`

### Step 2.5: Create Android App

1. Click "Apps" → "+ New app"
2. Platform: `Android`
3. App name: `TradieMate Android`
4. Package name: `app.lovable.29b56e3ce10143329011635f02c5ef86`
   - **OR** your custom package name
5. Click "Create app"

### Step 2.6: Get Android API Key

1. Navigate to "API Keys"
2. Look for "Google Play Store" section
3. **COPY THE API KEY** (starts with `goog_...`)
4. Save it as: `REVENUECAT_ANDROID_KEY`

### Step 2.7: Create Products in RevenueCat

1. Navigate to "Products" (in left sidebar)
2. Click "+ New product"

**Create Solo Product:**
- Product ID: `solo_monthly`
- Type: `Subscription`
- Duration: `1 month`
- Click "Create"

**Create Crew Product:**
- Product ID: `crew_monthly`
- Type: `Subscription`
- Duration: `1 month`
- Click "Create"

**Create Pro Product:**
- Product ID: `pro_monthly`
- Type: `Subscription`
- Duration: `1 month`
- Click "Create"

### Step 2.8: Create Entitlements

1. Navigate to "Entitlements" (in left sidebar)
2. Click "+ New entitlement"

**Create entitlements for each tier:**
- Entitlement ID: `solo_access` → Attach product: `solo_monthly`
- Entitlement ID: `crew_access` → Attach product: `crew_monthly`
- Entitlement ID: `pro_access` → Attach product: `pro_monthly`

### Step 2.9: Configure Webhook

1. Navigate to "Integrations" → "Webhooks"
2. Click "+ Create webhook"
3. URL: `https://YOUR_PROJECT_ID.supabase.co/functions/v1/revenuecat-webhook`
   - Replace with your Supabase project ID
4. Select events:
   - ✅ `INITIAL_PURCHASE`
   - ✅ `RENEWAL`
   - ✅ `CANCELLATION`
   - ✅ `PRODUCT_CHANGE`
   - ✅ `EXPIRATION`
   - ✅ `BILLING_ISSUE`
5. Click "Create"
6. **COPY THE AUTHORIZATION HEADER VALUE**
7. Save it as: `REVENUECAT_WEBHOOK_SECRET`

### Step 2.10: Update Code with RevenueCat Keys

**File to edit:** `capacitor.config.json`

Find this section (around line 6):
```json
{
  "plugins": {
    "RevenueCat": {
      "apiKey": "appl_PLACEHOLDER_IOS_API_KEY"  // ← REPLACE THIS
    }
  }
}
```

Replace with your iOS API key:
```json
{
  "plugins": {
    "RevenueCat": {
      "apiKey": "appl_YOUR_ACTUAL_IOS_KEY"  // From Step 2.4
    }
  }
}
```

**File to edit:** `src/lib/purchases.ts`

Find this section (around line 70):
```typescript
const iosApiKey = 'appl_PLACEHOLDER_IOS_API_KEY';        // ← REPLACE THIS
const androidApiKey = 'goog_PLACEHOLDER_ANDROID_API_KEY'; // ← REPLACE THIS
```

Replace with your actual keys:
```typescript
const iosApiKey = 'appl_YOUR_ACTUAL_IOS_KEY';        // From Step 2.4
const androidApiKey = 'goog_YOUR_ACTUAL_ANDROID_KEY'; // From Step 2.6
```

✅ **RevenueCat Configuration Complete!**

---

## Part 3: Environment Variables (5 minutes)

### Step 3.1: Navigate to Supabase Dashboard

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project (e.g., `rucuomtojzifrvplhwja`)
3. Navigate to **Settings** → **Edge Functions** → **Secrets**

### Step 3.2: Add Environment Variables

Click "+ New secret" and add each of these:

**Stripe Variables:**
```
Name: STRIPE_SECRET_KEY
Value: [Your STRIPE_SECRET_KEY from Step 1.3]

Name: STRIPE_WEBHOOK_SECRET
Value: [Your STRIPE_WEBHOOK_SECRET from Step 1.4]
```

**RevenueCat Variables:**
```
Name: REVENUECAT_WEBHOOK_SECRET
Value: [Your REVENUECAT_WEBHOOK_SECRET from Step 2.9]
```

**Note:** These are already set automatically:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`

### Step 3.3: Redeploy Edge Functions

After adding environment variables, redeploy edge functions:

```bash
cd /i/CYBERPUNK/TradieMate/elevate-mobile-experience
npx supabase functions deploy
```

Or deploy individual functions:
```bash
npx supabase functions deploy stripe-webhook
npx supabase functions deploy subscription-webhook
npx supabase functions deploy revenuecat-webhook
```

✅ **Environment Variables Configured!**

---

## Part 4: Testing (5 minutes)

### Step 4.1: Test Stripe Webhook

1. In Stripe Dashboard → Developers → Webhooks
2. Click on your `stripe-webhook` endpoint
3. Click "Send test webhook"
4. Select event: `checkout.session.completed`
5. Click "Send test webhook"
6. Check response:
   - ✅ Status: 200 OK
   - ✅ Response: `{"received": true}`
   - ❌ Status: 400/500 = Check Supabase logs

### Step 4.2: Test Subscription Webhook

1. Click on your `subscription-webhook` endpoint
2. Click "Send test webhook"
3. Select event: `customer.subscription.created`
4. Click "Send test webhook"
5. Verify 200 OK response

### Step 4.3: Test RevenueCat Webhook

1. In RevenueCat Dashboard → Integrations → Webhooks
2. Click on your webhook
3. Click "Send test event"
4. Event type: `INITIAL_PURCHASE`
5. Click "Send"
6. Check for 200 OK response

### Step 4.4: Test Payment Flow (Optional)

**Create Test Invoice:**
1. In TradieMate app, create a test invoice
2. Generate payment link
3. Use Stripe test card: `4242 4242 4242 4242`
   - Expiry: Any future date
   - CVC: Any 3 digits
   - ZIP: Any 5 digits
4. Complete payment
5. Verify invoice status updates to "Paid"

**Stripe Test Cards:**
```
Success: 4242 4242 4242 4242
Decline: 4000 0000 0000 0002
3D Secure: 4000 0027 6000 3184
```

### Step 4.5: Check Logs

**Supabase Logs:**
1. Dashboard → Logs → Edge Functions
2. Filter by function name
3. Look for successful webhook processing

**Stripe Logs:**
1. Dashboard → Developers → Webhooks
2. Click on endpoint
3. View "Attempted webhooks" tab

✅ **Testing Complete!**

---

## 🎉 Configuration Complete Checklist

- [ ] Stripe account created
- [ ] 3 Stripe products created (Solo, Crew, Pro)
- [ ] Stripe price IDs copied and updated in code
- [ ] Stripe secret key obtained
- [ ] 2 Stripe webhook endpoints created
- [ ] Stripe webhook secrets obtained
- [ ] `subscriptionTiers.ts` updated with real price IDs
- [ ] `subscription-webhook/index.ts` updated with real price IDs
- [ ] RevenueCat account created
- [ ] RevenueCat project created
- [ ] iOS app configured in RevenueCat
- [ ] Android app configured in RevenueCat
- [ ] RevenueCat API keys obtained (iOS & Android)
- [ ] 3 RevenueCat products created (solo_monthly, crew_monthly, pro_monthly)
- [ ] RevenueCat entitlements configured
- [ ] RevenueCat webhook configured
- [ ] `capacitor.config.json` updated with iOS key
- [ ] `purchases.ts` updated with both keys
- [ ] Environment variables set in Supabase
- [ ] Edge functions redeployed
- [ ] Stripe webhooks tested successfully
- [ ] RevenueCat webhook tested successfully
- [ ] Payment flow tested (optional)
- [ ] Logs verified clean

---

## 🐛 Troubleshooting

### Webhook Returns 400/500 Error

**Check:**
1. Environment variables are set correctly in Supabase
2. Webhook URL is correct (check project ID)
3. Edge function is deployed
4. Check Supabase Edge Function logs for errors

### "Invalid signature" Error

**Check:**
1. Webhook secret matches between Stripe/RevenueCat and Supabase
2. Endpoint URL is exactly correct
3. No extra spaces in environment variables

### Payment Not Updating Invoice Status

**Check:**
1. Invoice ID is in Stripe session metadata
2. Webhook received event (check Stripe webhook logs)
3. Supabase RLS policies allow update
4. Database invoice exists with correct ID

### RevenueCat Webhook Not Working

**Check:**
1. `REVENUECAT_WEBHOOK_SECRET` is set in Supabase
2. Webhook URL includes `/functions/v1/` path
3. Event types are selected in RevenueCat webhook config
4. Authorization header is sent by RevenueCat

---

## 📞 Support Resources

**Stripe:**
- Documentation: https://stripe.com/docs
- Support: https://support.stripe.com
- Test mode: https://stripe.com/docs/testing

**RevenueCat:**
- Documentation: https://www.revenuecat.com/docs
- Support: https://www.revenuecat.com/support
- Webhook testing: https://www.revenuecat.com/docs/webhooks

**Supabase:**
- Documentation: https://supabase.com/docs
- Edge Functions: https://supabase.com/docs/guides/functions
- Support: https://supabase.com/support

---

## 🚀 Next Steps After Configuration

1. **Commit Code Changes**
   ```bash
   git add .
   git commit -m "Configure production payment keys"
   git push
   ```

2. **Deploy to Production**
   ```bash
   npm run build
   npx supabase functions deploy
   ```

3. **Enable Recurring Invoice Cron**
   - Supabase Dashboard → Database → Cron Jobs
   - Add cron job to call `generate-recurring-invoices` daily at 6 AM UTC

4. **Monitor for 24 Hours**
   - Check webhook logs
   - Verify subscriptions update correctly
   - Test all payment flows

5. **Start Phase 2: Testing Infrastructure**
   - Set up automated tests
   - Create E2E test suite
   - Build CI/CD pipeline

---

**Estimated Time to Complete:** 40 minutes
**Status After Completion:** Production-ready for payments! 🎉
