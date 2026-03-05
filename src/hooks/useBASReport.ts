import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { format, startOfQuarter, endOfQuarter, subQuarters, getQuarter, getYear } from 'date-fns';

export interface Expense {
  id: string;
  description: string;
  amount: number;
  gst_amount: number;
  category: string;
  date: string;
  supplier_name: string | null;
}

export interface BASData {
  totalSales: number;
  gstCollected: number;
  totalPurchases: number;
  gstPaid: number;
  netGST: number;
  invoiceCount: number;
  paidInvoiceCount: number;
  unpaidAmount: number;
}

export interface QuarterOption {
  label: string;
  value: string;
  start: Date;
  end: Date;
}

export const EXPENSE_CATEGORIES = [
  { value: 'materials', label: 'Materials & Supplies' },
  { value: 'tools', label: 'Tools & Equipment' },
  { value: 'fuel', label: 'Fuel & Transport' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'subcontractor', label: 'Subcontractor' },
  { value: 'rent', label: 'Rent & Utilities' },
  { value: 'phone', label: 'Phone & Internet' },
  { value: 'general', label: 'General' },
];

const generateQuarterOptions = (): QuarterOption[] => {
  const options: QuarterOption[] = [];
  const now = new Date();

  for (let i = 0; i < 8; i++) {
    const date = subQuarters(now, i);
    const start = startOfQuarter(date);
    const end = endOfQuarter(date);
    const quarter = getQuarter(date);
    const year = getYear(date);

    options.push({
      label: `Q${quarter} ${year} (${format(start, 'MMM')} - ${format(end, 'MMM yyyy')})`,
      value: `${year}-Q${quarter}`,
      start,
      end,
    });
  }

  return options;
};

const initialExpenseForm = () => ({
  description: '',
  amount: '',
  gst_amount: '',
  category: 'general',
  date: format(new Date(), 'yyyy-MM-dd'),
  supplier_name: '',
});

export type ExpenseForm = ReturnType<typeof initialExpenseForm>;

