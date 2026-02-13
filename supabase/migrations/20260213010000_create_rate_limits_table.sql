-- Rate limiting table for edge functions
-- Records are auto-cleaned by a trigger that deletes entries older than 5 minutes

CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Index for fast lookups by key and time window
CREATE INDEX IF NOT EXISTS idx_rate_limits_key_created
  ON public.rate_limits (key, created_at DESC);

-- Auto-cleanup: delete rows older than 5 minutes on each insert
-- This keeps the table small without needing a separate cron job
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS trigger AS $$
BEGIN
  DELETE FROM public.rate_limits
  WHERE created_at < now() - interval '5 minutes';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cleanup_rate_limits ON public.rate_limits;
CREATE TRIGGER trg_cleanup_rate_limits
  AFTER INSERT ON public.rate_limits
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.cleanup_rate_limits();

-- RLS: Only service_role can access (edge functions use service_role key)
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- No policies for anon/authenticated — only service_role bypasses RLS
