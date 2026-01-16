
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

        const { quote_id, signature_data, status } = await req.json();

        if (!quote_id) throw new Error('Quote ID is required');

        console.log(`Accepting quote: ${quote_id}`);

        // Prepare update data
        const updateData: any = {
            status: status || 'accepted',
            accepted_at: new Date().toISOString()
        };

        if (signature_data) {
            updateData.signature_data = signature_data;
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
