import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, User, RefreshCw } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { addDays, format } from 'date-fns';
import { Switch } from '@/components/ui/switch';

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
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState({
    client_id: '',
    title: '',
    description: '',
    due_date: format(addDays(new Date(), 14), 'yyyy-MM-dd'),
    notes: '',
    is_recurring: false,
    recurring_interval: 'monthly' as 'weekly' | 'fortnightly' | 'monthly' | 'quarterly',
  });
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: crypto.randomUUID(), description: '', quantity: 1, unit: 'each', unit_price: 0, item_type: 'labour' }
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
      id: crypto.randomUUID(), 
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

    const validItems = lineItems.filter(item => item.description && item.unit_price > 0);
    if (validItems.length === 0) {
      toast({ title: 'Error', description: 'Add at least one line item', variant: 'destructive' });
      return;
    }

    setLoading(true);
    const { subtotal, gst, total } = calculateTotals();
    
    // Calculate next due date for recurring invoices
    const getNextDueDate = () => {
      if (!form.is_recurring) return null;
      const dueDate = new Date(form.due_date);
      switch (form.recurring_interval) {
        case 'weekly': return addDays(dueDate, 7).toISOString();
        case 'fortnightly': return addDays(dueDate, 14).toISOString();
        case 'monthly': return addDays(dueDate, 30).toISOString();
        case 'quarterly': return addDays(dueDate, 90).toISOString();
        default: return null;
      }
    };

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
        next_due_date: getNextDueDate(),
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
      toast({ title: 'Invoice created', description: 'Your invoice has been saved.' });
      navigate('/invoices');
    }
    setLoading(false);
  };

  const { subtotal, gst, total } = calculateTotals();

  return (
    <MobileLayout showNav={false}>
      <PageHeader title="New Invoice" showBack backPath="/invoices" />
      
      <form onSubmit={handleSubmit} className="p-4 space-y-6 animate-fade-in pb-32">
        {/* Client Selection */}
        <div className="space-y-2">
          <Label>Client</Label>
          <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
            <SelectTrigger>
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
          />
        </div>

        {/* Recurring Invoice Toggle */}
        <div className="p-4 bg-card rounded-xl border space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold">Recurring Invoice</p>
                <p className="text-sm text-muted-foreground">Auto-generate on schedule</p>
              </div>
            </div>
            <Switch
              checked={form.is_recurring}
              onCheckedChange={(checked) => setForm({ ...form, is_recurring: checked })}
            />
          </div>
          
          {form.is_recurring && (
            <div className="space-y-2 pt-2 border-t">
              <Label>Repeat Interval</Label>
              <Select 
                value={form.recurring_interval} 
                onValueChange={(v: 'weekly' | 'fortnightly' | 'monthly' | 'quarterly') => 
                  setForm({ ...form, recurring_interval: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="fortnightly">Fortnightly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
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
            <div key={item.id} className="p-3 bg-card rounded-lg border space-y-3">
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
                  />
                </div>
                <div>
                  <Label className="text-xs">Unit</Label>
                  <Select value={item.unit} onValueChange={(v) => updateLineItem(item.id, 'unit', v)}>
                    <SelectTrigger>
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
                  />
                </div>
              </div>

              <div className="text-right text-sm font-medium">
                ${(item.quantity * item.unit_price).toFixed(2)}
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="p-4 bg-muted rounded-xl space-y-2">
          <div className="flex justify-between text-sm">
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>GST (10%)</span>
            <span>${gst.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-lg pt-2 border-t">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
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
          />
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Create Invoice
        </Button>
      </form>
    </MobileLayout>
  );
}
