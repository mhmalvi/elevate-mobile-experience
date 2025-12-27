import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { LogOut, User, Building2, CreditCard, ChevronRight, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Settings() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { profile } = useProfile();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const menuItems = [
    { icon: User, label: 'Profile', description: 'Your personal details', path: '/settings/profile' },
    { icon: Building2, label: 'Business Details', description: 'ABN, logo & contact info', path: '/settings/business' },
    { icon: CreditCard, label: 'Payment Details', description: 'Bank account for invoices', path: '/settings/payment' },
  ];

  return (
    <MobileLayout>
      <PageHeader title="Settings" />
      
      <div className="p-4 space-y-6">
        {/* Profile Summary */}
        <div className="p-5 bg-card rounded-2xl border animate-fade-in card-interactive">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center shadow-glow-sm">
              <Sparkles className="w-7 h-7 text-primary-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-lg truncate">{profile?.business_name || 'Your Business'}</h3>
              <p className="text-sm text-muted-foreground truncate">{profile?.email || 'Set up your business'}</p>
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <div className="space-y-2">
          {menuItems.map((item, index) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="w-full flex items-center gap-4 p-4 rounded-xl bg-card border card-interactive animate-fade-in"
              style={{ animationDelay: `${(index + 1) * 0.05}s` }}
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <item.icon className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="font-semibold">{item.label}</p>
                <p className="text-sm text-muted-foreground truncate">{item.description}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>

        {/* Sign Out */}
        <div className="pt-4 animate-fade-in stagger-4">
          <Button
            variant="outline"
            className="w-full h-12 text-destructive hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30"
            onClick={handleSignOut}
          >
            <LogOut className="w-5 h-5 mr-2" />
            Sign Out
          </Button>
          <p className="text-center text-xs text-muted-foreground mt-4">
            TradieMate v1.0 • Made for Aussie tradies 🇦🇺
          </p>
        </div>
      </div>
    </MobileLayout>
  );
}