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
    // Note: Full account deletion requires server-side implementation
    await signOut();
    toast({
      title: 'Signed out',
      description: 'Contact support to fully delete your account.'
    });
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
            disabled={loading || !passwords.new || !passwords.confirm}
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
              <Button variant="destructive" className="w-full">
                Delete Account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. All your data will be permanently deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteAccount}>
                  Delete Account
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </MobileLayout>
  );
}
