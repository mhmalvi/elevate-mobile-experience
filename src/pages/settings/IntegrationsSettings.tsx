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

interface XeroStatus {
  connected: boolean;
  tenant_id: string | null;
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
  const [xeroLoading, setXeroLoading] = useState(false);
  const [syncingClients, setSyncingClients] = useState(false);
  const [syncingInvoices, setSyncingInvoices] = useState(false);
  const [checkingXero, setCheckingXero] = useState(true);
  const [xeroStatus, setXeroStatus] = useState<XeroStatus>({
    connected: false,
    tenant_id: null,
    sync_enabled: false,
    connected_at: null,
    token_expires_at: null,
  });
  const [syncHistory, setSyncHistory] = useState<SyncHistory[]>([]);
  const [processingCallback, setProcessingCallback] = useState(false);

  const hasProcessedCallback = useRef(false);

  // Handle OAuth callback when redirected back from Xero
  useEffect(() => {
    const handleXeroCallback = async () => {
      // Prevent double execution in Strict Mode
      if (hasProcessedCallback.current) return;

      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');

      console.log('[Xero OAuth] Checking URL params:', {
        hasCode: !!code,
        hasState: !!state,
        fullSearch: window.location.search
      });

      if (code && state) {
        hasProcessedCallback.current = true;
        setProcessingCallback(true);
        console.log('[Xero OAuth] Processing callback with code and state...');

        try {
          // Exchange the code for tokens via Edge Function
          const { data, error } = await supabase.functions.invoke('xero-oauth', {
            body: { action: 'callback', code, state },
          });

          if (error) {
            console.error('Xero callback error:', error);
            toast({
              title: 'Connection Failed',
              description: error.message || 'Failed to connect to Xero',
              variant: 'destructive',
            });
          } else if (data?.success) {
            toast({
              title: 'Success!',
              description: `Connected to Xero: ${data.tenant_name || 'Organization'}`,
            });
            await checkXeroStatus();
          } else {
            console.warn('Xero callback returned no success:', data);
            toast({
              title: 'Connection Issue',
              description: data?.error || 'Unknown error occurred during connection',
              variant: 'destructive',
            });
          }
        } catch (err: any) {
          console.error('Xero callback exception:', err);
          toast({
            title: 'Error',
            description: err.message || 'Failed to process Xero authorization',
            variant: 'destructive',
          });
        } finally {
          setProcessingCallback(false);
          // Clean up URL params
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
    };

    handleXeroCallback();
  }, []);

  useEffect(() => {
    checkXeroStatus();
    loadSyncHistory();
  }, []);

  const checkXeroStatus = async () => {
    setCheckingXero(true);
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('xero_tenant_id, xero_sync_enabled, xero_connected_at, xero_token_expires_at')
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
      }
    } catch (error) {
      console.error('Error checking Xero status:', error);
    } finally {
      setCheckingXero(false);
    }
  };

  const loadSyncHistory = async () => {
    try {
      const { data } = await supabase
        .from('xero_sync_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (data) {
        setSyncHistory(data);
      }
    } catch (error) {
      console.error('Error loading sync history:', error);
    }
  };

