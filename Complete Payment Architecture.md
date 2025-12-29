

## 🤔 DO WE NEED BOTH? YES - Here's Why:

```yaml
RevenueCat: For TradieMate SUBSCRIPTIONS (tradies paying us)
Stripe: For CLIENT PAYMENTS (homeowners paying tradies)

They serve DIFFERENT purposes:
├─ RevenueCat = App Store/Play Store subscription management
└─ Stripe = B2B payment processing (tradie's clients pay invoices)

You CANNOT use RevenueCat for client invoice payments.
You NEED both for full functionality.
```

---

## 🎯 TWO-PAYMENT-SYSTEM ARCHITECTURE

### **Payment System 1: RevenueCat (Tradie → TradieMate)**

```yaml
Purpose: Manage TradieMate subscription plans
Flow: Tradie subscribes to Solo/Crew/Pro tier
Payment Method: Apple Pay, Google Pay, Credit Card (via App Stores)
Commission: 15-30% to Apple/Google
Use Case: Monthly/Annual TradieMate subscription

Example:
Dave (Electrician) → Pays $29/month to TradieMate → Apple takes $8.70 (30%)
```

### **Payment System 2: Stripe (Client → Tradie)**

```yaml
Purpose: Process invoice payments from tradie's clients
Flow: Client receives invoice → Pays tradie → Tradie gets money
Payment Method: Card, Apple Pay, Google Pay, Bank Transfer
Commission: 1.75% + $0.30 to Stripe
Use Case: Job invoices, quotes accepted with deposit

Example:
John (Homeowner) → Pays $990 invoice to Dave → Dave gets $972.10 (Stripe takes $17.90)
```

---

## 🏗️ COMPLETE PAYMENT ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────┐
│                    TRADIEMATE PAYMENT SYSTEM                │
└─────────────────────────────────────────────────────────────┘

SYSTEM 1: SUBSCRIPTIONS (TradieMate Revenue)
┌─────────────────────────────────────────────────────────────┐
│  TRADIE (Dave)                                              │
│  └─ Subscribes to TradieMate Solo ($29/month)              │
│                                                              │
│  ┌──────────────┐                                           │
│  │ RevenueCat   │ ← Manages subscription state              │
│  │ SDK          │   (active, expired, trial, etc)           │
│  └──────┬───────┘                                           │
│         │                                                    │
│         ↓                                                    │
│  ┌─────────────────────┐                                    │
│  │ App Store / Play    │ ← Processes payment                │
│  │ In-App Purchase     │   Takes 15-30% commission          │
│  └─────────┬───────────┘                                    │
│            │                                                 │
│            ↓                                                 │
│  ┌─────────────────────┐                                    │
│  │ RevenueCat Webhook  │ → Notifies our backend             │
│  └─────────┬───────────┘                                    │
│            │                                                 │
│            ↓                                                 │
│  ┌─────────────────────┐                                    │
│  │ Supabase Database   │ → Updates subscription status      │
│  │ (businesses table)  │   Unlocks features                 │
│  └─────────────────────┘                                    │
└─────────────────────────────────────────────────────────────┘

