import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Users, CheckCircle, AlertCircle } from 'lucide-react';

export default function JoinTeam() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [invitation, setInvitation] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setError('Invalid invitation link');
      setLoading(false);
      return;
    }

    fetchInvitation();
  }, [token]);

  const fetchInvitation = async () => {
    try {
      setLoading(true);

      // Use Edge Function to fetch details securely (bypassing RLS)
      const { data, error } = await supabase.functions.invoke('accept-team-invitation', {
        body: { action: 'get-details', token }
      });

      if (error || !data) {
        console.error('Error fetching invitation:', error);
        setError(error?.message || 'Invitation not found or may have expired');
        setLoading(false);
        return;
      }

      setInvitation(data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching invitation:', err);
      setError('Failed to load invitation');
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!user) {
      toast({
        title: 'Please sign in',
        description: 'You need to be signed in to accept this invitation',
      });
      navigate(`/auth?redirect=/join-team?token=${token}`);
      return;
    }

    setAccepting(true);

    try {
      console.log('Accepting invitation with token:', token);
      const { data, error } = await supabase.functions.invoke('accept-team-invitation', {
        body: { token },
      });

      console.log('Accept response:', { data, error });

      // Check for invoke-level error
      if (error) {
        throw new Error(error.message || 'Failed to accept invitation');
      }

      // Check for error in response body
      if (data?.error) {
        throw new Error(data.error);
      }

      // Success!
      setSuccess(true);
      toast({
        title: 'Welcome to the team!',
        description: `You've successfully joined ${data?.team_name || 'the team'}`,
      });

      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (error) {
      console.error('Error accepting invitation:', error);
      toast({
        title: 'Failed to accept invitation',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full space-y-6 text-center">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <div>
            <h1 className="text-2xl font-bold mb-2">Invalid Invitation</h1>
            <p className="text-muted-foreground">{error}</p>
          </div>
          <Button onClick={() => navigate('/dashboard')} className="w-full">
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full space-y-6 text-center">
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-success" />
          </div>
          <div>
            <h1 className="text-2xl font-bold mb-2">Successfully Joined!</h1>
            <p className="text-muted-foreground">
              You're now a member of the team. Redirecting...
            </p>
          </div>
        </div>
      </div>
    );
  }

  const teamName = invitation?.team_name || (invitation?.teams as any)?.name || 'TradieMate Team';

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Users className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Team Invitation</h1>
            <p className="text-muted-foreground">You've been invited to join a team</p>
          </div>
        </div>

        {/* Invitation Details */}
        <div className="p-6 bg-card rounded-xl border space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Team Name</p>
            <p className="font-semibold text-lg">{teamName}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Your Role</p>
            <p className="font-semibold capitalize">{invitation?.role}</p>
          </div>

          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-2">Permissions</p>
            <div className="space-y-1 text-sm">
              {invitation?.role === 'admin' && (
                <>
                  <p className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-success" /> Full access to manage team
                  </p>
                  <p className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-success" /> Create, edit, and delete all data
                  </p>
                  <p className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-success" /> Invite and manage team members
                  </p>
                </>
              )}
              {invitation?.role === 'member' && (
                <>
                  <p className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-success" /> Create and edit data
                  </p>
                  <p className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-success" /> View all team data
                  </p>
                  <p className="text-muted-foreground">Limited deletion permissions</p>
                </>
              )}
              {invitation?.role === 'viewer' && (
                <>
                  <p className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-success" /> View all team data
                  </p>
                  <p className="text-muted-foreground">Read-only access</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <Button onClick={handleAccept} className="w-full h-12" disabled={accepting}>
            {accepting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Accept Invitation
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/dashboard')}
            className="w-full"
            disabled={accepting}
          >
            Decline
          </Button>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          By accepting, you'll join {teamName} and gain access to shared team data.
        </p>
      </div>
    </div>
  );
}
