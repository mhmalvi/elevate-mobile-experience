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
import { FileText, Calendar, WifiOff } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { useOfflineQuotes } from '@/lib/offline/offlineHooks';

export default function Quotes() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState('');

  // Use offline-first hook
  const { quotes, loading: isLoading, isOnline } = useOfflineQuotes(user?.id || '');

  const totalCount = quotes.length;

  // Client-side search filtering
  const filteredQuotes = useMemo(() => {
    if (!search.trim()) return quotes;
    const term = search.toLowerCase();
    return quotes.filter(quote =>
      quote.title?.toLowerCase().includes(term) ||
      quote.clients?.name?.toLowerCase().includes(term) ||
      quote.quote_number?.toLowerCase().includes(term)
    );
  }, [quotes, search]);

  return (
    <MobileLayout>
      <PageHeader
        title="Quotes"
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

        {quotes.length > 0 && (
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search quotes, clients..."
          />
        )}

        {isLoading ? (
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
      </div>

      <FAB onClick={() => navigate('/quotes/new')} label="New Quote" />
    </MobileLayout>
  );
}
