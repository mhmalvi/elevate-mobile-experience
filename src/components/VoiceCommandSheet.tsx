import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from '@/components/ui/sheet';
import { Mic, MicOff, Sparkles, Loader2, Volume2, CheckCircle, AlertCircle, X, Send, StopCircle, Clock } from 'lucide-react';
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

        recognition.onstart = () => {
            setStatus('listening');
            setTranscript('');
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
            console.error('Speech error:', event.error);
            if (event.error !== 'no-speech' && event.error !== 'aborted') {
                setStatus('error');
                setAiMessage('Voice input error. Please try again.');
            }
        };

        recognition.onend = () => {
            // Only process if we have content and were actively listening
            if (status === 'listening' && (fullTranscript || transcript)) {
                // Don't auto-process, let user click "Send"
            }
        };

        recognitionRef.current = recognition;
        recognition.start();
    }, [status, fullTranscript, transcript]);

    const stopRecording = useCallback(() => {
        if (recognitionRef.current) {
            try { recognitionRef.current.stop(); } catch (e) { }
        }
        setStatus('idle');
    }, []);

    const sendMessage = useCallback(async () => {
        const messageText = (fullTranscript + transcript).trim();

        if (!messageText) {
            setAiMessage("I didn't hear anything. Please try again.");
            return;
        }

        stopRecording();
        setStatus('processing');
        setAiMessage('Processing...');

        try {
            const { data, error } = await supabase.functions.invoke('process-voice-command', {
                body: {
                    query: messageText,
                    conversationHistory: conversationHistory,
                    accumulatedData: accumulatedData
                }
            });

            if (error) throw error;

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

            // Clear transcript for next input
            setTranscript('');
            setFullTranscript('');

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
    }, [fullTranscript, transcript, conversationHistory, accumulatedData]);

    const handleAction = async (action: string, data: any, responseText: string) => {
        switch (action) {
            case 'create_quote':
                setStatus('success');
                speak(responseText, false);
                setTimeout(() => createQuote(data), 2500);
                break;

            case 'create_invoice':
                setStatus('success');
                speak(responseText, false);
                setTimeout(() => createInvoice(data), 2500);
                break;

            case 'create_client':
                setStatus('success');
                speak(responseText, false);
                setTimeout(() => createClient(data), 2500);
                break;

            case 'schedule_job':
                setStatus('success');
                speak(responseText, false);
                setTimeout(() => createJob(data), 2500);
                break;

            case 'find_client':
                speak(responseText, false);
                setTimeout(() => {
                    setOpen(false);
                    navigate(`/clients?search=${encodeURIComponent(data.search_name || '')}`);
                }, 2000);
                break;

            case 'navigate':
                speak(responseText, false);
                setTimeout(() => {
                    setOpen(false);
                    if (data.destination) navigate(data.destination);
                }, 2000);
                break;

            case 'ask_details':
            default:
                // Continue conversation
                speak(responseText, true);
                break;
        }
    };

    const createQuote = async (data: any) => {
        if (!user) return;
        try {
            const { data: quote, error } = await supabase
                .from('quotes')
                .insert({
                    user_id: user.id,
                    quote_number: `Q-${Date.now().toString().slice(-6)}`,
                    title: data.client_name ? `Quote for ${data.client_name}` : 'Voice Quote',
                    status: 'draft',
                    total: data.total || 0,
                    valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                })
                .select()
                .single();

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
                toast({ title: "Quote Created! ✨", description: `$${data.total || 0}` });
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
            const { data: invoice, error } = await supabase
                .from('invoices')
                .insert({
                    user_id: user.id,
                    invoice_number: `INV-${Date.now().toString().slice(-6)}`,
                    title: data.client_name ? `Invoice for ${data.client_name}` : 'Voice Invoice',
                    status: 'draft',
                    total: data.total || 0,
                })
                .select()
                .single();

            if (invoice) {
                setOpen(false);
                toast({ title: "Invoice Created! 💰" });
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
            const { data: job, error } = await supabase
                .from('jobs')
                .insert({
                    user_id: user.id,
                    title: data.title || 'New Job',
                    description: data.description || '',
                    status: 'scheduled',
                    scheduled_date: data.scheduled_date || new Date().toISOString(),
                    site_address: data.site_address || data.client_address || '',
                })
                .select()
                .single();

            if (job) {
                setOpen(false);
                toast({ title: "Job Scheduled! 📅" });
                navigate(`/jobs/${job.id}`);
            }
        } catch (err) {
            console.error('Create job error:', err);
            toast({ title: "Failed to create job", variant: "destructive" });
        }
    };

    const speak = (text: string, autoListen: boolean) => {
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.95;
        utterance.pitch = 1.05;
        utterance.volume = 1.0;
        if (selectedVoice) utterance.voice = selectedVoice;

        utterance.onstart = () => setStatus('speaking');
        utterance.onend = () => {
            if (autoListen && open) {
                setStatus('idle');
                setTimeout(() => startRecording(), 500);
            } else {
                setStatus('idle');
            }
        };

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

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border/30">
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                            status === 'listening' ? "bg-red-500/20" :
                                status === 'processing' ? "bg-blue-500/20" :
                                    status === 'speaking' ? "bg-green-500/20" :
                                        "bg-primary/20"
                        )}>
                            {status === 'listening' ? <Mic className="w-5 h-5 text-red-500 animate-pulse" /> :
                                status === 'processing' ? <Loader2 className="w-5 h-5 text-blue-500 animate-spin" /> :
                                    status === 'speaking' ? <Volume2 className="w-5 h-5 text-green-500 animate-pulse" /> :
                                        <Sparkles className="w-5 h-5 text-primary" />}
                        </div>
                        <div>
                            <h3 className="font-semibold text-foreground">Matey</h3>
                            <p className="text-xs text-muted-foreground">
                                {status === 'listening' ? `Recording ${formatTime(recordingTime)} / ${formatTime(MAX_RECORD_TIME)}` :
                                    status === 'processing' ? 'Thinking...' :
                                        status === 'speaking' ? 'Speaking...' :
                                            'Ready to help'}
                            </p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="rounded-full">
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                    {/* AI Message */}
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                            <Sparkles className="w-4 h-4 text-primary" />
                        </div>
                        <div className={cn(
                            "flex-1 p-4 rounded-2xl rounded-tl-sm",
                            status === 'success' ? "bg-green-500/10 border border-green-500/20" :
                                status === 'error' ? "bg-red-500/10 border border-red-500/20" :
                                    "bg-muted/50"
                        )}>
                            <p className={cn(
                                "text-base leading-relaxed",
                                status === 'success' ? "text-green-700 dark:text-green-300" :
                                    status === 'error' ? "text-red-700 dark:text-red-300" :
                                        "text-foreground"
                            )}>
                                {aiMessage || "G'day! What can I help you with?"}
                            </p>
                        </div>
                    </div>

                    {/* User Transcript (while recording) */}
                    {(transcript || fullTranscript) && (
                        <div className="flex gap-3 justify-end animate-fade-in">
                            <div className="flex-1 max-w-[85%] p-4 rounded-2xl rounded-tr-sm bg-primary text-primary-foreground">
                                <p className="text-base leading-relaxed">
                                    {fullTranscript}{transcript && <span className="opacity-70">{transcript}</span>}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Quick Suggestions (when idle) */}
                    {status === 'idle' && !transcript && !fullTranscript && conversationHistory.length === 0 && (
                        <div className="space-y-3 pt-4">
                            <p className="text-sm text-muted-foreground text-center">Try saying:</p>
                            <div className="flex flex-wrap justify-center gap-2">
                                {[
                                    "Create a quote for...",
                                    "Add a new client",
                                    "Schedule a job for tomorrow",
                                    "Find client John Smith"
                                ].map((hint) => (
                                    <span key={hint} className="px-3 py-1.5 text-xs bg-muted/50 rounded-full text-muted-foreground">
                                        "{hint}"
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Controls */}
                <div className="border-t border-border/30 bg-background/80 backdrop-blur px-6 py-5">
                    <div className="flex items-center justify-center gap-4">
                        {status === 'listening' ? (
                            <>
                                {/* Stop Recording */}
                                <Button
                                    variant="outline"
                                    size="lg"
                                    onClick={stopRecording}
                                    className="rounded-full h-14 px-6 gap-2"
                                >
                                    <MicOff className="w-5 h-5" />
                                    Cancel
                                </Button>

                                {/* Send Button */}
                                <Button
                                    size="lg"
                                    onClick={sendMessage}
                                    disabled={!transcript && !fullTranscript}
                                    className="rounded-full h-14 w-14 p-0 bg-primary shadow-xl hover:scale-105 transition-transform"
                                >
                                    <Send className="w-6 h-6" />
                                </Button>
                            </>
                        ) : status === 'processing' || status === 'speaking' ? (
                            <div className="flex items-center gap-3 text-muted-foreground">
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>{status === 'processing' ? 'Processing...' : 'Speaking...'}</span>
                            </div>
                        ) : (
                            /* Main Mic Button */
                            <Button
                                size="lg"
                                onClick={startRecording}
                                className={cn(
                                    "rounded-full h-20 w-20 p-0 shadow-2xl transition-all duration-300",
                                    "bg-gradient-to-br from-primary to-primary/80 hover:scale-105",
                                    "border-4 border-background"
                                )}
                            >
                                <Mic className="w-8 h-8 text-primary-foreground" />
                            </Button>
                        )}
                    </div>

                    {/* Helper Text */}
                    <p className="text-center text-xs text-muted-foreground mt-4">
                        {status === 'listening'
                            ? "Speak naturally. Tap ➤ when done."
                            : "Tap the mic and speak your command"}
                    </p>
                </div>
            </SheetContent>
        </Sheet>
    );
}
