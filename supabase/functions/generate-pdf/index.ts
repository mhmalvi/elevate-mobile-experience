import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PDFRequest {
  type: "quote" | "invoice";
  id: string;
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

    const { type, id }: PDFRequest = await req.json();
    console.log(`Generating PDF for ${type}: ${id}`);

    let documentData: any;
    let lineItems: any[] = [];
    let profile: any = null;
    let client: any = null;

    if (type === "quote") {
      // Fetch quote with client
      const { data: quote, error: quoteError } = await supabase
        .from("quotes")
        .select("*, clients(*)")
        .eq("id", id)
        .single();

      if (quoteError || !quote) {
        console.error("Quote not found:", quoteError);
        return new Response(JSON.stringify({ error: "Quote not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      documentData = quote;
      client = quote.clients;

      // Fetch line items
      const { data: items } = await supabase
        .from("quote_line_items")
        .select("*")
        .eq("quote_id", id)
        .order("sort_order");
      lineItems = items || [];

      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", quote.user_id)
        .single();
      profile = profileData;

    } else if (type === "invoice") {
      // Fetch invoice with client
      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .select("*, clients(*)")
        .eq("id", id)
        .single();

      if (invoiceError || !invoice) {
        console.error("Invoice not found:", invoiceError);
        return new Response(JSON.stringify({ error: "Invoice not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      documentData = invoice;
      client = invoice.clients;

      // Fetch line items
      const { data: items } = await supabase
        .from("invoice_line_items")
        .select("*")
        .eq("invoice_id", id)
        .order("sort_order");
      lineItems = items || [];

      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", invoice.user_id)
        .single();
      profile = profileData;
    }

    // Generate HTML for PDF
    const html = generatePDFHTML({
      type,
      document: documentData,
      lineItems,
      profile,
      client,
    });

    console.log("PDF HTML generated successfully");

    return new Response(JSON.stringify({ html, success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error generating PDF:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function generatePDFHTML(data: {
  type: string;
  document: any;
  lineItems: any[];
  profile: any;
  client: any;
}): string {
  const { type, document, lineItems, profile, client } = data;
  const isQuote = type === "quote";
  const docNumber = isQuote ? document.quote_number : document.invoice_number;
  const docTitle = isQuote ? "QUOTE" : "TAX INVOICE";

  const formatCurrency = (amount: number) => `$${(amount || 0).toFixed(2)}`;
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      font-size: 12px;
      line-height: 1.5;
      color: #1a1a1a;
      padding: 40px;
      background: #fff;
    }
    .header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid #3b82f6;
    }
    .logo-section h1 {
      font-size: 24px;
      font-weight: 700;
      color: #3b82f6;
      margin-bottom: 4px;
    }
    .logo-section p {
      color: #6b7280;
      font-size: 11px;
    }
    .doc-type {
      text-align: right;
    }
    .doc-type h2 {
      font-size: 28px;
      font-weight: 700;
      color: #1a1a1a;
      letter-spacing: 2px;
    }
    .doc-type .doc-number {
      font-size: 14px;
      color: #6b7280;
      margin-top: 4px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      margin-bottom: 30px;
    }
    .info-box h3 {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #6b7280;
      margin-bottom: 8px;
    }
    .info-box p {
      font-size: 12px;
      color: #1a1a1a;
    }
    .info-box .name {
      font-weight: 600;
      font-size: 14px;
      margin-bottom: 4px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    th {
      background: #f3f4f6;
      padding: 12px;
      text-align: left;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #6b7280;
      border-bottom: 1px solid #e5e7eb;
    }
    th:last-child { text-align: right; }
    td {
      padding: 12px;
      border-bottom: 1px solid #e5e7eb;
      vertical-align: top;
    }
    td:last-child { text-align: right; }
    .item-desc { font-weight: 500; }
    .item-type {
      font-size: 10px;
      color: #6b7280;
      text-transform: capitalize;
    }
    .totals {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 30px;
    }
    .totals-box {
      width: 280px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      font-size: 12px;
    }
    .total-row.grand {
      border-top: 2px solid #1a1a1a;
      margin-top: 8px;
      padding-top: 12px;
      font-size: 16px;
      font-weight: 700;
    }
    .total-row.grand .amount {
      color: #3b82f6;
    }
    .notes {
      background: #f9fafb;
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 30px;
    }
    .notes h4 {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #6b7280;
      margin-bottom: 8px;
    }
    .notes p {
      font-size: 11px;
      color: #4b5563;
    }
    .bank-details {
      background: #eff6ff;
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 30px;
    }
    .bank-details h4 {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #3b82f6;
      margin-bottom: 8px;
    }
    .bank-row {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      padding: 4px 0;
    }
    .bank-row .label { color: #6b7280; }
    .bank-row .value { font-weight: 500; }
    .footer {
      text-align: center;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 10px;
      color: #9ca3af;
    }
    .footer .abn {
      font-weight: 500;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo-section">
      <h1>${profile?.business_name || "TradieMate"}</h1>
      <p>${profile?.phone || ""}</p>
      <p>${profile?.email || ""}</p>
      <p>${profile?.address || ""}</p>
    </div>
    <div class="doc-type">
      <h2>${docTitle}</h2>
      <div class="doc-number">${docNumber}</div>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <h3>${isQuote ? "Quote For" : "Bill To"}</h3>
      <p class="name">${client?.name || "No client"}</p>
      ${client?.address ? `<p>${client.address}</p>` : ""}
      ${client?.suburb ? `<p>${client.suburb}${client.state ? `, ${client.state}` : ""}${client.postcode ? ` ${client.postcode}` : ""}</p>` : ""}
      ${client?.phone ? `<p>${client.phone}</p>` : ""}
      ${client?.email ? `<p>${client.email}</p>` : ""}
    </div>
    <div class="info-box">
      <h3>Details</h3>
      <p><strong>Date:</strong> ${formatDate(document.created_at)}</p>
      ${isQuote && document.valid_until ? `<p><strong>Valid Until:</strong> ${formatDate(document.valid_until)}</p>` : ""}
      ${!isQuote && document.due_date ? `<p><strong>Due Date:</strong> ${formatDate(document.due_date)}</p>` : ""}
      <p><strong>Title:</strong> ${document.title}</p>
    </div>
  </div>

  ${document.description ? `<p style="margin-bottom: 20px; color: #4b5563;">${document.description}</p>` : ""}

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th>Qty</th>
        <th>Unit Price</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      ${lineItems.map(item => `
        <tr>
          <td>
            <div class="item-desc">${item.description}</div>
            <div class="item-type">${item.item_type || "labour"}</div>
          </td>
          <td>${item.quantity} ${item.unit || "each"}</td>
          <td>${formatCurrency(item.unit_price)}</td>
          <td>${formatCurrency(item.total)}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-box">
      <div class="total-row">
        <span>Subtotal</span>
        <span>${formatCurrency(document.subtotal)}</span>
      </div>
      <div class="total-row">
        <span>GST (10%)</span>
        <span>${formatCurrency(document.gst)}</span>
      </div>
      <div class="total-row grand">
        <span>Total</span>
        <span class="amount">${formatCurrency(document.total)}</span>
      </div>
      ${!isQuote && document.amount_paid > 0 ? `
        <div class="total-row">
          <span>Amount Paid</span>
          <span>-${formatCurrency(document.amount_paid)}</span>
        </div>
        <div class="total-row" style="font-weight: 600;">
          <span>Balance Due</span>
          <span>${formatCurrency((document.total || 0) - (document.amount_paid || 0))}</span>
        </div>
      ` : ""}
    </div>
  </div>

  ${document.notes ? `
    <div class="notes">
      <h4>Notes</h4>
      <p>${document.notes}</p>
    </div>
  ` : ""}

  ${!isQuote && (profile?.bank_name || profile?.bank_bsb) ? `
    <div class="bank-details">
      <h4>Payment Details</h4>
      ${profile.bank_name ? `<div class="bank-row"><span class="label">Bank</span><span class="value">${profile.bank_name}</span></div>` : ""}
      ${profile.bank_account_name ? `<div class="bank-row"><span class="label">Account Name</span><span class="value">${profile.bank_account_name}</span></div>` : ""}
      ${profile.bank_bsb ? `<div class="bank-row"><span class="label">BSB</span><span class="value">${profile.bank_bsb}</span></div>` : ""}
      ${profile.bank_account_number ? `<div class="bank-row"><span class="label">Account</span><span class="value">${profile.bank_account_number}</span></div>` : ""}
    </div>
  ` : ""}

  <div class="footer">
    ${profile?.abn ? `<p class="abn">ABN: ${profile.abn}</p>` : ""}
    <p>Thank you for your business!</p>
  </div>
</body>
</html>
  `;
}