SYSTEM 2: INVOICES (Tradie Revenue from Clients)
┌─────────────────────────────────────────────────────────────┐
│  CLIENT (John - Homeowner)                                  │
│  └─ Receives invoice for $990                               │
│                                                              │
│  ┌──────────────┐                                           │
│  │ SMS/Email    │ ← Invoice link sent                       │
│  │ with Stripe  │   https://invoice.trademate.app/xyz       │
│  │ Payment Link │                                           │
│  └──────┬───────┘                                           │
│         │                                                    │
│         ↓                                                    │
│  ┌─────────────────────┐                                    │
│  │ Stripe Checkout     │ ← Client enters card details       │
│  │ (Hosted Payment)    │   Apple Pay / Google Pay           │
│  └─────────┬───────────┘                                    │
│            │                                                 │
│            ↓                                                 │
│  ┌─────────────────────┐                                    │
│  │ Stripe Connect      │ → Processes payment                │
│  │ (Tradie's Account)  │   Takes 1.75% + $0.30              │
│  └─────────┬───────────┘                                    │
│            │                                                 │
│            ↓                                                 │
│  ┌─────────────────────┐                                    │
│  │ Stripe Webhook      │ → Notifies payment success         │
│  └─────────┬───────────┘                                    │
│            │                                                 │
│            ↓                                                 │
│  ┌─────────────────────┐                                    │
│  │ Supabase Database   │ → Marks invoice as PAID            │
│  │ (invoices table)    │   Sends notification to tradie     │
│  └─────────┬───────────┘                                    │
│            │                                                 │
│            ↓                                                 │
│  ┌─────────────────────┐                                    │
│  │ TRADIE (Dave)       │ ← Gets $972.10 in bank account     │
│  │ Bank Account        │   (2-7 business days)              │
│  └─────────────────────┘                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 💳 SYSTEM 1: REVENUECAT (Subscriptions)

### **What RevenueCat Does:**

```yaml
Purpose: Subscription management across iOS + Android
Features:
  ✅ Cross-platform subscription state (iOS + Android sync)
  ✅ Handles App Store/Play Store receipts
  ✅ Subscription lifecycle (trial, active, expired, refunded)
  ✅ Webhooks for real-time updates
  ✅ Analytics dashboard
  ✅ Paywall experiments (A/B testing)
  ✅ Graceful degradation (offline support)

Why use it:
  ✅ Don't reinvent the wheel (App Store receipts are complex)
  ✅ Single API for both platforms
  ✅ Handles edge cases (subscription changes, refunds, etc)
  ✅ FREE up to $2.5M revenue/year

Cost:
  - FREE: Up to $2.5M annual revenue
  - Growth: 1% of revenue after $2.5M
```

### **Implementation:**

```typescript
// 1. Install RevenueCat
npm install react-native-purchases

// 2. Initialize (App.tsx)
import Purchases from 'react-native-purchases';

useEffect(() => {
  Purchases.configure({
    apiKey: Platform.OS === 'ios' 
      ? 'appl_XXX' // iOS API key
      : 'goog_XXX', // Android API key
  });
}, []);

// 3. Fetch available packages
const fetchPackages = async () => {
  try {
    const offerings = await Purchases.getOfferings();
    
    if (offerings.current !== null) {
      const packages = offerings.current.availablePackages;
      // packages = [
      //   { identifier: '$rc_monthly', product: { price: '$29.00', ... } },
      //   { identifier: '$rc_annual', product: { price: '$288.00', ... } }
      // ]
      
      setPackages(packages);
    }
  } catch (error) {
    console.error('Error fetching packages:', error);
  }
};

// 4. Purchase subscription
const purchaseSoloPlan = async () => {
  try {
    const purchaseResult = await Purchases.purchasePackage(
      selectedPackage
    );
    
    // Check if user is now subscribed
    const customerInfo = purchaseResult.customerInfo;
    
    if (customerInfo.entitlements.active['solo_plan']) {
      // User has active Solo subscription
      // Unlock features in app
      setUserTier('solo');
      navigation.navigate('Dashboard');
    }
  } catch (error) {
    if (error.userCancelled) {
      console.log('User cancelled purchase');
    } else {
      console.error('Purchase error:', error);
    }
  }
};

// 5. Check subscription status (on app launch)
const checkSubscriptionStatus = async () => {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    
    // Check entitlements
    if (customerInfo.entitlements.active['solo_plan']) {
      setUserTier('solo');
    } else if (customerInfo.entitlements.active['crew_plan']) {
      setUserTier('crew');
    } else if (customerInfo.entitlements.active['pro_plan']) {
      setUserTier('pro');
    } else {
      setUserTier('free');
    }
  } catch (error) {
    console.error('Error checking subscription:', error);
  }
};

// 6. Restore purchases (for users who reinstall app)
const restorePurchases = async () => {
  try {
    const customerInfo = await Purchases.restorePurchases();
    
    // Check entitlements after restore
    if (customerInfo.entitlements.active['solo_plan']) {
      Alert.alert('Success', 'Subscription restored!');
      setUserTier('solo');
    } else {
      Alert.alert('No active subscription found');
    }
  } catch (error) {
    console.error('Error restoring purchases:', error);
  }
};
```

### **RevenueCat Webhook (Backend Sync):**

```typescript
// Supabase Edge Function: handle-revenuecat-webhook
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  );

  const webhookData = await req.json();
  
  /*
  RevenueCat sends events like:
  - INITIAL_PURCHASE (first subscription)
  - RENEWAL (monthly/annual renewal)
  - CANCELLATION (user cancelled)
  - EXPIRATION (subscription expired)
  - BILLING_ISSUE (payment failed)
  */
  
  const { event_type, app_user_id, product_id } = webhookData;
  
  // Map RevenueCat product_id to our tiers
  const tierMap = {
    'solo_monthly': 'solo',
    'solo_annual': 'solo',
    'crew_monthly': 'crew',
    'crew_annual': 'crew',
    'pro_monthly': 'pro',
    'pro_annual': 'pro'
  };
  
  if (event_type === 'INITIAL_PURCHASE' || event_type === 'RENEWAL') {
    // Update subscription in database
    await supabase
      .from('businesses')
      .update({
        subscription_tier: tierMap[product_id],
        subscription_status: 'active',
        subscription_expires_at: webhookData.expiration_at_ms
      })
      .eq('user_id', app_user_id);
      
    console.log(`✅ Subscription activated for ${app_user_id}`);
  }
  
  if (event_type === 'CANCELLATION') {
    await supabase
      .from('businesses')
      .update({
        subscription_status: 'cancelled',
        // Keep tier active until expiration date
      })
      .eq('user_id', app_user_id);
      
    console.log(`⚠️ Subscription cancelled for ${app_user_id}`);
  }
  
  if (event_type === 'EXPIRATION') {
    await supabase
      .from('businesses')
      .update({
        subscription_tier: 'free',
        subscription_status: 'expired'
      })
      .eq('user_id', app_user_id);
      
    console.log(`❌ Subscription expired for ${app_user_id}`);
  }

  return new Response('OK', { status: 200 });
});
```

---

## 💳 SYSTEM 2: STRIPE (Client Payments)

### **What Stripe Does:**

```yaml
Purpose: Process invoice payments from tradie's clients
Products Used:
  ✅ Stripe Connect (marketplace/platform payments)
  ✅ Stripe Payment Links (embedded in invoices)
  ✅ Stripe Checkout (hosted payment page)

Why use it:
  ✅ Tradies get paid directly to THEIR bank account
  ✅ We never touch the money (no liability)
  ✅ PCI compliance handled by Stripe
  ✅ Support cards, Apple Pay, Google Pay, bank transfers
  ✅ Automatic fraud detection

Cost:
  - 1.75% + $0.30 per transaction (Australia)
  - Platform fee: 0.25% (optional - we can charge this)
```

### **Stripe Connect Setup:**

```typescript
// 1. Create Stripe Connect account for tradie
// Supabase Edge Function: create-stripe-account

import Stripe from 'stripe';
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

const createStripeAccount = async (tradie) => {
  // Create Connect account
  const account = await stripe.accounts.create({
    type: 'standard', // Tradie manages their own Stripe dashboard
    country: 'AU',
    email: tradie.email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true }
    },
    business_type: 'individual',
    business_profile: {
      name: tradie.business_name,
      product_description: tradie.trade_type,
      mcc: '1799' // Special Trade Contractors
    }
  });
  
  // Generate onboarding link
  const accountLink = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: 'https://trademate.app/stripe/refresh',
    return_url: 'https://trademate.app/stripe/return',
    type: 'account_onboarding'
  });
  
  // Save to database
  await supabase
    .from('businesses')
    .update({ stripe_account_id: account.id })
    .eq('id', tradie.business_id);
    
  return accountLink.url; // Send tradie to complete onboarding
};

// 2. Create Payment Link for invoice
const createInvoicePaymentLink = async (invoice, tradie) => {
  const paymentLink = await stripe.paymentLinks.create({
    line_items: [
      {
        price_data: {
          currency: 'aud',
          product_data: {
            name: `Invoice #${invoice.invoice_number}`,
            description: `Work completed by ${tradie.business_name}`
          },
          unit_amount: Math.round(invoice.total * 100) // Convert to cents
        },
        quantity: 1
      }
    ],
    after_completion: {
      type: 'redirect',
      redirect: {
        url: `https://trademate.app/invoice/${invoice.id}/paid`
      }
    },
    metadata: {
      invoice_id: invoice.id,
      tradie_id: tradie.id,
      client_id: invoice.client_id
    }
  }, {
    stripeAccount: tradie.stripe_account_id // Payment goes to tradie
  });
  
  return paymentLink.url;
  // Example: https://buy.stripe.com/test_abc123
};

