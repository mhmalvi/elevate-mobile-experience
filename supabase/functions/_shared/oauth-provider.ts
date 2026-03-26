/**
 * Shared OAuth Provider Utilities for Edge Functions
 *
 * Extracts common OAuth patterns used by Xero and QuickBooks integrations:
 * - Token exchange (authorization code -> tokens)
 * - Token refresh (refresh_token -> new tokens)
 * - Encrypted token storage in profiles table
 * - Profile disconnect (clear tokens)
 * - Request authentication and rate limiting
 * - Consistent response formatting
 *
 * Each provider supplies a configuration object describing its endpoints,
 * env vars, scopes, and column mappings. The shared logic handles the rest.
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encryptToken, decryptToken } from "./encryption.ts";
import { getCorsHeaders, createCorsResponse } from "./cors.ts";
import { signState, verifyState } from "./oauth-security.ts";
import { checkRateLimit } from "./rate-limit.ts";

// ─── Types ───────────────────────────────────────────────────────────────────

/** Standard token response from an OAuth2 provider */
export interface OAuthTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  /** QuickBooks-specific: refresh token lifetime */
  x_refresh_token_expires_in?: number;
}

/** Configuration that each provider must supply */
export interface OAuthProviderConfig {
  /** Display name for logs, e.g. "Xero" */
  name: string;

  /** Rate-limit action key, e.g. "xero-oauth" */
  rateLimitAction: string;

  /** Environment variable names */
  envClientId: string;
  envClientSecret: string;
  envRedirectUri: string;
  /** Fallback redirect URI path appended to APP_URL if env var is absent */
  defaultRedirectPath: string;

  /** Authorization URL base, e.g. "https://login.xero.com/identity/connect/authorize" */
  authorizationUrl: string;
  /** Token endpoint, e.g. "https://identity.xero.com/connect/token" */
  tokenEndpoint: string;
  /** OAuth scopes string, e.g. "accounting.transactions offline_access" */
  scopes: string;

  /** Extra headers to send on token requests (e.g. QuickBooks needs Accept: application/json) */
  extraTokenHeaders?: Record<string, string>;

  /** Extra data to include in the signed state (e.g. { provider: "quickbooks" }) */
  extraStateData?: Record<string, string>;

  /**
   * Column mapping for the profiles table.
   * Keys are logical names; values are actual column names in the DB.
   */
  columns: {
    accessToken: string;
    refreshToken: string;
    tokenExpiresAt: string;
    syncEnabled: string;
    connectedAt: string;
    /** Additional columns to clear on disconnect (e.g. tenant_id, realm_id) */
    extraIdentifier?: string;
    /** QuickBooks-specific: refresh token expiry column */
    refreshTokenExpiresAt?: string;
  };

  /**
   * Provider-specific callback hook. Called after tokens are obtained during the
   * callback action, before storing to the database. Allows the provider to
   * fetch additional data (e.g. Xero tenant, QuickBooks realmId) and return
   * extra columns to save and extra response fields.
   *
   * Return null to signal an error (the hook should return an error Response).
   */
  onCallback?: (ctx: CallbackContext) => Promise<CallbackHookResult | Response>;
}

export interface CallbackContext {
  tokens: OAuthTokenResponse;
  userId: string;
  corsHeaders: Record<string, string>;
  /** Parsed request params (from URL + body) */
  params: Record<string, string | null>;
}

