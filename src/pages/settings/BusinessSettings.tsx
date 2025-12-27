import { useState, useEffect } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Upload, X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Constants } from '@/integrations/supabase/types';

const tradeTypes = Constants.public.Enums.trade_type;

export default function BusinessSettings() {
  const { profile, updateProfile, loading: profileLoading } = useProfile();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    business_name: '',
    abn: '',
    trade_type: 'other' as typeof tradeTypes[number],
    phone: '',
    email: '',
    address: '',
    default_hourly_rate: 85,
    license_number: '',
    gst_registered: true,
  });

  useEffect(() => {
    if (profile) {
      setForm({
        business_name: profile.business_name || '',
        abn: profile.abn || '',
        trade_type: profile.trade_type || 'other',
        phone: profile.phone || '',
        email: profile.email || '',
        address: profile.address || '',
        default_hourly_rate: profile.default_hourly_rate || 85,
        license_number: (profile as any).license_number || '',
        gst_registered: (profile as any).gst_registered ?? true,
      });
    }
  }, [profile]);

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
        <PageHeader title="Business Details" showBack />
        <div className="flex items-center justify-center p-8">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <PageHeader title="Business Details" showBack />
      
      <form onSubmit={handleSubmit} className="p-4 space-y-6 animate-fade-in">
        {/* Logo Upload */}
        <div className="space-y-2">
          <Label>Business Logo</Label>
          <div className="flex items-center gap-4">
            {profile?.logo_url ? (
              <div className="relative">
                <img 
                  src={profile.logo_url} 
                  alt="Business logo" 
                  className="w-20 h-20 object-contain rounded-lg border bg-background"
                />
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  disabled={uploading}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="w-20 h-20 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors">
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

        {/* Business Name */}
        <div className="space-y-2">
          <Label htmlFor="businessName">Business Name *</Label>
          <Input
            id="businessName"
            value={form.business_name}
            onChange={(e) => setForm({ ...form, business_name: e.target.value })}
            placeholder="e.g., Smith Electrical Services"
          />
        </div>

        {/* ABN */}
        <div className="space-y-2">
          <Label htmlFor="abn">ABN</Label>
          <Input
            id="abn"
            value={form.abn}
            onChange={(e) => setForm({ ...form, abn: e.target.value })}
            placeholder="00 000 000 000"
          />
        </div>

        {/* Trade Type */}
        <div className="space-y-2">
          <Label>Trade Type</Label>
          <Select
            value={form.trade_type}
            onValueChange={(value) => setForm({ ...form, trade_type: value as typeof tradeTypes[number] })}
          >
            <SelectTrigger>
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

        {/* Contact Details */}
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="0400 000 000"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Business Email</Label>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="hello@yourbusiness.com.au"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">Business Address</Label>
          <Textarea
            id="address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="123 Trade Street, Sydney NSW 2000"
            rows={2}
          />
        </div>

        {/* Default Hourly Rate */}
        <div className="space-y-2">
          <Label htmlFor="hourlyRate">Default Hourly Rate ($)</Label>
          <Input
            id="hourlyRate"
            type="number"
            value={form.default_hourly_rate}
            onChange={(e) => setForm({ ...form, default_hourly_rate: parseFloat(e.target.value) || 0 })}
            placeholder="85"
          />
        </div>

        {/* License Number */}
        <div className="space-y-2">
          <Label htmlFor="licenseNumber">License Number</Label>
          <Input
            id="licenseNumber"
            value={form.license_number}
            onChange={(e) => setForm({ ...form, license_number: e.target.value })}
            placeholder="e.g., EC12345"
          />
          <p className="text-xs text-muted-foreground">Your trade license number for compliance display on documents</p>
        </div>

        {/* GST Registered */}
        <div className="flex items-center justify-between p-4 bg-card rounded-xl border">
          <div className="space-y-0.5">
            <Label htmlFor="gstRegistered" className="font-medium">GST Registered</Label>
            <p className="text-xs text-muted-foreground">Toggle off if not registered for GST</p>
          </div>
          <Switch
            id="gstRegistered"
            checked={form.gst_registered}
            onCheckedChange={(checked) => setForm({ ...form, gst_registered: checked })}
          />
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </form>
    </MobileLayout>
  );
}
