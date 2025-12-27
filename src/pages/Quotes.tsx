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
import { FileText, Calendar } from 'lucide-react';
import { format } from 'date-fns';

const PAGE_SIZE = 20;

export default function Quotes() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [quotes, setQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchQuotes = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Calculate range for pagination
    const from = (currentPage - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, count } = await supabase
      .from('quotes')
      .select('*, clients(name)', { count: 'exact' })
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false })
      .range(from, to);

    setQuotes(data || []);
    setTotalCount(count || 0);
    setLoading(false);
  }, [user, currentPage]);

  useEffect(() => {
    if (user) fetchQuotes();
  }, [user, fetchQuotes]);

  // Reset to page 1 when search changes
  useEffect(() => {
    if (search) setCurrentPage(1);
  }, [search]);

  const { containerProps, RefreshIndicator } = usePullToRefresh({
    onRefresh: fetchQuotes,
  });

  const filteredQuotes = useMemo(() => {
    if (!search.trim()) return quotes;
    const term = search.toLowerCase();
    return quotes.filter(quote =>
      quote.title?.toLowerCase().includes(term) ||
      quote.clients?.name?.toLowerCase().includes(term) ||
      quote.quote_number?.toLowerCase().includes(term)
    );
  }, [quotes, search]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const showPagination = totalPages > 1 && !search;

  return (
    <MobileLayout>
      <PageHeader
        title="Quotes"
        subtitle={`${totalCount} total`}
        showSettings
      />
      
      <div {...containerProps} className="flex-1 overflow-auto p-4 space-y-4 animate-fade-in">
        <RefreshIndicator />
        {quotes.length > 0 && (
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search quotes, clients..."
          />
        )}

        {loading ? (
          <ListSkeleton count={5} />
        ) : filteredQuotes.length === 0 && search ? (
          <EmptyState
            icon={<FileText className="w-8 h-8" />}
            title="No matches found"
            description={`No quotes matching "${search}". Try a different search term.`}
          />
        ) : quotes.length === 0 ? (
          <EmptyState
            icon={<FileText className="w-8 h-8" />}
            title="No quotes yet, mate!"
            description="Create professional quotes in under 60 seconds. Easy as!"
            action={{
              label: "Create Quote",
              onClick: () => navigate('/quotes/new'),
            }}
          />
        ) : (
          <div className="space-y-3">
            {filteredQuotes.map((quote, index) => (
              <PremiumCard
                key={quote.id}
                onClick={() => navigate(`/quotes/${quote.id}`)}
                className="animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` } as React.CSSProperties}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold truncate text-foreground">{quote.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {quote.clients?.name || 'No client'} • {quote.quote_number}
                    </p>
                  </div>
                  <StatusBadge status={quote.status} />
                </div>
                
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-lg font-bold text-foreground">
                    ${Number(quote.total || 0).toLocaleString()}
                  </p>
                  {quote.valid_until && (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Calendar className="w-3.5 h-3.5" />
                      Valid until {format(new Date(quote.valid_until), 'd MMM')}
                    </div>
                  )}
                </div>
              </PremiumCard>
            ))}
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
                // Show first page, last page, current page, and pages around current
                const showPage = page === 1 ||
                                page === totalPages ||
                                (page >= currentPage - 1 && page <= currentPage + 1);

                if (!showPage) {
                  // Show ellipsis once before and after current range
                  if (page === 2 && currentPage > 3) {
                    return (
                      <PaginationItem key={page}>
                        <span className="px-2">...</span>
                      </PaginationItem>
                    );
                  }
                  if (page === totalPages - 1 && currentPage < totalPages - 2) {
                    return (
                      <PaginationItem key={page}>
                        <span className="px-2">...</span>
                      </PaginationItem>
                    );
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

      <FAB onClick={() => navigate('/quotes/new')} label="New Quote" />
    </MobileLayout>
  );
}
