import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  createOAuthHandler,
  OAuthProviderConfig,
  CallbackContext,
  CallbackHookResult,
} from "../_shared/oauth-provider.ts";

interface XeroConnection {
  id: string;
  tenantId: string;
  tenantType: string;
  tenantName: string;
  createdDateUtc: string;
  updatedDateUtc: string;
}

/**
 * Xero-specific callback hook: fetches the tenant (organization) connections
 * using the freshly obtained access token and returns extra columns/response fields.
 */
async function onXeroCallback(
  ctx: CallbackContext,
): Promise<CallbackHookResult | Response> {
  const connectionsResponse = await fetch("https://api.xero.com/connections", {
    headers: {
      "Authorization": `Bearer ${ctx.tokens.access_token}`,
      "Content-Type": "application/json",
    },
  });

  if (!connectionsResponse.ok) {
    console.error("Failed to get Xero connections");
    return new Response(
      JSON.stringify({ error: "Failed to get Xero organization details" }),
      { status: 500, headers: { ...ctx.corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const connections: XeroConnection[] = await connectionsResponse.json();

  if (connections.length === 0) {
    return new Response(
      JSON.stringify({ error: "No Xero organizations found" }),
      { status: 400, headers: { ...ctx.corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const tenantId = connections[0].tenantId;
  const tenantName = connections[0].tenantName;

  console.log(`Connected to Xero tenant: ${tenantName} (${tenantId})`);

  return {
    extraColumns: { xero_tenant_id: tenantId },
    extraResponseFields: { tenant_id: tenantId, tenant_name: tenantName },
  };
}

const xeroConfig: OAuthProviderConfig = {
  name: "Xero",
  rateLimitAction: "xero-oauth",

  envClientId: "XERO_CLIENT_ID",
  envClientSecret: "XERO_CLIENT_SECRET",
  envRedirectUri: "XERO_REDIRECT_URI",
  defaultRedirectPath: "/settings/integrations?xero=success",

  authorizationUrl: "https://login.xero.com/identity/connect/authorize",
  tokenEndpoint: "https://identity.xero.com/connect/token",
  scopes: "accounting.transactions accounting.contacts accounting.settings offline_access",

  columns: {
    accessToken: "xero_access_token",
    refreshToken: "xero_refresh_token",
    tokenExpiresAt: "xero_token_expires_at",
    syncEnabled: "xero_sync_enabled",
    connectedAt: "xero_connected_at",
    extraIdentifier: "xero_tenant_id",
  },

  onCallback: onXeroCallback,
};

serve(createOAuthHandler(xeroConfig));
