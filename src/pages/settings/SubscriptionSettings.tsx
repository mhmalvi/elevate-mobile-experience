import { useState, useEffect } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useAllUsageLimits } from '@/hooks/useUsageLimits';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { SUBSCRIPTION_TIERS, getTierById } from '@/lib/subscriptionTiers';
import { getPlatform, getPaymentProvider, isNativeApp } from '@/lib/platformPayments';
import { purchasePackage, restorePurchases, REVENUECAT_PRODUCTS } from '@/lib/purchases';
import { formatLimit, SubscriptionTier } from '@/lib/tierLimits';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router-dom';
import {
  Crown,
  FileText,
  Receipt,
  Briefcase,
  MessageSquare,
  Mail,
  Users,
  Check,
  Sparkles,
  Loader2,
  ExternalLink,
  RotateCcw
} from 'lucide-react';
import { format } from 'date-fns';

const usageIcons = {
  quotes: FileText,
  invoices: Receipt,
  jobs: Briefcase,
  sms: MessageSquare,
  emails: Mail,
  clients: Users,
};

const usageLabels = {
  quotes: 'Quotes',
  invoices: 'Invoices',
  jobs: 'Jobs',
  sms: 'SMS Sent',
  emails: 'Emails Sent',
  clients: 'Clients',
};

