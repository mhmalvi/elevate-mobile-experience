
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { getCorsHeaders, createCorsResponse } from "../_shared/cors.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";

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

        // Input validation
        if (!quote_id || typeof quote_id !== 'string') {
            return new Response(JSON.stringify({ error: 'Valid Quote ID is required' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            });
        }

        // Validate UUID format to prevent injection
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(quote_id)) {
            return new Response(JSON.stringify({ error: 'Invalid Quote ID format' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            });
        }

        console.log(`Processing quote action: ${action || 'accept'} for ${quote_id}`);

        let updateData: any = {};

        if (action === 'view') {
            updateData = {
                viewed_at: new Date().toISOString(),
                // Only set status to 'viewed' if it was 'sent'
                // We use a raw query check or just blind update? 
                // Let's just update viewed_at. Status logic is complex without fetching first.
                // But we have service role, so we can fetch first.
            };

            // Fetch current status first
            const { data: currentQuote } = await supabase
                .from('quotes')
                .select('status')
                .eq('id', quote_id)
                .single();

            if (currentQuote && currentQuote.status === 'sent') {
                updateData.status = 'viewed';
            }
        } else {
            // Default to accept logic
            updateData = {
                status: status || 'accepted',
                accepted_at: new Date().toISOString()
            };
            if (signature_data) {
                updateData.signature_data = signature_data;
            }
        }

        // Perform update via Service Role (bypassing RLS)
        const { data, error } = await supabase
            .from('quotes')
            .update(updateData)
            .eq('id', quote_id)
            .select()
            .single();

        if (error) {
            console.error('Database update failed:', error);
            throw error;
        }

        return new Response(JSON.stringify({ success: true, data }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Accept Quote Error:', errorMessage);
        return new Response(JSON.stringify({ error: 'Failed to process quote action' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
        });
    }
});
