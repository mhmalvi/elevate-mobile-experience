import { useState, useEffect } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Upload, X, Palette, FileText, Mail, ArrowLeft, Image as ImageIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function BrandingSettings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [form, setForm] = useState({
    // Logo settings
    logo_url: '',
    logo_position: 'left' as 'left' | 'center' | 'right',
    show_logo_on_documents: true,

    // Color settings
    primary_color: '#3b82f6',
    secondary_color: '#1d4ed8',
    text_color: '#1a1a1a',
    accent_color: '#3b82f6',

    // Email branding
    email_header_color: '#3b82f6',
    email_footer_text: '',
    email_signature: '',

    // Document branding
    document_header_style: 'gradient' as 'gradient' | 'solid' | 'minimal',
    default_quote_terms: '',
    default_invoice_terms: '',
    document_footer_text: 'Thank you for your business!',
  });

  useEffect(() => {
    if (user) {
      fetchBrandingSettings();
    }
  }, [user]);

  const fetchBrandingSettings = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('branding_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!error && data) {
      setForm({
        logo_url: data.logo_url || '',
        logo_position: (data.logo_position as 'left' | 'center' | 'right') || 'left',
        show_logo_on_documents: data.show_logo_on_documents ?? true,
        primary_color: data.primary_color || '#3b82f6',
        secondary_color: data.secondary_color || '#1d4ed8',
        text_color: data.text_color || '#1a1a1a',
        accent_color: data.accent_color || '#3b82f6',
        email_header_color: data.email_header_color || '#3b82f6',
        email_footer_text: data.email_footer_text || '',
        email_signature: data.email_signature || '',
        document_header_style: (data.document_header_style as 'gradient' | 'solid' | 'minimal') || 'gradient',
        default_quote_terms: data.default_quote_terms || '',
        default_invoice_terms: data.default_invoice_terms || '',
        document_footer_text: data.document_footer_text || 'Thank you for your business!',
      });
    }
    setInitialLoading(false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Logo must be less than 2MB',
        variant: 'destructive'
      });
      return;
    }

    setUploading(true);

    // Upload to storage
    const fileExt = file.name.split('.').pop();
    const filePath = `${user.id}/branding-logo.${fileExt}`;

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

    // Update form
    setForm({ ...form, logo_url: publicUrl });

    toast({
      title: 'Logo uploaded',
      description: 'Your branding logo has been updated.'
    });
    setUploading(false);
  };

  const handleRemoveLogo = async () => {
    if (!user || !form.logo_url) return;

    setUploading(true);

    // Delete from storage
    const filePath = `${user.id}/branding-logo`;
    await supabase.storage.from('business-logos').remove([filePath]);

    // Update form
    setForm({ ...form, logo_url: '' });

    toast({
      title: 'Logo removed',
      description: 'Your branding logo has been removed.'
    });
    setUploading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);

    const { error } = await supabase
      .from('branding_settings')
      .upsert({
        user_id: user.id,
        ...form,
      }, {
        onConflict: 'user_id'
      });

    if (error) {
      toast({
        title: 'Error saving',
        description: error.message,
        variant: 'destructive'
      });
    } else {
      toast({
        title: 'Branding saved',
        description: 'Your branding settings have been updated.'
      });
    }
    setLoading(false);
  };

  if (initialLoading) {
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
                <Palette className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-primary">Brand Identity</span>
              </div>
              <h1 className="text-3xl font-bold text-foreground">Branding</h1>
              <p className="text-muted-foreground mt-1">
                Customize your business appearance
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
              <Palette className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Brand Identity</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground">Branding</h1>
            <p className="text-muted-foreground mt-1">
              Customize your business appearance
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="animate-fade-in">
          <Tabs defaultValue="logo" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mx-4 mt-4">
              <TabsTrigger value="logo" className="flex items-center gap-2">
                <Palette className="w-4 h-4" />
                <span className="hidden sm:inline">Logo & Colors</span>
                <span className="sm:hidden">Logo</span>
              </TabsTrigger>
              <TabsTrigger value="documents" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">Documents</span>
                <span className="sm:hidden">Docs</span>
              </TabsTrigger>
              <TabsTrigger value="emails" className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                <span>Emails</span>
              </TabsTrigger>
            </TabsList>

            {/* Logo & Colors Tab */}
            <TabsContent value="logo" className="px-4 pb-32 space-y-6">
              {/* Logo Upload */}
              <div className="space-y-3 p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 animate-fade-in">
                <div className="flex items-center gap-2 mb-2">
                  <ImageIcon className="w-4 h-4 text-primary" />
                  <Label className="font-semibold">Business Logo</Label>
                </div>
                <div className="flex items-center gap-4">
                  {form.logo_url ? (
                    <div className="relative">
                      <img
                        src={form.logo_url}
                        alt="Business logo"
                        className="w-20 h-20 object-contain rounded-lg border bg-background"
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
                    <label className="w-20 h-20 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all">
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
                <p className="text-xs text-muted-foreground">Max 2MB. Appears on documents and emails.</p>
              </div>

              {/* Logo Position */}
              <div className="space-y-2 p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 animate-fade-in" style={{ animationDelay: '0.05s' }}>
                <Label>Logo Position</Label>
                <Select
                  value={form.logo_position}
                  onValueChange={(value) => setForm({ ...form, logo_position: value as 'left' | 'center' | 'right' })}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="center">Center</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Color Pickers */}
              <div className="space-y-4 p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 animate-fade-in" style={{ animationDelay: '0.1s' }}>
                <div className="flex items-center gap-2 mb-2">
                  <Palette className="w-4 h-4 text-primary" />
                  <Label className="font-semibold">Brand Colors</Label>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label htmlFor="primaryColor" className="text-sm">Primary Color</Label>
                    <div className="flex items-center gap-3 mt-1.5">
                      <div className="relative w-16 h-10 rounded-xl border shadow-sm overflow-hidden transition-transform active:scale-95 group">
                        <div
                          className="absolute inset-0 group-hover:opacity-90 transition-opacity"
                          style={{ backgroundColor: form.primary_color }}
                        />
                        <input
                          id="primaryColor"
                          type="color"
                          value={form.primary_color}
                          onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer p-0 border-0"
                        />
                      </div>
                      <Input
                        value={form.primary_color}
                        onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                        placeholder="#3b82f6"
                        className="flex-1 font-mono uppercase rounded-xl"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="secondaryColor" className="text-sm">Secondary Color</Label>
                    <div className="flex items-center gap-3 mt-1.5">
                      <div className="relative w-16 h-10 rounded-xl border shadow-sm overflow-hidden transition-transform active:scale-95 group">
                        <div
                          className="absolute inset-0 group-hover:opacity-90 transition-opacity"
                          style={{ backgroundColor: form.secondary_color }}
                        />
                        <input
                          id="secondaryColor"
                          type="color"
                          value={form.secondary_color}
                          onChange={(e) => setForm({ ...form, secondary_color: e.target.value })}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer p-0 border-0"
                        />
                      </div>
                      <Input
                        value={form.secondary_color}
                        onChange={(e) => setForm({ ...form, secondary_color: e.target.value })}
                        placeholder="#1d4ed8"
                        className="flex-1 font-mono uppercase rounded-xl"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="accentColor" className="text-sm">Accent Color</Label>
                    <div className="flex items-center gap-3 mt-1.5">
                      <div className="relative w-16 h-10 rounded-xl border shadow-sm overflow-hidden transition-transform active:scale-95 group">
                        <div
                          className="absolute inset-0 group-hover:opacity-90 transition-opacity"
                          style={{ backgroundColor: form.accent_color }}
                        />
                        <input
                          id="accentColor"
                          type="color"
                          value={form.accent_color}
                          onChange={(e) => setForm({ ...form, accent_color: e.target.value })}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer p-0 border-0"
                        />
                      </div>
                      <Input
                        value={form.accent_color}
                        onChange={(e) => setForm({ ...form, accent_color: e.target.value })}
                        placeholder="#3b82f6"
                        className="flex-1 font-mono uppercase rounded-xl"
                      />
                    </div>
                  </div>
                </div>

                {/* Live Preview */}
                <div className="pt-3">
                  <Label className="text-sm mb-2 block">Color Preview</Label>
                  <div
                    className="h-24 rounded-xl"
                    style={{
                      background: `linear-gradient(135deg, ${form.primary_color} 0%, ${form.secondary_color} 100%)`
                    }}
                  />
                </div>
              </div>
            </TabsContent>

            {/* Documents Tab */}
            <TabsContent value="documents" className="px-4 pb-32 space-y-6">
              {/* Show Logo on Documents */}
              <div className="flex items-center justify-between p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 animate-fade-in">
                <div className="space-y-0.5">
                  <Label htmlFor="showLogo" className="font-medium">Show Logo on Documents</Label>
                  <p className="text-xs text-muted-foreground">Display your logo on PDFs</p>
                </div>
                <Switch
                  id="showLogo"
                  checked={form.show_logo_on_documents}
                  onCheckedChange={(checked) => setForm({ ...form, show_logo_on_documents: checked })}
                />
              </div>

              {/* Document Header Style */}
              <div className="space-y-2 p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 animate-fade-in" style={{ animationDelay: '0.05s' }}>
                <Label>Document Header Style</Label>
                <Select
                  value={form.document_header_style}
                  onValueChange={(value) => setForm({ ...form, document_header_style: value as 'gradient' | 'solid' | 'minimal' })}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gradient">Gradient</SelectItem>
                    <SelectItem value="solid">Solid Color</SelectItem>
                    <SelectItem value="minimal">Minimal</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Style of the header section on quotes and invoices
                </p>
              </div>

              {/* Default Quote Terms */}
              <div className="space-y-2 p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 animate-fade-in" style={{ animationDelay: '0.1s' }}>
                <Label htmlFor="quoteTerms">Default Quote Terms & Conditions</Label>
                <Textarea
                  id="quoteTerms"
                  value={form.default_quote_terms}
                  onChange={(e) => setForm({ ...form, default_quote_terms: e.target.value })}
                  placeholder="Enter default terms for quotes..."
                  rows={4}
                  className="rounded-xl"
                />
                <p className="text-xs text-muted-foreground">
                  These terms will appear on all new quotes
                </p>
              </div>

              {/* Default Invoice Terms */}
              <div className="space-y-2 p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 animate-fade-in" style={{ animationDelay: '0.15s' }}>
                <Label htmlFor="invoiceTerms">Default Invoice Terms & Conditions</Label>
                <Textarea
                  id="invoiceTerms"
                  value={form.default_invoice_terms}
                  onChange={(e) => setForm({ ...form, default_invoice_terms: e.target.value })}
                  placeholder="Enter default terms for invoices..."
                  rows={4}
                  className="rounded-xl"
                />
                <p className="text-xs text-muted-foreground">
                  These terms will appear on all new invoices
                </p>
              </div>

              {/* Document Footer Text */}
              <div className="space-y-2 p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 animate-fade-in" style={{ animationDelay: '0.2s' }}>
                <Label htmlFor="documentFooter">Document Footer Text</Label>
                <Input
                  id="documentFooter"
                  value={form.document_footer_text}
                  onChange={(e) => setForm({ ...form, document_footer_text: e.target.value })}
                  placeholder="Thank you for your business!"
                  className="rounded-xl"
                />
                <p className="text-xs text-muted-foreground">
                  Appears at the bottom of quotes and invoices
                </p>
              </div>
            </TabsContent>

            {/* Emails Tab */}
            <TabsContent value="emails" className="px-4 pb-32 space-y-6">
              {/* Email Header Color */}
              <div className="space-y-2 p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 animate-fade-in">
                <Label htmlFor="emailHeaderColor">Email Header Color</Label>
                <div className="flex items-center gap-3">
                  <div className="relative w-16 h-10 rounded-xl border shadow-sm overflow-hidden transition-transform active:scale-95 group">
                    <div
                      className="absolute inset-0 group-hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: form.email_header_color }}
                    />
                    <input
                      id="emailHeaderColor"
                      type="color"
                      value={form.email_header_color}
                      onChange={(e) => setForm({ ...form, email_header_color: e.target.value })}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer p-0 border-0"
                    />
                  </div>
                  <Input
                    value={form.email_header_color}
                    onChange={(e) => setForm({ ...form, email_header_color: e.target.value })}
                    placeholder="#3b82f6"
                    className="flex-1 font-mono uppercase rounded-xl"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Background color for email headers
                </p>
              </div>

              {/* Email Signature */}
              <div className="space-y-2 p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 animate-fade-in" style={{ animationDelay: '0.05s' }}>
                <Label htmlFor="emailSignature">Email Signature</Label>
                <Textarea
                  id="emailSignature"
                  value={form.email_signature}
                  onChange={(e) => setForm({ ...form, email_signature: e.target.value })}
                  placeholder="Best regards,&#10;John Smith&#10;Owner, Smith Electrical"
                  rows={4}
                  className="rounded-xl"
                />
                <p className="text-xs text-muted-foreground">
                  Appears after the main message in quote and invoice emails
                </p>
              </div>

              {/* Email Footer Text */}
              <div className="space-y-2 p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 animate-fade-in" style={{ animationDelay: '0.1s' }}>
                <Label htmlFor="emailFooter">Email Footer Text</Label>
                <Input
                  id="emailFooter"
                  value={form.email_footer_text}
                  onChange={(e) => setForm({ ...form, email_footer_text: e.target.value })}
                  placeholder="Thank you for your business!"
                  className="rounded-xl"
                />
                <p className="text-xs text-muted-foreground">
                  Appears at the bottom of all emails
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <div className="px-4 pb-8">
            <Button type="submit" className="w-full rounded-xl" disabled={loading}>
              {loading ? 'Saving...' : 'Save Branding Settings'}
            </Button>
          </div>
        </form>
      </div>
    </MobileLayout>
  );
}
