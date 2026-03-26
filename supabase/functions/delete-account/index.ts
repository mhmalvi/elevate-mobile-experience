import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, createCorsResponse, createErrorResponse } from "../_shared/cors.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";

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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limiting: 3 delete requests per hour per user (destructive action)
    const rateLimit = await checkRateLimit(supabase, user.id, 'delete-account', 3, 3600);
    if (rateLimit.limited) {
      return new Response(JSON.stringify({ error: 'Too many requests. Please wait before trying again.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rateLimit.retryAfterSeconds || 3600) },
      });
    }

    console.log(`Starting account deletion for user: ${user.id}`);

    // Fetch profile before any mutations so we have stripe_customer_id
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single();

    // Cancel any active Stripe subscriptions before deleting the account so
    // the customer is not billed after deletion.
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (stripeSecretKey && profile?.stripe_customer_id) {
      const customerId = profile.stripe_customer_id;
      try {
        // List all active/trialing subscriptions for this customer
        const listUrl =
          `https://api.stripe.com/v1/subscriptions?customer=${encodeURIComponent(customerId)}&status=active&limit=10`;
        const listRes = await fetch(listUrl, {
          headers: { Authorization: `Bearer ${stripeSecretKey}` },
        });

        if (listRes.ok) {
          const listData = await listRes.json();
          const subscriptions: Array<{ id: string }> = listData?.data ?? [];

          for (const sub of subscriptions) {
            const cancelRes = await fetch(
              `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(sub.id)}`,
              {
                method: "DELETE",
                headers: { Authorization: `Bearer ${stripeSecretKey}` },
              }
            );
            if (cancelRes.ok) {
              console.log(`Cancelled Stripe subscription ${sub.id} for customer ${customerId}`);
            } else {
              const cancelErr = await cancelRes.json().catch(() => ({}));
              console.error(`Failed to cancel Stripe subscription ${sub.id}:`, cancelErr);
            }
          }
        } else {
          const listErr = await listRes.json().catch(() => ({}));
          console.error(`Failed to list Stripe subscriptions for customer ${customerId}:`, listErr);
        }
      } catch (stripeError) {
        // Log but do not abort — we still want to delete the account even if
        // Stripe cancellation fails. Admins can reconcile via the Stripe dashboard.
        console.error("Stripe subscription cancellation error during account deletion:", stripeError);
      }
    }

    // Soft delete user data by setting deleted_at timestamp
    const deletedAt = new Date().toISOString();

    // Update profile with deleted_at
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ deleted_at: deletedAt })
      .eq("user_id", user.id);

    if (profileError) {
      console.error("Error soft deleting profile:", profileError);
    }

    // Soft delete related data (clients, quotes, invoices, jobs, subcontractors)
    const tables = ['clients', 'quotes', 'invoices', 'jobs', 'subcontractors'];

    for (const table of tables) {
      const { error } = await supabase
        .from(table)
        .update({ deleted_at: deletedAt })
        .eq("user_id", user.id);

      if (error) {
        console.error(`Error soft deleting ${table}:`, error);
      }
    }

    // Soft delete line items via parent invoices
    const { data: userInvoices } = await supabase
      .from("invoices")
      .select("id")
      .eq("user_id", user.id);

    if (userInvoices && userInvoices.length > 0) {
      const invoiceIds = userInvoices.map((inv: any) => inv.id);
      const { error: iliError } = await supabase
        .from("invoice_line_items")
        .update({ deleted_at: deletedAt })
        .in("invoice_id", invoiceIds);

      if (iliError) {
        console.error("Error soft deleting invoice_line_items:", iliError);
      }
    }

    // Soft delete line items via parent quotes
    const { data: userQuotes } = await supabase
      .from("quotes")
      .select("id")
      .eq("user_id", user.id);

    if (userQuotes && userQuotes.length > 0) {
      const quoteIds = userQuotes.map((q: any) => q.id);
      const { error: qliError } = await supabase
        .from("quote_line_items")
        .update({ deleted_at: deletedAt })
        .in("quote_id", quoteIds);

      if (qliError) {
        console.error("Error soft deleting quote_line_items:", qliError);
      }
    }

    // Remove team memberships
    const { error: tmError } = await supabase
      .from("team_members")
      .delete()
      .eq("user_id", user.id);

    if (tmError) {
      console.error("Error removing team_members:", tmError);
    }

    // Invalidate team invitations sent by this user
    const { error: tiError } = await supabase
      .from("team_invitations")
      .update({ status: "invalidated" })
      .eq("invited_by", user.id);

    if (tiError) {
      console.error("Error invalidating team_invitations:", tiError);
    }

    // Also invalidate invitations sent TO this user's email
    const userEmail = user.email;
    if (userEmail) {
      const { error: tiEmailError } = await supabase
        .from("team_invitations")
        .update({ status: "invalidated" })
        .eq("email", userEmail)
        .eq("status", "pending");

      if (tiEmailError) {
        console.error("Error invalidating team_invitations by email:", tiEmailError);
      }
    }

    // Hard delete from auth.users (this is permanent and removes login ability)
    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);

    if (deleteError) {
      console.error("Error deleting user from auth:", deleteError);
      return new Response(
        JSON.stringify({ error: "Failed to delete account" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Account deletion completed for user: ${user.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Account deleted successfully"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in delete-account function:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
