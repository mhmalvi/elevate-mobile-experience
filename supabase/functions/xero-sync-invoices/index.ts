import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decryptToken } from "../_shared/encryption.ts";
import { getCorsHeaders, createCorsResponse, createErrorResponse } from "../_shared/cors.ts";

interface XeroLineItem {
  Description: string;
  Quantity: number;
  UnitAmount: number;
  AccountCode?: string;
  TaxType?: string;
  LineAmount?: number;
}

interface XeroInvoice {
  Type: "ACCREC" | "ACCPAY";
  Contact: {
    ContactID?: string;
    Name?: string;
  };
  Date: string;
  DueDate?: string;
  LineAmountTypes: "Exclusive" | "Inclusive" | "NoTax";
  LineItems: XeroLineItem[];
  InvoiceNumber?: string;
  Reference?: string;
  Status: "DRAFT" | "SUBMITTED" | "AUTHORISED" | "PAID";
  CurrencyCode?: string;
}

interface XeroInvoicesResponse {
  Invoices: Array<{
    InvoiceID: string;
    InvoiceNumber: string;
    Status: string;
  }>;
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

    const { invoice_id, sync_all } = await req.json();

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

      const { data: refreshedProfile } = await supabase
        .from("profiles")
        .select("xero_access_token")
        .eq("user_id", user.id)
        .single();

      accessToken = await decryptToken(refreshedProfile.xero_access_token);
    }

    // Determine which invoices to sync
    let invoicesToSync: any[];

    if (sync_all) {
      // Sync all invoices (sent or paid only, not drafts)
      const { data: invoices } = await supabase
        .from("invoices")
        .select("*, clients(*)")
        .eq("user_id", user.id)
        .in("status", ["sent", "paid", "partially_paid"])
        .is("deleted_at", null);

      invoicesToSync = invoices || [];
    } else if (invoice_id) {
      // Sync specific invoice
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

    // Sync each invoice to Xero
    for (const invoice of invoicesToSync) {
      try {
        // Ensure client has Xero contact ID
        if (!invoice.clients?.xero_contact_id) {
          // Try to sync client first
          console.log(`Client ${invoice.clients?.name} not synced to Xero, syncing now...`);

          const clientSyncResponse = await fetch(
            `${supabaseUrl}/functions/v1/xero-sync-clients`,
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
            throw new Error("Failed to sync client to Xero. Please sync client first.");
          }

          // Reload invoice with updated client
          const { data: updatedInvoice } = await supabase
            .from("invoices")
            .select("*, clients(*)")
            .eq("id", invoice.id)
            .single();

          if (!updatedInvoice?.clients?.xero_contact_id) {
            throw new Error("Client sync failed. No Xero contact ID.");
          }

          invoice.clients = updatedInvoice.clients;
        }

        // Parse line items (stored as JSONB)
        const lineItems = invoice.line_items || [];

        if (lineItems.length === 0) {
          throw new Error("Invoice has no line items");
        }

        // Build Xero line items
        const xeroLineItems: XeroLineItem[] = lineItems.map((item: any) => ({
          Description: item.description || "Service",
          Quantity: item.quantity || 1,
          UnitAmount: item.unit_price || 0,
          AccountCode: "200", // Sales - adjust based on your Xero account
          TaxType: "OUTPUT", // GST on sales (Australia)
        }));

        // Determine invoice status
        let xeroStatus: "DRAFT" | "SUBMITTED" | "AUTHORISED" | "PAID" = "AUTHORISED";
        if (invoice.status === "draft") {
          xeroStatus = "DRAFT";
        } else if (invoice.status === "paid") {
          xeroStatus = "PAID";
        } else if (invoice.status === "sent" || invoice.status === "partially_paid") {
          xeroStatus = "AUTHORISED";
        }

        // Build Xero invoice object
        const xeroInvoice: XeroInvoice = {
          Type: "ACCREC", // Accounts Receivable (customer invoice)
          Contact: {
            ContactID: invoice.clients.xero_contact_id,
          },
          Date: invoice.created_at.split('T')[0], // YYYY-MM-DD
          DueDate: invoice.due_date ? invoice.due_date.split('T')[0] : undefined,
          LineAmountTypes: "Exclusive", // Prices exclude tax
          LineItems: xeroLineItems,
          InvoiceNumber: invoice.invoice_number,
          Reference: `TradieMate Invoice ${invoice.invoice_number}`,
          Status: xeroStatus,
          CurrencyCode: "AUD",
        };

        // If invoice already has Xero ID, update; otherwise create
        let xeroInvoiceId = invoice.xero_invoice_id;
        let xeroResponse;

        if (xeroInvoiceId) {
          // Update existing invoice (only if not paid)
          if (xeroStatus !== "PAID") {
            xeroResponse = await fetch(
              `https://api.xero.com/api.xro/2.0/Invoices/${xeroInvoiceId}`,
              {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${accessToken}`,
                  "Xero-Tenant-Id": profile.xero_tenant_id,
                  "Content-Type": "application/json",
                  "Accept": "application/json",
                },
                body: JSON.stringify({ Invoices: [xeroInvoice] }),
              }
            );
          } else {
            // Can't update paid invoices, skip
            console.log(`Invoice ${invoice.invoice_number} already paid in Xero, skipping update`);
            results.success++;
            continue;
          }
        } else {
          // Create new invoice
          xeroResponse = await fetch(
            "https://api.xero.com/api.xro/2.0/Invoices",
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Xero-Tenant-Id": profile.xero_tenant_id,
                "Content-Type": "application/json",
                "Accept": "application/json",
              },
              body: JSON.stringify({ Invoices: [xeroInvoice] }),
            }
          );
        }

        if (!xeroResponse.ok) {
          const errorText = await xeroResponse.text();
          console.error(`Failed to sync invoice ${invoice.invoice_number}:`, errorText);

          await supabase
            .from("invoices")
            .update({
              xero_sync_error: `Xero API error: ${errorText.substring(0, 200)}`,
              xero_sync_status: "error",
            })
            .eq("id", invoice.id);

          await supabase.from("xero_sync_log").insert({
            user_id: user.id,
            entity_type: "invoice",
            entity_id: invoice.id,
            sync_direction: "to_xero",
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

        const xeroData: XeroInvoicesResponse = await xeroResponse.json();
        const createdInvoice = xeroData.Invoices[0];

        // Update invoice with Xero invoice ID
        await supabase
          .from("invoices")
          .update({
            xero_invoice_id: createdInvoice.InvoiceID,
            last_synced_to_xero: new Date().toISOString(),
            xero_sync_error: null,
            xero_sync_status: "synced",
          })
          .eq("id", invoice.id);

        // Log success
        await supabase.from("xero_sync_log").insert({
          user_id: user.id,
          entity_type: "invoice",
          entity_id: invoice.id,
          sync_direction: "to_xero",
          sync_status: "success",
        });

        results.success++;
        console.log(`Successfully synced invoice: ${invoice.invoice_number} (${createdInvoice.InvoiceID})`);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error(`Error syncing invoice ${invoice.id}:`, errorMessage);

        await supabase
          .from("invoices")
          .update({
            xero_sync_error: errorMessage.substring(0, 200),
            xero_sync_status: "error",
          })
          .eq("id", invoice.id);

        await supabase.from("xero_sync_log").insert({
          user_id: user.id,
          entity_type: "invoice",
          entity_id: invoice.id,
          sync_direction: "to_xero",
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

    console.log(`Invoice sync complete: ${results.success} succeeded, ${results.failed} failed`);

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
    console.error("Error in Xero invoice sync:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
