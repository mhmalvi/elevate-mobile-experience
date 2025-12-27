import { AlertTriangle, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UsageType, formatLimit, TIER_NAMES, SubscriptionTier } from '@/lib/tierLimits';
import { useNavigate } from 'react-router-dom';

interface UsageLimitBannerProps {
  usageType: UsageType;
  used: number;
  limit: number;
  tier: SubscriptionTier;
  isUnlimited?: boolean;
}

const usageTypeLabels: Record<UsageType, string> = {
  quotes: 'quotes',
  invoices: 'invoices',
  jobs: 'jobs',
  sms: 'SMS messages',
  emails: 'emails',
  clients: 'clients',
};

export function UsageLimitBanner({ usageType, used, limit, tier, isUnlimited }: UsageLimitBannerProps) {
  const navigate = useNavigate();
  const label = usageTypeLabels[usageType];
  const remaining = limit - used;
  const percentUsed = (used / limit) * 100;

  // Don't show if unlimited or plenty remaining
  if (isUnlimited || remaining > 3) return null;

  const isAtLimit = remaining <= 0;
  const isNearLimit = remaining <= 3 && remaining > 0;

  if (isAtLimit) {
    return (
      <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 mb-4 animate-fade-in">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-destructive" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">
              {label.charAt(0).toUpperCase() + label.slice(1)} limit reached
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              You've used all {formatLimit(limit)} {label} for this month on the {TIER_NAMES[tier]} plan.
              Upgrade to continue creating.
            </p>
            <Button 
              size="sm" 
              className="mt-3"
              onClick={() => navigate('/settings')}
            >
              <Zap className="w-4 h-4 mr-1" />
              Upgrade Plan
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isNearLimit) {
    return (
      <div className="bg-warning/10 border border-warning/20 rounded-xl p-4 mb-4 animate-fade-in">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-warning/20 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-warning" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">
              {remaining} {label} remaining
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              You've used {used} of {formatLimit(limit)} {label} this month.
            </p>
            {/* Progress bar */}
            <div className="w-full h-2 bg-muted rounded-full mt-2 overflow-hidden">
              <div 
                className="h-full bg-warning rounded-full transition-all"
                style={{ width: `${Math.min(100, percentUsed)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// Full page blocker for when limit is reached
export function UsageLimitBlocker({ usageType, tier }: { usageType: UsageType; tier: SubscriptionTier }) {
  const navigate = useNavigate();
  const label = usageTypeLabels[usageType];

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center animate-fade-in">
      <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
        <AlertTriangle className="w-10 h-10 text-destructive" />
      </div>
      <h2 className="text-xl font-bold text-foreground mb-2">
        Monthly limit reached
      </h2>
      <p className="text-muted-foreground max-w-sm mb-6">
        You've reached your {label} limit for this month on the {TIER_NAMES[tier]} plan.
        Upgrade to get more.
      </p>
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => navigate(-1)}>
          Go Back
        </Button>
        <Button onClick={() => navigate('/settings')}>
          <Zap className="w-4 h-4 mr-1" />
          Upgrade Plan
        </Button>
      </div>
    </div>
  );
}
