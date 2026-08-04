import { useState, useEffect } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Upload, X, Building2, Hash, Phone, Mail, MapPin, DollarSign, FileText, ArrowLeft, Image as ImageIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Constants } from '@/integrations/supabase/types';
import { COUNTRIES, getCountry } from '@/lib/countries';

/**
 * Derived from the generated types rather than hand-maintained.
 *
 * The previous hardcoded list had drifted from the database enum in both
 * directions: it offered 'cleaner', which is not a valid `trade_type` value so
 * saving it failed, and it omitted 'roofer', which onboarding does offer — so
 * a roofer opening this page saw their trade blank and could not restore it.
 */
const tradeTypes = Constants.public.Enums.trade_type;

export default function BusinessSettings() {
  const navigate = useNavigate();
  const { profile, updateProfile, loading: profileLoading } = useProfile();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    business_name: '',
    business_number: '',
    trade_type: 'other' as typeof tradeTypes[number],
    phone: '',
    email: '',
    address: '',
    default_hourly_rate: 85,
    license_number: '',
    tax_registered: true,
    country_code: 'AU',
    currency_code: 'AUD',
    tax_rate: 0.1,
    tax_label: 'GST',
  });

  useEffect(() => {
    if (profile) {
      setForm({
        business_name: profile.business_name || '',
        business_number: profile.business_number || '',
        trade_type: profile.trade_type || 'other',
        phone: profile.phone || '',
        email: profile.email || '',
        address: profile.address || '',
        default_hourly_rate: profile.default_hourly_rate || 85,
        license_number: profile.license_number || '',
        tax_registered: profile.tax_registered ?? true,
        country_code: profile.country_code || 'AU',
        currency_code: profile.currency_code || 'AUD',
        tax_rate: typeof profile.tax_rate === 'number' ? profile.tax_rate : 0.1,
        tax_label: profile.tax_label || 'GST',
      });
    }
  }, [profile]);

  /** Reference data for the currently selected country. */
  const country = getCountry(form.country_code);

  /**
   * Changing country re-derives currency and tax, since those are what the
   * country is actually for. The user can still override each afterwards —
   * this only moves them off the previous country's values.
   */
  const handleCountryChange = (code: string) => {
    const next = getCountry(code);
    setForm(prev => ({
      ...prev,
      country_code: next.code,
      currency_code: next.currency,
      tax_rate: next.taxRate,
      tax_label: next.taxLabel,
    }));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);

    // Upload to storage
    const fileExt = file.name.split('.').pop();
    const filePath = `${user.id}/logo.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('business-logos')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast({
        title: 'Upload failed',
        description: uploadError.message,
        variant: 'destructive'
      });
      setUploading(false);
      return;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('business-logos')
      .getPublicUrl(filePath);

    // Update profile
    await updateProfile({ logo_url: publicUrl });

    toast({
      title: 'Logo uploaded',
      description: 'Your business logo has been updated.'
    });
    setUploading(false);
  };

  const handleRemoveLogo = async () => {
    if (!user || !profile?.logo_url) return;

    setUploading(true);

    // Delete from storage
    const filePath = `${user.id}/logo`;
    await supabase.storage.from('business-logos').remove([filePath]);

    // Update profile
    await updateProfile({ logo_url: null });

    toast({
      title: 'Logo removed',
      description: 'Your business logo has been removed.'
    });
    setUploading(false);
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
        description: 'Your business details have been updated.'
      });
    }
    setLoading(false);
  };

  if (profileLoading) {
    return (
      <MobileLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
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
              <Building2 className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Company Information</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground">Business Details</h1>
            <p className="text-muted-foreground mt-1">
              Manage your business information and branding
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-4 pb-32 space-y-6">
          {/* Logo Upload */}
          <div className="space-y-3 animate-fade-in">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-primary" />
              <Label className="font-semibold">Business Logo</Label>
            </div>
            <div className="p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50">
              <div className="flex items-center gap-4">
                {profile?.logo_url ? (
                  <div className="relative">
                    <img
                      src={profile.logo_url}
                      alt="Business logo"
                      className="w-20 h-20 object-contain rounded-xl border bg-background p-2"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      disabled={uploading}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="w-20 h-20 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
                    <Upload className="w-6 h-6 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground mt-1">Upload</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      disabled={uploading}
                      className="hidden"
                    />
                  </label>
                )}
                {uploading && <span className="text-sm text-muted-foreground">Uploading...</span>}
              </div>
            </div>
          </div>

          {/* Basic Information */}
          <div className="space-y-3 animate-fade-in" style={{ animationDelay: '0.05s' }}>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              <h3 className="font-semibold">Basic Information</h3>
            </div>
            <div className="p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 space-y-4">
              <div>
                <Label htmlFor="businessName" className="text-sm font-medium">Business Name *</Label>
                <Input
                  id="businessName"
                  value={form.business_name}
                  onChange={(e) => setForm({ ...form, business_name: e.target.value })}
                  placeholder="e.g., Smith Electrical Services"
                  className="mt-1.5 rounded-xl"
                />
              </div>

              <div>
                <Label htmlFor="country" className="text-sm font-medium">Country</Label>
                <Select value={form.country_code} onValueChange={handleCountryChange}>
                  <SelectTrigger id="country" className="mt-1.5 rounded-xl">
                    <SelectValue placeholder="Select your country" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Sets your currency, tax and number formats.
                </p>
              </div>

              <div>
                {/* Label follows the country: ABN, EIN, GSTIN, Company number… */}
                <Label htmlFor="businessNumber" className="text-sm font-medium">
                  {country.businessNumberLabel}
                </Label>
                <div className="relative mt-1.5">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="businessNumber"
                    value={form.business_number}
                    onChange={(e) => setForm({ ...form, business_number: e.target.value })}
                    placeholder={country.businessNumberPlaceholder}
                    className="pl-10 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Trade Type</Label>
                <Select
                  value={form.trade_type}
                  onValueChange={(value) => setForm({ ...form, trade_type: value as typeof tradeTypes[number] })}
                >
                  <SelectTrigger className="mt-1.5 rounded-xl">
                    <SelectValue placeholder="Select your trade" />
                  </SelectTrigger>
                  <SelectContent>
                    {tradeTypes.map((trade) => (
                      <SelectItem key={trade} value={trade}>
                        {trade.charAt(0).toUpperCase() + trade.slice(1).replace('_', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="licenseNumber" className="text-sm font-medium">License Number</Label>
                <div className="relative mt-1.5">
                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="licenseNumber"
                    value={form.license_number}
                    onChange={(e) => setForm({ ...form, license_number: e.target.value })}
                    placeholder="e.g., EC12345"
                    className="pl-10 rounded-xl"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">Your trade license number for compliance display</p>
              </div>
            </div>
          </div>

          {/* Contact Details */}
          <div className="space-y-3 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-primary" />
              <h3 className="font-semibold">Contact Details</h3>
            </div>
            <div className="p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 space-y-4">
              <div>
                <Label htmlFor="phone" className="text-sm font-medium">Phone</Label>
                <div className="relative mt-1.5">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="0400 000 000"
                    className="pl-10 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="email" className="text-sm font-medium">Business Email</Label>
                <div className="relative mt-1.5">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="hello@yourbusiness.com.au"
                    className="pl-10 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="address" className="text-sm font-medium">Business Address</Label>
                <div className="relative mt-1.5">
                  <MapPin className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Textarea
                    id="address"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="123 Trade Street, Sydney NSW 2000"
                    rows={2}
                    className="pl-10 rounded-xl resize-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Pricing & Tax */}
          <div className="space-y-3 animate-fade-in" style={{ animationDelay: '0.15s' }}>
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-primary" />
              <h3 className="font-semibold">Pricing & Tax</h3>
            </div>
            <div className="p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 space-y-4">
              <div>
                <Label htmlFor="hourlyRate" className="text-sm font-medium">Default Hourly Rate ($)</Label>
                <div className="relative mt-1.5">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="hourlyRate"
                    type="number"
                    value={form.default_hourly_rate}
                    onChange={(e) => setForm({ ...form, default_hourly_rate: parseFloat(e.target.value) || 0 })}
                    placeholder="85"
                    className="pl-10 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-background/50 rounded-xl">
                <div className="space-y-0.5">
                  <Label htmlFor="taxRegistered" className="font-medium">
                    Registered for {form.tax_label}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Turn off if you don't charge {form.tax_label} on your work
                  </p>
                </div>
                <Switch
                  id="taxRegistered"
                  checked={form.tax_registered}
                  onCheckedChange={(checked) => setForm({
                    ...form,
                    tax_registered: checked,
                    // Unregistering must actually stop tax being added, not just
                    // flip a label — the rate is what the calculations read.
                    tax_rate: checked ? (form.tax_rate || country.taxRate) : 0,
                  })}
                />
              </div>

              {form.tax_registered && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="taxLabel" className="text-sm font-medium">Tax name</Label>
                    <Input
                      id="taxLabel"
                      value={form.tax_label}
                      onChange={(e) => setForm({ ...form, tax_label: e.target.value })}
                      placeholder="GST"
                      className="mt-1.5 rounded-xl"
                    />
                  </div>
                  <div>
                    <Label htmlFor="taxRate" className="text-sm font-medium">Rate (%)</Label>
                    <Input
                      id="taxRate"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={100}
                      step={0.5}
                      value={+(form.tax_rate * 100).toFixed(2)}
                      onChange={(e) => {
                        const pct = parseFloat(e.target.value);
                        setForm({
                          ...form,
                          tax_rate: isNaN(pct) ? 0 : Math.min(Math.max(pct, 0), 100) / 100,
                        });
                      }}
                      className="mt-1.5 rounded-xl"
                    />
                  </div>
                  {country.taxRateIsAdvisory && (
                    <p className="col-span-2 text-xs text-warning">
                      In {country.name}, {country.taxLabel.toLowerCase()} varies by
                      {country.code === 'US' ? ' state and county' :
                        country.code === 'CA' ? ' province' : ' category of work'}.
                      Please confirm the rate that applies to you — this is a starting point, not advice.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <Button type="submit" className="w-full rounded-xl" disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </form>
      </div>
    </MobileLayout>
  );
}
