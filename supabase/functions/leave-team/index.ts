import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

        // Create admin client to bypass RLS
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

        // Get user from auth header
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

        if (userError || !user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const { team_id } = await req.json();

        if (!team_id) {
            return new Response(JSON.stringify({ error: 'Team ID is required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Verify membership and role
        const { data: membership, error: membershipError } = await supabaseAdmin
            .from('team_members')
            .select('id, role')
            .eq('team_id', team_id)
            .eq('user_id', user.id)
            .single();

        if (membershipError || !membership) {
            return new Response(JSON.stringify({ error: 'Membership not found' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        if (membership.role === 'owner') {
            return new Response(JSON.stringify({ error: 'Owners cannot leave the team. You must transfer ownership or delete the team.' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Delete membership
        const { error: deleteError, count } = await supabaseAdmin
            .from('team_members')
            .delete({ count: 'exact' })
            .eq('id', membership.id);

        console.log(`Deleted membership ${membership.id}. Count: ${count}`);

        if (deleteError) {
            throw deleteError;
        }

        if (count === 0) {
            return new Response(JSON.stringify({ error: 'Failed to delete membership. Record may not exist or permission denied.' }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify({ success: true, deleted_count: count }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error('Error in leave-team:', errorMessage);
        return new Response(JSON.stringify({ error: "Failed to leave team" }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