export default function SubscriptionSettings() {
  const { profile, refetch: refetchProfile } = useProfile();
  const usage = useAllUsageLimits();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [searchParams] = useSearchParams();

  const currentTier = (profile?.subscription_tier as SubscriptionTier) || 'free';
  const currentTierConfig = getTierById(currentTier);

  // Check for success/cancel from Stripe checkout
  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      toast.success('Subscription activated! Welcome aboard.');
      // Refresh subscription status
      checkSubscriptionStatus();
    } else if (searchParams.get('canceled') === 'true') {
      toast.info('Checkout was cancelled.');
    }
  }, [searchParams]);

  const checkSubscriptionStatus = async () => {
    try {
      await supabase.functions.invoke('check-subscription');
      refetchProfile?.();
    } catch (error) {
      console.error('Error checking subscription:', error);
    }
  };

  const handleUpgrade = async (tierId: string) => {
    const tier = getTierById(tierId);
    if (!tier) {
      toast.error('This plan is not available yet');
      return;
    }

    setLoadingTier(tierId);

    try {
      const platform = getPlatform();
      const provider = getPaymentProvider(platform);

      if (provider === 'stripe') {
        // Use Stripe for web users
        if (!tier.stripePriceId) {
          toast.error('Stripe is not configured for this plan');
          return;
        }

        const { data, error } = await supabase.functions.invoke('create-subscription-checkout', {
          body: { priceId: tier.stripePriceId, tierId: tier.id }
        });

        if (error) throw error;
        if (data?.url) {
          window.open(data.url, '_blank');
        }
      } else {
        // Use RevenueCat for native apps
        const productConfig = REVENUECAT_PRODUCTS[tierId as keyof typeof REVENUECAT_PRODUCTS];
        if (!productConfig) {
          toast.error('This plan is not available for in-app purchase');
          return;
        }

        const result = await purchasePackage(productConfig.identifier);

        if (result.success) {
          toast.success('Subscription activated! Welcome aboard.');
          refetchProfile?.();
        } else if (result.error) {
          toast.error(result.error);
        }
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      toast.error('Failed to start checkout. Please try again.');
    } finally {
      setLoadingTier(null);
    }
  };

  const handleRestorePurchases = async () => {
    setIsRestoring(true);
    try {
      const result = await restorePurchases();
      if (result.success) {
        toast.success('Purchases restored successfully!');
        refetchProfile?.();
      } else if (result.error) {
        toast.error(result.error);
      }
    } catch (error) {
      console.error('Error restoring purchases:', error);
      toast.error('Failed to restore purchases. Please try again.');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleManageSubscription = async () => {
    const platform = getPlatform();

    if (isNativeApp()) {
      // For native apps, direct users to their app store subscription settings
      if (platform === 'android') {
        window.open('https://play.google.com/store/account/subscriptions', '_blank');
      } else if (platform === 'ios') {
        window.open('https://apps.apple.com/account/subscriptions', '_blank');
      }
      return;
    }

    // For web, use Stripe customer portal
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Error opening portal:', error);
      toast.error('Failed to open subscription management. Please try again.');
    }
  };

  // Get the first day of next month for reset date
  const now = new Date();
  const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return (
    <MobileLayout>
      <PageHeader title="Subscription" showBack />

      <div className="p-4 space-y-6 pb-24 scrollbar-hide">
        {/* Current Plan Banner */}
        <Card className="p-5 bg-gradient-to-br from-primary/20 via-primary/10 to-background border-primary/30 animate-fade-in">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center shadow-glow-sm">
              <Crown className="w-7 h-7 text-primary-foreground" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-xl">{currentTierConfig?.name || 'Free'}</h3>
                <Badge variant="secondary" className="text-xs">Current Plan</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {currentTier === 'free' ? 'Upgrade to unlock more features' :
                  profile?.subscription_expires_at ?
                    `Renews ${format(new Date(profile.subscription_expires_at), 'MMM d, yyyy')}` :
                    'Active subscription'
                }
              </p>
            </div>
          </div>
          {currentTier !== 'free' && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4 w-full"
              onClick={handleManageSubscription}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Manage Subscription
            </Button>
          )}
        </Card>

        {/* Usage Dashboard */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-lg">This Month's Usage</h4>
            <span className="text-xs text-muted-foreground">
              Resets {format(resetDate, 'MMM d')}
            </span>
          </div>

          {usage.loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid gap-3">
              {(['quotes', 'invoices', 'jobs', 'sms', 'emails', 'clients'] as const).map((type, index) => {
                const Icon = usageIcons[type];
                const data = usage[type];
                const percentage = data.isUnlimited ? 0 : Math.min((data.used / data.limit) * 100, 100);
                const isNearLimit = !data.isUnlimited && percentage >= 80;
                const isAtLimit = !data.isUnlimited && data.used >= data.limit;

                return (
                  <Card
                    key={type}
                    className={`p-4 animate-fade-in ${isAtLimit ? 'border-destructive/50 bg-destructive/5' : isNearLimit ? 'border-warning/50 bg-warning/5' : ''}`}
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isAtLimit ? 'bg-destructive/20' : isNearLimit ? 'bg-warning/20' : 'bg-primary/10'
                        }`}>
                        <Icon className={`w-4 h-4 ${isAtLimit ? 'text-destructive' : isNearLimit ? 'text-warning' : 'text-primary'
                          }`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{usageLabels[type]}</span>
                          <span className={`text-sm font-semibold ${isAtLimit ? 'text-destructive' : isNearLimit ? 'text-warning' : 'text-foreground'
                            }`}>
                            {data.used} / {formatLimit(data.limit)}
                          </span>
                        </div>
                      </div>
                    </div>
                    {!data.isUnlimited && (
                      <Progress
                        value={percentage}
                        className={`h-2 ${isAtLimit ? '[&>div]:bg-destructive' : isNearLimit ? '[&>div]:bg-warning' : ''}`}
                      />
                    )}
                    {data.isUnlimited && (
                      <div className="flex items-center gap-1 text-xs text-primary">
                        <Sparkles className="w-3 h-3" />
                        <span>Unlimited</span>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Upgrade Plans */}
        <div className="space-y-3">
          <h4 className="font-semibold text-lg">Upgrade Your Plan</h4>

          {isNativeApp() && (
            <div className="space-y-2">
              <Card className="p-4 bg-muted/50 border-dashed">
                <p className="text-sm text-muted-foreground text-center">
                  Subscriptions are managed through the app store on mobile devices.
                </p>
              </Card>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleRestorePurchases}
                disabled={isRestoring}
              >
                {isRestoring ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4 mr-2" />
                )}
                Restore Purchases
              </Button>
            </div>
          )}

          <div className="grid gap-3">
            {SUBSCRIPTION_TIERS.filter(tier => tier.id !== 'free').map((tier, index) => {
              const isCurrentPlan = tier.id === currentTier;
              const isDowngrade = SUBSCRIPTION_TIERS.findIndex(t => t.id === tier.id) <
                SUBSCRIPTION_TIERS.findIndex(t => t.id === currentTier);

              return (
                <Card
                  key={tier.id}
                  className={`p-5 animate-fade-in transition-all ${tier.highlighted ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20' : ''
                    } ${isCurrentPlan ? 'border-primary bg-primary/10' : ''}`}
                  style={{ animationDelay: `${(index + 6) * 0.05}s` }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h5 className="font-bold text-lg">{tier.name}</h5>
                        {tier.highlighted && !isCurrentPlan && (
                          <Badge className="bg-primary text-primary-foreground text-xs">Popular</Badge>
                        )}
                        {isCurrentPlan && (
                          <Badge variant="secondary" className="text-xs">Current</Badge>
                        )}
                      </div>
                      <p className="text-2xl font-bold mt-1">
                        ${tier.price}
                        <span className="text-sm font-normal text-muted-foreground">/month</span>
                      </p>
                    </div>
                  </div>

                  <ul className="space-y-2 mb-4">
                    {tier.features.slice(0, 4).map((feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <Check className="w-4 h-4 text-primary shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {!isCurrentPlan && !isDowngrade && (
                    <Button
                      className="w-full"
                      variant={tier.highlighted ? 'premium' : 'outline'}
                      onClick={() => handleUpgrade(tier.id)}
                      disabled={loadingTier !== null}
                    >
                      {loadingTier === tier.id ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          <Crown className="w-4 h-4 mr-2" />
                          Upgrade to {tier.name}
                        </>
                      )}
                    </Button>
                  )}

                  {isCurrentPlan && (
                    <div className="text-center text-sm text-muted-foreground">
                      This is your current plan
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>

        {/* Footer note */}
        <p className="text-xs text-muted-foreground text-center pt-4">
          All prices in AUD. Cancel anytime. Questions? Contact support@tradiemate.app
        </p>
      </div>
    </MobileLayout>
  );
}
