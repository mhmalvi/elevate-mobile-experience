import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getCorsHeaders, createCorsResponse, createErrorResponse } from "../_shared/cors.ts";

interface EmailRequest {
  type: "quote" | "invoice";
  id: string;
  recipient_email: string;
  recipient_name?: string;
  subject?: string;
  message?: string;
}

// Tier limits for emails
const EMAIL_LIMITS: Record<string, number> = {
  free: 10,
  solo: 50,
  crew: -1, // unlimited
  pro: -1,
};

// Check and increment usage for rate limiting
async function checkAndIncrementUsage(
  supabase: any,
  userId: string,
  tier: string
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const monthYear = new Date().toISOString().slice(0, 7);
  const limit = EMAIL_LIMITS[tier] ?? EMAIL_LIMITS.free;

  if (limit === -1) {
    return { allowed: true, used: 0, limit: -1 };
  }

  const { data: existing } = await supabase
    .from('usage_tracking')
    .select('*')
    .eq('user_id', userId)
    .eq('month_year', monthYear)
    .maybeSingle();

  const currentUsage = existing?.emails_sent || 0;

  if (currentUsage >= limit) {
    return { allowed: false, used: currentUsage, limit };
  }

  if (existing) {
    await supabase
      .from('usage_tracking')
      .update({ emails_sent: currentUsage + 1 })
      .eq('user_id', userId)
      .eq('month_year', monthYear);
  } else {
    await supabase
      .from('usage_tracking')
      .insert({
        user_id: userId,
        month_year: monthYear,
        emails_sent: 1,
      });
  }

  return { allowed: true, used: currentUsage + 1, limit };
}

