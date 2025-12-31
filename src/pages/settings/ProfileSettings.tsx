import { useState } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
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
      <PageHeader title="Profile" showBack />
      
      <div className="p-4 space-y-6 animate-fade-in">
        {/* Email Display */}
        <div className="p-4 bg-card rounded-xl border">
          <Label className="text-muted-foreground text-sm">Email Address</Label>
          <p className="font-medium mt-1">{user?.email}</p>
        </div>

        {/* Change Password */}
        <form onSubmit={handleChangePassword} className="space-y-4">
          <h3 className="font-semibold">Change Password</h3>

          <div className="space-y-3">
            <div>
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                value={passwords.current}
                onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                placeholder="Enter current password"
              />
            </div>

            <div>
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={passwords.new}
                onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                placeholder="Enter new password"
              />
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={passwords.confirm}
                onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                placeholder="Confirm new password"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading || !passwords.current || !passwords.new || !passwords.confirm}
            className="w-full"
          >
            {loading ? 'Updating...' : 'Update Password'}
          </Button>
        </form>

        {/* Danger Zone */}
        <div className="pt-6 border-t">
          <h3 className="font-semibold text-destructive mb-4">Danger Zone</h3>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full" disabled={loading}>
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
    </MobileLayout>
  );
}