// 3. Send invoice with payment link
const sendInvoice = async (invoice, client) => {
  const paymentLink = await createInvoicePaymentLink(invoice, tradie);
  
  // Update invoice with payment link
  await supabase
    .from('invoices')
    .update({ 
      stripe_payment_link: paymentLink,
      sent_at: new Date().toISOString()
    })
    .eq('id', invoice.id);
  
  // Send via SMS (Twilio)
  await twilio.messages.create({
    to: client.phone,
    from: TWILIO_PHONE_NUMBER,
    body: `Hi ${client.name},

Invoice from ${tradie.business_name}
Amount: $${invoice.total} AUD

Pay now: ${paymentLink}

Questions? Call ${tradie.phone}`
  });
  
  console.log(`✅ Invoice sent to ${client.name}`);
};

// 4. Handle Stripe webhook (payment success)
// Supabase Edge Function: stripe-webhook
const handleStripeWebhook = async (req) => {
  const sig = req.headers.get('stripe-signature');
  const body = await req.text();
  
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return new Response('Webhook Error', { status: 400 });
  }
  
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const invoiceId = session.metadata.invoice_id;
    
    // Mark invoice as paid
    await supabase
      .from('invoices')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        stripe_payment_intent_id: session.payment_intent
      })
      .eq('id', invoiceId);
    
    // Get tradie details for notification
    const { data: invoice } = await supabase
      .from('invoices')
      .select('*, businesses(*)')
      .eq('id', invoiceId)
      .single();
    
    // Send push notification to tradie
    await sendPushNotification(invoice.businesses.user_id, {
      title: '💰 Payment Received!',
      body: `$${invoice.total} from ${invoice.client.name}`,
      data: { invoice_id: invoiceId }
    });
    
    console.log(`✅ Invoice ${invoiceId} marked as paid`);
  }
  
  return new Response('OK', { status: 200 });
};
```

---

## 🔄 COMPLETE USER FLOWS

### **Flow 1: Tradie Subscribes to TradieMate**

```
1. Dave opens TradieMate app
   ├─ Currently on Free tier (5 quotes/month limit)
   └─ Hit limit after 5 quotes

