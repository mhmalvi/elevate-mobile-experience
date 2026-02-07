
import { useState, useEffect } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Upload, X, Palette, FileText, Mail, ArrowLeft, Image as ImageIcon, Eye, Check } from 'lucide-react';
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

// Mock Data for Preview
const PREVIEW_DATA = {
  invoiceNumber: 'INV-001',
  date: new Date().toLocaleDateString(),
  client: { name: 'John Doe', address: '123 Main St' },
  items: [
    { desc: 'Service Call', amount: 120.00 },
    { desc: 'Materials', amount: 45.50 }
  ],
  total: 165.50
};

export default function BrandingSettings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('logo');

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
        description: 'Your branding settings have been updated.',
        className: 'bg-success/10 border-success/20 text-success'
      });
    }
    setLoading(false);
  };

  // Preview Component
  const DocumentPreview = () => {
    const isGradient = form.document_header_style === 'gradient';
    const isSolid = form.document_header_style === 'solid';

    return (
      <div className="w-full bg-white text-black rounded-lg shadow-2xl overflow-hidden text-[10px] leading-tight transition-all duration-500 ease-in-out">
        {/* Header */}
        <div
          className={`px-6 py-5 transition-all duration-500 ${isGradient ? 'text-white' : isSolid ? 'text-white' : 'bg-white border-b'
            }`}
          style={{
            background: isGradient
              ? `linear-gradient(135deg, ${form.primary_color}, ${form.secondary_color})`
              : isSolid ? form.primary_color : '#ffffff'
          }}
        >
          <div className={`flex items-center ${form.logo_position === 'center' ? 'justify-center flex-col gap-3' :
              form.logo_position === 'right' ? 'justify-between flex-row-reverse' :
                'justify-between'
            }`}>
            {form.show_logo_on_documents && form.logo_url ? (
              <img src={form.logo_url} alt="Logo" className="h-10 object-contain bg-white/10 rounded backdrop-blur-sm" />
            ) : form.show_logo_on_documents ? (
              <div className="h-10 w-10 bg-white/20 rounded flex items-center justify-center font-bold">LOGO</div>
            ) : <div />}

            <div className={`${form.logo_position === 'center' ? 'text-center' : 'text-right'}`}>
              <h1 className="text-xl font-bold uppercase tracking-wider opacity-90">Invoice</h1>
              <p className="opacity-75">#INV-001</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="text-gray-500 font-semibold mb-1">Billed To:</p>
              <p className="font-bold text-gray-900">{PREVIEW_DATA.client.name}</p>
              <p className="text-gray-600">{PREVIEW_DATA.client.address}</p>
            </div>
            <div className="text-right">
              <p className="text-gray-500 font-semibold mb-1">Date Issued:</p>
              <p className="text-gray-900">{PREVIEW_DATA.date}</p>
            </div>
          </div>

          {/* Table */}
          <div className="border rounded-lg overflow-hidden">
            <div
              className="grid grid-cols-4 bg-gray-50 px-4 py-2 font-semibold text-gray-700"
              style={{ borderTop: `2px solid ${form.primary_color}` }}
            >
              <div className="col-span-2">Description</div>
              <div className="text-right">Qty</div>
              <div className="text-right">Amount</div>
            </div>
            {PREVIEW_DATA.items.map((item, i) => (
              <div key={i} className="grid grid-cols-4 px-4 py-3 border-t border-gray-100">
                <div className="col-span-2 text-gray-800">{item.desc}</div>
                <div className="text-right text-gray-600">1</div>
                <div className="text-right text-gray-900">${item.amount.toFixed(2)}</div>
              </div>
            ))}
            <div className="flex justify-between items-center px-4 py-3 bg-gray-50/50 border-t">
              <span className="font-bold text-gray-800 text-sm">Total</span>
              <span className="font-bold text-lg" style={{ color: form.primary_color }}>
                ${PREVIEW_DATA.total.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-dashed space-y-2">
            <div>
              <p className="text-gray-500 font-bold mb-1">Terms:</p>
              <p className="text-gray-600 italic">
                {form.default_invoice_terms || "Payment is due within 14 days."}
              </p>
            </div>
            <div className="text-center pt-4 text-gray-400 font-medium">
              {form.document_footer_text}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const EmailPreview = () => (
    <div className="w-full bg-white text-gray-800 rounded-lg shadow-2xl overflow-hidden text-xs font-sans">
      <div
        className="h-2 w-full"
        style={{ backgroundColor: form.email_header_color }}
      />
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3 pb-4 border-b">
          {form.logo_url ? (
            <img src={form.logo_url} alt="Logo" className="h-8 object-contain" />
          ) : (
            <div className="h-8 w-8 bg-gray-200 rounded flex items-center justify-center text-[8px]">LOGO</div>
          )}
          <span className="font-bold text-gray-900">Your Business Name</span>
        </div>

        <div className="space-y-3 text-gray-600 leading-relaxed">
          <p>Hi {PREVIEW_DATA.client.name},</p>
          <p>Here's invoice #INV-001 for ${PREVIEW_DATA.total.toFixed(2)}.</p>
          <p>The amount is due on {PREVIEW_DATA.date}.</p>

          <div className="my-4">
            <button
              className="px-4 py-2 rounded text-white font-medium text-xs transition-opacity hover:opacity-90"
              style={{ backgroundColor: form.primary_color }}
            >
              View Invoice
            </button>
          </div>

          {form.email_signature ? (
            <div className="whitespace-pre-wrap pt-2 text-gray-800 border-l-2 pl-3" style={{ borderColor: form.primary_color }}>
              {form.email_signature}
            </div>
          ) : (
            <p>Thanks,<br />Your Business Team</p>
          )}
        </div>

        <div className="pt-4 mt-4 border-t text-center text-gray-400 text-[10px]">
          {form.email_footer_text || "Sent via your business"}
        </div>
      </div>
    </div>
  );

  if (initialLoading) {
    return (
      <MobileLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div className="min-h-screen pb-20 scrollbar-hide">
        {/* Simplified Header */}
        <div className="sticky top-0 z-30 glass border-b border-border/40 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/settings')}
                className="h-8 w-8 -ml-2 rounded-full hover:bg-primary/10 hover:text-primary transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                Branding
              </h1>
            </div>
            <Button onClick={handleSubmit} disabled={loading} size="sm" className="rounded-full shadow-glow-sm">
              {loading ? <span className="animate-spin mr-2">⟳</span> : <Check className="w-4 h-4 mr-1" />}
              Save
            </Button>
          </div>
        </div>

        <div className="p-4 lg:p-8 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Settings Section */}
          <div className="lg:col-span-7 space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full grid grid-cols-3 bg-muted/50 p-1 rounded-2xl mb-6">
                <TabsTrigger value="logo" className="rounded-xl data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-lg transition-all">
                  <Palette className="w-4 h-4 mr-2" />
                  Logo & Colors
                </TabsTrigger>
                <TabsTrigger value="documents" className="rounded-xl data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-lg transition-all">
                  <FileText className="w-4 h-4 mr-2" />
                  Documents
                </TabsTrigger>
                <TabsTrigger value="emails" className="rounded-xl data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-lg transition-all">
                  <Mail className="w-4 h-4 mr-2" />
                  Emails
                </TabsTrigger>
              </TabsList>

              <div className="active:outline-none focus:outline-none transform transition-all duration-500 ease-out">
                <TabsContent value="logo" className="space-y-6 m-0 animate-fade-in-up">
                  {/* Logo Section */}
                  <div className="card-premium p-6">
                    <div className="flex items-center justify-between mb-4">
                      <Label className="text-base font-semibold">Business Logo</Label>
                      <span className="text-xs text-muted-foreground bg-primary/10 text-primary px-2 py-1 rounded-full">SVG, PNG, JPG</span>
                    </div>

                    <div className="flex gap-6 items-start">
                      <div className="relative group">
                        <div className={`w-32 h-32 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all duration-300 ${form.logo_url ? 'border-primary/50 bg-primary/5' : 'border-muted-foreground/30 hover:border-primary hover:bg-muted/50'}`}>
                          {form.logo_url ? (
                            <>
                              <img src={form.logo_url} alt="Logo" className="w-full h-full object-contain p-2" />
                              <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button size="sm" variant="destructive" onClick={handleRemoveLogo} className="h-8 w-8 p-0 rounded-full">
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            </>
                          ) : (
                            <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer">
                              <Upload className="w-8 h-8 text-muted-foreground mb-2 group-hover:scale-110 transition-transform" />
                              <span className="text-xs text-muted-foreground">Upload Logo</span>
                              <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                            </label>
                          )}
                        </div>
                      </div>

                      <div className="flex-1 space-y-4">
                        <div className="space-y-2">
                          <Label>Position on Document</Label>
                          <div className="grid grid-cols-3 gap-2">
                            {['left', 'center', 'right'].map((pos) => (
                              <button
                                key={pos}
                                type="button"
                                onClick={() => setForm({ ...form, logo_position: pos as any })}
                                className={`p-2 rounded-lg border text-xs font-medium capitalize transition-all ${form.logo_position === pos
                                    ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/20'
                                    : 'border-border hover:bg-muted'
                                  }`}
                              >
                                {pos}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Colors Section */}
                  <div className="card-premium p-6 space-y-6">
                    <Label className="text-base font-semibold">Brand Colors</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {[
                        { label: 'Primary', key: 'primary_color' },
                        { label: 'Secondary', key: 'secondary_color' },
                        { label: 'Text', key: 'text_color' },
                        { label: 'Accent', key: 'accent_color' }
                      ].map((color) => (
                        <div key={color.key} className="space-y-2">
                          <Label className="text-sm text-muted-foreground">{color.label}</Label>
                          <div className="flex gap-3">
                            <div className="relative w-12 h-12 rounded-xl overflow-hidden shadow-sm ring-1 ring-border group">
                              <input
                                type="color"
                                value={form[color.key as keyof typeof form] as string}
                                onChange={(e) => setForm({ ...form, [color.key]: e.target.value })}
                                className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] cursor-pointer p-0 border-0"
                              />
                            </div>
                            <Input
                              value={form[color.key as keyof typeof form] as string}
                              onChange={(e) => setForm({ ...form, [color.key]: e.target.value })}
                              className="flex-1 font-mono hover:border-primary/50 focus:border-primary transition-colors"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="documents" className="space-y-6 m-0 animate-fade-in-up">
                  <div className="card-premium p-6 space-y-6">
                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border/50">
                      <div className="space-y-1">
                        <Label className="text-base">Show Logo</Label>
                        <p className="text-xs text-muted-foreground">Display logo on generated PDFs</p>
                      </div>
                      <Switch
                        checked={form.show_logo_on_documents}
                        onCheckedChange={(c) => setForm({ ...form, show_logo_on_documents: c })}
                      />
                    </div>

                    <div className="space-y-3">
                      <Label>Header Style</Label>
                      <div className="grid grid-cols-3 gap-3">
                        {['gradient', 'solid', 'minimal'].map((style) => (
                          <div
                            key={style}
                            onClick={() => setForm({ ...form, document_header_style: style as any })}
                            className={`cursor-pointer rounded-xl border-2 p-1 transition-all ${form.document_header_style === style
                                ? 'border-primary ring-2 ring-primary/20 scale-[1.02]'
                                : 'border-transparent hover:border-border scale-100'
                              }`}
                          >
                            <div className={`h-16 rounded-lg w-full mb-2 shadow-sm ${style === 'gradient' ? 'bg-gradient-to-br from-blue-500 to-indigo-600' :
                                style === 'solid' ? 'bg-blue-500' :
                                  'border-b border-gray-300 bg-white'
                              }`} />
                            <p className="text-center text-xs font-medium capitalize">{style}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4 pt-2">
                      <div className="space-y-2">
                        <Label>Default Quote Terms</Label>
                        <Textarea
                          placeholder="Terms and conditions..."
                          value={form.default_quote_terms}
                          onChange={(e) => setForm({ ...form, default_quote_terms: e.target.value })}
                          className="min-h-[100px] resize-none focus:ring-primary/20"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Default Invoice Terms</Label>
                        <Textarea
                          placeholder="Payment terms..."
                          value={form.default_invoice_terms}
                          onChange={(e) => setForm({ ...form, default_invoice_terms: e.target.value })}
                          className="min-h-[100px] resize-none focus:ring-primary/20"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Footer Text</Label>
                        <Input
                          value={form.document_footer_text}
                          onChange={(e) => setForm({ ...form, document_footer_text: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="emails" className="space-y-6 m-0 animate-fade-in-up">
                  <div className="card-premium p-6 space-y-6">
                    <div className="space-y-2">
                      <Label>Email Header Color</Label>
                      <div className="flex gap-3">
                        <div className="relative w-12 h-12 rounded-xl overflow-hidden shadow-sm ring-1 ring-border group">
                          <input
                            type="color"
                            value={form.email_header_color}
                            onChange={(e) => setForm({ ...form, email_header_color: e.target.value })}
                            className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] cursor-pointer p-0 border-0"
                          />
                        </div>
                        <Input
                          value={form.email_header_color}
                          onChange={(e) => setForm({ ...form, email_header_color: e.target.value })}
                          className="flex-1 font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Email Signature</Label>
                      <Textarea
                        value={form.email_signature}
                        onChange={(e) => setForm({ ...form, email_signature: e.target.value })}
                        placeholder="Best regards..."
                        className="min-h-[120px] resize-none focus:ring-primary/20"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Email Footer</Label>
                      <Input
                        value={form.email_footer_text}
                        onChange={(e) => setForm({ ...form, email_footer_text: e.target.value })}
                      />
                    </div>
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </div>

          {/* Preview Section - Sticky on Desktop */}
          <div className="lg:col-span-5 space-y-4">
            <div className="sticky top-24 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Live Preview</h3>
              </div>

              <div className="animate-fade-in transition-all duration-300 transform">
                {activeTab === 'emails' ? <EmailPreview /> : <DocumentPreview />}
              </div>

              <div className="p-4 bg-muted/20 rounded-xl border border-border/50 text-xs text-muted-foreground text-center">
                This preview is an approximation. Actual documents may vary slightly.
              </div>
            </div>
          </div>
        </div>
      </div>
    </MobileLayout>
  );
}
