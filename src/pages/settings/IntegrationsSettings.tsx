
import { useState, useEffect, useRef } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { CheckCircle2, XCircle, Loader2, RefreshCw, ExternalLink, AlertCircle, ArrowLeft, Link2, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';

interface IntegrationStatus {
  connected: boolean;
  tenant_id?: string | null;
  company_file_id?: string | null;
  sync_enabled: boolean;
  connected_at: string | null;
  token_expires_at: string | null;
}

interface SyncHistory {
  id: string;
  entity_type: string;
  sync_status: string;
  error_message: string | null;
  created_at: string;
}

export default function IntegrationsSettings() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const { toast } = useToast();

  // Xero State
  const [xeroLoading, setXeroLoading] = useState(false);
  const [xeroStatus, setXeroStatus] = useState<IntegrationStatus>({
    connected: false,
    sync_enabled: false,
    connected_at: null,
    token_expires_at: null,
  });

  // QuickBooks State
  const [qbLoading, setQbLoading] = useState(false);
  const [qbStatus, setQbStatus] = useState<IntegrationStatus>({
    connected: false,
    sync_enabled: false,
    connected_at: null,
    token_expires_at: null,
  });

  const [syncingClients, setSyncingClients] = useState(false);
  const [syncingInvoices, setSyncingInvoices] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const [syncHistory, setSyncHistory] = useState<SyncHistory[]>([]);
  const [processingCallback, setProcessingCallback] = useState(false);

  const hasProcessedCallback = useRef(false);

  // Handle OAuth callback when redirected back
  useEffect(() => {
    const handleCallback = async () => {
      // Prevent double execution in Strict Mode
      if (hasProcessedCallback.current) return;

      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');

      if (code && state) {
        hasProcessedCallback.current = true;
        setProcessingCallback(true);
        console.log('[OAuth] Processing callback...');

        try {
          // Determine provider from state
          let provider = 'xero';
          try {
            // Try to parse state to see if it has provider info
            const decoded = JSON.parse(atob(state));
            if (decoded.provider === 'quickbooks') provider = 'quickbooks';
          } catch (e) {
            // If parse fails, assume Xero (legacy)
            console.log('State parse failed, assuming Xero');
          }

          console.log(`[OAuth] Detected provider: ${provider}`);

          // QuickBooks also passes realmId in the callback URL
          const qbRealmId = urlParams.get('realmId');

          const functionName = provider === 'quickbooks' ? 'quickbooks-oauth' : 'xero-oauth';

          // Exchange the code for tokens via Edge Function
          const callbackBody: any = { action: 'callback', code, state };
          if (qbRealmId) callbackBody.realmId = qbRealmId;

          const { data, error } = await supabase.functions.invoke(functionName, {
            body: callbackBody,
          });

          if (error) {
            console.error(`${provider} callback error:`, error);
            toast({
              title: 'Connection Failed',
              description: error.message || `Failed to connect to ${provider.toUpperCase()}`,
              variant: 'destructive',
            });
          } else if (data?.success || data?.access_token || data) { // Some functions return raw data?
            // Assuming success if no error for now, ideally check data.success
            toast({
              title: 'Success!',
              description: `Connected to ${provider.toUpperCase()}`,
            });
            await checkStatus();
          }
        } catch (err: any) {
          console.error('Callback exception:', err);
          toast({
            title: 'Error',
            description: err.message || 'Failed to process authorization',
            variant: 'destructive',
          });
        } finally {
          setProcessingCallback(false);
          // Clean up URL params
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
    };

    handleCallback();
  }, []);

  useEffect(() => {
    checkStatus();
    loadSyncHistory();
  }, []);

  const checkStatus = async () => {
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (profileData) {
        setXeroStatus({
          connected: !!profileData.xero_tenant_id,
          tenant_id: profileData.xero_tenant_id,
          sync_enabled: profileData.xero_sync_enabled || false,
          connected_at: profileData.xero_connected_at,
          token_expires_at: profileData.xero_token_expires_at,
        });

        setQbStatus({
          connected: !!profileData.qb_realm_id,
          sync_enabled: profileData.qb_sync_enabled || false,
          connected_at: profileData.qb_connected_at,
          token_expires_at: profileData.qb_token_expires_at,
        });
      }
    } catch (error) {
      console.error('Error checking status:', error);
    }
  };

  const loadSyncHistory = async () => {
    try {
      const { data } = await supabase
        .from('xero_sync_log') // We might want to rename this table to generic 'sync_log' later
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (data) {
        setSyncHistory(data);
      }
    } catch (error) {
      console.error('Error loading sync history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const connectService = async (service: 'xero' | 'quickbooks') => {
    const setLoading = service === 'xero' ? setXeroLoading : setQbLoading;
    setLoading(true);

    try {
      const functionName = service === 'xero' ? 'xero-oauth' : 'quickbooks-oauth';

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { action: 'connect' },
      });

      if (error) throw error;

      if (data?.url || data?.authorization_url) { // Xero uses authorization_url, standardizing on url? check function
        const authUrl = data.url || data.authorization_url;
        window.location.href = authUrl;

        toast({
          title: `Redirecting to ${service.toUpperCase()}`,
          description: 'Please complete the authorization in the new window',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Connection Error',
        description: error.message,
        variant: 'destructive',
      });
      setLoading(false);
    }
  };

  const disconnectService = async (service: 'xero' | 'quickbooks') => {
    const displayName = service === 'quickbooks' ? 'QuickBooks' : service.toUpperCase();
    if (!confirm(`Are you sure you want to disconnect ${displayName}?`)) return;

    const setLoading = service === 'xero' ? setXeroLoading : setQbLoading;
    setLoading(true);

    try {
      const functionName = service === 'xero' ? 'xero-oauth' : 'quickbooks-oauth';
      const { error } = await supabase.functions.invoke(functionName, {
        body: { action: 'disconnect' },
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Disconnected from ${service.toUpperCase()}`,
      });

      await checkStatus();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleSync = async (service: 'xero' | 'quickbooks', enabled: boolean) => {
    try {
      const updates: any = {};
      if (service === 'xero') updates.xero_sync_enabled = enabled;
      if (service === 'quickbooks') updates.qb_sync_enabled = enabled;

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

      if (error) throw error;

      await checkStatus();
      toast({ title: 'Settings Updated', description: 'Sync settings saved.' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const syncData = async (service: 'xero' | 'quickbooks', type: 'clients' | 'invoices') => {
    const setLoading = type === 'clients' ? setSyncingClients : setSyncingInvoices;
    setLoading(true);

    try {
      const functionName = service === 'xero' ? `xero-sync-${type}` : `quickbooks-sync-${type}`;

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { sync_all: true },
      });

      if (error) throw error;

      toast({
        title: 'Sync Complete',
        description: `${data?.synced || 0} ${type} synced to ${service.toUpperCase()}${data?.failed ? `, ${data.failed} failed` : ''}`,
      });

      await loadSyncHistory();
    } catch (error: any) {
      toast({
        title: 'Sync Failed',
        description: error.message || `Failed to sync ${type}`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatEntityType = (entityType: string) => {
    return entityType
      .replace('qb_', 'QuickBooks ')
      .replace('client', 'Client')
      .replace('invoice', 'Invoice');
  };

  return (
    <MobileLayout>
      <div className="min-h-screen scrollbar-hide pb-20">
        {/* Hero Section */}
        <div className="relative overflow-hidden mb-6">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent" />
          <div className="relative px-4 pt-8 pb-6">
            <button
              onClick={() => navigate('/settings')}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm font-medium">Back to Settings</span>
            </button>
            <div className="flex items-center gap-2 mb-1">
              <Link2 className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Connected Services</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground">Integrations</h1>
          </div>
        </div>

        <div className="px-4 space-y-6">

          {/* Xero Card */}
          <Card className="p-6 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#00b7e2]/10 flex items-center justify-center text-[#00b7e2]">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 17.606c-.488.488-1.279.488-1.768 0l-4.126-4.126-4.126 4.126c-.488.488-1.279.488-1.768 0-.488-.488-.488-1.279 0-1.768l4.126-4.126-4.126-4.126c-.488-.488-.488-1.279 0-1.768.488-.488 1.279-.488 1.768 0l4.126 4.126 4.126-4.126c.488-.488 1.279-.488 1.768 0 .488.488.488 1.279 0 1.768l-4.126 4.126 4.126 4.126c.488.489.488 1.28 0 1.768z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold">Xero</h3>
                <p className="text-sm text-muted-foreground">Accounting Software</p>
              </div>
              {xeroStatus.connected ? (
                <div className="flex items-center gap-2 text-green-600 bg-green-500/10 px-3 py-1 rounded-full text-xs font-medium">
                  <CheckCircle2 className="w-3 h-3" /> Connected
                </div>
              ) : (
                <div className="text-muted-foreground bg-muted px-3 py-1 rounded-full text-xs font-medium">
                  Not Connected
                </div>
              )}
            </div>

            <div className="pt-2">
              {xeroStatus.connected ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <span className="text-sm font-medium">Auto-Sync</span>
                    <Switch
                      checked={xeroStatus.sync_enabled}
                      onCheckedChange={(c) => toggleSync('xero', c)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" onClick={() => syncData('xero', 'clients')} disabled={syncingClients}>
                      {syncingClients ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                      Sync Clients
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => syncData('xero', 'invoices')} disabled={syncingInvoices}>
                      {syncingInvoices ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                      Sync Invoices
                    </Button>
                  </div>
                  <Button variant="outline" className="w-full" onClick={() => disconnectService('xero')} disabled={xeroLoading}>
                    {xeroLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Disconnect'}
                  </Button>
                </div>
              ) : (
                <Button className="w-full bg-[#00b7e2] hover:bg-[#00b7e2]/90 text-white" onClick={() => connectService('xero')} disabled={xeroLoading}>
                  {xeroLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : 'Connect Xero'}
                </Button>
              )}
            </div>
          </Card>

          {/* QuickBooks Card */}
          <Card className="p-6 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#2CA01C]/10 flex items-center justify-center text-[#2CA01C]">
                <span className="text-lg font-black tracking-tight">QB</span>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold">QuickBooks</h3>
                <p className="text-sm text-muted-foreground">Online Accounting</p>
              </div>
              {qbStatus.connected ? (
                <div className="flex items-center gap-2 text-green-600 bg-green-500/10 px-3 py-1 rounded-full text-xs font-medium">
                  <CheckCircle2 className="w-3 h-3" /> Connected
                </div>
              ) : (
                <div className="text-muted-foreground bg-muted px-3 py-1 rounded-full text-xs font-medium">
                  Not Connected
                </div>
              )}
            </div>

            <div className="pt-2">
              {qbStatus.connected ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <span className="text-sm font-medium">Auto-Sync</span>
                    <Switch
                      checked={qbStatus.sync_enabled}
                      onCheckedChange={(c) => toggleSync('quickbooks', c)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" onClick={() => syncData('quickbooks', 'clients')} disabled={syncingClients}>
                      {syncingClients ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                      Sync Clients
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => syncData('quickbooks', 'invoices')} disabled={syncingInvoices}>
                      {syncingInvoices ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                      Sync Invoices
                    </Button>
                  </div>
                  <Button variant="outline" className="w-full" onClick={() => disconnectService('quickbooks')} disabled={qbLoading}>
                    {qbLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Disconnect'}
                  </Button>
                </div>
              ) : (
                <Button className="w-full bg-[#2CA01C] hover:bg-[#2CA01C]/90 text-white" onClick={() => connectService('quickbooks')} disabled={qbLoading}>
                  {qbLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : 'Connect QuickBooks'}
                </Button>
              )}
            </div>
          </Card>

          {/* Sync History */}
          {(syncHistory.length > 0) && (
            <div className="pt-4">
              <h3 className="text-sm font-semibold mb-3">Sync History</h3>
              <div className="space-y-2">
                {syncHistory.map((log) => (
                  <div key={log.id} className="flex items-center justify-between p-3 bg-card border rounded-xl text-sm">
                    <div className="flex items-center gap-3">
                      {log.sync_status === 'success' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <AlertCircle className="w-4 h-4 text-red-500" />}
                      <div>
                        <p className="font-medium">{formatEntityType(log.entity_type)} Sync</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(log.created_at), 'MMM d, h:mm a')}</p>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full capitalize ${log.sync_status === 'success' ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
                      {log.sync_status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </MobileLayout>
  );
}
