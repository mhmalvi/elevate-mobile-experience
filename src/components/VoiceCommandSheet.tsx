import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from '@/components/ui/sheet';
import { Mic, Sparkles, Loader2, Volume2, CheckCircle, AlertCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';

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

// Get best Australian female voice
const getAussieVoice = (): SpeechSynthesisVoice | null => {
    const voices = window.speechSynthesis.getVoices();
    // Priority: Australian English Female
    const aussieFemalePriority = [
        'Karen', 'Catherine', 'Tessa', 'Moira', // iOS/macOS Aussie voices
        'en-AU', 'en_AU', // General Australian
        'Google UK English Female', // Fallback
    ];

    for (const pref of aussieFemalePriority) {
        const found = voices.find(v =>
            v.name.includes(pref) || v.lang.includes(pref)
        );
        if (found) return found;
    }

    // Fallback to any female-sounding English voice
    return voices.find(v =>
        v.lang.startsWith('en') &&
        (v.name.toLowerCase().includes('female') ||
            v.name.includes('Samantha') ||
            v.name.includes('Victoria') ||
            v.name.includes('Google'))
    ) || voices.find(v => v.lang.startsWith('en')) || null;
};

type VoiceStatus = 'ready' | 'listening' | 'processing' | 'speaking' | 'success' | 'error';

export function VoiceCommandSheet({ children }: VoiceCommandSheetProps) {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { user } = useAuth();
    const [open, setOpen] = useState(false);

    // Conversation State
    const [status, setStatus] = useState<VoiceStatus>('ready');
    const [transcript, setTranscript] = useState('');
    const [displayMessage, setDisplayMessage] = useState('');
    const [history, setHistory] = useState<any[]>([]);
    const [accumulatedData, setAccumulatedData] = useState<any>({});
    const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);

    const recognitionRef = useRef<any>(null);
    const silenceTimerRef = useRef<any>(null);

    // Load voices
    useEffect(() => {
        const loadVoices = () => {
            const voice = getAussieVoice();
            setSelectedVoice(voice);
        };

        loadVoices();
        window.speechSynthesis.onvoiceschanged = loadVoices;

        return () => {
            window.speechSynthesis.onvoiceschanged = null;
        };
    }, []);

    // Initialize on open
    useEffect(() => {
        if (open) {
            setStatus('ready');
            setTranscript('');
            setDisplayMessage("G'day! What can I help you with?");
            setHistory([]);

            // Speak greeting
            setTimeout(() => {
                speakText("G'day! What can I help you with?", false);
            }, 300);

            initRecognition();
        } else {
            cleanup();
        }

        return () => cleanup();
    }, [open]);

    const cleanup = () => {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        if (recognitionRef.current) {
            try { recognitionRef.current.stop(); } catch (e) { }
        }
        window.speechSynthesis.cancel();
    };

    const initRecognition = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-AU';

        recognition.onstart = () => setStatus('listening');

        recognition.onresult = (event: any) => {
            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const t = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += t;
                } else {
                    interimTranscript += t;
                }
            }

            const currentText = finalTranscript || interimTranscript;
            setTranscript(currentText);

            // Reset silence timer on speech
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

            // If we have final transcript, start silence timer
            if (finalTranscript || currentText.length > 5) {
                silenceTimerRef.current = setTimeout(() => {
                    stopListening();
                    processCommand(currentText);
                }, 4000); // 4s of silence - gives user time to think
            }
        };

        recognition.onerror = (event: any) => {
            console.error('Speech error:', event.error);
            if (event.error === 'no-speech') {
                setDisplayMessage("I didn't hear anything. Tap to try again.");
                setStatus('ready');
            }
        };

        recognition.onend = () => {
            // Only set to ready if we're not processing
            if (status === 'listening') {
                if (transcript.length > 2) {
                    processCommand(transcript);
                } else {
                    setStatus('ready');
                }
            }
        };

        recognitionRef.current = recognition;
    };

    const startListening = useCallback(() => {
        if (!recognitionRef.current) initRecognition();

        try {
            recognitionRef.current?.start();
            setStatus('listening');
            setTranscript('');
            setDisplayMessage('Listening...');
        } catch (e) {
            // Already started, just update state
            setStatus('listening');
        }
    }, []);

    const stopListening = useCallback(() => {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        try { recognitionRef.current?.stop(); } catch (e) { }
    }, []);

    const speakText = useCallback((text: string, autoListen: boolean) => {
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.95; // Slightly slower for clarity
        utterance.pitch = 1.1; // Slightly higher for friendliness
        utterance.volume = 1.0;

        if (selectedVoice) {
            utterance.voice = selectedVoice;
        }

        utterance.onstart = () => setStatus('speaking');

        utterance.onend = () => {
            if (autoListen && open) {
                setTimeout(() => startListening(), 300);
            } else {
                setStatus('ready');
            }
        };

        window.speechSynthesis.speak(utterance);
    }, [selectedVoice, open, startListening]);

    const processCommand = async (text: string) => {
        if (!text.trim()) {
            setDisplayMessage("I didn't catch that. Try again?");
            setStatus('ready');
            return;
        }

        setStatus('processing');
        setDisplayMessage('Processing...');

        try {
            const { data, error } = await supabase.functions.invoke('process-voice-command', {
                body: {
                    query: text,
                    conversationHistory: history,
                    accumulatedData: accumulatedData
                }
            });

            if (error) throw error;

            const { speak, action, data: actionData } = data;

            // Update history
            setHistory(prev => [
                ...prev,
                { role: 'user', content: text },
                { role: 'assistant', content: JSON.stringify(data) }
            ]);

            setDisplayMessage(speak);

            // Update accumulated data from AI response
            if (actionData) {
                setAccumulatedData(prev => ({ ...prev, ...actionData }));
            }

            if (action === 'create_quote' && actionData) {
                setStatus('success');
                speakText(speak, false);

                // Create and navigate after speaking
                setTimeout(async () => {
                    await createQuoteAndNavigate(actionData);
                }, 2500);

            } else if (action === 'ask_details') {
                // Continue conversation
                speakText(speak, true);

            } else {
                // General reply
                speakText(speak, false);
            }

        } catch (err) {
            console.error('Voice processing error:', err);
            setStatus('error');
            setDisplayMessage("Sorry, something went wrong. Let's try again.");
            speakText("Sorry, I had trouble understanding. Could you repeat that?", true);
        }
    };

    const createQuoteAndNavigate = async (quoteData: any) => {
        if (!user) return;

        try {
            const { data: quote, error } = await supabase
                .from('quotes')
                .insert({
                    user_id: user.id,
                    quote_number: `Q-AI-${Date.now().toString().slice(-4)}`,
                    title: quoteData.client_name ? `Quote for ${quoteData.client_name}` : 'Voice Quote',
                    status: 'draft',
                    total: quoteData.total || 0,
                    valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                })
                .select()
                .single();

            if (quote && quoteData.items?.length > 0) {
                const items = quoteData.items.map((item: any) => ({
                    quote_id: quote.id,
                    description: item.description,
                    quantity: item.quantity || 1,
                    unit_price: item.price || 0,
                    total: (item.quantity || 1) * (item.price || 0)
                }));
                await supabase.from('quote_line_items').insert(items);
            }

            if (quote) {
                setOpen(false);
                toast({ title: "Quote Created! ✨", description: `$${quoteData.total || 0} for ${quoteData.client_name || 'Client'}` });
                navigate(`/quotes/${quote.id}`);
            }
        } catch (err) {
            console.error('Quote creation error:', err);
            toast({ title: "Couldn't create quote", variant: "destructive" });
        }
    };

    const getStatusIcon = () => {
        switch (status) {
            case 'listening':
                return <Mic className="w-12 h-12 text-red-500 animate-pulse" />;
            case 'processing':
                return <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />;
            case 'speaking':
                return <Volume2 className="w-12 h-12 text-green-500 animate-pulse" />;
            case 'success':
                return <CheckCircle className="w-12 h-12 text-green-500" />;
            case 'error':
                return <AlertCircle className="w-12 h-12 text-red-500" />;
            default:
                return <Mic className="w-12 h-12 text-primary" />;
        }
    };

    const getOrbStyles = () => {
        const base = "w-28 h-28 rounded-full flex items-center justify-center transition-all duration-500 cursor-pointer";
        switch (status) {
            case 'listening':
                return cn(base, "bg-red-500/20 shadow-[0_0_60px_rgba(239,68,68,0.5)] scale-110 border-4 border-red-500/50 animate-pulse");
            case 'processing':
                return cn(base, "bg-blue-500/20 shadow-[0_0_50px_rgba(59,130,246,0.4)] border-4 border-blue-500/50");
            case 'speaking':
                return cn(base, "bg-green-500/20 shadow-[0_0_50px_rgba(34,197,94,0.4)] border-4 border-green-500/50 animate-pulse");
            case 'success':
                return cn(base, "bg-green-500/30 shadow-[0_0_60px_rgba(34,197,94,0.5)] border-4 border-green-500");
            case 'error':
                return cn(base, "bg-red-500/20 shadow-[0_0_40px_rgba(239,68,68,0.3)] border-4 border-red-500/50");
            default:
                return cn(base, "bg-primary/20 shadow-[0_0_30px_rgba(var(--primary),0.3)] border-4 border-primary/30 hover:scale-105 hover:shadow-[0_0_50px_rgba(var(--primary),0.4)]");
        }
    };

    const handleOrbClick = () => {
        if (status === 'ready' || status === 'error') {
            startListening();
        } else if (status === 'listening') {
            stopListening();
            if (transcript.length > 2) {
                processCommand(transcript);
            } else {
                setStatus('ready');
                setDisplayMessage("Tap to try again");
            }
        }
    };

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                {children}
            </SheetTrigger>
            <SheetContent
                side="bottom"
                className="rounded-t-[2.5rem] px-6 pb-12 pt-8 border-t-0 bg-gradient-to-b from-background via-background to-background/95 backdrop-blur-3xl shadow-2xl h-[65vh] flex flex-col"
            >
                <SheetHeader className="sr-only">
                    <SheetTitle>Voice Assistant</SheetTitle>
                    <SheetDescription>Interactive AI Voice Assistant for TradieMate</SheetDescription>
                </SheetHeader>

                {/* Close Button */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-4 right-4 rounded-full opacity-50 hover:opacity-100"
                    onClick={() => setOpen(false)}
                >
                    <X className="w-5 h-5" />
                </Button>

                {/* Main Content */}
                <div className="flex-1 flex flex-col items-center justify-center space-y-8">

                    {/* Voice Orb */}
                    <div
                        className={getOrbStyles()}
                        onClick={handleOrbClick}
                        role="button"
                        aria-label={status === 'listening' ? 'Stop listening' : 'Start listening'}
                    >
                        {getStatusIcon()}
                    </div>

                    {/* Message Display */}
                    <div className="text-center space-y-3 max-w-sm px-4">
                        {status === 'listening' && transcript && (
                            <p className="text-lg text-foreground/80 italic animate-fade-in">
                                "{transcript}"
                            </p>
                        )}

                        <p className={cn(
                            "text-xl font-semibold leading-relaxed transition-all duration-300",
                            status === 'success' ? "text-green-600 dark:text-green-400" :
                                status === 'error' ? "text-red-600 dark:text-red-400" :
                                    "text-foreground"
                        )}>
                            {displayMessage}
                        </p>

                        {status === 'ready' && (
                            <p className="text-sm text-muted-foreground">
                                Tap the orb and say things like:
                            </p>
                        )}
                    </div>

                    {/* Suggestions (only in ready state) */}
                    {status === 'ready' && (
                        <div className="flex flex-wrap justify-center gap-2 max-w-xs">
                            {[
                                "Create a quote",
                                "Find John Smith",
                                "Add job note"
                            ].map((suggestion) => (
                                <button
                                    key={suggestion}
                                    onClick={() => {
                                        setTranscript(suggestion);
                                        processCommand(suggestion);
                                    }}
                                    className="px-3 py-1.5 text-xs bg-muted/50 hover:bg-muted rounded-full text-muted-foreground hover:text-foreground transition-all"
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Listening Controls */}
                    {status === 'listening' && transcript.length > 3 && (
                        <div className="flex flex-col items-center gap-3 animate-fade-in">
                            <p className="text-xs text-muted-foreground">
                                Tap the orb when you're done speaking
                            </p>
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                    stopListening();
                                    processCommand(transcript);
                                }}
                                className="rounded-full px-6"
                            >
                                Done Speaking →
                            </Button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/50 pt-4">
                    <Sparkles className="w-3 h-3" />
                    <span>TradieMate Voice Assistant</span>
                </div>
            </SheetContent>
        </Sheet>
    );
}
