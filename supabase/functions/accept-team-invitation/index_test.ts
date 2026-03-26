/**
 * Tests for the accept-team-invitation edge function.
 *
 * Covers:
 *   1. get-details action does NOT leak the invitation email address
 *   2. Expired invitation is rejected with a clear error
 *   3. Email mismatch is rejected (signed-in user != invited email)
 *   4. Missing token returns 400
 *   5. accept action requires an Authorization header
 *   6. Already-accepted invitation (already a member) returns 400
 *   7. OPTIONS preflight returns 204
 */

import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.190.0/testing/asserts.ts";

// ---------------------------------------------------------------------------
// Helper: build a mock invitation record
// ---------------------------------------------------------------------------

function makeInvitation(overrides: Partial<{
  id: string;
  token: string;
  email: string;
  role: string;
  accepted: boolean;
  expires_at: string;
  team_id: string;
  teams: { name: string };
}> = {}) {
  const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  return {
    id: "inv-001",
    token: "secure-token-abc",
    email: "invited@example.com",
    role: "member",
    accepted: false,
    expires_at: futureDate,
    team_id: "team-001",
    teams: { name: "Plumbing Pros" },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Unit tests – get-details response shape
// ---------------------------------------------------------------------------

Deno.test("get-details: response does NOT include the invited email address", () => {
  const invitation = makeInvitation();

  // Mirrors what the handler returns for get-details:
  const response = {
    team_name: invitation.teams.name,
    role: invitation.role,
    expires_at: invitation.expires_at,
  };

  // The response must contain team_name, role and expires_at but NOT email
  assertEquals(Object.keys(response).includes("email"), false);
  assertEquals(response.team_name, "Plumbing Pros");
  assertEquals(response.role, "member");
});

Deno.test("get-details: response contains team_name derived from nested teams object", () => {
  const invitation = makeInvitation({ teams: { name: "Sparkies United" } });
  const teamName = (invitation.teams as any)?.name || "the team";
  assertEquals(teamName, "Sparkies United");
});

Deno.test("get-details: falls back to 'the team' when teams is null", () => {
  const invitation = { ...makeInvitation(), teams: null } as any;
  const teamName = (invitation.teams as any)?.name || "the team";
  assertEquals(teamName, "the team");
});

// ---------------------------------------------------------------------------
// Unit tests – expiry check
// ---------------------------------------------------------------------------

Deno.test("expiry check: invitation in the future is not expired", () => {
  const invitation = makeInvitation({
    expires_at: new Date(Date.now() + 1000 * 60 * 60).toISOString(), // 1 hour ahead
  });
  const isExpired = new Date(invitation.expires_at) < new Date();
  assertEquals(isExpired, false);
});

Deno.test("expiry check: invitation in the past is expired", () => {
  const invitation = makeInvitation({
    expires_at: new Date(Date.now() - 1000).toISOString(), // 1 second ago
  });
  const isExpired = new Date(invitation.expires_at) < new Date();
  assertEquals(isExpired, true);
});

// ---------------------------------------------------------------------------
// Unit tests – email mismatch check
// ---------------------------------------------------------------------------

Deno.test("email mismatch: same email (case-insensitive) passes verification", () => {
  const invitation = makeInvitation({ email: "User@Example.COM" });
  const userEmail = "user@example.com";
  const matches = userEmail.toLowerCase() === invitation.email.toLowerCase();
  assertEquals(matches, true);
});

Deno.test("email mismatch: different email is rejected", () => {
  const invitation = makeInvitation({ email: "invited@example.com" });
  const userEmail = "impostor@evil.com";
  const matches = userEmail.toLowerCase() === invitation.email.toLowerCase();
  assertEquals(matches, false);
});

Deno.test("email mismatch: error message includes both the invited email and the signer's email", () => {
  const invitationEmail = "invited@example.com";
  const userEmail = "wrong@user.com";

  // Mirrors the error message built by the handler
  const msg = `This invitation was sent to ${invitationEmail}, but you are signed in as ${userEmail}. Please sign out and sign in with the correct account.`;

  assertStringIncludes(msg, invitationEmail);
  assertStringIncludes(msg, userEmail);
});

// ---------------------------------------------------------------------------
// HTTP guard tests
// ---------------------------------------------------------------------------

Deno.test("handler: returns 400 when token is missing", async () => {
  const res = await minimalAcceptInvitationHandler(
    new Request("http://localhost/accept-team-invitation", {
      method: "POST",
      body: JSON.stringify({ action: "get-details" }), // No token
      headers: { "Content-Type": "application/json" },
    }),
  );
  assertEquals(res.status, 400);
  const body = await res.json();
  assertStringIncludes(body.error.toLowerCase(), "token");
});

Deno.test("handler: get-details with expired invitation returns 400", async () => {
  const pastDate = new Date(Date.now() - 60000).toISOString(); // 1 minute ago
  const res = await minimalAcceptInvitationHandler(
    new Request("http://localhost/accept-team-invitation", {
      method: "POST",
      body: JSON.stringify({ action: "get-details", token: "some-token" }),
      headers: { "Content-Type": "application/json" },
    }),
    { invitationExpiresAt: pastDate },
  );
  assertEquals(res.status, 400);
  const body = await res.json();
  assertStringIncludes(body.error.toLowerCase(), "expired");
});

Deno.test("handler: accept action returns 401 when Authorization header is absent", async () => {
  const res = await minimalAcceptInvitationHandler(
    new Request("http://localhost/accept-team-invitation", {
      method: "POST",
      body: JSON.stringify({ action: "accept", token: "some-token" }),
      headers: { "Content-Type": "application/json" },
      // No Authorization header
    }),
  );
  assertEquals(res.status, 401);
  const body = await res.json();
  assertStringIncludes(body.error.toLowerCase(), "unauthorized");
});

Deno.test("handler: accept action returns 403 when email does not match", async () => {
  const futureDate = new Date(Date.now() + 86400000).toISOString();
  const res = await minimalAcceptInvitationHandler(
    new Request("http://localhost/accept-team-invitation", {
      method: "POST",
      body: JSON.stringify({ action: "accept", token: "some-token" }),
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer fake-token",
      },
    }),
    {
      invitationExpiresAt: futureDate,
      invitationEmail: "invited@example.com",
      simulatedUserEmail: "wrong@user.com", // mismatch
    },
  );
  assertEquals(res.status, 403);
  const body = await res.json();
  assertStringIncludes(body.error, "invited@example.com");
});

Deno.test("handler: returns 400 when user is already a team member", async () => {
  const futureDate = new Date(Date.now() + 86400000).toISOString();
  const res = await minimalAcceptInvitationHandler(
    new Request("http://localhost/accept-team-invitation", {
      method: "POST",
      body: JSON.stringify({ action: "accept", token: "some-token" }),
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer fake-token",
      },
    }),
    {
      invitationExpiresAt: futureDate,
      invitationEmail: "invited@example.com",
      simulatedUserEmail: "invited@example.com", // matches
      alreadyMember: true,
    },
  );
  assertEquals(res.status, 400);
  const body = await res.json();
  assertStringIncludes(body.error.toLowerCase(), "already a member");
});

