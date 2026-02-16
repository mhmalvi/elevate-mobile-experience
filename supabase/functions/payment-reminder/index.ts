import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, createCorsResponse, createErrorResponse } from "../_shared/cors.ts";

interface ReminderRequest {
  invoice_id?: string; // Optional: send reminder for specific invoice
  send_all_overdue?: boolean; // Optional: send reminders for all overdue invoices
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

    // SECURITY: Verify caller is authorized (authenticated user or service role)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Allow service role key (for cron) or validate user JWT
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    if (authHeader !== `Bearer ${supabaseServiceKey}`) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(
        authHeader.replace("Bearer ", "")
      );
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      console.error("Twilio credentials not configured");
      return new Response(
        JSON.stringify({ error: "SMS service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { invoice_id, send_all_overdue }: ReminderRequest = await req.json();

    console.log(`Payment reminder request: invoice_id=${invoice_id}, send_all_overdue=${send_all_overdue}`);

    let invoices: any[] = [];

    if (invoice_id) {
      // Fetch specific invoice
      const { data, error } = await supabase
        .from("invoices")
        .select("*, clients(*), profiles:user_id(business_name)")
        .eq("id", invoice_id)
        .single();

      if (error || !data) {
        console.error("Invoice not found:", error);
        return new Response(
          JSON.stringify({ error: "Invoice not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      invoices = [data];
    } else if (send_all_overdue) {
      // Fetch all overdue invoices
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from("invoices")
        .select("*, clients(*), profiles:user_id(business_name)")
        .lt("due_date", today)
        .not("status", "eq", "paid")
        .not("status", "eq", "cancelled");

      if (error) {
        console.error("Error fetching overdue invoices:", error);
        return new Response(
          JSON.stringify({ error: "Failed to fetch overdue invoices" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      invoices = data || [];
    } else {
      return new Response(
        JSON.stringify({ error: "Please provide invoice_id or set send_all_overdue to true" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${invoices.length} invoice(s) to send reminders for`);

    const results: { invoice_id: string; success: boolean; error?: string }[] = [];

    for (const invoice of invoices) {
      const client = invoice.clients;

      if (!client?.phone) {
        console.log(`Skipping invoice ${invoice.invoice_number}: No client phone number`);
        results.push({ invoice_id: invoice.id, success: false, error: "No client phone number" });
        continue;
      }

      const balance = (invoice.total || 0) - (invoice.amount_paid || 0);
      const businessName = invoice.profiles?.business_name || "Your service provider";

      const message = `Hi ${client.name}, this is a friendly reminder that Invoice ${invoice.invoice_number} for $${balance.toFixed(2)} is now overdue. Please arrange payment at your earliest convenience. Thank you! - ${businessName}`;

      try {
        // Send SMS via Twilio
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;

        const formData = new URLSearchParams();
        formData.append("To", client.phone);
        formData.append("From", twilioPhoneNumber);
        formData.append("Body", message);

        const twilioResponse = await fetch(twilioUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": "Basic " + btoa(`${twilioAccountSid}:${twilioAuthToken}`),
          },
          body: formData.toString(),
        });

        const twilioData = await twilioResponse.json();

        if (!twilioResponse.ok) {
          console.error(`Twilio error for invoice ${invoice.invoice_number}:`, twilioData);
          results.push({ invoice_id: invoice.id, success: false, error: twilioData.message || "SMS failed" });
          continue;
        }

        console.log(`SMS sent successfully for invoice ${invoice.invoice_number}:`, twilioData.sid);
        results.push({ invoice_id: invoice.id, success: true });

      } catch (smsError) {
        const errorMessage = smsError instanceof Error ? smsError.message : "Unknown error";
        console.error(`Error sending SMS for invoice ${invoice.invoice_number}:`, errorMessage);
        results.push({ invoice_id: invoice.id, success: false, error: errorMessage });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`Payment reminders complete: ${successCount} sent, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        failed: failCount,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in payment-reminder function:", errorMessage);
    return new Response(
      JSON.stringify({ error: "Payment reminder processing failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
