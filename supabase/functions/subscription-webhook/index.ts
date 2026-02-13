import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders, createCorsResponse, createErrorResponse } from "../_shared/cors.ts";

// Map Stripe price IDs to tier names - loaded from environment (monthly + annual)
function getPriceTierMap(): Record<string, string> {
  const map: Record<string, string> = {};
  const soloPrice = Deno.env.get('STRIPE_PRICE_ID_SOLO');
  const crewPrice = Deno.env.get('STRIPE_PRICE_ID_CREW');
  const proPrice = Deno.env.get('STRIPE_PRICE_ID_PRO');
  const soloAnnual = Deno.env.get('STRIPE_PRICE_ID_SOLO_ANNUAL');
  const crewAnnual = Deno.env.get('STRIPE_PRICE_ID_CREW_ANNUAL');
  const proAnnual = Deno.env.get('STRIPE_PRICE_ID_PRO_ANNUAL');
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
  console.log(`[SUBSCRIPTION-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  // SECURITY: Get secure CORS headers
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return createCorsResponse(req);
  }

  try {
    logStep('Webhook received');

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

    if (!stripeKey) throw new Error('STRIPE_SECRET_KEY is not set');
    if (!webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET is not set');

    const stripe = new Stripe(stripeKey, { apiVersion: '2025-04-30.basil' });

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const signature = req.headers.get('stripe-signature');
    if (!signature) throw new Error('No Stripe signature found');

    const body = await req.text();
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

    logStep('Webhook event verified', { type: event.type, id: event.id });

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Get customer email
        const customer = await stripe.customers.retrieve(customerId);
        if (customer.deleted) {
          logStep('Customer was deleted');
          break;
        }

        const email = customer.email;
        if (!email) {
          logStep('No email found for customer');
          break;
        }

        // Get user by email
        const { data: users, error: userError } = await supabaseClient
          .from('profiles')
          .select('user_id')
          .eq('email', email)
          .limit(1);

        if (userError || !users || users.length === 0) {
          logStep('User not found for email', { email });
          break;
        }

        const userId = users[0].user_id;
        const priceId = subscription.items.data[0]?.price.id;
        const PRICE_TO_TIER = getPriceTierMap();
        const tier = PRICE_TO_TIER[priceId] || subscription.metadata?.tier_id || 'solo';
        const isActive = subscription.status === 'active';
        const subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();

        logStep('Updating subscription', {
          userId,
          tier,
          isActive,
          subscriptionEnd,
        });

        await supabaseClient
          .from('profiles')
          .update({
            subscription_tier: isActive ? tier : 'free',
            subscription_provider: isActive ? 'stripe' : null,
            subscription_id: isActive ? subscription.id : null,
            subscription_expires_at: isActive ? subscriptionEnd : null,
          })
          .eq('user_id', userId);

        logStep('Profile updated successfully');
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Get customer email
        const customer = await stripe.customers.retrieve(customerId);
        if (customer.deleted) {
          logStep('Customer was deleted');
          break;
        }

        const email = customer.email;
        if (!email) {
          logStep('No email found for customer');
          break;
        }

        // Get user by email
        const { data: users, error: userError } = await supabaseClient
          .from('profiles')
          .select('user_id')
          .eq('email', email)
          .limit(1);

        if (userError || !users || users.length === 0) {
          logStep('User not found for email', { email });
          break;
        }

        const userId = users[0].user_id;

        logStep('Subscription cancelled, downgrading to free', { userId });

        await supabaseClient
          .from('profiles')
          .update({
            subscription_tier: 'free',
            subscription_provider: null,
            subscription_id: null,
            subscription_expires_at: null,
          })
          .eq('user_id', userId);

        logStep('Profile downgraded to free tier');
        break;
      }

      default:
        logStep('Unhandled event type', { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep('ERROR', { message: errorMessage });
    return new Response(JSON.stringify({ error: "Webhook processing failed" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
