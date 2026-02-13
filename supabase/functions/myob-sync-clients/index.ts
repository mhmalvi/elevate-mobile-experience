import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decryptToken } from "../_shared/encryption.ts";
import { getCorsHeaders, createCorsResponse } from "../_shared/cors.ts";

const MYOB_CLIENT_ID = Deno.env.get("MYOB_CLIENT_ID")!;

serve(async (req) => {
    const corsHeaders = getCorsHeaders(req);

    if (req.method === "OPTIONS") {
        return createCorsResponse(req);
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Authenticate user
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

        const { client_id, sync_all } = await req.json();

        // Get MYOB credentials
        const { data: profile } = await supabase
            .from("profiles")
            .select("myob_company_file_id, myob_company_file_uri, myob_access_token, myob_refresh_token, myob_expires_at, myob_sync_enabled")
            .eq("user_id", user.id)
            .single();

        if (!profile?.myob_sync_enabled || !profile.myob_access_token) {
            return new Response(
                JSON.stringify({ error: "MYOB not connected. Please connect MYOB first." }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Decrypt access token
        let accessToken: string;
        try {
            accessToken = await decryptToken(profile.myob_access_token);
        } catch (decryptError) {
            console.error("Failed to decrypt MYOB token:", decryptError);
            return new Response(
                JSON.stringify({ error: "Failed to decrypt MYOB credentials. Please reconnect MYOB." }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Check if token needs refresh
        if (profile.myob_expires_at && new Date(profile.myob_expires_at) < new Date()) {
            console.log("MYOB access token expired, refreshing...");

            const refreshResponse = await fetch(
                `${supabaseUrl}/functions/v1/myob-oauth`,
                {
                    method: "POST",
                    headers: {
                        "Authorization": authHeader,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ action: "refresh" }),
                }
            );

            if (!refreshResponse.ok) {
                return new Response(
                    JSON.stringify({ error: "Failed to refresh MYOB token. Please reconnect MYOB." }),
                    { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            // Get fresh token
            const { data: refreshedProfile } = await supabase
                .from("profiles")
                .select("myob_access_token")
                .eq("user_id", user.id)
                .single();

            accessToken = await decryptToken(refreshedProfile.myob_access_token);
        }

        const companyFileUri = profile.myob_company_file_uri;
        if (!companyFileUri) {
            return new Response(
                JSON.stringify({ error: "No MYOB Company File configured." }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Determine which clients to sync
        let clientsToSync: any[];

        if (sync_all) {
            const { data: clients } = await supabase
                .from("clients")
                .select("*")
                .eq("user_id", user.id)
                .is("deleted_at", null);

            clientsToSync = clients || [];
        } else if (client_id) {
            const { data: client } = await supabase
                .from("clients")
                .select("*")
                .eq("id", client_id)
                .eq("user_id", user.id)
                .single();

            if (!client) {
                return new Response(
                    JSON.stringify({ error: "Client not found" }),
                    { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            clientsToSync = [client];
        } else {
            return new Response(
                JSON.stringify({ error: "Either client_id or sync_all must be specified" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const results = {
            success: 0,
            failed: 0,
            errors: [] as any[],
        };

        // Common MYOB API headers
        const myobHeaders = {
            "Authorization": `Bearer ${accessToken}`,
            "x-myobapi-key": MYOB_CLIENT_ID,
            "x-myobapi-version": "v2",
            "Content-Type": "application/json",
            "Accept": "application/json",
        };

        for (const client of clientsToSync) {
            try {
                // Build MYOB Customer contact object
                const myobContact: any = {
                    CompanyName: client.company_name || undefined,
                    FirstName: client.name?.split(" ")[0] || client.name,
                    LastName: client.name?.split(" ").slice(1).join(" ") || "",
                    IsActive: true,
                };

                // Add addresses
                if (client.address) {
                    myobContact.Addresses = [{
                        Location: 1, // Primary
                        Street: client.address,
                        Country: "Australia",
                    }];
                }

                // Add phone/email
                if (client.phone) {
                    myobContact.Addresses = myobContact.Addresses || [{ Location: 1 }];
                    myobContact.Addresses[0].Phone1 = client.phone;
                }
                if (client.email) {
                    myobContact.Addresses = myobContact.Addresses || [{ Location: 1 }];
                    myobContact.Addresses[0].Email = client.email;
                }

                let myobResponse;

                if (client.myob_uid) {
                    // Update existing contact
                    myobContact.UID = client.myob_uid;

                    myobResponse = await fetch(
                        `${companyFileUri}/Contact/Customer/${client.myob_uid}`,
                        {
                            method: "PUT",
                            headers: myobHeaders,
                            body: JSON.stringify(myobContact),
                        }
                    );
                } else {
                    // Create new contact
                    myobResponse = await fetch(
                        `${companyFileUri}/Contact/Customer`,
                        {
                            method: "POST",
                            headers: myobHeaders,
                            body: JSON.stringify(myobContact),
                        }
                    );
                }

                if (!myobResponse.ok) {
                    const errorText = await myobResponse.text();
                    console.error(`Failed to sync client ${client.id} to MYOB:`, errorText.substring(0, 500));

                    await supabase.from("clients").update({
                        myob_sync_error: `MYOB API error: ${errorText.substring(0, 200)}`,
                    }).eq("id", client.id);

                    await supabase.from("xero_sync_log").insert({
                        user_id: user.id,
                        entity_type: "myob_client",
                        entity_id: client.id,
                        sync_direction: "to_myob",
                        sync_status: "error",
                        error_message: errorText.substring(0, 500),
                    });

                    results.failed++;
                    results.errors.push({
                        client_id: client.id,
                        client_name: client.name,
                        error: errorText.substring(0, 200),
                    });
                    continue;
                }

                // For POST (create), MYOB returns the UID in the Location header
                let myobUid = client.myob_uid;
                if (!myobUid) {
                    const locationHeader = myobResponse.headers.get("Location");
                    if (locationHeader) {
                        // Location header contains the full URL with UID at the end
                        myobUid = locationHeader.split("/").pop();
                    }

                    // If no Location header, try response body
                    if (!myobUid) {
                        try {
                            const responseBody = await myobResponse.json();
                            myobUid = responseBody.UID;
                        } catch {
                            // Some MYOB responses don't have a body
                        }
                    }
                }

                // Update client with MYOB UID
                await supabase.from("clients").update({
                    myob_uid: myobUid || client.myob_uid,
                    last_synced_to_myob: new Date().toISOString(),
                    myob_sync_error: null,
                }).eq("id", client.id);

                // Log success
                await supabase.from("xero_sync_log").insert({
                    user_id: user.id,
                    entity_type: "myob_client",
                    entity_id: client.id,
                    sync_direction: "to_myob",
                    sync_status: "success",
                });

                results.success++;
                console.log(`Successfully synced client to MYOB: ${client.name}`);

            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Unknown error";
                console.error(`Error syncing client ${client.id} to MYOB:`, errorMessage);

                await supabase.from("clients").update({
                    myob_sync_error: errorMessage.substring(0, 200),
                }).eq("id", client.id);

                await supabase.from("xero_sync_log").insert({
                    user_id: user.id,
                    entity_type: "myob_client",
                    entity_id: client.id,
                    sync_direction: "to_myob",
                    sync_status: "error",
                    error_message: errorMessage.substring(0, 500),
                });

                results.failed++;
                results.errors.push({
                    client_id: client.id,
                    client_name: client.name,
                    error: errorMessage,
                });
            }
        }

        console.log(`MYOB client sync complete: ${results.success} succeeded, ${results.failed} failed`);

        return new Response(
            JSON.stringify({
                success: true,
                synced: results.success,
                failed: results.failed,
                total: clientsToSync.length,
                errors: results.errors,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("Error in MYOB client sync:", errorMessage);
        return new Response(
            JSON.stringify({ error: "Client sync failed" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
