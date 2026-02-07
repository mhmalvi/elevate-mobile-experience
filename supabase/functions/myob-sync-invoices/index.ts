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

        const { invoice_id, sync_all } = await req.json();

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
        let accessToken = await decryptToken(profile.myob_access_token);

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

        // Determine which invoices to sync
        let invoicesToSync: any[];

        if (sync_all) {
            const { data: invoices } = await supabase
                .from("invoices")
                .select("*, clients(*)")
                .eq("user_id", user.id)
                .in("status", ["sent", "paid", "partially_paid"])
                .is("deleted_at", null);

            invoicesToSync = invoices || [];
        } else if (invoice_id) {
            const { data: invoice } = await supabase
                .from("invoices")
                .select("*, clients(*)")
                .eq("id", invoice_id)
                .eq("user_id", user.id)
                .single();

            if (!invoice) {
                return new Response(
                    JSON.stringify({ error: "Invoice not found" }),
                    { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            invoicesToSync = [invoice];
        } else {
            return new Response(
                JSON.stringify({ error: "Either invoice_id or sync_all must be specified" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const results = {
            success: 0,
            failed: 0,
            errors: [] as any[],
        };

        const myobHeaders = {
            "Authorization": `Bearer ${accessToken}`,
            "x-myobapi-key": MYOB_CLIENT_ID,
            "x-myobapi-version": "v2",
            "Content-Type": "application/json",
            "Accept": "application/json",
        };

        for (const invoice of invoicesToSync) {
            try {
                // Ensure client has MYOB UID
                if (invoice.clients && !invoice.clients.myob_uid) {
                    console.log(`Client ${invoice.clients.name} not synced to MYOB, syncing now...`);

                    const clientSyncResponse = await fetch(
                        `${supabaseUrl}/functions/v1/myob-sync-clients`,
                        {
                            method: "POST",
                            headers: {
                                "Authorization": authHeader,
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({ client_id: invoice.client_id }),
                        }
                    );

                    if (!clientSyncResponse.ok) {
                        throw new Error("Failed to sync client to MYOB. Please sync client first.");
                    }

                    // Reload client
                    const { data: updatedClient } = await supabase
                        .from("clients")
                        .select("*")
                        .eq("id", invoice.client_id)
                        .single();

                    if (!updatedClient?.myob_uid) {
                        throw new Error("Client sync failed. No MYOB UID.");
                    }

                    invoice.clients = updatedClient;
                }

                // Parse line items
                let lineItems = invoice.line_items || [];
                if (lineItems.length === 0) {
                    lineItems = [{
                        description: "Services",
                        quantity: 1,
                        unit_price: invoice.total_amount || invoice.total || 0,
                    }];
                }

                // Build MYOB Service Invoice line items
                const myobLines = lineItems.map((item: any) => ({
                    Type: "Transaction",
                    Description: item.description || "Service",
                    Total: (item.quantity || 1) * (item.unit_price || item.price || 0),
                    Account: { UID: undefined }, // Will use default income account
                    TaxCode: { UID: undefined }, // Will use default GST code
                }));

                // Build MYOB Service Invoice
                const myobInvoice: any = {
                    Number: invoice.invoice_number,
                    Date: invoice.created_at?.split("T")[0] || new Date().toISOString().split("T")[0],
                    Customer: {
                        UID: invoice.clients?.myob_uid,
                    },
                    Lines: myobLines,
                    IsTaxInclusive: false,
                    Comment: `TradieMate Invoice ${invoice.invoice_number}`,
                };

                // Set status
                if (invoice.status === "paid") {
                    myobInvoice.Status = "Closed";
                } else {
                    myobInvoice.Status = "Open";
                }

                // Set due date
                if (invoice.due_date) {
                    myobInvoice.PromisedDate = invoice.due_date.split("T")[0];
                }

                let myobResponse;

                if (invoice.myob_uid) {
                    // Update existing
                    myobInvoice.UID = invoice.myob_uid;
                    myobResponse = await fetch(
                        `${companyFileUri}/Sale/Invoice/Service/${invoice.myob_uid}`,
                        {
                            method: "PUT",
                            headers: myobHeaders,
                            body: JSON.stringify(myobInvoice),
                        }
                    );
                } else {
                    // Create new
                    myobResponse = await fetch(
                        `${companyFileUri}/Sale/Invoice/Service`,
                        {
                            method: "POST",
                            headers: myobHeaders,
                            body: JSON.stringify(myobInvoice),
                        }
                    );
                }

                if (!myobResponse.ok) {
                    const errorText = await myobResponse.text();
                    console.error(`Failed to sync invoice ${invoice.invoice_number} to MYOB:`, errorText.substring(0, 500));

                    await supabase.from("invoices").update({
                        myob_sync_error: `MYOB API error: ${errorText.substring(0, 200)}`,
                    }).eq("id", invoice.id);

                    await supabase.from("xero_sync_log").insert({
                        user_id: user.id,
                        entity_type: "myob_invoice",
                        entity_id: invoice.id,
                        sync_direction: "to_myob",
                        sync_status: "error",
                        error_message: errorText.substring(0, 500),
                    });

                    results.failed++;
                    results.errors.push({
                        invoice_id: invoice.id,
                        invoice_number: invoice.invoice_number,
                        error: errorText.substring(0, 200),
                    });
                    continue;
                }

                // Get MYOB UID from response
                let myobUid = invoice.myob_uid;
                if (!myobUid) {
                    const locationHeader = myobResponse.headers.get("Location");
                    if (locationHeader) {
                        myobUid = locationHeader.split("/").pop();
                    }
                    if (!myobUid) {
                        try {
                            const responseBody = await myobResponse.json();
                            myobUid = responseBody.UID;
                        } catch {
                            // Some responses don't have a body
                        }
                    }
                }

                // Update invoice
                await supabase.from("invoices").update({
                    myob_uid: myobUid || invoice.myob_uid,
                    last_synced_to_myob: new Date().toISOString(),
                    myob_sync_error: null,
                }).eq("id", invoice.id);

                // Log success
                await supabase.from("xero_sync_log").insert({
                    user_id: user.id,
                    entity_type: "myob_invoice",
                    entity_id: invoice.id,
                    sync_direction: "to_myob",
                    sync_status: "success",
                });

                results.success++;
                console.log(`Successfully synced invoice to MYOB: ${invoice.invoice_number}`);

            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Unknown error";
                console.error(`Error syncing invoice ${invoice.id} to MYOB:`, errorMessage);

                await supabase.from("invoices").update({
                    myob_sync_error: errorMessage.substring(0, 200),
                }).eq("id", invoice.id);

                await supabase.from("xero_sync_log").insert({
                    user_id: user.id,
                    entity_type: "myob_invoice",
                    entity_id: invoice.id,
                    sync_direction: "to_myob",
                    sync_status: "error",
                    error_message: errorMessage.substring(0, 500),
                });

                results.failed++;
                results.errors.push({
                    invoice_id: invoice.id,
                    invoice_number: invoice.invoice_number,
                    error: errorMessage,
                });
            }
        }

        console.log(`MYOB invoice sync complete: ${results.success} succeeded, ${results.failed} failed`);

        return new Response(
            JSON.stringify({
                success: true,
                synced: results.success,
                failed: results.failed,
                total: invoicesToSync.length,
                errors: results.errors,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("Error in MYOB invoice sync:", errorMessage);
        return new Response(
            JSON.stringify({ error: errorMessage }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
