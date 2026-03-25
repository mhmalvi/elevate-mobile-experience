
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, createCorsResponse } from "../_shared/cors.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";

const MAX_SIGNATURE_BYTES = 512 * 1024; // 512 KB

serve(async (req) => {
    // SECURITY: Get secure CORS headers
    const corsHeaders = getCorsHeaders(req);

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return createCorsResponse(req);
    }

    try {
        // Create Supabase client with Service Role Key (Admin Access)
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Rate limiting for public endpoint (5 requests per minute per IP)
        const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
        const rateLimit = await checkRateLimit(supabase, clientIp, 'accept-quote', 5, 60);
        if (rateLimit.limited) {
            return new Response(JSON.stringify({ error: 'Too many requests' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rateLimit.retryAfterSeconds || 60) },
                status: 429,
            });
        }

        const { quote_id, signature_data, status, action } = await req.json();

        // SECURITY: Validate status to only allow expected values
        if (status && !['accepted', 'declined'].includes(status)) {
            return new Response(JSON.stringify({ error: 'Invalid status. Must be "accepted" or "declined".' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            });
        }

        // Input validation — quote_id is actually the public_token (UUID)
        if (!quote_id || typeof quote_id !== 'string') {
            return new Response(JSON.stringify({ error: 'Valid Quote token is required' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            });
        }

        // Validate UUID format to prevent injection
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(quote_id)) {
            return new Response(JSON.stringify({ error: 'Invalid Quote token format' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            });
        }

        // SECURITY: Validate signature_data size and type
        if (signature_data !== undefined && signature_data !== null) {
            if (typeof signature_data !== 'string') {
                return new Response(JSON.stringify({ error: 'Invalid signature_data type' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 400,
                });
            }
            if (signature_data.length > MAX_SIGNATURE_BYTES) {
                return new Response(JSON.stringify({ error: 'Signature data too large (max 512KB)' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 400,
                });
            }
        }

        console.log(`Processing quote action: ${action || 'accept'} for public_token=${quote_id.substring(0, 8)}...`);

        // SECURITY: Lookup by public_token (not internal id) to prevent UUID enumeration
        const { data: existingQuote, error: fetchError } = await supabase
            .from('quotes')
            .select('id, status')
            .eq('public_token', quote_id)
            .single();

        if (fetchError || !existingQuote) {
            return new Response(JSON.stringify({ error: 'Quote not found' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 404,
            });
        }

        let updateData: Record<string, unknown> = {};

        if (action === 'view') {
            updateData = { viewed_at: new Date().toISOString() };
            // Promote status to 'viewed' only when currently 'sent'
            if (existingQuote.status === 'sent') {
                updateData.status = 'viewed';
            }
        } else {
            // Default to accept/decline logic
            // Only allow transitions from 'sent' or 'viewed' states
            const allowedStates = ['sent', 'viewed'];
            if (!allowedStates.includes(existingQuote.status)) {
                return new Response(JSON.stringify({ error: `Quote cannot be modified in its current state: ${existingQuote.status}` }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 409,
                });
            }
            updateData = {
                status: status || 'accepted',
                accepted_at: new Date().toISOString()
            };
            if (signature_data) {
                updateData.signature_data = signature_data;
            }
        }

        // Perform update via Service Role using internal id (resolved from public_token above)
        const { error } = await supabase
            .from('quotes')
            .update(updateData)
            .eq('id', existingQuote.id);

        if (error) {
            console.error('Database update failed:', error);
            throw error;
        }

        // Return success without exposing internal data
        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Accept Quote Error:', errorMessage);
        return new Response(JSON.stringify({ error: 'Failed to process quote action' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
        });
    }
});