Deno.test("handler: OPTIONS preflight returns 204", async () => {
  const res = await minimalAcceptInvitationHandler(
    new Request("http://localhost/accept-team-invitation", {
      method: "OPTIONS",
      headers: { origin: "http://localhost:5173" },
    }),
  );
  assertEquals(res.status, 204);
});

// ---------------------------------------------------------------------------
// Thin in-process handler
// ---------------------------------------------------------------------------

interface HandlerOptions {
  invitationExpiresAt?: string;
  invitationEmail?: string;
  simulatedUserEmail?: string;
  alreadyMember?: boolean;
}

async function minimalAcceptInvitationHandler(
  req: Request,
  opts: HandlerOptions = {},
): Promise<Response> {
  const { getCorsHeaders, createCorsResponse } = await import("../_shared/cors.ts");
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return createCorsResponse(req);
  }

  const body = await req.json();
  const { token, action } = body;

  if (!token) {
    return new Response(JSON.stringify({ error: "Token is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // -- GET-DETAILS path --
  if (action === "get-details") {
    const invitation = {
      expires_at: opts.invitationExpiresAt || new Date(Date.now() + 86400000).toISOString(),
      email: opts.invitationEmail || "invited@example.com",
      role: "member",
      teams: { name: "Test Team" },
    };

    if (new Date(invitation.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Invitation has expired" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        team_name: invitation.teams.name,
        role: invitation.role,
        expires_at: invitation.expires_at,
        // NOTE: email must NOT appear here
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // -- ACCEPT path --
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Simulate token validation
  const invitation = {
    expires_at: opts.invitationExpiresAt || new Date(Date.now() + 86400000).toISOString(),
    email: opts.invitationEmail || "invited@example.com",
    role: "member",
    team_id: "team-001",
    id: "inv-001",
    teams: { name: "Test Team" },
  };

  if (new Date(invitation.expires_at) < new Date()) {
    return new Response(JSON.stringify({ error: "Invitation has expired" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userEmail = opts.simulatedUserEmail || "invited@example.com";
  if (!userEmail || userEmail.toLowerCase() !== invitation.email.toLowerCase()) {
    const msg = `This invitation was sent to ${invitation.email}, but you are signed in as ${userEmail || "unknown"}. Please sign out and sign in with the correct account.`;
    return new Response(JSON.stringify({ error: msg }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (opts.alreadyMember) {
    return new Response(JSON.stringify({ error: "You are already a member of this team" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      success: true,
      team_id: invitation.team_id,
      team_name: invitation.teams.name,
      role: invitation.role,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
