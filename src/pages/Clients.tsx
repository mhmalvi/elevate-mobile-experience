import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { EmptyState } from '@/components/ui/empty-state';
import { SearchInput } from '@/components/ui/search-input';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { QuickContact } from '@/components/ui/quick-contact';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useOfflineClients } from '@/lib/offline/offlineHooks';
import { cn } from '@/lib/utils';

import { Users, MapPin, WifiOff, ChevronRight, Plus, Mail } from 'lucide-react';

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
      <div className="min-h-screen scrollbar-hide">
        {/* Hero Section */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent" />
          <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

          <div className="relative px-4 pt-8 pb-6">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Client Directory</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground">Clients</h1>
            <p className="text-muted-foreground mt-1">
              {clients.length} {clients.length === 1 ? 'client' : 'clients'} in your network
            </p>

            {/* Actions */}
            <div className="absolute top-8 right-4 flex items-center gap-3">
              <button
                onClick={() => navigate('/clients/new')}
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
            <div className="p-8 text-center rounded-2xl bg-card/50 border border-dashed border-border/50 backdrop-blur-sm">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Users className="w-7 h-7 text-primary" />
              </div>
              <p className="font-semibold text-foreground">No clients yet, mate!</p>
              <p className="text-sm text-muted-foreground mt-1">Add your first client to get started</p>
              <Button
                onClick={() => navigate('/clients/new')}
                className="mt-4 rounded-xl"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Add Client
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredClients.map((client, index) => (
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
              ))}
            </div>
          )}
        </div>
      </div>
    </MobileLayout>
  );
}
