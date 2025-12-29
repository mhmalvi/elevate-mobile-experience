# 🔗 Webhook Configuration Guide

**All webhook endpoints are now deployed and ready to configure!**

---

## 📍 Webhook URLs

### **1. Stripe Webhook**
**URL:** `https://rucuomtojzifrvplhwja.supabase.co/functions/v1/stripe-webhook`

**Configure at:** https://dashboard.stripe.com/webhooks

**Events to listen for:**
- ✅ `checkout.session.completed` - When client completes payment
- ✅ `payment_intent.succeeded` - When payment is successfully processed

**Current Status:**
- Webhook secret already configured: `whsec_yjWweyRkmwFHItOFT3UWAcRgMnVAYRf0`
- ✅ Should already be configured in Stripe dashboard

**To verify:**
1. Go to https://dashboard.stripe.com/webhooks
2. Look for endpoint with URL above
3. Check that events are selected
4. Verify signing secret matches `.env` value

---

### **2. RevenueCat Webhook**
**URL:** `https://rucuomtojzifrvplhwja.supabase.co/functions/v1/revenuecat-webhook`

**Configure at:** https://app.revenuecat.com/webhooks

**Events handled:**
- ✅ `INITIAL_PURCHASE` - First subscription purchase
- ✅ `RENEWAL` - Subscription renewal
- ✅ `PRODUCT_CHANGE` - Tier upgrade/downgrade
- ✅ `CANCELLATION` - User cancelled subscription
- ✅ `EXPIRATION` - Subscription expired
- ✅ `BILLING_ISSUE` - Payment failed

**⚠️ ACTION REQUIRED:**
1. Go to https://app.revenuecat.com/webhooks
2. Click "Add Webhook"
3. Enter URL: `https://rucuomtojzifrvplhwja.supabase.co/functions/v1/revenuecat-webhook`
4. Copy the **Authorization Header** value
5. Update `.env` file:
   ```bash
   REVENUECAT_WEBHOOK_SECRET="[paste authorization header here]"
   ```
6. Restart your Edge Functions or redeploy

**Current Status:**
- ⚠️ Webhook secret is placeholder: `your_webhook_secret_from_revenuecat_dashboard`
- ❌ **MUST UPDATE** before webhooks will work

---

## 🧪 Testing Webhooks

### **Test Stripe Webhook:**

#### Option 1: Stripe Dashboard (Recommended)
1. Go to https://dashboard.stripe.com/webhooks
2. Click on your webhook endpoint
3. Click "Send test webhook"
4. Select event: `checkout.session.completed`
5. Click "Send test event"
6. Check Supabase logs:
   ```bash
   npx supabase functions logs stripe-webhook --tail
   ```

#### Option 2: Stripe CLI
```bash
# Install Stripe CLI
npm install -g stripe

# Login
stripe login

# Forward webhooks to local
stripe listen --forward-to https://rucuomtojzifrvplhwja.supabase.co/functions/v1/stripe-webhook

# Trigger test event
stripe trigger checkout.session.completed
```

#### Option 3: Create Real Test Payment
1. Create test invoice in app
2. Get payment link
3. Use test card: `4242 4242 4242 4242`
4. Complete payment
5. Check invoice status updates to "paid"

---

### **Test RevenueCat Webhook:**

#### Option 1: RevenueCat Dashboard
1. Go to https://app.revenuecat.com/webhooks
2. Select your webhook
3. Click "Send Test Event"
4. Select event type: `INITIAL_PURCHASE`
5. Send event
6. Check Supabase logs:
   ```bash
   npx supabase functions logs revenuecat-webhook --tail
   ```

#### Option 2: Make Test Purchase
1. Use RevenueCat sandbox mode
2. Create test subscription purchase
3. Verify webhook fires
4. Check profile updated in database:
   ```sql
   SELECT subscription_tier, subscription_provider, subscription_expires_at
   FROM profiles
   WHERE user_id = '[your-user-id]';
   ```

---

## 🔍 Webhook Verification

### Check if Webhooks are Working:

#### **Stripe Webhook:**
```bash
# View recent logs
npx supabase functions logs stripe-webhook

# Check for successful events
# Look for: "Received Stripe event: checkout.session.completed"
# Look for: "Invoice xxx updated: status=paid"
```

**Expected log output:**
```
Received Stripe event: checkout.session.completed
Checkout session completed. Invoice ID: abc-123
Invoice abc-123 updated: status=paid, amount_paid=990.00
```

#### **RevenueCat Webhook:**
```bash
# View recent logs
npx supabase functions logs revenuecat-webhook

# Look for subscription events
# Look for: "Subscription activated for [user-id]"
```

