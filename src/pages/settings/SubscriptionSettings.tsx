import { useState, useEffect } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
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
import { useSearchParams, useNavigate } from 'react-router-dom';
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
  RotateCcw,
  ArrowLeft,
  Zap,
  Star,
  Shield,
  X,
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

const tierIcons = {
  free: Zap,
  solo: Star,
  crew: Users,
  pro: Shield,
};

const tierColors = {
  free: { bg: 'bg-muted/50', border: 'border-border/50', accent: 'text-muted-foreground' },
  solo: { bg: 'bg-blue-500/5', border: 'border-blue-500/20', accent: 'text-blue-500' },
  crew: { bg: 'bg-primary/5', border: 'border-primary/30', accent: 'text-primary' },
  pro: { bg: 'bg-amber-500/5', border: 'border-amber-500/20', accent: 'text-amber-500' },
};

export default function SubscriptionSettings() {
  const { profile, refetch: refetchProfile } = useProfile();
  const usage = useAllUsageLimits();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const currentTier = (profile?.subscription_tier as SubscriptionTier) || 'free';
  const currentTierConfig = getTierById(currentTier);

  // Check for success/cancel from Stripe checkout
  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      toast.success('Subscription activated! Welcome aboard.');
      checkSubscriptionStatus();
    } else if (searchParams.get('canceled') === 'true') {
      toast.info('Checkout was cancelled.');
    }
  }, [searchParams]);

  const getAuthHeaders = async (): Promise<Record<string, string> | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      toast.error('Session expired. Please sign in again.');
      navigate('/auth');
      return null;
    }
    return { Authorization: `Bearer ${session.access_token}` };
  };

  const checkSubscriptionStatus = async () => {
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      await supabase.functions.invoke('check-subscription', { headers });
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
        // Use annual price if available, otherwise fall back to monthly
        let priceId = billingPeriod === 'annual' ? tier.annualStripePriceId : tier.stripePriceId;
        let usingFallback = false;
        if (!priceId && billingPeriod === 'annual' && tier.stripePriceId) {
          // Annual price not configured - fall back to monthly
          priceId = tier.stripePriceId;
          usingFallback = true;
        }
        if (!priceId) {
          toast.error('Stripe is not configured for this plan');
          return;
        }

        const headers = await getAuthHeaders();
        if (!headers) return;

        const { data, error } = await supabase.functions.invoke('create-subscription-checkout', {
          body: { priceId, tierId: tier.id },
          headers,
        });

        if (error) throw error;
        if (data?.url) {
          if (usingFallback) {
            toast.info('Annual billing coming soon. Redirecting to monthly checkout.');
          }
          // Use location.href instead of window.open to avoid popup blockers on mobile
          window.location.href = data.url;
        } else {
          toast.error('Failed to create checkout session. Please try again.');
        }
      } else {
        // Mobile: use RevenueCat for in-app purchases
        const productConfig = REVENUECAT_PRODUCTS[tierId as keyof typeof REVENUECAT_PRODUCTS];
        if (!productConfig) {
          toast.error('This plan is not available for in-app purchase');
          return;
        }

        const productId = billingPeriod === 'annual'
          ? productConfig.annualIdentifier
          : productConfig.identifier;

        const result = await purchasePackage(productId);

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
      if (platform === 'android') {
        window.open('https://play.google.com/store/account/subscriptions', '_blank');
      } else if (platform === 'ios') {
        window.open('https://apps.apple.com/account/subscriptions', '_blank');
      }
      return;
    }

    try {
      const headers = await getAuthHeaders();
      if (!headers) return;

      const { data, error } = await supabase.functions.invoke('customer-portal', { headers });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast.error('Failed to open subscription management. Please try again.');
      }
    } catch (error: any) {
      console.error('Error opening portal:', error);
      let errorMsg = 'Failed to open subscription management. Please try again.';
      try {
        const parsed = JSON.parse(error.message);
        errorMsg = parsed.error || errorMsg;
      } catch { /* use default */ }
      toast.error(errorMsg);
    }
  };

  const now = new Date();
  const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const getSavingsPercent = (monthly: number, annual: number) => {
    if (monthly === 0) return 0;
    return Math.round(((monthly - annual) / monthly) * 100);
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
              <Crown className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Plan & Billing</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground">Subscription</h1>
            <p className="text-muted-foreground mt-1">
              Choose the plan that fits your business
            </p>
          </div>
        </div>

        <div className="px-4 pb-24 space-y-6 scrollbar-hide">
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
              <div className="grid grid-cols-2 gap-2.5">
                {(['quotes', 'invoices', 'jobs', 'sms', 'emails', 'clients'] as const).map((type, index) => {
                  const Icon = usageIcons[type];
                  const data = usage[type];
                  const percentage = data.isUnlimited ? 0 : Math.min((data.used / data.limit) * 100, 100);
                  const isNearLimit = !data.isUnlimited && percentage >= 80;
                  const isAtLimit = !data.isUnlimited && data.used >= data.limit;

                  return (
                    <Card
                      key={type}
                      className={`p-3 animate-fade-in ${isAtLimit ? 'border-destructive/50 bg-destructive/5' : isNearLimit ? 'border-warning/50 bg-warning/5' : ''}`}
                      style={{ animationDelay: `${index * 0.03}s` }}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center ${isAtLimit ? 'bg-destructive/20' : isNearLimit ? 'bg-warning/20' : 'bg-primary/10'}`}>
                          <Icon className={`w-3 h-3 ${isAtLimit ? 'text-destructive' : isNearLimit ? 'text-warning' : 'text-primary'}`} />
                        </div>
                        <span className="font-medium text-xs">{usageLabels[type]}</span>
                      </div>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm font-bold ${isAtLimit ? 'text-destructive' : isNearLimit ? 'text-warning' : 'text-foreground'}`}>
                          {data.used}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          / {formatLimit(data.limit)}
                        </span>
                      </div>
                      {!data.isUnlimited ? (
                        <Progress
                          value={percentage}
                          className={`h-1.5 ${isAtLimit ? '[&>div]:bg-destructive' : isNearLimit ? '[&>div]:bg-warning' : ''}`}
                        />
                      ) : (
                        <div className="flex items-center gap-1 text-[10px] text-primary">
                          <Sparkles className="w-2.5 h-2.5" />
                          <span>Unlimited</span>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Billing Period Toggle */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-lg">Choose Your Plan</h4>
            </div>

            <div className="flex items-center justify-center">
              <div className="relative flex items-center bg-muted/80 rounded-2xl p-1 border border-border/50">
                <button
                  onClick={() => setBillingPeriod('monthly')}
                  className={`relative z-10 px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-300 ${
                    billingPeriod === 'monthly'
                      ? 'bg-foreground text-background shadow-lg'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingPeriod('annual')}
                  className={`relative z-10 px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-1.5 ${
                    billingPeriod === 'annual'
                      ? 'bg-foreground text-background shadow-lg'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Annual
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                    billingPeriod === 'annual'
                      ? 'bg-success text-white'
                      : 'bg-success/20 text-success'
                  }`}>
                    SAVE 20%
                  </span>
                </button>
              </div>
            </div>

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
          </div>

          {/* Pricing Cards */}
          <div className="grid gap-4">
            {SUBSCRIPTION_TIERS.map((tier, index) => {
              const isCurrentPlan = tier.id === currentTier;
              const currentTierIndex = SUBSCRIPTION_TIERS.findIndex(t => t.id === currentTier);
              const tierIndex = SUBSCRIPTION_TIERS.findIndex(t => t.id === tier.id);
              const isDowngrade = tierIndex < currentTierIndex;
              const isUpgrade = tierIndex > currentTierIndex;
              const TierIcon = tierIcons[tier.id];
              const colors = tierColors[tier.id];
              const displayPrice = billingPeriod === 'annual' ? tier.annualPrice : tier.price;
              const savings = getSavingsPercent(tier.price, tier.annualPrice);

              return (
                <Card
                  key={tier.id}
                  className={`relative overflow-hidden animate-fade-in transition-all duration-300 ${
                    tier.highlighted && !isCurrentPlan
                      ? `${colors.bg} ${colors.border} ring-2 ring-primary/30`
                      : isCurrentPlan
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/40'
                        : `${colors.bg} ${colors.border}`
                  }`}
                  style={{ animationDelay: `${index * 0.08}s` }}
                >
                  {/* Popular / Current badge ribbon */}
                  {(tier.highlighted && !isCurrentPlan) && (
                    <div className="absolute top-0 right-0">
                      <div className="bg-primary text-primary-foreground text-[10px] font-black px-3 py-1 rounded-bl-xl">
                        MOST POPULAR
                      </div>
                    </div>
                  )}
                  {isCurrentPlan && (
                    <div className="absolute top-0 right-0">
                      <div className="bg-success text-white text-[10px] font-black px-3 py-1 rounded-bl-xl">
                        CURRENT PLAN
                      </div>
                    </div>
                  )}

                  <div className="p-5">
                    {/* Tier Header */}
                    <div className="flex items-start gap-3 mb-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        isCurrentPlan ? 'bg-primary/20' : `${colors.bg} border ${colors.border}`
                      }`}>
                        <TierIcon className={`w-5 h-5 ${isCurrentPlan ? 'text-primary' : colors.accent}`} />
                      </div>
                      <div className="flex-1">
                        <h5 className="font-bold text-lg leading-tight">{tier.name}</h5>
                        <div className="flex items-baseline gap-1 mt-1">
                          {tier.price === 0 ? (
                            <span className="text-3xl font-black">$0</span>
                          ) : (
                            <>
                              <span className="text-3xl font-black">${displayPrice}</span>
                              <span className="text-sm text-muted-foreground font-medium">/mo</span>
                            </>
                          )}
                          {billingPeriod === 'annual' && tier.price > 0 && savings > 0 && (
                            <span className="ml-2 text-xs font-bold text-success bg-success/10 px-2 py-0.5 rounded-full">
                              Save {savings}%
                            </span>
                          )}
                        </div>
                        {billingPeriod === 'annual' && tier.price > 0 && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            ${tier.annualPrice * 12}/year &middot; <span className="line-through">${tier.price * 12}/year</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Features List */}
                    <ul className="space-y-2.5 mb-5">
                      {tier.features.map((feature, i) => {
                        const isInheritedLine = feature.startsWith('Everything in');
                        return (
                          <li key={i} className="flex items-start gap-2.5">
                            {isInheritedLine ? (
                              <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                            ) : (
                              <Check className={`w-4 h-4 shrink-0 mt-0.5 ${isCurrentPlan ? 'text-primary' : colors.accent}`} />
                            )}
                            <span className={`text-sm leading-tight ${isInheritedLine ? 'font-semibold text-primary' : ''}`}>
                              {feature}
                            </span>
                          </li>
                        );
                      })}
                    </ul>

                    {/* CTA Button */}
                    {tier.id === 'free' ? (
                      isCurrentPlan ? (
                        <div className="text-center py-2.5 text-sm text-muted-foreground font-medium">
                          Your current plan
                        </div>
                      ) : (
                        <div className="text-center py-2.5 text-sm text-muted-foreground font-medium">
                          Free forever
                        </div>
                      )
                    ) : isCurrentPlan ? (
                      <Button
                        variant="outline"
                        className="w-full h-11"
                        onClick={handleManageSubscription}
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Manage Plan
                      </Button>
                    ) : isDowngrade ? (
                      <Button
                        variant="ghost"
                        className="w-full h-11 text-muted-foreground"
                        onClick={handleManageSubscription}
                      >
                        Downgrade
                      </Button>
                    ) : (
                      <Button
                        className={`w-full h-11 font-semibold ${
                          tier.highlighted
                            ? 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow-sm'
                            : ''
                        }`}
                        variant={tier.highlighted ? 'default' : 'outline'}
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
                            {tier.highlighted ? 'Get Started' : `Upgrade to ${tier.name}`}
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Footer note */}
          <div className="text-center space-y-2 pt-4">
            <p className="text-xs text-muted-foreground">
              All prices in AUD. Cancel anytime. No lock-in contracts.
            </p>
            <p className="text-xs text-muted-foreground">
              Questions? Contact support@tradiemate.app
            </p>
          </div>
        </div>
      </div>
    </MobileLayout>
  );
}
