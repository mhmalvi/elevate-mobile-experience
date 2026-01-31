import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decryptToken } from "../_shared/encryption.ts";
import { getCorsHeaders, createCorsResponse, createErrorResponse } from "../_shared/cors.ts";

interface XeroContact {
  ContactID?: string;
  ContactStatus?: string;
  Name: string;
  FirstName?: string;
  LastName?: string;
  EmailAddress?: string;
  Phones?: Array<{
    PhoneType: string;
    PhoneNumber: string;
  }>;
  Addresses?: Array<{
    AddressType: string;
    AddressLine1?: string;
    AddressLine2?: string;
    City?: string;
    Region?: string;
    PostalCode?: string;
    Country?: string;
  }>;
}

interface XeroContactsResponse {
  Contacts: XeroContact[];
}

serve(async (req) => {
  // SECURITY: Get secure CORS headers
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return createCorsResponse(req);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authenticated user
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

    // Get user's Xero credentials
    const { data: profile } = await supabase
      .from("profiles")
      .select("xero_tenant_id, xero_access_token, xero_refresh_token, xero_token_expires_at, xero_sync_enabled")
      .eq("user_id", user.id)
      .single();

    if (!profile?.xero_sync_enabled || !profile.xero_access_token) {
      return new Response(
        JSON.stringify({ error: "Xero not connected. Please connect Xero first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decrypt the access token
    let accessToken: string;
    try {
      accessToken = await decryptToken(profile.xero_access_token);
      console.log("Token decrypted successfully, length:", accessToken?.length);
    } catch (decryptError) {
      console.error("Failed to decrypt Xero token:", decryptError);
      return new Response(
        JSON.stringify({
          error: "Failed to decrypt Xero credentials. Please reconnect Xero.",
          details: "Token decryption failed"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if token needs refresh
    const tokenExpiry = new Date(profile.xero_token_expires_at);
    console.log("Token expires at:", tokenExpiry, "Current time:", new Date());

    if (tokenExpiry < new Date()) {
      console.log("Access token expired, refreshing...");

      // Call refresh endpoint
      const refreshResponse = await fetch(
        `${supabaseUrl}/functions/v1/xero-oauth?action=refresh`,
        {
          method: "GET",
          headers: {
            "Authorization": authHeader,
          },
        }
      );

      if (!refreshResponse.ok) {
        return new Response(
          JSON.stringify({ error: "Failed to refresh Xero token. Please reconnect Xero." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get fresh token
      const { data: refreshedProfile } = await supabase
        .from("profiles")
        .select("xero_access_token")
        .eq("user_id", user.id)
        .single();

      accessToken = await decryptToken(refreshedProfile.xero_access_token);
    }

    // Determine which clients to sync
    let clientsToSync: any[];

    if (sync_all) {
      // Sync all clients
      const { data: clients } = await supabase
        .from("clients")
        .select("*")
        .eq("user_id", user.id)
        .is("deleted_at", null);

      clientsToSync = clients || [];
    } else if (client_id) {
      // Sync specific client
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

    // Sync each client to Xero
    for (const client of clientsToSync) {
      try {
        // Build Xero contact object
        const xeroContact: XeroContact = {
          Name: client.name,
          EmailAddress: client.email || undefined,
        };

        // Add phone if available
        if (client.phone) {
          xeroContact.Phones = [
            {
              PhoneType: "MOBILE",
              PhoneNumber: client.phone,
            },
          ];
        }

        // Add address if available
        if (client.address) {
          xeroContact.Addresses = [
            {
              AddressType: "STREET",
              AddressLine1: client.address,
            },
          ];
        }

        // If client already has Xero ID, update; otherwise create
        let xeroContactId = client.xero_contact_id;
        let xeroResponse;

        if (xeroContactId) {
          // Update existing contact
          xeroContact.ContactID = xeroContactId;

          xeroResponse = await fetch(
            `https://api.xero.com/api.xro/2.0/Contacts/${xeroContactId}`,
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Xero-Tenant-Id": profile.xero_tenant_id,
                "Content-Type": "application/json",
                "Accept": "application/json",
              },
              body: JSON.stringify({ Contacts: [xeroContact] }),
            }
          );
        } else {
          // Create new contact
          xeroResponse = await fetch(
            "https://api.xero.com/api.xro/2.0/Contacts",
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Xero-Tenant-Id": profile.xero_tenant_id,
                "Content-Type": "application/json",
                "Accept": "application/json",
              },
              body: JSON.stringify({ Contacts: [xeroContact] }),
            }
          );
        }

        console.log(`Xero API response status: ${xeroResponse.status} ${xeroResponse.statusText}`);
        console.log(`Xero API response headers:`, Object.fromEntries(xeroResponse.headers.entries()));

        if (!xeroResponse.ok) {
          const errorText = await xeroResponse.text();
          console.error(`Failed to sync client ${client.id}. Status: ${xeroResponse.status}. Response:`, errorText.substring(0, 500));

          // Log error
          await supabase
            .from("clients")
            .update({
              xero_sync_error: `Xero API error: ${errorText.substring(0, 200)}`,
            })
            .eq("id", client.id);

          await supabase.from("xero_sync_log").insert({
            user_id: user.id,
            entity_type: "client",
            entity_id: client.id,
            sync_direction: "to_xero",
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

        const responseText = await xeroResponse.text();
        console.log(`Xero API raw response for ${client.name}:`, responseText.substring(0, 500));

        let xeroData: XeroContactsResponse;
        try {
          xeroData = JSON.parse(responseText);
        } catch (parseError) {
          throw new Error(`Failed to parse Xero response: ${responseText.substring(0, 200)}`);
        }

        console.log(`Xero API parsed response:`, JSON.stringify(xeroData).substring(0, 300));

        if (!xeroData.Contacts || xeroData.Contacts.length === 0) {
          throw new Error(`Xero returned empty Contacts array: ${JSON.stringify(xeroData).substring(0, 200)}`);
        }

        const createdContact = xeroData.Contacts[0];

        if (!createdContact.ContactID) {
          throw new Error(`Xero Contact missing ContactID: ${JSON.stringify(createdContact).substring(0, 200)}`);
        }

        // Update client with Xero contact ID
        const { error: updateError } = await supabase
          .from("clients")
          .update({
            xero_contact_id: createdContact.ContactID,
            last_synced_to_xero: new Date().toISOString(),
            xero_sync_error: null,
          })
          .eq("id", client.id);

        if (updateError) {
          console.error(`Failed to update client ${client.id} in database:`, updateError);
          throw new Error(`Database update failed: ${updateError.message}`);
        }

        // Log success
        await supabase.from("xero_sync_log").insert({
          user_id: user.id,
          entity_type: "client",
          entity_id: client.id,
          sync_direction: "to_xero",
          sync_status: "success",
        });

        results.success++;
        console.log(`Successfully synced client: ${client.name} (${createdContact.ContactID})`);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error(`Error syncing client ${client.id}:`, errorMessage);

        await supabase
          .from("clients")
          .update({
            xero_sync_error: errorMessage.substring(0, 200),
          })
          .eq("id", client.id);

        await supabase.from("xero_sync_log").insert({
          user_id: user.id,
          entity_type: "client",
          entity_id: client.id,
          sync_direction: "to_xero",
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

    console.log(`Client sync complete: ${results.success} succeeded, ${results.failed} failed`);

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
    console.error("Error in Xero client sync:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
