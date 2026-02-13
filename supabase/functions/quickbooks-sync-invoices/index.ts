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

    const { invoice_id, sync_all } = await req.json();

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
    console.log(`QB Invoice Sync: env=${Deno.env.get("QUICKBOOKS_ENVIRONMENT") || "production"}, apiBase=${qbApiBase}, realmId=${realmId}`);

    // Determine which invoices to sync
    let invoicesToSync: any[];

    if (sync_all) {
      const { data: invoices } = await supabase
        .from("invoices")
        .select("*, clients(name, email, phone, address, qb_customer_id), invoice_line_items(*)")
        .eq("user_id", user.id)
        .is("deleted_at", null);

      invoicesToSync = invoices || [];
    } else if (invoice_id) {
      const { data: invoice } = await supabase
        .from("invoices")
        .select("*, clients(name, email, phone, address, qb_customer_id), invoice_line_items(*)")
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

    const qbHeaders = {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    };

    for (const invoice of invoicesToSync) {
      try {
        // Ensure client is synced to QB first
        let qbCustomerId = invoice.clients?.qb_customer_id;

        if (!qbCustomerId && invoice.client_id) {
          // Sync client first
          console.log(`Syncing client ${invoice.client_id} to QB before invoice sync`);
          const syncClientResponse = await fetch(
            `${supabaseUrl}/functions/v1/quickbooks-sync-clients`,
            {
              method: "POST",
              headers: {
                "Authorization": authHeader,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ client_id: invoice.client_id }),
            }
          );

          if (syncClientResponse.ok) {
            // Refresh client data
            const { data: updatedClient } = await supabase
              .from("clients")
              .select("qb_customer_id")
              .eq("id", invoice.client_id)
              .single();

            qbCustomerId = updatedClient?.qb_customer_id;
          }
        }

        // Build QuickBooks Invoice object
        const lineItems: any[] = [];

        if (invoice.invoice_line_items?.length > 0) {
          for (const item of invoice.invoice_line_items) {
            lineItems.push({
              DetailType: "SalesItemLineDetail",
              Amount: (item.quantity || 1) * (item.unit_price || 0),
              Description: item.description || "Service",
              SalesItemLineDetail: {
                UnitPrice: item.unit_price || 0,
                Qty: item.quantity || 1,
              },
            });
          }
        } else {
          // Fallback: single line item from invoice total
          lineItems.push({
            DetailType: "SalesItemLineDetail",
            Amount: invoice.total || 0,
            Description: invoice.title || "Services",
            SalesItemLineDetail: {
              UnitPrice: invoice.total || 0,
              Qty: 1,
            },
          });
        }

        const qbInvoice: any = {
          Line: lineItems,
          DocNumber: invoice.invoice_number,
        };

        if (qbCustomerId) {
          qbInvoice.CustomerRef = { value: qbCustomerId };
        }

        if (invoice.due_date) {
          qbInvoice.DueDate = invoice.due_date;
        }

        if (invoice.created_at) {
          qbInvoice.TxnDate = invoice.created_at.split("T")[0];
        }

        let qbResponse;

        if (invoice.qb_invoice_id) {
          // Update existing invoice - fetch SyncToken first
          const readResponse = await fetch(
            `${getQBApiBase()}/${realmId}/invoice/${invoice.qb_invoice_id}?minorversion=65`,
            { headers: qbHeaders }
          );

          if (readResponse.ok) {
            const existing = await readResponse.json();
            qbInvoice.Id = invoice.qb_invoice_id;
            qbInvoice.SyncToken = existing.Invoice.SyncToken;
          }

          qbResponse = await fetch(
            `${getQBApiBase()}/${realmId}/invoice?minorversion=65`,
            {
              method: "POST",
              headers: qbHeaders,
              body: JSON.stringify(qbInvoice),
            }
          );
        } else {
          qbResponse = await fetch(
            `${getQBApiBase()}/${realmId}/invoice?minorversion=65`,
            {
              method: "POST",
              headers: qbHeaders,
              body: JSON.stringify(qbInvoice),
            }
          );
        }

        if (!qbResponse.ok) {
          const errorText = await qbResponse.text();
          console.error(`Failed to sync invoice ${invoice.id} to QB:`, errorText.substring(0, 500));

          await supabase.from("invoices").update({
            qb_sync_error: `QB API error: ${errorText.substring(0, 200)}`,
          }).eq("id", invoice.id);

          await supabase.from("xero_sync_log").insert({
            user_id: user.id,
            entity_type: "qb_invoice",
            entity_id: invoice.id,
            sync_direction: "to_quickbooks",
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

        const qbData = await qbResponse.json();
        const qbInvoiceId = qbData.Invoice?.Id;

        if (!qbInvoiceId) {
          throw new Error(`QB returned no Invoice Id: ${JSON.stringify(qbData).substring(0, 200)}`);
        }

        // Update invoice with QB ID
        await supabase.from("invoices").update({
          qb_invoice_id: qbInvoiceId,
          last_synced_to_qb: new Date().toISOString(),
          qb_sync_error: null,
        }).eq("id", invoice.id);

        // Log success
        await supabase.from("xero_sync_log").insert({
          user_id: user.id,
          entity_type: "qb_invoice",
          entity_id: invoice.id,
          sync_direction: "to_quickbooks",
          sync_status: "success",
        });

        results.success++;
        console.log(`Successfully synced invoice to QB: ${invoice.invoice_number} (${qbInvoiceId})`);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error(`Error syncing invoice ${invoice.id} to QB:`, errorMessage);

        await supabase.from("invoices").update({
          qb_sync_error: errorMessage.substring(0, 200),
        }).eq("id", invoice.id);

        await supabase.from("xero_sync_log").insert({
          user_id: user.id,
          entity_type: "qb_invoice",
          entity_id: invoice.id,
          sync_direction: "to_quickbooks",
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

    console.log(`QB invoice sync complete: ${results.success} succeeded, ${results.failed} failed`);

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
    console.error("Error in QuickBooks invoice sync:", errorMessage);
    return new Response(
      JSON.stringify({ error: "Invoice sync failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
