# 🚀 Production Configuration Quick Start

**Status:** Ready for production configuration
**Time Required:** 40 minutes
**Last Updated:** December 29, 2025

---

## 📋 What You Need

Before starting, have these accounts ready:

- [ ] **Stripe Account** (free) - [stripe.com](https://stripe.com)
- [ ] **RevenueCat Account** (free) - [revenuecat.com](https://www.revenuecat.com)
- [ ] **Supabase Dashboard Access** - [supabase.com/dashboard](https://supabase.com/dashboard)

---

## ⚡ Quick Start (3 Steps)

### Step 1: Follow the Configuration Guide (30 minutes)

Open and follow: **[PRODUCTION_CONFIG_GUIDE.md](./PRODUCTION_CONFIG_GUIDE.md)**

This guide walks you through:
1. Creating Stripe products and getting price IDs
2. Setting up RevenueCat for iOS/Android
3. Configuring all API keys and webhooks

### Step 2: Verify Your Configuration (2 minutes)

Run the verification script:

```bash
node verify-config.js
```

This will check if all placeholders have been replaced with real values.

### Step 3: Deploy and Test (8 minutes)

```bash
# Deploy edge functions with new environment variables
npx supabase functions deploy

# Build the application
npm run build

# Test the app
npm run dev
```

Then test:
- [ ] Create a test invoice
- [ ] Generate payment link
- [ ] Complete test payment (use Stripe test card: 4242 4242 4242 4242)
- [ ] Verify invoice updates to "Paid"

---

## 📁 Important Files

| File | Purpose |
|------|---------|
| **PRODUCTION_CONFIG_GUIDE.md** | Step-by-step configuration instructions |
| **CONFIG_VALUES.template.md** | Template to track your API keys |
| **SECURITY_SETUP.md** | Security configuration and best practices |
| **verify-config.js** | Script to verify configuration is complete |
| **PHASE_1_COMPLETE.md** | Summary of security implementations |

---

## 🔑 Configuration Checklist

### Stripe Configuration
- [ ] Created 3 products (Solo $29, Crew $49, Pro $79)
- [ ] Copied price IDs
- [ ] Updated `src/lib/subscriptionTiers.ts` with real price IDs
- [ ] Updated `supabase/functions/subscription-webhook/index.ts` with price mapping
- [ ] Created webhook endpoints in Stripe Dashboard
- [ ] Added `STRIPE_SECRET_KEY` to Supabase environment variables
- [ ] Added `STRIPE_WEBHOOK_SECRET` to Supabase environment variables

### RevenueCat Configuration
- [ ] Created iOS app in RevenueCat
- [ ] Created Android app in RevenueCat
- [ ] Copied iOS API key (starts with `appl_`)
- [ ] Copied Android API key (starts with `goog_`)
- [ ] Updated `capacitor.config.json` with iOS key
- [ ] Updated `src/lib/purchases.ts` with both keys
- [ ] Created 3 products (solo_monthly, crew_monthly, pro_monthly)
- [ ] Created webhook endpoint
- [ ] Added `REVENUECAT_WEBHOOK_SECRET` to Supabase environment variables

### Deployment
- [ ] All environment variables set in Supabase Dashboard
- [ ] Edge functions deployed
- [ ] Application built successfully
- [ ] Webhooks tested (all return 200 OK)
- [ ] Payment flow tested

---

## 🧪 Testing Commands

### Test Webhook Endpoints

**Stripe Webhook:**
```bash
curl -X POST https://rucuomtojzifrvplhwja.supabase.co/functions/v1/stripe-webhook \
  -H "Content-Type: application/json" \
  -H "stripe-signature: test" \
  -d '{"type":"checkout.session.completed"}'
```

**RevenueCat Webhook:**
```bash
curl -X POST https://rucuomtojzifrvplhwja.supabase.co/functions/v1/revenuecat-webhook \
  -H "Content-Type: application/json" \
  -H "X-RevenueCat-Signature: test" \
  -d '{"api_version":"1.0","event":{"type":"INITIAL_PURCHASE"}}'
```

### Verify Configuration
```bash
node verify-config.js
```

### Check Supabase Logs
```bash
npx supabase functions logs stripe-webhook
npx supabase functions logs subscription-webhook
npx supabase functions logs revenuecat-webhook
```

---

## 🐛 Common Issues

### Issue: "Invalid signature" error

**Solution:**
1. Check that webhook secret matches between service and Supabase
2. Verify no extra spaces in environment variables
3. Ensure webhook URL is exact (include `/functions/v1/`)

### Issue: Placeholders still in code

**Solution:**
Run `node verify-config.js` to find which files still have placeholders, then update them following PRODUCTION_CONFIG_GUIDE.md

### Issue: Webhook returns 500 error

**Solution:**
1. Check Supabase Edge Function logs for error details
2. Verify environment variables are set correctly
3. Ensure edge functions are deployed after setting env vars

---

## 📚 Additional Resources

- **Security Guide:** [SECURITY_SETUP.md](./SECURITY_SETUP.md)
- **Phase 1 Summary:** [PHASE_1_COMPLETE.md](./PHASE_1_COMPLETE.md)
- **Updated Audit:** [UPDATED_AUDIT_29-12-25.md](./UPDATED_AUDIT_29-12-25.md)
- **Stripe Docs:** [stripe.com/docs](https://stripe.com/docs)
- **RevenueCat Docs:** [revenuecat.com/docs](https://www.revenuecat.com/docs)
- **Supabase Docs:** [supabase.com/docs](https://supabase.com/docs)

---

## ✅ Success Criteria

Your configuration is complete when:

1. ✅ `node verify-config.js` shows all green checkmarks
2. ✅ All webhook endpoints return 200 OK when tested
3. ✅ Test payment completes and updates invoice status
4. ✅ No placeholder values remain in code
5. ✅ Environment variables set in Supabase Dashboard

---

## 🎯 After Configuration

Once configuration is complete, you can:

1. **Start Phase 2: Testing Infrastructure**
   - Set up automated tests
   - Add E2E testing
   - Build CI/CD pipeline

2. **Launch Beta**
   - Invite 10-20 beta users
   - Monitor for issues
   - Gather feedback

3. **Public Launch**
   - Marketing campaign
   - App Store submission (iOS)
   - Play Store submission (Android)
   - Web app launch

---

## 💡 Pro Tips

1. **Use Test Mode First**
   - Configure Stripe in test mode
   - Use test API keys (start with `sk_test_`)
   - Test thoroughly before switching to live mode

2. **Keep Track of Keys**
   - Copy `CONFIG_VALUES.template.md` to `CONFIG_VALUES.md`
   - Fill in all your keys (this file is gitignored)
   - Use this as a reference when updating code

3. **Test Webhooks Early**
   - Test webhooks immediately after configuration
   - Check Supabase logs for any errors
   - Fix issues before moving forward

4. **Monitor Initially**
   - Watch webhook logs for first 24 hours
   - Check for any failed payments
   - Verify subscriptions update correctly

---

**Need Help?**
- Review the detailed guide: **PRODUCTION_CONFIG_GUIDE.md**
- Check security setup: **SECURITY_SETUP.md**
- See completed work: **PHASE_1_COMPLETE.md**

---

**Estimated Time:** 40 minutes
**Difficulty:** Beginner-friendly
**Status:** Ready to configure! 🚀
