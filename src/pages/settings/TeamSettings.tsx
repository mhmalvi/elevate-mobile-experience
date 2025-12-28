import { useState } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
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
import { supabase } from '@/integrations/supabase/client';
import { Users, Mail, Crown, Shield, User, Eye, UserMinus, Loader2 } from 'lucide-react';
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
  const { toast } = useToast();
  const { team, userRole, teamMembers, canManageTeam, refetch } = useTeam();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member');
  const [inviting, setInviting] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

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

  if (!canManageTeam) {
    return (
      <MobileLayout>
        <PageHeader title="Team" showBack />
        <div className="p-4 text-center">
          <p className="text-muted-foreground">You don't have permission to manage team settings.</p>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <PageHeader title="Team Settings" showBack />

      <div className="p-4 space-y-6 animate-fade-in">
        {/* Team Info */}
        <div className="p-4 bg-card rounded-xl border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">{team?.name || 'Your Team'}</h2>
              <p className="text-sm text-muted-foreground">
                {teamMembers.length} {teamMembers.length === 1 ? 'member' : 'members'}
              </p>
            </div>
          </div>
        </div>

        {/* Invite Form */}
        <div className="p-4 bg-card rounded-xl border space-y-4">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Invite Team Member</h3>
          </div>

          <form onSubmit={handleInvite} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={inviteRole} onValueChange={(v: any) => setInviteRole(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin - Full access except owner transfer</SelectItem>
                  <SelectItem value="member">Member - Can create and edit</SelectItem>
                  <SelectItem value="viewer">Viewer - Read-only access</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" className="w-full" disabled={inviting}>
              {inviting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Send Invitation
            </Button>
          </form>
        </div>

        {/* Team Members List */}
        <div className="space-y-3">
          <h3 className="font-semibold">Team Members</h3>

          {teamMembers.map((member) => (
            <div
              key={member.id}
              className="p-4 bg-card rounded-xl border flex items-center justify-between"
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  {getRoleIcon(member.role)}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{member.profiles?.email || 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground capitalize">{member.role}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {member.role !== 'owner' && canManageTeam && (
                  <>
                    <Select
                      value={member.role}
                      onValueChange={(newRole) =>
                        handleChangeRole(member.id, newRole, member.profiles?.email || 'Unknown')
                      }
                    >
                      <SelectTrigger className="w-[120px] text-xs h-8">
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
    </MobileLayout>
  );
}
