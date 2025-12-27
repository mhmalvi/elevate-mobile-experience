import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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

    // Get business profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', document.user_id)
      .single();
    profile = profileData;

    // Generate the share URL
    const baseUrl = Deno.env.get('SITE_URL') || 'https://tradiemate.lovable.app';
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
      // For SMS, we'll compose an sms: link for mobile devices
      // In production, you'd integrate with Twilio, MessageBird, etc.
      const smsBody = type === 'quote'
        ? `G'day! Here's your quote from ${businessName} for $${total}. View it here: ${shareUrl}`
        : `G'day! Here's your invoice from ${businessName} for $${total}. View it here: ${shareUrl}`;

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

      console.log('SMS notification prepared successfully');

      return new Response(
        JSON.stringify({ 
          success: true, 
          method: 'sms',
          smsUrl: `sms:${recipient.phone}?body=${encodeURIComponent(smsBody)}`,
          shareUrl,
          message: 'SMS prepared - opening messages app'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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