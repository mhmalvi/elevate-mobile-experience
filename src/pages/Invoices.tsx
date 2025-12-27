import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { SearchInput } from '@/components/ui/search-input';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { PremiumCard } from '@/components/ui/premium-card';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from '@/components/ui/pagination';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { FAB } from '@/components/ui/fab';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { Receipt, Calendar, AlertTriangle, RefreshCw } from 'lucide-react';
import { format, isPast, parseISO } from 'date-fns';

const PAGE_SIZE = 20;

export default function Invoices() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchInvoices = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const from = (currentPage - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, count } = await supabase
      .from('invoices')
      .select('*, clients(name)', { count: 'exact' })
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false })
      .range(from, to);

    setInvoices(data || []);
    setTotalCount(count || 0);
    setLoading(false);
  }, [user, currentPage]);

  useEffect(() => {
    if (user) fetchInvoices();
  }, [user, fetchInvoices]);

  useEffect(() => {
    if (search) setCurrentPage(1);
  }, [search]);

  const { containerProps, RefreshIndicator } = usePullToRefresh({
    onRefresh: fetchInvoices,
  });

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

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const showPagination = totalPages > 1 && !search;

  return (
    <MobileLayout>
      <PageHeader
        title="Invoices"
        subtitle={`${totalCount} total`}
        showSettings
      />

      <div {...containerProps} className="flex-1 overflow-auto p-4 space-y-4 animate-fade-in">
        <RefreshIndicator />
        {invoices.length > 0 && (
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search invoices, clients..."
          />
        )}

        {loading ? (
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
                        {invoice.is_recurring && (
                          <RefreshCw className="w-3.5 h-3.5 text-primary shrink-0" />
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

        {showPagination && (
          <Pagination className="mt-6">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>

              {[...Array(totalPages)].map((_, i) => {
                const page = i + 1;
                const showPage = page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1);

                if (!showPage) {
                  if (page === 2 && currentPage > 3) {
                    return <PaginationItem key={page}><span className="px-2">...</span></PaginationItem>;
                  }
                  if (page === totalPages - 1 && currentPage < totalPages - 2) {
                    return <PaginationItem key={page}><span className="px-2">...</span></PaginationItem>;
                  }
                  return null;
                }

                return (
                  <PaginationItem key={page}>
                    <PaginationLink
                      onClick={() => setCurrentPage(page)}
                      isActive={currentPage === page}
                      className="cursor-pointer"
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}

              <PaginationItem>
                <PaginationNext
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>

      <FAB onClick={() => navigate('/invoices/new')} label="New Invoice" />
    </MobileLayout>
  );
}
