import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Twilio from "https://esm.sh/twilio@5.3.4";
import { getCorsHeaders, createCorsResponse, createErrorResponse } from "../_shared/cors.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";

interface SendInvoiceRequest {
  invoice_id: string;
  send_sms?: boolean;
  send_email?: boolean;
  custom_message?: string;
}

serve(async (req) => {
  // SECURITY: Get secure CORS headers
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return createCorsResponse(req);
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

    // Rate limiting: 20 sends per minute per user
    const rateLimit = await checkRateLimit(supabase, user.id, 'send-invoice', 20, 60);
    if (rateLimit.limited) {
      return new Response(JSON.stringify({ error: 'Too many requests. Please wait before sending more.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rateLimit.retryAfterSeconds || 60) },
      });
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
          email
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
    const warnings: string[] = [];

    // Send SMS if requested
    if (send_sms && invoice.clients.phone) {
      try {
        const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
        const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
        const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

        if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
          console.error("Twilio credentials not configured");
          warnings.push("SMS not sent: Twilio credentials are not configured.");
        } else {
          const twilioClient = Twilio(twilioAccountSid, twilioAuthToken);

          const businessName = invoice.profiles?.business_name || "Your Business";
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
        const smsErrorMessage = smsError instanceof Error ? smsError.message : "Unknown SMS error";
        console.error("Error sending SMS:", smsError);
        warnings.push(`SMS failed: ${smsErrorMessage}. Payment link is still valid.`);
        // Continue execution - payment link is still valid
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
          let emailErrorDetail = "Unknown error";
          try {
            const errorData = await emailResponse.json();
            emailErrorDetail = errorData.error || `HTTP ${emailResponse.status}`;
          } catch {
            emailErrorDetail = `HTTP ${emailResponse.status}`;
          }
          console.error("Error sending email:", emailErrorDetail);
          warnings.push(`Email failed: ${emailErrorDetail}. Payment link was created successfully.`);
        }
      } catch (emailError) {
        const emailErrorMessage = emailError instanceof Error ? emailError.message : "Unknown email error";
        console.error("Error sending email:", emailError);
        warnings.push(`Email failed: ${emailErrorMessage}. Payment link was created successfully.`);
        // Continue execution - payment link is still valid
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
      // Even if status update fails, payment link was created and notifications may have been sent.
      // Return partial success so the client knows what happened.
      warnings.push("Invoice status could not be updated, but the payment link is valid.");
      return new Response(
        JSON.stringify({
          success: false,
          partial_success: true,
          payment_url: paymentUrl,
          sms_sent: smsSent,
          email_sent: emailSent,
          invoice_id: invoice_id,
          warnings,
        }),
        { status: 207, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine if this was a full success or partial success
    const requestedSms = send_sms && !!invoice.clients.phone;
    const requestedEmail = send_email && !!invoice.clients.email;
    const allDeliveriesSucceeded =
      (!requestedSms || smsSent) && (!requestedEmail || emailSent);

    if (!allDeliveriesSucceeded) {
      console.log("Invoice sent with partial delivery failures:", warnings);
    } else {
      console.log("Invoice sent successfully");
    }

    // Use 207 Multi-Status when there are partial failures so the client
    // can distinguish full success from partial success
    const statusCode = allDeliveriesSucceeded ? 200 : 207;

    return new Response(
      JSON.stringify({
        success: allDeliveriesSucceeded,
        partial_success: !allDeliveriesSucceeded && warnings.length > 0,
        payment_url: paymentUrl,
        sms_sent: smsSent,
        email_sent: emailSent,
        invoice_id: invoice_id,
        warnings: warnings.length > 0 ? warnings : undefined,
      }),
      { status: statusCode, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error sending invoice:", error);
    return new Response(
      JSON.stringify({ error: "Failed to send invoice" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
