 PAYMENT ARCHITECTURE GAP ANALYSIS

  ✅ WHAT'S ALREADY IMPLEMENTED (Good News!)

  System 1: RevenueCat (TradieMate Subscriptions)

  - ✅ RevenueCat SDK fully integrated (src/lib/purchases.ts)
  - ✅ Cross-platform support (iOS, Android, Web)
  - ✅ Product identifiers configured (solo_monthly, crew_monthly, pro_monthly)
  - ✅ Webhook handler (supabase/functions/revenuecat-webhook)
  - ✅ Database sync to profiles table
  - ✅ Frontend subscription UI (src/pages/settings/SubscriptionSettings.tsx)
  - ✅ Restore purchases functionality

  System 2: Stripe (Client Invoice Payments)

  - ✅ Payment session creation (supabase/functions/create-payment)
  - ✅ Stripe webhook handler (supabase/functions/stripe-webhook)
  - ✅ Invoice status updates (paid, partially_paid)
  - ✅ Payment reminder system via SMS (Twilio integration)
  - ✅ Recurring invoice generation

  Database & Infrastructure

  - ✅ Subscription tracking in profiles table
  - ✅ Invoice payment tracking with partial payment support
  - ✅ Bank details fields (bsb, account_number)
  - ✅ Stripe account ID field (in migrations_backup)

  ---
  ❌ CRITICAL GAPS (Must Implement for Production)

  Gap 1: Stripe Connect Account Creation ⚠️ CRITICAL

  Problem: No way for tradies to create Stripe Connect accounts
  - Missing: create-stripe-account Edge Function
  - Missing: Stripe onboarding UI flow
  - Missing: Account status verification

  Impact: Tradies cannot receive invoice payments from clients

  Gap 2: Payment Links Don't Use Stripe Connect ⚠️ CRITICAL

  Problem: create-payment function creates standard Stripe sessions, not Connect sessions
  - Current: Payments go to your platform Stripe account
  - Required: Payments should go directly to tradie's Stripe Connect account

  Impact: Money flows to wrong account - MAJOR COMPLIANCE/LEGAL ISSUE

  Gap 3: Database Schema Not in Active Migrations ⚠️ HIGH

  Problem: stripe_account_id field only exists in migrations_backup
  - Not applied to production database
  - Active migrations don't include this field

  Impact: Cannot store tradie's Stripe Connect account IDs

  Gap 4: RevenueCat Webhook Secret ⚠️ HIGH

  Problem: .env has placeholder value "your_webhook_secret"
  - Must get real webhook secret from RevenueCat dashboard
  - Webhook verification will fail with placeholder

  Impact: Subscription updates won't sync to database

  Gap 5: Missing Environment Variables ⚠️ MEDIUM

  Problem: Several production configs missing or incomplete:
  # Missing in .env:
  VITE_STRIPE_PRICE_ID_SOLO=price_xxx     # Stripe price IDs
  VITE_STRIPE_PRICE_ID_CREW=price_xxx
  VITE_STRIPE_PRICE_ID_PRO=price_xxx
  STRIPE_WEBHOOK_ENDPOINT_URL=https://...  # For Stripe Dashboard config
  REVENUECAT_WEBHOOK_SECRET=rc_xxx         # Real secret from RevenueCat

  Gap 6: No SMS Invoice Sending Integration ⚠️ MEDIUM

  Problem: No automated way to send payment links to clients
  - Architecture doc specifies SMS with payment link
  - Twilio credentials exist but no integration with invoice sending

  Impact: Tradies must manually share payment links

  Gap 7: No Stripe Connect Account Status Checking ⚠️ LOW

  Problem: No way to verify tradie completed Stripe onboarding
  - Can't check if account is charges_enabled
  - Can't handle incomplete onboarding

  Impact: Invoices might fail if tradie hasn't completed setup

  ---

