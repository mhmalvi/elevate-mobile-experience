import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { getCountry } from '@/lib/countries';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn, formatCurrency } from '@/lib/utils';
import {
    FileText,
    ArrowLeft,
    Calendar,
    Download,
    TrendingUp,
    Receipt,
    Loader2,
    RefreshCw,
    AlertTriangle,
} from 'lucide-react';
import { format, startOfQuarter, endOfQuarter, subQuarters, getQuarter, getYear } from 'date-fns';

interface BASData {
    totalSales: number;
    gstCollected: number;
    totalPurchases: number;
    gstPaid: number;
    netGST: number;
    invoiceCount: number;
    paidInvoiceCount: number;
    unpaidAmount: number;
}

interface QuarterOption {
    label: string;
    value: string;
    start: Date;
    end: Date;
}

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

export default function BASReport() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { profile } = useProfile();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [selectedQuarter, setSelectedQuarter] = useState<string>('');
    const [data, setData] = useState<BASData | null>(null);

    const quarterOptions = useMemo(() => generateQuarterOptions(), []);

    useEffect(() => {
        if (quarterOptions.length > 0 && !selectedQuarter) {
            setSelectedQuarter(quarterOptions[0].value);
        }
    }, [quarterOptions, selectedQuarter]);

    useEffect(() => {
        if (user && selectedQuarter) {
            fetchBASData();
        }
    }, [user, selectedQuarter]);

    const getSelectedQuarterDates = () => {
        return quarterOptions.find(q => q.value === selectedQuarter);
    };

    const fetchBASData = async () => {
        setLoading(true);
        const quarter = getSelectedQuarterDates();
        if (!quarter) return;

        try {
            // Fetch invoices for the quarter
            const { data: invoices, error } = await supabase
                .from('invoices')
                .select('total, tax_amount, subtotal, status, amount_paid')
                .eq('user_id', user?.id)
                .gte('created_at', quarter.start.toISOString())
                .lte('created_at', quarter.end.toISOString());

            if (error) throw error;

            const invoiceList = invoices || [];

            // Calculate BAS figures
            const totalSales = invoiceList.reduce((sum, inv) => sum + (Number(inv.subtotal) || 0), 0);
            const gstCollected = invoiceList.reduce((sum, inv) => sum + (Number(inv.tax_amount) || 0), 0);

            // For now, we'll estimate GST paid as 10% of assumed expenses (simplified)
            // In a real scenario, this would come from an expenses table
            const estimatedExpenses = totalSales * 0.3; // Assume 30% expenses
            const gstPaid = estimatedExpenses * 0.1;

            const paidInvoices = invoiceList.filter(inv => inv.status === 'paid');
            const unpaidInvoices = invoiceList.filter(inv => inv.status !== 'paid');

            setData({
                totalSales,
                gstCollected,
                totalPurchases: estimatedExpenses,
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
    };

    const handleExport = async () => {
        if (!data) return;
        setExporting(true);

        const quarter = getSelectedQuarterDates();
        if (!quarter) return;

        try {
            // Generate CSV content
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

            // Download CSV
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
        } catch (error) {
            toast({ title: 'Export failed', variant: 'destructive' });
        } finally {
            setExporting(false);
        }
    };

    // The BAS is an ATO filing. Reachable by direct URL even though the
    // Settings menu hides it for non-AU businesses, so guard it here too.
    if (profile && profile.country_code !== 'AU') {
        return (
            <MobileLayout>
                <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
                    <FileText className="w-10 h-10 text-muted-foreground mb-4" />
                    <h1 className="text-xl font-bold text-foreground mb-2">Not available in your region</h1>
                    <p className="text-muted-foreground text-sm max-w-sm">
                        The BAS is an Australian Taxation Office filing. Your business is set to{' '}
                        {getCountry(profile.country_code).name}, so this report doesn't apply.
                    </p>
                    <Button variant="outline" className="mt-6" onClick={() => navigate('/settings')}>
                        Back to Settings
                    </Button>
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
                            <FileText className="w-4 h-4 text-primary" />
                            <span className="text-sm font-medium text-primary">Tax Reports</span>
                        </div>
                        <h1 className="text-3xl font-bold text-foreground">BAS Report</h1>
                        <p className="text-muted-foreground mt-1">
                            Quarterly GST summary for your Business Activity Statement
                        </p>
                    </div>
                </div>

                <div className="px-4 pb-32 space-y-6 animate-fade-in">
                    {/* Quarter Selector */}
                    <div className="p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 space-y-3">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-primary" />
                            <Label className="font-semibold">Select Quarter</Label>
                        </div>
                        <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
                            <SelectTrigger className="h-12 rounded-xl">
                                <SelectValue placeholder="Select quarter" />
                            </SelectTrigger>
                            <SelectContent>
                                {quarterOptions.map(option => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center p-12">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : data ? (
                        <>
                            {/* GST Summary Card */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 px-1">
                                    <div className="w-1.5 h-6 bg-primary rounded-full" />
                                    <h3 className="font-bold text-lg">GST Summary</h3>
                                </div>

                                <div className="relative overflow-hidden p-6 bg-foreground text-background dark:bg-card dark:text-foreground rounded-3xl shadow-glow">
                                    <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-primary/20 rounded-full blur-3xl" />

                                    <div className="space-y-4 relative z-10">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                <TrendingUp className="w-4 h-4 opacity-60" />
                                                <span className="text-sm font-medium opacity-80">GST Collected (1A)</span>
                                            </div>
                                            <span className="text-xl font-bold">{formatCurrency(data.gstCollected)}</span>
                                        </div>

                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                <Receipt className="w-4 h-4 opacity-60" />
                                                <span className="text-sm font-medium opacity-80">GST Paid (1B)</span>
                                            </div>
                                            <span className="text-xl font-bold">-{formatCurrency(data.gstPaid)}</span>
                                        </div>

                                        <div className="pt-4 border-t border-muted/20">
                                            <div className="flex justify-between items-end">
                                                <div>
                                                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60">
                                                        Net GST {data.netGST >= 0 ? 'Payable' : 'Refundable'}
                                                    </p>
                                                    <p className={cn(
                                                        "text-3xl font-black",
                                                        data.netGST >= 0 ? "text-destructive" : "text-success"
                                                    )}>
                                                        {formatCurrency(Math.abs(data.netGST))}
                                                    </p>
                                                </div>
                                                <div className={cn(
                                                    "px-3 py-1 rounded-full text-xs font-bold",
                                                    data.netGST >= 0
                                                        ? "bg-destructive/20 text-destructive"
                                                        : "bg-success/20 text-success"
                                                )}>
                                                    {data.netGST >= 0 ? 'TO PAY' : 'REFUND'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Sales Breakdown */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 px-1">
                                    <div className="w-1.5 h-6 bg-success rounded-full" />
                                    <h3 className="font-bold text-lg text-success">Revenue</h3>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                            Total Sales
                                        </p>
                                        <p className="text-2xl font-black text-foreground mt-1">
                                            {formatCurrency(data.totalSales)}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">excl. GST</p>
                                    </div>

                                    <div className="p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                            Invoices
                                        </p>
                                        <p className="text-2xl font-black text-foreground mt-1">
                                            {data.invoiceCount}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {data.paidInvoiceCount} paid
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Outstanding Warning */}
                            {data.unpaidAmount > 0 && (
                                <div className="p-4 bg-warning/5 border border-warning/20 rounded-2xl flex items-start gap-3">
                                    <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-semibold text-foreground">Outstanding Invoices</p>
                                        <p className="text-sm text-muted-foreground">
                                            You have {formatCurrency(data.unpaidAmount)} in unpaid invoices this quarter.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Disclaimer — deliberately prominent. GST Paid (1B) is
                                not derived from real expense data; it is 10% of an
                                assumed 30%-of-sales expense figure. Anyone lodging
                                from this number without checking would be filing an
                                invented amount, so this warns rather than notes. */}
                            <div className="p-4 bg-warning/10 border border-warning/40 rounded-2xl">
                                <p className="text-sm text-foreground">
                                    <strong className="text-warning">Estimate only — do not lodge from this.</strong>{' '}
                                    GST Collected (1A) comes from your actual invoices. GST Paid (1B) does
                                    <strong> not</strong> — the app has no record of your expenses, so it assumes
                                    they equal 30% of sales. That figure is a placeholder, not your real
                                    position. Confirm both with your accountant or accounting software before
                                    lodging your BAS.
                                </p>
                            </div>

                            {/* Export Button */}
                            <div className="grid grid-cols-2 gap-3">
                                <Button
                                    variant="outline"
                                    onClick={fetchBASData}
                                    className="h-14 rounded-2xl"
                                >
                                    <RefreshCw className="w-5 h-5 mr-2" />
                                    Refresh
                                </Button>
                                <Button
                                    onClick={handleExport}
                                    disabled={exporting}
                                    className="h-14 rounded-2xl"
                                >
                                    {exporting ? (
                                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                    ) : (
                                        <Download className="w-5 h-5 mr-2" />
                                    )}
                                    Export CSV
                                </Button>
                            </div>
                        </>
                    ) : (
                        <div className="p-8 text-center">
                            <p className="text-muted-foreground">No data available for this quarter.</p>
                        </div>
                    )}
                </div>
            </div>
        </MobileLayout>
    );
}
