import { supabase } from '@/integrations/supabase/client';
import type { VoiceEntityData, VoiceStatus } from './types';
import {
  createQuote,
  createInvoice,
  createClient,
  createJob,
} from './VoiceFormBuilder';

interface ClientMatch {
  id: string;
  name: string;
  match_type: string;
  confidence: number;
}

interface ActionDispatchDeps {
  userId: string;
  setStatus: (status: VoiceStatus) => void;
  setAiMessage: (msg: string) => void;
  setOpen: (open: boolean) => void;
  speak: (text: string, autoListen: boolean) => void;
  speakThenDo: (text: string, fn: () => void) => void;
  navigate: (path: string) => void;
  onToast: (opts: { title: string; description?: string; variant?: 'destructive' | 'default' }) => void;
}

/**
 * Dispatches an action returned from the AI voice processor.
 * Handles navigation, entity creation, status updates, and search.
 */
export async function dispatchAction(
  action: string,
  data: VoiceEntityData,
  responseText: string,
  deps: ActionDispatchDeps
): Promise<void> {
  const { userId, setStatus, setAiMessage, setOpen, speak, speakThenDo, navigate, onToast } = deps;

  const formDeps = {
    userId,
    onToast,
    onNavigate: navigate,
    onClose: () => setOpen(false),
  };

  switch (action) {
    case 'create_quote':
      setStatus('success');
      speakThenDo(responseText, () => createQuote(data, formDeps));
      break;

    case 'create_invoice':
      setStatus('success');
      speakThenDo(responseText, () => createInvoice(data, formDeps));
      break;

    case 'create_client':
      setStatus('success');
      speakThenDo(responseText, () => createClient(data, formDeps));
      break;

    case 'schedule_job':
      setStatus('success');
      speakThenDo(responseText, () => createJob(data, formDeps));
      break;

    case 'find_client':
      await handleFindClient(data, responseText, deps);
      break;

    case 'mark_paid':
      await handleMarkPaid(data, responseText, deps);
      break;

    case 'complete_job':
      await handleCompleteJob(data, responseText, deps);
      break;

    case 'update_status':
      await handleUpdateStatus(data, responseText, deps);
      break;

    case 'navigate':
      speakThenDo(responseText, () => {
        if (data.destination) navigate(data.destination);
        setOpen(false);
      });
      break;

    case 'ask_details':
    default:
      speak(responseText, true);
      break;
  }
}

async function handleFindClient(
  data: VoiceEntityData,
  responseText: string,
  { userId, setStatus, setAiMessage, setOpen, speak, speakThenDo, navigate }: ActionDispatchDeps
): Promise<void> {
  const searchTerm = data.search_name || data.client_name || data.name || '';
  if (!searchTerm) {
    speak(responseText, true);
    return;
  }

  setStatus('processing');
  try {
    const { data: matches, error: searchErr } = await supabase
      .rpc('search_clients_fuzzy', {
        p_user_id: userId,
        p_search_term: searchTerm,
        p_limit: 5,
      });

    if (searchErr) throw searchErr;

    const clientMatches = matches as ClientMatch[] | null;

    if (clientMatches && clientMatches.length === 1) {
      setStatus('success');
      const matchNote =
        clientMatches[0].match_type !== 'exact' && clientMatches[0].match_type !== 'contains'
          ? ' (closest match)'
          : '';
      setAiMessage(`Found ${clientMatches[0].name}${matchNote}! Opening now.`);
      speakThenDo(`Found ${clientMatches[0].name}!`, () => {
        navigate(`/clients/${clientMatches[0].id}`);
        setOpen(false);
      });
    } else if (clientMatches && clientMatches.length > 1) {
      if (clientMatches[0].confidence >= 0.8) {
        setStatus('success');
        setAiMessage(`Found ${clientMatches[0].name}! Opening now.`);
        speakThenDo(`Found ${clientMatches[0].name}!`, () => {
          navigate(`/clients/${clientMatches[0].id}`);
          setOpen(false);
        });
      } else {
        setStatus('success');
        const names = clientMatches.slice(0, 3).map((m) => m.name).join(', ');
        setAiMessage(`Found ${clientMatches.length} possible matches: ${names}`);
        speakThenDo(`Found ${clientMatches.length} possible matches. Here they are.`, () => {
          navigate(`/clients?search=${encodeURIComponent(searchTerm)}`);
          setOpen(false);
        });
      }
    } else {
      setStatus('error');
      setAiMessage(`No clients found matching "${searchTerm}". Want me to add them?`);
      speak(
        `Sorry, couldn't find anyone called ${searchTerm}. Want me to add them as a new client?`,
        true
      );
    }
  } catch {
    setStatus('success');
    speakThenDo(responseText, () => {
      navigate(`/clients?search=${encodeURIComponent(searchTerm)}`);
      setOpen(false);
    });
  }
}

