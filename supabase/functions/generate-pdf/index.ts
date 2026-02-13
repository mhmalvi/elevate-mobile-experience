import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, createCorsResponse, createErrorResponse } from "../_shared/cors.ts";
import { generateProfessionalPDFHTML } from "./improved-template.ts";
import { generatePDFBinary } from "./pdf-generator.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";

interface PDFRequest {
  type: "quote" | "invoice";
  id: string;
  format?: "html" | "pdf";
}

async function fetchImageToBase64(url: string): Promise<string | undefined> {
  try {
    const response = await fetch(url);
    if (!response.ok) return undefined;
    const blob = await response.blob();
    const buffer = await blob.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    return base64; // jsPDF addImage handles base64 string directly if we pass format, or data URI
  } catch (e) {
    console.error("Error fetching image:", e);
    return undefined;
  }
}

serve(async (req) => {
  // SECURITY: Get secure CORS headers
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return createCorsResponse(req);
  }

  try {
    // SECURITY: Require authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return createErrorResponse(req, "Unauthorized - Missing authorization header", 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // SECURITY: Validate user token
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      console.error("[generate-pdf] Auth error:", authError);
      return createErrorResponse(req, "Unauthorized - Invalid token", 401);
    }

    const { type, id, format = "html" }: PDFRequest = await req.json();
    console.log(`[generate-pdf] Generating ${format.toUpperCase()} for ${type}: ${id} (user: ${user.id})`);

    // Rate limiting: 30 PDF generations per minute per user
    const rateLimit = await checkRateLimit(supabase, user.id, 'generate-pdf', 30, 60);
    if (rateLimit.limited) {
      return new Response(JSON.stringify({ error: 'Too many requests. Please wait before generating more PDFs.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rateLimit.retryAfterSeconds || 60) },
      });
    }

    let documentData: any;
    let lineItems: any[] = [];
    let profile: any = null;
    let client: any = null;
    let branding: any = null;

    if (type === "quote") {
      // SECURITY: Fetch quote with user ownership validation
      const { data: quote, error: quoteError } = await supabase
        .from("quotes")
        .select("*, clients(*)")
        .eq("id", id)
        .eq("user_id", user.id)  // ADDED: Verify user owns this quote
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

      // Fetch branding settings
      const { data: brandingData } = await supabase
        .from("branding_settings")
        .select("*")
        .eq("user_id", quote.user_id)
        .single();
      branding = brandingData;

    } else if (type === "invoice") {
      // SECURITY: Fetch invoice with user ownership validation
      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .select("*, clients(*)")
        .eq("id", id)
        .eq("user_id", user.id)  // ADDED: Verify user owns this invoice
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

      // Fetch branding settings
      const { data: brandingData } = await supabase
        .from("branding_settings")
        .select("*")
        .eq("user_id", invoice.user_id)
        .single();
      branding = brandingData;
    }

    // Generate HTML for PDF using new professional template
    const html = generateProfessionalPDFHTML({
      type,
      document: documentData,
      lineItems,
      profile,
      client,
      branding,
    });

    if (format === "pdf") {
      let logoBase64: string | undefined;
      const logoUrl = branding?.logo_url || profile?.logo_url;

      if (logoUrl) {
        // Check if logo is a relative supabase path or absolute
        if (!logoUrl.startsWith('http')) {
          // It might be a storage path, normally these are public URLs in this app context
          // If we need to sign it, that's complex. Assuming public URL for now.
          // If it's just a path, construct full URL
          const projectUrl = Deno.env.get("SUPABASE_URL")!;
          // This is a guess, usually apps store full public URL
          // If not, we skip logo for now to be safe
        } else {
          logoBase64 = await fetchImageToBase64(logoUrl);
        }
      }

      const pdfBytes = generatePDFBinary({
        type,
        document: documentData,
        lineItems,
        profile,
        client,
        branding,
      }, logoBase64);

      return new Response(pdfBytes.buffer as ArrayBuffer, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${type}-${documentData.id}.pdf"`
        },
      });
    }

    console.log("PDF HTML generated successfully");

    return new Response(JSON.stringify({ html, success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    // SECURITY: Log full details server-side only
    console.error("Error generating PDF:", errorMessage);
    // Return generic error to client
    return new Response(JSON.stringify({ error: "PDF generation failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});


