import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders, createCorsResponse, createErrorResponse } from "../_shared/cors.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";

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

    // Rate limiting
    const rateLimit = await checkRateLimit(supabase, user.id, 'check-stripe-account', 20, 60);
    if (rateLimit.limited) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Checking Stripe account status for user: ${user.id}`);

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("stripe_account_id, stripe_onboarding_complete, stripe_charges_enabled")
      .eq("user_id", user.id)
      .single();

    if (profileError) {
      console.error("Error fetching profile:", profileError);
      return new Response(
        JSON.stringify({ error: "Profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // No Stripe account connected
    if (!profile?.stripe_account_id) {
      console.log("No Stripe account found for user");
      return new Response(
        JSON.stringify({
          connected: false,
          onboarding_complete: false,
          charges_enabled: false,
          details_submitted: false,
          requirements: null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Retrieve account status from Stripe
    let account;
    try {
      account = await stripe.accounts.retrieve(profile.stripe_account_id);
      console.log(`Stripe account retrieved: ${account.id}, charges_enabled: ${account.charges_enabled}`);
    } catch (error) {
      console.error("Error retrieving Stripe account:", error);
      // Account might have been deleted or is invalid
      // Update database to reflect disconnected state
      await supabase
        .from("profiles")
        .update({
          stripe_account_id: null,
          stripe_onboarding_complete: false,
          stripe_charges_enabled: false,
        })
        .eq("user_id", user.id);

      return new Response(
        JSON.stringify({
          connected: false,
          onboarding_complete: false,
          charges_enabled: false,
          details_submitted: false,
          error: "Stripe account not found or invalid",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update database with current Stripe account status
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        stripe_onboarding_complete: account.details_submitted,
        stripe_charges_enabled: account.charges_enabled,
      })
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Error updating profile:", updateError);
    }

    // Build requirements list
    const requirements = {
      currently_due: account.requirements?.currently_due || [],
      eventually_due: account.requirements?.eventually_due || [],
      past_due: account.requirements?.past_due || [],
      pending_verification: account.requirements?.pending_verification || [],
      disabled_reason: account.requirements?.disabled_reason || null,
    };

    // Determine overall status
    const hasRequirements =
      requirements.currently_due.length > 0 ||
      requirements.past_due.length > 0;

    return new Response(
      JSON.stringify({
        connected: true,
        account_id: account.id,
        onboarding_complete: account.details_submitted,
        charges_enabled: account.charges_enabled,
        details_submitted: account.details_submitted,
        payouts_enabled: account.payouts_enabled,
        requirements: requirements,
        has_requirements: hasRequirements,
        country: account.country,
        default_currency: account.default_currency,
        email: account.email,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error checking Stripe account:", errorMessage);
    return new Response(
      JSON.stringify({ error: "Failed to check payment account status" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
