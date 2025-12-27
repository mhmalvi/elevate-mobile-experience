-- Add recurring invoice support with performance indexes and helper functions
-- The schema already has the basic fields, this migration adds optimizations

-- Add indexes for efficient cron queries
CREATE INDEX IF NOT EXISTS idx_invoices_recurring_active
  ON public.invoices(user_id, next_due_date, is_recurring)
  WHERE is_recurring = true
    AND deleted_at IS NULL
    AND status != 'cancelled';

-- Add index for parent invoice lookups (to show generation history)
CREATE INDEX IF NOT EXISTS idx_invoices_parent_id
  ON public.invoices(parent_invoice_id)
  WHERE parent_invoice_id IS NOT NULL;

-- Function to calculate next due date based on interval
CREATE OR REPLACE FUNCTION calculate_next_due_date(
  current_date date,
  interval_type text
) RETURNS date AS $$
BEGIN
  RETURN CASE interval_type
    WHEN 'weekly' THEN current_date + INTERVAL '7 days'
    WHEN 'fortnightly' THEN current_date + INTERVAL '14 days'
    WHEN 'monthly' THEN current_date + INTERVAL '1 month'
    WHEN 'quarterly' THEN current_date + INTERVAL '3 months'
    WHEN 'yearly' THEN current_date + INTERVAL '1 year'
    ELSE current_date + INTERVAL '1 month' -- Default to monthly
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_next_due_date IS 'Calculate the next due date for a recurring invoice based on interval type';

-- Add a check constraint to ensure valid recurring_interval values
-- (Only if the column doesn't already have this constraint)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'invoices_recurring_interval_check'
  ) THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_recurring_interval_check
      CHECK (recurring_interval IS NULL OR recurring_interval IN ('weekly', 'fortnightly', 'monthly', 'quarterly', 'yearly'));
  END IF;
END$$;

-- Create a view to easily query active recurring invoices
CREATE OR REPLACE VIEW public.active_recurring_invoices AS
SELECT
  i.*,
  c.name as client_name,
  c.email as client_email,
  p.business_name,
  p.subscription_tier
FROM public.invoices i
LEFT JOIN public.clients c ON i.client_id = c.id
LEFT JOIN public.profiles p ON i.user_id = p.user_id
WHERE i.is_recurring = true
  AND i.deleted_at IS NULL
  AND i.status != 'cancelled';

COMMENT ON VIEW public.active_recurring_invoices IS 'View of all active recurring invoice templates with client and profile info';
