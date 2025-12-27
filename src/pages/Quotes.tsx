import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { FileText } from 'lucide-react';

export default function Quotes() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [quotes, setQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchQuotes();
  }, [user]);

  const fetchQuotes = async () => {
    const { data } = await supabase
      .from('quotes')
      .select('*, clients(name)')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false });
    setQuotes(data || []);
    setLoading(false);
  };

  return (
    <MobileLayout>
      <PageHeader 
        title="Quotes"
        subtitle={`${quotes.length} total`}
        action={{
          label: "New Quote",
          onClick: () => navigate('/quotes/new'),
        }}
      />
      
      <div className="p-4 animate-fade-in">
        {quotes.length === 0 && !loading ? (
          <EmptyState
            icon={<FileText className="w-8 h-8" />}
            title="No quotes yet"
            description="Create professional quotes in under 60 seconds."
            action={{
              label: "Create Quote",
              onClick: () => navigate('/quotes/new'),
            }}
          />
        ) : (
          <div className="space-y-2">
            {quotes.map((quote) => (
              <button
                key={quote.id}
                onClick={() => navigate(`/quotes/${quote.id}`)}
                className="w-full p-4 bg-card rounded-xl border text-left hover:bg-muted/50 transition-smooth"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">{quote.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {quote.clients?.name || 'No client'} • {quote.quote_number}
                    </p>
                  </div>
                  <StatusBadge status={quote.status} />
                </div>
                <p className="mt-2 text-lg font-bold">${Number(quote.total).toLocaleString()}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
