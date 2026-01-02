import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Map Stripe price IDs to tier names
// These are the actual price IDs from .env file
const PRICE_TO_TIER: Record<string, string> = {
  'price_1SiyYiHfG2W0TmGhQDHUiQkt': 'solo',
  'price_1SiybGHfG2W0TmGh4QYBj996': 'crew',
  'price_1SiybvHfG2W0TmGh0DdDE5xt': 'pro',
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Function started');

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
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
