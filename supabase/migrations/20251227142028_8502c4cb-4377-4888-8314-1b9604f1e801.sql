-- Create usage_tracking table for subscription tier limits
CREATE TABLE public.usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  month_year TEXT NOT NULL, -- e.g., "2025-01"
  quotes_created INTEGER DEFAULT 0,
  invoices_created INTEGER DEFAULT 0,
  jobs_created INTEGER DEFAULT 0,
  emails_sent INTEGER DEFAULT 0,
  sms_sent INTEGER DEFAULT 0,
  clients_created INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, month_year)
);

-- Enable RLS
ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;

-- RLS policies for usage_tracking
CREATE POLICY "Users can view their own usage" 
ON public.usage_tracking 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own usage" 
ON public.usage_tracking 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own usage" 
ON public.usage_tracking 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Allow service role to update usage from edge functions
CREATE POLICY "Service role can manage all usage" 
ON public.usage_tracking 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_usage_tracking_updated_at
BEFORE UPDATE ON public.usage_tracking
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();