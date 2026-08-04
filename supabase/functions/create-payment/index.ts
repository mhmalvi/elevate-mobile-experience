import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, createCorsResponse, createErrorResponse } from "../_shared/cors.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";

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

    // Rate limit: max 10 payment sessions per minute per user
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
      if (user) {
        const rl = await checkRateLimit(supabase, user.id, "create-payment", 10, 60);
        if (rl.limited) {
          return new Response(
            JSON.stringify({ error: "Too many requests. Please try again later." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" } }
          );
        }
      }
    }

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

    // Fetch profile for business name and billing currency
    const { data: profile } = await supabase
      .from("profiles")
      .select("business_name, currency_code")
      .eq("user_id", invoice.user_id)
      .single();

    const businessName = profile?.business_name || "Your Business";

    // Charge in the currency the business actually invoices in.
    //
    // This was hardcoded to "aud", so a UK plumber invoicing £500 had their
    // client charged AUD 500 — the wrong amount, in the wrong currency, with an
    // FX conversion nobody agreed to. Falls back to AUD only when the profile
    // has no currency set, which preserves behaviour for existing accounts.
    const currency = (profile?.currency_code || "AUD").toLowerCase();

    // Stripe expects the minor unit. Most currencies have 2 decimal places, but
    // zero-decimal currencies (JPY, KRW, VND…) must NOT be multiplied by 100 or
    // the customer is charged 100x. Three-decimal currencies round to 0 too.
    const ZERO_DECIMAL = new Set([
      "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw",
      "mga", "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf",
    ]);
    const unitAmount = ZERO_DECIMAL.has(currency)
      ? Math.round(balance)
      : Math.round(balance * 100);
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
            currency,
            product_data: {
              name: `Invoice ${invoice.invoice_number}`,
              description: invoice.title || "Invoice payment",
            },
            unit_amount: unitAmount,
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
    // SECURITY: Log full details server-side only
    console.error("Error creating payment session:", errorMessage);
    if (error && typeof error === 'object' && 'type' in error) {
      console.error("Stripe error type:", (error as any).type);
      console.error("Stripe error code:", (error as any).code);
    }

    // SECURITY: Return generic message to client — never expose raw error details
    return new Response(
      JSON.stringify({ error: "Failed to create payment session. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