serve(async (req) => {
  // SECURITY: Get secure CORS headers
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return createCorsResponse(req);
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resend = new Resend(resendApiKey);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { type, id, recipient_email, recipient_name, subject, message }: EmailRequest = await req.json();

    console.log(`Sending ${type} email to ${recipient_email}`);

    if (!recipient_email) {
      return new Response(
        JSON.stringify({ error: "Recipient email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch document data
    let documentData: any;
    let profile: any;
    let branding: any;
    let documentNumber: string;
    let documentTitle: string;
    let lineItems: any[] = [];

    if (type === "quote") {
      const { data, error } = await supabase
        .from("quotes")
        .select("*, clients(*)")
        .eq("id", id)
        .single();

      if (error || !data) {
        return new Response(
          JSON.stringify({ error: "Quote not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      documentData = data;
      documentNumber = data.quote_number;
      documentTitle = data.title;

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", data.user_id)
        .single();
      profile = profileData;

      // Fetch branding settings
      const { data: brandingData } = await supabase
        .from("branding_settings")
        .select("*")
        .eq("user_id", data.user_id)
        .maybeSingle();
      branding = brandingData;

      // Fetch line items for quote
      const { data: items } = await supabase
        .from("quote_line_items")
        .select("*")
        .eq("quote_id", id)
        .order("sort_order");
      lineItems = items || [];

    } else if (type === "invoice") {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, clients(*)")
        .eq("id", id)
        .single();

      if (error || !data) {
        return new Response(
          JSON.stringify({ error: "Invoice not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      documentData = data;
      documentNumber = data.invoice_number;
      documentTitle = data.title;

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", data.user_id)
        .single();
      profile = profileData;

      // Fetch branding settings
      const { data: brandingData } = await supabase
        .from("branding_settings")
        .select("*")
        .eq("user_id", data.user_id)
        .maybeSingle();
      branding = brandingData;

      // Fetch line items for invoice
      const { data: items } = await supabase
        .from("invoice_line_items")
        .select("*")
        .eq("invoice_id", id)
        .order("sort_order");
      lineItems = items || [];

    } else if (type === "team_invitation") {
      // Simple handling for team invitations
      const businessName = "TradieMate";
      const fromEmail = `${businessName} <onboarding@resend.dev>`;

      console.log(`Sending invitation email to ${recipient_email}`);

      const emailResponse = await resend.emails.send({
        from: fromEmail,
        to: [recipient_email],
        subject: subject || "You've been invited to join a team on TradieMate",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Team Invitation</h2>
            <p>${message}</p>
            <p>If you didn't expect this invitation, you can ignore this email.</p>
            <p>Powered by <a href="https://tradiemate.com.au">TradieMate</a></p>
          </div>
        `,
      });

      if (emailResponse.error) {
        throw new Error(emailResponse.error.message);
      }

      return new Response(
        JSON.stringify({ success: true, message: "Invitation sent successfully" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else {
      return new Response(
        JSON.stringify({ error: "Invalid document type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check rate limits
    const tier = profile?.subscription_tier || 'free';
    const usageCheck = await checkAndIncrementUsage(supabase, documentData.user_id, tier);

    if (!usageCheck.allowed) {
      console.log(`Email rate limit exceeded: ${usageCheck.used}/${usageCheck.limit}`);
      return new Response(
        JSON.stringify({
          error: `Monthly email limit reached (${usageCheck.used}/${usageCheck.limit}). Upgrade your plan for more.`,
          limitReached: true,
          used: usageCheck.used,
          limit: usageCheck.limit,
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const businessName = profile?.business_name || "TradieMate";
    const baseUrl = Deno.env.get('APP_URL') || 'https://elevate-mobile-experience.vercel.app';
    const viewUrl = `${baseUrl}/${type === 'quote' ? 'q' : 'i'}/${id}`;

    // Extract branding values with fallbacks
    const primaryColor = branding?.primary_color || '#3b82f6';
    const secondaryColor = branding?.secondary_color || '#1d4ed8';
    const emailHeaderColor = branding?.email_header_color || primaryColor;
    const logoUrl = branding?.logo_url || profile?.logo_url;
    const emailSignature = branding?.email_signature;
    const footerText = branding?.email_footer_text || 'Thank you for your business!';

    const emailSubject = subject || `${type === 'quote' ? 'Quote' : 'Invoice'} ${documentNumber} from ${businessName}`;

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

          <!-- Header -->
          <tr>
            <td style="background: ${emailHeaderColor}; padding: 32px; text-align: center;">
              ${logoUrl ? `<img src="${logoUrl}" alt="${businessName}" style="max-width: 180px; max-height: 60px; margin-bottom: 12px;" />` : ''}
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">${businessName}</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 32px;">
              <p style="margin: 0 0 16px; color: #374151; font-size: 16px; line-height: 1.6;">
                Hi ${recipient_name || 'there'},
              </p>
              
              ${message ? `<p style="margin: 0 0 24px; color: #374151; font-size: 16px; line-height: 1.6;">${message}</p>` : ''}
              
              <p style="margin: 0 0 24px; color: #374151; font-size: 16px; line-height: 1.6;">
                ${type === 'quote'
        ? `We've prepared this quote for "${documentTitle}". Please review the details below and let us know if you have any questions.`
        : `Thank you for your business! Please find your invoice below for "${documentTitle}". We appreciate your prompt payment.`
      }
              </p>
              
              <!-- Document Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; margin: 24px 0;">
                <tr>
                  <td style="padding: 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <p style="margin: 0 0 4px; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
                            ${type === 'quote' ? 'Quote' : 'Invoice'} Number
                          </p>
                          <p style="margin: 0 0 16px; color: #1f2937; font-size: 18px; font-weight: 600;">
                            ${documentNumber}
                          </p>
                        </td>
                        <td align="right">
                          <p style="margin: 0 0 4px; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
                            Total
                          </p>
                          <p style="margin: 0; color: ${primaryColor}; font-size: 24px; font-weight: 700;">
                            $${(documentData.total || 0).toFixed(2)}
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Line Items Table -->
              ${lineItems.length > 0 ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                <!-- Table Header -->
                <tr style="background-color: #f9fafb;">
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">
                    <p style="margin: 0; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase;">Item</p>
                  </td>
                  <td align="center" style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">
                    <p style="margin: 0; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase;">Qty</p>
                  </td>
                  <td align="right" style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">
                    <p style="margin: 0; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase;">Rate</p>
                  </td>
                  <td align="right" style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">
                    <p style="margin: 0; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase;">Amount</p>
                  </td>
                </tr>
                <!-- Line Items -->
                ${lineItems.map((item: any, index: number) => `
                <tr style="border-bottom: ${index < lineItems.length - 1 ? '1px solid #e5e7eb' : 'none'};">
                  <td style="padding: 16px;">
                    <p style="margin: 0 0 4px; color: #1f2937; font-size: 14px; font-weight: 500;">${item.description || item.name || 'Item'}</p>
                    ${item.notes ? `<p style="margin: 0; color: #6b7280; font-size: 12px;">${item.notes}</p>` : ''}
                  </td>
                  <td align="center" style="padding: 16px;">
                    <p style="margin: 0; color: #1f2937; font-size: 14px;">${item.quantity || 1}</p>
                  </td>
                  <td align="right" style="padding: 16px;">
                    <p style="margin: 0; color: #1f2937; font-size: 14px;">$${(item.unit_price || item.rate || 0).toFixed(2)}</p>
                  </td>
                  <td align="right" style="padding: 16px;">
                    <p style="margin: 0; color: #1f2937; font-size: 14px; font-weight: 500;">$${(item.total || (item.quantity || 1) * (item.unit_price || item.rate || 0)).toFixed(2)}</p>
                  </td>
                </tr>
                `).join('')}
                <!-- Totals -->
                ${documentData.subtotal ? `
                <tr style="background-color: #f9fafb;">
                  <td colspan="3" align="right" style="padding: 12px 16px; border-top: 2px solid #e5e7eb;">
                    <p style="margin: 0; color: #6b7280; font-size: 14px;">Subtotal:</p>
                  </td>
                  <td align="right" style="padding: 12px 16px; border-top: 2px solid #e5e7eb;">
                    <p style="margin: 0; color: #1f2937; font-size: 14px;">$${(documentData.subtotal || 0).toFixed(2)}</p>
                  </td>
                </tr>
                ` : ''}
                ${documentData.tax && documentData.tax > 0 ? `
                <tr style="background-color: #f9fafb;">
                  <td colspan="3" align="right" style="padding: 12px 16px;">
                    <p style="margin: 0; color: #6b7280; font-size: 14px;">Tax${documentData.tax_rate ? ` (${documentData.tax_rate}%)` : ''}:</p>
                  </td>
                  <td align="right" style="padding: 12px 16px;">
                    <p style="margin: 0; color: #1f2937; font-size: 14px;">$${(documentData.tax || 0).toFixed(2)}</p>
                  </td>
                </tr>
                ` : ''}
                <tr style="background-color: ${primaryColor};">
                  <td colspan="3" align="right" style="padding: 16px;">
                    <p style="margin: 0; color: #ffffff; font-size: 16px; font-weight: 600;">Total:</p>
                  </td>
                  <td align="right" style="padding: 16px;">
                    <p style="margin: 0; color: #ffffff; font-size: 18px; font-weight: 700;">$${(documentData.total || 0).toFixed(2)}</p>
                  </td>
                </tr>
              </table>
              ` : ''}

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 16px 0;">
                    <a href="${viewUrl}" style="display: inline-block; background: ${primaryColor}; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                      View ${type === 'quote' ? 'Quote' : 'Invoice'}
                    </a>
                  </td>
                </tr>
              </table>

              ${emailSignature ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
                <tr>
                  <td>
                    <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.6; white-space: pre-line;">${emailSignature}</p>
                  </td>
                </tr>
              </table>
              ` : ''}

              <p style="margin: 24px 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                If you have any questions, please don't hesitate to reach out.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 32px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px; text-align: center;">
                ${footerText}
              </p>
              ${profile?.phone ? `<p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">${profile.phone}</p>` : ''}
              ${profile?.email ? `<p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">${profile.email}</p>` : ''}
              <p style="margin: 16px 0 0; color: #9ca3af; font-size: 11px; text-align: center;">
                Powered by TradieMate
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    // Get sender email - use custom domain if configured, otherwise use Resend's default
    const customEmailDomain = Deno.env.get("EMAIL_FROM_DOMAIN"); // e.g., "noreply@tradiemate.com.au"
    const appUrl = Deno.env.get("APP_URL") || "";
    const isProduction = appUrl.includes("tradiemate.com.au") || appUrl.includes("production");

    // Use custom domain or default to Resend's onboarding domain (no verification needed)
    let fromEmail: string;
    if (customEmailDomain) {
      fromEmail = customEmailDomain;
    } else {
      // Use Resend's default onboarding domain (pre-verified, works immediately)
      // Can upgrade to custom domain later: https://resend.com/docs/dashboard/domains/introduction
      fromEmail = `${businessName} <onboarding@resend.dev>`;
    }

    console.log(`[${isProduction ? 'PRODUCTION' : 'DEV'}] Sending email from: ${fromEmail} to: ${recipient_email}`);

    // Send email via Resend
    const emailResponse = await resend.emails.send({
      from: fromEmail,
      to: [recipient_email],
      subject: emailSubject,
      html: emailHtml,
    });

    console.log("Email response:", JSON.stringify(emailResponse));

    // Resend v2 returns { data: { id: '...' }, error: null } on success
    // or { data: null, error: { message: '...' } } on failure
    if (emailResponse.error) {
      console.error("Resend API error:", emailResponse.error);
      throw new Error(emailResponse.error.message || "Failed to send email");
    }

    // Check if email was actually sent (Resend returns id on success)
    const emailId = emailResponse.data?.id || emailResponse.id;
    if (!emailId) {
      console.error("Email may not have been sent - no ID returned:", emailResponse);
      throw new Error("Email service did not confirm delivery");
    }

    console.log("Email sent successfully with ID:", emailId);

    // Update document status to 'sent' if it was in draft
    if (documentData.status === 'draft') {
      const tableName = type === 'quote' ? 'quotes' : 'invoices';
      await supabase
        .from(tableName)
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', id);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Email sent successfully" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error sending email:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
