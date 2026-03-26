import { supabase } from '@/integrations/supabase/client';
import type { VoiceEntityData } from './types';

interface FormBuilderDeps {
  userId: string;
  onToast: (opts: { title: string; description?: string; variant?: 'destructive' | 'default' }) => void;
  onNavigate: (path: string) => void;
  onClose: () => void;
}

/**
 * Finds an existing client by name or creates a new one.
 * Returns the client ID or null on failure.
 */
export async function findOrCreateClient(
  userId: string,
  clientName: string,
  clientData: VoiceEntityData | undefined,
  onToast: FormBuilderDeps['onToast']
): Promise<string | null> {
  if (!clientName) return null;

  const { data: existingClients } = await supabase
    .from('clients')
    .select('id, name')
    .eq('user_id', userId)
    .ilike('name', `%${clientName}%`)
    .limit(1);

  if (existingClients && existingClients.length > 0) {
    return existingClients[0].id;
  }

  const { data: newClient, error } = await supabase
    .from('clients')
    .insert({
      user_id: userId,
      name: clientName,
      phone: clientData?.client_phone || null,
      email: clientData?.client_email || null,
      address: clientData?.client_address || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Create client error:', error.message, error.details, error.hint);
  }
  if (newClient) {
    onToast({ title: 'New client added!', description: clientName });
    return newClient.id;
  }

  return null;
}

export async function createQuote(
  data: VoiceEntityData,
  { userId, onToast, onNavigate, onClose }: FormBuilderDeps
): Promise<void> {
  let clientId: string | null = null;
  if (data.client_name) {
    clientId = await findOrCreateClient(userId, data.client_name, data, onToast);
  }

  const { data: quote, error } = await supabase
    .from('quotes')
    .insert({
      user_id: userId,
      client_id: clientId,
      quote_number: `Q-${Date.now().toString().slice(-6)}`,
      title: data.client_name ? `Quote for ${data.client_name}` : 'Voice Quote',
      status: 'draft',
      total: data.total || 0,
      valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      notes: data.notes || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Create quote error:', error.message, error.details);
    onToast({ title: 'Error', description: 'Failed to save. Please try again.', variant: 'destructive' });
  }

  if (quote && data.items && data.items.length > 0) {
    const items = data.items.map((item) => ({
      quote_id: quote.id,
      description: item.description || 'Service',
      quantity: item.quantity || 1,
      unit_price: item.price || 0,
      total: (item.quantity || 1) * (item.price || 0),
    }));
    await supabase.from('quote_line_items').insert(items);
  }

  if (quote) {
    onClose();
    onToast({
      title: 'Quote Created!',
      description: `${data.client_name ? `For ${data.client_name} - ` : ''}$${data.total || 0}`,
    });
    onNavigate(`/quotes/${quote.id}`);
  }
}

export async function createInvoice(
  data: VoiceEntityData,
  { userId, onToast, onNavigate, onClose }: FormBuilderDeps
): Promise<void> {
  let clientId: string | null = null;
  if (data.client_name) {
    clientId = await findOrCreateClient(userId, data.client_name, data, onToast);
  }

  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert({
      user_id: userId,
      client_id: clientId,
      invoice_number: `INV-${Date.now().toString().slice(-6)}`,
      title: data.client_name ? `Invoice for ${data.client_name}` : 'Voice Invoice',
      status: 'draft',
      total: data.total || 0,
    })
    .select()
    .single();

  if (error) {
    console.error('Create invoice error:', error.message, error.details);
    onToast({ title: 'Error', description: 'Failed to save. Please try again.', variant: 'destructive' });
  }

  if (invoice && data.items && data.items.length > 0) {
    const items = data.items.map((item) => ({
      invoice_id: invoice.id,
      description: item.description || 'Service',
      quantity: item.quantity || 1,
      unit_price: item.price || 0,
      total: (item.quantity || 1) * (item.price || 0),
    }));
    await supabase.from('invoice_line_items').insert(items);
  }

  if (invoice) {
    onClose();
    onToast({
      title: 'Invoice Created!',
      description: `${data.client_name ? `For ${data.client_name}` : ''}`,
    });
    onNavigate(`/invoices/${invoice.id}`);
  }
}

export async function createClient(
  data: VoiceEntityData,
  { userId, onToast, onNavigate, onClose }: FormBuilderDeps
): Promise<void> {
  const { data: client, error } = await supabase
    .from('clients')
    .insert({
      user_id: userId,
      name: data.client_name || 'New Client',
      phone: data.client_phone || null,
      email: data.client_email || null,
      address: data.client_address || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Create client error:', error.message, error.details);
    onToast({ title: 'Error', description: 'Failed to save. Please try again.', variant: 'destructive' });
  }
  if (client) {
    onClose();
    onToast({ title: 'Client Added!' });
    onNavigate(`/clients/${client.id}`);
  }
}

export async function createJob(
  data: VoiceEntityData,
  { userId, onToast, onNavigate, onClose }: FormBuilderDeps
): Promise<void> {
  let clientId: string | null = null;
  if (data.client_name) {
    clientId = await findOrCreateClient(userId, data.client_name, data, onToast);
  }

  const { data: job, error } = await supabase
    .from('jobs')
    .insert({
      user_id: userId,
      client_id: clientId,
      title: data.title || (data.client_name ? `Job for ${data.client_name}` : 'New Job'),
      description: data.description || '',
      status: 'scheduled',
      scheduled_date: data.scheduled_date || new Date().toISOString(),
      site_address: data.site_address || data.client_address || '',
    })
    .select()
    .single();

  if (error) {
    console.error('Create job error:', error.message, error.details);
    onToast({ title: 'Error', description: 'Failed to save. Please try again.', variant: 'destructive' });
  }

  if (job) {
    onClose();
    onToast({
      title: 'Job Scheduled!',
      description: `${data.client_name ? `For ${data.client_name}` : data.title || ''}`,
    });
    onNavigate(`/jobs/${job.id}`);
  }
}
