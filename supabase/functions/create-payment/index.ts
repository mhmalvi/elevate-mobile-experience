import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, createCorsResponse, createErrorResponse } from "../_shared/cors.ts";

interface PaymentRequest {
  invoice_id: string;
  success_url?: string;
  cancel_url?: string;
}

serve(async (req) => {
  // SECURITY: Get secure CORS headers
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return createCorsResponse(req);
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

    // Fetch profile for business name only (no Stripe Connect required)
    const { data: profile } = await supabase
      .from("profiles")
      .select("business_name")
      .eq("user_id", invoice.user_id)
      .single();

    const businessName = profile?.business_name || "Your Business";
    const baseUrl = success_url?.split('/i/')[0] || Deno.env.get('APP_URL') || 'https://elevate-mobile-experience.vercel.app';

    console.log(`Creating Checkout session for platform account, invoice: ${invoice.invoice_number}, balance: $${balance}`);

    // ✅ PLATFORM MODEL - Payments go directly to YOUR Stripe account
    // No Stripe Connect required - tradies don't need to connect their own accounts
    // You receive full payment (minus Stripe's 2.9% + $0.30 processing fee)
    // You can then pay tradies manually via bank transfer or automate later
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
        user_id: invoice.user_id, // Track which tradie this payment is for
      },
      // ✅ No application_fee_amount, no stripeAccount
      // Payment goes directly to platform's Stripe account
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