2. App shows upgrade prompt
   ┌─────────────────────────────┐
   │ You've reached 5/5 quotes   │
   │ Upgrade to create unlimited │
   │                             │
   │ Solo Plan: $29/month        │
   │ ✅ Unlimited quotes          │
   │ ✅ Xero integration          │
   │ ✅ Remove branding           │
   │                             │
   │ [Try 7 Days Free]           │
   └─────────────────────────────┘

3. Dave taps "Try 7 Days Free"
   ├─ RevenueCat shows Apple Pay sheet (iOS)
   └─ Dave authenticates with Face ID

4. Payment processed
   ├─ Apple charges Dave's Apple Pay
   ├─ Apple takes 30% ($8.70)
   └─ RevenueCat webhook notifies our backend

5. Backend updates database
   ├─ Supabase: subscription_tier = 'solo'
   ├─ Supabase: subscription_status = 'active'
   └─ Features unlocked in app

6. Dave can now create unlimited quotes ✅

7. 7 days later (if Dave doesn't cancel)
   ├─ Apple charges $29 automatically
   ├─ RevenueCat sends RENEWAL webhook
   └─ Subscription continues

Money flow:
Dave pays $29 → Apple keeps $8.70 → We get $20.30
```

---

### **Flow 2: Client Pays Invoice**

```
1. Dave completes job for John (homeowner)
   ├─ Dave creates invoice in TradieMate
   └─ Invoice total: $990 AUD

2. Dave taps "Send Invoice"
   ├─ TradieMate calls Stripe API
   ├─ Creates Payment Link
   └─ Sends SMS to John

3. John receives SMS
   📱 "Hi John,
   
   Invoice from Dave's Electrical
   Amount: $990.00 AUD
   
   Pay now: https://buy.stripe.com/abc123
   
   Questions? Call 0412 XXX XXX"

4. John taps link
   ├─ Opens Stripe Checkout (mobile-optimized)
   ├─ Shows invoice details
   └─ Payment options: Card, Apple Pay, Google Pay

5. John pays with Apple Pay
   ├─ John authenticates with Face ID
   ├─ Payment processed instantly
   └─ Confirmation screen shown

6. Stripe webhook fires
   ├─ Notifies TradieMate backend
   ├─ Invoice marked as PAID in database
   └─ Push notification sent to Dave

7. Dave gets notification
   📱 "💰 Payment Received!
   $990.00 from John Smith"

8. Money settlement
   ├─ Day 0: Payment captured ($990)
   ├─ Stripe fee: $17.90 (1.75% + $0.30)
   ├─ Net to Dave: $972.10
   └─ Day 2-7: Deposited to Dave's bank account

Money flow:
John pays $990 → Stripe keeps $17.90 → Dave gets $972.10
```

---

### **Flow 3: Tradie Upgrades Tier**

```
1. Sarah (Crew owner) currently on Solo plan
   ├─ Paying $29/month
   └─ Wants to add 2 team members

2. Sarah taps "Upgrade to Crew"
   ┌─────────────────────────────┐
   │ Upgrade to Crew Plan        │
   │                             │
   │ Current: Solo ($29/month)   │
   │ New: Crew ($49/month)       │
   │                             │
   │ New features:               │
   │ ✅ 3 users                   │
   │ ✅ Team calendar             │
   │ ✅ Timesheets                │
   │                             │
   │ [Upgrade Now]               │
   └─────────────────────────────┘

3. Sarah taps "Upgrade Now"
   ├─ RevenueCat handles upgrade
   ├─ Prorates current subscription
   └─ Apple Pay charges difference immediately

4. Proration calculation
   ├─ Solo: $29/month = $0.97/day
   ├─ Used 10 days = $9.70 already paid
   ├─ Remaining 20 days = $19.30 credit
   ├─ Crew: $49/month = $1.63/day
   ├─ Remaining 20 days = $32.60 needed
   ├─ Charge today: $32.60 - $19.30 = $13.30
   └─ Next billing: Full $49 in 20 days

5. Backend updated
   ├─ subscription_tier = 'crew'
   ├─ Features unlocked (team management)
   └─ Can now invite 2 team members

Money flow:
Sarah pays $13.30 today → $49/month going forward
```

---

## 💰 COST COMPARISON

### **Our Costs:**

```yaml
RevenueCat Commission:
├─ FREE up to $2.5M revenue/year
├─ At $2.5M revenue = $0 RevenueCat fee
├─ At $3M revenue = $5k RevenueCat fee (1% of $500k over limit)
└─ Break-even: Never (we'll make millions before paying)

App Store/Play Store Commission:
├─ iOS: 30% first year, 15% after (subscriber > 1 year)
├─ Android: 15% all years (subscriptions)
├─ Example: $29 Solo plan
│   ├─ Year 1 iOS: Apple takes $8.70 (30%), we get $20.30
│   ├─ Year 2 iOS: Apple takes $4.35 (15%), we get $24.65
│   └─ Android: Google takes $4.35 (15%), we get $24.65

Stripe Commission (Client Payments):
├─ 1.75% + $0.30 per transaction
├─ Example: $990 invoice
│   ├─ Stripe takes: $17.90
│   └─ Tradie gets: $972.10
├─ We DON'T pay this (tradie's client pays)
└─ Optional: We can add 0.25% platform fee = $2.48 per invoice
```

### **Revenue Math (1,000 Users):**

```yaml
Scenario: 1,000 paid users
├─ 600 Solo ($29) = $17,400/month
├─ 300 Crew ($49) = $14,700/month
└─ 100 Pro ($79) = $7,900/month
Total Gross Revenue: $40,000/month

Costs:
├─ App Store fees (avg 20%): -$8,000
├─ Supabase: -$100
├─ AI/SMS/Maps: -$400
└─ Total Costs: -$8,500

Net Revenue: $31,500/month = $378k/year
Margin: 78.75%

Client Payment Volume (not our revenue, but we facilitate):
├─ 1,000 tradies × 20 invoices/month = 20,000 invoices
├─ Average invoice: $750
├─ Total processed: $15M/month
├─ Stripe fees (paid by tradie): $262k/month
└─ If we charge 0.25% platform fee: $37.5k/month extra revenue
```

---

## 🎯 PRICING STRATEGY WITH BOTH SYSTEMS

### **TradieMate Subscription Plans (via RevenueCat):**

```yaml
FREE Tier:
├─ 5 quotes/month
├─ 5 invoices/month
├─ Basic features
└─ Can accept payments (Stripe) ✅

Solo Tier: $29/month
├─ Unlimited quotes/invoices
├─ Xero/MYOB sync
├─ 50 AI voice quotes/month
├─ Can accept payments (Stripe) ✅
└─ Remove TradieMate branding

Crew Tier: $49/month
├─ Everything in Solo
├─ 3 team members
├─ Team calendar
├─ 200 AI voice quotes/month
├─ Can accept payments (Stripe) ✅

Pro Tier: $79/month
├─ Everything in Crew
├─ 10 team members
├─ Unlimited AI voice
├─ White-label option
├─ Can accept payments (Stripe) ✅
├─ Priority support
```

### **Client Payment Fees (via Stripe):**

```yaml
Standard: 1.75% + $0.30 (Stripe only, we take $0)
├─ $500 invoice = $9.05 fee → Tradie gets $490.95
├─ $1,000 invoice = $17.80 fee → Tradie gets $982.20
└─ $2,000 invoice = $35.30 fee → Tradie gets $1,964.70

Optional Platform Fee (if we want extra revenue):
├─ Add 0.25% platform fee
├─ $1,000 invoice = $17.80 (Stripe) + $2.50 (us) = $20.30 total
├─ Tradie gets $979.70, we get $2.50
└─ On $15M/month processed = $37.5k extra revenue

Decision: 
Start with $0 platform fee (competitive advantage)
Add 0.25% later if we need more revenue
```

---

## 🚨 CRITICAL IMPLEMENTATION NOTES

### **App Store Rules for Subscriptions:**

```yaml
MUST use In-App Purchase (RevenueCat) for:
✅ TradieMate subscription plans
✅ Premium features unlock
✅ App functionality access

CAN use Stripe for:
✅ Physical goods/services (tradie's work)
✅ B2B transactions (client paying invoice)
✅ One-time purchases outside app

CANNOT use Stripe for:
❌ App subscription plans (Apple/Google reject)
❌ Premium feature unlock (violation)
❌ Digital content in-app (violation)

Key Rule: If it unlocks app features → RevenueCat
If it's external payment → Stripe
```

### **Two Onboarding Flows:**

```typescript
// 1. Tradie onboards to TradieMate (RevenueCat)
const onboardTradie = async () => {
  // Create user in Supabase
  const { data: user } = await supabase.auth.signUp({
    phone: tradiePhone
  });
  
  // Create business profile
  await supabase.from('businesses').insert({
    user_id: user.id,
    business_name: 'Dave\'s Electrical',
    subscription_tier: 'free', // Start on free
    subscription_status: 'active'
  });
  
  // RevenueCat user ID
  await Purchases.logIn(user.id);
  
  // Show paywall after 5 quotes
  navigation.navigate('Dashboard');
};

// 2. Tradie connects Stripe (for client payments)
const connectStripe = async () => {
  // Call Edge Function to create Stripe Connect account
  const { data } = await supabase.functions.invoke('create-stripe-account', {
    body: { business_id: currentBusiness.id }
  });
  
  // Open Stripe onboarding in browser
  Linking.openURL(data.onboarding_url);
  
  // After onboarding, Stripe redirects back to app
  // Stripe account linked to business
};

// These are SEPARATE flows
// Tradie can use TradieMate without Stripe (but can't accept payments)
// Tradie MUST use RevenueCat for TradieMate subscription
```

---

## 📊 STAKEHOLDER PAYMENT FLOWS

### **Stakeholder 1: Dave (Solo Tradie)**

```yaml
Dave's Costs:
├─ TradieMate subscription: $29/month (via RevenueCat/Apple)
└─ Stripe fees on client payments: 1.75% + $0.30 per invoice

Dave's Revenue:
├─ Client invoices: $8,000/month (average solo tradie)
├─ Stripe fees: ~$150/month
├─ Net from clients: $7,850/month
├─ TradieMate cost: -$29/month
└─ Net after all fees: $7,821/month

Dave's ROI:
├─ Saves 10 hours/week admin (worth $150/week = $650/month)
├─ Wins 10% more jobs (professional quotes) = +$800/month
├─ Total value: $1,450/month
├─ Cost: $29/month
└─ ROI: 4,900% 🚀
```

### **Stakeholder 2: Sarah (Crew Owner)**

```yaml
Sarah's Costs:
├─ TradieMate Crew: $49/month (via RevenueCat)
└─ Stripe fees: 1.75% + $0.30 per invoice

Sarah's Revenue:
├─ Client invoices: $70,000/month (3-person crew)
├─ Stripe fees: ~$1,250/month
├─ Net from clients: $68,750/month
├─ TradieMate cost: -$49/month
└─ Net after all fees: $68,701/month

Sarah's ROI:
├─ Saves 15 hours/week admin = $975/month
├─ Team coordination = 10% more jobs = +$7,000/month
├─ Total value: $7,975/month
├─ Cost: $49/month
└─ ROI: 16,180% 🚀
```

### **Stakeholder 3: John (Client/Homeowner)**

```yaml
John's Experience:
├─ Receives invoice via SMS
├─ Taps Stripe link
├─ Pays with Apple Pay (10 seconds)
├─ Stripe fee: Built into invoice total (transparent)
└─ Receipt emailed automatically

John's Perspective:
✅ Fast payment (vs bank transfer manual entry)
✅ Secure (Stripe = trusted brand)
✅ Options (card, Apple Pay, Google Pay)
✅ Professional experience (reflects well on tradie)
```

### **Stakeholder 4: TradieMate (Us)**

```yaml
Our Revenue Streams:

Stream 1: Subscriptions (RevenueCat)
├─ 1,000 users × $29 avg = $29,000 gross/month
├─ App Store fees (20% avg): -$5,800
└─ Net: $23,200/month = $278k/year

Stream 2: (Optional) Platform Fee on Payments (Stripe)
├─ $15M invoices processed/month
├─ 0.25% platform fee = $37,500/month
└─ Net: $37,500/month = $450k/year

Total Annual Revenue (at 1,000 users):
├─ Subscriptions: $278k
├─ Platform fees: $450k (optional)
└─ Total: $278k - $728k/year

Costs:
├─ Infrastructure: $9k/year
├─ RevenueCat: $0 (under $2.5M)
└─ Net profit margin: 85-90%
```

---

## 🎯 FINAL TECH STACK DECISION

```yaml
✅ YES - Use RevenueCat:
   Purpose: TradieMate subscription management
   Reason: Required by Apple/Google for in-app subscriptions
   Cost: FREE up to $2.5M revenue
   
✅ YES - Use Stripe:
   Purpose: Client invoice payments (tradie's revenue)
   Reason: Best payment processor for Australia, tradie gets paid directly
   Cost: 1.75% + $0.30 per transaction (tradie pays, not us)

Both are REQUIRED:
├─ RevenueCat = How tradies pay US
└─ Stripe = How clients pay TRADIES

Cannot replace one with the other.
```

---

**Bottom line:** RevenueCat handles subscriptions (Apple/Google requirement). Stripe handles invoice payments (best for B2B). You need both. Total additional cost: $0 (RevenueCat is free at our scale, Stripe fees paid by tradie's client).