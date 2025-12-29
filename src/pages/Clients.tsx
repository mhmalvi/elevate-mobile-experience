import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/ui/empty-state';
import { SearchInput } from '@/components/ui/search-input';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { PremiumCard } from '@/components/ui/premium-card';
import { QuickContact } from '@/components/ui/quick-contact';
import { useAuth } from '@/hooks/useAuth';
import { useOfflineClients } from '@/lib/offline/offlineHooks';
import { FAB } from '@/components/ui/fab';
import { Users, MapPin, WifiOff } from 'lucide-react';

export default function Clients() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState('');

  // Use offline-first hook
  const { clients, loading, isOnline } = useOfflineClients(user?.id || '');

  const filteredClients = useMemo(() => {
    if (!search.trim()) return clients;
    const term = search.toLowerCase();
    return clients.filter(client => 
      client.name?.toLowerCase().includes(term) ||
      client.email?.toLowerCase().includes(term) ||
      client.phone?.includes(term) ||
      client.suburb?.toLowerCase().includes(term)
    );
  }, [clients, search]);

  return (
    <MobileLayout>
      <PageHeader 
        title="Clients"
        subtitle={`${clients.length} total`}
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

        {clients.length > 0 && (
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search clients, suburbs..."
          />
        )}

        {loading ? (
          <ListSkeleton count={5} />
        ) : filteredClients.length === 0 && search ? (
          <EmptyState
            icon={<Users className="w-8 h-8" />}
            title="No matches found"
            description={`No clients matching "${search}". Try a different search term.`}
          />
        ) : clients.length === 0 ? (
          <EmptyState
            icon={<Users className="w-8 h-8" />}
            title="No clients yet, mate!"
            description="Add your first client to start creating quotes and jobs. No worries, it's quick!"
            action={{
              label: "Add Client",
              onClick: () => navigate('/clients/new'),
            }}
          />
        ) : (
          <div className="space-y-3">
            {filteredClients.map((client, index) => (
              <PremiumCard
                key={client.id}
                onClick={() => navigate(`/clients/${client.id}`)}
                className="animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-start justify-between gap-3">
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
                      <p className="text-sm text-muted-foreground truncate mt-1">
                        {client.email}
                      </p>
                    )}
                  </div>
                  <QuickContact phone={client.phone} email={client.email} />
                </div>
              </PremiumCard>
            ))}
          </div>
        )}
      </div>

      <FAB onClick={() => navigate('/clients/new')} label="Add Client" />
    </MobileLayout>
  );
}
