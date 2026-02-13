import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, createCorsResponse, createErrorResponse } from "../_shared/cors.ts";

interface AcceptInvitationRequest {
  token: string;
}

serve(async (req) => {
  // SECURITY: Get secure CORS headers
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return createCorsResponse(req);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { token, action } = body;

    console.log(`Processing invitation request: action=${action || 'accept'}, token=${token?.substring(0, 10)}...`);

    if (!token) {
      return new Response(JSON.stringify({ error: 'Token is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // -- ACTION: GET DETAILS (Public, relies on token security) --
    if (action === 'get-details') {
      const { data: invitation, error: invitationError } = await supabase
        .from('team_invitations')
        .select('*, teams(name)')
        .eq('token', token)
        .eq('accepted', false)
        .maybeSingle();

      if (invitationError || !invitation) {
        return new Response(JSON.stringify({ error: 'Invalid or expired invitation' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check expiry
      if (new Date(invitation.expires_at) < new Date()) {
        return new Response(JSON.stringify({ error: 'Invitation has expired' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const teamName = (invitation.teams as any)?.name || 'the team';

      return new Response(JSON.stringify({
        team_name: teamName,
        role: invitation.role,
        email: invitation.email,
        expires_at: invitation.expires_at
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // -- ACTION: ACCEPT (Requires Auth) --
    console.log('Processing ACCEPT action for token:', token);

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

    // Find the invitation again for acceptance
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

    // Get user's email from profile OR from auth
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('user_id', user.id)
      .single();

    // Use profile email, or fallback to auth email
    const userEmail = profile?.email || user.email;
    console.log('Email check:', { userEmail, invitationEmail: invitation.email });

    // Verify the invitation email matches the user's email
    if (!userEmail || userEmail.toLowerCase() !== invitation.email.toLowerCase()) {
      const msg = `This invitation was sent to ${invitation.email}, but you are signed in as ${userEmail || 'unknown'}. Please sign out and sign in with the correct account.`;
      return new Response(JSON.stringify({
        error: msg
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

    const teamName = (invitation as any).teams?.name || 'the team';

    return new Response(JSON.stringify({
      success: true,
      team_id: invitation.team_id,
      team_name: teamName,
      role: invitation.role,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error('Fatal error in accept-team-invitation:', errorMessage);
    return new Response(JSON.stringify({ error: "Failed to process team invitation" }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
