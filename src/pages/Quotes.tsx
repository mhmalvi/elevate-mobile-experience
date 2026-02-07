import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { SearchInput } from '@/components/ui/search-input';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { Button } from '@/components/ui/button';
import { FileText, Calendar, WifiOff, ChevronRight, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { useOfflineQuotes } from '@/lib/offline/offlineHooks';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';

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
      <div className="min-h-screen scrollbar-hide">
        {/* Hero Section */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent" />
          <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

          <div className="relative px-4 pt-8 pb-6">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Quote Management</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground">Quotes</h1>
            <p className="text-muted-foreground mt-1">
              {totalCount} {totalCount === 1 ? 'quote' : 'quotes'} ready to send
            </p>

            {/* Actions */}
            <div className="absolute top-8 right-4 flex items-center gap-3">
              <button
                onClick={() => navigate('/quotes/new')}
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
            <div className="p-8 text-center rounded-2xl bg-card/50 border border-dashed border-border/50 backdrop-blur-sm">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <FileText className="w-7 h-7 text-primary" />
              </div>
              <p className="font-semibold text-foreground">No quotes yet!</p>
              <p className="text-sm text-muted-foreground mt-1">Create professional quotes in under 60 seconds</p>
              <Button
                onClick={() => navigate('/quotes/new')}
                className="mt-4 rounded-xl"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Create Quote
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredQuotes.map((quote, index) => (
                <button
                  key={quote.id}
                  onClick={() => navigate(`/quotes/${quote.id}`)}
                  className={cn(
                    "w-full p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50",
                    "hover:bg-card hover:border-primary/20 hover:shadow-lg",
                    "transition-all duration-300 group animate-fade-in text-left"
                  )}
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold truncate text-foreground">{quote.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {quote.clients?.name || 'No client'} • {quote.quote_number}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={quote.status as any} />
                      <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between pl-13">
                    <p className="text-lg font-bold text-foreground">
                      {formatCurrency(quote.total)}
                    </p>
                    {quote.valid_until && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Calendar className="w-3.5 h-3.5" />
                        Valid until {format(new Date(quote.valid_until), 'd MMM')}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </MobileLayout>
  );
}
