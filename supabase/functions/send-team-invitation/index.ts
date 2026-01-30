import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, createCorsResponse } from "../_shared/cors.ts";

// UUID v4 generator with fallback
function generateUUID(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

interface InvitationRequest {
  email: string;
  role: 'admin' | 'member' | 'viewer';
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return createCorsResponse(req);
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

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { email, role }: InvitationRequest = await req.json();
    console.log(`Processing invitation for ${email} with role ${role} from user ${user.id}`);

    // Get user's team membership
    const { data: userMembership, error: membershipError } = await supabase
      .from('team_members')
      .select('team_id, role')
      .eq('user_id', user.id)
      .single();

    if (membershipError) {
      console.error('Error fetching team membership:', membershipError);
      return new Response(JSON.stringify({
        error: 'Failed to verify team membership',
        details: membershipError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!userMembership) {
      console.log('User is not part of any team');
      return new Response(JSON.stringify({
        error: 'You are not part of a team. Please create a team first.'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`User membership found: team_id=${userMembership.team_id}, role=${userMembership.role}`);

    // Verify user has permission to invite (owner or admin)
    if (!['owner', 'admin'].includes(userMembership.role)) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions. Only owners and admins can invite.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const teamId = userMembership.team_id;

    // Get team name
    const { data: team } = await supabase
      .from('teams')
      .select('name')
      .eq('id', teamId)
      .single();

    const teamName = team?.name || 'TradieMate Team';

    // Check if user is already a team member
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('email', email)
      .maybeSingle();

    if (existingProfile?.user_id) {
      const { data: existingMember } = await supabase
        .from('team_members')
        .select('user_id')
        .eq('team_id', teamId)
        .eq('user_id', existingProfile.user_id)
        .maybeSingle();

      if (existingMember) {
        return new Response(JSON.stringify({ error: 'User is already a team member' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Check if there's already a pending invitation
    const { data: existingInvitation } = await supabase
      .from('team_invitations')
      .select('id')
      .eq('team_id', teamId)
      .eq('email', email)
      .eq('accepted', false)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (existingInvitation) {
      return new Response(JSON.stringify({ error: 'Invitation already sent to this email' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate unique token
    const inviteToken = generateUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Create invitation
    const { data: invitation, error: invitationError } = await supabase
      .from('team_invitations')
      .insert({
        team_id: teamId,
        email,
        role,
        token: inviteToken,
        invited_by: user.id,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (invitationError) {
      console.error('Error creating invitation:', invitationError);
      return new Response(JSON.stringify({ error: invitationError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build invitation URL
    const baseUrl = Deno.env.get('APP_URL') || 'https://elevate-mobile-experience.vercel.app';
    const invitationUrl = `${baseUrl}/join-team?token=${inviteToken}`;

    console.log(`Invitation created for ${email}, URL: ${invitationUrl}`);

    // Try to send invitation email (non-blocking)
    try {
      await supabase.functions.invoke('send-email', {
        body: {
          type: 'team_invitation',
          recipient_email: email,
          subject: `You've been invited to join ${teamName}`,
          message: `You've been invited to join ${teamName} as a ${role}. Click here to accept: ${invitationUrl}`,
        },
      });
    } catch (emailErr) {
      console.error('Email sending failed (non-fatal):', emailErr);
    }

    console.log('Invitation created successfully');

    return new Response(JSON.stringify({
      success: true,
      invitation_url: invitationUrl,
      invitation,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Fatal error in send-team-invitation:', error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
