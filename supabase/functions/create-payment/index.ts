import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PaymentRequest {
  invoice_id: string;
  success_url?: string;
  cancel_url?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      console.error("STRIPE_SECRET_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Payment service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { invoice_id, success_url, cancel_url }: PaymentRequest = await req.json();

    console.log(`Creating payment session for invoice: ${invoice_id}`);

    if (!invoice_id) {
      return new Response(
        JSON.stringify({ error: "Invoice ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch invoice with client info
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("*, clients(*)")
      .eq("id", invoice_id)
      .single();

    if (invoiceError || !invoice) {
      console.error("Invoice not found:", invoiceError);
      return new Response(
        JSON.stringify({ error: "Invoice not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate balance due
    const balance = (invoice.total || 0) - (invoice.amount_paid || 0);
    
    if (balance <= 0) {
      return new Response(
        JSON.stringify({ error: "Invoice is already paid" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch profile for business name and Stripe account
    const { data: profile } = await supabase
      .from("profiles")
      .select("business_name, stripe_account_id, stripe_charges_enabled")
      .eq("user_id", invoice.user_id)
      .single();

    const businessName = profile?.business_name || "TradieMate";
    const baseUrl = success_url?.split('/i/')[0] || 'https://app.tradiemate.com.au';

    // Check if tradie has connected Stripe account
    const stripeAccountId = profile?.stripe_account_id;

    if (!stripeAccountId) {
      console.error("Tradie has not connected Stripe account");
      return new Response(
        JSON.stringify({
          error: "Payment setup incomplete. Please connect your Stripe account in Settings > Payments to accept invoice payments."
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!profile?.stripe_charges_enabled) {
      console.error("Stripe account cannot accept charges yet");
      return new Response(
        JSON.stringify({
          error: "Payment setup incomplete. Please complete your Stripe onboarding to accept payments."
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Creating Checkout session for account: ${stripeAccountId}, balance: $${balance}`);

    // Calculate platform fee: 0.15% of transaction
    const platformFeeAmount = Math.round(balance * 100 * 0.0015); // 0.15% platform fee

    console.log(`Platform fee (0.15%): $${platformFeeAmount / 100}`);

    // Create Stripe Checkout session with direct charges
    // CRITICAL: Uses direct charges to Express Connect account
    // Payment goes directly to tradie's account, platform takes application fee
    // This requires the Connect account to be type "express" (not "standard")
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "aud",
            product_data: {
              name: `Invoice ${invoice.invoice_number}`,
              description: invoice.title || "Invoice payment",
            },
            unit_amount: Math.round(balance * 100), // Stripe uses cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: success_url || `${baseUrl}/i/${invoice_id}?payment=success`,
      cancel_url: cancel_url || `${baseUrl}/i/${invoice_id}?payment=cancelled`,
      customer_email: invoice.clients?.email || undefined,
      metadata: {
        invoice_id: invoice_id,
        invoice_number: invoice.invoice_number,
        business_name: businessName,
      },
      payment_intent_data: {
        application_fee_amount: platformFeeAmount, // 0.15% platform fee
      },
    }, {
      stripeAccount: stripeAccountId, // CRITICAL: Routes payment to tradie's Express account
    });

    console.log(`Stripe session created: ${session.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        session_id: session.id,
        url: session.url,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error creating payment session:", errorMessage);
    console.error("Full error object:", JSON.stringify(error, null, 2));

    // Check if it's a Stripe error with more details
    if (error && typeof error === 'object' && 'type' in error) {
      console.error("Stripe error type:", (error as any).type);
      console.error("Stripe error code:", (error as any).code);
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
