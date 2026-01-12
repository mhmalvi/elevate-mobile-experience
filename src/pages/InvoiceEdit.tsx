import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, User, ArrowLeft, Receipt, Save } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
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

export default function InvoiceEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState({
    client_id: '',
    title: '',
    description: '',
    due_date: '',
    notes: '',
  });
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  useEffect(() => {
    if (user && id) {
      fetchClients();
      fetchInvoice();
    }
  }, [user, id]);

  const fetchClients = async () => {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', user?.id)
      .order('name');
    setClients(data || []);
  };

  const fetchInvoice = async () => {
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !invoice) {
      toast({ title: 'Invoice not found', variant: 'destructive' });
      navigate('/invoices');
      return;
    }

    setForm({
      client_id: invoice.client_id || '',
      title: invoice.title,
      description: invoice.description || '',
      due_date: invoice.due_date || '',
      notes: invoice.notes || '',
    });

    const { data: items } = await supabase
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', id)
      .order('sort_order');

    setLineItems(
      items?.map((item) => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity || 1,
        unit: item.unit || 'each',
        unit_price: item.unit_price,
        item_type: (item.item_type as 'labour' | 'materials') || 'labour',
      })) || []
    );
    setFetching(false);
  };

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      { id: generateUUID(), description: '', quantity: 1, unit: 'each', unit_price: 0, item_type: 'labour' },
    ]);
  };

  const removeLineItem = (itemId: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((item) => item.id !== itemId));
    }
  };

  const updateLineItem = (itemId: string, field: keyof LineItem, value: any) => {
    setLineItems(lineItems.map((item) => (item.id === itemId ? { ...item, [field]: value } : item)));
  };

  const calculateTotals = () => {
    const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
    const gst = subtotal * 0.1;
    const total = subtotal + gst;
    return { subtotal, gst, total };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const validItems = lineItems.filter((item) => item.description && item.unit_price > 0);
    if (validItems.length === 0) {
      toast({ title: 'Error', description: 'Add at least one line item', variant: 'destructive' });
      return;
    }

    setLoading(true);
    const { subtotal, gst, total } = calculateTotals();

    const { error: invoiceError } = await supabase
      .from('invoices')
      .update({
        client_id: form.client_id || null,
        title: form.title,
        description: form.description,
        due_date: form.due_date || null,
        notes: form.notes,
        subtotal,
        gst,
        total,
      })
      .eq('id', id);

    if (invoiceError) {
      toast({ title: 'Error', description: invoiceError.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    // Delete existing line items and re-insert
    await supabase.from('invoice_line_items').delete().eq('invoice_id', id);

    const lineItemsToInsert = validItems.map((item, index) => ({
      invoice_id: id!,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unit_price: item.unit_price,
      total: item.quantity * item.unit_price,
      item_type: item.item_type,
      sort_order: index,
    }));

    const { error: itemsError } = await supabase.from('invoice_line_items').insert(lineItemsToInsert);

    if (itemsError) {
      toast({ title: 'Error', description: itemsError.message, variant: 'destructive' });
    } else {
      toast({ title: 'Invoice updated', description: 'Your invoice has been saved.' });
      navigate(`/invoices/${id}`);
    }
    setLoading(false);
  };

  const { subtotal, gst, total } = calculateTotals();

  if (fetching) {
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
                <span className="text-sm font-medium text-primary">Edit Invoice</span>
              </div>
              <h1 className="text-3xl font-bold text-foreground">Loading...</h1>
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
    <MobileLayout showNav={false}>
      <div className="min-h-screen scrollbar-hide">
        {/* Hero Section */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent" />
          <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative px-4 pt-8 pb-6">
            <button onClick={() => navigate(`/invoices/${id}`)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4">
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm font-medium">Back to Invoice</span>
            </button>
            <div className="flex items-center gap-2 mb-1">
              <Receipt className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Edit</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground">Edit Invoice</h1>
            <p className="text-muted-foreground mt-1">Make changes to invoice details</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-4 space-y-6 animate-fade-in pb-48 safe-bottom">
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
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeLineItem(item.id)}>
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

                <Select
                  value={item.item_type}
                  onValueChange={(v: 'labour' | 'materials') => updateLineItem(item.id, 'item_type', v)}
                >
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="labour">Labour</SelectItem>
                    <SelectItem value="materials">Materials</SelectItem>
                  </SelectContent>
                </Select>

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

          <Button type="submit" className="w-full h-12 rounded-xl shadow-premium" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Changes
          </Button>
        </form>
      </div>
    </MobileLayout>
  );
}
