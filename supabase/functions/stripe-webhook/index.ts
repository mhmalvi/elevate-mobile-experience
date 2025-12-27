import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

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
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!stripeSecretKey || !webhookSecret) {
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

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error("Webhook signature verification failed:", errorMessage);
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Received Stripe event: ${event.type}`);

    // Handle checkout.session.completed event
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const invoiceId = session.metadata?.invoice_id;

      console.log(`Checkout session completed. Invoice ID: ${invoiceId}`);

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
      } else {
        console.log("No invoice_id in session metadata");
      }
    }

    // Handle payment_intent.succeeded for additional safety
    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.log(`Payment intent succeeded: ${paymentIntent.id}, amount: ${paymentIntent.amount / 100}`);
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
