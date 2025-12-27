import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { 
  Zap, Droplets, Hammer, HardHat, Paintbrush, 
  Trees, Wind, Home, Grid3X3, Wrench, 
  ArrowRight, ArrowLeft, Check, Sparkles
} from 'lucide-react';

type TradeType = 'electrician' | 'plumber' | 'carpenter' | 'builder' | 'painter' | 'landscaper' | 'hvac' | 'roofer' | 'tiler' | 'other';

const TRADES: { value: TradeType; label: string; icon: React.ReactNode }[] = [
  { value: 'electrician', label: 'Electrician', icon: <Zap className="w-6 h-6" /> },
  { value: 'plumber', label: 'Plumber', icon: <Droplets className="w-6 h-6" /> },
  { value: 'carpenter', label: 'Carpenter', icon: <Hammer className="w-6 h-6" /> },
  { value: 'builder', label: 'Builder', icon: <HardHat className="w-6 h-6" /> },
  { value: 'painter', label: 'Painter', icon: <Paintbrush className="w-6 h-6" /> },
  { value: 'landscaper', label: 'Landscaper', icon: <Trees className="w-6 h-6" /> },
  { value: 'hvac', label: 'HVAC', icon: <Wind className="w-6 h-6" /> },
  { value: 'roofer', label: 'Roofer', icon: <Home className="w-6 h-6" /> },
  { value: 'tiler', label: 'Tiler', icon: <Grid3X3 className="w-6 h-6" /> },
  { value: 'other', label: 'Other Trade', icon: <Wrench className="w-6 h-6" /> },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    trade_type: '' as TradeType | '',
    business_name: '',
    abn: '',
    phone: '',
  });

  const totalSteps = 3;

  const handleTradeSelect = (trade: TradeType) => {
    setFormData(prev => ({ ...prev, trade_type: trade }));
  };

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleComplete = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          trade_type: formData.trade_type || null,
          business_name: formData.business_name || null,
          abn: formData.abn || null,
          phone: formData.phone || null,
          onboarding_completed: true,
        })
        .eq('user_id', user.id);

      if (error) {
        console.error('Onboarding error:', error);
        throw error;
      }

      toast({
        title: "You're all set, mate! 🎉",
        description: "Let's get you some quotes sorted.",
      });
      
      navigate('/dashboard');
    } catch (error) {
      console.error('Onboarding error:', error);
      toast({
        title: "Something went wrong",
        description: "No worries, give it another go.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      await supabase
        .from('profiles')
        .update({
          onboarding_completed: true,
        })
        .eq('user_id', user.id);
      
      navigate('/dashboard');
    } catch (error) {
      console.error('Skip onboarding error:', error);
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Progress bar */}
      <div className="h-1 bg-muted">
        <div 
          className="h-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${(step / totalSteps) * 100}%` }}
        />
      </div>

      <div className="flex-1 flex flex-col p-6 max-w-md mx-auto w-full">
        {/* Step 1: Welcome */}
        {step === 1 && (
          <div className="flex-1 flex flex-col justify-center animate-fade-in">
            <div className="text-center mb-8">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mx-auto mb-6 shadow-glow animate-pulse-glow">
                <Sparkles className="w-10 h-10 text-primary-foreground" />
              </div>
              <h1 className="text-3xl font-bold text-foreground mb-2">
                G'day, mate! 👋
              </h1>
              <p className="text-lg text-muted-foreground">
                Welcome to TradieMate. Let's get you set up in under a minute.
              </p>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-3 p-4 bg-card/50 rounded-xl border border-border/50">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Check className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Professional quotes in 60 seconds</p>
                  <p className="text-sm text-muted-foreground">No more paper quotes or spreadsheets</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-card/50 rounded-xl border border-border/50">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Check className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Track jobs from quote to payment</p>
                  <p className="text-sm text-muted-foreground">Everything in one place</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-card/50 rounded-xl border border-border/50">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Check className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Made for Aussie tradies 🇦🇺</p>
                  <p className="text-sm text-muted-foreground">ABN, GST, and bank details sorted</p>
                </div>
              </div>
            </div>

            <Button 
              onClick={handleNext} 
              size="lg" 
              className="w-full h-14 text-lg shadow-premium"
            >
              Let's Go <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        )}

        {/* Step 2: Trade Selection */}
        {step === 2 && (
          <div className="flex-1 flex flex-col animate-fade-in">
            <div className="mb-6">
              <p className="text-sm text-muted-foreground mb-1">Step 2 of 3</p>
              <h2 className="text-2xl font-bold text-foreground">What's your trade?</h2>
              <p className="text-muted-foreground mt-1">
                We'll customise quote templates for you
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 flex-1 content-start">
              {TRADES.map((trade, index) => (
                <button
                  key={trade.value}
                  onClick={() => handleTradeSelect(trade.value)}
                  className={`p-4 rounded-xl border-2 transition-all duration-200 animate-fade-in ${
                    formData.trade_type === trade.value
                      ? 'border-primary bg-primary/10 shadow-glow'
                      : 'border-border/50 bg-card/50 hover:border-border hover:bg-card'
                  }`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className={`mb-2 ${formData.trade_type === trade.value ? 'text-primary' : 'text-muted-foreground'}`}>
                    {trade.icon}
                  </div>
                  <p className={`font-medium text-sm ${formData.trade_type === trade.value ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {trade.label}
                  </p>
                </button>
              ))}
            </div>

            <div className="flex gap-3 mt-6">
              <Button variant="outline" onClick={handleBack} size="lg" className="flex-1 h-12">
                <ArrowLeft className="mr-2 w-4 h-4" /> Back
              </Button>
              <Button 
                onClick={handleNext} 
                size="lg" 
                className="flex-1 h-12"
                disabled={!formData.trade_type}
              >
                Next <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Business Details */}
        {step === 3 && (
          <div className="flex-1 flex flex-col animate-fade-in">
            <div className="mb-6">
              <p className="text-sm text-muted-foreground mb-1">Step 3 of 3</p>
              <h2 className="text-2xl font-bold text-foreground">Business details</h2>
              <p className="text-muted-foreground mt-1">
                This info appears on your quotes and invoices
              </p>
            </div>

            <div className="space-y-4 flex-1">
              <div className="space-y-2">
                <Label htmlFor="business_name">Business Name</Label>
                <Input
                  id="business_name"
                  placeholder="e.g. Dave's Electrical Services"
                  value={formData.business_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, business_name: e.target.value }))}
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="abn">ABN (optional)</Label>
                <Input
                  id="abn"
                  placeholder="e.g. 12 345 678 901"
                  value={formData.abn}
                  onChange={(e) => setFormData(prev => ({ ...prev, abn: e.target.value }))}
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Mobile Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="e.g. 0412 345 678"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="h-12"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button variant="outline" onClick={handleBack} size="lg" className="flex-1 h-12">
                <ArrowLeft className="mr-2 w-4 h-4" /> Back
              </Button>
              <Button 
                onClick={handleComplete} 
                size="lg" 
                className="flex-1 h-12 shadow-premium"
                disabled={loading}
              >
                {loading ? 'Setting up...' : "Let's Go!"} <Check className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Skip link */}
        {step > 1 && (
          <button
            onClick={handleSkip}
            className="mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors text-center"
            disabled={loading}
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
}
