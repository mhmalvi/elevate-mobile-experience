import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from '@/components/ui/sheet';
import {
    Mic,
    Sparkles,
    Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface VoiceCommandSheetProps {
    children: React.ReactNode;
}

// Web Speech API Types
declare global {
    interface Window {
        SpeechRecognition: any;
        webkitSpeechRecognition: any;
    }
}

export function VoiceCommandSheet({ children }: VoiceCommandSheetProps) {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { user } = useAuth();
    const [open, setOpen] = useState(false);

    // Conversation State
    const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
    const [transcript, setTranscript] = useState('');
    const [aiMessage, setAiMessage] = useState("Tap to start conversation");
    const [history, setHistory] = useState<any[]>([]);

    const recognitionRef = useRef<any>(null);

    // Initialize Speech Recognition
    useEffect(() => {
        if (open) {
            // Reset state on open
            setStatus('idle');
            setTranscript('');
            setAiMessage("Tap microphone to start");
            setHistory([]);

            // Setup Recognition
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (SpeechRecognition) {
                const recognition = new SpeechRecognition();
                recognition.continuous = true; // Keep listening until manual stop or long silence
                recognition.interimResults = true;
                recognition.lang = 'en-AU'; // Aussie Accent Support

                recognition.onstart = () => {
                    setStatus('listening');
                    setTranscript('');
                };

                recognition.onresult = (event: any) => {
                    const current = event.resultIndex;
                    const transcriptText = event.results[current][0].transcript;
                    setTranscript(transcriptText);
                };

                // When speech ends (silence), we automatically process
                recognition.onend = () => {
                    // We handle the end of speech trigger via the useEffect watcher below or manual stop
                    // But if it stops naturally, we check if we should process
                    // This is handled by the silence timer usually for better UX
                };

                recognitionRef.current = recognition;
            }
        } else {
            stopListening();
            window.speechSynthesis.cancel(); // Stop talking if closed
        }
    }, [open]);

    const startListening = () => {
        if (recognitionRef.current) {
            try {
                recognitionRef.current.start();
                setStatus('listening');
                setTranscript('');
            } catch (e) {
                console.error("Mic Error or already started", e);
                // If already started, just ensure status is right
                setStatus('listening');
            }
        } else {
            toast({ title: "Voice not supported", description: "Use Chrome/Safari", variant: "destructive" });
        }
    };

    const stopListening = () => {
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch (e) {
                // ignore
            }
        }
    };

    // Auto-Send on Silence (If listening and text exists)
    useEffect(() => {
        let timer: any;
        if (status === 'listening' && transcript.length > 2) {
            // Reset timer on every transcript change
            timer = setTimeout(() => {
                stopListening();
                handleAiProcess(transcript);
            }, 3000); // 3s silence -> send
        }
        return () => clearTimeout(timer);
    }, [transcript, status]);

    const handleAiProcess = async (text: string) => {
        if (!text.trim()) return;

        setStatus('processing');

        try {
            // Call Edge Function
            const { data, error } = await supabase.functions.invoke('process-voice-command', {
                body: { query: text, conversationHistory: history }
            });

            if (error) throw error;

            const { speak, action, data: actionData } = data;

            // 1. Speak Response
            setAiMessage(speak);
            // Add to history
            const newHistory = [
                ...history,
                { role: 'user', content: text },
                { role: 'assistant', content: JSON.stringify(data) } // Store full context
            ];
            setHistory(newHistory);

            speakResponse(speak, action === 'ask_details');

            // 2. Handle Action
            if (action === 'create_quote') {
                // Create Quote & Navigate
                // We wait a bit so user hears the confirmation
                setTimeout(() => {
                    createQuoteAndNavigate(actionData);
                }, 2000);
            }

        } catch (error) {
            console.error(error);
            setAiMessage("Something went wrong. Try again.");
            setStatus('idle');
        }
    };

    const speakResponse = (text: string, shouldListenAfter: boolean) => {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;

        utterance.onend = () => {
            if (shouldListenAfter && open) {
                startListening();
            } else {
                setStatus('idle');
            }
        };

        setStatus('speaking');
        window.speechSynthesis.speak(utterance);
    };

    const createQuoteAndNavigate = async (quoteData: any) => {
        if (!user) return;

        try {
            const { data: quote, error } = await supabase
                .from('quotes')
                .insert({
                    user_id: user.id,
                    quote_number: `Q-AI-${Math.floor(Math.random() * 1000)}`,
                    title: quoteData.client_name ? `Quote for ${quoteData.client_name}` : 'Voice Quote',
                    status: 'draft',
                    total: quoteData.total || 0,
                    valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                })
                .select()
                .single();

            if (quote && quoteData.items) {
                const items = quoteData.items.map((item: any) => ({
                    quote_id: quote.id,
                    description: item.description,
                    quantity: item.quantity || 1,
                    unit_price: item.price || 0,
                    total: (item.quantity || 1) * (item.price || 0)
                }));
                await supabase.from('quote_line_items').insert(items);

                setOpen(false); // Close sheet
                toast({ title: "Quote Created!", description: "AI worked its magic. ✨" });
                navigate(`/quotes/${quote.id}`);
            }
        } catch (e) {
            console.error("Creation Error", e);
            toast({ title: "Creation Failed", variant: "destructive" });
        }
    };

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                {children}
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-[2rem] px-6 pb-10 pt-8 border-t-0 bg-background/95 backdrop-blur-3xl shadow-2xl h-[60vh] flex flex-col items-center">
                <SheetHeader className="mb-4">
                    <SheetTitle className="hidden">Voice Assistant</SheetTitle>
                    <SheetDescription className="hidden">
                        Interactive AI Voice Assistant to help you manage quotes and jobs.
                    </SheetDescription>
                </SheetHeader>

                {/* Main Interaction Area */}
                <div className="flex-1 flex flex-col items-center justify-center space-y-8 w-full">

                    {/* Status Orb */}
                    <div className={cn(
                        "w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 cursor-pointer",
                        status === 'listening' ? "bg-red-500/20 shadow-[0_0_40px_rgba(239,68,68,0.4)] scale-110 border-2 border-red-500/50" :
                            status === 'processing' ? "bg-blue-500/20 shadow-[0_0_40px_rgba(59,130,246,0.4)] animate-pulse border-2 border-blue-500/50" :
                                status === 'speaking' ? "bg-green-500/20 shadow-[0_0_30px_rgba(34,197,94,0.4)] animate-pulse border-2 border-green-500/50" :
                                    "bg-primary/20 shadow-[0_0_20px_rgba(var(--primary),0.2)] border-2 border-primary/30 hover:scale-105"
                    )}
                        onClick={() => status === 'idle' ? startListening() : stopListening()}
                    >
                        {status === 'processing' ? (
                            <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                        ) : (
                            <Mic className={cn(
                                "w-10 h-10 transition-colors duration-300",
                                status === 'listening' ? "text-red-500" :
                                    status === 'speaking' ? "text-green-500" :
                                        "text-primary"
                            )} />
                        )}
                    </div>

                    {/* Transcript / Message */}
                    <div className="text-center space-y-4 max-w-xs px-4">
                        <p className={cn(
                            "text-2xl font-bold leading-tight transition-all duration-300",
                            status === 'listening' ? "text-foreground" : "text-primary"
                        )}>
                            {status === 'listening'
                                ? (transcript || "Listening...")
                                : aiMessage}
                        </p>

                        {status === 'idle' && (
                            <p className="text-sm text-muted-foreground animate-fade-in">Tap the orb to start</p>
                        )}
                        {status === 'listening' && (
                            <div className="flex justify-center gap-1 h-2">
                                <span className="w-1.5 h-1.5 bg-foreground/50 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                <span className="w-1.5 h-1.5 bg-foreground/50 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                <span className="w-1.5 h-1.5 bg-foreground/50 rounded-full animate-bounce" />
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Hint */}
                <div className="mt-auto flex items-center justify-center gap-2 text-xs text-muted-foreground/50 pt-8">
                    <Sparkles className="w-3 h-3" />
                    <span>Powered by TradieMate AI</span>
                </div>
            </SheetContent>
        </Sheet>
    );
}
