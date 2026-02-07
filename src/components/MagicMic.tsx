import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Loader2, StopCircle, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

declare global {
    interface Window {
        SpeechRecognition: any;
        webkitSpeechRecognition: any;
    }
}

type MicStatus = 'idle' | 'listening' | 'processing';

export function MagicMic() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { user } = useAuth();

    const [status, setStatus] = useState<MicStatus>('idle');
    const [transcript, setTranscript] = useState('');
    const [fullTranscript, setFullTranscript] = useState('');

    const recognitionRef = useRef<any>(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (recognitionRef.current) {
                try { recognitionRef.current.stop(); } catch (e) { }
            }
        };
    }, []);

    const startListening = useCallback(() => {
        console.log('Voice: Starting listening...');
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            console.error('Voice: SpeechRecognition API not supported');
            toast({
                title: "Voice not supported",
                description: "Use Chrome or Safari for voice input",
                variant: "destructive"
            });
            return;
        }

        // Reset transcripts
        setTranscript('');
        setFullTranscript('');

        try {
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-AU';
            recognition.maxAlternatives = 1;

            recognition.onstart = () => {
                console.log('Voice: Recognition started');
                setStatus('listening');
                toast({ title: "🎙️ Listening...", description: "Speak your quote details" });
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

                console.log('Voice: Result', { interim, final });
                setTranscript(interim);
                if (final) {
                    setFullTranscript(prev => prev + final);
                }
            };

            recognition.onerror = (event: any) => {
                console.error('Voice: Recognition error', event.error);
                if (event.error !== 'no-speech' && event.error !== 'aborted') {
                    toast({
                        title: "Voice error",
                        description: event.error === 'not-allowed'
                            ? "Microphone permission denied"
                            : `Error: ${event.error}`,
                        variant: "destructive"
                    });
                    setStatus('idle');
                }
            };

            recognition.onend = () => {
                console.log('Voice: Recognition ended');
                // Recognition ended but we might still want to process
                if (status === 'listening') {
                    // Don't auto-reset, let user click stop
                }
            };

            recognitionRef.current = recognition;
            recognition.start();
        } catch (e) {
            console.error('Voice: Failed to start recognition', e);
            toast({ title: "Voice Error", description: "Could not start microphone", variant: "destructive" });
        }
    }, [toast, status]);

    const stopListening = useCallback(() => {
        console.log('Voice: Stopping listening');
        if (recognitionRef.current) {
            try { recognitionRef.current.stop(); } catch (e) { }
        }
        setStatus('idle');
    }, []);

    const processVoiceCommand = useCallback(async () => {
        const messageText = (fullTranscript + transcript).trim();
        console.log('Voice: Processing command:', messageText);

        if (!messageText) {
            toast({
                title: "No voice input",
                description: "Please speak your command first",
                variant: "destructive"
            });
            return;
        }

        // Stop listening
        if (recognitionRef.current) {
            try { recognitionRef.current.stop(); } catch (e) { }
        }

        setStatus('processing');
        toast({ title: "🔮 Processing...", description: "Understanding your command" });

        try {
            if (!user) {
                console.warn('Voice: User not logged in');
                throw new Error("Please log in first");
            }

            // Read session directly from sessionStorage to avoid cross-origin frame issues
            const storageKey = `sb-${import.meta.env.VITE_SUPABASE_URL.split('//')[1].split('.')[0]}-auth-token`;
            const raw = sessionStorage.getItem(storageKey);
            const accessToken = raw ? JSON.parse(raw)?.access_token : null;

            if (!accessToken) {
                console.warn('Voice: No valid session token');
                throw new Error("Session expired - please log in again");
            }

            console.log('Voice: Invoking Edge Function with auth token...');
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
                        conversationHistory: [],
                        accumulatedData: {}
                    })
                }
            );

            if (!res.ok) {
                const errBody = await res.json().catch(() => ({}));
                console.error('Voice: Edge Function error', errBody);
                throw new Error(errBody.error || `Voice command failed (${res.status})`);
            }

            const data = await res.json();
            console.log('Voice: Response received', data);
            const { speak: responseText, action, data: responseData } = data;

            // Speak the response using text-to-speech for premium feel
            if (responseText && 'speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(responseText);
                utterance.rate = 1.05;
                utterance.pitch = 1.0;
                utterance.lang = 'en-AU';
                window.speechSynthesis.speak(utterance);
            }

            // Handle different actions from the AI
            switch (action) {
                case 'create_quote':
                    console.log('Voice: Action create_quote');
                    toast({ title: "✨ Creating Quote...", description: responseText });
                    await createQuoteFromVoice(responseData);
                    break;

                case 'create_invoice':
                    console.log('Voice: Action create_invoice');
                    toast({ title: "💰 Creating Invoice...", description: responseText });
                    await createInvoiceFromVoice(responseData);
                    break;

                case 'create_client':
                    console.log('Voice: Action create_client');
                    toast({ title: "👤 Adding Client...", description: responseText });
                    await createClientFromVoice(responseData);
                    break;

                case 'schedule_job':
                    console.log('Voice: Action schedule_job');
                    toast({ title: "📅 Scheduling Job...", description: responseText });
                    await createJobFromVoice(responseData);
                    break;

                case 'find_client':
                    console.log('Voice: Action find_client');
                    toast({ title: "🔍 Searching...", description: responseText });
                    navigate(`/clients?search=${encodeURIComponent(responseData.search_name || '')}`);
                    break;

                case 'navigate':
                    console.log('Voice: Action navigate');
                    if (responseData.destination) {
                        toast({ title: "🚀 Navigating...", description: responseText });
                        navigate(responseData.destination);
                    }
                    break;

                case 'add_job_note':
                    console.log('Voice: Action add_job_note');
                    toast({
                        title: "📝 Note Added!",
                        description: responseData.note?.substring(0, 50) + (responseData.note?.length > 50 ? '...' : '')
                    });
                    // Note: In a real implementation, we would save this to the current job
                    // For now, show success and store in localStorage as pending note
                    if (responseData.note) {
                        const pendingNotes = JSON.parse(localStorage.getItem('pendingJobNotes') || '[]');
                        pendingNotes.push({ note: responseData.note, timestamp: new Date().toISOString() });
                        localStorage.setItem('pendingJobNotes', JSON.stringify(pendingNotes));
                    }
                    break;

                case 'send_document':
                    console.log('Voice: Action send_document');
                    toast({ title: "📤 Preparing to send...", description: responseText });
                    // Navigate to the appropriate document for sending
                    if (responseData.document_type === 'quote' && responseData.document_id) {
                        navigate(`/quotes/${responseData.document_id}?action=send`);
                    } else if (responseData.document_type === 'invoice' && responseData.document_id) {
                        navigate(`/invoices/${responseData.document_id}?action=send`);
                    }
                    break;

                case 'ask_details':
                    console.log('Voice: Action ask_details - continuing conversation');
                    toast({
                        title: "🎙️ Matey:",
                        description: responseText
                    });
                    break;

                case 'general_reply':
                default:
                    console.log('Voice: Action general_reply/default');
                    // Show conversational response
                    toast({
                        title: "🎙️ Matey:",
                        description: responseText
                    });
                    break;
            }

        } catch (error: any) {
            console.error('MagicMic Error:', error);
            toast({
                title: "Processing failed",
                description: error.message || "Please try again",
                variant: "destructive"
            });
        } finally {
            setStatus('idle');
            setTranscript('');
            setFullTranscript('');
        }
    }, [fullTranscript, transcript, user, navigate, toast]);

    // Helper: Create quote from voice data
    const createQuoteFromVoice = async (data: any) => {
        if (!user) return;

        try {
            // Find or create client
            let clientId: string | null = null;
            if (data.client_name) {
                const { data: existingClients } = await supabase
                    .from('clients')
                    .select('id, name')
                    .eq('user_id', user.id)
                    .ilike('name', `%${data.client_name}%`)
                    .limit(1);

                if (existingClients && existingClients.length > 0) {
                    clientId = existingClients[0].id;
                } else {
                    const { data: newClient } = await supabase
                        .from('clients')
                        .insert({
                            user_id: user.id,
                            name: data.client_name,
                            phone: data.client_phone || null,
                            email: data.client_email || null,
                        })
                        .select()
                        .single();

                    if (newClient) clientId = newClient.id;
                }
            }

            // Create quote
            const { data: quote, error: quoteError } = await supabase
                .from('quotes')
                .insert({
                    user_id: user.id,
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

            if (quoteError) throw quoteError;

            // Add line items if any
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

    // Helper: Create invoice from voice data
    const createInvoiceFromVoice = async (data: any) => {
        if (!user) return;

        try {
            let clientId: string | null = null;
            if (data.client_name) {
                const { data: existingClients } = await supabase
                    .from('clients')
                    .select('id')
                    .eq('user_id', user.id)
                    .ilike('name', `%${data.client_name}%`)
                    .limit(1);

                if (existingClients && existingClients.length > 0) {
                    clientId = existingClients[0].id;
                }
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

            if (invoice) {
                toast({
                    title: "Invoice Created! 💰",
                    description: `${data.client_name ? `For ${data.client_name}` : ''}`
                });
                navigate(`/invoices/${invoice.id}`);
            }
        } catch (err) {
            console.error('Create invoice error:', err);
            toast({ title: "Failed to create invoice", variant: "destructive" });
        }
    };

    // Helper: Create client from voice data
    const createClientFromVoice = async (data: any) => {
        if (!user) return;

        try {
            const { data: client } = await supabase
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
                toast({ title: "Client Added! 👤" });
                navigate(`/clients/${client.id}`);
            }
        } catch (err) {
            console.error('Create client error:', err);
            toast({ title: "Failed to add client", variant: "destructive" });
        }
    };

    // Helper: Create job from voice data
    const createJobFromVoice = async (data: any) => {
        if (!user) return;

        try {
            let clientId: string | null = null;
            if (data.client_name) {
                const { data: existingClients } = await supabase
                    .from('clients')
                    .select('id')
                    .eq('user_id', user.id)
                    .ilike('name', `%${data.client_name}%`)
                    .limit(1);

                if (existingClients && existingClients.length > 0) {
                    clientId = existingClients[0].id;
                }
            }

            const { data: job } = await supabase
                .from('jobs')
                .insert({
                    user_id: user.id,
                    client_id: clientId,
                    title: data.title || (data.client_name ? `Job for ${data.client_name}` : 'New Job'),
                    description: data.description || '',
                    status: 'scheduled',
                    scheduled_date: data.scheduled_date || new Date().toISOString(),
                    site_address: data.site_address || data.client_address || '',
                })
                .select()
                .single();

            if (job) {
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

    const handleClick = () => {
        if (status === 'idle') {
            startListening();
        } else if (status === 'listening') {
            processVoiceCommand();
        }
    };

    const handleCancel = () => {
        stopListening();
        setTranscript('');
        setFullTranscript('');
    };

    return (
        <>
            {/* Status Label */}
            {status === 'listening' && (fullTranscript || transcript) && (
                <div className="fixed bottom-[180px] right-6 left-6 p-3 bg-background/95 border border-border rounded-xl shadow-lg backdrop-blur-sm animate-in slide-in-from-bottom-4 z-50">
                    <p className="text-sm text-muted-foreground mb-1">You said:</p>
                    <p className="text-foreground font-medium">
                        {fullTranscript}
                        <span className="text-muted-foreground animate-pulse">{transcript}</span>
                    </p>
                </div>
            )}

            {/* Cancel Button (when listening) */}
            {status === 'listening' && (
                <Button
                    onClick={handleCancel}
                    size="icon"
                    variant="outline"
                    className="fixed bottom-24 right-24 w-12 h-12 rounded-full shadow-lg z-50 border-2"
                >
                    <StopCircle className="w-5 h-5 text-destructive" />
                </Button>
            )}

            {/* Main Magic Mic Button */}
            <Button
                onClick={handleClick}
                size="icon"
                className={cn(
                    "fixed bottom-24 right-5 w-16 h-16 rounded-full shadow-2xl z-50 transition-all duration-300 border-4 border-background/50 backdrop-blur-md",
                    status === 'listening'
                        ? "bg-green-500 hover:bg-green-600 shadow-green-500/50 animate-pulse scale-110"
                        : status === 'processing'
                            ? "bg-blue-500 hover:bg-blue-600 opacity-80 cursor-wait"
                            : "bg-primary hover:bg-primary/90 shadow-primary/30"
                )}
                disabled={status === 'processing'}
            >
                {status === 'processing' ? (
                    <Loader2 className="w-8 h-8 animate-spin text-white" />
                ) : status === 'listening' ? (
                    <Send className="w-7 h-7 text-white" />
                ) : (
                    <Mic className="w-7 h-7 text-white" />
                )}
            </Button>

            {/* Helper Label */}
            {status === 'idle' && (
                <div className="fixed bottom-[160px] right-6 py-1.5 px-3 bg-foreground/80 text-background text-xs font-bold rounded-full animate-fade-in shadow-lg pointer-events-none backdrop-blur-sm">
                    Magic Mic
                </div>
            )}
            {status === 'listening' && (
                <div className="fixed bottom-[160px] right-6 py-1.5 px-3 bg-green-500 text-white text-xs font-bold rounded-full animate-pulse shadow-lg pointer-events-none">
                    Tap to Send
                </div>
            )}
        </>
    );
}