● 🚀 STEP-BY-STEP IMPLEMENTATION PLAN

  PRIORITY 1: Database Schema (Required for Everything Else)

  Step 1.1: Add stripe_account_id to Active Migrations
  -- Create new migration file
  -- supabase/migrations/20251229000000_add_stripe_connect_fields.sql

  -- Add Stripe Connect fields to profiles
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_onboarding_complete BOOLEAN DEFAULT FALSE;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_charges_enabled BOOLEAN DEFAULT FALSE;

  -- Add subscription fields if missing
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free';
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_provider TEXT;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_id TEXT;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;

  -- Comments
  COMMENT ON COLUMN public.profiles.stripe_account_id IS 'Stripe Connect account ID (e.g., acct_xxx)';
  COMMENT ON COLUMN public.profiles.stripe_onboarding_complete IS 'Whether tradie completed Stripe onboarding';
  COMMENT ON COLUMN public.profiles.stripe_charges_enabled IS 'Whether Stripe account can accept payments';

  ---
  PRIORITY 2: Stripe Connect Account Creation

  Step 2.1: Create Edge Function for Stripe Connect Account
  // supabase/functions/create-stripe-connect/index.ts

  import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
  import Stripe from "https://esm.sh/stripe@18.5.0";
  import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

  serve(async (req) => {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2025-08-27.basil",
    });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user } } = await supabase.auth.getUser(
      req.headers.get("Authorization")?.replace("Bearer ", "")!
    );

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401
      });
    }

    // Get profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    // Check if already has Stripe account
    if (profile?.stripe_account_id) {
      // Generate new onboarding link for existing account
      const accountLink = await stripe.accountLinks.create({
        account: profile.stripe_account_id,
        refresh_url: `${Deno.env.get("APP_URL")}/settings/payments?refresh=true`,
        return_url: `${Deno.env.get("APP_URL")}/settings/payments?success=true`,
        type: "account_onboarding",
      });

      return new Response(JSON.stringify({
        url: accountLink.url,
        account_id: profile.stripe_account_id
      }));
    }

    // Create new Stripe Connect account
    const account = await stripe.accounts.create({
      type: "standard", // Tradie manages own Stripe dashboard
      country: "AU",
      email: profile?.email || user.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: "individual",
      business_profile: {
        name: profile?.business_name || "TradieMate Business",
        product_description: profile?.trade_type || "Trade services",
        mcc: "1799", // Special Trade Contractors
      },
    });

    // Generate onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${Deno.env.get("APP_URL")}/settings/payments?refresh=true`,
      return_url: `${Deno.env.get("APP_URL")}/settings/payments?success=true`,
      type: "account_onboarding",
    });

    // Save account ID to database
    await supabase
      .from("profiles")
      .update({
        stripe_account_id: account.id,
        stripe_onboarding_complete: false,
      })
      .eq("user_id", user.id);

    return new Response(JSON.stringify({
      url: accountLink.url,
      account_id: account.id,
    }));
  });

  Step 2.2: Create Edge Function to Check Stripe Account Status
  // supabase/functions/check-stripe-account/index.ts

  import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
  import Stripe from "https://esm.sh/stripe@18.5.0";
  import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

  serve(async (req) => {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2025-08-27.basil",
    });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user } } = await supabase.auth.getUser(
      req.headers.get("Authorization")?.replace("Bearer ", "")!
    );

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_account_id")
      .eq("user_id", user!.id)
      .single();

    if (!profile?.stripe_account_id) {
      return new Response(JSON.stringify({
        connected: false,
        onboarding_complete: false,
        charges_enabled: false
      }));
    }

    // Get account status from Stripe
    const account = await stripe.accounts.retrieve(profile.stripe_account_id);

    // Update database with current status
    await supabase
      .from("profiles")
      .update({
        stripe_onboarding_complete: account.details_submitted,
        stripe_charges_enabled: account.charges_enabled,
      })
      .eq("user_id", user!.id);

    return new Response(JSON.stringify({
      connected: true,
      onboarding_complete: account.details_submitted,
      charges_enabled: account.charges_enabled,
      requirements: account.requirements,
    }));
  });

  ---
  PRIORITY 3: Fix Payment Links to Use Stripe Connect

  Step 3.1: Update create-payment to Use Stripe Connect
  // Update supabase/functions/create-payment/index.ts
  // Add after line 83 (after fetching profile):

  const stripeAccountId = profile?.stripe_account_id;

  if (!stripeAccountId) {
    return new Response(
      JSON.stringify({ error: "Stripe account not connected. Please complete payment setup." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Update session creation (line 88) - add stripeAccount parameter:
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [/* ... existing ... */],
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
      application_fee_amount: 0, // Optional: Add platform fee (0.25% = Math.round(balance * 100 * 0.0025))
    },
  }, {
    stripeAccount: stripeAccountId, // CRITICAL: This makes payment go to tradie
  });

  ---
  PRIORITY 4: Environment Variables & Configuration

  Step 4.1: Update .env File
  # Add to .env:
  APP_URL="https://app.tradiemate.com.au"

  # Get real webhook secret from: https://app.revenuecat.com/webhooks
  REVENUECAT_WEBHOOK_SECRET="rc_<get_from_revenuecat_dashboard>"

  # Optional: Stripe price IDs for web subscriptions (if using Stripe directly)
  VITE_STRIPE_PRICE_ID_SOLO="price_xxx"
  VITE_STRIPE_PRICE_ID_CREW="price_xxx"
  VITE_STRIPE_PRICE_ID_PRO="price_xxx"

  Step 4.2: Configure Webhooks
  1. Stripe Webhook:
    - Go to: https://dashboard.stripe.com/webhooks
    - Add endpoint: https://rucuomtojzifrvplhwja.supabase.co/functions/v1/stripe-webhook
    - Events: checkout.session.completed, payment_intent.succeeded
    - Copy signing secret to STRIPE_WEBHOOK_SECRET in .env
  2. RevenueCat Webhook:
    - Go to: https://app.revenuecat.com/webhooks
    - Add webhook: https://rucuomtojzifrvplhwja.supabase.co/functions/v1/revenuecat-webhook
    - Copy authorization header value to REVENUECAT_WEBHOOK_SECRET

  ---
  PRIORITY 5: Invoice Sending with SMS

  Step 5.1: Create Send Invoice Edge Function
  // supabase/functions/send-invoice/index.ts

  import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
  import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
  import Twilio from "https://esm.sh/twilio@5.3.4";

  serve(async (req) => {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { invoice_id } = await req.json();

    // Get invoice with client info
    const { data: invoice } = await supabase
      .from("invoices")
      .select("*, clients(*), profiles!inner(*)")
      .eq("id", invoice_id)
      .single();

    if (!invoice || !invoice.clients) {
      return new Response(JSON.stringify({ error: "Invoice or client not found" }), {
        status: 404
      });
    }

    // Create payment link
    const paymentResponse = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/create-payment`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": req.headers.get("Authorization")!,
        },
        body: JSON.stringify({ invoice_id }),
      }
    );

    const { url: paymentUrl } = await paymentResponse.json();

    // Send SMS via Twilio
    const twilioClient = Twilio(
      Deno.env.get("TWILIO_ACCOUNT_SID")!,
      Deno.env.get("TWILIO_AUTH_TOKEN")!
    );

    await twilioClient.messages.create({
      to: invoice.clients.phone,
      from: Deno.env.get("TWILIO_PHONE_NUMBER")!,
      body: `Hi ${invoice.clients.name},

  Invoice from ${invoice.profiles.business_name}
  Amount: $${invoice.total.toFixed(2)} AUD

  Pay now: ${paymentUrl}

  Questions? Call ${invoice.profiles.phone}`,
    });

    // Update invoice status to "sent"
    await supabase
      .from("invoices")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        stripe_payment_link: paymentUrl,
      })
      .eq("id", invoice_id);

    return new Response(JSON.stringify({ success: true, payment_url: paymentUrl }));
  });

  ---
  PRIORITY 6: Frontend Integration

  Step 6.1: Add Stripe Connect UI to Settings
  Create a new component or update existing settings:

  // src/pages/settings/PaymentSettings.tsx

  const connectStripe = async () => {
    const { data, error } = await supabase.functions.invoke('create-stripe-connect');

    if (data?.url) {
      // Open Stripe onboarding in browser/webview
      window.open(data.url, '_blank');
    }
  };

  const checkStripeStatus = async () => {
    const { data } = await supabase.functions.invoke('check-stripe-account');
    setStripeConnected(data.charges_enabled);
  };

  // UI:
  {!stripeConnected && (
    <button onClick={connectStripe}>
      Connect Stripe to Accept Payments
    </button>
  )}
  {stripeConnected && (
    <div>✅ Stripe Connected - You can accept invoice payments</div>
  )}

  ---
  📋 IMPLEMENTATION CHECKLIST

● Here's your production readiness checklist:

  ✅ MUST DO (Critical for Launch):

  - 1. Database Migration - Add stripe_account_id field to production
  - 2. Create Stripe Connect Functions - create-stripe-connect + check-stripe-account
  - 3. Fix Payment Links - Update create-payment to use stripeAccount parameter
  - 4. Configure Webhooks - Set up Stripe & RevenueCat webhook URLs
  - 5. Update Environment Variables - Add APP_URL and real REVENUECAT_WEBHOOK_SECRET

  ⚠️ SHOULD DO (Important for UX):

  - 6. SMS Invoice Sending - Create send-invoice function with Twilio
  - 7. Frontend Stripe Connect UI - Add "Connect Stripe" button in settings
  - 8. Account Status Checking - Call check-stripe-account on app load

  💡 NICE TO HAVE (Can Add Later):

  - 9. Platform Fee - Add 0.25% fee to generate extra revenue
  - 10. Webhook Logging - Add detailed webhook event logging for debugging
  - 11. Test Mode Toggle - Add UI to switch between test/live Stripe keys

  ---
  🎯 IMMEDIATE NEXT STEPS

  Would you like me to:

  1. Start implementing these fixes immediately? I can:
    - Create the database migration file
    - Build the Stripe Connect Edge Functions
    - Update the create-payment function
    - Create the frontend UI components
    - Update the .env file template
  2. Provide more detail on any specific area?
  3. Help you test the implementation? I can create test scripts and validation checks.

  IMPORTANT: You have all the credentials needed:
  - ✅ Stripe Secret Key
  - ✅ Stripe Webhook Secret
  - ✅ RevenueCat API Keys (Android, iOS, Web)
  - ✅ Twilio credentials
  - ✅ Supabase credentials