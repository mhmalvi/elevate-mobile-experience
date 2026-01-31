import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Wrench, ArrowLeft } from 'lucide-react';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import { validatePassword } from '@/lib/passwordSecurity';

type AuthMode = 'login' | 'signup' | 'forgot-password';

export default function Auth() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  // Get redirect URL from query params (for team invitations, etc.)
  // Decode because it may be URL-encoded to preserve query params
  const redirectParam = searchParams.get('redirect');
  const redirectTo = redirectParam ? decodeURIComponent(redirectParam) : '/dashboard';

  // Auto-redirect if user is already logged in
  useEffect(() => {
    if (user) {
      console.log('=== AUTH: User already logged in, redirecting to:', redirectTo);
      navigate(redirectTo, { replace: true });
    }
  }, [user, redirectTo, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (mode === 'forgot-password') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Check ya inbox, mate! 📬",
          description: "Password reset link sent to your email.",
        });
        setMode('login');
      }
      setLoading(false);
      return;
    }

    // Validate password on signup
    if (mode === 'signup') {
      const validation = validatePassword(password);
      if (!validation.valid) {
        toast({
          title: "Weak Password",
          description: validation.errors[0],
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
    }

    const { data, error } = mode === 'login'
      ? await signIn(email, password)
      : await signUp(email, password);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      if (mode === 'signup' && !data?.session) {
        // Only show "check email" if no session was established immediately
        toast({
          title: "Welcome to TradieMate!",
          description: "Check your email to verify your account and get started.",
          duration: 6000,
        });
        // Don't navigate immediately - let user see the message
        setTimeout(() => {
          setMode('login');
        }, 2000);
      } else {
        // Session established - useEffect will handle the redirect
        console.log('=== AUTH SUCCESS ===');
        console.log('Login successful, useEffect will redirect to:', redirectTo);
        // Don't call navigate here - let the useEffect handle it
        // to avoid race conditions with auth state changes
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8 animate-fade-in">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 gradient-primary rounded-2xl flex items-center justify-center mx-auto shadow-glow">
            <Wrench className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">TradieMate</h1>
          <p className="text-muted-foreground text-sm">
            Fair dinkum job management for Aussie tradies
          </p>
        </div>

        {/* Forgot Password Mode */}
        {mode === 'forgot-password' && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setMode('login')}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to sign in
            </button>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Reset your password</h2>
              <p className="text-sm text-muted-foreground">
                Enter your email and we'll send you a reset link.
              </p>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {mode !== 'forgot-password' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => setMode('forgot-password')}
                    className="text-xs text-primary hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
              {mode === 'signup' && (
                <PasswordStrengthIndicator
                  password={password}
                  showFeedback={true}
                />
              )}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {mode === 'login' && 'Sign In'}
            {mode === 'signup' && 'Create Account'}
            {mode === 'forgot-password' && 'Send Reset Link'}
          </Button>
        </form>

        {mode !== 'forgot-password' && (
          <p className="text-center text-sm text-muted-foreground">
            {mode === 'login' ? "Don't have an account?" : "Already have an account?"}{' '}
            <button
              type="button"
              onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
              className="text-primary font-medium hover:underline"
            >
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
