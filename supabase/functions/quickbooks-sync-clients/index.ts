import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decryptToken } from "../_shared/encryption.ts";
import { getCorsHeaders, createCorsResponse } from "../_shared/cors.ts";

function getQBApiBase(): string {
  const env = Deno.env.get("QUICKBOOKS_ENVIRONMENT") || "production";
  if (env === "sandbox" || env === "development") {
    return "https://sandbox-quickbooks.api.intuit.com/v3/company";
  }
  return "https://quickbooks.api.intuit.com/v3/company";
}

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

    // Get QuickBooks credentials
    const { data: profile } = await supabase
      .from("profiles")
      .select("qb_realm_id, qb_access_token, qb_refresh_token, qb_token_expires_at, qb_sync_enabled")
      .eq("user_id", user.id)
      .single();

    if (!profile?.qb_sync_enabled || !profile.qb_access_token) {
      return new Response(
        JSON.stringify({ error: "QuickBooks not connected. Please connect QuickBooks first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decrypt access token
    let accessToken: string;
    try {
      accessToken = await decryptToken(profile.qb_access_token);
    } catch (decryptError) {
      console.error("Failed to decrypt QuickBooks token:", decryptError);
      return new Response(
        JSON.stringify({ error: "Failed to decrypt QuickBooks credentials. Please reconnect." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if token needs refresh
    if (profile.qb_token_expires_at && new Date(profile.qb_token_expires_at) < new Date()) {
      console.log("QuickBooks access token expired, refreshing...");

      const refreshResponse = await fetch(
        `${supabaseUrl}/functions/v1/quickbooks-oauth`,
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
          JSON.stringify({ error: "Failed to refresh QuickBooks token. Please reconnect." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get fresh token
      const { data: refreshedProfile } = await supabase
        .from("profiles")
        .select("qb_access_token")
        .eq("user_id", user.id)
        .single();

      accessToken = await decryptToken(refreshedProfile.qb_access_token);
    }

    const realmId = profile.qb_realm_id;
    if (!realmId) {
      return new Response(
        JSON.stringify({ error: "No QuickBooks company configured." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const qbApiBase = getQBApiBase();
    console.log(`QB Client Sync: env=${Deno.env.get("QUICKBOOKS_ENVIRONMENT") || "production"}, apiBase=${qbApiBase}, realmId=${realmId}`);

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

    const qbHeaders = {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    };

    for (const client of clientsToSync) {
      try {
        // Build QuickBooks Customer object
        const qbCustomer: any = {
          DisplayName: client.name,
        };

        if (client.email) {
          qbCustomer.PrimaryEmailAddr = { Address: client.email };
        }

        if (client.phone) {
          qbCustomer.PrimaryPhone = { FreeFormNumber: client.phone };
        }

        if (client.address) {
          qbCustomer.BillAddr = {
            Line1: client.address,
            Country: "Australia",
          };

          if (client.suburb) qbCustomer.BillAddr.City = client.suburb;
          if (client.state) qbCustomer.BillAddr.CountrySubDivisionCode = client.state;
          if (client.postcode) qbCustomer.BillAddr.PostalCode = client.postcode;
        }

        let qbResponse;

        if (client.qb_customer_id) {
          // Update existing customer - need to fetch current SyncToken first
          const readResponse = await fetch(
            `${getQBApiBase()}/${realmId}/customer/${client.qb_customer_id}?minorversion=65`,
            { headers: qbHeaders }
          );

          if (readResponse.ok) {
            const existing = await readResponse.json();
            qbCustomer.Id = client.qb_customer_id;
            qbCustomer.SyncToken = existing.Customer.SyncToken;
          }

          qbResponse = await fetch(
            `${getQBApiBase()}/${realmId}/customer?minorversion=65`,
            {
              method: "POST",
              headers: qbHeaders,
              body: JSON.stringify(qbCustomer),
            }
          );
        } else {
          // Create new customer
          qbResponse = await fetch(
            `${getQBApiBase()}/${realmId}/customer?minorversion=65`,
            {
              method: "POST",
              headers: qbHeaders,
              body: JSON.stringify(qbCustomer),
            }
          );
        }

        if (!qbResponse.ok) {
          const errorText = await qbResponse.text();
          console.error(`Failed to sync client ${client.id} to QB:`, errorText.substring(0, 500));

          await supabase.from("clients").update({
            qb_sync_error: `QB API error: ${errorText.substring(0, 200)}`,
          }).eq("id", client.id);

          await supabase.from("xero_sync_log").insert({
            user_id: user.id,
            entity_type: "qb_client",
            entity_id: client.id,
            sync_direction: "to_quickbooks",
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

        const qbData = await qbResponse.json();
        const customerId = qbData.Customer?.Id;

        if (!customerId) {
          throw new Error(`QB returned no Customer Id: ${JSON.stringify(qbData).substring(0, 200)}`);
        }

        // Update client with QB customer ID
        await supabase.from("clients").update({
          qb_customer_id: customerId,
          last_synced_to_qb: new Date().toISOString(),
          qb_sync_error: null,
        }).eq("id", client.id);

        // Log success
        await supabase.from("xero_sync_log").insert({
          user_id: user.id,
          entity_type: "qb_client",
          entity_id: client.id,
          sync_direction: "to_quickbooks",
          sync_status: "success",
        });

        results.success++;
        console.log(`Successfully synced client to QB: ${client.name} (${customerId})`);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error(`Error syncing client ${client.id} to QB:`, errorMessage);

        await supabase.from("clients").update({
          qb_sync_error: errorMessage.substring(0, 200),
        }).eq("id", client.id);

        await supabase.from("xero_sync_log").insert({
          user_id: user.id,
          entity_type: "qb_client",
          entity_id: client.id,
          sync_direction: "to_quickbooks",
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

    console.log(`QB client sync complete: ${results.success} succeeded, ${results.failed} failed`);

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
    console.error("Error in QuickBooks client sync:", errorMessage);
    return new Response(
      JSON.stringify({ error: "Client sync failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