export interface CallbackHookResult {
  /** Extra columns to write to the profiles table */
  extraColumns: Record<string, unknown>;
  /** Extra fields to include in the success response */
  extraResponseFields?: Record<string, unknown>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function jsonHeaders(corsHeaders: Record<string, string>): Record<string, string> {
  return { ...corsHeaders, "Content-Type": "application/json" };
}

function errorResponse(
  corsHeaders: Record<string, string>,
  error: string,
  status: number = 400,
  extra?: Record<string, unknown>,
): Response {
  return new Response(
    JSON.stringify({ error, ...extra }),
    { status, headers: jsonHeaders(corsHeaders) },
  );
}

function successResponse(
  corsHeaders: Record<string, string>,
  data: Record<string, unknown>,
): Response {
  return new Response(
    JSON.stringify({ success: true, ...data }),
    { headers: jsonHeaders(corsHeaders) },
  );
}

/** Parse action/code/state and any extra params from URL query + POST body */
async function parseParams(req: Request): Promise<Record<string, string | null>> {
  const url = new URL(req.url);
  const params: Record<string, string | null> = {
    action: url.searchParams.get("action"),
    code: url.searchParams.get("code"),
    state: url.searchParams.get("state"),
  };

  // Capture all query params (e.g. realmId for QuickBooks)
  for (const [key, value] of url.searchParams.entries()) {
    if (!(key in params)) {
      params[key] = value;
    }
  }

  if (req.method === "POST") {
    try {
      const body = await req.json();
      for (const [key, value] of Object.entries(body)) {
        if (typeof value === "string" || value === null) {
          params[key] = (value as string) || params[key];
        }
      }
    } catch {
      // Body parsing failed, continue with URL params
    }
  }

  return params;
}

/** Authenticate the user from the Authorization header */
async function authenticateUser(
  req: Request,
  supabase: SupabaseClient,
  corsHeaders: Record<string, string>,
): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return errorResponse(corsHeaders, "Missing authorization header", 401);
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(
    authHeader.replace("Bearer ", ""),
  );

  if (authError || !user) {
    return errorResponse(corsHeaders, "Unauthorized", 401);
  }

  return { userId: user.id };
}

/** Check rate limit; returns a Response if limited, null otherwise */
async function enforceRateLimit(
  supabase: SupabaseClient,
  userId: string,
  action: string,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  const rateLimit = await checkRateLimit(supabase, userId, action, 10, 60);
  if (rateLimit.limited) {
    return errorResponse(corsHeaders, "Too many requests. Please try again later.", 429);
  }
  return null;
}

/** Exchange an authorization code for tokens at the provider's token endpoint */
export async function exchangeCodeForTokens(
  config: OAuthProviderConfig,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  code: string,
): Promise<{ ok: true; tokens: OAuthTokenResponse } | { ok: false; error: string }> {
  const basicAuth = btoa(`${clientId}:${clientSecret}`);

  const response = await fetch(config.tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${basicAuth}`,
      ...config.extraTokenHeaders,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`${config.name} token exchange failed:`, errorText);
    return { ok: false, error: "Failed to exchange authorization code" };
  }

  const tokens: OAuthTokenResponse = await response.json();
  return { ok: true, tokens };
}

/** Refresh an access token using a refresh token */
export async function refreshAccessToken(
  config: OAuthProviderConfig,
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<{ ok: true; tokens: OAuthTokenResponse } | { ok: false; error: string }> {
  const basicAuth = btoa(`${clientId}:${clientSecret}`);

  const response = await fetch(config.tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${basicAuth}`,
      ...config.extraTokenHeaders,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    console.error(`${config.name} token refresh failed`);
    return { ok: false, error: `Failed to refresh ${config.name} token` };
  }

  const tokens: OAuthTokenResponse = await response.json();
  return { ok: true, tokens };
}

