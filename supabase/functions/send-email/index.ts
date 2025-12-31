import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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
        .single();
      branding = brandingData;

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
        .single();
      branding = brandingData;

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
    const baseUrl = Deno.env.get('APP_URL') || 'https://app.tradiemate.com.au';
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
                  ? `Please find your quote attached below. We've prepared this quote for "${documentTitle}" and would be happy to answer any questions you may have.`
                  : `Please find your invoice attached below for "${documentTitle}". We appreciate your business and prompt payment.`
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

    // Send email via Resend
    const emailResponse = await resend.emails.send({
      from: `${businessName} <onboarding@resend.dev>`,
      to: [recipient_email],
      subject: emailSubject,
      html: emailHtml,
    });

    console.log("Email sent successfully:", emailResponse);

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
