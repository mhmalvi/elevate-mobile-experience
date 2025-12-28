import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AcceptInvitationRequest {
  token: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const auth_token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(auth_token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { token }: AcceptInvitationRequest = await req.json();

    console.log(`Processing invitation acceptance with token: ${token}`);

    // Find the invitation
    const { data: invitation, error: invitationError } = await supabase
      .from('team_invitations')
      .select('*, teams!inner(*)')
      .eq('token', token)
      .eq('accepted', false)
      .single();

    if (invitationError || !invitation) {
      console.error('Invitation not found:', invitationError);
      return new Response(JSON.stringify({ error: 'Invalid or expired invitation' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if invitation has expired
    if (new Date(invitation.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'Invitation has expired' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user's email from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('user_id', user.id)
      .single();

    // Verify the invitation email matches the user's email
    if (profile?.email?.toLowerCase() !== invitation.email.toLowerCase()) {
      return new Response(JSON.stringify({
        error: 'This invitation was sent to a different email address'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is already a member of this team
    const { data: existingMembership } = await supabase
      .from('team_members')
      .select('id')
      .eq('team_id', invitation.team_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingMembership) {
      // Mark invitation as accepted anyway
      await supabase
        .from('team_invitations')
        .update({ accepted: true })
        .eq('id', invitation.id);

      return new Response(JSON.stringify({
        error: 'You are already a member of this team'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Add user to team
    const { error: memberError } = await supabase
      .from('team_members')
      .insert({
        team_id: invitation.team_id,
        user_id: user.id,
        role: invitation.role,
      });

    if (memberError) {
      console.error('Error adding team member:', memberError);
      return new Response(JSON.stringify({ error: memberError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update user's profile with team_id
    await supabase
      .from('profiles')
      .update({ team_id: invitation.team_id })
      .eq('user_id', user.id);

    // Mark invitation as accepted
    await supabase
      .from('team_invitations')
      .update({ accepted: true })
      .eq('id', invitation.id);

    console.log('Team invitation accepted successfully');

    const teamName = (invitation as any).teams?.name || 'TradieMate Team';

    return new Response(JSON.stringify({
      success: true,
      team_id: invitation.team_id,
      team_name: teamName,
      role: invitation.role,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Fatal error in accept-team-invitation:', error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
