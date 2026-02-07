import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from '@/components/ui/sheet';
import { Mic, MicOff, Sparkles, Loader2, Volume2, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';

interface VoiceCommandSheetProps {
    children: React.ReactNode;
}

declare global {
    interface Window {
        SpeechRecognition: any;
        webkitSpeechRecognition: any;
    }
}

// Premium Australian voice selection
const getAussieVoice = (): SpeechSynthesisVoice | null => {
    const voices = window.speechSynthesis.getVoices();
    const priority = ['Karen', 'Catherine', 'Tessa', 'Moira', 'Samantha', 'Victoria'];

    for (const name of priority) {
        const found = voices.find(v => v.name.includes(name));
        if (found) return found;
    }

    return voices.find(v => v.lang.includes('en-AU')) ||
        voices.find(v => v.lang.includes('en-GB') && v.name.toLowerCase().includes('female')) ||
        voices.find(v => v.lang.startsWith('en')) || null;
};

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

    const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);

    // Refs
    const recognitionRef = useRef<any>(null);
    const timerRef = useRef<any>(null);
    const silenceTimerRef = useRef<any>(null);
    const lastSpeechRef = useRef<number>(0);
    const hasSpeechRef = useRef<boolean>(false);
    const sendMessageRef = useRef<(() => void) | null>(null);

    // Keep sendMessageRef current for silence auto-send
    useEffect(() => {
        sendMessageRef.current = () => sendMessage();
    }, [sendMessage]);

    // Load voices
    useEffect(() => {
        const loadVoices = () => setSelectedVoice(getAussieVoice());
        loadVoices();
        window.speechSynthesis.onvoiceschanged = loadVoices;
        return () => { window.speechSynthesis.onvoiceschanged = null; };
    }, []);

    // Handle sheet open/close
    useEffect(() => {
        if (open) {
            resetConversation();
            setAiMessage("G'day mate! What can I help you with today?");
            setTimeout(() => speak("G'day! What can I help you with?", false), 500);
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
        if (recognitionRef.current) {
            try { recognitionRef.current.stop(); } catch (e) { }
        }
        if (timerRef.current) clearInterval(timerRef.current);
        if (silenceTimerRef.current) clearInterval(silenceTimerRef.current);
        window.speechSynthesis.cancel();
    };

    const resetConversation = () => {
        setStatus('idle');
        setTranscript('');
        setFullTranscript('');
        setConversationHistory([]);
        setAccumulatedData({});
        setRecordingTime(0);
    };

    const startRecording = useCallback(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            toast({ title: "Voice not supported", description: "Use Chrome or Safari", variant: "destructive" });
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-AU';
        recognition.maxAlternatives = 1;

        // Reset silence tracking
        hasSpeechRef.current = false;
        lastSpeechRef.current = 0;
        if (silenceTimerRef.current) clearInterval(silenceTimerRef.current);

        recognition.onstart = () => {
            setStatus('listening');
            setTranscript('');

            // Start silence detection: auto-send after 3s of silence (once speech has started)
            silenceTimerRef.current = setInterval(() => {
                if (hasSpeechRef.current && lastSpeechRef.current > 0) {
                    const silenceDuration = Date.now() - lastSpeechRef.current;
                    if (silenceDuration > 3000) {
                        // Auto-send after 3 seconds of silence
                        if (silenceTimerRef.current) clearInterval(silenceTimerRef.current);
                        sendMessageRef.current?.();
                    }
                }
            }, 500);
        };

        recognition.onresult = (event: any) => {
            let interim = '';
            let final = '';

            for (let i = 0; i < event.results.length; i++) {
                const result = event.results[i];
                if (result.isFinal) {
                    final += result[0].transcript + ' ';
                } else {
                    interim += result[0].transcript;
                }
            }

            // Track speech activity for silence detection
            lastSpeechRef.current = Date.now();
            if (interim || final) hasSpeechRef.current = true;

            setTranscript(interim);
            if (final) {
                setFullTranscript(prev => prev + final);
            }
        };

        recognition.onerror = (event: any) => {
            console.error('Speech error:', event.error);
            if (event.error !== 'no-speech' && event.error !== 'aborted') {
                setStatus('error');
                setAiMessage('Voice input error. Please try again.');
            }
        };

        recognition.onend = () => {
            if (silenceTimerRef.current) clearInterval(silenceTimerRef.current);
        };

        recognitionRef.current = recognition;
        recognition.start();
    }, []);

    const stopRecording = useCallback(() => {
        if (recognitionRef.current) {
            try { recognitionRef.current.stop(); } catch (e) { }
        }
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
            // Try multiple sources for auth token (sessionStorage, localStorage, then Supabase client)
            const storageKey = `sb-${import.meta.env.VITE_SUPABASE_URL.split('//')[1].split('.')[0]}-auth-token`;
            let accessToken: string | null = null;

            // Try sessionStorage first
            const sessionRaw = sessionStorage.getItem(storageKey);
            if (sessionRaw) {
                try { accessToken = JSON.parse(sessionRaw)?.access_token; } catch { }
            }

            // Fallback: try localStorage (some browsers/configs use this)
            if (!accessToken) {
                const localRaw = localStorage.getItem(storageKey);
                if (localRaw) {
                    try { accessToken = JSON.parse(localRaw)?.access_token; } catch { }
                }
            }

            // Final fallback: use Supabase client getSession
            if (!accessToken) {
                try {
                    const { data: sessionData } = await supabase.auth.getSession();
                    accessToken = sessionData?.session?.access_token || null;
                } catch { }
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
                        speak(`Sorry mate, couldn't find anyone called ${searchTerm}. Want me to add them as a new client?`, true);
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

            case 'mark_paid':
                setStatus('processing');
                try {
                    if (data.invoice_number || data.invoice_id) {
                        const query = supabase.from('invoices').update({ status: 'paid' }).eq('user_id', user?.id || '');
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
                        // Find most recent unpaid invoice for this client
                        const { data: clients } = await supabase
                            .from('clients').select('id').eq('user_id', user?.id || '')
                            .ilike('name', `%${data.client_name}%`).limit(1);
                        if (clients?.[0]) {
                            const { data: inv } = await supabase
                                .from('invoices').select('id').eq('client_id', clients[0].id)
                                .in('status', ['sent', 'draft', 'overdue']).order('created_at', { ascending: false }).limit(1);
                            if (inv?.[0]) {
                                await supabase.from('invoices').update({ status: 'paid' }).eq('id', inv[0].id);
                                setStatus('success');
                                speakThenDo(responseText, () => { navigate('/invoices'); setOpen(false); });
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
                    speak("Sorry, had trouble marking that invoice as paid.", true);
                }
                break;

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
                            if (clients?.[0]) jobQuery = jobQuery.eq('client_id', clients[0].id);
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
            console.log('Found existing client:', existingClients[0].name);
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

        if (newClient) {
            console.log('Created new client:', newClient.name);
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
                    description: `${data.client_name ? `For ${data.client_name} - ` : ''}$${data.total || 0}`
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

            const { data: invoice } = await supabase
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

            const { data: job } = await supabase
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
        window.speechSynthesis.cancel();

        if (!('speechSynthesis' in window) || !text) {
            // No speech synthesis - just handle the auto-listen directly
            if (autoListen && open) {
                setTimeout(() => startRecording(), 500);
            }
            return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.95;
        utterance.pitch = 1.05;
        utterance.volume = 1.0;
        if (selectedVoice) utterance.voice = selectedVoice;

        let ended = false;
        const onComplete = () => {
            if (ended) return;
            ended = true;
            if (autoListen && open) {
                setStatus('idle');
                setTimeout(() => startRecording(), 500);
            } else {
                setStatus('idle');
            }
        };

        utterance.onstart = () => setStatus('speaking');
        utterance.onend = onComplete;
        utterance.onerror = onComplete;

        // Fallback: if onend never fires (common in mobile/emulated browsers), force complete
        // Use word count (~150 wpm = ~400ms/word) instead of char length for better accuracy
        const wordCount = text.split(/\s+/).length;
        const estimatedDuration = Math.max(1500, wordCount * 400 + 500);
        setTimeout(onComplete, estimatedDuration);

        window.speechSynthesis.speak(utterance);
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
                    <SheetDescription>TradieMate AI Voice Assistant</SheetDescription>
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
                            <h3 className="font-bold text-lg text-foreground tracking-tight">Matey</h3>
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
                                {aiMessage || "G'day! I'm Matey. Need a hand with a quote, invoice, or job today?"}
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
                                onClick={startRecording}
                                className={cn(
                                    "rounded-full h-24 w-24 p-0 shadow-2xl transition-all duration-300 group relative",
                                    "bg-gradient-to-b from-primary to-primary/90 hover:scale-105 active:scale-95",
                                    "border-[6px] border-background ring-1 ring-border"
                                )}
                            >
                                <div className="absolute inset-0 rounded-full bg-white/20 animate-ping opacity-0 group-hover:opacity-20" />
                                <Mic className="w-10 h-10 text-primary-foreground drop-shadow-md" />
                            </Button>
                        )}
                    </div>

                    {/* Helper Text */}
                    <p className="text-center text-xs font-medium text-muted-foreground/70 mt-6 tracking-wide">
                        {status === 'listening'
                            ? "Speak naturally. I'll send automatically when you pause."
                            : "Tap the mic to start speaking"}
                    </p>
                </div>
            </SheetContent>
        </Sheet>
    );
}
