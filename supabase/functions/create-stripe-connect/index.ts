import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders, createCorsResponse, createErrorResponse } from "../_shared/cors.ts";

serve(async (req) => {
  // SECURITY: Get secure CORS headers
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return createCorsResponse(req);
  }

  try {
    // Initialize Stripe
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      console.error("STRIPE_SECRET_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Payment service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2025-08-27.basil",
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Initialize Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Creating Stripe Connect account for user: ${user.id}`);

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (profileError) {
      console.error("Error fetching profile:", profileError);
      return new Response(
        JSON.stringify({ error: "Profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const appUrl = Deno.env.get("APP_URL") || "https://app.tradiemate.com.au";

    // Check if URL is a valid public URL (not localhost/local IP)
    const isPublicUrl = appUrl.startsWith("https://") &&
                       !appUrl.includes("localhost") &&
                       !appUrl.match(/https?:\/\/(127\.|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/);

    // Check if already has Stripe account
    if (profile?.stripe_account_id) {
      console.log(`User already has Stripe account: ${profile.stripe_account_id}`);

      // Check account status
      let account;
      try {
        account = await stripe.accounts.retrieve(profile.stripe_account_id);
      } catch (error) {
        console.error("Error retrieving Stripe account:", error);
        // Account might have been deleted, create new one
        // Continue to create new account below
      }

      // If account exists and is valid, generate new onboarding link
      if (account && !account.details_submitted) {
        console.log("Generating new onboarding link for existing account");
        const accountLink = await stripe.accountLinks.create({
          account: profile.stripe_account_id,
          refresh_url: `${appUrl}/settings/payments?refresh=true`,
          return_url: `${appUrl}/settings/payments?success=true`,
          type: "account_onboarding",
        });

        return new Response(
          JSON.stringify({
            success: true,
            url: accountLink.url,
            account_id: profile.stripe_account_id,
            existing_account: true,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else if (account && account.details_submitted) {
        // Account is already complete - generate login link instead
        console.log("Account already onboarded, generating login link");
        const loginLink = await stripe.accounts.createLoginLink(profile.stripe_account_id);

        return new Response(
          JSON.stringify({
            success: true,
            url: loginLink.url,
            account_id: profile.stripe_account_id,
            already_onboarded: true,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Create new Stripe Connect account
    console.log("Creating new Stripe Connect account");
    const account = await stripe.accounts.create({
      type: "express", // Express account allows platform fees
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
        // Only include URL if it's a valid public URL (not localhost/local IP)
        ...(isPublicUrl ? { url: appUrl } : {}),
      },
    });

    console.log(`Stripe account created: ${account.id}`);

    // Generate onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${appUrl}/settings/payments?refresh=true`,
      return_url: `${appUrl}/settings/payments?success=true`,
      type: "account_onboarding",
    });

    // Save account ID to database
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        stripe_account_id: account.id,
        stripe_onboarding_complete: false,
        stripe_charges_enabled: false,
      })
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Error updating profile:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to save Stripe account" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Stripe account linked to profile: ${user.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        url: accountLink.url,
        account_id: account.id,
        existing_account: false,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error creating Stripe Connect account:", errorMessage);
    console.error("Full error details:", JSON.stringify(error, null, 2));

    // Check if it's a Stripe error with more details
    if (error && typeof error === 'object') {
      console.error("Error type:", (error as any).type);
      console.error("Error code:", (error as any).code);
      console.error("Error raw:", (error as any).raw);
    }

    return new Response(
      JSON.stringify({
        error: errorMessage,
        details: error && typeof error === 'object' ? (error as any).raw : undefined
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
