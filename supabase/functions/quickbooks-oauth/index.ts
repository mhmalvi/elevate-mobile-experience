import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encryptToken, decryptToken } from "../_shared/encryption.ts";
import { getCorsHeaders, createCorsResponse } from "../_shared/cors.ts";
import { signState, verifyState } from "../_shared/oauth-security.ts";

interface QBTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  x_refresh_token_expires_in: number;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return createCorsResponse(req);
  }

  try {
    const url = new URL(req.url);
    let action = url.searchParams.get("action");
    let code = url.searchParams.get("code");
    let state = url.searchParams.get("state");
    let realmId = url.searchParams.get("realmId");

    if (req.method === "POST") {
      try {
        const body = await req.json();
        action = body.action || action;
        code = body.code || code;
        state = body.state || state;
        realmId = body.realmId || realmId;
      } catch {
        // Body parsing failed, continue with URL params
      }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const qbClientId = Deno.env.get("QUICKBOOKS_CLIENT_ID");
    const qbClientSecret = Deno.env.get("QUICKBOOKS_CLIENT_SECRET");
    const qbRedirectUri = Deno.env.get("QUICKBOOKS_REDIRECT_URI") ||
      `${Deno.env.get("APP_URL")}/settings/integrations`;

    if (!qbClientId || !qbClientSecret) {
      console.error("QuickBooks credentials not configured");
      return new Response(
        JSON.stringify({ error: "QuickBooks integration not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action 1: Initiate OAuth
    if (action === "connect") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: "Missing authorization header" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser(
        authHeader.replace("Bearer ", "")
      );

      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const stateParam = await signState({ userId: user.id, provider: "quickbooks" });

      const qbAuthUrl =
        `https://appcenter.intuit.com/connect/oauth2?` +
        `response_type=code&` +
        `client_id=${qbClientId}&` +
        `redirect_uri=${encodeURIComponent(qbRedirectUri)}&` +
        `scope=com.intuit.quickbooks.accounting&` +
        `state=${stateParam}`;

      console.log("Generated QuickBooks auth URL");

      return new Response(
        JSON.stringify({ success: true, url: qbAuthUrl }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action 2: Handle OAuth callback
    if (action === "callback" && code && state) {
      console.log("Processing QuickBooks OAuth callback");

      const stateVerification = await verifyState(state);

      if (!stateVerification.valid) {
        console.error("State verification failed:", stateVerification.error);
        return new Response(
          JSON.stringify({ error: "Invalid or expired OAuth state", details: stateVerification.error }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const userId = stateVerification.data!.userId;

      // Exchange authorization code for tokens
      const basicAuth = btoa(`${qbClientId}:${qbClientSecret}`);

      const tokenResponse = await fetch(
        "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": `Basic ${basicAuth}`,
            "Accept": "application/json",
          },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code: code,
            redirect_uri: qbRedirectUri,
          }),
        }
      );

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        console.error("Token exchange failed:", error);
        return new Response(
          JSON.stringify({ error: "Failed to exchange authorization code" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tokens: QBTokenResponse = await tokenResponse.json();
      console.log("Successfully obtained QuickBooks tokens");

      // realmId comes from the callback URL parameters
      if (!realmId) {
        return new Response(
          JSON.stringify({ error: "Missing realmId from QuickBooks callback" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      // Encrypt tokens before storage
      const encryptedAccessToken = await encryptToken(tokens.access_token);
      const encryptedRefreshToken = await encryptToken(tokens.refresh_token);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          qb_realm_id: realmId,
          qb_access_token: encryptedAccessToken,
          qb_refresh_token: encryptedRefreshToken,
          qb_token_expires_at: expiresAt,
          qb_sync_enabled: true,
          qb_connected_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (updateError) {
        console.error("Failed to save QuickBooks credentials:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to save QuickBooks credentials" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`QuickBooks connected: realmId=${realmId}`);

      return new Response(
        JSON.stringify({
          success: true,
          realm_id: realmId,
          message: "Successfully connected to QuickBooks",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action 3: Refresh access token
    if (action === "refresh") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: "Missing authorization header" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser(
        authHeader.replace("Bearer ", "")
      );

      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("qb_refresh_token")
        .eq("user_id", user.id)
        .single();

      if (!profile?.qb_refresh_token) {
        return new Response(
          JSON.stringify({ error: "No QuickBooks refresh token found" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const basicAuth = btoa(`${qbClientId}:${qbClientSecret}`);
      const decryptedRefreshToken = await decryptToken(profile.qb_refresh_token);

      const refreshResponse = await fetch(
        "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": `Basic ${basicAuth}`,
            "Accept": "application/json",
          },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: decryptedRefreshToken,
          }),
        }
      );

      if (!refreshResponse.ok) {
        console.error("QuickBooks token refresh failed");
        return new Response(
          JSON.stringify({ error: "Failed to refresh QuickBooks token" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const newTokens: QBTokenResponse = await refreshResponse.json();
      const expiresAt = new Date(Date.now() + newTokens.expires_in * 1000).toISOString();

      const encryptedNewAccessToken = await encryptToken(newTokens.access_token);
      const encryptedNewRefreshToken = await encryptToken(newTokens.refresh_token);

      await supabase
        .from("profiles")
        .update({
          qb_access_token: encryptedNewAccessToken,
          qb_refresh_token: encryptedNewRefreshToken,
          qb_token_expires_at: expiresAt,
        })
        .eq("user_id", user.id);

      console.log("QuickBooks token refreshed successfully");

      return new Response(
        JSON.stringify({ success: true, message: "Token refreshed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action 4: Disconnect
    if (action === "disconnect") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: "Missing authorization header" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser(
        authHeader.replace("Bearer ", "")
      );

      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabase
        .from("profiles")
        .update({
          qb_realm_id: null,
          qb_access_token: null,
          qb_refresh_token: null,
          qb_token_expires_at: null,
          qb_sync_enabled: false,
        })
        .eq("user_id", user.id);

      console.log("QuickBooks disconnected successfully");

      return new Response(
        JSON.stringify({ success: true, message: "QuickBooks disconnected" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use: connect, callback, refresh, or disconnect" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in QuickBooks OAuth:", errorMessage);
    return new Response(
      JSON.stringify({ error: "OAuth operation failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
