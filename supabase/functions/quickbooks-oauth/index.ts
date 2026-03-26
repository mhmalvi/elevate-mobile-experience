import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  createOAuthHandler,
  OAuthProviderConfig,
  CallbackContext,
  CallbackHookResult,
} from "../_shared/oauth-provider.ts";

/**
 * QuickBooks-specific callback hook: validates that realmId was provided
 * in the callback parameters (it comes from Intuit's redirect URL).
 */
async function onQuickBooksCallback(
  ctx: CallbackContext,
): Promise<CallbackHookResult | Response> {
  const realmId = ctx.params.realmId;

  if (!realmId) {
    return new Response(
      JSON.stringify({ error: "Missing realmId from QuickBooks callback" }),
      { status: 400, headers: { ...ctx.corsHeaders, "Content-Type": "application/json" } },
    );
  }

  console.log(`QuickBooks connected: realmId=${realmId}`);

  return {
    extraColumns: { qb_realm_id: realmId },
    extraResponseFields: { realm_id: realmId },
  };
}

const quickbooksConfig: OAuthProviderConfig = {
  name: "QuickBooks",
  rateLimitAction: "quickbooks-oauth",

  envClientId: "QUICKBOOKS_CLIENT_ID",
  envClientSecret: "QUICKBOOKS_CLIENT_SECRET",
  envRedirectUri: "QUICKBOOKS_REDIRECT_URI",
  defaultRedirectPath: "/settings/integrations",

  authorizationUrl: "https://appcenter.intuit.com/connect/oauth2",
  tokenEndpoint: "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
  scopes: "com.intuit.quickbooks.accounting",

  extraTokenHeaders: { "Accept": "application/json" },
  extraStateData: { provider: "quickbooks" },

  columns: {
    accessToken: "qb_access_token",
    refreshToken: "qb_refresh_token",
    tokenExpiresAt: "qb_token_expires_at",
    syncEnabled: "qb_sync_enabled",
    connectedAt: "qb_connected_at",
    extraIdentifier: "qb_realm_id",
    refreshTokenExpiresAt: "qb_refresh_token_expires_at",
  },

  onCallback: onQuickBooksCallback,
};

serve(createOAuthHandler(quickbooksConfig));
