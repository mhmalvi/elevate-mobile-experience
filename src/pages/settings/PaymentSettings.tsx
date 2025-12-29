import { useState, useEffect } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { CheckCircle2, XCircle, Loader2, CreditCard } from 'lucide-react';
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
    if (profile) {
      setForm({
        bank_name: profile.bank_name || '',
        bank_bsb: profile.bank_bsb || '',
        bank_account_number: profile.bank_account_number || '',
        bank_account_name: profile.bank_account_name || '',
        payment_terms: profile.payment_terms || 14
      });
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

    const { error } = await updateProfile(form);

    if (error) {
      toast({
        title: 'Error saving',
        description: error.message,
        variant: 'destructive'
      });
    } else {
      toast({
        title: 'Settings saved',
        description: 'Your payment details have been updated.'
      });
    }
    setLoading(false);
  };

  if (profileLoading) {
    return (
      <MobileLayout>
        <PageHeader title="Payment Details" showBack />
        <div className="flex items-center justify-center p-8">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <PageHeader title="Payment Details" showBack />

      <div className="p-4 space-y-6 animate-fade-in">
        {/* Stripe Connect Section */}
        <Card className="p-4 space-y-4">
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
                className="w-full"
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
                className="w-full"
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
                className="w-full"
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
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">Bank Transfer Details</h3>
          </div>

          <p className="text-sm text-muted-foreground">
            These details will appear on your invoices for customers who prefer bank transfers.
          </p>

        {/* Bank Name */}
        <div className="space-y-2">
          <Label htmlFor="bankName">Bank Name</Label>
          <Input
            id="bankName"
            value={form.bank_name}
            onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
            placeholder="e.g., Commonwealth Bank"
          />
        </div>

        {/* BSB */}
        <div className="space-y-2">
          <Label htmlFor="bsb">BSB</Label>
          <Input
            id="bsb"
            value={form.bank_bsb}
            onChange={(e) => setForm({ ...form, bank_bsb: e.target.value })}
            placeholder="000-000"
            maxLength={7}
          />
        </div>

        {/* Account Number */}
        <div className="space-y-2">
          <Label htmlFor="accountNumber">Account Number</Label>
          <Input
            id="accountNumber"
            value={form.bank_account_number}
            onChange={(e) => setForm({ ...form, bank_account_number: e.target.value })}
            placeholder="00000000"
          />
        </div>

        {/* Account Name */}
        <div className="space-y-2">
          <Label htmlFor="accountName">Account Name</Label>
          <Input
            id="accountName"
            value={form.bank_account_name}
            onChange={(e) => setForm({ ...form, bank_account_name: e.target.value })}
            placeholder="e.g., Smith Electrical Pty Ltd"
          />
        </div>

        {/* Payment Terms */}
        <div className="space-y-2">
          <Label>Default Payment Terms</Label>
          <Select
            value={form.payment_terms.toString()}
            onValueChange={(value) => setForm({ ...form, payment_terms: parseInt(value) })}
          >
            <SelectTrigger>
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

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Saving...' : 'Save Bank Details'}
          </Button>
        </form>
      </div>
    </MobileLayout>
  );
}
