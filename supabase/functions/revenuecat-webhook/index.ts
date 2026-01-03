import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import * as crypto from "https://deno.land/std@0.190.0/crypto/mod.ts";
import { getCorsHeaders, createCorsResponse, createErrorResponse } from "../_shared/cors.ts";

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[REVENUECAT-WEBHOOK] ${step}${detailsStr}`);
};

// Map RevenueCat product IDs to subscription tiers
const PRODUCT_TO_TIER: Record<string, string> = {
  'solo_monthly': 'solo',
  'crew_monthly': 'crew',
  'pro_monthly': 'pro',
};

interface RevenueCatEvent {
  api_version: string;
  event: {
    type: string;
    app_user_id: string;
    product_id: string;
    entitlement_id?: string;
    original_app_user_id: string;
    expiration_at_ms?: number;
    store: 'APP_STORE' | 'PLAY_STORE' | 'STRIPE';
    environment: 'SANDBOX' | 'PRODUCTION';
  };
}

serve(async (req) => {
  // SECURITY: Get secure CORS headers
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return createCorsResponse(req);
  }

  try {
    logStep('Webhook received');

    const webhookSecret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');

    // Get raw body for signature verification
    const rawBody = await req.text();

    // Verify webhook signature if secret is configured
    if (webhookSecret) {
      const signature = req.headers.get('X-RevenueCat-Signature');
      if (!signature) {
        logStep('Missing webhook signature');
        return new Response(JSON.stringify({ error: 'Missing signature' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        });
      }

      // Verify HMAC-SHA256 signature
      try {
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
          'raw',
          encoder.encode(webhookSecret),
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['sign']
        );

        const signatureBuffer = await crypto.subtle.sign(
          'HMAC',
          key,
          encoder.encode(rawBody)
        );

        const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');

        if (signature !== expectedSignature) {
          logStep('Invalid webhook signature');
          return new Response(JSON.stringify({ error: 'Invalid signature' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401,
          });
        }

        logStep('Webhook signature verified');
      } catch (error) {
        logStep('Signature verification failed', { error: String(error) });
        return new Response(JSON.stringify({ error: 'Signature verification failed' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        });
      }
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const body: RevenueCatEvent = JSON.parse(rawBody);
    const event = body.event;

    logStep('Event received', { 
      type: event.type, 
      userId: event.app_user_id,
      productId: event.product_id,
      store: event.store 
    });

    // Handle different event types
    switch (event.type) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'PRODUCT_CHANGE':
      case 'UNCANCELLATION': {
        // User has an active subscription
        const tier = PRODUCT_TO_TIER[event.product_id] || 'solo';
        const provider = event.store === 'PLAY_STORE' ? 'google_play' : 'apple_iap';
        const expiresAt = event.expiration_at_ms 
          ? new Date(event.expiration_at_ms).toISOString() 
          : null;

        logStep('Updating to active subscription', { tier, provider, expiresAt });

        // The app_user_id should be the Supabase user ID
        const { error } = await supabaseClient
          .from('profiles')
          .update({
            subscription_tier: tier,
            subscription_provider: provider,
            subscription_id: event.original_app_user_id,
            subscription_expires_at: expiresAt,
          })
          .eq('user_id', event.app_user_id);

        if (error) {
          logStep('Failed to update profile', { error: error.message });
          // Try to find by original_app_user_id as fallback
          await supabaseClient
            .from('profiles')
            .update({
              subscription_tier: tier,
              subscription_provider: provider,
              subscription_id: event.original_app_user_id,
              subscription_expires_at: expiresAt,
            })
            .eq('user_id', event.original_app_user_id);
        }

        logStep('Profile updated with active subscription');
        break;
      }

      case 'CANCELLATION':
      case 'EXPIRATION':
      case 'BILLING_ISSUE': {
        // Subscription ended or has issues - downgrade to free
        logStep('Subscription ended, downgrading to free', { userId: event.app_user_id });

        const { error } = await supabaseClient
          .from('profiles')
          .update({
            subscription_tier: 'free',
            subscription_provider: null,
            subscription_id: null,
            subscription_expires_at: null,
          })
          .eq('user_id', event.app_user_id);

        if (error) {
          // Try fallback
          await supabaseClient
            .from('profiles')
            .update({
              subscription_tier: 'free',
              subscription_provider: null,
              subscription_id: null,
              subscription_expires_at: null,
            })
            .eq('user_id', event.original_app_user_id);
        }

        logStep('Profile downgraded to free tier');
        break;
      }

      case 'SUBSCRIBER_ALIAS':
        // User identity changed - log but no action needed
        logStep('Subscriber alias event', { 
          newId: event.app_user_id, 
          originalId: event.original_app_user_id 
        });
        break;

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
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
