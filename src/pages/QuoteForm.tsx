import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PremiumCard } from '@/components/ui/premium-card';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, User, FileText, Sparkles, Calendar } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { format, addDays } from 'date-fns';

type Client = Tables<'clients'>;
type QuoteTemplate = Tables<'quote_templates'>;

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  item_type: 'labour' | 'materials';
}

interface TemplateItem {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  item_type: string;
}

export default function QuoteForm() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [templates, setTemplates] = useState<QuoteTemplate[]>([]);
  const [step, setStep] = useState<'template' | 'details'>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<QuoteTemplate | null>(null);
  const [form, setForm] = useState({
    client_id: '',
    title: '',
    description: '',
    notes: '',
    valid_until: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
  });
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: crypto.randomUUID(), description: '', quantity: 1, unit: 'each', unit_price: 0, item_type: 'labour' }
  ]);

  useEffect(() => {
    if (user) {
      fetchClients();
      fetchTemplates();
    }
  }, [user]);

  const fetchClients = async () => {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', user?.id)
      .order('name');
    setClients(data || []);
  };

  const fetchTemplates = async () => {
    const { data } = await supabase
      .from('quote_templates')
      .select('*')
      .order('name');
    
    // Filter to show user's trade templates first, then others
    const userTrade = profile?.trade_type;
    const sorted = (data || []).sort((a, b) => {
      if (a.trade_type === userTrade && b.trade_type !== userTrade) return -1;
      if (b.trade_type === userTrade && a.trade_type !== userTrade) return 1;
      return 0;
    });
    setTemplates(sorted);
  };

  const selectTemplate = (template: QuoteTemplate) => {
    setSelectedTemplate(template);
    setForm(prev => ({ ...prev, title: template.name }));
    
    // Parse default items from template
    const items = template.default_items as unknown as TemplateItem[] | null;
    if (items && Array.isArray(items) && items.length > 0) {
      setLineItems(items.map(item => ({
        id: crypto.randomUUID(),
        description: item.description || '',
        quantity: item.quantity || 1,
        unit: item.unit || 'each',
        unit_price: item.unit_price || 0,
        item_type: (item.item_type as 'labour' | 'materials') || 'labour',
      })));
    }
    setStep('details');
  };

  const skipTemplate = () => {
    setSelectedTemplate(null);
    setStep('details');
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { 
      id: crypto.randomUUID(), 
      description: '', 
      quantity: 1, 
      unit: 'each', 
      unit_price: profile?.default_hourly_rate || 75, 
      item_type: 'labour' 
    }]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter(item => item.id !== id));
    }
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: any) => {
    setLineItems(lineItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const calculateTotals = () => {
    const subtotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const gst = subtotal * 0.1;
    const total = subtotal + gst;
    return { subtotal, gst, total };
  };

  const generateQuoteNumber = () => {
    const date = new Date();
    return `Q${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const validItems = lineItems.filter(item => item.description && item.unit_price > 0);
    if (validItems.length === 0) {
      toast({ title: 'Error', description: 'Add at least one line item', variant: 'destructive' });
      return;
    }

    setLoading(true);
    const { subtotal, gst, total } = calculateTotals();
    
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .insert({
        user_id: user.id,
        client_id: form.client_id || null,
        quote_number: generateQuoteNumber(),
        title: form.title,
        description: form.description,
        notes: form.notes,
        valid_until: form.valid_until || null,
        subtotal,
        gst,
        total,
        status: 'draft',
      })
      .select()
      .single();

    if (quoteError) {
      toast({ title: 'Error', description: quoteError.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    const lineItemsToInsert = validItems.map((item, index) => ({
      quote_id: quote.id,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unit_price: item.unit_price,
      total: item.quantity * item.unit_price,
      item_type: item.item_type,
      sort_order: index,
    }));

    const { error: itemsError } = await supabase
      .from('quote_line_items')
      .insert(lineItemsToInsert);

    if (itemsError) {
      toast({ title: 'Error', description: itemsError.message, variant: 'destructive' });
    } else {
      toast({ title: 'Quote created! 🎉', description: 'Looking good, mate.' });
      navigate('/quotes');
    }
    setLoading(false);
  };

  const { subtotal, gst, total } = calculateTotals();

  // Template selection step
  if (step === 'template') {
    const userTradeTemplates = templates.filter(t => t.trade_type === profile?.trade_type);
    const otherTemplates = templates.filter(t => t.trade_type !== profile?.trade_type);

    return (
      <MobileLayout showNav={false}>
        <PageHeader title="New Quote" showBack backPath="/quotes" />
        
        <div className="p-4 space-y-6 animate-fade-in">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mx-auto mb-4 shadow-glow">
              <Sparkles className="w-8 h-8 text-primary-foreground" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Start with a template?</h2>
            <p className="text-muted-foreground mt-1">Save time with pre-built line items</p>
          </div>

          {userTradeTemplates.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                For your trade
              </h3>
              {userTradeTemplates.map((template, index) => (
                <PremiumCard
                  key={template.id}
                  onClick={() => selectTemplate(template)}
                  className="animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">{template.name}</h4>
                      <p className="text-sm text-muted-foreground">{template.description}</p>
                    </div>
                  </div>
                </PremiumCard>
              ))}
            </div>
          )}

          {otherTemplates.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Other templates
              </h3>
              {otherTemplates.slice(0, 5).map((template, index) => (
                <PremiumCard
                  key={template.id}
                  onClick={() => selectTemplate(template)}
                  className="animate-fade-in opacity-80"
                  style={{ animationDelay: `${(index + userTradeTemplates.length) * 50}ms` }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                      <FileText className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground">{template.name}</h4>
                      <p className="text-sm text-muted-foreground capitalize">{template.trade_type?.replace('_', ' ')}</p>
                    </div>
                  </div>
                </PremiumCard>
              ))}
            </div>
          )}

          <Button 
            variant="outline" 
            className="w-full h-12" 
            onClick={skipTemplate}
          >
            Start from scratch
          </Button>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout showNav={false}>
      <PageHeader 
        title={selectedTemplate ? selectedTemplate.name : "New Quote"} 
        showBack 
        backPath="/quotes" 
      />
      
      <form onSubmit={handleSubmit} className="p-4 space-y-6 animate-fade-in pb-32">
        {/* Client Selection */}
        <div className="space-y-2">
          <Label>Client</Label>
          <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
            <SelectTrigger className="h-12">
              <SelectValue placeholder="Select a client (optional)" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    {client.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Quote Details */}
        <div className="space-y-2">
          <Label htmlFor="title">Quote Title *</Label>
          <Input
            id="title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g., Kitchen Renovation"
            className="h-12"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Scope of work..."
            rows={2}
          />
        </div>

        {/* Valid Until */}
        <div className="space-y-2">
          <Label htmlFor="valid_until" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Valid Until
          </Label>
          <Input
            id="valid_until"
            type="date"
            value={form.valid_until}
            onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
            className="h-12"
          />
        </div>

        {/* Line Items */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Line Items</Label>
            <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
              <Plus className="w-4 h-4 mr-1" /> Add Item
            </Button>
          </div>

          {lineItems.map((item, index) => (
            <div key={item.id} className="p-4 bg-card/80 backdrop-blur-sm rounded-xl border border-border/50 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Item {index + 1}</span>
                {lineItems.length > 1 && (
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm"
                    onClick={() => removeLineItem(item.id)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                )}
              </div>

              <Input
                placeholder="Description"
                value={item.description}
                onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                className="h-11"
              />

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Qty</Label>
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={item.quantity}
                    onChange={(e) => updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                    className="h-10"
                  />
                </div>
                <div>
                  <Label className="text-xs">Unit</Label>
                  <Select value={item.unit} onValueChange={(v) => updateLineItem(item.id, 'unit', v)}>
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="each">Each</SelectItem>
                      <SelectItem value="hour">Hour</SelectItem>
                      <SelectItem value="sqm">m²</SelectItem>
                      <SelectItem value="lm">Lm</SelectItem>
                      <SelectItem value="job">Job</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Price ($)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unit_price}
                    onChange={(e) => updateLineItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                    className="h-10"
                  />
                </div>
              </div>

              <Select 
                value={item.item_type} 
                onValueChange={(v: 'labour' | 'materials') => updateLineItem(item.id, 'item_type', v)}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="labour">Labour</SelectItem>
                  <SelectItem value="materials">Materials</SelectItem>
                </SelectContent>
              </Select>

              <div className="text-right text-sm font-semibold text-foreground">
                ${(item.quantity * item.unit_price).toFixed(2)}
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="p-4 bg-card/80 backdrop-blur-sm rounded-xl border border-border/50 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="text-foreground">${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">GST (10%)</span>
            <span className="text-foreground">${gst.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-lg pt-2 border-t border-border/50">
            <span className="text-foreground">Total</span>
            <span className="text-primary">${total.toFixed(2)}</span>
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Additional notes for the client..."
            rows={2}
          />
        </div>

        <Button type="submit" className="w-full h-12 shadow-premium" disabled={loading}>
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Create Quote
        </Button>
      </form>
    </MobileLayout>
  );
}
