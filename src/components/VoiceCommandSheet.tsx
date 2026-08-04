import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from '@/components/ui/sheet';
import { Mic, MicOff, Sparkles, Loader2, Volume2, Send } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
    startListening,
    isSpeechAvailable,
    speakText,
    cancelSpeech,
    type SpeechSession,
    type SpeechErrorCode,
} from '@/lib/speech';

interface VoiceCommandSheetProps {
    children: React.ReactNode;
}

type VoiceStatus = 'idle' | 'listening' | 'processing' | 'speaking' | 'success' | 'error';

const MAX_RECORD_TIME = 120; // 2 minutes max

export function VoiceCommandSheet({ children }: VoiceCommandSheetProps) {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { user } = useAuth();
    const [open, setOpen] = useState(false);

    // Core State
    const [status, setStatus] = useState<VoiceStatus>('idle');
    const [transcript, setTranscript] = useState('');
    const [fullTranscript, setFullTranscript] = useState(''); // Accumulated transcript
    const [aiMessage, setAiMessage] = useState('');
    const [recordingTime, setRecordingTime] = useState(0);

    // Conversation Context
    const [conversationHistory, setConversationHistory] = useState<any[]>([]);
    const [accumulatedData, setAccumulatedData] = useState<any>({});

    const [speechSupported, setSpeechSupported] = useState(true);

    // Refs
    const sessionRef = useRef<SpeechSession | null>(null);
    const timerRef = useRef<any>(null);
    const silenceTimerRef = useRef<any>(null);
    const lastSpeechRef = useRef<number>(0);
    const hasSpeechRef = useRef<boolean>(false);
    const sendMessageRef = useRef<(() => void) | null>(null);

    // Probe the engine once so the UI can explain itself instead of failing at
    // the moment the user taps the mic.
    useEffect(() => {
        let cancelled = false;
        void isSpeechAvailable().then(ok => {
            if (!cancelled) setSpeechSupported(ok);
        });
        return () => { cancelled = true; };
    }, []);

    // Handle sheet open/close
    useEffect(() => {
        if (open) {
            resetConversation();
            setAiMessage("Hey! What can I help you with today?");
            setTimeout(() => speak("Hey! What can I help you with?", false), 500);
        } else {
            cleanup();
        }
    }, [open]);

    // Recording timer
    useEffect(() => {
        if (status === 'listening') {
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => {
                    if (prev >= MAX_RECORD_TIME) {
                        stopRecording();
                        return prev;
                    }
                    return prev + 1;
                });
            }, 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
            setRecordingTime(0);
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [status]);

    const cleanup = () => {
        sessionRef.current?.stop();
        sessionRef.current = null;
        if (timerRef.current) clearInterval(timerRef.current);
        if (silenceTimerRef.current) clearInterval(silenceTimerRef.current);
        cancelSpeech();
    };

    const resetConversation = () => {
        setStatus('idle');
        setTranscript('');
        setFullTranscript('');
        setConversationHistory([]);
        setAccumulatedData({});
        setRecordingTime(0);
    };

    const startRecording = useCallback(async () => {
        // Reset silence tracking
        hasSpeechRef.current = false;
        lastSpeechRef.current = 0;
        if (silenceTimerRef.current) clearInterval(silenceTimerRef.current);

        // Any previous session must be torn down before starting another,
        // or the native recogniser's auto-restart loop keeps running.
        sessionRef.current?.stop();
        sessionRef.current = null;

        setStatus('listening');
        setTranscript('');

        // Auto-send after 3s of silence, once the user has actually said something.
        silenceTimerRef.current = setInterval(() => {
            if (hasSpeechRef.current && lastSpeechRef.current > 0) {
                const silenceDuration = Date.now() - lastSpeechRef.current;
                if (silenceDuration > 3000) {
                    if (silenceTimerRef.current) clearInterval(silenceTimerRef.current);
                    sendMessageRef.current?.();
                }
            }
        }, 500);

        const describeError = (code: SpeechErrorCode): string | null => {
            switch (code) {
                case 'not-supported':
                    return "This device can't do voice input. You can still type or use the forms.";
                case 'permission-denied':
                    return 'I need microphone access to hear you. Enable it in your device settings.';
                case 'network':
                    return 'Voice recognition needs a connection and I could not reach it.';
                // no-speech / aborted are normal end-of-utterance signals, not failures.
                case 'no-speech':
                case 'aborted':
                    return null;
                default:
                    return 'Voice input error. Please try again.';
            }
        };

        sessionRef.current = await startListening({
            onPartial: (text) => {
                lastSpeechRef.current = Date.now();
                hasSpeechRef.current = true;
                setTranscript(text);
            },
            onFinal: (text) => {
                lastSpeechRef.current = Date.now();
                hasSpeechRef.current = true;
                setTranscript('');
                setFullTranscript(prev => prev + text + ' ');
            },
            onError: (code) => {
                const message = describeError(code);
                if (!message) return;
                console.error('Speech error:', code);
                setStatus('error');
                setAiMessage(message);
                // Leaving status on 'listening' after a fatal error was why the
                // button kept showing "Tap to Send" while nothing was captured.
                if (silenceTimerRef.current) clearInterval(silenceTimerRef.current);
            },
            onEnd: () => {
                if (silenceTimerRef.current) clearInterval(silenceTimerRef.current);
            },
        });
    }, []);

    const stopRecording = useCallback(() => {
        sessionRef.current?.stop();
        sessionRef.current = null;
        setStatus('idle');
    }, []);

    const sendMessage = useCallback(async (directText?: string | unknown) => {
        const messageText = (typeof directText === 'string' ? directText : '') || (fullTranscript + transcript).trim();

        if (!messageText) {
            setAiMessage("I didn't hear anything. Please try again.");
            return;
        }

        stopRecording();
        setStatus('processing');
        setAiMessage('Processing...');

        // Clear transcript immediately when sending
        setTranscript('');
        setFullTranscript('');

        try {
            // Ask the Supabase client for the session rather than reaching into
            // web storage directly. secureStorage routes native platforms to
            // Capacitor Preferences (Keychain / EncryptedSharedPreferences), so
            // the old sessionStorage/localStorage probes found nothing on device
            // and only worked because of this fallback anyway. getSession also
            // refreshes an expired token, which the raw reads never did.
            let accessToken: string | null = null;
            try {
                const { data: sessionData } = await supabase.auth.getSession();
                accessToken = sessionData?.session?.access_token || null;
            } catch (e) {
                console.error('Voice: failed to read session', e);
            }

            if (!accessToken) {
                setStatus('error');
                setAiMessage('Please log in to use voice commands.');
                speak("You need to be logged in to use voice commands.", false);
                return;
            }

            // Direct fetch to avoid Supabase client cross-origin frame issues
            const res = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-voice-command`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${accessToken}`,
                        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                    },
                    body: JSON.stringify({
                        query: messageText,
                        conversationHistory: conversationHistory,
                        accumulatedData: accumulatedData
                    })
                }
            );

            if (!res.ok) {
                const errBody = await res.json().catch(() => ({}));
                throw new Error(errBody.error || `Voice command failed (${res.status})`);
            }

            const data = await res.json();
            const { speak: response, action, data: responseData } = data;

            // Update conversation history
            setConversationHistory(prev => [
                ...prev,
                { role: 'user', content: messageText },
                { role: 'assistant', content: response }
            ]);

            // Merge accumulated data
            if (responseData) {
                setAccumulatedData(prev => ({ ...prev, ...responseData }));
            }

            // Display and speak response
            setAiMessage(response);

            // Handle different actions
            await handleAction(action, { ...accumulatedData, ...responseData }, response);

        } catch (err) {
            console.error('Voice AI error:', err);
            setStatus('error');
            setAiMessage("Something went wrong. Let's try again.");
            speak("Sorry, I had trouble with that. Could you try again?", true);
        }
    }, [fullTranscript, transcript, conversationHistory, accumulatedData, stopRecording]);

    // Keep sendMessageRef current for silence auto-send
    useEffect(() => {
        sendMessageRef.current = () => sendMessage();
    }, [sendMessage]);

    const handleAction = async (action: string, data: any, responseText: string) => {
        const speakThenDo = (text: string, fn: () => void) => {
            speak(text, false);
            // Run action after a short delay so speech starts, but don't depend on onend
            setTimeout(fn, 1500);
        };

        switch (action) {
            case 'create_quote':
                setStatus('success');
                speakThenDo(responseText, () => createQuote(data));
                break;

            case 'create_invoice':
                setStatus('success');
                speakThenDo(responseText, () => createInvoice(data));
                break;

            case 'create_client':
                setStatus('success');
                speakThenDo(responseText, () => createClient(data));
                break;

            case 'schedule_job':
                setStatus('success');
                speakThenDo(responseText, () => createJob(data));
                break;

            case 'find_client':
                const searchTerm = data.search_name || data.client_name || data.name || '';
                if (!searchTerm) {
                    speak(responseText, true);
                    break;
                }
                setStatus('processing');
                try {
                    // Fuzzy + phonetic search: handles Mohammad→Muhammad, Sean→Shaun, etc.
                    const { data: matches, error: searchErr } = await supabase
                        .rpc('search_clients_fuzzy', {
                            p_user_id: user?.id || '',
                            p_search_term: searchTerm,
                            p_limit: 5
                        });

                    if (searchErr) throw searchErr;

                    if (matches && matches.length === 1) {
                        setStatus('success');
                        const matchNote = matches[0].match_type !== 'exact' && matches[0].match_type !== 'contains'
                            ? ` (closest match)` : '';
                        setAiMessage(`Found ${matches[0].name}${matchNote}! Opening now.`);
                        speakThenDo(`Found ${matches[0].name}!`, () => {
                            navigate(`/clients/${matches[0].id}`);
                            setOpen(false);
                        });
                    } else if (matches && matches.length > 1) {
                        // If top match is high confidence, go directly
                        if (matches[0].confidence >= 0.8) {
                            setStatus('success');
                            setAiMessage(`Found ${matches[0].name}! Opening now.`);
                            speakThenDo(`Found ${matches[0].name}!`, () => {
                                navigate(`/clients/${matches[0].id}`);
                                setOpen(false);
                            });
                        } else {
                            setStatus('success');
                            const names = matches.slice(0, 3).map((m: any) => m.name).join(', ');
                            setAiMessage(`Found ${matches.length} possible matches: ${names}`);
                            speakThenDo(`Found ${matches.length} possible matches. Here they are.`, () => {
                                navigate(`/clients?search=${encodeURIComponent(searchTerm)}`);
                                setOpen(false);
                            });
                        }
                    } else {
                        setStatus('error');
                        setAiMessage(`No clients found matching "${searchTerm}". Want me to add them?`);
                        speak(`Sorry, couldn't find anyone called ${searchTerm}. Want me to add them as a new client?`, true);
                    }
                } catch {
                    // Fallback to basic search if RPC not available
                    setStatus('success');
                    speakThenDo(responseText, () => {
                        navigate(`/clients?search=${encodeURIComponent(searchTerm)}`);
                        setOpen(false);
                    });
                }
                break;

            case 'mark_paid': {
                setStatus('processing');
                try {
                    // Resolve to ONE concrete invoice before writing anything.
                    //
                    // The previous implementation issued
                    //   .update({status:'paid'}).ilike('invoice_number', `%${n}%`)
                    // with no limit, so "mark invoice 12 as paid" silently also
                    // marked INV-120, INV-1234 and INV-3120 as paid in the same
                    // statement. Marking money received is not reversible from
                    // the user's point of view, so this path now reads first,
                    // refuses to guess when ambiguous, and names what it changed.
                    const unpaid = () => supabase
                        .from('invoices')
                        .select('id, invoice_number, total, status')
                        .eq('user_id', user?.id || '')
                        .is('deleted_at', null)
                        .neq('status', 'paid');

                    let candidates: Array<{ id: string; invoice_number: string; total: number | null; status: string | null }> = [];

                    if (data.invoice_id) {
                        const { data: rows } = await unpaid().eq('id', data.invoice_id);
                        candidates = rows || [];
                    } else if (data.invoice_number) {
                        // Exact match wins outright; only widen if it finds nothing.
                        const { data: exact } = await unpaid().eq('invoice_number', data.invoice_number);
                        if (exact && exact.length > 0) {
                            candidates = exact;
                        } else {
                            const { data: fuzzy } = await unpaid()
                                .ilike('invoice_number', `%${data.invoice_number}%`)
                                .limit(10);
                            candidates = fuzzy || [];
                        }
                    } else if (data.client_name) {
                        const { data: clients } = await supabase
                            .from('clients').select('id, name').eq('user_id', user?.id || '')
                            .ilike('name', `%${data.client_name}%`).limit(5);

                        if (!clients || clients.length === 0) {
                            setStatus('error');
                            setAiMessage(`No client found matching "${data.client_name}".`);
                            speak(`I couldn't find a client called ${data.client_name}.`, true);
                            break;
                        }

                        const { data: rows } = await unpaid()
                            .in('client_id', clients.map(c => c.id))
                            .order('created_at', { ascending: false })
                            .limit(10);
                        candidates = rows || [];
                    } else {
                        speak(responseText, true);
                        break;
                    }

                    if (candidates.length === 0) {
                        // Distinguish "doesn't exist" from "already paid" — the
                        // query above deliberately excludes paid invoices.
                        let alreadyPaid = false;
                        if (data.invoice_number) {
                            const { data: paid } = await supabase
                                .from('invoices').select('id')
                                .eq('user_id', user?.id || '')
                                .eq('status', 'paid')
                                .ilike('invoice_number', `%${data.invoice_number}%`)
                                .limit(1);
                            alreadyPaid = !!paid?.length;
                        }
                        setStatus('error');
                        const msg = alreadyPaid
                            ? `That invoice is already marked as paid.`
                            : `I couldn't find an unpaid invoice matching that.`;
                        setAiMessage(msg);
                        speak(msg, true);
                        break;
                    }

                    if (candidates.length > 1) {
                        // Never guess which invoice got paid. Hand the choice back.
                        const list = candidates.slice(0, 3).map(c => c.invoice_number).join(', ');
                        setStatus('error');
                        setAiMessage(
                            `That matches ${candidates.length} unpaid invoices (${list}). ` +
                            `Which one? Say the full invoice number.`
                        );
                        speak(
                            `I found ${candidates.length} unpaid invoices matching that. ` +
                            `Which one did you mean?`,
                            true
                        );
                        break;
                    }

                    const target = candidates[0];
                    const { error: payErr } = await supabase
                        .from('invoices')
                        .update({
                            status: 'paid',
                            // Keep the record internally consistent: status alone
                            // left amount_paid and paid_at stale.
                            amount_paid: target.total ?? 0,
                            paid_at: new Date().toISOString(),
                        })
                        .eq('id', target.id); // primary key — exactly one row

                    if (payErr) throw payErr;

                    setStatus('success');
                    const confirmation =
                        `Marked ${target.invoice_number} as paid — ${formatCurrency(target.total)}.`;
                    setAiMessage(confirmation);
                    speakThenDo(confirmation, () => {
                        navigate('/invoices');
                        setOpen(false);
                    });
                } catch (err) {
                    console.error('mark_paid error:', err);
                    setStatus('error');
                    setAiMessage('Failed to update invoice.');
                    speak("Sorry, had trouble marking that invoice as paid.", true);
                }
                break;
            }

            case 'complete_job':
                setStatus('processing');
                try {
                    if (data.job_id) {
                        await supabase.from('jobs').update({ status: 'completed' }).eq('id', data.job_id).eq('user_id', user?.id || '');
                        setStatus('success');
                        speakThenDo(responseText, () => { navigate('/jobs'); setOpen(false); });
                    } else if (data.client_name || data.job_title) {
                        let jobQuery = supabase.from('jobs').select('id').eq('user_id', user?.id || '').neq('status', 'completed');
                        if (data.client_name) {
                            const { data: clients } = await supabase
                                .from('clients').select('id').eq('user_id', user?.id || '')
                                .ilike('name', `%${data.client_name}%`).limit(1);
                            if (clients?.[0]) {
                                jobQuery = jobQuery.eq('client_id', clients[0].id);
                            } else {
                                // Bail out rather than silently dropping the filter —
                                // otherwise "complete Tom's job" with no client named
                                // Tom completes the most recent job for ANYONE.
                                setStatus('error');
                                setAiMessage(`No client found matching "${data.client_name}".`);
                                speak(`I couldn't find a client called ${data.client_name}.`, true);
                                break;
                            }
                        }
                        if (data.job_title) jobQuery = jobQuery.ilike('title', `%${data.job_title}%`);
                        const { data: jobs } = await jobQuery.order('created_at', { ascending: false }).limit(1);
                        if (jobs?.[0]) {
                            await supabase.from('jobs').update({ status: 'completed' }).eq('id', jobs[0].id);
                            setStatus('success');
                            speakThenDo(responseText, () => { navigate('/jobs'); setOpen(false); });
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
                    speak("Sorry, had trouble marking that job as complete.", true);
                }
                break;

            case 'update_status':
                setStatus('processing');
                try {
                    const table = data.entity_type === 'invoice' ? 'invoices' : 'jobs';
                    const newStatus = data.new_status || 'in_progress';
                    if (data.entity_id) {
                        await supabase.from(table).update({ status: newStatus }).eq('id', data.entity_id).eq('user_id', user?.id || '');
                        setStatus('success');
                        speakThenDo(responseText, () => { navigate(`/${table}`); setOpen(false); });
                    } else {
                        speak(responseText, true);
                    }
                } catch {
                    setStatus('error');
                    speak("Sorry, had trouble updating that status.", true);
                }
                break;

            case 'navigate':
                speakThenDo(responseText, () => {
                    if (data.destination) navigate(data.destination);
                    setOpen(false);
                });
                break;

            case 'ask_details':
            default:
                // Continue conversation
                speak(responseText, true);
                break;
        }
    };

    // Helper: Find existing client by name or create new one
    const findOrCreateClient = async (clientName: string, clientData?: any): Promise<string | null> => {
        if (!user || !clientName) return null;

        // Search for existing client (case-insensitive partial match)
        const { data: existingClients } = await supabase
            .from('clients')
            .select('id, name')
            .eq('user_id', user.id)
            .ilike('name', `%${clientName}%`)
            .limit(1);

        if (existingClients && existingClients.length > 0) {
            return existingClients[0].id;
        }

        // Create new client if not found
        const { data: newClient, error } = await supabase
            .from('clients')
            .insert({
                user_id: user.id,
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
            toast({ title: "New client added!", description: clientName });
            return newClient.id;
        }

        return null;
    };

    const createQuote = async (data: any) => {
        if (!user) return;
        try {
            // Step 1: Find or create the client
            let clientId: string | null = null;
            if (data.client_name) {
                clientId = await findOrCreateClient(data.client_name, data);
            }

            // Step 2: Create the quote with client_id linked
            const { data: quote, error } = await supabase
                .from('quotes')
                .insert({
                    user_id: user.id,
                    client_id: clientId, // Link to client!
                    quote_number: `Q-${Date.now().toString().slice(-6)}`,
                    title: data.client_name ? `Quote for ${data.client_name}` : 'Voice Quote',
                    status: 'draft',
                    total: data.total || 0,
                    valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                    notes: data.notes || null,
                })
                .select()
                .single();

            if (error) console.error('Create quote error:', error.message, error.details);

            // Step 3: Add line items if any
            if (quote && data.items?.length > 0) {
                const items = data.items.map((item: any) => ({
                    quote_id: quote.id,
                    description: item.description || 'Service',
                    quantity: item.quantity || 1,
                    unit_price: item.price || 0,
                    total: (item.quantity || 1) * (item.price || 0)
                }));
                await supabase.from('quote_line_items').insert(items);
            }

            if (quote) {
                setOpen(false);
                toast({
                    title: "Quote Created! ✨",
                    description: `${data.client_name ? `For ${data.client_name} - ` : ''}${formatCurrency(data.total || 0)}`
                });
                navigate(`/quotes/${quote.id}`);
            }
        } catch (err) {
            console.error('Create quote error:', err);
            toast({ title: "Failed to create quote", variant: "destructive" });
        }
    };

    const createInvoice = async (data: any) => {
        if (!user) return;
        try {
            // Find or create the client
            let clientId: string | null = null;
            if (data.client_name) {
                clientId = await findOrCreateClient(data.client_name, data);
            }

            const { data: invoice, error } = await supabase
                .from('invoices')
                .insert({
                    user_id: user.id,
                    client_id: clientId,
                    invoice_number: `INV-${Date.now().toString().slice(-6)}`,
                    title: data.client_name ? `Invoice for ${data.client_name}` : 'Voice Invoice',
                    status: 'draft',
                    total: data.total || 0,
                })
                .select()
                .single();

            if (error) console.error('Create invoice error:', error.message, error.details);

            // Add line items if any
            if (invoice && data.items?.length > 0) {
                const items = data.items.map((item: any) => ({
                    invoice_id: invoice.id,
                    description: item.description || 'Service',
                    quantity: item.quantity || 1,
                    unit_price: item.price || 0,
                    total: (item.quantity || 1) * (item.price || 0)
                }));
                await supabase.from('invoice_line_items').insert(items);
            }

            if (invoice) {
                setOpen(false);
                toast({
                    title: "Invoice Created!",
                    description: `${data.client_name ? `For ${data.client_name}` : ''}`
                });
                navigate(`/invoices/${invoice.id}`);
            }
        } catch (err) {
            console.error('Create invoice error:', err);
            toast({ title: "Failed to create invoice", variant: "destructive" });
        }
    };

    const createClient = async (data: any) => {
        if (!user) return;
        try {
            const { data: client, error } = await supabase
                .from('clients')
                .insert({
                    user_id: user.id,
                    name: data.client_name || 'New Client',
                    phone: data.client_phone || null,
                    email: data.client_email || null,
                    address: data.client_address || null,
                })
                .select()
                .single();

            if (error) console.error('Create client error:', error.message, error.details);
            if (client) {
                setOpen(false);
                toast({ title: "Client Added! 👤" });
                navigate(`/clients/${client.id}`);
            }
        } catch (err) {
            console.error('Create client error:', err);
            toast({ title: "Failed to add client", variant: "destructive" });
        }
    };

    const createJob = async (data: any) => {
        if (!user) return;
        try {
            // Find or create the client
            let clientId: string | null = null;
            if (data.client_name) {
                clientId = await findOrCreateClient(data.client_name, data);
            }

            const { data: job, error } = await supabase
                .from('jobs')
                .insert({
                    user_id: user.id,
                    client_id: clientId, // Link to client!
                    title: data.title || (data.client_name ? `Job for ${data.client_name}` : 'New Job'),
                    description: data.description || '',
                    status: 'scheduled',
                    scheduled_date: data.scheduled_date || new Date().toISOString(),
                    site_address: data.site_address || data.client_address || '',
                })
                .select()
                .single();

            if (error) console.error('Create job error:', error.message, error.details);

            if (job) {
                setOpen(false);
                toast({
                    title: "Job Scheduled! 📅",
                    description: `${data.client_name ? `For ${data.client_name}` : data.title || ''}`
                });
                navigate(`/jobs/${job.id}`);
            }
        } catch (err) {
            console.error('Create job error:', err);
            toast({ title: "Failed to create job", variant: "destructive" });
        }
    };

    const speak = (text: string, autoListen: boolean) => {
        cancelSpeech();

        let ended = false;
        const onComplete = () => {
            if (ended) return;
            ended = true;
            setStatus('idle');
            if (autoListen && open) {
                setTimeout(() => { void startRecording(); }, 500);
            }
        };

        if (!text) {
            onComplete();
            return;
        }

        setStatus('speaking');
        // speakText picks a voice matching the device locale rather than the old
        // hardcoded en-AU / Apple-voice-name list.
        speakText(text, { onEnd: onComplete });

        // Fallback: onend is unreliable in mobile WebViews. ~150wpm => ~400ms/word.
        const wordCount = text.split(/\s+/).length;
        const estimatedDuration = Math.max(1500, wordCount * 400 + 500);
        setTimeout(onComplete, estimatedDuration);
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>{children}</SheetTrigger>
            <SheetContent
                side="bottom"
                className="rounded-t-[2rem] border-t-0 bg-gradient-to-b from-background to-background/95 backdrop-blur-2xl h-[75vh] flex flex-col p-0 overflow-hidden"
            >
                {/* Hidden accessibility */}
                <SheetHeader className="sr-only">
                    <SheetTitle>Voice Assistant</SheetTitle>
                    <SheetDescription>AI Voice Assistant</SheetDescription>
                </SheetHeader>

                {/* Header - Custom Close Button Removed (relies on default SheetClose) */}
                <div className="flex items-center justify-between px-6 py-6 border-b border-white/10">
                    <div className="flex items-center gap-4">
                        <div className={cn(
                            "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 shadow-lg",
                            status === 'listening' ? "bg-red-500/20 ring-2 ring-red-500/50 scale-110" :
                                status === 'processing' ? "bg-blue-500/20 ring-2 ring-blue-500/50 animate-pulse" :
                                    status === 'speaking' ? "bg-green-500/20 ring-2 ring-green-500/50" :
                                        "bg-primary/10 ring-1 ring-primary/30"
                        )}>
                            {status === 'listening' ? <Mic className="w-6 h-6 text-red-500 animate-pulse" /> :
                                status === 'processing' ? <Loader2 className="w-6 h-6 text-blue-500 animate-spin" /> :
                                    status === 'speaking' ? <Volume2 className="w-6 h-6 text-green-500 animate-bounce" /> :
                                        <Sparkles className="w-6 h-6 text-primary" />}
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-foreground tracking-tight">Voice Assistant</h3>
                            <p className="text-xs font-medium text-muted-foreground/80 uppercase tracking-wider">
                                {status === 'listening' ? `Listening (${formatTime(recordingTime)})` :
                                    status === 'processing' ? 'Thinking...' :
                                        status === 'speaking' ? 'Speaking...' :
                                            'Your Helping Hand'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8 bg-gradient-to-b from-transparent to-background/50">
                    {/* AI Message - Left Side */}
                    <div className="flex gap-4 animate-in slide-in-from-left-5 duration-500">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shrink-0 shadow-md transform translate-y-2">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <div className={cn(
                            "flex-1 p-5 rounded-2xl rounded-tl-none shadow-sm backdrop-blur-sm transition-all duration-300",
                            status === 'success' ? "bg-green-500/10 border border-green-500/30" :
                                status === 'error' ? "bg-red-500/10 border border-red-500/30" :
                                    "bg-card/80 border border-border/50"
                        )}>
                            <p className={cn(
                                "text-lg leading-relaxed font-medium",
                                status === 'success' ? "text-green-700 dark:text-green-300" :
                                    status === 'error' ? "text-red-700 dark:text-red-300" :
                                        "text-foreground"
                            )}>
                                {aiMessage || "Hey! Need a hand with a quote, invoice, or job today?"}
                            </p>
                        </div>
                    </div>

                    {/* User Transcript - Right Side */}
                    {(transcript || fullTranscript) && (
                        <div className="flex gap-4 justify-end animate-in slide-in-from-right-5 duration-300">
                            <div className="flex-1 max-w-[85%] p-5 rounded-2xl rounded-tr-none bg-gradient-to-br from-primary to-primary/90 text-primary-foreground shadow-md">
                                <p className="text-lg leading-relaxed">
                                    {fullTranscript}<span className="opacity-70 animate-pulse">{transcript}</span>
                                </p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0 shadow-sm border border-border transform translate-y-2">
                                <div className="w-5 h-5 rounded-full bg-foreground/20" />
                            </div>
                        </div>
                    )}

                    {/* Quick Suggestions (when idle) */}
                    {status === 'idle' && !transcript && !fullTranscript && conversationHistory.length === 0 && (
                        <div className="space-y-6 pt-8 animate-in fade-in duration-700 delay-200">
                            <p className="text-sm font-medium text-muted-foreground text-center uppercase tracking-widest opacity-70">
                                I can help you with
                            </p>
                            <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
                                {[
                                    { label: "Create a new quote", command: "Create a new quote" },
                                    { label: "Add a client", command: "Add a new client" },
                                    { label: "Search for a client", command: "Find client" },
                                    { label: "New Invoice", command: "Create a new invoice" },
                                ].map((hint) => (
                                    <button
                                        key={hint.label}
                                        onClick={() => sendMessage(hint.command)}
                                        className="px-4 py-3 text-sm font-medium bg-card/50 hover:bg-primary/5 border border-border/50 hover:border-primary/30 rounded-xl transition-all hover:scale-105 hover:shadow-sm text-center"
                                    >
                                        {hint.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Controls */}
                <div className="border-t border-border/10 bg-background/60 backdrop-blur-xl px-6 py-8 pb-10">
                    <div className="flex items-center justify-center gap-6">
                        {status === 'listening' ? (
                            <>
                                <Button
                                    variant="outline"
                                    size="lg"
                                    onClick={stopRecording}
                                    className="rounded-full h-16 px-8 gap-2 border-2 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
                                >
                                    <MicOff className="w-5 h-5" />
                                    Cancel
                                </Button>

                                <Button
                                    size="lg"
                                    onClick={() => sendMessage()}
                                    disabled={!transcript && !fullTranscript}
                                    className="rounded-full h-16 w-16 p-0 bg-primary shadow-lg shadow-primary/25 hover:scale-110 transition-transform hover:shadow-xl"
                                >
                                    <Send className="w-6 h-6 ml-0.5" />
                                </Button>
                            </>
                        ) : status === 'processing' || status === 'speaking' ? (
                            <div className="flex flex-col items-center gap-2 text-muted-foreground animate-pulse">
                                <div className="h-16 w-16 rounded-full border-2 border-primary/20 border-t-primary flex items-center justify-center animate-spin">
                                    <Sparkles className="w-6 h-6 text-primary" />
                                </div>
                            </div>
                        ) : (
                            <Button
                                size="lg"
                                onClick={() => { void startRecording(); }}
                                disabled={!speechSupported}
                                className={cn(
                                    "rounded-full h-24 w-24 p-0 shadow-2xl transition-all duration-300 group relative",
                                    "bg-gradient-to-b from-primary to-primary/90 hover:scale-105 active:scale-95",
                                    "border-[6px] border-background ring-1 ring-border",
                                    "disabled:opacity-40 disabled:hover:scale-100"
                                )}
                            >
                                <div className="absolute inset-0 rounded-full bg-white/20 animate-ping opacity-0 group-hover:opacity-20" />
                                {speechSupported
                                    ? <Mic className="w-10 h-10 text-primary-foreground drop-shadow-md" />
                                    : <MicOff className="w-10 h-10 text-primary-foreground drop-shadow-md" />}
                            </Button>
                        )}
                    </div>

                    {/* Helper Text */}
                    <p className="text-center text-xs font-medium text-muted-foreground/70 mt-6 tracking-wide">
                        {!speechSupported
                            ? "Voice input isn't available on this device — you can still type or use the forms."
                            : status === 'listening'
                                ? "Speak naturally. I'll send automatically when you pause."
                                : "Tap the mic to start speaking"}
                    </p>
                </div>
            </SheetContent>
        </Sheet>
    );
}
