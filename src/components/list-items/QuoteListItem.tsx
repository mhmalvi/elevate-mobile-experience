import React from 'react';
import { useNavigate } from 'react-router-dom';
import { StatusBadge, type StatusType } from '@/components/ui/status-badge';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { FileText, Calendar, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

interface QuoteListItemProps {
  quote: {
    id: string;
    title: string | null;
    quote_number: string | null;
    total: number;
    status: string;
    valid_until: string | null;
    clients?: { name: string | null } | null;
  };
  index: number;
}

export const QuoteListItem = React.memo(function QuoteListItem({ quote, index }: QuoteListItemProps) {
  const navigate = useNavigate();

  return (
    <button
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
          <StatusBadge status={quote.status as StatusType} />
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
  );
});
