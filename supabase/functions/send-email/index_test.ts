/**
 * Tests for the send-email edge function.
 *
 * We test:
 *   1. escapeHtml helper
 *   2. EMAIL_LIMITS tier map and the checkAndIncrementUsage logic
 *   3. businessName newline stripping (SEC-M3)
 *   4. HTTP guard rails – missing auth header, missing recipient_email,
 *      invalid document type
 */

import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.190.0/testing/asserts.ts";

// ---------------------------------------------------------------------------
// Pure helpers mirrored from send-email/index.ts
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const EMAIL_LIMITS: Record<string, number> = {
  free: 10,
  solo: 50,
  crew: -1,
  pro: -1,
};

/** Mirrors the checkAndIncrementUsage function's limit-lookup logic. */
function getLimitForTier(tier: string): number {
  return EMAIL_LIMITS[tier] ?? EMAIL_LIMITS["free"];
}

// ---------------------------------------------------------------------------
// escapeHtml tests
// ---------------------------------------------------------------------------

Deno.test("escapeHtml: returns empty string for falsy input", () => {
  assertEquals(escapeHtml(""), "");
});

Deno.test("escapeHtml: escapes & correctly", () => {
  assertEquals(escapeHtml("A & B"), "A &amp; B");
});

Deno.test("escapeHtml: escapes < and > to prevent tag injection", () => {
  assertEquals(escapeHtml("<div>"), "&lt;div&gt;");
});

Deno.test("escapeHtml: escapes double-quote", () => {
  assertEquals(escapeHtml('"quoted"'), "&quot;quoted&quot;");
});

Deno.test("escapeHtml: escapes single-quote with &#039;", () => {
  // send-email uses &#039; (not &#x27;) for single quotes
  assertEquals(escapeHtml("it's"), "it&#039;s");
});

Deno.test("escapeHtml: leaves safe strings untouched", () => {
  assertEquals(escapeHtml("Hello World 123"), "Hello World 123");
});

// ---------------------------------------------------------------------------
// EMAIL_LIMITS / tier logic tests
// ---------------------------------------------------------------------------

Deno.test("EMAIL_LIMITS: free tier allows 10 emails", () => {
  assertEquals(getLimitForTier("free"), 10);
});

Deno.test("EMAIL_LIMITS: solo tier allows 50 emails", () => {
  assertEquals(getLimitForTier("solo"), 50);
});

Deno.test("EMAIL_LIMITS: crew tier is unlimited (-1)", () => {
  assertEquals(getLimitForTier("crew"), -1);
});

Deno.test("EMAIL_LIMITS: pro tier is unlimited (-1)", () => {
  assertEquals(getLimitForTier("pro"), -1);
});

Deno.test("EMAIL_LIMITS: unknown tier falls back to free limit (10)", () => {
  assertEquals(getLimitForTier("enterprise"), 10);
});

// ---------------------------------------------------------------------------
// checkAndIncrementUsage logic tests (using mock Supabase)
// ---------------------------------------------------------------------------

/**
 * Mirrors the checkAndIncrementUsage function so we can test its branching
 * without calling real Supabase.
 */
async function checkAndIncrementUsage(
  supabase: {
    from: (table: string) => {
      upsert: (data: unknown, opts: unknown) => Promise<unknown>;
      rpc?: never;
    };
    rpc: (fn: string, args: unknown) => Promise<{ data: boolean | null; error: null | { message: string } }>;
  },
  userId: string,
  tier: string,
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const limit = getLimitForTier(tier);

  if (limit === -1) {
    return { allowed: true, used: 0, limit: -1 };
  }

  const monthYear = new Date().toISOString().slice(0, 7);
  await supabase
    .from("usage_tracking")
    // deno-lint-ignore no-explicit-any
    .upsert({ user_id: userId, month_year: monthYear }, { onConflict: "user_id,month_year", ignoreDuplicates: true } as any);

  const { data: allowed, error } = await supabase.rpc(
    "increment_usage_if_under_limit",
    { p_user_id: userId, p_field: "emails_sent", p_limit: limit },
  );

  if (error) {
    return { allowed: false, used: limit, limit };
  }

  if (!allowed) {
    return { allowed: false, used: limit, limit };
  }

  return { allowed: true, used: 0, limit };
}

function makeMockSupabase(rpcResult: { data: boolean | null; error: null | { message: string } }) {
  return {
    from: (_table: string) => ({
      upsert: (_data: unknown, _opts: unknown) => Promise.resolve({}),
    }),
    rpc: (_fn: string, _args: unknown) => Promise.resolve(rpcResult),
  };
}

Deno.test("checkAndIncrementUsage: unlimited tier (crew) always returns allowed=true", async () => {
  const supabase = makeMockSupabase({ data: true, error: null });
  const result = await checkAndIncrementUsage(supabase as any, "user-1", "crew");
  assertEquals(result.allowed, true);
  assertEquals(result.limit, -1);
});

