import { useState } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { User, Mail, Lock, AlertTriangle, ArrowLeft, Shield } from 'lucide-react';
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

export default function ProfileSettings() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: ''
  });

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!passwords.current) {
      toast({
        title: 'Current password required',
        description: 'Please enter your current password to verify.',
        variant: 'destructive'
      });
      return;
    }

    if (passwords.new !== passwords.confirm) {
      toast({
        title: 'Passwords don\'t match',
        description: 'Please make sure your new passwords match.',
        variant: 'destructive'
      });
      return;
    }

    if (passwords.new.length < 6) {
      toast({
        title: 'Password too short',
        description: 'Password must be at least 6 characters.',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);

    // Verify current password by attempting to sign in
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user!.email!,
      password: passwords.current,
    });

    if (verifyError) {
      toast({
        title: 'Incorrect password',
        description: 'Your current password is incorrect.',
        variant: 'destructive'
      });
      setLoading(false);
      return;
    }

    // Now update the password
    const { error } = await supabase.auth.updateUser({
      password: passwords.new
    });

    if (error) {
      toast({
        title: 'Error updating password',
        description: error.message,
        variant: 'destructive'
      });
    } else {
      toast({
        title: 'Password updated',
        description: 'Your password has been changed successfully.'
      });
      setPasswords({ current: '', new: '', confirm: '' });
    }
    setLoading(false);
  };

  const handleDeleteAccount = async () => {
    setLoading(true);

    try {
      // Call the delete-account Edge Function
      const { error } = await supabase.functions.invoke('delete-account');

      if (error) {
        toast({
          title: 'Error deleting account',
          description: error.message || 'Failed to delete account. Please try again.',
          variant: 'destructive'
        });
        setLoading(false);
        return;
      }

      // Account deleted successfully - sign out
      await signOut();

      toast({
        title: 'Account deleted',
        description: 'Your account and all associated data have been permanently deleted.',
      });
    } catch (error: any) {
      console.error('Delete account error:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please contact support.',
        variant: 'destructive'
      });
      setLoading(false);
    }
  };

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
              <User className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Account Security</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground">Profile</h1>
            <p className="text-muted-foreground mt-1">
              Manage your account details and security
            </p>
          </div>
        </div>

        <div className="px-4 pb-32 space-y-6">
          {/* Email Display */}
          <div className="p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 animate-fade-in">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Mail className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <Label className="text-muted-foreground text-sm">Email Address</Label>
                <p className="font-semibold text-foreground">{user?.email}</p>
              </div>
            </div>
          </div>

          {/* Change Password */}
          <form onSubmit={handleChangePassword} className="space-y-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-foreground">Change Password</h3>
            </div>

            <div className="space-y-3 p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50">
              <div>
                <Label htmlFor="currentPassword" className="text-sm font-medium">Current Password</Label>
                <div className="relative mt-1.5">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="currentPassword"
                    type="password"
                    value={passwords.current}
                    onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                    placeholder="Enter current password"
                    className="pl-10 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="newPassword" className="text-sm font-medium">New Password</Label>
                <div className="relative mt-1.5">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="newPassword"
                    type="password"
                    value={passwords.new}
                    onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                    placeholder="Enter new password"
                    className="pl-10 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirm Password</Label>
                <div className="relative mt-1.5">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={passwords.confirm}
                    onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                    placeholder="Confirm new password"
                    className="pl-10 rounded-xl"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading || !passwords.current || !passwords.new || !passwords.confirm}
                className="w-full rounded-xl mt-4"
                variant="default"
              >
                {loading ? 'Updating...' : 'Update Password'}
              </Button>
            </div>
          </form>

          {/* Danger Zone */}
          <div className="pt-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <h3 className="font-semibold text-destructive">Danger Zone</h3>
            </div>

            <div className="p-4 bg-destructive/5 backdrop-blur-sm rounded-2xl border border-destructive/20">
              <p className="text-sm text-muted-foreground mb-4">
                Once you delete your account, there is no going back. All your data will be permanently removed.
              </p>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full rounded-xl" disabled={loading}>
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Delete Account
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. All your data including clients, quotes, invoices,
                      and jobs will be permanently deleted.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteAccount} disabled={loading}>
                      {loading ? 'Deleting...' : 'Delete Account'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </div>
    </MobileLayout>
  );
}
