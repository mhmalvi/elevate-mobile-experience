import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface XeroTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

interface XeroConnection {
  id: string;
  tenantId: string;
  tenantType: string;
  tenantName: string;
  createdDateUtc: string;
  updatedDateUtc: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state'); // Contains user session info

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const xeroClientId = Deno.env.get("XERO_CLIENT_ID");
    const xeroClientSecret = Deno.env.get("XERO_CLIENT_SECRET");
    const xeroRedirectUri = Deno.env.get("XERO_REDIRECT_URI") || `${Deno.env.get("APP_URL")}/settings/integrations?xero=success`;

    if (!xeroClientId || !xeroClientSecret) {
      console.error("Xero credentials not configured");
      return new Response(
        JSON.stringify({ error: "Xero integration not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action 1: Initiate OAuth (Get authorization URL)
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

      // Generate state parameter with user ID for callback
      const stateParam = btoa(JSON.stringify({ userId: user.id }));

      const xeroAuthUrl =
        `https://login.xero.com/identity/connect/authorize?` +
        `response_type=code&` +
        `client_id=${xeroClientId}&` +
        `redirect_uri=${encodeURIComponent(xeroRedirectUri)}&` +
        `scope=accounting.transactions accounting.contacts accounting.settings offline_access&` +
        `state=${stateParam}`;

      console.log("Generated Xero auth URL");

      return new Response(
        JSON.stringify({
          success: true,
          authorization_url: xeroAuthUrl
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action 2: Handle OAuth callback (Exchange code for tokens)
    if (action === "callback" && code && state) {
      console.log("Processing Xero OAuth callback");

      // Decode state to get user ID
      let userId: string;
      try {
        const stateData = JSON.parse(atob(state));
        userId = stateData.userId;
      } catch (e) {
        console.error("Invalid state parameter:", e);
        return new Response(
          JSON.stringify({ error: "Invalid state parameter" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Exchange authorization code for tokens
      const basicAuth = btoa(`${xeroClientId}:${xeroClientSecret}`);

      const tokenResponse = await fetch("https://identity.xero.com/connect/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Basic ${basicAuth}`,
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: code,
          redirect_uri: xeroRedirectUri,
        }),
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        console.error("Token exchange failed:", error);
        return new Response(
          JSON.stringify({ error: "Failed to exchange authorization code" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tokens: XeroTokenResponse = await tokenResponse.json();
      console.log("Successfully obtained Xero tokens");

      // Get tenant connections (organizations)
      const connectionsResponse = await fetch("https://api.xero.com/connections", {
        headers: {
          "Authorization": `Bearer ${tokens.access_token}`,
          "Content-Type": "application/json",
        },
      });

      if (!connectionsResponse.ok) {
        console.error("Failed to get Xero connections");
        return new Response(
          JSON.stringify({ error: "Failed to get Xero organization details" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const connections: XeroConnection[] = await connectionsResponse.json();

      if (connections.length === 0) {
        return new Response(
          JSON.stringify({ error: "No Xero organizations found" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Use the first connected organization
      const tenantId = connections[0].tenantId;
      const tenantName = connections[0].tenantName;

      console.log(`Connected to Xero tenant: ${tenantName} (${tenantId})`);

      // Calculate token expiry
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      // Save tokens to database
      // NOTE: In production, these should be encrypted using Supabase Vault or similar
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          xero_tenant_id: tenantId,
          xero_access_token: tokens.access_token, // TODO: Encrypt in production
          xero_refresh_token: tokens.refresh_token, // TODO: Encrypt in production
          xero_token_expires_at: expiresAt,
          xero_sync_enabled: true,
          xero_connected_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (updateError) {
        console.error("Failed to save Xero credentials:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to save Xero credentials" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Xero credentials saved successfully");

      return new Response(
        JSON.stringify({
          success: true,
          tenant_id: tenantId,
          tenant_name: tenantName,
          message: "Successfully connected to Xero",
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

      // Get current refresh token
      const { data: profile } = await supabase
        .from("profiles")
        .select("xero_refresh_token")
        .eq("user_id", user.id)
        .single();

      if (!profile?.xero_refresh_token) {
        return new Response(
          JSON.stringify({ error: "No Xero refresh token found" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Refresh the access token
      const basicAuth = btoa(`${xeroClientId}:${xeroClientSecret}`);

      const refreshResponse = await fetch("https://identity.xero.com/connect/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Basic ${basicAuth}`,
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: profile.xero_refresh_token,
        }),
      });

      if (!refreshResponse.ok) {
        console.error("Token refresh failed");
        return new Response(
          JSON.stringify({ error: "Failed to refresh Xero token" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const newTokens: XeroTokenResponse = await refreshResponse.json();
      const expiresAt = new Date(Date.now() + newTokens.expires_in * 1000).toISOString();

      // Update tokens in database
      await supabase
        .from("profiles")
        .update({
          xero_access_token: newTokens.access_token,
          xero_refresh_token: newTokens.refresh_token,
          xero_token_expires_at: expiresAt,
        })
        .eq("user_id", user.id);

      console.log("Xero token refreshed successfully");

      return new Response(
        JSON.stringify({ success: true, message: "Token refreshed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action 4: Disconnect Xero
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

      // Clear Xero credentials
      await supabase
        .from("profiles")
        .update({
          xero_tenant_id: null,
          xero_access_token: null,
          xero_refresh_token: null,
          xero_token_expires_at: null,
          xero_sync_enabled: false,
        })
        .eq("user_id", user.id);

      console.log("Xero disconnected successfully");

      return new Response(
        JSON.stringify({ success: true, message: "Xero disconnected" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Invalid action
    return new Response(
      JSON.stringify({ error: "Invalid action. Use: connect, callback, refresh, or disconnect" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in Xero OAuth:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