export function useBASReport() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedQuarter, setSelectedQuarter] = useState<string>('');
  const [data, setData] = useState<BASData | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [newExpense, setNewExpense] = useState(initialExpenseForm());

  const quarterOptions = useMemo(() => generateQuarterOptions(), []);

  useEffect(() => {
    if (quarterOptions.length > 0 && !selectedQuarter) {
      setSelectedQuarter(quarterOptions[0].value);
    }
  }, [quarterOptions, selectedQuarter]);

  const getSelectedQuarterDates = useCallback(() => {
    return quarterOptions.find(q => q.value === selectedQuarter);
  }, [quarterOptions, selectedQuarter]);

  const fetchBASData = useCallback(async () => {
    setLoading(true);
    const quarter = getSelectedQuarterDates();
    if (!quarter) return;

    try {
      const [invoiceResult, expenseResult] = await Promise.all([
        supabase
          .from('invoices')
          .select('total, gst, subtotal, status, amount_paid')
          .eq('user_id', user?.id ?? '')
          .is('deleted_at', null)
          .gte('created_at', quarter.start.toISOString())
          .lte('created_at', quarter.end.toISOString()),
        supabase
          .from('expenses')
          .select('id, description, amount, gst_amount, category, date, supplier_name')
          .eq('user_id', user?.id ?? '')
          .gte('date', format(quarter.start, 'yyyy-MM-dd'))
          .lte('date', format(quarter.end, 'yyyy-MM-dd'))
          .is('deleted_at', null)
          .order('date', { ascending: false }),
      ]);

      if (invoiceResult.error) throw invoiceResult.error;
      if (expenseResult.error) throw expenseResult.error;

      const invoiceList = invoiceResult.data || [];
      const expenseList = (expenseResult.data || []) as Expense[];

      setExpenses(expenseList);

      const totalSales = invoiceList.reduce((sum, inv) => sum + (Number(inv.subtotal) || 0), 0);
      const gstCollected = invoiceList.reduce((sum, inv) => sum + (Number(inv.gst) || 0), 0);
      const totalPurchases = expenseList.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      const gstPaid = expenseList.reduce((sum, e) => sum + (Number(e.gst_amount) || 0), 0);
      const paidInvoices = invoiceList.filter(inv => inv.status === 'paid');
      const unpaidInvoices = invoiceList.filter(inv => inv.status !== 'paid');

      setData({
        totalSales,
        gstCollected,
        totalPurchases,
        gstPaid,
        netGST: gstCollected - gstPaid,
        invoiceCount: invoiceList.length,
        paidInvoiceCount: paidInvoices.length,
        unpaidAmount: unpaidInvoices.reduce((sum, inv) =>
          sum + (Number(inv.total) || 0) - (Number(inv.amount_paid) || 0), 0
        ),
      });
    } catch (error) {
      console.error('Error fetching BAS data:', error);
      toast({ title: 'Error loading data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [user, getSelectedQuarterDates, toast]);

  useEffect(() => {
    if (user && selectedQuarter) {
      fetchBASData();
    }
  }, [user, selectedQuarter, fetchBASData]);

  const handleAddExpense = useCallback(async () => {
    if (!user || !newExpense.description || !newExpense.amount) {
      toast({ title: 'Please fill in description and amount', variant: 'destructive' });
      return;
    }

    setSavingExpense(true);
    try {
      const { error } = await supabase.from('expenses').insert({
        user_id: user.id,
        description: newExpense.description,
        amount: parseFloat(newExpense.amount),
        gst_amount: newExpense.gst_amount ? parseFloat(newExpense.gst_amount) : 0,
        category: newExpense.category,
        date: newExpense.date,
        supplier_name: newExpense.supplier_name || null,
      });

      if (error) throw error;

      toast({ title: 'Expense added successfully' });
      setNewExpense(initialExpenseForm());
      setAddExpenseOpen(false);
      fetchBASData();
    } catch (error) {
      console.error('Error adding expense:', error);
      toast({ title: 'Failed to add expense', variant: 'destructive' });
    } finally {
      setSavingExpense(false);
    }
  }, [user, newExpense, toast, fetchBASData]);

  const handleAmountChange = useCallback((value: string) => {
    setNewExpense(prev => {
      const amount = parseFloat(value) || 0;
      const gst = (amount / 11).toFixed(2);
      return { ...prev, amount: value, gst_amount: amount > 0 ? gst : '' };
    });
  }, []);

  const handleExport = useCallback(async () => {
    if (!data) return;
    setExporting(true);

    const quarter = getSelectedQuarterDates();
    if (!quarter) return;

    try {
      const csvContent = [
        ['BAS Report'],
        [`Period: ${quarter.label}`],
        [`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`],
        [''],
        ['GST Summary'],
        ['Description', 'Amount (AUD)'],
        ['Total Sales (ex GST)', data.totalSales.toFixed(2)],
        ['GST Collected (1A)', data.gstCollected.toFixed(2)],
        [''],
        ['Total Purchases (ex GST)', data.totalPurchases.toFixed(2)],
        ['GST Paid (1B)', data.gstPaid.toFixed(2)],
        [''],
        ['Net GST Payable/Refundable', data.netGST.toFixed(2)],
        [''],
        ['Invoice Summary'],
        ['Total Invoices', data.invoiceCount.toString()],
        ['Paid Invoices', data.paidInvoiceCount.toString()],
        ['Outstanding Amount', data.unpaidAmount.toFixed(2)],
      ].map(row => row.join(',')).join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `BAS-Report-${selectedQuarter}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ title: 'Report exported! 📊' });
    } catch {
      toast({ title: 'Export failed', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  }, [data, selectedQuarter, getSelectedQuarterDates, toast]);

  return {
    loading,
    exporting,
    selectedQuarter,
    setSelectedQuarter,
    data,
    expenses,
    addExpenseOpen,
    setAddExpenseOpen,
    savingExpense,
    newExpense,
    setNewExpense,
    quarterOptions,
    fetchBASData,
    handleAddExpense,
    handleAmountChange,
    handleExport,
  };
}
