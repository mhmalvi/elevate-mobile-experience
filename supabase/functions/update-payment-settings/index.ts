import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders, createCorsResponse, createErrorResponse } from "../_shared/cors.ts";
import { encryptBankDetails, BankAccountDetails } from "../_shared/encryption.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";

interface UpdatePaymentSettingsRequest {
  bank_name?: string;
  bank_bsb?: string;
  bank_account_number?: string;
  bank_account_name?: string;
  payment_terms?: number;
}

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[UPDATE-PAYMENT-SETTINGS] ${step}${detailsStr}`);
};

serve(async (req) => {
  // SECURITY: Get secure CORS headers
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return createCorsResponse(req);
  }

  try {
    logStep('Function started');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // SECURITY: Require authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return createErrorResponse(req, 'Unauthorized - Missing authorization header', 401);
    }

    // SECURITY: Validate user token
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      logStep('Auth error', { error: authError });
      return createErrorResponse(req, 'Unauthorized - Invalid token', 401);
    }

    logStep('User authenticated', { userId: user.id });

    // Rate limiting
    const rateLimit = await checkRateLimit(supabaseClient, user.id, 'update-payment-settings', 10, 60);
    if (rateLimit.limited) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body: UpdatePaymentSettingsRequest = await req.json();

    // Prepare update object
    const updateData: any = {};

    // SECURITY: Encrypt bank account details if provided
    if (body.bank_name || body.bank_bsb || body.bank_account_number || body.bank_account_name) {
      logStep('Encrypting bank account details');

      const bankDetails: BankAccountDetails = {
        bank_name: body.bank_name,
        bank_bsb: body.bank_bsb,
        bank_account_number: body.bank_account_number,
        bank_account_name: body.bank_account_name,
      };

      const encryptedDetails = await encryptBankDetails(bankDetails);

      // Add encrypted fields to update
      Object.assign(updateData, encryptedDetails);

      // SECURITY: Clear plaintext fields (backward compatibility - keep for now)
      // In future migration, we'll remove plaintext columns entirely
      if (body.bank_name !== undefined) updateData.bank_name = null;
      if (body.bank_bsb !== undefined) updateData.bank_bsb = null;
      if (body.bank_account_number !== undefined) updateData.bank_account_number = null;
      if (body.bank_account_name !== undefined) updateData.bank_account_name = null;

      logStep('Bank details encrypted successfully');
    }

    // Add payment terms if provided
    if (body.payment_terms !== undefined) {
      updateData.payment_terms = body.payment_terms;
    }

    // SECURITY: Update only the authenticated user's profile
    const { data: profile, error: updateError } = await supabaseClient
      .from('profiles')
      .update(updateData)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) {
      logStep('Update error', { error: updateError.message });
      return createErrorResponse(req, updateError.message, 500);
    }

    logStep('Payment settings updated successfully');

    return new Response(JSON.stringify({
      success: true,
      message: 'Payment settings updated successfully',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep('ERROR', { message: errorMessage });
    return new Response(JSON.stringify({ error: "Failed to update payment settings" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
