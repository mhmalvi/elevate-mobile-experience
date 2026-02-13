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

    // Soft delete related data (clients, quotes, invoices, jobs)
    const tables = ['clients', 'quotes', 'invoices', 'jobs'];

    for (const table of tables) {
      const { error } = await supabase
        .from(table)
        .update({ deleted_at: deletedAt })
        .eq("user_id", user.id);

      if (error) {
        console.error(`Error soft deleting ${table}:`, error);
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
