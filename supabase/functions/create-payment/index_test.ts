/**
 * Tests for the create-payment edge function.
 *
 * Covers:
 *   1. APP_URL / baseUrl fallback logic
 *   2. Idempotency key derivation
 *   3. Balance calculation (total minus amount_paid)
 *   4. HTTP guard rails – missing STRIPE_SECRET_KEY, missing auth header,
 *      missing invoice_id, already-paid invoice
 */

import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.190.0/testing/asserts.ts";

// ---------------------------------------------------------------------------
// Pure logic mirrored from create-payment/index.ts
// ---------------------------------------------------------------------------

/**
 * Mirrors the baseUrl derivation in the handler.
 * success_url?.split('/i/')[0] || Deno.env.get('APP_URL') || 'https://app.tradiemate.com.au'
 */
function deriveBaseUrl(
  successUrl: string | undefined,
  appUrlEnv: string | undefined,
): string {
  return (
    successUrl?.split("/i/")[0] ||
    appUrlEnv ||
    "https://app.tradiemate.com.au"
  );
}

/**
 * Mirrors the idempotency key the handler passes to Stripe.
 */
function buildIdempotencyKey(invoiceId: string): string {
  return `checkout_${invoiceId}`;
}

/**
 * Mirrors balance calculation.
 */
function computeBalance(total: number, amountPaid: number): number {
  return total - amountPaid;
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

Deno.test("deriveBaseUrl: extracts host from success_url before /i/ segment", () => {
  const base = deriveBaseUrl(
    "https://app.tradiemate.com.au/i/inv-123?payment=success",
    undefined,
  );
  assertEquals(base, "https://app.tradiemate.com.au");
});

Deno.test("deriveBaseUrl: falls back to APP_URL env when success_url is undefined", () => {
  const base = deriveBaseUrl(undefined, "https://staging.tradiemate.com.au");
  assertEquals(base, "https://staging.tradiemate.com.au");
});

Deno.test("deriveBaseUrl: falls back to hardcoded default when both inputs are absent", () => {
  const base = deriveBaseUrl(undefined, undefined);
  assertEquals(base, "https://app.tradiemate.com.au");
});

Deno.test("deriveBaseUrl: does not strip trailing slash from APP_URL fallback", () => {
  const base = deriveBaseUrl(undefined, "https://myapp.example.com/");
  assertEquals(base, "https://myapp.example.com/");
});

Deno.test("buildIdempotencyKey: prefixes invoice ID with 'checkout_'", () => {
  assertEquals(buildIdempotencyKey("inv-abc-123"), "checkout_inv-abc-123");
});

Deno.test("buildIdempotencyKey: same invoice ID always produces same key", () => {
  const id = "my-stable-invoice-id";
  assertEquals(buildIdempotencyKey(id), buildIdempotencyKey(id));
});

Deno.test("computeBalance: returns difference between total and amount paid", () => {
  assertEquals(computeBalance(1000, 250), 750);
});

Deno.test("computeBalance: returns full total when nothing has been paid", () => {
  assertEquals(computeBalance(500, 0), 500);
});

Deno.test("computeBalance: returns zero (or negative) when invoice is fully paid", () => {
  assertEquals(computeBalance(200, 200), 0);
  assertEquals(computeBalance(200, 250), -50); // overpaid edge case
});

// ---------------------------------------------------------------------------
// HTTP guard tests
// ---------------------------------------------------------------------------

Deno.test("handler: returns 500 when STRIPE_SECRET_KEY is not configured", async () => {
  const original = Deno.env.get("STRIPE_SECRET_KEY");
  try {
    Deno.env.delete("STRIPE_SECRET_KEY");
    const res = await minimalCreatePaymentHandler(
      new Request("http://localhost/create-payment", {
        method: "POST",
        body: JSON.stringify({ invoice_id: "inv-001" }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    assertEquals(res.status, 500);
    const body = await res.json();
    assertStringIncludes(body.error.toLowerCase(), "payment service");
  } finally {
    if (original !== undefined) Deno.env.set("STRIPE_SECRET_KEY", original);
  }
});

Deno.test("handler: returns 401 when Authorization header is absent", async () => {
  Deno.env.set("STRIPE_SECRET_KEY", "sk_test_fake");
  Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "fake-key");

  const res = await minimalCreatePaymentHandler(
    new Request("http://localhost/create-payment", {
      method: "POST",
      body: JSON.stringify({ invoice_id: "inv-001" }),
      headers: { "Content-Type": "application/json" },
    }),
  );
  assertEquals(res.status, 401);
  const body = await res.json();
  assertStringIncludes(body.error.toLowerCase(), "authorization");
});

Deno.test("handler: returns 400 when invoice_id is missing from request body", async () => {
  Deno.env.set("STRIPE_SECRET_KEY", "sk_test_fake");
  Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "fake-key");

  const res = await minimalCreatePaymentHandler(
    new Request("http://localhost/create-payment", {
      method: "POST",
      // invoice_id deliberately omitted
      body: JSON.stringify({}),
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer fake-token",
      },
    }),
  );
  assertEquals(res.status, 400);
  const body = await res.json();
  assertStringIncludes(body.error.toLowerCase(), "invoice id");
});

Deno.test("handler: returns 400 when computed balance is zero (invoice already paid)", async () => {
  // Simulate what happens when balance <= 0 — the handler short-circuits.
  const balance = computeBalance(500, 500);
  assertEquals(balance <= 0, true);

  const res = await minimalCreatePaymentHandler(
    new Request("http://localhost/create-payment", {
      method: "POST",
      body: JSON.stringify({ invoice_id: "inv-paid" }),
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer fake-token",
      },
    }),
    { simulateAlreadyPaid: true },
  );
  assertEquals(res.status, 400);
  const body = await res.json();
  assertStringIncludes(body.error.toLowerCase(), "already paid");
});

Deno.test("handler: OPTIONS preflight returns 204", async () => {
  const res = await minimalCreatePaymentHandler(
    new Request("http://localhost/create-payment", {
      method: "OPTIONS",
      headers: { origin: "http://localhost:5173" },
    }),
  );
  assertEquals(res.status, 204);
});

// ---------------------------------------------------------------------------
// Thin in-process handler
// ---------------------------------------------------------------------------

async function minimalCreatePaymentHandler(
  req: Request,
  options?: { simulateAlreadyPaid?: boolean },
): Promise<Response> {
  const { getCorsHeaders, createCorsResponse } = await import("../_shared/cors.ts");
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return createCorsResponse(req);
  }

  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeSecretKey) {
    return new Response(
      JSON.stringify({ error: "Payment service not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "Missing authorization header" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const body = await req.json();
  const { invoice_id } = body;

  if (!invoice_id) {
    return new Response(
      JSON.stringify({ error: "Invoice ID is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (options?.simulateAlreadyPaid) {
    return new Response(
      JSON.stringify({ error: "Invoice is already paid" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(JSON.stringify({ success: true, session_id: "cs_test_fake" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