**Expected log output:**
```
RevenueCat webhook received: INITIAL_PURCHASE
Product ID: solo_monthly, Tier: solo
✅ Subscription activated for user-123
```

---

## 🚨 Troubleshooting

### Stripe Webhook Not Firing:

**Check 1: Webhook is configured**
```bash
# List webhooks
stripe webhooks list
```

**Check 2: Correct events selected**
- Must have `checkout.session.completed` selected
- Must have `payment_intent.succeeded` selected

**Check 3: Signing secret matches**
- Get secret from Stripe dashboard
- Compare with `.env` STRIPE_WEBHOOK_SECRET
- Redeploy function if changed

**Check 4: Test endpoint**
```bash
curl -X POST https://rucuomtojzifrvplhwja.supabase.co/functions/v1/stripe-webhook \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

---

### RevenueCat Webhook Not Firing:

**Check 1: Webhook URL is correct**
- Verify URL in RevenueCat dashboard
- Should be: `https://rucuomtojzifrvplhwja.supabase.co/functions/v1/revenuecat-webhook`

**Check 2: Authorization header is set**
```bash
# Check .env file
cat .env | grep REVENUECAT_WEBHOOK_SECRET

# Should NOT be: "your_webhook_secret_from_revenuecat_dashboard"
# Should be: actual authorization header from RevenueCat
```

**Check 3: Function is deployed**
```bash
npx supabase functions list | grep revenuecat
```

**Check 4: Test endpoint**
```bash
curl -X POST https://rucuomtojzifrvplhwja.supabase.co/functions/v1/revenuecat-webhook \
  -H "Content-Type: application/json" \
  -d '{"event_type": "INITIAL_PURCHASE", "app_user_id": "test"}'
```

---

## 📊 Webhook Event Flow

### **Stripe Payment Flow:**
```
1. Client pays invoice
   ↓
2. Stripe processes payment
   ↓
3. Stripe fires webhook → checkout.session.completed
   ↓
4. Our webhook function receives event
   ↓
5. Extracts invoice_id from metadata
   ↓
6. Updates invoice in database:
   - status = "paid"
   - amount_paid = payment amount
   - paid_at = current timestamp
   ↓
7. Tradie gets notification
```

### **RevenueCat Subscription Flow:**
```
1. User subscribes in app
   ↓
2. RevenueCat processes via App Store/Play Store
   ↓
3. RevenueCat fires webhook → INITIAL_PURCHASE
   ↓
4. Our webhook function receives event
   ↓
5. Extracts product_id and maps to tier
   ↓
6. Updates profile in database:
   - subscription_tier = "solo"/"crew"/"pro"
   - subscription_status = "active"
   - subscription_provider = "apple_iap"/"google_play"
   - subscription_expires_at = expiration date
   ↓
7. App unlocks premium features
```

---

## ✅ Verification Checklist

Before marking webhooks as complete:

### Stripe Webhook:
- [ ] Webhook configured in Stripe dashboard
- [ ] Events selected: `checkout.session.completed`, `payment_intent.succeeded`
- [ ] Signing secret matches `.env` value
- [ ] Test event sent successfully
- [ ] Logs show event received
- [ ] Test payment updates invoice status
- [ ] No errors in function logs

### RevenueCat Webhook:
- [ ] Webhook added in RevenueCat dashboard
- [ ] URL is correct
- [ ] Authorization header copied to `.env`
- [ ] `.env` updated (not placeholder value)
- [ ] Edge Functions redeployed with new secret
- [ ] Test event sent successfully
- [ ] Logs show event received
- [ ] Test subscription updates profile
- [ ] No errors in function logs

---

## 📝 Quick Reference

**Webhook URLs:**
```
Stripe:     https://rucuomtojzifrvplhwja.supabase.co/functions/v1/stripe-webhook
RevenueCat: https://rucuomtojzifrvplhwja.supabase.co/functions/v1/revenuecat-webhook
```

**View Logs:**
```bash
# Stripe
npx supabase functions logs stripe-webhook --tail

# RevenueCat
npx supabase functions logs revenuecat-webhook --tail
```

**Test Endpoints:**
```bash
# Stripe (requires valid signature)
curl -X POST [stripe-webhook-url] -H "stripe-signature: [sig]"

# RevenueCat (requires authorization header)
curl -X POST [revenuecat-webhook-url] -H "Authorization: [header]"
```

---

**Status:**
- ✅ Stripe Webhook: Configured
- ⚠️ RevenueCat Webhook: **NEEDS CONFIGURATION**

**Next Action:** Update `REVENUECAT_WEBHOOK_SECRET` in `.env` and redeploy functions
