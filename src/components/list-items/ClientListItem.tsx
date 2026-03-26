import React from 'react';
import { useNavigate } from 'react-router-dom';
import { QuickContact } from '@/components/ui/quick-contact';
import { cn } from '@/lib/utils';
import { MapPin, ChevronRight, Mail } from 'lucide-react';

interface ClientListItemProps {
  client: {
    id: string;
    name: string | null;
    email?: string | null;
    phone?: string | null;
    suburb?: string | null;
    state?: string | null;
  };
  index: number;
}

export const ClientListItem = React.memo(function ClientListItem({ client, index }: ClientListItemProps) {
  const navigate = useNavigate();

  return (
    <button
      key={client.id}
      onClick={() => navigate(`/clients/${client.id}`)}
      className={cn(
        "w-full p-4 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50",
        "hover:bg-card hover:border-primary/20 hover:shadow-lg",
        "transition-all duration-300 group animate-fade-in text-left"
      )}
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Client Avatar */}
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0 group-hover:from-primary/30 group-hover:to-primary/10 transition-colors">
            <span className="text-base font-bold text-primary">
              {(client.name || 'C')[0].toUpperCase()}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-foreground">{client.name}</h3>
            {(client.suburb || client.state) && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  {[client.suburb, client.state].filter(Boolean).join(', ')}
                </span>
              </div>
            )}
            {client.email && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                <Mail className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{client.email}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <QuickContact phone={client.phone} email={client.email} />
          <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
    </button>
  );
});