  const connectXero = async () => {
    setXeroLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('xero-oauth', {
        body: { action: 'connect' },
      });

      if (error) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to connect to Xero',
          variant: 'destructive',
        });
      } else if (data?.authorization_url) {
        // Redirect to Xero authorization in the same window
        // This ensures the callback is handled by the same app instance
        window.location.href = data.authorization_url;

        toast({
          title: 'Redirecting to Xero',
          description: 'Please complete the authorization in the new window',
        });

        // Poll for connection status
        const interval = setInterval(async () => {
          await checkXeroStatus();
          if (xeroStatus.connected) {
            clearInterval(interval);
            toast({
              title: 'Success',
              description: 'Successfully connected to Xero!',
            });
          }
        }, 3000);

        // Stop polling after 5 minutes
        setTimeout(() => clearInterval(interval), 300000);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to connect to Xero',
        variant: 'destructive',
      });
    } finally {
      setXeroLoading(false);
    }
  };

  const disconnectXero = async () => {
    if (!confirm('Are you sure you want to disconnect Xero? This will not delete any data in Xero.')) {
      return;
    }

    setXeroLoading(true);
    try {
      const { error } = await supabase.functions.invoke('xero-oauth', {
        body: { action: 'disconnect' },
      });

      if (error) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to disconnect Xero',
          variant: 'destructive',
        });
      } else {
        setXeroStatus({
          connected: false,
          tenant_id: null,
          sync_enabled: false,
          connected_at: null,
          token_expires_at: null,
        });

        toast({
          title: 'Success',
          description: 'Disconnected from Xero',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to disconnect Xero',
        variant: 'destructive',
      });
    } finally {
      setXeroLoading(false);
    }
  };

  const toggleAutoSync = async (enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ xero_sync_enabled: enabled })
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

      if (error) throw error;

      setXeroStatus({ ...xeroStatus, sync_enabled: enabled });

      toast({
        title: 'Success',
        description: `Auto-sync ${enabled ? 'enabled' : 'disabled'}`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update sync settings',
        variant: 'destructive',
      });
    }
  };

  const syncClients = async () => {
    setSyncingClients(true);
    try {
      const { data, error } = await supabase.functions.invoke('xero-sync-clients', {
        body: { sync_all: true },
      });

      if (error) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to sync clients',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Success',
          description: `Synced ${data?.synced || 0} clients to Xero${data?.failed > 0 ? ` (${data.failed} failed)` : ''}`,
        });
        loadSyncHistory();
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to sync clients',
        variant: 'destructive',
      });
    } finally {
      setSyncingClients(false);
    }
  };

  const syncInvoices = async () => {
    setSyncingInvoices(true);
    try {
      const { data, error } = await supabase.functions.invoke('xero-sync-invoices', {
        body: { sync_all: true },
      });

      if (error) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to sync invoices',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Success',
          description: `Synced ${data?.synced || 0} invoices to Xero${data?.failed > 0 ? ` (${data.failed} failed)` : ''}`,
        });
        loadSyncHistory();
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to sync invoices',
        variant: 'destructive',
      });
    } finally {
      setSyncingInvoices(false);
    }
  };

  return (
    <MobileLayout>
      <div className="min-h-screen scrollbar-hide">
        {/* Hero Section */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent" />
          <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

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
            <p className="text-muted-foreground mt-1">
              Connect with accounting and business tools
            </p>
          </div>
        </div>

        <div className="px-4 pb-32 space-y-4 animate-fade-in">
          {/* Xero Integration */}
          <Card className="p-6 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 17.606c-.488.488-1.279.488-1.768 0l-4.126-4.126-4.126 4.126c-.488.488-1.279.488-1.768 0-.488-.488-.488-1.279 0-1.768l4.126-4.126-4.126-4.126c-.488-.488-.488-1.279 0-1.768.488-.488 1.279-.488 1.768 0l4.126 4.126 4.126-4.126c.488-.488 1.279-.488 1.768 0 .488.488.488 1.279 0 1.768l-4.126 4.126 4.126 4.126c.488.489.488 1.28 0 1.768z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground">Xero</h3>
                <p className="text-sm text-muted-foreground">
                  Sync clients and invoices with Xero accounting
                </p>
              </div>
            </div>

            {checkingXero || processingCallback ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                {processingCallback && (
                  <span className="ml-2 text-sm text-muted-foreground">Connecting to Xero...</span>
                )}
              </div>
            ) : (
              <>
                {/* Connection Status */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
                  <div className="flex items-center gap-2">
                    {xeroStatus.connected ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                        <div>
                          <p className="font-medium text-foreground">Connected</p>
                          {xeroStatus.connected_at && (
                            <p className="text-sm text-muted-foreground">
                              Since {format(new Date(xeroStatus.connected_at), 'MMM d, yyyy')}
                            </p>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-5 h-5 text-muted-foreground" />
                        <p className="font-medium text-foreground">Not Connected</p>
                      </>
                    )}
                  </div>

                  {xeroStatus.connected ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={disconnectXero}
                      disabled={xeroLoading}
                      className="rounded-lg"
                    >
                      {xeroLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Disconnect'
                      )}
                    </Button>
                  ) : (
                    <Button
                      onClick={connectXero}
                      disabled={xeroLoading}
                      className="rounded-lg"
                    >
                      {xeroLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <ExternalLink className="w-4 h-4 mr-2" />
                      )}
                      Connect Xero
                    </Button>
                  )}
                </div>

                {xeroStatus.connected && (
                  <>
                    {/* Auto-sync Toggle */}
                    <div className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-card/50 animate-fade-in" style={{ animationDelay: '0.05s' }}>
                      <div>
                        <Label htmlFor="auto-sync" className="font-medium flex items-center gap-2">
                          <Zap className="w-4 h-4 text-primary" />
                          Automatic Sync
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Automatically sync new invoices to Xero
                        </p>
                      </div>
                      <Switch
                        id="auto-sync"
                        checked={xeroStatus.sync_enabled}
                        onCheckedChange={toggleAutoSync}
                      />
                    </div>

                    {/* Manual Sync Buttons */}
                    <div className="space-y-2 animate-fade-in" style={{ animationDelay: '0.1s' }}>
                      <Label className="text-sm font-medium">Manual Sync</Label>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={syncClients}
                          disabled={syncingClients}
                          className="flex-1 rounded-xl"
                        >
                          {syncingClients ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <RefreshCw className="w-4 h-4 mr-2" />
                          )}
                          Sync Clients
                        </Button>
                        <Button
                          variant="outline"
                          onClick={syncInvoices}
                          disabled={syncingInvoices}
                          className="flex-1 rounded-xl"
                        >
                          {syncingInvoices ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <RefreshCw className="w-4 h-4 mr-2" />
                          )}
                          Sync Invoices
                        </Button>
                      </div>
                    </div>

                    {/* Sync History */}
                    {syncHistory.length > 0 && (
                      <div className="space-y-2 animate-fade-in" style={{ animationDelay: '0.15s' }}>
                        <Label className="text-sm font-medium">Recent Syncs</Label>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {syncHistory.map((sync) => (
                            <div
                              key={sync.id}
                              className="flex items-center justify-between p-2 rounded-lg border text-sm"
                            >
                              <div className="flex items-center gap-2">
                                {sync.sync_status === 'success' ? (
                                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                                ) : (
                                  <AlertCircle className="w-4 h-4 text-red-600" />
                                )}
                                <span className="capitalize">{sync.entity_type}</span>
                              </div>
                              <span className="text-muted-foreground text-xs">
                                {format(new Date(sync.created_at), 'MMM d, HH:mm')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Help Text */}
                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 animate-fade-in" style={{ animationDelay: '0.2s' }}>
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    <strong>How it works:</strong> Connect your Xero account to automatically sync clients and invoices.
                    When you create an invoice in TradieMate, it will be sent to Xero for your accounting records.
                  </p>
                </div>
              </>
            )}
          </Card>

          {/* MYOB Integration (Coming Soon) */}
          <Card className="p-6 bg-card/80 backdrop-blur-sm rounded-2xl border border-border/50 space-y-4 opacity-60 animate-fade-in" style={{ animationDelay: '0.05s' }}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                <span className="text-2xl font-bold">M</span>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground">MYOB</h3>
                <p className="text-sm text-muted-foreground">
                  Coming soon - MYOB accounting integration
                </p>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-muted/50">
              <p className="text-sm text-muted-foreground">
                MYOB integration will be available after the Xero integration is stable.
                Stay tuned for updates!
              </p>
            </div>
          </Card>
        </div>
      </div>
    </MobileLayout>
  );
}
