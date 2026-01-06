# 🚀 Google Play Store Deployment Plan

**Goal:** Fix all critical bugs and prepare TradieMate for professional Google Play Store deployment

**Timeline:** Execute immediately → Deploy within 24-48 hours

---

## 📊 CURRENT STATUS

### ✅ What's Working
- RevenueCat integration (Solo/Crew/Pro subscriptions)
- Offline mode with encryption
- Invoice/Quote creation and management
- Client management
- Xero integration
- UI/UX is production-ready

### ❌ What's Broken (CRITICAL)
1. **Email sending** - CORS bug + unverified domain
2. **SMS sending** - Secrets not deployed to edge functions
3. **Platform fees** - Still calculating 0.15% + requiring Stripe Connect
4. **Payment flow** - Connected to platform fees issue

### ⚠️ What Needs Verification
1. Share link functionality (code looks correct)
2. Payment UI update after Stripe payment (webhook processing)

---

## 🎯 PHASE 1: FIX CRITICAL FUNCTIONS (Priority: HIGH)

### Task 1.1: Fix Email Function CORS Bug
**File:** `supabase/functions/send-email/index.ts`

**Problem:** Line 71 uses `corsHeaders` before it's declared

**Fix:**
```typescript
// BEFORE (line 68-72):
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders }); // ❌ corsHeaders not defined yet!
  }

// AFTER:
serve(async (req) => {
  // SECURITY: Get secure CORS headers
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return createCorsResponse(req); // ✅ Use proper CORS response
  }
```

**Estimated time:** 2 minutes

---

### Task 1.2: Configure Resend to Use Default Domain
**File:** `supabase/functions/send-email/index.ts`

**Problem:** Sending from `noreply@tradiemate.com.au` but domain not verified

**Current Code (line 411-422):**
```typescript
let fromEmail: string;
if (customEmailDomain) {
  fromEmail = customEmailDomain;
} else {
  // Use TradieMate domain (must be verified in Resend dashboard)
  fromEmail = `${businessName} <noreply@tradiemate.com.au>`;
}
```

**Fix - Use Resend's Default Domain:**
```typescript
let fromEmail: string;
if (customEmailDomain) {
  fromEmail = customEmailDomain;
} else {
  // Use Resend's onboarding email (no verification needed)
  // Format: "Your Name <onboarding@resend.dev>"
  fromEmail = `${businessName} <onboarding@resend.dev>`;
}
```

**Why this works:**
- `onboarding@resend.dev` is pre-verified by Resend for all accounts
- Allows sending emails immediately without domain setup
- Can upgrade to custom domain later

**Estimated time:** 2 minutes

---

### Task 1.3: Deploy Twilio Secrets to Supabase
**Problem:** Twilio credentials in `.env` but not in Supabase Edge Functions

**Current Status:**
```env
TWILIO_ACCOUNT_SID="ACcea5b2de44478a73006bb424055d6f76"
TWILIO_AUTH_TOKEN="b8c7f1648a29014c870cd430bba6cec4"
TWILIO_PHONE_NUMBER="+15075967989"
```

**Solution:** Deploy secrets using Supabase CLI

```bash
# Set Twilio credentials as Supabase secrets
npx supabase secrets set TWILIO_ACCOUNT_SID="ACcea5b2de44478a73006bb424055d6f76" --project-ref rucuomtojzifrvplhwja
npx supabase secrets set TWILIO_AUTH_TOKEN="b8c7f1648a29014c870cd430bba6cec4" --project-ref rucuomtojzifrvplhwja
npx supabase secrets set TWILIO_PHONE_NUMBER="+15075967989" --project-ref rucuomtojzifrvplhwja

# Verify secrets were set
npx supabase secrets list --project-ref rucuomtojzifrvplhwja
```

**Verification:**
```bash
# Test SMS function after deploying
curl -X POST https://rucuomtojzifrvplhwja.supabase.co/functions/v1/send-invoice \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"invoice_id": "test-id", "send_sms": true, "send_email": false}'
```

**Estimated time:** 5 minutes

---

## 🎯 PHASE 2: REMOVE PLATFORM FEES (Priority: HIGH)

### Task 2.1: Remove Platform Fee Calculation
**File:** `supabase/functions/create-payment/index.ts`

**Changes:**

