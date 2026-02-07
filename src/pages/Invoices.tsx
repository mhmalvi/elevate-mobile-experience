import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { SearchInput } from '@/components/ui/search-input';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { Button } from '@/components/ui/button';

import { Receipt, Calendar, AlertTriangle, WifiOff, ChevronRight, Plus } from 'lucide-react';
import { format, isPast, parseISO } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { useOfflineInvoices } from '@/lib/offline/offlineHooks';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';

export default function Invoices() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState('');

  // Use offline-first hook
  const { invoices, loading: isLoading, isOnline } = useOfflineInvoices(user?.id || '');

  const totalCount = invoices.length;

  const filteredInvoices = useMemo(() => {
    if (!search.trim()) return invoices;
    const term = search.toLowerCase();
    return invoices.filter(invoice =>
      invoice.title?.toLowerCase().includes(term) ||
      invoice.clients?.name?.toLowerCase().includes(term) ||
      invoice.invoice_number?.toLowerCase().includes(term)
    );
  }, [invoices, search]);

  const isOverdue = (invoice: any) => {
    if (invoice.status === 'paid' || invoice.status === 'cancelled') return false;
    if (!invoice.due_date) return false;
    return isPast(parseISO(invoice.due_date));
  };

  // Calculate stats
  const overdueCount = invoices.filter(isOverdue).length;

  return (
    <MobileLayout>
      <div className="min-h-screen scrollbar-hide">
        {/* Hero Section */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent" />
          <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

          <div className="relative px-4 pt-8 pb-6">
            <div className="flex items-center gap-2 mb-1">
              <Receipt className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Invoice Management</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground">Invoices</h1>
            <p className="text-muted-foreground mt-1">
              {totalCount} {totalCount === 1 ? 'invoice' : 'invoices'}
              {overdueCount > 0 && <span className="text-warning"> • {overdueCount} overdue</span>}
            </p>

            {/* Actions */}
            <div className="absolute top-8 right-4 flex items-center gap-3">
              <button
                onClick={() => navigate('/invoices/new')}
                className="p-2.5 rounded-full bg-primary shadow-premium hover:bg-primary/90 transition-all duration-200 hover:scale-105 active:scale-95"
              >
                <Plus className="w-6 h-6 text-primary-foreground" />
              </button>

            </div>
          </div>
        </div>

        <div className="px-4 pb-32 space-y-4">
          {/* Offline indicator */}
          {!isOnline && (
            <div className="flex items-center gap-2 px-4 py-3 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl text-sm text-yellow-600 dark:text-yellow-400 backdrop-blur-sm">
              <WifiOff className="w-4 h-4" />
              <span>Working offline - changes will sync when reconnected</span>
            </div>
          )}

          {invoices.length > 0 && (
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search invoices, clients..."
            />
          )}

          {isLoading ? (
            <ListSkeleton count={5} />
          ) : filteredInvoices.length === 0 && search ? (
            <EmptyState
              icon={<Receipt className="w-8 h-8" />}
              title="No matches found"
              description={`No invoices matching "${search}". Try a different search term.`}
            />
          ) : invoices.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-card/50 border border-dashed border-border/50 backdrop-blur-sm">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Receipt className="w-7 h-7 text-primary" />
              </div>
              <p className="font-semibold text-foreground">No invoices yet!</p>
              <p className="text-sm text-muted-foreground mt-1">Create professional invoices and get paid faster</p>
              <Button
                onClick={() => navigate('/invoices/new')}
                className="mt-4 rounded-xl"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Create Invoice
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredInvoices.map((invoice, index) => {
                const overdue = isOverdue(invoice);
                return (
                  <button
                    key={invoice.id}
                    onClick={() => navigate(`/invoices/${invoice.id}`)}
                    className={cn(
                      "w-full p-4 backdrop-blur-sm rounded-2xl border",
                      "hover:shadow-lg transition-all duration-300 group animate-fade-in text-left",
                      overdue
                        ? "bg-warning/5 border-warning/30 hover:border-warning/50"
                        : "bg-card/80 border-border/50 hover:bg-card hover:border-primary/20"
                    )}
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                          overdue
                            ? "bg-warning/15 group-hover:bg-warning/25"
                            : "bg-primary/10 group-hover:bg-primary/15"
                        )}>
                          {overdue ? (
                            <AlertTriangle className="w-5 h-5 text-warning" />
                          ) : (
                            <Receipt className="w-5 h-5 text-primary" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold truncate text-foreground">{invoice.title}</h3>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {invoice.clients?.name || 'No client'} • {invoice.invoice_number}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge status={overdue ? 'overdue' : (invoice.status as any)} />
                        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between pl-13">
                      <p className={cn(
                        "text-lg font-bold",
                        overdue ? "text-warning" : "text-foreground"
                      )}>
                        {formatCurrency(invoice.total)}
                      </p>
                      {invoice.due_date && (
                        <div className={cn(
                          "flex items-center gap-1.5 text-sm",
                          overdue ? "text-warning" : "text-muted-foreground"
                        )}>
                          <Calendar className="w-3.5 h-3.5" />
                          Due {format(new Date(invoice.due_date), 'd MMM')}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </MobileLayout>
  );
}
