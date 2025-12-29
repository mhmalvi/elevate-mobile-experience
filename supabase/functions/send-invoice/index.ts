import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Twilio from "https://esm.sh/twilio@5.3.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendInvoiceRequest {
  invoice_id: string;
  send_sms?: boolean;
  send_email?: boolean;
  custom_message?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase
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

    const { invoice_id, send_sms = true, send_email = false, custom_message }: SendInvoiceRequest = await req.json();

    console.log(`Sending invoice: ${invoice_id}, SMS: ${send_sms}, Email: ${send_email}`);

    if (!invoice_id) {
      return new Response(
        JSON.stringify({ error: "Invoice ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get invoice with client and profile info
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select(`
        *,
        clients (*),
        profiles:user_id (
          business_name,
          phone,
          email,
          stripe_account_id,
          stripe_charges_enabled
        )
      `)
      .eq("id", invoice_id)
      .eq("user_id", user.id) // Ensure user owns this invoice
      .single();

    if (invoiceError || !invoice) {
      console.error("Invoice not found:", invoiceError);
      return new Response(
        JSON.stringify({ error: "Invoice not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!invoice.clients) {
      return new Response(
        JSON.stringify({ error: "Invoice has no client associated" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if client has phone number for SMS
    if (send_sms && !invoice.clients.phone) {
      return new Response(
        JSON.stringify({ error: "Client has no phone number for SMS" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create payment link
    console.log("Creating payment link...");
    const paymentResponse = await fetch(
      `${supabaseUrl}/functions/v1/create-payment`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": authHeader,
        },
        body: JSON.stringify({
          invoice_id: invoice_id,
        }),
      }
    );

    if (!paymentResponse.ok) {
      const errorData = await paymentResponse.json();
      console.error("Error creating payment link:", errorData);
      return new Response(
        JSON.stringify({
          error: errorData.error || "Failed to create payment link"
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { url: paymentUrl } = await paymentResponse.json();
    console.log(`Payment link created: ${paymentUrl}`);

    let smsSent = false;
    let emailSent = false;

    // Send SMS if requested
    if (send_sms && invoice.clients.phone) {
      try {
        const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
        const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
        const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

        if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
          console.error("Twilio credentials not configured");
        } else {
          const twilioClient = Twilio(twilioAccountSid, twilioAuthToken);

          const businessName = invoice.profiles?.business_name || "TradieMate";
          const businessPhone = invoice.profiles?.phone || "";

          const smsMessage = `Hi ${invoice.clients.name},

Invoice from ${businessName}
Invoice #${invoice.invoice_number}
Amount: $${invoice.total.toFixed(2)} AUD

Pay now: ${paymentUrl}

${businessPhone ? `Questions? Call ${businessPhone}` : ""}`;

          console.log(`Sending SMS to ${invoice.clients.phone}...`);
          await twilioClient.messages.create({
            to: invoice.clients.phone,
            from: twilioPhoneNumber,
            body: smsMessage,
          });

          smsSent = true;
          console.log("SMS sent successfully");
        }
      } catch (smsError) {
        console.error("Error sending SMS:", smsError);
        // Continue execution even if SMS fails
      }
    }

    // Send Email if requested
    if (send_email && invoice.clients.email) {
      try {
        console.log(`Sending email to ${invoice.clients.email}...`);

        const emailResponse = await fetch(
          `${supabaseUrl}/functions/v1/send-email`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": authHeader,
            },
            body: JSON.stringify({
              type: "invoice",
              id: invoice_id,
              recipient_email: invoice.clients.email,
              recipient_name: invoice.clients.name,
              message: custom_message || `Please find your invoice attached. You can pay online using the link below.`,
            }),
          }
        );

        if (emailResponse.ok) {
          emailSent = true;
          console.log("Email sent successfully");
        } else {
          const errorData = await emailResponse.json();
          console.error("Error sending email:", errorData);
        }
      } catch (emailError) {
        console.error("Error sending email:", emailError);
        // Continue execution even if email fails
      }
    }

    // Update invoice status
    const { error: updateError } = await supabase
      .from("invoices")
      .update({
        status: invoice.status === "draft" ? "sent" : invoice.status,
        sent_at: new Date().toISOString(),
        stripe_payment_link: paymentUrl,
      })
      .eq("id", invoice_id);

    if (updateError) {
      console.error("Error updating invoice:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update invoice status" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Invoice sent successfully");

    return new Response(
      JSON.stringify({
        success: true,
        payment_url: paymentUrl,
        sms_sent: smsSent,
        email_sent: emailSent,
        invoice_id: invoice_id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error sending invoice:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
