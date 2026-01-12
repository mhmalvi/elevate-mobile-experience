import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, createCorsResponse, createErrorResponse } from "../_shared/cors.ts";

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

// Check and increment usage for rate limiting
async function checkAndIncrementUsage(
  supabase: any,
  userId: string,
  tier: string,
  usageType: 'sms' | 'email'
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const monthYear = new Date().toISOString().slice(0, 7); // "2025-01"
  const limits = usageType === 'sms' ? SMS_LIMITS : { free: 10, solo: 50, crew: -1, pro: -1 };
  const limit = limits[tier] ?? limits.free;

  // Unlimited
  if (limit === -1) {
    return { allowed: true, used: 0, limit: -1 };
  }

  // Get current usage
  const column = usageType === 'sms' ? 'sms_sent' : 'emails_sent';
  const { data: existing } = await supabase
    .from('usage_tracking')
    .select('*')
    .eq('user_id', userId)
    .eq('month_year', monthYear)
    .maybeSingle();

  const currentUsage = existing?.[column] || 0;

  if (currentUsage >= limit) {
    return { allowed: false, used: currentUsage, limit };
  }

  // Increment usage
  if (existing) {
    await supabase
      .from('usage_tracking')
      .update({ [column]: currentUsage + 1 })
      .eq('user_id', userId)
      .eq('month_year', monthYear);
  } else {
    await supabase
      .from('usage_tracking')
      .insert({
        user_id: userId,
        month_year: monthYear,
        [column]: 1,
      });
  }

  return { allowed: true, used: currentUsage + 1, limit };
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

  // Format Australian phone number
  let formattedTo = to.replace(/\s+/g, '');
  if (formattedTo.startsWith('0')) {
    formattedTo = '+61' + formattedTo.slice(1);
  } else if (!formattedTo.startsWith('+')) {
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

    const { type, id, method, recipient }: NotificationRequest = await req.json();

    console.log(`Sending ${method} notification for ${type} ${id} to ${recipient.email || recipient.phone}`);

    // Get the document details
    let document: any;
    let profile: any;

    if (type === 'quote') {
      const { data } = await supabase
        .from('quotes')
        .select('*, clients(*)')
        .eq('id', id)
        .single();
      document = data;
    } else {
      const { data } = await supabase
        .from('invoices')
        .select('*, clients(*)')
        .eq('id', id)
        .single();
      document = data;
    }

    if (!document) {
      throw new Error(`${type} not found`);
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

    // Generate the share URL
    const baseUrl = Deno.env.get('APP_URL') || 'https://elevate-mobile-experience.vercel.app';
    const shareUrl = type === 'quote' 
      ? `${baseUrl}/q/${id}` 
      : `${baseUrl}/i/${id}`;

    const businessName = profile?.business_name || 'Your Tradie';
    const documentNumber = type === 'quote' ? document.quote_number : document.invoice_number;
    const total = Number(document.total).toFixed(2);

    if (method === 'email') {
      // For email, we'll compose a mailto link that the client can use
      // In production, you'd integrate with an email service like Resend, SendGrid, etc.
      const subject = type === 'quote' 
        ? `Quote ${documentNumber} from ${businessName}` 
        : `Invoice ${documentNumber} from ${businessName}`;
      
      const body = type === 'quote'
        ? `G'day ${recipient.name || 'mate'},\n\nHere's your quote from ${businessName}.\n\nQuote: ${documentNumber}\nTotal: $${total}\n\nView and accept your quote here:\n${shareUrl}\n\nCheers,\n${businessName}`
        : `G'day ${recipient.name || 'mate'},\n\nHere's your invoice from ${businessName}.\n\nInvoice: ${documentNumber}\nTotal: $${total}\n\nView your invoice here:\n${shareUrl}\n\nPayment details are included in the invoice.\n\nCheers,\n${businessName}`;

      // Update sent_at timestamp
      if (type === 'quote') {
        await supabase
          .from('quotes')
          .update({ sent_at: new Date().toISOString(), status: 'sent' })
          .eq('id', id);
      } else {
        await supabase
          .from('invoices')
          .update({ sent_at: new Date().toISOString(), status: 'sent' })
          .eq('id', id);
      }

      console.log('Email notification prepared successfully');

      return new Response(
        JSON.stringify({ 
          success: true, 
          method: 'email',
          mailto: `mailto:${recipient.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
          shareUrl,
          message: 'Email prepared - opening mail client'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (method === 'sms') {
      const smsBody = type === 'quote'
        ? `G'day! Here's your quote from ${businessName} for $${total}. View it here: ${shareUrl}`
        : `G'day! Here's your invoice from ${businessName} for $${total}. View it here: ${shareUrl}`;

      // Try to send via Twilio first
      const twilioResult = await sendTwilioSms(recipient.phone!, smsBody);

      // Update sent_at timestamp
      if (type === 'quote') {
        await supabase
          .from('quotes')
          .update({ sent_at: new Date().toISOString(), status: 'sent' })
          .eq('id', id);
      } else {
        await supabase
          .from('invoices')
          .update({ sent_at: new Date().toISOString(), status: 'sent' })
          .eq('id', id);
      }

      if (twilioResult.success) {
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
        // Fallback to SMS URL for native app
        console.log('Falling back to native SMS URL');
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
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});