async function handleMarkPaid(
  data: VoiceEntityData,
  responseText: string,
  { userId, setStatus, setAiMessage, setOpen, speak, speakThenDo, navigate }: ActionDispatchDeps
): Promise<void> {
  setStatus('processing');
  try {
    if (data.invoice_number || data.invoice_id) {
      const query = supabase
        .from('invoices')
        .update({ status: 'paid' })
        .eq('user_id', userId);
      if (data.invoice_id) {
        await query.eq('id', data.invoice_id);
      } else {
        await query.ilike('invoice_number', `%${data.invoice_number}%`);
      }
      setStatus('success');
      speakThenDo(responseText, () => {
        navigate('/invoices');
        setOpen(false);
      });
    } else if (data.client_name) {
      const { data: clients } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', userId)
        .ilike('name', `%${data.client_name}%`)
        .limit(1);
      if (clients?.[0]) {
        const { data: inv } = await supabase
          .from('invoices')
          .select('id')
          .eq('client_id', clients[0].id)
          .in('status', ['sent', 'draft', 'overdue'])
          .order('created_at', { ascending: false })
          .limit(1);
        if (inv?.[0]) {
          await supabase.from('invoices').update({ status: 'paid' }).eq('id', inv[0].id);
          setStatus('success');
          speakThenDo(responseText, () => {
            navigate('/invoices');
            setOpen(false);
          });
        } else {
          setStatus('error');
          setAiMessage(`No unpaid invoices found for ${data.client_name}.`);
          speak(`Couldn't find any unpaid invoices for ${data.client_name}.`, true);
        }
      }
    } else {
      speak(responseText, true);
    }
  } catch {
    setStatus('error');
    setAiMessage('Failed to update invoice.');
    speak('Sorry, had trouble marking that invoice as paid.', true);
  }
}

async function handleCompleteJob(
  data: VoiceEntityData,
  responseText: string,
  { userId, setStatus, setAiMessage, setOpen, speak, speakThenDo, navigate }: ActionDispatchDeps
): Promise<void> {
  setStatus('processing');
  try {
    if (data.job_id) {
      await supabase
        .from('jobs')
        .update({ status: 'completed' })
        .eq('id', data.job_id)
        .eq('user_id', userId);
      setStatus('success');
      speakThenDo(responseText, () => {
        navigate('/jobs');
        setOpen(false);
      });
    } else if (data.client_name || data.job_title) {
      let jobQuery = supabase
        .from('jobs')
        .select('id')
        .eq('user_id', userId)
        .neq('status', 'completed');
      if (data.client_name) {
        const { data: clients } = await supabase
          .from('clients')
          .select('id')
          .eq('user_id', userId)
          .ilike('name', `%${data.client_name}%`)
          .limit(1);
        if (clients?.[0]) jobQuery = jobQuery.eq('client_id', clients[0].id);
      }
      if (data.job_title) jobQuery = jobQuery.ilike('title', `%${data.job_title}%`);
      const { data: jobs } = await jobQuery.order('created_at', { ascending: false }).limit(1);
      if (jobs?.[0]) {
        await supabase.from('jobs').update({ status: 'completed' }).eq('id', jobs[0].id);
        setStatus('success');
        speakThenDo(responseText, () => {
          navigate('/jobs');
          setOpen(false);
        });
      } else {
        setStatus('error');
        setAiMessage('No matching active job found.');
        speak("Couldn't find a matching job to complete.", true);
      }
    } else {
      speak(responseText, true);
    }
  } catch {
    setStatus('error');
    setAiMessage('Failed to update job.');
    speak('Sorry, had trouble marking that job as complete.', true);
  }
}

async function handleUpdateStatus(
  data: VoiceEntityData,
  responseText: string,
  { userId, setStatus, setAiMessage: _setAiMessage, setOpen, speak, speakThenDo, navigate }: ActionDispatchDeps
): Promise<void> {
  setStatus('processing');
  try {
    const table = data.entity_type === 'invoice' ? 'invoices' : 'jobs';
    const newStatus = data.new_status || 'in_progress';
    if (data.entity_id) {
      await supabase
        .from(table)
        .update({ status: newStatus })
        .eq('id', data.entity_id)
        .eq('user_id', userId);
      setStatus('success');
      speakThenDo(responseText, () => {
        navigate(`/${table}`);
        setOpen(false);
      });
    } else {
      speak(responseText, true);
    }
  } catch {
    setStatus('error');
    speak('Sorry, had trouble updating that status.', true);
  }
}
