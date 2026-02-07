import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import { UsageLimitBanner, UsageLimitBlocker } from '@/components/UsageLimitBanner';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, User, ArrowLeft, Receipt } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { addDays, addMonths, format } from 'date-fns';
import { RecurringInvoiceToggle } from '@/components/invoices/RecurringInvoiceToggle';
import { generateUUID } from '@/lib/utils/uuid';

type Client = Tables<'clients'>;

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  item_type: 'labour' | 'materials';
}

export default function InvoiceForm() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { toast } = useToast();
  const { canCreate, used, limit, tier, isUnlimited, incrementUsage } = useUsageLimits('invoices');
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState({
    client_id: '',
    title: '',
    description: '',
    due_date: format(addDays(new Date(), 14), 'yyyy-MM-dd'),
    notes: '',
    is_recurring: false,
    recurring_interval: 'monthly',
    next_due_date: format(addMonths(new Date(), 1), 'yyyy-MM-dd'),
  });
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: generateUUID(), description: '', quantity: 1, unit: 'each', unit_price: 0, item_type: 'labour' }
  ]);

  useEffect(() => {
    if (user) fetchClients();
  }, [user]);

  useEffect(() => {
    if (profile?.payment_terms) {
      setForm(f => ({
        ...f,
        due_date: format(addDays(new Date(), profile.payment_terms), 'yyyy-MM-dd')
      }));
    }
  }, [profile]);

  const fetchClients = async () => {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', user?.id)
      .order('name');
    setClients(data || []);
  };

  const addLineItem = () => {
    setLineItems([...lineItems, {
      id: generateUUID(),
      description: '',
      quantity: 1,
      unit: 'each',
      unit_price: 0,
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

  const generateInvoiceNumber = () => {
    const date = new Date();
    return `INV${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!canCreate) {
      toast({ title: 'Limit reached', description: 'Upgrade your plan to create more invoices', variant: 'destructive' });
      return;
    }

    const validItems = lineItems.filter(item => item.description && item.unit_price > 0);
    if (validItems.length === 0) {
      toast({ title: 'Error', description: 'Add at least one line item', variant: 'destructive' });
      return;
    }

    setLoading(true);
    const { subtotal, gst, total } = calculateTotals();

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        user_id: user.id,
        client_id: form.client_id || null,
        invoice_number: generateInvoiceNumber(),
        title: form.title,
        description: form.description,
        due_date: form.due_date,
        notes: form.notes,
        subtotal,
        gst,
        total,
        status: 'draft',
        is_recurring: form.is_recurring,
        recurring_interval: form.is_recurring ? form.recurring_interval : null,
        next_due_date: form.is_recurring ? form.next_due_date : null,
      })
      .select()
      .single();

    if (invoiceError) {
      toast({ title: 'Error', description: invoiceError.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    const lineItemsToInsert = validItems.map((item, index) => ({
      invoice_id: invoice.id,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unit_price: item.unit_price,
      total: item.quantity * item.unit_price,
      item_type: item.item_type,
      sort_order: index,
    }));

    const { error: itemsError } = await supabase
      .from('invoice_line_items')
      .insert(lineItemsToInsert);

    if (itemsError) {
      toast({ title: 'Error', description: itemsError.message, variant: 'destructive' });
    } else {
      await incrementUsage();
      toast({ title: 'Invoice created', description: 'Your invoice has been saved.' });
      navigate('/invoices');
    }
    setLoading(false);
  };

  const { subtotal, gst, total } = calculateTotals();

  // Show blocker if limit reached
  if (!canCreate) {
    return (
      <MobileLayout showNav={false}>
        <div className="min-h-screen scrollbar-hide">
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent" />
            <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative px-4 pt-8 pb-6">
              <button onClick={() => navigate('/invoices')} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4">
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm font-medium">Back to Invoices</span>
              </button>
              <div className="flex items-center gap-2 mb-1">
                <Receipt className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-primary">New Invoice</span>
              </div>
              <h1 className="text-3xl font-bold text-foreground">Create Invoice</h1>
            </div>
          </div>
          <UsageLimitBlocker usageType="invoices" tier={tier} />
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout showNav={false}>
      <div className="min-h-screen scrollbar-hide">
        {/* Hero Section */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent" />
          <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative px-4 pt-8 pb-6">
            <button onClick={() => navigate('/invoices')} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4">
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm font-medium">Back to Invoices</span>
            </button>
            <div className="flex items-center gap-2 mb-1">
              <Receipt className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">New Invoice</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground">Create Invoice</h1>
            <p className="text-muted-foreground mt-1">Add items and set payment details</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-4 space-y-6 animate-fade-in pb-48 safe-bottom scrollbar-hide">
          <UsageLimitBanner usageType="invoices" used={used} limit={limit} tier={tier} isUnlimited={isUnlimited} />

          {/* Client Selection */}
          <div className="space-y-2">
            <Label>Client</Label>
            <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
              <SelectTrigger className="h-12 rounded-xl">
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

          {/* Invoice Details */}
          <div className="space-y-2">
            <Label htmlFor="title">Invoice Title *</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g., Kitchen Renovation"
              className="h-12 rounded-xl"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="due_date">Due Date</Label>
            <Input
              id="due_date"
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              className="h-12 rounded-xl"
            />
            <div className="flex gap-2">
              {[7, 14, 30].map(days => (
                <Button
                  key={days}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 rounded-xl text-xs"
                  onClick={() => setForm({ ...form, due_date: format(addDays(new Date(), days), 'yyyy-MM-dd') })}
                >
                  NET {days}
                </Button>
              ))}
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-6 bg-primary rounded-full" />
                <Label className="font-bold text-lg">Line Items</Label>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addLineItem} className="rounded-xl">
                <Plus className="w-4 h-4 mr-1" /> Add Item
              </Button>
            </div>

            {lineItems.map((item, index) => (
              <div key={item.id} className="p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 space-y-3 animate-fade-in" style={{ animationDelay: `${index * 0.05}s` }}>
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
                  className="h-11 rounded-xl"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Qty</Label>
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                      className="h-10 rounded-xl"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Unit</Label>
                    <Select value={item.unit} onValueChange={(v) => updateLineItem(item.id, 'unit', v)}>
                      <SelectTrigger className="h-10 rounded-xl">
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
                    <Label className="text-xs">Price</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unit_price}
                      onChange={(e) => updateLineItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                      className="h-10 rounded-xl"
                    />
                  </div>
                </div>

                <div className="text-right text-sm font-semibold text-primary">
                  ${(item.quantity * item.unit_price).toFixed(2)}
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">GST (10%)</span>
              <span>${gst.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg pt-2 border-t border-border/50">
              <span>Total</span>
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
              placeholder="Payment instructions, terms, etc..."
              rows={2}
              className="rounded-xl"
            />
          </div>

          {/* Recurring Invoice Toggle */}
          <RecurringInvoiceToggle
            isRecurring={form.is_recurring}
            recurringInterval={form.recurring_interval}
            nextDueDate={form.next_due_date}
            onToggle={(enabled) => setForm({ ...form, is_recurring: enabled })}
            onIntervalChange={(interval) => setForm({ ...form, recurring_interval: interval })}
            onNextDueDateChange={(date) => setForm({ ...form, next_due_date: date })}
          />

          <Button type="submit" className="w-full h-12 rounded-xl shadow-premium" disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create Invoice
          </Button>
        </form>
      </div>
    </MobileLayout>
  );
}
