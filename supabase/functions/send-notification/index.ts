import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getCorsHeaders, createCorsResponse, createErrorResponse } from "../_shared/cors.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";

// SECURITY: Escape HTML special characters to prevent XSS in email templates
function escapeHtml(str: string | undefined | null): string {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

interface NotificationRequest {
  type: 'quote' | 'invoice';
  id: string;
  method: 'email' | 'sms';
  recipient: {
    email?: string;
    phone?: string;
    name?: string;
  };
}

// Tier limits for SMS
const SMS_LIMITS: Record<string, number> = {
  free: 5,
  solo: 25,
  crew: 100,
  pro: -1, // unlimited
};

// Atomic usage check and increment via database RPC to prevent race conditions
async function checkAndIncrementUsage(
  supabase: any,
  userId: string,
  tier: string,
  usageType: 'sms' | 'email'
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const limits = usageType === 'sms' ? SMS_LIMITS : { free: 10, solo: 50, crew: -1, pro: -1 };
  const limit = limits[tier] ?? limits.free;

  // Unlimited
  if (limit === -1) {
    return { allowed: true, used: 0, limit: -1 };
  }

  // Ensure a usage_tracking row exists for this month
  const monthYear = new Date().toISOString().slice(0, 7);
  await supabase
    .from('usage_tracking')
    .upsert({ user_id: userId, month_year: monthYear }, { onConflict: 'user_id,month_year', ignoreDuplicates: true });

  // Atomic increment-if-under-limit at the database level
  const column = usageType === 'sms' ? 'sms_sent' : 'emails_sent';
  const { data: allowed, error } = await supabase.rpc('increment_usage_if_under_limit', {
    p_user_id: userId,
    p_field: column,
    p_limit: limit,
  });

  if (error) {
    console.error('Usage tracking RPC error:', error.message);
    // Fail closed: deny if we cannot verify usage
    return { allowed: false, used: limit, limit };
  }

  if (!allowed) {
    return { allowed: false, used: limit, limit };
  }

  return { allowed: true, used: 0, limit };
}

// Send SMS via Twilio API
async function sendTwilioSms(to: string, body: string): Promise<{ success: boolean; error?: string }> {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

  if (!accountSid || !authToken || !fromNumber) {
    console.log('Twilio not configured, falling back to SMS URL');
    return { success: false, error: 'Twilio not configured' };
  }

  // Format phone number: handle international and Australian numbers
  let formattedTo = to.replace(/[\s\-()]/g, '');
  if (formattedTo.startsWith('+')) {
    // Already international format, use as-is
  } else if (formattedTo.startsWith('0')) {
    // Australian local format: replace leading 0 with +61
    formattedTo = '+61' + formattedTo.slice(1);
  } else if (/^\d{9,15}$/.test(formattedTo)) {
    // Looks like a full international number without +, prepend +
    formattedTo = '+' + formattedTo;
  } else {
    // Default: assume Australian
    formattedTo = '+61' + formattedTo;
  }

  console.log(`Sending SMS via Twilio from ${fromNumber} to ${formattedTo}`);

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: formattedTo,
          From: fromNumber,
          Body: body,
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error('Twilio error:', result);
      return { success: false, error: result.message || 'Failed to send SMS' };
    }

    console.log('Twilio SMS sent successfully:', result.sid);
    return { success: true };
  } catch (error) {
    console.error('Twilio request failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Gate status update on confirmed delivery: only call this after a provider
// confirms the message was accepted. Fallback (mailto/smsUrl) paths must NOT
// call this function because the document has not been demonstrably delivered.
async function markDocumentSent(supabase: any, type: 'quote' | 'invoice', id: string): Promise<void> {
  const table = type === 'quote' ? 'quotes' : 'invoices';
  const { error } = await supabase
    .from(table)
    .update({ sent_at: new Date().toISOString(), status: 'sent' })
    .eq('id', id);
  if (error) {
    console.error(`Failed to mark ${type} ${id} as sent:`, error.message);
  }
}

serve(async (req) => {
  // SECURITY: Get secure CORS headers
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return createCorsResponse(req);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // SECURITY: Verify user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return createErrorResponse(req, 'Missing Authorization header', 401);
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return createErrorResponse(req, 'Invalid token', 401);
    }

    // SECURITY: Rate Limiting (10 req/min)
    const rateLimit = await checkRateLimit(supabase, user.id, 'send-notification', 10, 60);
    if (rateLimit.limited) {
      return new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rateLimit.retryAfterSeconds) },
      });
    }

    const { type, id, method, recipient }: NotificationRequest = await req.json();

    console.log(`Sending ${method} notification for ${type} ${id} to ${recipient.email || recipient.phone}`);

    // Get the document details
    let document: any;
    let profile: any;

    // SECURITY: Filter by user_id directly in the query to prevent TOCTOU issues
    if (type === 'quote') {
      const { data } = await supabase
        .from('quotes')
        .select('*, clients(*)')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();
      document = data;
    } else {
      const { data } = await supabase
        .from('invoices')
        .select('*, clients(*)')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();
      document = data;
    }

    if (!document) {
      throw new Error(`${type} not found or access denied`);
    }

    // Resolve public_token for client-facing URL; generate and persist if absent
    let publicToken: string;
    if (document.public_token) {
      publicToken = document.public_token;
    } else {
      publicToken = crypto.randomUUID();
      const table = type === 'quote' ? 'quotes' : 'invoices';
      await supabase
        .from(table)
        .update({ public_token: publicToken })
        .eq('id', id);
      console.log(`Generated and saved public_token for ${type} ${id}`);
    }

    // Get business profile and subscription tier
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', document.user_id)
      .single();
    profile = profileData;

    const tier = profile?.subscription_tier || 'free';

    // Check rate limits
    const usageType = method === 'sms' ? 'sms' : 'email';
    const usageCheck = await checkAndIncrementUsage(supabase, document.user_id, tier, usageType);

    if (!usageCheck.allowed) {
      console.log(`Rate limit exceeded for ${usageType}: ${usageCheck.used}/${usageCheck.limit}`);
      return new Response(
        JSON.stringify({
          error: `Monthly ${usageType.toUpperCase()} limit reached (${usageCheck.used}/${usageCheck.limit}). Upgrade your plan for more.`,
          limitReached: true,
          used: usageCheck.used,
          limit: usageCheck.limit,
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate the share URL using public_token so internal UUIDs are never exposed
    const baseUrl = Deno.env.get('APP_URL') || 'https://app.tradiemate.com.au';
    const shareUrl = type === 'quote'
      ? `${baseUrl}/public/quote/${publicToken}`
      : `${baseUrl}/public/invoice/${publicToken}`;

    // SEC-M3: Strip CR/LF to prevent header injection when businessName is used in From: header
    const businessName = (profile?.business_name || 'Your Business').replace(/[
]/g, '');
    const documentNumber = type === 'quote' ? document.quote_number : document.invoice_number;
    const total = Number(document.total).toFixed(2);

    if (method === 'email') {
      const subject = type === 'quote'
        ? `Quote ${documentNumber} from ${businessName}`
        : `Invoice ${documentNumber} from ${businessName}`;

      const htmlBody = type === 'quote'
        ? `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #45201c;">Quote from ${escapeHtml(businessName)}</h2>
            <p>Hi ${escapeHtml(recipient.name) || 'there'},</p>
            <p>Here's your quote for <strong>${escapeHtml(total)}</strong>.</p>
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Quote Number:</strong> ${escapeHtml(documentNumber)}</p>
              <p style="margin: 10px 0 0 0;"><strong>Total:</strong> ${escapeHtml(total)}</p>
            </div>
            <a href="${shareUrl}" style="display: inline-block; background: #45201c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">View Quote</a>
            <p>Thanks,<br>${escapeHtml(businessName)}</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #888; font-size: 12px;">Powered by your business management app</p>
          </div>
        `
        : `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #45201c;">Invoice from ${escapeHtml(businessName)}</h2>
            <p>Hi ${escapeHtml(recipient.name) || 'there'},</p>
            <p>Here's your invoice for <strong>${escapeHtml(total)}</strong>.</p>
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Invoice Number:</strong> ${escapeHtml(documentNumber)}</p>
              <p style="margin: 10px 0 0 0;"><strong>Total:</strong> ${escapeHtml(total)}</p>
            </div>
            <a href="${shareUrl}" style="display: inline-block; background: #45201c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">View & Pay Invoice</a>
            <p>Payment details are included in the invoice.</p>
            <p>Thanks,<br>${escapeHtml(businessName)}</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #888; font-size: 12px;">Powered by your business management app</p>
          </div>
        `;

      const plainTextBody = type === 'quote'
        ? `Hi ${escapeHtml(recipient.name) || 'there'},\n\nHere's your quote from ${businessName}.\n\nQuote: ${documentNumber}\nTotal: ${escapeHtml(total)}\n\nView and accept your quote here:\n${shareUrl}\n\nThanks,\n${businessName}`
        : `Hi ${escapeHtml(recipient.name) || 'there'},\n\nHere's your invoice from ${businessName}.\n\nInvoice: ${documentNumber}\nTotal: ${escapeHtml(total)}\n\nView your invoice here:\n${shareUrl}\n\nPayment details are included in the invoice.\n\nThanks,\n${businessName}`;

      // Try to send via Resend first
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      let emailSent = false;

      if (resendApiKey && recipient.email) {
        try {
          const resend = new Resend(resendApiKey);
          const fromEmail = `${businessName} <onboarding@resend.dev>`;

          console.log(`Sending email via Resend from ${fromEmail} to ${recipient.email}`);

          const emailResponse = await resend.emails.send({
            from: fromEmail,
            to: [recipient.email],
            subject: subject,
            html: htmlBody,
          });

          if (emailResponse.error) {
            console.error('Resend error:', emailResponse.error);
          } else {
            console.log('Email sent successfully via Resend:', emailResponse.data?.id);
            emailSent = true;
          }
        } catch (error) {
          console.error('Failed to send via Resend:', error);
        }
      }

      if (emailSent) {
        // Only mark as sent after confirmed delivery by the email provider
        await markDocumentSent(supabase, type, id);
        console.log('Email sent successfully via Resend');
        return new Response(
          JSON.stringify({
            success: true,
            method: 'email',
            directSend: true,
            shareUrl,
            message: 'Email sent successfully!'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        // Delivery not confirmed: do NOT mark the document as sent.
        // The client receives a mailto fallback and is responsible for
        // actually dispatching the message.
        console.log('Falling back to mailto link; status not updated');
        return new Response(
          JSON.stringify({
            success: true,
            method: 'email',
            directSend: false,
            mailto: `mailto:${recipient.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(plainTextBody)}`,
            shareUrl,
            message: 'Email prepared - opening mail client'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (method === 'sms') {
      const smsBody = type === 'quote'
        ? `Hi! Here's your quote from ${businessName} for ${escapeHtml(total)}. View it here: ${shareUrl}`
        : `Hi! Here's your invoice from ${businessName} for ${escapeHtml(total)}. View it here: ${shareUrl}`;

      // SECURITY: Validate phone number exists before attempting SMS
      if (!recipient.phone) {
        return new Response(
          JSON.stringify({ error: 'Phone number is required for SMS notifications' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Try to send via Twilio first
      const twilioResult = await sendTwilioSms(recipient.phone, smsBody);

      if (twilioResult.success) {
        // Only mark as sent after Twilio confirms message acceptance
        await markDocumentSent(supabase, type, id);
        console.log('SMS sent successfully via Twilio');
        return new Response(
          JSON.stringify({
            success: true,
            method: 'sms',
            directSend: true,
            shareUrl,
            message: 'SMS sent successfully!'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        // Delivery not confirmed: do NOT mark the document as sent.
        // The client receives a native SMS URL and is responsible for
        // actually dispatching the message.
        console.log('Falling back to native SMS URL; status not updated');
        return new Response(
          JSON.stringify({
            success: true,
            method: 'sms',
            directSend: false,
            smsUrl: `sms:${recipient.phone}?body=${encodeURIComponent(smsBody)}`,
            shareUrl,
            message: 'SMS prepared - opening messages app'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    throw new Error('Invalid notification method');

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error sending notification:', errorMessage);
    return new Response(
      JSON.stringify({ error: "Notification delivery failed" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});