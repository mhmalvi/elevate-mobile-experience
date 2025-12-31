import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// UUID v4 generator with fallback
function generateUUID(): string {
  try {
    return crypto.randomUUID();
  } catch {
    // Fallback implementation for environments without crypto.randomUUID
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

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { email, role }: InvitationRequest = await req.json();

    console.log(`Processing invitation for ${email} with role ${role}`);

    // Get user's team and verify permission
    const { data: userMembership } = await supabase
      .from('team_members')
      .select('team_id, role, teams!inner(*)')
      .eq('user_id', user.id)
      .single();

    if (!userMembership) {
      return new Response(JSON.stringify({ error: 'User is not part of a team' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user has permission to invite (owner or admin)
    if (!['owner', 'admin'].includes(userMembership.role)) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const teamId = userMembership.team_id;

    // Check if user is already a team member
    const { data: existingMember } = await supabase
      .from('team_members')
      .select('user_id')
      .eq('team_id', teamId)
      .eq('user_id', (await supabase
        .from('profiles')
        .select('user_id')
        .eq('email', email)
        .maybeSingle())?.data?.user_id || '00000000-0000-0000-0000-000000000000')
      .maybeSingle();

    if (existingMember) {
      return new Response(JSON.stringify({ error: 'User is already a team member' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
    const token_value = generateUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    // Create invitation
    const { data: invitation, error: invitationError } = await supabase
      .from('team_invitations')
      .insert({
        team_id: teamId,
        email,
        role,
        token: token_value,
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

    // Send invitation email
    const baseUrl = Deno.env.get('APP_URL') || 'https://app.tradiemate.com.au';
    const invitationUrl = `${baseUrl}/join-team?token=${token_value}`;
    const teamName = (userMembership as any).teams?.name || 'TradieMate Team';

    console.log(`Sending invitation email to ${email}`);
    console.log(`Invitation URL: ${invitationUrl}`);

    // Send email using send-email function
    try {
      const { error: emailError } = await supabase.functions.invoke('send-email', {
        body: {
          type: 'team_invitation',
          recipient_email: email,
          subject: `You've been invited to join ${teamName}`,
          message: `You've been invited to join ${teamName} as a ${role}. Click the link below to accept the invitation: ${invitationUrl}`,
        },
      });

      if (emailError) {
        console.error('Error sending email:', emailError);
        // Don't fail the invitation if email fails
      }
    } catch (emailErr) {
      console.error('Exception sending email:', emailErr);
      // Don't fail the invitation if email fails
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
