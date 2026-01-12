import { useState, useEffect } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { CheckCircle2, XCircle, Loader2, CreditCard, Building2, Hash, DollarSign, ArrowLeft, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const paymentTermsOptions = [
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days' },
  { value: '30', label: '30 days' },
];

interface StripeAccountStatus {
  connected: boolean;
  onboarding_complete: boolean;
  charges_enabled: boolean;
  account_id?: string;
}

export default function PaymentSettings() {
  const navigate = useNavigate();
  const { profile, updateProfile, loading: profileLoading } = useProfile();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [checkingStripe, setCheckingStripe] = useState(true);
  const [stripeStatus, setStripeStatus] = useState<StripeAccountStatus>({
    connected: false,
    onboarding_complete: false,
    charges_enabled: false,
  });
  const [form, setForm] = useState({
    bank_name: '',
    bank_bsb: '',
    bank_account_number: '',
    bank_account_name: '',
    payment_terms: 14
  });

  useEffect(() => {
    // SECURITY: Load encrypted bank details from secure edge function
    const loadPaymentSettings = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-payment-settings');

        if (error) {
          console.error('Error loading payment settings:', error);
        } else if (data) {
          setForm({
            bank_name: data.bank_name || '',
            bank_bsb: data.bank_bsb || '',
            bank_account_number: data.bank_account_number || '',
            bank_account_name: data.bank_account_name || '',
            payment_terms: data.payment_terms || 14
          });
        }
      } catch (error) {
        console.error('Error loading payment settings:', error);
      }
    };

    if (profile) {
      loadPaymentSettings();
    }
  }, [profile]);

  // Check Stripe account status on mount
  useEffect(() => {
    checkStripeAccount();
  }, []);

  const checkStripeAccount = async () => {
    setCheckingStripe(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-stripe-account');

      if (error) {
        console.error('Error checking Stripe account:', error);
      } else if (data) {
        setStripeStatus(data);
      }
    } catch (error) {
      console.error('Error checking Stripe account:', error);
    } finally {
      setCheckingStripe(false);
    }
  };

  const connectStripe = async () => {
    setStripeLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-stripe-connect');

      if (error) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to connect Stripe account',
          variant: 'destructive',
        });
      } else if (data?.url) {
        // Open Stripe onboarding in new window
        window.open(data.url, '_blank');

        toast({
          title: 'Redirecting to Stripe',
          description: 'Complete the setup to start accepting payments.',
        });

        // Recheck status after 5 seconds
        setTimeout(() => {
          checkStripeAccount();
        }, 5000);
      }
    } catch (error) {
      console.error('Error connecting Stripe:', error);
      toast({
        title: 'Error',
        description: 'Failed to connect Stripe account',
        variant: 'destructive',
      });
    } finally {
      setStripeLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // SECURITY: Use encrypted edge function to save bank details
      const { data, error } = await supabase.functions.invoke('update-payment-settings', {
        body: form
      });

      if (error) {
        toast({
          title: 'Error saving',
          description: error.message,
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Settings saved',
          description: 'Your payment details have been securely encrypted and saved.'
        });

        // Refresh profile to get latest data
        window.location.reload();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save payment settings',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  if (profileLoading) {
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
                <DollarSign className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-primary">Financial Setup</span>
              </div>
              <h1 className="text-3xl font-bold text-foreground">Payment Details</h1>
              <p className="text-muted-foreground mt-1">
                Configure payment methods and bank details
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center p-8">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      </MobileLayout>
    );
  }

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
              <DollarSign className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Financial Setup</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground">Payment Details</h1>
            <p className="text-muted-foreground mt-1">
              Configure payment methods and bank details
            </p>
          </div>
        </div>

        <div className="px-4 pb-32 space-y-6 animate-fade-in">
          {/* Stripe Connect Section */}
          <Card className="p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 space-y-4">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Online Payments (Stripe)</h3>
            </div>

            <p className="text-sm text-muted-foreground">
              Connect Stripe to accept credit card and digital wallet payments directly from your invoices.
            </p>

            {checkingStripe ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Checking connection status...
              </div>
            ) : stripeStatus.charges_enabled ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-medium">Stripe Connected</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  You can now accept payments on invoices. Funds will be deposited to your bank account within 2-7 business days.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={connectStripe}
                  disabled={stripeLoading}
                  className="w-full rounded-xl"
                >
                  {stripeLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Manage Stripe Account'
                  )}
                </Button>
              </div>
            ) : stripeStatus.connected && !stripeStatus.onboarding_complete ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-yellow-600">
                  <XCircle className="w-5 h-5" />
                  <span className="font-medium">Setup Incomplete</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  You need to complete your Stripe setup to start accepting payments.
                </p>
                <Button
                  type="button"
                  onClick={connectStripe}
                  disabled={stripeLoading}
                  className="w-full rounded-xl"
                >
                  {stripeLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Complete Stripe Setup'
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <XCircle className="w-5 h-5" />
                  <span className="font-medium">Not Connected</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Connect your Stripe account to enable online payments for your invoices.
                </p>
                <Button
                  type="button"
                  onClick={connectStripe}
                  disabled={stripeLoading}
                  className="w-full rounded-xl"
                >
                  {stripeLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Connect Stripe Account'
                  )}
                </Button>
              </div>
            )}
          </Card>

          {/* Bank Details Section */}
          <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in" style={{ animationDelay: '0.05s' }}>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              <h3 className="font-semibold">Bank Transfer Details</h3>
            </div>

            <p className="text-sm text-muted-foreground -mt-4">
              These details will appear on your invoices for customers who prefer bank transfers.
            </p>

            {/* Bank Name */}
            <div className="space-y-2 p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50">
              <Label htmlFor="bankName" className="text-sm font-medium">Bank Name</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="bankName"
                  value={form.bank_name}
                  onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                  placeholder="e.g., Commonwealth Bank"
                  className="pl-10 rounded-xl"
                />
              </div>
            </div>

            {/* BSB */}
            <div className="space-y-2 p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <Label htmlFor="bsb" className="text-sm font-medium">BSB</Label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="bsb"
                  value={form.bank_bsb}
                  onChange={(e) => setForm({ ...form, bank_bsb: e.target.value })}
                  placeholder="000-000"
                  maxLength={7}
                  className="pl-10 rounded-xl"
                />
              </div>
            </div>

            {/* Account Number */}
            <div className="space-y-2 p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 animate-fade-in" style={{ animationDelay: '0.15s' }}>
              <Label htmlFor="accountNumber" className="text-sm font-medium">Account Number</Label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="accountNumber"
                  value={form.bank_account_number}
                  onChange={(e) => setForm({ ...form, bank_account_number: e.target.value })}
                  placeholder="00000000"
                  className="pl-10 rounded-xl"
                />
              </div>
            </div>

            {/* Account Name */}
            <div className="space-y-2 p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <Label htmlFor="accountName" className="text-sm font-medium">Account Name</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="accountName"
                  value={form.bank_account_name}
                  onChange={(e) => setForm({ ...form, bank_account_name: e.target.value })}
                  placeholder="e.g., Smith Electrical Pty Ltd"
                  className="pl-10 rounded-xl"
                />
              </div>
            </div>

            {/* Payment Terms */}
            <div className="space-y-2 p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 animate-fade-in" style={{ animationDelay: '0.25s' }}>
              <Label className="text-sm font-medium flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                Default Payment Terms
              </Label>
              <Select
                value={form.payment_terms.toString()}
                onValueChange={(value) => setForm({ ...form, payment_terms: parseInt(value) })}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select payment terms" />
                </SelectTrigger>
                <SelectContent>
                  {paymentTermsOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Default due date for new invoices
              </p>
            </div>

            <Button type="submit" className="w-full rounded-xl" disabled={loading}>
              {loading ? 'Saving...' : 'Save Bank Details'}
            </Button>
          </form>
        </div>
      </div>
    </MobileLayout>
  );
}
