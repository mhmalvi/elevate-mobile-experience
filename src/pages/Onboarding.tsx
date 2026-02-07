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
    if (!user) {
      console.error('No user found');
      return;
    }

    console.log('Starting onboarding completion for user:', user.id);
    console.log('Form data:', formData);

    setLoading(true);
    try {
      // Check if profile exists (using maybeSingle to handle 0 or 1 rows)
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching profile:', fetchError);
        throw new Error(`Profile fetch failed: ${fetchError.message}`);
      }

      console.log('Existing profile:', existingProfile);

      const profileData = {
        trade_type: formData.trade_type || null,
        business_name: formData.business_name || null,
        abn: formData.abn || null,
        phone: formData.phone || null,
        onboarding_completed: true,
      };

      let result;

      if (existingProfile) {
        // Update existing profile
        console.log('Updating existing profile...');
        result = await supabase
          .from('profiles')
          .update(profileData)
          .eq('user_id', user.id)
          .select();
      } else {
        // Create new profile
        console.log('Creating new profile...');
        result = await supabase
          .from('profiles')
          .insert({
            user_id: user.id,
            email: user.email,
            ...profileData,
          })
          .select();
      }

      const { data, error } = result;

      if (error) {
        console.error('Profile save error:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('Error details:', error.details);
        throw error;
      }

      console.log('Profile saved successfully:', data);

      toast({
        title: "You're all set! 🎉",
        description: "Let's get your first quote sorted.",
      });

      navigate('/dashboard');
    } catch (error: any) {
      console.error('Onboarding error:', error);
      console.error('Error message:', error?.message);
      console.error('Error details:', JSON.stringify(error, null, 2));
      toast({
        title: "Something went wrong",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
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

      <div className="flex-1 flex flex-col p-6 max-w-md mx-auto w-full relative overflow-hidden">
        {/* Step 1: Welcome */}
        {step === 1 && (
          <div className="flex-1 flex flex-col justify-center animate-fade-in relative z-10">
            <div className="absolute -top-20 -left-20 w-64 h-64 bg-primary/10 rounded-full blur-3xl animate-pulse" />
            <div className="absolute top-40 -right-20 w-48 h-48 bg-accent/10 rounded-full blur-3xl" />

            <div className="text-center mb-10 relative">
              <div className="relative inline-block mb-6">
                <div className="absolute inset-0 bg-primary/30 blur-2xl rounded-full scale-110 animate-pulse-glow" />
                <div className="relative w-24 h-24 rounded-[2rem] gradient-primary flex items-center justify-center shadow-glow-lg rotate-3 animate-float">
                  <Sparkles className="w-12 h-12 text-primary-foreground" />
                </div>
              </div>
              <h1 className="text-4xl font-extrabold text-foreground mb-3 tracking-tight">
                Hey there! 👋
              </h1>
              <p className="text-xl text-muted-foreground font-medium px-4">
                Let's get your business set up.
              </p>
            </div>

            <div className="space-y-4 mb-10">
              <div className="group flex items-center gap-4 p-5 bg-card/40 backdrop-blur-md rounded-2xl border border-border/40 hover:bg-card/60 transition-all duration-300 shadow-premium">
                <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <Check className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-bold text-foreground">Fast Quotes</p>
                  <p className="text-sm text-muted-foreground">Professional quotes in 60 seconds</p>
                </div>
              </div>
              <div className="group flex items-center gap-4 p-5 bg-card/40 backdrop-blur-md rounded-2xl border border-border/40 hover:bg-card/60 transition-all duration-300 shadow-premium">
                <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <Check className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-bold text-foreground">Workflow Tracking</p>
                  <p className="text-sm text-muted-foreground">From quote to paid in one place</p>
                </div>
              </div>
              <div className="group flex items-center gap-4 p-5 bg-card/40 backdrop-blur-md rounded-2xl border border-border/40 hover:bg-card/60 transition-all duration-300 shadow-premium">
                <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <Check className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-bold text-foreground">Local & Ready</p>
                  <p className="text-sm text-muted-foreground">Works offline, on any device</p>
                </div>
              </div>
            </div>

            <Button
              onClick={handleNext}
              size="lg"
              className="w-full h-16 text-xl font-bold shadow-glow hover:shadow-glow-lg transition-all duration-300 rounded-2xl gradient-primary"
            >
              Let's Go! <ArrowRight className="ml-2 w-6 h-6" />
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 content-start">
              {TRADES.map((trade, index) => (
                <button
                  key={trade.value}
                  onClick={() => handleTradeSelect(trade.value)}
                  className={`p-4 rounded-xl border-2 transition-all duration-200 animate-fade-in ${formData.trade_type === trade.value
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
      </div>
    </div>
  );
}
