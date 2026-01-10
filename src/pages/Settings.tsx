import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { LogOut, User, Building2, CreditCard, ChevronRight, Sparkles, Sun, Moon, Crown, Palette, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';

export default function Settings() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { profile } = useProfile();
  const { theme, setTheme } = useTheme();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const menuItems = [
    { icon: Crown, label: 'Subscription & Usage', description: 'Plan, limits & billing', path: '/settings/subscription' },
    { icon: User, label: 'Profile', description: 'Your personal details', path: '/settings/profile' },
    { icon: Building2, label: 'Business Details', description: 'ABN, logo & contact info', path: '/settings/business' },
    { icon: Palette, label: 'Branding', description: 'Colors, logos & templates', path: '/settings/branding' },
    { icon: Users, label: 'Team', description: 'Manage team members & roles', path: '/settings/team' },
    { icon: CreditCard, label: 'Payment Details', description: 'Bank account for invoices', path: '/settings/payments' },
  ];

  return (
    <MobileLayout>
      <PageHeader title="Settings" />

      <div className="p-4 space-y-6 pb-40">
        {/* Profile Summary Card */}
        <div className="relative overflow-hidden p-6 bg-card/60 backdrop-blur-lg rounded-[2.5rem] border border-border/40 shadow-premium animate-fade-in group">
          <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-primary/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />

          <div className="flex items-center gap-5 relative z-10">
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-glow">
              <Sparkles className="w-8 h-8 text-primary-foreground animate-pulse-slow" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-black text-xl tracking-tight text-foreground truncate">
                {profile?.business_name || 'Your Business'}
              </h3>
              <p className="text-sm font-semibold text-muted-foreground/60 truncate">
                {profile?.email || 'Set up profile'}
              </p>
            </div>
          </div>
        </div>

        {/* Action Menu Grid */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <div className="w-1.5 h-6 bg-primary rounded-full" />
            <h3 className="font-bold text-lg text-foreground">Configuration</h3>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {menuItems.map((item, index) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-card/30 backdrop-blur-md border border-border/40 hover:bg-card/50 transition-all active:scale-[0.98] group"
              >
                <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 shadow-sm group-hover:bg-primary/20 transition-colors">
                  <item.icon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="font-bold text-foreground">{item.label}</p>
                  <p className="text-xs font-medium text-muted-foreground truncate">{item.description}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground/40 shrink-0 group-hover:translate-x-0.5 transition-transform" />
              </button>
            ))}
          </div>
        </div>

        {/* Preferences Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <div className="w-1.5 h-6 bg-primary rounded-full" />
            <h3 className="font-bold text-lg text-foreground">Preferences</h3>
          </div>

          <div className="p-4 bg-card/30 backdrop-blur-md rounded-2xl border border-border/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  {theme === 'dark' ? (
                    <Moon className="w-5 h-5 text-primary" />
                  ) : (
                    <Sun className="w-5 h-5 text-primary" />
                  )}
                </div>
                <div>
                  <p className="font-bold text-foreground">Personalization</p>
                  <p className="text-xs font-medium text-muted-foreground">
                    {theme === 'dark' ? 'Dark visual mode' : 'Light visual mode'}
                  </p>
                </div>
              </div>
              <Switch
                checked={theme === 'dark'}
                onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                className="data-[state=checked]:bg-primary"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-6 space-y-6">
          <Button
            variant="ghost"
            className="w-full h-14 rounded-2xl text-destructive hover:text-destructive hover:bg-destructive/5 font-black uppercase tracking-widest text-[10px]"
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4 mr-3" />
            End Session
          </Button>

          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 grayscale opacity-40">
              <Building2 className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">TradieMate v1.0</span>
            </div>
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
              Mission Critical Tools for Trade
            </p>
          </div>
        </div>
      </div>
    </MobileLayout>
  );
}