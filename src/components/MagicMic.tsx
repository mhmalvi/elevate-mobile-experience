import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Loader2, StopCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export function MagicMic() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { user } = useAuth();
    const [isListening, setIsListening] = useState(false);
    const [processing, setProcessing] = useState(false);

    const handleToggle = async () => {
        if (!isListening) {
            // START LISTENING
            setIsListening(true);
            toast({ title: "Listening...", description: "Speak your quote details..." });
        } else {
            // STOP LISTENING & PROCESS
            setIsListening(false);
            setProcessing(true);

            try {
                // Simulate AI Processing Delay
                await new Promise(resolve => setTimeout(resolve, 2000));

                if (!user) throw new Error("No user found");

                // CREATE MOCK QUOTE (Simulate AI Result)
                const { data: quote, error: quoteError } = await supabase
                    .from('quotes')
                    .insert({
                        user_id: user.id,
                        quote_number: `Q-AI-${Math.floor(Math.random() * 1000)}`,
                        status: 'draft',
                        title: 'Kitchen Renovation (Voice)',
                        total: 420,
                        valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                    })
                    .select()
                    .single();

                if (quoteError) throw quoteError;

                // CREATE MOCK ITEMS
                if (quote) {
                    const items = [
                        { description: "Install Downlights", quantity: 6, unit_price: 45, total: 270 },
                        { description: "Safety Switch Check", quantity: 1, unit_price: 150, total: 150 }
                    ];

                    const { error: itemsError } = await supabase
                        .from('quote_line_items')
                        .insert(items.map(item => ({ quote_id: quote.id, ...item })));

                    if (itemsError) throw itemsError;

                    toast({
                        title: "Quote Drafted! 🪄",
                        description: "Here is what we heard.",
                    });

                    navigate(`/quotes/${quote.id}`);
                }
            } catch (error: any) {
                console.error('MagicMic Error:', error);
                toast({
                    title: "Could not process",
                    description: "Try again or check connection.",
                    variant: "destructive"
                });
            } finally {
                setProcessing(false);
            }
        }
    };

    return (
        <>
            <Button
                onClick={handleToggle}
                size="icon"
                className={cn(
                    "fixed bottom-24 right-5 w-16 h-16 rounded-full shadow-2xl z-50 transition-all duration-300 border-4 border-background/50 backdrop-blur-md",
                    isListening
                        ? "bg-destructive hover:bg-destructive shadow-destructive/50 animate-pulse-glow scale-110"
                        : "bg-primary hover:bg-primary/90 shadow-primary/30",
                    processing && "opacity-80 cursor-wait"
                )}
                disabled={processing}
            >
                {processing ? (
                    <Loader2 className="w-8 h-8 animate-spin text-white" />
                ) : isListening ? (
                    <StopCircle className="w-8 h-8 text-white animate-in zoom-in duration-300" />
                ) : (
                    <Mic className="w-7 h-7 text-white" />
                )}
            </Button>

            {/* Helper Label */}
            {!isListening && !processing && (
                <div className="fixed bottom-[160px] right-6 py-1.5 px-3 bg-foreground/80 text-background text-xs font-bold rounded-full animate-fade-in shadow-lg pointer-events-none backdrop-blur-sm">
                    Magic Mic
                </div>
            )}
        </>
    );
}
