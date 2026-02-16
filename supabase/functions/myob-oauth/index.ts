import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createCorsResponse, getCorsHeaders } from "../_shared/cors.ts";
import { encryptToken, decryptToken } from "../_shared/encryption.ts";
import { signState, verifyState } from "../_shared/oauth-security.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";

const MYOB_CLIENT_ID = Deno.env.get("MYOB_CLIENT_ID")!;
const MYOB_CLIENT_SECRET = Deno.env.get("MYOB_CLIENT_SECRET")!;
const MYOB_REDIRECT_URI = Deno.env.get("MYOB_REDIRECT_URI")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === "OPTIONS") {
        return createCorsResponse(req);
    }

    const corsHeaders = getCorsHeaders(req);

    try {
        // Read action from request body (frontend sends via supabase.functions.invoke)
        // Fall back to query params for direct OAuth redirects
        let action: string | null = null;
        let bodyData: any = {};

        if (req.method === "POST") {
            try {
                bodyData = await req.json();
                action = bodyData.action || null;
            } catch {
                // Body might not be JSON for some requests
            }
        }

        if (!action) {
            const url = new URL(req.url);
            action = url.searchParams.get("action");
            // Also check for direct OAuth callback params
            if (!action && url.searchParams.get("code")) {
                action = "callback";
                bodyData.code = url.searchParams.get("code");
                bodyData.state = url.searchParams.get("state");
            }
        }

        // Initialize Supabase client
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // ------------------------------------------------------------------
        // 1. CONNECT - Redirect user to MYOB Login
        // ------------------------------------------------------------------
        if (action === "connect") {
            const authHeader = req.headers.get("Authorization");
            if (!authHeader) throw new Error("No authorization header");

            const token = authHeader.replace("Bearer ", "");
            const { data: { user }, error } = await supabase.auth.getUser(token);
            if (error || !user) throw new Error("Invalid user token");

            // Rate limiting
            const rateLimit = await checkRateLimit(supabase, user.id, 'myob-oauth', 10, 60);
            if (rateLimit.limited) {
                return new Response(
                    JSON.stringify({ error: "Too many requests. Please try again later." }),
                    { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            // Use HMAC-signed state for CSRF protection
            const state = await signState({ userId: user.id, provider: 'myob' });

            const scopes = "CompanyFile";
            const authUrl = `https://secure.myob.com/oauth2/account/authorize?client_id=${MYOB_CLIENT_ID}&redirect_uri=${encodeURIComponent(MYOB_REDIRECT_URI)}&response_type=code&scope=${scopes}&state=${state}`;

            return new Response(JSON.stringify({ url: authUrl }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // ------------------------------------------------------------------
        // 2. CALLBACK - Handle return from MYOB
        // ------------------------------------------------------------------
        if (action === "callback") {
            const code = bodyData.code;
            const state = bodyData.state;

            if (!code || !state) throw new Error("Missing code or state");

            // Verify state with HMAC signature and expiry check
            const verification = await verifyState(state);
            if (!verification.valid) {
                console.error("MYOB OAuth state verification failed:", verification.error);
                throw new Error(`State verification failed: ${verification.error}`);
            }

            const userId = verification.data!.userId;
            if (!userId) throw new Error("Missing userId in state");

            // Rate limiting
            const rateLimitCallback = await checkRateLimit(supabase, userId, 'myob-oauth', 10, 60);
            if (rateLimitCallback.limited) {
                return new Response(
                    JSON.stringify({ error: "Too many requests. Please try again later." }),
                    { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            // Exchange code for tokens
            const tokenResponse = await fetch("https://secure.myob.com/oauth2/v1/authorize", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    client_id: MYOB_CLIENT_ID,
                    client_secret: MYOB_CLIENT_SECRET,
                    grant_type: "authorization_code",
                    code: code,
                    redirect_uri: MYOB_REDIRECT_URI,
                }),
            });

            if (!tokenResponse.ok) {
                const txt = await tokenResponse.text();
                console.error("MYOB token exchange failed:", txt);
                throw new Error(`Failed to exchange token: ${txt}`);
            }

            const tokenData = await tokenResponse.json();
            const { access_token, refresh_token, expires_in } = tokenData;

            // Fetch Company Files
            const cfResponse = await fetch("https://api.myob.com/accountright/", {
                headers: {
                    "Authorization": `Bearer ${access_token}`,
                    "x-myobapi-key": MYOB_CLIENT_ID,
                    "x-myobapi-version": "v2",
                },
            });

            if (!cfResponse.ok) {
                const cfError = await cfResponse.text();
                console.error("MYOB company files fetch failed:", cfError);
                throw new Error("Failed to fetch company files");
            }

            const cfData = await cfResponse.json();
            if (!cfData || cfData.length === 0) {
                throw new Error("No MYOB Company Files found for this user.");
            }

            // For MVP, pick the first Company File
            const companyFile = cfData[0];
            const companyFileId = companyFile.Id;
            const companyFileUri = companyFile.Uri;

            // Encrypt tokens before storing
            const encryptedAccess = await encryptToken(access_token);
            const encryptedRefresh = await encryptToken(refresh_token);

            // Save to Supabase
            const { error: updateError } = await supabase
                .from("profiles")
                .update({
                    myob_access_token: encryptedAccess,
                    myob_refresh_token: encryptedRefresh,
                    myob_company_file_id: companyFileId,
                    myob_company_file_uri: companyFileUri,
                    myob_expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
                    myob_connected_at: new Date().toISOString(),
                    myob_sync_enabled: true,
                })
                .eq("id", userId);

            if (updateError) throw updateError;

            return new Response(JSON.stringify({
                success: true,
                company_file: companyFile.Name || companyFileId,
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // ------------------------------------------------------------------
        // 3. REFRESH - Refresh expired access token
        // ------------------------------------------------------------------
        if (action === "refresh") {
            const authHeader = req.headers.get("Authorization");
            if (!authHeader) throw new Error("No authorization header");

            const token = authHeader.replace("Bearer ", "");
            const { data: { user }, error } = await supabase.auth.getUser(token);
            if (error || !user) throw new Error("Invalid user token");

            // Rate limiting
            const rateLimitRefresh = await checkRateLimit(supabase, user.id, 'myob-oauth', 10, 60);
            if (rateLimitRefresh.limited) {
                return new Response(
                    JSON.stringify({ error: "Too many requests. Please try again later." }),
                    { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            // Get current refresh token
            const { data: profile } = await supabase
                .from("profiles")
                .select("myob_refresh_token, myob_sync_enabled")
                .eq("id", user.id)
                .single();

            if (!profile?.myob_refresh_token || !profile.myob_sync_enabled) {
                throw new Error("MYOB not connected");
            }

            const refreshToken = await decryptToken(profile.myob_refresh_token);

            // Exchange refresh token for new access token
            const tokenResponse = await fetch("https://secure.myob.com/oauth2/v1/authorize", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    client_id: MYOB_CLIENT_ID,
                    client_secret: MYOB_CLIENT_SECRET,
                    grant_type: "refresh_token",
                    refresh_token: refreshToken,
                }),
            });

            if (!tokenResponse.ok) {
                const txt = await tokenResponse.text();
                console.error("MYOB token refresh failed:", txt);
                // If refresh fails, clear connection so user can reconnect
                await supabase.from("profiles").update({
                    myob_access_token: null,
                    myob_refresh_token: null,
                    myob_expires_at: null,
                    myob_sync_enabled: false,
                }).eq("id", user.id);
                throw new Error("Token refresh failed. Please reconnect MYOB.");
            }

            const tokenData = await tokenResponse.json();
            const { access_token, refresh_token: newRefreshToken, expires_in } = tokenData;

            // Encrypt and store new tokens
            const encryptedAccess = await encryptToken(access_token);
            const encryptedRefresh = await encryptToken(newRefreshToken || refreshToken);

            await supabase.from("profiles").update({
                myob_access_token: encryptedAccess,
                myob_refresh_token: encryptedRefresh,
                myob_expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
            }).eq("id", user.id);

            return new Response(JSON.stringify({ success: true }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // ------------------------------------------------------------------
        // 4. DISCONNECT
        // ------------------------------------------------------------------
        if (action === "disconnect") {
            const authHeader = req.headers.get("Authorization");
            if (!authHeader) throw new Error("No authorization header");

            const token = authHeader.replace("Bearer ", "");
            const { data: { user }, error } = await supabase.auth.getUser(token);
            if (error || !user) throw new Error("Invalid user token");

            // Rate limiting
            const rateLimitDisconnect = await checkRateLimit(supabase, user.id, 'myob-oauth', 10, 60);
            if (rateLimitDisconnect.limited) {
                return new Response(
                    JSON.stringify({ error: "Too many requests. Please try again later." }),
                    { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            // Clear tokens from DB
            await supabase.from("profiles").update({
                myob_access_token: null,
                myob_refresh_token: null,
                myob_company_file_id: null,
                myob_company_file_uri: null,
                myob_expires_at: null,
                myob_connected_at: null,
                myob_sync_enabled: false,
            }).eq("id", user.id);

            return new Response(JSON.stringify({ success: true }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        throw new Error(`Unknown action: ${action}`);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("MYOB OAuth Error:", errorMessage);
        return new Response(JSON.stringify({ error: "OAuth operation failed" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
