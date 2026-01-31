import { useState } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useTeam } from '@/hooks/useTeam';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Users, Mail, Crown, Shield, User, Eye, UserMinus, Loader2, ArrowLeft, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function TeamSettings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { team, userRole, teamMembers, canManageTeam, refetch, loading, error, allTeams, switchTeam } = useTeam();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member');
  const [inviting, setInviting] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  const handleLeaveTeam = async () => {
    if (!user || !userRole || userRole === 'owner') return;

    setLeaving(true);
    try {
      if (!team) return;

      const { error } = await supabase.functions.invoke('leave-team', {
        body: { team_id: team.id }
      });

      if (error) throw error;

      toast({
        title: 'Left team',
        description: 'You have successfully left the team.',
      });

      // Refetch global team data to update context
      await refetch();

      // Navigate to dashboard
      navigate('/dashboard');

    } catch (error) {
      console.error('Error leaving team:', error);
      toast({
        title: 'Failed to leave team',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLeaving(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inviteEmail) {
      toast({ title: 'Email required', variant: 'destructive' });
      return;
    }

    setInviting(true);

    try {
      const { data, error } = await supabase.functions.invoke('send-team-invitation', {
        body: { email: inviteEmail, role: inviteRole },
      });

      if (error) throw error;

      toast({
        title: 'Invitation sent!',
        description: `An invitation has been sent to ${inviteEmail}`,
      });

      setInviteEmail('');
      setInviteRole('member');
    } catch (error) {
      console.error('Error sending invitation:', error);
      toast({
        title: 'Failed to send invitation',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (memberId: string, memberEmail: string) => {
    setRemovingMemberId(memberId);

    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      toast({
        title: 'Member removed',
        description: `${memberEmail} has been removed from the team`,
      });

      refetch();
    } catch (error) {
      console.error('Error removing member:', error);
      toast({
        title: 'Failed to remove member',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setRemovingMemberId(null);
    }
  };

  const handleChangeRole = async (memberId: string, newRole: string, memberEmail: string) => {
    try {
      const { error } = await supabase
        .from('team_members')
        .update({ role: newRole })
        .eq('id', memberId);

      if (error) throw error;

      toast({
        title: 'Role updated',
        description: `${memberEmail} is now a ${newRole}`,
      });

      refetch();
    } catch (error) {
      console.error('Error changing role:', error);
      toast({
        title: 'Failed to update role',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="w-4 h-4 text-yellow-500" />;
      case 'admin':
        return <Shield className="w-4 h-4 text-blue-500" />;
      case 'member':
        return <User className="w-4 h-4 text-green-500" />;
      case 'viewer':
        return <Eye className="w-4 h-4 text-gray-500" />;
      default:
        return null;
    }
  };

  // Show loading state
  if (loading) {
    return (
      <MobileLayout>
        <div className="min-h-screen scrollbar-hide">
          {/* Hero Section */}
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent" />
            <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

            <div className="relative px-4 pt-8 pb-6">
              <button
                onClick={() => navigate('/settings')}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm font-medium">Back to Settings</span>
              </button>

              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-primary">Collaboration</span>
              </div>
              <h1 className="text-3xl font-bold text-foreground">Team</h1>
              <p className="text-muted-foreground mt-1">
                Manage team members and permissions
              </p>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center p-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </div>
      </MobileLayout>
    );
  }

  // No team membership found
  if (!team && !error) {
    return (
      <MobileLayout>
        <div className="min-h-screen scrollbar-hide">
          {/* Hero Section */}
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent" />
            <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

            <div className="relative px-4 pt-8 pb-6">
              <button
                onClick={() => navigate('/settings')}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm font-medium">Back to Settings</span>
              </button>

              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-primary">Collaboration</span>
              </div>
              <h1 className="text-3xl font-bold text-foreground">Team</h1>
              <p className="text-muted-foreground mt-1">
                Manage team members and permissions
              </p>
            </div>
          </div>

          <div className="px-4 pb-32 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10 flex items-center justify-center shadow-lg shadow-primary/5">
              <Users className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">No Team Yet</h2>
              <p className="text-muted-foreground mt-1">
                You're not part of a team yet. Ask a team owner to invite you, or create your own team.
              </p>
            </div>
          </div>
        </div>
      </MobileLayout>
    );
  }

  // Error loading team
  if (error) {
    return (
      <MobileLayout>
        <div className="min-h-screen scrollbar-hide">
          {/* Hero Section */}
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent" />
            <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

            <div className="relative px-4 pt-8 pb-6">
              <button
                onClick={() => navigate('/settings')}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm font-medium">Back to Settings</span>
              </button>

              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-primary">Collaboration</span>
              </div>
              <h1 className="text-3xl font-bold text-foreground">Team</h1>
              <p className="text-muted-foreground mt-1">
                Manage team members and permissions
              </p>
            </div>
          </div>

          <div className="px-4 pb-32 text-center space-y-4">
            <p className="text-muted-foreground">Unable to load team settings.</p>
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" onClick={refetch}>Try Again</Button>
          </div>
        </div>
      </MobileLayout>
    );
  }

  // User doesn't have permission (member or viewer role) BUT they should be able to LEAVE
  // So we only restrict viewing the MANAGE parts, not the page itself if we want them to leave?
  // Wait, if !canManageTeam, the page shows "Limited Access". We need to allow them to see the team list so they can leave!

  // FIXED: Instead of blocking the whole page, we render the page but hide management features.
  // This allows "Members" to see who else is on the team and LEAVE if they want.

  return (
    <MobileLayout>
      <div className="min-h-screen scrollbar-hide">
        {/* Hero Section */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent" />
          <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

          <div className="relative px-4 pt-8 pb-6">
            <button
              onClick={() => navigate('/settings')}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm font-medium">Back to Settings</span>
            </button>

            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Collaboration</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-foreground">Team</h1>
                <p className="text-muted-foreground mt-1">
                  Manage team members and permissions
                </p>
              </div>

              {/* Team Switcher */}
              {allTeams.length > 1 && (
                <div className="relative">
                  <Select
                    value={team?.id}
                    onValueChange={(value) => switchTeam(value)}
                  >
                    <SelectTrigger className="w-[180px] bg-background/50 backdrop-blur-sm border-primary/20">
                      <SelectValue placeholder="Switch Team" />
                    </SelectTrigger>
                    <SelectContent>
                      {allTeams.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-4 pb-32 space-y-6 animate-fade-in">
          {/* Team Info */}
          <div className="p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10 flex items-center justify-center shadow-sm">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold text-lg">{team?.name || 'Your Team'}</h2>
                  <p className="text-sm text-muted-foreground">
                    {teamMembers.length} {teamMembers.length === 1 ? 'member' : 'members'}
                  </p>
                </div>
              </div>

              {/* Leave Team Button (for non-owners) */}
              {userRole !== 'owner' && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" className="text-destructive hover:text-destructive/90 hover:bg-destructive/10 font-medium">
                      {leaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Leave Team'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Leave Team?</AlertDialogTitle>
                      <AlertDialogDescription>
                        You will lose access to all data in this team. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleLeaveTeam} className="bg-destructive hover:bg-destructive/90">
                        Leave
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>

          {/* Invite Form - Only visible to Admins/Owners */}
          {canManageTeam && (
            <div className="p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 space-y-4 animate-fade-in" style={{ animationDelay: '0.05s' }}>
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Invite Team Member</h3>
              </div>

              <form onSubmit={handleInvite} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="colleague@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      required
                      className="pl-10 rounded-xl"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role" className="text-sm font-medium">Role</Label>
                  <Select value={inviteRole} onValueChange={(v: any) => setInviteRole(v)}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin - Full access except owner transfer</SelectItem>
                      <SelectItem value="member">Member - Can create and edit</SelectItem>
                      <SelectItem value="viewer">Viewer - Read-only access</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button type="submit" className="w-full rounded-xl" disabled={inviting}>
                  {inviting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Send Invitation
                </Button>
              </form>
            </div>
          )}

          {/* Team Members List */}
          <div className="space-y-3 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <h3 className="font-semibold">Team Members</h3>

            {teamMembers.map((member, index) => (
              <div
                key={member.id}
                className="p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 flex items-center justify-between group hover:bg-card hover:border-primary/20 hover:shadow-lg transition-all duration-300 animate-fade-in"
                style={{ animationDelay: `${(index + 3) * 0.05}s` }}
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    {getRoleIcon(member.role)}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">
                      {member.profiles?.email || 'Unknown'}
                      {member.user_id === user?.id && <span className="ml-2 text-primary text-xs bg-primary/10 px-2 py-0.5 rounded-full">You</span>}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">{member.role}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Management actions - only if I am admin/owner AND target is NOT owner AND target is NOT me */}
                  {member.role !== 'owner' && canManageTeam && member.user_id !== user?.id && (
                    <>
                      <Select
                        value={member.role}
                        onValueChange={(newRole) =>
                          handleChangeRole(member.id, newRole, member.profiles?.email || 'Unknown')
                        }
                      >
                        <SelectTrigger className="w-[120px] text-xs h-8 rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {userRole === 'owner' && <SelectItem value="admin">Admin</SelectItem>}
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={removingMemberId === member.id}
                            className="rounded-lg"
                          >
                            {removingMemberId === member.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <UserMinus className="w-4 h-4 text-destructive" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove team member?</AlertDialogTitle>
                            <AlertDialogDescription>
                              {member.profiles?.email} will lose access to all team data.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() =>
                                handleRemoveMember(member.id, member.profiles?.email || 'Unknown')
                              }
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MobileLayout>
  );
}
