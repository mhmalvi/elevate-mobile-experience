import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders, createCorsResponse, createErrorResponse } from "../_shared/cors.ts";

// SECURITY: Load Stripe price IDs from environment variables (monthly + annual)
// These should NEVER be hardcoded in the source code
function getPriceTierMap(): Record<string, string> {
  const map: Record<string, string> = {};
  const soloPrice = Deno.env.get('STRIPE_PRICE_ID_SOLO');
  const crewPrice = Deno.env.get('STRIPE_PRICE_ID_CREW');
  const proPrice = Deno.env.get('STRIPE_PRICE_ID_PRO');
  const soloAnnual = Deno.env.get('STRIPE_PRICE_ID_SOLO_ANNUAL');
  const crewAnnual = Deno.env.get('STRIPE_PRICE_ID_CREW_ANNUAL');
  const proAnnual = Deno.env.get('STRIPE_PRICE_ID_PRO_ANNUAL');

  if (!soloPrice || !crewPrice || !proPrice) {
    throw new Error('STRIPE_PRICE_ID_* environment variables not configured');
  }

  if (soloPrice) map[soloPrice] = 'solo';
  if (crewPrice) map[crewPrice] = 'crew';
  if (proPrice) map[proPrice] = 'pro';
  if (soloAnnual) map[soloAnnual] = 'solo';
  if (crewAnnual) map[crewAnnual] = 'crew';
  if (proAnnual) map[proAnnual] = 'pro';

  return map;
}

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  // SECURITY: Get secure CORS headers
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return createCorsResponse(req);
  }

  try {
    logStep('Function started');

    // Load price-to-tier mapping from environment
    const PRICE_TO_TIER = getPriceTierMap();
    logStep('Price mappings loaded from environment');

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) throw new Error('STRIPE_SECRET_KEY is not set');
    logStep('Stripe key verified');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header provided');
    logStep('Authorization header found');

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error('User not authenticated or email not available');
    logStep('User authenticated', { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: '2025-08-27.basil' });

    // Find customer by email
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    if (customers.data.length === 0) {
      logStep('No Stripe customer found, user is on free tier');

      // Update profile to free tier
      await supabaseClient
        .from('profiles')
        .update({
          subscription_tier: 'free',
          subscription_provider: null,
          subscription_id: null,
          subscription_expires_at: null,
        })
        .eq('user_id', user.id);

      return new Response(JSON.stringify({
        subscribed: false,
        tier: 'free',
        subscription_end: null,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep('Found Stripe customer', { customerId });

    // Check for active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      logStep('No active subscription found');

      // Update profile to free tier
      await supabaseClient
        .from('profiles')
        .update({
          subscription_tier: 'free',
          subscription_provider: null,
          subscription_id: null,
          subscription_expires_at: null,
        })
        .eq('user_id', user.id);

      return new Response(JSON.stringify({
        subscribed: false,
        tier: 'free',
        subscription_end: null,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const subscription = subscriptions.data[0];
    const priceId = subscription.items.data[0]?.price.id;
    const tier = PRICE_TO_TIER[priceId] || subscription.metadata?.tier_id || 'solo';
    const subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();

    logStep('Active subscription found', {
      subscriptionId: subscription.id,
      priceId,
      tier,
      endDate: subscriptionEnd,
    });

    // Update profile with subscription info
    await supabaseClient
      .from('profiles')
      .update({
        subscription_tier: tier,
        subscription_provider: 'stripe',
        subscription_id: subscription.id,
        subscription_expires_at: subscriptionEnd,
      })
      .eq('user_id', user.id);

    logStep('Profile updated with subscription info');

    return new Response(JSON.stringify({
      subscribed: true,
      tier,
      subscription_end: subscriptionEnd,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep('ERROR', { message: errorMessage });
    return new Response(JSON.stringify({ error: "Subscription check failed" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
