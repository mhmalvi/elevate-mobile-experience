/**
 * DEPRECATED: This function has been consolidated into stripe-webhook.
 *
 * All Stripe subscription event handling (customer.subscription.created,
 * customer.subscription.updated, customer.subscription.deleted) is now
 * handled by the stripe-webhook function with robust user resolution
 * (metadata.user_id first, email fallback) and price-ID-based tier mapping.
 *
 * This stub remains deployed to avoid 404s if Stripe still delivers events
 * to this endpoint. It forwards the raw request to stripe-webhook.
 *
 * TODO: Once the Stripe webhook endpoint URL has been updated in the Stripe
 * dashboard to point to stripe-webhook, this function can be removed entirely.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getCorsHeaders, createCorsResponse } from "../_shared/cors.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return createCorsResponse(req);
  }

  // SECURITY: Reject requests without a Stripe signature to prevent abuse as an open relay
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new Response(
      JSON.stringify({ error: 'Missing stripe-signature header' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) {
    console.error('[SUBSCRIPTION-WEBHOOK] DEPRECATED: SUPABASE_URL not set, cannot forward');
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  console.warn(
    '[SUBSCRIPTION-WEBHOOK] DEPRECATED: Forwarding request to stripe-webhook. ' +
    'Update the Stripe dashboard webhook URL to point directly to stripe-webhook.'
  );

  try {
    // Clone the request body and headers to forward to stripe-webhook
    const body = await req.text();
    const forwardUrl = `${supabaseUrl}/functions/v1/stripe-webhook`;

    const forwardHeaders = new Headers();
    // Forward the Stripe signature and content-type (essential for verification)
    const sig = req.headers.get('stripe-signature');
    if (sig) forwardHeaders.set('stripe-signature', sig);
    forwardHeaders.set('Content-Type', req.headers.get('Content-Type') || 'application/json');

    const response = await fetch(forwardUrl, {
      method: 'POST',
      headers: forwardHeaders,
      body,
    });

    const responseBody = await response.text();
    return new Response(responseBody, {
      status: response.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[SUBSCRIPTION-WEBHOOK] DEPRECATED: Forward failed:', msg);
    return new Response(
      JSON.stringify({ error: 'Webhook forwarding failed' }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
