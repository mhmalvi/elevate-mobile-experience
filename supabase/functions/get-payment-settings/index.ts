import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders, createCorsResponse, createErrorResponse } from "../_shared/cors.ts";
import { decryptBankDetails, EncryptedBankAccountDetails } from "../_shared/encryption.ts";

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GET-PAYMENT-SETTINGS] ${step}${detailsStr}`);
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

    // SECURITY: Fetch only the authenticated user's profile
    const { data: profile, error: fetchError } = await supabaseClient
      .from('profiles')
      .select('bank_name_encrypted, bank_bsb_encrypted, bank_account_number_encrypted, bank_account_name_encrypted, payment_terms')
      .eq('user_id', user.id)
      .single();

    if (fetchError) {
      logStep('Fetch error', { error: fetchError.message });
      return createErrorResponse(req, fetchError.message, 500);
    }

    logStep('Profile fetched, checking for bank details');

    // SECURITY: Decrypt bank account details only if they exist
    let decryptedDetails: { bank_name?: string; bank_bsb?: string; bank_account_number?: string; bank_account_name?: string } = {};

    // Check if any encrypted bank details exist
    const hasEncryptedDetails = profile.bank_name_encrypted ||
                                 profile.bank_bsb_encrypted ||
                                 profile.bank_account_number_encrypted ||
                                 profile.bank_account_name_encrypted;

    if (hasEncryptedDetails) {
      try {
        const encryptedDetails: EncryptedBankAccountDetails = {
          bank_name_encrypted: profile.bank_name_encrypted,
          bank_bsb_encrypted: profile.bank_bsb_encrypted,
          bank_account_number_encrypted: profile.bank_account_number_encrypted,
          bank_account_name_encrypted: profile.bank_account_name_encrypted,
        };

        decryptedDetails = await decryptBankDetails(encryptedDetails);
        logStep('Bank details decrypted successfully');
      } catch (decryptError) {
        logStep('Decryption failed, returning empty bank details', {
          error: decryptError instanceof Error ? decryptError.message : 'Unknown error'
        });
        // Continue with empty details if decryption fails
      }
    } else {
      logStep('No encrypted bank details found');
    }

    return new Response(JSON.stringify({
      bank_name: decryptedDetails.bank_name || '',
      bank_bsb: decryptedDetails.bank_bsb || '',
      bank_account_number: decryptedDetails.bank_account_number || '',
      bank_account_name: decryptedDetails.bank_account_name || '',
      payment_terms: profile.payment_terms || 14,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep('ERROR', { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
