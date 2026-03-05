import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decryptToken } from "../_shared/encryption.ts";
import { getCorsHeaders, createCorsResponse, createErrorResponse } from "../_shared/cors.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";

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
  Status: "DRAFT" | "SUBMITTED" | "AUTHORISED";
  CurrencyCode?: string;
}

interface XeroInvoicesResponse {
  Invoices: Array<{
    InvoiceID: string;
    InvoiceNumber: string;
    Status: string;
  }>;
}

// Mid-batch token refresh threshold: refresh proactively at 25 minutes
// to avoid expiry during a long sync (Xero tokens last 30 minutes)
const TOKEN_REFRESH_THRESHOLD_MS = 25 * 60 * 1000;

/**
 * Checks whether the Xero access token should be proactively refreshed
 * based on elapsed time since last refresh, and performs the refresh if needed.
 * Returns the current (possibly refreshed) access token.
 */
async function ensureFreshToken(
  accessToken: string,
  tokenObtainedAt: number,
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  authHeader: string,
  userId: string,
): Promise<{ accessToken: string; tokenObtainedAt: number }> {
  const elapsed = Date.now() - tokenObtainedAt;
  if (elapsed < TOKEN_REFRESH_THRESHOLD_MS) {
    return { accessToken, tokenObtainedAt };
  }

  console.log(`Token age ${Math.round(elapsed / 1000)}s exceeds threshold, refreshing proactively...`);

  const refreshResponse = await fetch(
    `${supabaseUrl}/functions/v1/xero-oauth`,
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
    throw new Error("Failed to refresh Xero token mid-batch. Please reconnect Xero.");
  }

  const { data: refreshedProfile } = await supabase
    .from("profiles")
    .select("xero_access_token")
    .eq("user_id", userId)
    .single();

  const newToken = await decryptToken(refreshedProfile.xero_access_token);
  console.log("Mid-batch token refresh successful.");
  return { accessToken: newToken, tokenObtainedAt: Date.now() };
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

    // Rate limiting
    const rateLimit = await checkRateLimit(supabase, user.id, 'xero-sync-invoices', 10, 60);
    if (rateLimit.limited) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { invoice_id, sync_all } = await req.json();

    // Get user's Xero credentials
    const { data: profile } = await supabase
      .from("profiles")
      .select("xero_tenant_id, xero_access_token, xero_refresh_token, xero_token_expires_at, xero_sync_enabled, xero_account_code, xero_tax_type")
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
    // Track when we obtained/refreshed the token for mid-batch refresh logic
    let tokenObtainedAt = Date.now();

    // Check if token is already expired and needs immediate refresh
    if (new Date(profile.xero_token_expires_at) < new Date()) {
      console.log("Access token expired, refreshing...");

      const refreshResponse = await fetch(
        `${supabaseUrl}/functions/v1/xero-oauth`,
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
      tokenObtainedAt = Date.now();
    } else {
      // Token not yet expired -- estimate how long ago it was obtained
      // so mid-batch refresh triggers at the right time.
      // Xero tokens last 30 minutes, so age = 30min - remaining time.
      const remainingMs = new Date(profile.xero_token_expires_at).getTime() - Date.now();
      const estimatedAge = (30 * 60 * 1000) - remainingMs;
      tokenObtainedAt = Date.now() - Math.max(0, estimatedAge);
    }

    // Determine which invoices to sync
    let invoicesToSync: any[];

    if (sync_all) {
      // Sync all invoices with pagination (Supabase default limit is 1000)
      const PAGE_SIZE = 500;
      let allInvoices: typeof invoicesToSync = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: page } = await supabase
          .from("invoices")
          .select("*, clients(*)")
          .eq("user_id", user.id)
          .in("status", ["sent", "paid", "partially_paid"])
          .is("deleted_at", null)
          .range(from, from + PAGE_SIZE - 1);

        const results = page || [];
        allInvoices = allInvoices.concat(results);
        hasMore = results.length === PAGE_SIZE;
        from += PAGE_SIZE;
      }

      invoicesToSync = allInvoices;
      console.log(`Fetched ${invoicesToSync.length} invoices to sync (paginated).`);
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
        // Proactively refresh token if approaching expiry (25 min threshold)
        ({ accessToken, tokenObtainedAt } = await ensureFreshToken(
          accessToken, tokenObtainedAt, supabase, supabaseUrl, authHeader, user.id
        ));

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
        let lineItems = invoice.line_items || [];

        // If no line items, create a default one using the invoice total
        if (lineItems.length === 0) {
          console.log(`Invoice ${invoice.invoice_number} has no line items, using total amount as fallback.`);
          lineItems = [{
            description: "Services",
            quantity: 1,
            unit_price: invoice.total || 0
          }];
        }

        // Default Australian GST settings - configurable per user in future
        // TODO: Add xero_account_code and xero_tax_type columns to profiles table for per-user configuration
        const accountCode = profile?.xero_account_code || "200"; // 200 = Sales (Xero AU default)
        const taxType = profile?.xero_tax_type || "OUTPUT"; // OUTPUT = GST on Income (AU default)

        // Build Xero line items
        const xeroLineItems: XeroLineItem[] = lineItems.map((item: any) => ({
          Description: item.description || "Service",
          Quantity: item.quantity || 1,
          UnitAmount: item.unit_price || 0,
          AccountCode: accountCode,
          TaxType: taxType,
        }));

        // Determine invoice status
        // NOTE: Xero API does not support creating invoices with Status: "PAID" directly.
        // Paid invoices must be created as AUTHORISED, then a payment allocation added
        // via the Xero Payments endpoint. For now, we create paid invoices as AUTHORISED.
        let xeroStatus: "DRAFT" | "SUBMITTED" | "AUTHORISED" = "AUTHORISED";
        if (invoice.status === "draft") {
          xeroStatus = "DRAFT";
        } else if (invoice.status === "paid" || invoice.status === "sent" || invoice.status === "partially_paid") {
          xeroStatus = "AUTHORISED";
        }

        // Build Xero invoice object
        const xeroInvoice: XeroInvoice = {
          Type: "ACCREC", // Accounts Receivable (customer invoice)
          Contact: {
            ContactID: invoice.clients.xero_contact_id,
          },
          Date: invoice.created_at.split('T')[0], // YYYY-MM-DD
          DueDate: invoice.due_date
            ? invoice.due_date.split('T')[0]
            : new Date(new Date(invoice.created_at).setDate(new Date(invoice.created_at).getDate() + 14)).toISOString().split('T')[0],
          LineAmountTypes: "Exclusive", // Prices exclude tax
          LineItems: xeroLineItems,
          InvoiceNumber: invoice.invoice_number,
          Reference: `Invoice ${invoice.invoice_number}`,
          Status: xeroStatus,
          // CurrencyCode removed to use organization default
        };

        // If invoice already has Xero ID, update; otherwise create
        let xeroInvoiceId = invoice.xero_invoice_id;
        let xeroResponse;

        if (xeroInvoiceId) {
          // Update existing invoice in Xero
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

          await supabase.from("integration_sync_log").insert({
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
        await supabase.from("integration_sync_log").insert({
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

        await supabase.from("integration_sync_log").insert({
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
      JSON.stringify({ error: "Invoice sync failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
