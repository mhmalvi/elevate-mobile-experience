import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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
    let event: Stripe.Event | null = null;
    let webhookSource = "unknown";

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

    // Handle checkout.session.completed event
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const invoiceId = session.metadata?.invoice_id;

      console.log(`Checkout session completed. Invoice ID: ${invoiceId}, Account: ${connectedAccountId || 'platform'}`);

      if (invoiceId) {
        // Get the invoice to check current amount
        const { data: invoice, error: fetchError } = await supabase
          .from("invoices")
          .select("total, amount_paid")
          .eq("id", invoiceId)
          .single();

        if (fetchError) {
          console.error("Error fetching invoice:", fetchError);
          return new Response(JSON.stringify({ error: "Invoice not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Calculate payment amount (Stripe returns amount in cents)
        const paymentAmount = (session.amount_total || 0) / 100;
        const newAmountPaid = (invoice.amount_paid || 0) + paymentAmount;
        const total = invoice.total || 0;
        
        // Determine new status
        const newStatus = newAmountPaid >= total ? "paid" : "partially_paid";

        // Update invoice in database
        const { error: updateError } = await supabase
          .from("invoices")
          .update({
            status: newStatus,
            amount_paid: newAmountPaid,
            paid_at: newStatus === "paid" ? new Date().toISOString() : null,
          })
          .eq("id", invoiceId);

        if (updateError) {
          console.error("Error updating invoice:", updateError);
          return new Response(JSON.stringify({ error: "Failed to update invoice" }), {
            status: 500,
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
                from: "TradieMate <onboarding@resend.dev>",
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
                      <p style="font-size: 18px; color: #10b981; font-weight: bold;">Great news, ${businessName}!</p>
                      <p style="font-size: 16px;">You've received a payment from <strong>${clientName}</strong>.</p>

                      <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
                        <table style="width: 100%; border-collapse: collapse;">
                          <tr>
                            <td style="padding: 8px 0;"><strong>Invoice:</strong></td>
                            <td style="padding: 8px 0; text-align: right;">${invoiceNumber}</td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0;"><strong>Client:</strong></td>
                            <td style="padding: 8px 0; text-align: right;">${clientName}</td>
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
                        Log in to TradieMate to view the complete invoice details.
                      </p>

                      <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                          Powered by TradieMate
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
    if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.user_id;
      const tier = subscription.metadata?.tier_id || 'solo';

      console.log(`Subscription ${event.type}: ${subscription.id}, user: ${userId}, tier: ${tier}`);

      if (userId && subscription.status === 'active') {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            subscription_tier: tier,
            subscription_provider: 'stripe',
            subscription_id: subscription.id,
            subscription_expires_at: new Date(subscription.current_period_end * 1000).toISOString(),
          })
          .eq('user_id', userId);

        if (updateError) {
          console.error('Error updating subscription status:', updateError);
        } else {
          console.log(`Profile updated: user=${userId}, tier=${tier}`);
        }
      }
    }

    // Handle subscription cancellation/deletion
    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.user_id;

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
      }
    }

    // Handle invoice payment succeeded for recurring subscription charges
    if (event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoice.subscription;

      if (subscriptionId) {
        console.log(`Invoice payment succeeded for subscription: ${subscriptionId}`);

        // Fetch the subscription to get metadata
        const subscription = await stripe.subscriptions.retrieve(subscriptionId as string);
        const userId = subscription.metadata?.user_id;
        const tier = subscription.metadata?.tier_id || 'solo';

        if (userId) {
          await supabase
            .from('profiles')
            .update({
              subscription_tier: tier,
              subscription_provider: 'stripe',
              subscription_id: subscription.id,
              subscription_expires_at: new Date(subscription.current_period_end * 1000).toISOString(),
            })
            .eq('user_id', userId);

          console.log(`Subscription renewed: user=${userId}, tier=${tier}`);
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
