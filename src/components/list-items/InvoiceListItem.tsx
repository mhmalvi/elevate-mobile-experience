import React from 'react';
import { useNavigate } from 'react-router-dom';
import { StatusBadge, type StatusType } from '@/components/ui/status-badge';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Receipt, Calendar, AlertTriangle, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

interface InvoiceListItemProps {
  invoice: {
    id: string;
    title: string | null;
    invoice_number: string | null;
    total: number;
    status: string;
    due_date: string | null;
    clients?: { name: string | null } | null;
  };
  index: number;
  overdue: boolean;
}

export const InvoiceListItem = React.memo(function InvoiceListItem({ invoice, index, overdue }: InvoiceListItemProps) {
  const navigate = useNavigate();

  return (
    <button
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
          <StatusBadge status={overdue ? 'overdue' : (invoice.status as StatusType)} />
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
});
