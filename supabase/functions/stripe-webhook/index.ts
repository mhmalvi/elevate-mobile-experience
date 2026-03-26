import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getCorsHeaders, createCorsResponse, createErrorResponse } from "../_shared/cors.ts";
import { checkWebhookIdempotency, markWebhookProcessed } from "../_shared/webhook-idempotency.ts";

// SECURITY: Escape HTML special characters to prevent XSS in email notifications
function escapeHtml(str: string | undefined | null): string {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// Map Stripe price IDs to tier names - loaded from environment (monthly + annual)
// Merged from subscription-webhook to support tier resolution by price ID
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

/**
 * Resolve the user_id for a subscription event.
 * Strategy: try metadata.user_id first, fall back to looking up the Stripe
 * customer's email in the profiles table.
 */
async function resolveSubscriptionUserId(
  subscription: Stripe.Subscription,
  stripe: Stripe,
  supabase: ReturnType<typeof createClient>,
): Promise<string | null> {
  // 1. Try metadata (fastest, no extra API call)
  const metadataUserId = subscription.metadata?.user_id;
  if (metadataUserId) {
    console.log(`User resolved via metadata: ${metadataUserId}`);
    return metadataUserId;
  }

  // 2. Fall back to customer email lookup
  const customerId = subscription.customer as string;
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) {
      console.warn(`Stripe customer ${customerId} has been deleted`);
      return null;
    }
    const email = customer.email;
    if (!email) {
      console.warn(`No email on Stripe customer ${customerId}`);
      return null;
    }

    const { data: users, error: userError } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('email', email)
      .limit(1);

    if (userError || !users || users.length === 0) {
      console.warn(`No profile found for email ${email}`);
      return null;
    }

    console.log(`User resolved via email lookup (${email}): ${users[0].user_id}`);
    return users[0].user_id;
  } catch (err) {
    console.error(`Failed to resolve user via customer ${customerId}:`, err);
    return null;
  }
}

/**
 * Determine the subscription tier from a Stripe Subscription.
 * Priority: price ID mapping > metadata.tier_id > fallback to 'solo'.
 */
function resolveSubscriptionTier(subscription: Stripe.Subscription): string {
  const priceId = subscription.items.data[0]?.price.id;
  if (priceId) {
    const PRICE_TO_TIER = getPriceTierMap();
    const tierFromPrice = PRICE_TO_TIER[priceId];
    if (tierFromPrice) {
      console.log(`Tier resolved via price ID (${priceId}): ${tierFromPrice}`);
      return tierFromPrice;
    }
  }

  const tierFromMetadata = subscription.metadata?.tier_id;
  if (tierFromMetadata) {
    console.log(`Tier resolved via metadata: ${tierFromMetadata}`);
    return tierFromMetadata;
  }

  console.log('Tier fallback: solo');
  return 'solo';
}

