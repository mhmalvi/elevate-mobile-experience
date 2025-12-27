import { useState, useEffect } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
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

export default function PaymentSettings() {
  const { profile, updateProfile, loading: profileLoading } = useProfile();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
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
      
      <form onSubmit={handleSubmit} className="p-4 space-y-6 animate-fade-in">
        <p className="text-sm text-muted-foreground">
          These details will appear on your invoices so customers know where to pay.
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
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </form>
    </MobileLayout>
  );
}