/** Encrypt and store tokens in the profiles table */
export async function storeEncryptedTokens(
  supabase: SupabaseClient,
  userId: string,
  config: OAuthProviderConfig,
  tokens: OAuthTokenResponse,
  extraColumns?: Record<string, unknown>,
): Promise<{ error: string | null }> {
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  const encryptedAccessToken = await encryptToken(tokens.access_token);
  const encryptedRefreshToken = await encryptToken(tokens.refresh_token);

  const updateData: Record<string, unknown> = {
    [config.columns.accessToken]: encryptedAccessToken,
    [config.columns.refreshToken]: encryptedRefreshToken,
    [config.columns.tokenExpiresAt]: expiresAt,
    ...extraColumns,
  };

  // Handle refresh token expiry for providers that supply it (e.g. QuickBooks)
  if (config.columns.refreshTokenExpiresAt && tokens.x_refresh_token_expires_in) {
    updateData[config.columns.refreshTokenExpiresAt] = new Date(
      Date.now() + tokens.x_refresh_token_expires_in * 1000,
    ).toISOString();
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update(updateData)
    .eq("user_id", userId);

  if (updateError) {
    console.error(`Failed to save ${config.name} credentials:`, updateError);
    return { error: `Failed to save ${config.name} credentials` };
  }

  return { error: null };
}

// ─── Main Handler ────────────────────────────────────────────────────────────

/**
 * Creates a Deno serve handler for an OAuth provider.
 * Call this from each provider's index.ts with the appropriate config.
 */
export function createOAuthHandler(config: OAuthProviderConfig) {
  return async (req: Request): Promise<Response> => {
    const corsHeaders = getCorsHeaders(req);

    if (req.method === "OPTIONS") {
      return createCorsResponse(req);
    }

    try {
      const params = await parseParams(req);
      const action = params.action;

      // Initialize Supabase client
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Load provider credentials
      const clientId = Deno.env.get(config.envClientId);
      const clientSecret = Deno.env.get(config.envClientSecret);
      const redirectUri = Deno.env.get(config.envRedirectUri) ||
        `${Deno.env.get("APP_URL")}${config.defaultRedirectPath}`;

      if (!clientId || !clientSecret) {
        console.error(`${config.name} credentials not configured`);
        return errorResponse(corsHeaders, `${config.name} integration not configured`, 500);
      }

      // ── Action: connect ──────────────────────────────────────────────
      if (action === "connect") {
        const authResult = await authenticateUser(req, supabase, corsHeaders);
        if (authResult instanceof Response) return authResult;

        const rateLimited = await enforceRateLimit(supabase, authResult.userId, config.rateLimitAction, corsHeaders);
        if (rateLimited) return rateLimited;

        const stateParam = await signState({
          userId: authResult.userId,
          ...config.extraStateData,
        });

        const authorizationUrl =
          `${config.authorizationUrl}?` +
          `response_type=code&` +
          `client_id=${clientId}&` +
          `redirect_uri=${encodeURIComponent(redirectUri)}&` +
          `scope=${config.scopes}&` +
          `state=${stateParam}`;

        console.log(`Generated ${config.name} auth URL`);

        return successResponse(corsHeaders, { authorization_url: authorizationUrl });
      }

      // ── Action: callback ─────────────────────────────────────────────
      if (action === "callback" && params.code && params.state) {
        console.log(`Processing ${config.name} OAuth callback`);

        const stateVerification = await verifyState(params.state);
        if (!stateVerification.valid) {
          console.error("State verification failed:", stateVerification.error);
          return errorResponse(
            corsHeaders,
            "Invalid or expired OAuth state",
            403,
            { details: stateVerification.error },
          );
        }

        const userId = stateVerification.data!.userId;

        const rateLimited = await enforceRateLimit(supabase, userId, config.rateLimitAction, corsHeaders);
        if (rateLimited) return rateLimited;

        // Exchange code for tokens
        const tokenResult = await exchangeCodeForTokens(config, clientId, clientSecret, redirectUri, params.code);
        if (!tokenResult.ok) {
          return errorResponse(corsHeaders, tokenResult.error, 500);
        }

        console.log(`Successfully obtained ${config.name} tokens`);

        // Run provider-specific callback hook (e.g. fetch Xero tenant, validate QB realmId)
        let extraColumns: Record<string, unknown> = {};
        let extraResponseFields: Record<string, unknown> = {};

        if (config.onCallback) {
          const hookResult = await config.onCallback({
            tokens: tokenResult.tokens,
            userId,
            corsHeaders,
            params,
          });

          // If the hook returned a Response, it's an error — pass it through
          if (hookResult instanceof Response) {
            return hookResult;
          }

          extraColumns = hookResult.extraColumns;
          extraResponseFields = hookResult.extraResponseFields || {};
        }

        // Store encrypted tokens + connection metadata
        const storeResult = await storeEncryptedTokens(supabase, userId, config, tokenResult.tokens, {
          [config.columns.syncEnabled]: true,
          [config.columns.connectedAt]: new Date().toISOString(),
          ...extraColumns,
        });

        if (storeResult.error) {
          return errorResponse(corsHeaders, storeResult.error, 500);
        }

        console.log(`${config.name} credentials saved successfully`);

        return successResponse(corsHeaders, {
          message: `Successfully connected to ${config.name}`,
          ...extraResponseFields,
        });
      }

      // ── Action: refresh ──────────────────────────────────────────────
      if (action === "refresh") {
        const authResult = await authenticateUser(req, supabase, corsHeaders);
        if (authResult instanceof Response) return authResult;

        const rateLimited = await enforceRateLimit(supabase, authResult.userId, config.rateLimitAction, corsHeaders);
        if (rateLimited) return rateLimited;

        // Fetch current encrypted refresh token
        const { data: profile } = await supabase
          .from("profiles")
          .select(config.columns.refreshToken)
          .eq("user_id", authResult.userId)
          .single();

        const encryptedRefreshToken = profile?.[config.columns.refreshToken];
        if (!encryptedRefreshToken) {
          return errorResponse(corsHeaders, `No ${config.name} refresh token found`, 400);
        }

        const decryptedRefreshToken = await decryptToken(encryptedRefreshToken);

        const refreshResult = await refreshAccessToken(config, clientId, clientSecret, decryptedRefreshToken);
        if (!refreshResult.ok) {
          return errorResponse(corsHeaders, refreshResult.error, 500);
        }

        const newTokens = refreshResult.tokens;

        // For providers that may not return a new refresh token, keep the existing one
        const effectiveRefreshToken = newTokens.refresh_token || decryptedRefreshToken;
        const tokensToStore: OAuthTokenResponse = {
          ...newTokens,
          refresh_token: effectiveRefreshToken,
        };

        const storeResult = await storeEncryptedTokens(supabase, authResult.userId, config, tokensToStore);
        if (storeResult.error) {
          return errorResponse(corsHeaders, storeResult.error, 500);
        }

        console.log(`${config.name} token refreshed successfully`);

        return successResponse(corsHeaders, { message: "Token refreshed" });
      }

      // ── Action: disconnect ───────────────────────────────────────────
      if (action === "disconnect") {
        const authResult = await authenticateUser(req, supabase, corsHeaders);
        if (authResult instanceof Response) return authResult;

        const rateLimited = await enforceRateLimit(supabase, authResult.userId, config.rateLimitAction, corsHeaders);
        if (rateLimited) return rateLimited;

        const clearData: Record<string, unknown> = {
          [config.columns.accessToken]: null,
          [config.columns.refreshToken]: null,
          [config.columns.tokenExpiresAt]: null,
          [config.columns.syncEnabled]: false,
        };

        if (config.columns.extraIdentifier) {
          clearData[config.columns.extraIdentifier] = null;
        }

        if (config.columns.refreshTokenExpiresAt) {
          clearData[config.columns.refreshTokenExpiresAt] = null;
        }

        await supabase
          .from("profiles")
          .update(clearData)
          .eq("user_id", authResult.userId);

        console.log(`${config.name} disconnected successfully`);

        return successResponse(corsHeaders, { message: `${config.name} disconnected` });
      }

      // ── Invalid action ───────────────────────────────────────────────
      return errorResponse(
        corsHeaders,
        "Invalid action. Use: connect, callback, refresh, or disconnect",
        400,
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`Error in ${config.name} OAuth:`, errorMessage);
      return errorResponse(corsHeaders, "OAuth operation failed", 500);
    }
  };
}