serve(async (req) => {
  // SECURITY: Get secure CORS headers based on request origin
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return createCorsResponse(req);
  }

  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecretConnect = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const webhookSecretPlatform = Deno.env.get("STRIPE_WEBHOOK_SECRET_PLATFORM");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!stripeSecretKey || (!webhookSecretConnect && !webhookSecretPlatform)) {
    console.error("Missing Stripe configuration");
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Supabase configuration");
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: "2025-08-27.basil",
  });

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Declare event and webhookSource before try block so they are accessible in the catch block
  let event: Stripe.Event | null = null;
  let webhookSource: string = 'unknown';

  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      console.error("No stripe-signature header");
      return new Response(JSON.stringify({ error: "No signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify webhook signature - try both secrets (Connect and Platform)

    // Try Connect webhook secret first
    if (webhookSecretConnect) {
      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecretConnect);
        webhookSource = "connect";
        console.log("Verified with Connect webhook secret");
      } catch (err) {
        // Not Connect webhook, try Platform secret
      }
    }

    // If Connect verification failed, try Platform webhook secret
    if (!event && webhookSecretPlatform) {
      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecretPlatform);
        webhookSource = "platform";
        console.log("Verified with Platform webhook secret");
      } catch (err) {
        // Platform verification also failed
      }
    }

    // If both failed, return error
    if (!event) {
      const errorMessage = "Webhook signature verification failed for both secrets";
      console.error(errorMessage);
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Received Stripe event: ${event.type} (source: ${webhookSource})`);

    // Log the account ID if this is a Connect event
    const connectedAccountId = (event as any).account;
    if (connectedAccountId) {
      console.log(`Connect event from account: ${connectedAccountId}`);
    }

    // SECURITY: Check idempotency to prevent duplicate processing
    const idempotencyCheck = await checkWebhookIdempotency(supabase, event.id);
    if (idempotencyCheck.isProcessed && idempotencyCheck.previousResult === 'success') {
      console.log(`Skipping already successfully processed event: ${event.id}`);
      return new Response(
        JSON.stringify({
          received: true,
          cached: true,
          previousResult: idempotencyCheck.previousResult
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    // If previous result was 'error', fall through and re-process the event
    if (idempotencyCheck.isProcessed && idempotencyCheck.previousResult === 'error') {
      console.log(`Re-processing previously errored event: ${event.id}`);
    }

    // Handle checkout.session.completed event
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const invoiceId = session.metadata?.invoice_id;

      console.log(`Checkout session completed. Invoice ID: ${invoiceId}, Account: ${connectedAccountId || 'platform'}`);

      if (invoiceId) {
        // Calculate payment amount (Stripe returns amount in cents)
        const paymentAmount = (session.amount_total || 0) / 100;

        // Use optimistic locking to prevent race conditions on concurrent payments.
        // We fetch the current amount_paid, compute the new value, then use
        // .eq('amount_paid', currentAmountPaid) as a compare-and-swap guard.
        const MAX_RETRIES = 2;
        let attempt = 0;
        let newAmountPaid = 0;
        let newStatus = '';
        let updateSucceeded = false;

        while (attempt <= MAX_RETRIES) {
          // Fetch current invoice state
          const { data: invoice, error: fetchError } = await supabase
            .from("invoices")
            .select("total, amount_paid")
            .eq("id", invoiceId)
            .single();

          if (fetchError || !invoice) {
            console.error("Error fetching invoice:", fetchError);
            return new Response(JSON.stringify({ error: "Invoice not found" }), {
              status: 404,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          const currentAmountPaid = invoice.amount_paid || 0;
          newAmountPaid = currentAmountPaid + paymentAmount;
          const total = invoice.total || 0;
          newStatus = newAmountPaid >= total ? "paid" : "partially_paid";

          // Optimistic lock: only update if amount_paid hasn't changed since we read it
          const { data: updated, error: updateError } = await supabase
            .from("invoices")
            .update({
              status: newStatus,
              amount_paid: newAmountPaid,
              paid_at: newStatus === "paid" ? new Date().toISOString() : null,
            })
            .eq("id", invoiceId)
            .eq("amount_paid", currentAmountPaid)
            .select()
            .single();

          if (updateError && updateError.code !== 'PGRST116') {
            console.error("Error updating invoice:", updateError);
            return new Response(JSON.stringify({ error: "Failed to update invoice" }), {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          if (updated) {
            updateSucceeded = true;
            break;
          }

          // Concurrent modification detected — retry with fresh data
          attempt++;
          console.warn(`Optimistic lock conflict on invoice ${invoiceId}, retry ${attempt}/${MAX_RETRIES}`);
        }

        if (!updateSucceeded) {
          console.error(`Failed to update invoice ${invoiceId} after ${MAX_RETRIES + 1} attempts (concurrent modification)`);
          return new Response(JSON.stringify({ error: "Failed to update invoice due to concurrent modification" }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        console.log(`Invoice ${invoiceId} updated: status=${newStatus}, amount_paid=${newAmountPaid}`);

        // Send payment confirmation notification to business owner
        try {
          const resendApiKey = Deno.env.get("RESEND_API_KEY");
          if (resendApiKey) {
            const resend = new Resend(resendApiKey);

            const { data: invoiceWithClient } = await supabase
              .from("invoices")
              .select("*, clients(name), profiles!invoices_user_id_fkey(email, business_name)")
              .eq("id", invoiceId)
              .single();

            if (invoiceWithClient?.profiles?.email) {
              const ownerEmail = invoiceWithClient.profiles.email;
              const businessName = invoiceWithClient.profiles.business_name || "Your business";
              const clientName = invoiceWithClient.clients?.name || "Client";
              const invoiceNumber = invoiceWithClient.invoice_number;

              // Send notification email directly via Resend
              await resend.emails.send({
                from: Deno.env.get("EMAIL_FROM_DOMAIN") || `TradieMate <notifications@tradiemate.com.au>`,
                to: [ownerEmail],
                subject: `💰 Payment Received - Invoice ${invoiceNumber}`,
                html: `
                  <!DOCTYPE html>
                  <html>
                  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                      <h1 style="color: white; margin: 0; font-size: 28px;">💰 Payment Received!</h1>
                    </div>
                    <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
                      <p style="font-size: 18px; color: #10b981; font-weight: bold;">Great news, ${escapeHtml(businessName)}!</p>
                      <p style="font-size: 16px;">You've received a payment from <strong>${escapeHtml(clientName)}</strong>.</p>

                      <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
                        <table style="width: 100%; border-collapse: collapse;">
                          <tr>
                            <td style="padding: 8px 0;"><strong>Invoice:</strong></td>
                            <td style="padding: 8px 0; text-align: right;">${invoiceNumber}</td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0;"><strong>Client:</strong></td>
                            <td style="padding: 8px 0; text-align: right;">${escapeHtml(clientName)}</td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0;"><strong>Amount Paid:</strong></td>
                            <td style="padding: 8px 0; text-align: right; font-size: 20px; color: #10b981; font-weight: bold;">$${paymentAmount.toFixed(2)}</td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0;"><strong>Status:</strong></td>
                            <td style="padding: 8px 0; text-align: right;">
                              <span style="background: ${newStatus === 'paid' ? '#10b981' : '#f59e0b'}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 14px;">
                                ${newStatus === 'paid' ? '✓ Fully Paid' : 'Partially Paid'}
                              </span>
                            </td>
                          </tr>
                        </table>
                      </div>

                      ${newStatus === 'paid' ? '<p style="background: #d1fae5; padding: 15px; border-radius: 8px; color: #065f46; text-align: center; font-weight: bold;">✓ This invoice has been fully paid</p>' : ''}

                      <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                        Log in to view the complete invoice details.
                      </p>

                      <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                        <p style="color: #9ca3af; font-size: 12px; margin: 0;">

                        </p>
                      </div>
                    </div>
                  </body>
                  </html>
                `
              });
              console.log(`Payment notification sent to ${ownerEmail}`);
            }
          } else {
            console.log("RESEND_API_KEY not configured, skipping notification");
          }
        } catch (notificationError) {
          // Don't fail the webhook if notification fails
          console.error("Failed to send payment notification:", notificationError);
        }
      } else {
        console.log("No invoice_id in session metadata");
      }
    }

    // Handle payment_intent.succeeded for additional safety
    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.log(`Payment intent succeeded: ${paymentIntent.id}, amount: ${paymentIntent.amount / 100}`);
    }

    // Handle subscription lifecycle events for platform subscriptions
    // Consolidated handler: tries metadata.user_id first, falls back to customer email lookup.
    // Tier is resolved from price ID mapping first, then metadata, then defaults to 'solo'.
    if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = await resolveSubscriptionUserId(subscription, stripe, supabase);
      const tier = resolveSubscriptionTier(subscription);
      const isActive = subscription.status === 'active';
      const subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();

      console.log(`Subscription ${event.type}: ${subscription.id}, user: ${userId}, tier: ${tier}, active: ${isActive}`);

      if (userId) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            subscription_tier: isActive ? tier : 'free',
            subscription_provider: isActive ? 'stripe' : null,
            subscription_id: isActive ? subscription.id : null,
            subscription_expires_at: isActive ? subscriptionEnd : null,
          })
          .eq('user_id', userId);

        if (updateError) {
          console.error('Error updating subscription status:', updateError);
        } else {
          console.log(`Profile updated: user=${userId}, tier=${isActive ? tier : 'free'}`);
        }
      } else {
        console.warn(`Could not resolve user for subscription ${subscription.id} — skipping profile update`);
      }
    }

    // Handle subscription cancellation/deletion
    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = await resolveSubscriptionUserId(subscription, stripe, supabase);

      console.log(`Subscription deleted: ${subscription.id}, user: ${userId}`);

      if (userId) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            subscription_tier: 'free',
            subscription_provider: null,
            subscription_id: null,
            subscription_expires_at: null,
          })
          .eq('user_id', userId);

        if (updateError) {
          console.error('Error downgrading to free tier:', updateError);
        } else {
          console.log(`User downgraded to free: ${userId}`);
        }
      } else {
        console.warn(`Could not resolve user for deleted subscription ${subscription.id} — skipping downgrade`);
      }
    }

    // Handle invoice payment succeeded for recurring subscription charges
    if (event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoice.subscription;

      if (subscriptionId) {
        console.log(`Invoice payment succeeded for subscription: ${subscriptionId}`);

        // Fetch the subscription to get metadata and price info
        const subscription = await stripe.subscriptions.retrieve(subscriptionId as string);
        const userId = await resolveSubscriptionUserId(subscription, stripe, supabase);
        const tier = resolveSubscriptionTier(subscription);

        if (userId) {
          const { error: renewError } = await supabase
            .from('profiles')
            .update({
              subscription_tier: tier,
              subscription_provider: 'stripe',
              subscription_id: subscription.id,
              subscription_expires_at: new Date(subscription.current_period_end * 1000).toISOString(),
            })
            .eq('user_id', userId);

          if (renewError) {
            console.error('Error renewing subscription:', renewError);
          } else {
            console.log(`Subscription renewed: user=${userId}, tier=${tier}`);
          }
        } else {
          console.warn(`Could not resolve user for subscription ${subscription.id} on invoice.payment_succeeded`);
        }
      }
    }

    // Handle Stripe Connect account.updated — sync onboarding status
    if (event.type === "account.updated") {
      const account = event.data.object as Stripe.Account;
      const accountId = account.id;

      console.log(`Account updated: ${accountId}, charges_enabled=${account.charges_enabled}, details_submitted=${account.details_submitted}`);

      // Find the profile with this Stripe account ID and update status
      const { data: matchedProfile, error: profileFetchError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('stripe_account_id', accountId)
        .single();

      if (profileFetchError || !matchedProfile) {
        console.warn(`No profile found for Stripe account ${accountId}`);
      } else {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            stripe_onboarding_complete: account.details_submitted || false,
            stripe_charges_enabled: account.charges_enabled || false,
          })
          .eq('user_id', matchedProfile.user_id);

        if (updateError) {
          console.error('Error updating Stripe account status:', updateError);
        } else {
          console.log(`Profile updated for account ${accountId}: onboarding_complete=${account.details_submitted}, charges_enabled=${account.charges_enabled}`);
        }
      }
    }

    // SECURITY: Mark webhook as successfully processed
    await markWebhookProcessed(
      supabase,
      {
        event_id: event.id,
        event_type: event.type,
        source: webhookSource as 'connect' | 'platform',
        raw_event: event as any,
      },
      'success'
    );

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    // SECURITY: Log full details server-side only
    console.error("Webhook error:", errorMessage);

    // SECURITY: Mark webhook as processed with error
    // Note: We only have event info if signature verification succeeded
    try {
      if (event?.id) {
        await markWebhookProcessed(
          supabase,
          {
            event_id: event.id,
            event_type: event.type,
            source: webhookSource as 'connect' | 'platform',
            raw_event: event as any,
          },
          'error',
          errorMessage
        );
      }
    } catch (markError) {
      console.error('Failed to mark webhook as errored:', markError);
    }

    // SECURITY: Return generic error to Stripe — never expose internals
    return new Response(JSON.stringify({ error: "Webhook processing failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
