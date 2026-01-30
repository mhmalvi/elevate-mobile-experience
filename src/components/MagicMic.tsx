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
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
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

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-AU';
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
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

            setTranscript(interim);
            if (final) {
                setFullTranscript(prev => prev + final);
            }
        };

        recognition.onerror = (event: any) => {
            console.error('Speech recognition error:', event.error);
            if (event.error !== 'no-speech' && event.error !== 'aborted') {
                toast({
                    title: "Voice error",
                    description: event.error === 'not-allowed'
                        ? "Microphone permission denied"
                        : "Please try again",
                    variant: "destructive"
                });
                setStatus('idle');
            }
        };

        recognition.onend = () => {
            // Recognition ended but we might still want to process
            if (status === 'listening') {
                // Don't auto-reset, let user click stop
            }
        };

        recognitionRef.current = recognition;
        recognition.start();
    }, [toast, status]);

    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            try { recognitionRef.current.stop(); } catch (e) { }
        }
        setStatus('idle');
    }, []);

    const processVoiceCommand = useCallback(async () => {
        const messageText = (fullTranscript + transcript).trim();

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
            if (!user) throw new Error("Please log in first");

            // Call the voice command Edge Function
            const { data, error } = await supabase.functions.invoke('process-voice-command', {
                body: {
                    query: messageText,
                    conversationHistory: [],
                    accumulatedData: {}
                }
            });

            if (error) throw error;

            const { speak: responseText, action, data: responseData } = data;

            // Handle different actions from the AI
            switch (action) {
                case 'create_quote':
                    await createQuoteFromVoice(responseData);
                    break;

                case 'create_invoice':
                    await createInvoiceFromVoice(responseData);
                    break;

                case 'create_client':
                    await createClientFromVoice(responseData);
                    break;

                case 'schedule_job':
                    await createJobFromVoice(responseData);
                    break;

                case 'find_client':
                    toast({ title: "🔍 Searching...", description: responseText });
                    navigate(`/clients?search=${encodeURIComponent(responseData.search_name || '')}`);
                    break;

                case 'navigate':
                    if (responseData.destination) {
                        navigate(responseData.destination);
                    }
                    break;

                default:
                    // Continue conversation - show result
                    toast({
                        title: "🎙️ Matey says:",
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
