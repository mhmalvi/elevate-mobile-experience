import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { SearchInput } from '@/components/ui/search-input';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { PremiumCard } from '@/components/ui/premium-card';
import { FAB } from '@/components/ui/fab';
import { Receipt, Calendar, AlertTriangle, WifiOff } from 'lucide-react';
import { format, isPast, parseISO } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { useOfflineInvoices } from '@/lib/offline/offlineHooks';

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

  return (
    <MobileLayout>
      <PageHeader
        title="Invoices"
        subtitle={`${totalCount} total`}
        showSettings
      />

      <div className="flex-1 overflow-auto p-4 space-y-4 animate-fade-in">
        {/* Offline indicator */}
        {!isOnline && (
          <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-sm text-yellow-600 dark:text-yellow-400">
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
          <EmptyState
            icon={<Receipt className="w-8 h-8" />}
            title="No invoices yet, mate!"
            description="Create professional invoices and get paid faster. Cheers!"
            action={{
              label: "Create Invoice",
              onClick: () => navigate('/invoices/new'),
            }}
          />
        ) : (
          <div className="space-y-3">
            {filteredInvoices.map((invoice, index) => {
              const overdue = isOverdue(invoice);
              return (
                <PremiumCard
                  key={invoice.id}
                  onClick={() => navigate(`/invoices/${invoice.id}`)}
                  className={`animate-fade-in ${overdue ? 'border-warning/50 bg-warning/5' : ''}`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate text-foreground">{invoice.title}</h3>
                        {overdue && (
                          <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {invoice.clients?.name || 'No client'} • {invoice.invoice_number}
                      </p>
                    </div>
                    <StatusBadge status={overdue ? 'overdue' : invoice.status} />
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-lg font-bold text-foreground">
                      ${Number(invoice.total || 0).toLocaleString()}
                    </p>
                    {invoice.due_date && (
                      <div className={`flex items-center gap-1.5 text-sm ${overdue ? 'text-warning' : 'text-muted-foreground'}`}>
                        <Calendar className="w-3.5 h-3.5" />
                        Due {format(new Date(invoice.due_date), 'd MMM')}
                      </div>
                    )}
                  </div>
                </PremiumCard>
              );
            })}
          </div>
        )}
      </div>

      <FAB onClick={() => navigate('/invoices/new')} label="New Invoice" />
    </MobileLayout>
  );
}
