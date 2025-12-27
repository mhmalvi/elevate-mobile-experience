import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/ui/empty-state';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Users, Phone, Mail, MapPin } from 'lucide-react';

export default function Clients() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchClients();
  }, [user]);

  const fetchClients = async () => {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', user?.id)
      .order('name');
    setClients(data || []);
    setLoading(false);
  };

  return (
    <MobileLayout>
      <PageHeader 
        title="Clients"
        subtitle={`${clients.length} total`}
        action={{
          label: "Add Client",
          onClick: () => navigate('/clients/new'),
        }}
      />
      
      <div className="p-4 animate-fade-in">
        {clients.length === 0 && !loading ? (
          <EmptyState
            icon={<Users className="w-8 h-8" />}
            title="No clients yet"
            description="Add your first client to start creating quotes and jobs."
            action={{
              label: "Add Client",
              onClick: () => navigate('/clients/new'),
            }}
          />
        ) : (
          <div className="space-y-2">
            {clients.map((client) => (
              <button
                key={client.id}
                onClick={() => navigate(`/clients/${client.id}`)}
                className="w-full p-4 bg-card rounded-xl border text-left hover:bg-muted/50 transition-smooth"
              >
                <h3 className="font-semibold">{client.name}</h3>
                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {client.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5" />
                      {client.phone}
                    </div>
                  )}
                  {client.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5" />
                      {client.email}
                    </div>
                  )}
                  {client.suburb && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5" />
                      {client.suburb}, {client.state}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