**1. Remove Stripe Connect account requirement (lines 86-107):**
```typescript
// BEFORE:
const stripeAccountId = profile?.stripe_account_id;

if (!stripeAccountId) {
  console.error("Tradie has not connected Stripe account");
  return new Response(
    JSON.stringify({
      error: "Payment setup incomplete. Please connect your Stripe account in Settings > Payments to accept invoice payments."
    }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// AFTER:
// ✅ No Stripe Connect required - payments go directly to platform account
console.log(`Creating payment session for invoice ${invoice_id}, business: ${businessName}`);
```

**2. Remove platform fee calculation (line 111-115):**
```typescript
// BEFORE:
console.log(`Creating Checkout session for account: ${stripeAccountId}, balance: $${balance}`);

// SECURITY: Calculate platform fee server-side (NEVER trust client input)
// 0.15% platform fee calculated from server-verified balance
const platformFeeAmount = Math.round(balance * 100 * 0.0015);

console.log(`Platform fee (0.15%): $${platformFeeAmount / 100}`);

// AFTER:
console.log(`Creating Checkout session for platform account, balance: $${balance}`);
// ✅ No platform fee - full amount goes to platform
```

**3. Remove application_fee_amount and stripeAccount (lines 121-150):**
```typescript
// BEFORE:
const session = await stripe.checkout.sessions.create({
  payment_method_types: ["card"],
  line_items: [...],
  mode: "payment",
  success_url: success_url || `${baseUrl}/i/${invoice_id}?payment=success`,
  cancel_url: cancel_url || `${baseUrl}/i/${invoice_id}?payment=cancelled`,
  customer_email: invoice.clients?.email || undefined,
  metadata: {
    invoice_id: invoice_id,
    invoice_number: invoice.invoice_number,
    business_name: businessName,
  },
  payment_intent_data: {
    application_fee_amount: platformFeeAmount, // ❌ REMOVE THIS
  },
}, {
  stripeAccount: stripeAccountId, // ❌ REMOVE THIS
});

// AFTER:
const session = await stripe.checkout.sessions.create({
  payment_method_types: ["card"],
  line_items: [
    {
      price_data: {
        currency: "aud",
        product_data: {
          name: `Invoice ${invoice.invoice_number}`,
          description: invoice.title || "Invoice payment",
        },
        unit_amount: Math.round(balance * 100), // Stripe uses cents
      },
      quantity: 1,
    },
  ],
  mode: "payment",
  success_url: success_url || `${baseUrl}/i/${invoice_id}?payment=success`,
  cancel_url: cancel_url || `${baseUrl}/i/${invoice_id}?payment=cancelled`,
  customer_email: invoice.clients?.email || undefined,
  metadata: {
    invoice_id: invoice_id,
    invoice_number: invoice.invoice_number,
    business_name: businessName,
  },
  // ✅ No payment_intent_data, no stripeAccount - direct payment to platform
});
```

