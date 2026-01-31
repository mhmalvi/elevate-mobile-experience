import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createCorsResponse, getCorsHeaders } from "../_shared/cors.ts";
import { encryptToken } from "../_shared/encryption.ts";

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
        const url = new URL(req.url);
        const action = url.searchParams.get("action"); // "connect", "callback", "disconnect"

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

            // Generate state to prevent CSRF and store user ID
            // Added provider: 'myob' to distinguish from Xero
            const state = btoa(JSON.stringify({ userId: user.id, provider: 'myob', nonce: crypto.randomUUID() }));

            const scopes = "CompanyFile"; // Standard scope for AccountRight
            const authUrl = `https://secure.myob.com/oauth2/account/authorize?client_id=${MYOB_CLIENT_ID}&redirect_uri=${encodeURIComponent(MYOB_REDIRECT_URI)}&response_type=code&scope=${scopes}&state=${state}`;

            return new Response(JSON.stringify({ url: authUrl }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // ------------------------------------------------------------------
        // 2. CALLBACK - Handle return from MYOB
        // ------------------------------------------------------------------
        if (action === "callback") {
            const code = url.searchParams.get("code");
            const state = url.searchParams.get("state");

            if (!code || !state) throw new Error("Missing code or state");

            // Decode state to get user ID
            let userId;
            try {
                const decodedState = JSON.parse(atob(state));
                userId = decodedState.userId;
            } catch (e) {
                throw new Error("Invalid state parameter");
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
                throw new Error(`Failed to exchange token: ${txt}`);
            }

            const tokenData = await tokenResponse.json();
            const { access_token, refresh_token, expires_in } = tokenData;

            // Fetch Company Files (We need to select one to connect to)
            const cfResponse = await fetch("https://api.myob.com/accountright/", {
                headers: {
                    "Authorization": `Bearer ${access_token}`,
                    "x-myobapi-key": MYOB_CLIENT_ID,
                    "x-myobapi-version": "v2",
                },
            });

            if (!cfResponse.ok) throw new Error("Failed to fetch company files");

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

            // Return HTML that closes the popup and notifies the parent window
            return new Response(
                `<html><body><script>window.opener.postMessage("myob-success", "*"); window.close();</script></body></html>`,
                { headers: { ...corsHeaders, "Content-Type": "text/html" } }
            );
        }

        // ------------------------------------------------------------------
        // 3. DISCONNECT
        // ------------------------------------------------------------------
        if (action === "disconnect") {
            const authHeader = req.headers.get("Authorization");
            if (!authHeader) throw new Error("No authorization header");

            const token = authHeader.replace("Bearer ", "");
            const { data: { user }, error } = await supabase.auth.getUser(token);
            if (error || !user) throw new Error("Invalid user token");

            // Clear tokens from DB
            await supabase.from("profiles").update({
                myob_access_token: null,
                myob_refresh_token: null,
                myob_company_file_id: null,
                myob_company_file_uri: null,
                myob_expires_at: null,
                myob_sync_enabled: false,
            }).eq("id", user.id);

            return new Response(JSON.stringify({ success: true }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        throw new Error(`Unknown action: ${action}`);

    } catch (error) {
        console.error("MYOB OAuth Error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