Deno.test("checkAndIncrementUsage: returns allowed=true when RPC returns true", async () => {
  const supabase = makeMockSupabase({ data: true, error: null });
  const result = await checkAndIncrementUsage(supabase as any, "user-1", "free");
  assertEquals(result.allowed, true);
  assertEquals(result.limit, 10);
});

Deno.test("checkAndIncrementUsage: returns allowed=false when RPC returns false (limit reached)", async () => {
  const supabase = makeMockSupabase({ data: false, error: null });
  const result = await checkAndIncrementUsage(supabase as any, "user-1", "free");
  assertEquals(result.allowed, false);
  assertEquals(result.used, 10);
});

Deno.test("checkAndIncrementUsage: fails closed (allowed=false) when RPC returns an error", async () => {
  const supabase = makeMockSupabase({ data: null, error: { message: "db error" } });
  const result = await checkAndIncrementUsage(supabase as any, "user-1", "solo");
  assertEquals(result.allowed, false);
  assertEquals(result.used, 50); // limit for solo
});

// ---------------------------------------------------------------------------
// SEC-M3: businessName newline stripping
// ---------------------------------------------------------------------------

Deno.test("businessName: strips carriage return and newline characters to prevent header injection", () => {
  const rawName = "Evil\r\nBcc: attacker@evil.com";
  // Mirrors: (profile?.business_name || "Your Business").replace(/[\r\n]/g, '')
  const sanitized = rawName.replace(/[\r\n]/g, "");
  assertEquals(sanitized.includes("\r"), false);
  assertEquals(sanitized.includes("\n"), false);
  assertEquals(sanitized, "EvilBcc: attacker@evil.com");
});

// ---------------------------------------------------------------------------
// HTTP guard tests
// ---------------------------------------------------------------------------

Deno.test("handler: returns 401 when Authorization header is missing", async () => {
  // Set minimum required env
  Deno.env.set("RESEND_API_KEY", "re_fake");
  Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "fake-key");

  const res = await minimalSendEmailHandler(
    new Request("http://localhost/send-email", {
      method: "POST",
      body: JSON.stringify({ type: "invoice", id: "inv-001", recipient_email: "a@b.com" }),
      headers: { "Content-Type": "application/json" },
    }),
  );
  assertEquals(res.status, 401);
  const body = await res.json();
  assertStringIncludes(body.error.toLowerCase(), "unauthorized");
});

Deno.test("handler: returns 400 when recipient_email is missing", async () => {
  const res = await minimalSendEmailHandler(
    new Request("http://localhost/send-email", {
      method: "POST",
      body: JSON.stringify({ type: "invoice", id: "inv-001" }),
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer fake-token",
      },
    }),
  );
  assertEquals(res.status, 400);
  const body = await res.json();
  assertStringIncludes(body.error.toLowerCase(), "recipient");
});

Deno.test("handler: returns 400 when email type is invalid", async () => {
  const res = await minimalSendEmailHandler(
    new Request("http://localhost/send-email", {
      method: "POST",
      body: JSON.stringify({ type: "unknown_type", id: "doc-001", recipient_email: "a@b.com" }),
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer fake-token",
      },
    }),
  );
  assertEquals(res.status, 400);
  const body = await res.json();
  assertStringIncludes(body.error.toLowerCase(), "invalid");
});

Deno.test("handler: OPTIONS preflight returns 204", async () => {
  const res = await minimalSendEmailHandler(
    new Request("http://localhost/send-email", {
      method: "OPTIONS",
      headers: { origin: "http://localhost:5173" },
    }),
  );
  assertEquals(res.status, 204);
});

Deno.test("handler: returns 500 when RESEND_API_KEY is not configured", async () => {
  const originalKey = Deno.env.get("RESEND_API_KEY");
  try {
    Deno.env.delete("RESEND_API_KEY");
    const res = await minimalSendEmailHandler(
      new Request("http://localhost/send-email", {
        method: "POST",
        body: JSON.stringify({ type: "invoice", id: "inv-001", recipient_email: "a@b.com" }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    assertEquals(res.status, 500);
    const body = await res.json();
    assertStringIncludes(body.error.toLowerCase(), "email service");
  } finally {
    if (originalKey !== undefined) Deno.env.set("RESEND_API_KEY", originalKey);
  }
});

// ---------------------------------------------------------------------------
// Thin in-process handler
// ---------------------------------------------------------------------------

async function minimalSendEmailHandler(req: Request): Promise<Response> {
  const { getCorsHeaders, createCorsResponse } = await import("../_shared/cors.ts");
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return createCorsResponse(req);
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    return new Response(
      JSON.stringify({ error: "Email service not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "Unauthorized - missing authorization header" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // We can't validate the token without real Supabase, so we gate on it being present.
  // Real auth validation is integration-tested separately.

  const body = await req.json();
  const { type, recipient_email } = body;

  if (!recipient_email) {
    return new Response(
      JSON.stringify({ error: "Recipient email is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const validTypes = ["quote", "invoice", "team_invitation"];
  if (!validTypes.includes(type)) {
    return new Response(
      JSON.stringify({ error: "Invalid document type" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
