import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decryptToken } from "../_shared/encryption.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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
    let accessToken = await decryptToken(profile.xero_access_token);

    // Check if token needs refresh
    if (new Date(profile.xero_token_expires_at) < new Date()) {
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
              },
              body: JSON.stringify({ Contacts: [xeroContact] }),
            }
          );
        }

        if (!xeroResponse.ok) {
          const errorText = await xeroResponse.text();
          console.error(`Failed to sync client ${client.id}:`, errorText);

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

        const xeroData: XeroContactsResponse = await xeroResponse.json();
        const createdContact = xeroData.Contacts[0];

        // Update client with Xero contact ID
        await supabase
          .from("clients")
          .update({
            xero_contact_id: createdContact.ContactID,
            last_synced_to_xero: new Date().toISOString(),
            xero_sync_error: null,
          })
          .eq("id", client.id);

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
