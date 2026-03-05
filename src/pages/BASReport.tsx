
import { useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
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
    Plus,
    ShoppingCart,
} from 'lucide-react';
import { format } from 'date-fns';
import { useBASReport, EXPENSE_CATEGORIES } from '@/hooks/useBASReport';

export default function BASReport() {
    const navigate = useNavigate();
    const {
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
    } = useBASReport();

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

                            {/* Expenses Breakdown */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between px-1">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-6 bg-destructive rounded-full" />
                                        <h3 className="font-bold text-lg text-destructive">Expenses</h3>
                                    </div>
                                    <Dialog open={addExpenseOpen} onOpenChange={setAddExpenseOpen}>
                                        <DialogTrigger asChild>
                                            <Button size="sm" variant="outline" className="rounded-xl h-8">
                                                <Plus className="w-4 h-4 mr-1" />
                                                Add Expense
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-sm mx-auto rounded-2xl">
                                            <DialogHeader>
                                                <DialogTitle>Add Expense</DialogTitle>
                                            </DialogHeader>
                                            <div className="space-y-4 pt-2">
                                                <div className="space-y-2">
                                                    <Label>Description *</Label>
                                                    <Input
                                                        placeholder="e.g. Bunnings timber order"
                                                        value={newExpense.description}
                                                        onChange={e => setNewExpense(prev => ({ ...prev, description: e.target.value }))}
                                                        className="rounded-xl"
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="space-y-2">
                                                        <Label>Amount (inc. GST) *</Label>
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            placeholder="0.00"
                                                            value={newExpense.amount}
                                                            onChange={e => handleAmountChange(e.target.value)}
                                                            className="rounded-xl"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>GST Amount</Label>
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            placeholder="0.00"
                                                            value={newExpense.gst_amount}
                                                            onChange={e => setNewExpense(prev => ({ ...prev, gst_amount: e.target.value }))}
                                                            className="rounded-xl"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Category</Label>
                                                    <Select
                                                        value={newExpense.category}
                                                        onValueChange={val => setNewExpense(prev => ({ ...prev, category: val }))}
                                                    >
                                                        <SelectTrigger className="rounded-xl">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {EXPENSE_CATEGORIES.map(cat => (
                                                                <SelectItem key={cat.value} value={cat.value}>
                                                                    {cat.label}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="space-y-2">
                                                        <Label>Date</Label>
                                                        <Input
                                                            type="date"
                                                            value={newExpense.date}
                                                            onChange={e => setNewExpense(prev => ({ ...prev, date: e.target.value }))}
                                                            className="rounded-xl"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Supplier</Label>
                                                        <Input
                                                            placeholder="Optional"
                                                            value={newExpense.supplier_name}
                                                            onChange={e => setNewExpense(prev => ({ ...prev, supplier_name: e.target.value }))}
                                                            className="rounded-xl"
                                                        />
                                                    </div>
                                                </div>
                                                <Button
                                                    onClick={handleAddExpense}
                                                    disabled={savingExpense}
                                                    className="w-full h-12 rounded-xl"
                                                >
                                                    {savingExpense ? (
                                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                    ) : (
                                                        <Plus className="w-4 h-4 mr-2" />
                                                    )}
                                                    Save Expense
                                                </Button>
                                            </div>
                                        </DialogContent>
                                    </Dialog>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                            Total Expenses
                                        </p>
                                        <p className="text-2xl font-black text-foreground mt-1">
                                            {formatCurrency(data.totalPurchases)}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">incl. GST</p>
                                    </div>

                                    <div className="p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                            GST Credits
                                        </p>
                                        <p className="text-2xl font-black text-foreground mt-1">
                                            {formatCurrency(data.gstPaid)}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {expenses.length} expense{expenses.length !== 1 ? 's' : ''}
                                        </p>
                                    </div>
                                </div>

                                {/* Recent expenses list */}
                                {expenses.length > 0 && (
                                    <div className="p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 space-y-3">
                                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                            Recent Expenses
                                        </p>
                                        <div className="space-y-2">
                                            {expenses.slice(0, 5).map(expense => (
                                                <div key={expense.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <ShoppingCart className="w-4 h-4 text-muted-foreground shrink-0" />
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-medium truncate">{expense.description}</p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {format(new Date(expense.date), 'dd MMM yyyy')}
                                                                {expense.supplier_name ? ` - ${expense.supplier_name}` : ''}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right shrink-0 ml-2">
                                                        <p className="text-sm font-bold">{formatCurrency(expense.amount)}</p>
                                                        {expense.gst_amount > 0 && (
                                                            <p className="text-xs text-muted-foreground">
                                                                GST: {formatCurrency(expense.gst_amount)}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        {expenses.length > 5 && (
                                            <p className="text-xs text-center text-muted-foreground pt-1">
                                                + {expenses.length - 5} more expense{expenses.length - 5 !== 1 ? 's' : ''}
                                            </p>
                                        )}
                                    </div>
                                )}
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

                            {/* Disclaimer */}
                            <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-2xl">
                                <p className="text-sm text-blue-900 dark:text-blue-100">
                                    <strong>Note:</strong> GST calculations are based on your recorded invoices and expenses.
                                    Ensure all business expenses are entered for accurate BAS figures.
                                    For official BAS lodgement, please consult your accountant.
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
