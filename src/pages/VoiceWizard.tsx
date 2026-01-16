import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Mic, ChevronRight, CheckCircle, User, Briefcase, ListPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type WizardStep = 'intro' | 'client' | 'job_details' | 'items' | 'review';

interface QuoteItem {
    description: string;
    quantity: number;
    price: number;
}

export default function VoiceQuoteWizard() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { toast } = useToast();
    const [step, setStep] = useState<WizardStep>('intro');
    const [isSpeaking, setIsSpeaking] = useState(false);

    // Form Data
    const [clientName, setClientName] = useState('');
    const [jobTitle, setJobTitle] = useState('');
    const [items, setItems] = useState<QuoteItem[]>([]);
    const [currentItem, setCurrentItem] = useState<Partial<QuoteItem>>({});

    const speak = (text: string) => {
        if ('speechSynthesis' in window) {
            setIsSpeaking(true);
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.1;
            utterance.pitch = 1.0;
            utterance.onend = () => setIsSpeaking(false);
            window.speechSynthesis.speak(utterance);
        }
    };

    useEffect(() => {
        // Initial greeting
        if (step === 'intro') {
            // speak("Welcome to the Voice Quote Wizard. Let's create a quote together. Tap Start when ready.");
        }
    }, []);

    const handleNext = () => {
        window.speechSynthesis.cancel();
        if (step === 'intro') {
            setStep('client');
            speak("Who is this quote for? Say the client's name or type it.");
        } else if (step === 'client') {
            if (!clientName) {
                toast({ title: 'Please enter a client name', variant: 'destructive' });
                return;
            }
            setStep('job_details');
            speak("What is the job title or description?");
        } else if (step === 'job_details') {
            if (!jobTitle) {
                toast({ title: 'Please enter a job title', variant: 'destructive' });
                return;
            }
            setStep('items');
            speak("Let's add some line items. What's the first item?");
        }
    };

    const handleAddItem = () => {
        if (currentItem.description && currentItem.price) {
            setItems([...items, {
                description: currentItem.description,
                quantity: currentItem.quantity || 1,
                price: currentItem.price
            } as QuoteItem]);
            setCurrentItem({});
            speak("Item added. Add another, or tap Review to finish.");
        }
    };

    const handleFinish = async () => {
        if (!user) return;

        // Create Quote Logic (Simplified)
        try {
            // 1. Create/Find Client (Mock)
            // 2. Create Quote
            const { data: quote, error } = await supabase
                .from('quotes')
                .insert({
                    user_id: user.id,
                    quote_number: `Q-${Date.now().toString().slice(-4)}`,
                    title: jobTitle || 'Voice Quote',
                    status: 'draft',
                    total: items.reduce((sum, item) => sum + (item.price * item.quantity), 0),
                    valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                })
                .select()
                .single();

            if (error) throw error;

            // 3. Create Items
            if (quote) {
                const lineItems = items.map(item => ({
                    quote_id: quote.id,
                    description: item.description,
                    quantity: item.quantity,
                    unit_price: item.price,
                    total: item.quantity * item.price
                }));

                const { error: itemsError } = await supabase
                    .from('quote_line_items')
                    .insert(lineItems);

                if (itemsError) throw itemsError;

                toast({ title: 'Quote Created! 🎉' });
                navigate(`/quotes/${quote.id}`);
            }
        } catch (error: any) {
            toast({ title: 'Error creating quote', description: error.message, variant: 'destructive' });
        }
    };

    return (
        <MobileLayout showNav={false}>
            <div className="min-h-screen flex flex-col relative overflow-hidden">
                {/* Background Ambient */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background" />
                <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary/20 rounded-full blur-[80px]" />

                {/* Header */}
                <div className="relative px-4 pt-6 pb-2 flex items-center gap-2 z-10">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <h1 className="text-xl font-bold">Voice Wizard</h1>
                </div>

                {/* Content Area */}
                <div className="flex-1 px-6 py-8 relative z-10 flex flex-col justify-center max-w-lg mx-auto w-full">

                    {step === 'intro' && (
                        <div className="text-center space-y-8 animate-fade-in">
                            <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center mx-auto relative">
                                <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping opacity-50" />
                                <Mic className="w-10 h-10 text-primary" />
                            </div>
                            <div className="space-y-3">
                                <h2 className="text-3xl font-bold">Guided Quote Mode</h2>
                                <p className="text-muted-foreground text-lg">
                                    I'll ask you a few simple questions to build your quote instantly.
                                </p>
                            </div>
                            <Button onClick={handleNext} size="lg" className="w-full h-14 text-lg rounded-2xl shadow-glow">
                                Let's Start
                            </Button>
                        </div>
                    )}

                    {step === 'client' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="flex items-center gap-3 text-primary mb-4">
                                <User className="w-6 h-6" />
                                <span className="text-sm font-bold uppercase tracking-widest">Step 1 of 3</span>
                            </div>
                            <h2 className="text-3xl font-bold">Who is this quote for?</h2>

                            <div className="space-y-4">
                                <div className="relative">
                                    <Input
                                        autoFocus
                                        placeholder="e.g., John Smith"
                                        className="h-16 text-xl px-5 rounded-2xl bg-card border-2 border-primary/20 focus:border-primary"
                                        value={clientName}
                                        onChange={(e) => setClientName(e.target.value)}
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-primary/10 rounded-full">
                                        <Mic className="w-5 h-5 text-primary" />
                                    </div>
                                </div>
                                <p className="text-sm text-muted-foreground text-center">
                                    Tap the mic on your keyboard to speak the name
                                </p>
                            </div>

                            <Button onClick={handleNext} className="w-full h-14 rounded-2xl mt-8">
                                Next Step <ChevronRight className="w-5 h-5 ml-2" />
                            </Button>
                        </div>
                    )}

                    {step === 'job_details' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="flex items-center gap-3 text-primary mb-4">
                                <Briefcase className="w-6 h-6" />
                                <span className="text-sm font-bold uppercase tracking-widest">Step 2 of 3</span>
                            </div>
                            <h2 className="text-3xl font-bold">What's the job?</h2>

                            <Input
                                autoFocus
                                placeholder="e.g., Kitchen Renovation"
                                className="h-16 text-xl px-5 rounded-2xl bg-card border-2 border-primary/20"
                                value={jobTitle}
                                onChange={(e) => setJobTitle(e.target.value)}
                            />

                            <Button onClick={handleNext} className="w-full h-14 rounded-2xl mt-8">
                                Next Step <ChevronRight className="w-5 h-5 ml-2" />
                            </Button>
                        </div>
                    )}

                    {step === 'items' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="flex items-center gap-3 text-primary mb-4">
                                <ListPlus className="w-6 h-6" />
                                <span className="text-sm font-bold uppercase tracking-widest">Step 3 of 3</span>
                            </div>

                            <div className="space-y-4">
                                <h2 className="text-2xl font-bold">Add Line Item</h2>
                                <Input
                                    placeholder="Description (e.g. Install Fan)"
                                    className="h-14 text-lg rounded-xl"
                                    value={currentItem.description || ''}
                                    onChange={(e) => setCurrentItem({ ...currentItem, description: e.target.value })}
                                />
                                <div className="flex gap-3">
                                    <div className="flex-1">
                                        <Label>Price ($)</Label>
                                        <Input
                                            type="number"
                                            className="h-14 text-lg rounded-xl"
                                            value={currentItem.price || ''}
                                            onChange={(e) => setCurrentItem({ ...currentItem, price: parseFloat(e.target.value) })}
                                        />
                                    </div>
                                    <div className="w-24">
                                        <Label>Qty</Label>
                                        <Input
                                            type="number"
                                            className="h-14 text-lg rounded-xl"
                                            defaultValue={1}
                                            onChange={(e) => setCurrentItem({ ...currentItem, quantity: parseInt(e.target.value) })}
                                        />
                                    </div>
                                </div>

                                <Button onClick={handleAddItem} variant="secondary" className="w-full h-12 rounded-xl">
                                    Add Item
                                </Button>
                            </div>

                            {items.length > 0 && (
                                <div className="mt-6 p-4 bg-card/50 rounded-2xl border border-border/50">
                                    <h3 className="font-semibold mb-3">Items Added ({items.length})</h3>
                                    <div className="space-y-2">
                                        {items.map((item, i) => (
                                            <div key={i} className="flex justify-between text-sm p-2 bg-background rounded-lg border border-border/30">
                                                <span>{item.description} ({item.quantity})</span>
                                                <span className="font-mono">${item.price * item.quantity}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <Button onClick={() => setStep('review')} className="w-full h-14 rounded-2xl mt-4 bg-primary text-primary-foreground shadow-glow">
                                Review <CheckCircle className="w-5 h-5 ml-2" />
                            </Button>
                        </div>
                    )}

                    {step === 'review' && (
                        <div className="space-y-6 animate-fade-in text-center">
                            <div className="w-20 h-20 bg-success/20 text-success rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle className="w-10 h-10" />
                            </div>
                            <h2 className="text-3xl font-bold">Ready to Create?</h2>

                            <div className="p-6 bg-card rounded-3xl border border-border text-left space-y-3 shadow-lg">
                                <div>
                                    <label className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Client</label>
                                    <p className="text-xl font-medium">{clientName}</p>
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Job</label>
                                    <p className="text-lg">{jobTitle}</p>
                                </div>
                                <div className="pt-2 border-t border-border">
                                    <div className="flex justify-between items-center">
                                        <span className="font-medium">Total Value</span>
                                        <span className="text-2xl font-bold text-primary">
                                            ${items.reduce((sum, item) => sum + (item.price * item.quantity), 0)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <Button onClick={handleFinish} size="lg" className="w-full h-14 text-lg rounded-2xl shadow-glow">
                                Create Quote
                            </Button>
                        </div>
                    )}

                </div>
            </div>
        </MobileLayout>
    );
}
