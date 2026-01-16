import { MobileLayout } from '@/components/layout/MobileLayout';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { LogOut, User, Building2, CreditCard, ChevronRight, Sparkles, Sun, Moon, Crown, Palette, Users, Settings as SettingsIcon, Link2, HardHat, FileText } from 'lucide-react';
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
    { icon: HardHat, label: 'Subcontractors', description: 'Manage your subbies network', path: '/settings/subcontractors' },
    { icon: CreditCard, label: 'Payment Details', description: 'Bank account for invoices', path: '/settings/payments' },
    { icon: Link2, label: 'Integrations', description: 'Connect Xero, MYOB & more', path: '/settings/integrations' },
    { icon: FileText, label: 'BAS Report', description: 'Quarterly GST summary', path: '/settings/bas-report' },
  ];

  return (
    <MobileLayout>
      <div className="min-h-screen scrollbar-hide">
        {/* Hero Section */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent" />
          <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

          <div className="relative px-4 pt-8 pb-6">
            <div className="flex items-center gap-2 mb-1">
              <SettingsIcon className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">App Configuration</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground">Settings</h1>
            <p className="text-muted-foreground mt-1">
              Manage your account and preferences
            </p>
          </div>
        </div>

        <div className="px-4 pb-32 space-y-6">
          {/* Profile Summary Card */}
          <div className="relative overflow-hidden p-6 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 shadow-lg animate-fade-in group hover:shadow-xl transition-shadow">
            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-primary/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />

            <div className="flex items-center gap-4 relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary-hover flex items-center justify-center shadow-glow">
                <Sparkles className="w-7 h-7 text-primary-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-lg text-foreground truncate">
                  {profile?.business_name || 'Your Business'}
                </h3>
                <p className="text-sm text-muted-foreground truncate">
                  {profile?.email || 'Set up profile'}
                </p>
              </div>
            </div>
          </div>

          {/* Action Menu Grid */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-foreground">Configuration</h3>
            </div>

            <div className="space-y-2">
              {menuItems.map((item, index) => (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className="w-full flex items-center gap-3 p-4 rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 hover:bg-card hover:border-primary/20 hover:shadow-md transition-all duration-300 active:scale-[0.98] group animate-fade-in"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
                    <item.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-semibold text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </button>
              ))}
            </div>
          </div>

          {/* Preferences Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {theme === 'dark' ? (
                <Moon className="w-4 h-4 text-primary" />
              ) : (
                <Sun className="w-4 h-4 text-primary" />
              )}
              <h3 className="font-semibold text-foreground">Preferences</h3>
            </div>

            <div className="p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    {theme === 'dark' ? (
                      <Moon className="w-5 h-5 text-primary" />
                    ) : (
                      <Sun className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Dark Mode</p>
                    <p className="text-xs text-muted-foreground">
                      {theme === 'dark' ? 'Enabled' : 'Disabled'}
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
              className="w-full h-12 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10 font-semibold"
              onClick={handleSignOut}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>

            <div className="flex flex-col items-center gap-2 opacity-50">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                <span className="text-xs font-semibold">TradieMate v1.0</span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Mission Critical Tools for Trade
              </p>
            </div>
          </div>
        </div>
      </div>
    </MobileLayout>
  );
}