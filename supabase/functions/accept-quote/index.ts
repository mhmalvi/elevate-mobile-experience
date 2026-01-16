
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // Create Supabase client with Service Role Key (Admin Access)
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const { quote_id, signature_data, status, action } = await req.json();

        if (!quote_id) throw new Error('Quote ID is required');

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

    } catch (error) {
        console.error('Accept Quote Error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
        });
    }
});