**Result:**
- Payments go directly to YOUR Stripe account
- Tradies don't need Stripe Connect accounts
- You receive 100% of invoice payments (minus Stripe's 2.9% + $0.30)
- You'll manually pay tradies later via bank transfer

**Estimated time:** 10 minutes

---

### Task 2.2: Update send-invoice Function
**File:** `supabase/functions/send-invoice/index.ts`

**Problem:** Line 62-72 selects `stripe_account_id` and `stripe_charges_enabled` which are no longer needed

**Fix:**
```typescript
// BEFORE (lines 62-72):
const { data: invoice, error: invoiceError } = await supabase
  .from("invoices")
  .select(`
    *,
    clients (*),
    profiles:user_id (
      business_name,
      phone,
      email,
      stripe_account_id,
      stripe_charges_enabled
    )
  `)

// AFTER:
const { data: invoice, error: invoiceError } = await supabase
  .from("invoices")
  .select(`
    *,
    clients (*),
    profiles:user_id (
      business_name,
      phone,
      email
    )
  `)
```

**Estimated time:** 2 minutes

---

## 🎯 PHASE 3: VERIFY & TEST (Priority: HIGH)

### Task 3.1: Deploy All Fixed Edge Functions

```bash
# Set environment variable for access token
$env:SUPABASE_ACCESS_TOKEN="sbp_08470f9134209d5aa87366467ba53eeebbde19c8"

# Deploy all functions
npx supabase functions deploy send-email --project-ref rucuomtojzifrvplhwja --no-verify-jwt
npx supabase functions deploy send-invoice --project-ref rucuomtojzifrvplhwja --no-verify-jwt
npx supabase functions deploy create-payment --project-ref rucuomtojzifrvplhwja --no-verify-jwt

# Verify deployment
npx supabase functions list --project-ref rucuomtojzifrvplhwja
```

**Estimated time:** 5 minutes

---

### Task 3.2: End-to-End Testing

**Test Case 1: Email Sending** ✉️
1. Create a test invoice in the app
2. Add client with email address
3. Click "Send Email" button
4. Verify email received (check spam folder)
5. Click "View Invoice" button in email
6. Verify invoice displays correctly

**Expected Result:** ✅ Email sent from `BusinessName <onboarding@resend.dev>`

---

**Test Case 2: SMS Sending** 📱
1. Create a test invoice
2. Add client with phone number
3. Click "Send SMS" button
4. Verify SMS received on phone

**Expected Result:** ✅ SMS with payment link received

---

**Test Case 3: Share Link** 🔗
1. Open invoice detail page
2. Click "Share" button
3. Verify toast shows "Link copied!"
4. Paste link in browser
5. Verify public invoice page loads

**Expected Result:** ✅ Link like `https://app.tradiemate.com.au/i/abc123` works

---

**Test Case 4: Payment Flow** 💳
1. Open public invoice page (from share link or email)
2. Click "Pay Now" button
3. Enter test card: `4242 4242 4242 4242`, any future date, any CVC
4. Complete payment on Stripe
5. Redirected back to invoice page
6. Wait 5-10 seconds for webhook
7. Verify status changes to "Paid"

**Expected Result:** ✅ Payment processed, invoice marked as paid

---

**Test Case 5: Webhook Processing** 🔄
1. After payment completes, check Supabase logs
2. Navigate to: Supabase Dashboard → Edge Functions → stripe-webhook → Logs
3. Verify webhook received: `checkout.session.completed`
4. Verify invoice updated in database

**Expected Result:** ✅ Webhook processed successfully

---

## 🎯 PHASE 4: ANDROID BUILD PREPARATION (Priority: MEDIUM)

### Task 4.1: Update Capacitor Configuration
**File:** `capacitor.config.json`

**Current config:**
```json
{
  "appId": "com.tradiemate.app",
  "appName": "TradieMate",
  "webDir": "dist",
  "bundledWebRuntime": false,
  "plugins": {
    "SplashScreen": {
      "launchShowDuration": 0
    }
  }
}
```

**Verify:**
- ✅ `appId` matches Google Play Console package name
- ✅ `appName` is correct
- ✅ `webDir` points to build output

---

### Task 4.2: Build Android APK/AAB

```bash
# Install dependencies
npm install

# Build web app
npm run build

# Sync with Capacitor
npx cap sync android

# Open Android Studio (will open automatically)
npx cap open android

# In Android Studio:
# 1. Build → Generate Signed Bundle / APK
# 2. Choose "Android App Bundle" (AAB) for Play Store
# 3. Create/select keystore
# 4. Build release bundle
```

**Output:** `android/app/build/outputs/bundle/release/app-release.aab`

**Estimated time:** 30 minutes

---

### Task 4.3: Google Play Console Setup

**Prerequisites:**
- Google Play Developer account ($25 one-time fee)
- Privacy Policy URL
- App description, screenshots, icon

**Steps:**
1. Create new app in Play Console
2. Upload AAB file to Internal Testing track first
3. Fill out store listing:
   - App name: TradieMate
   - Short description
   - Full description
   - Screenshots (5 minimum)
   - Feature graphic
   - Icon
4. Fill out Content Rating questionnaire
5. Add Privacy Policy URL
6. Submit for review

**Estimated time:** 2-3 hours (mostly documentation)

---

## 🎯 PHASE 5: POST-DEPLOYMENT (Priority: LOW)

### Task 5.1: Monitor Production
- Check Supabase Edge Function logs daily
- Monitor Resend email delivery rates
- Check Stripe payment success rates
- Monitor app crash reports in Play Console

---

### Task 5.2: Future Enhancements (Post-Launch)
1. **Custom Email Domain**
   - Verify `tradiemate.com.au` or `mail.tradiemate.com.au` in Resend
   - Update `send-email` function to use custom domain

2. **Stripe Connect (Optional)**
   - If you want to re-enable direct tradie payments
   - Requires business registration for application fees

3. **Push Notifications**
   - Firebase Cloud Messaging integration
   - Notify tradies when payment received

4. **iOS App Store**
   - Build iOS version with Xcode
   - Submit to App Store (requires $99/year Apple Developer account)

---

## 📊 DEPLOYMENT CHECKLIST

### Pre-Deployment
- [ ] Fix email CORS bug
- [ ] Change email from domain to `onboarding@resend.dev`
- [ ] Deploy Twilio secrets to Supabase
- [ ] Remove platform fees from create-payment function
- [ ] Update send-invoice function (remove Stripe Connect fields)
- [ ] Deploy all edge functions
- [ ] Test email sending end-to-end
- [ ] Test SMS sending end-to-end
- [ ] Test share link functionality
- [ ] Test payment flow with test card
- [ ] Verify webhook processing in logs

### Build & Deploy
- [ ] Update app version in `package.json`
- [ ] Run production build (`npm run build`)
- [ ] Sync Capacitor (`npx cap sync android`)
- [ ] Generate signed AAB in Android Studio
- [ ] Upload to Play Console Internal Testing
- [ ] Test with internal testers (2-3 people)
- [ ] Fix any issues found
- [ ] Submit to Production track
- [ ] Wait for Google review (usually 1-3 days)

### Post-Deployment
- [ ] Monitor Edge Function logs for errors
- [ ] Check Resend email delivery dashboard
- [ ] Monitor Stripe payments dashboard
- [ ] Respond to user reviews on Play Store
- [ ] Track user feedback and feature requests

---

## 🚨 CRITICAL NOTES

### Revenue Model Without Platform Fees
**Current Setup:**
- **RevenueCat Subscriptions:** You earn $29-$79/month per tradie (Solo/Crew/Pro)
- **Invoice Payments:** Customers pay YOU → You manually pay tradies later

**Monthly Revenue Example:**
```
50 tradies × $29 Solo = $1,450/month
20 tradies × $49 Crew = $980/month
5 tradies × $79 Pro = $395/month
──────────────────────────────
TOTAL: $2,825/month from subscriptions
```

**Invoice payments:**
- Customers pay platform Stripe account
- Platform holds funds temporarily
- Platform transfers to tradie's bank account manually/automatically
- This is legal and common for early-stage marketplaces
- Example: You could add 2-5% service fee on top of invoice amount

---

### When to Register Business
**Register when:**
- Monthly revenue > $5,000
- Want to re-enable Stripe Connect with application fees
- Want business bank account
- Want to hire employees
- Want to raise funding

**Don't register yet if:**
- Still validating product-market fit
- Revenue < $2,000/month
- Operating solo
- Want to minimize costs

---

## 📈 SUCCESS METRICS

### Week 1 (Post-Launch)
- 10+ app installs
- 5+ active users
- 2+ subscription signups
- 1+ invoice payment processed
- 0 critical bugs

### Month 1
- 50+ app installs
- 20+ active users
- 10+ subscription signups ($290-790 MRR)
- 20+ invoices sent
- 10+ invoice payments ($5,000+ GMV)
- 4.0+ star rating on Play Store

### Month 3
- 200+ app installs
- 75+ active users
- 30+ subscription signups ($870-2,370 MRR)
- 100+ invoices sent
- 50+ invoice payments ($25,000+ GMV)
- Ready to register business & scale

---

## 🛠️ TOOLS & RESOURCES

### Development
- **Supabase Dashboard:** https://app.supabase.com
- **Stripe Dashboard:** https://dashboard.stripe.com
- **Resend Dashboard:** https://resend.com/emails
- **Twilio Console:** https://console.twilio.com
- **RevenueCat Dashboard:** https://app.revenuecat.com

### Testing
- **Stripe Test Cards:** https://stripe.com/docs/testing
- **Supabase Logs:** https://app.supabase.com/project/rucuomtojzifrvplhwja/functions
- **Android Debug:** `adb logcat | findstr TradieMate`

### Deployment
- **Google Play Console:** https://play.google.com/console
- **Android Studio:** https://developer.android.com/studio
- **Capacitor Docs:** https://capacitorjs.com/docs

---

## 🎯 NEXT STEPS

1. **Execute Phase 1-2 NOW** (30 minutes total)
2. **Test everything** (1 hour)
3. **Build Android AAB** (30 minutes)
4. **Upload to Play Console** (2 hours with documentation)
5. **Launch! 🚀**

---

**Total estimated time:** 4-5 hours of focused work

**Expected launch date:** Tomorrow if starting today!

Good luck! 🚀
