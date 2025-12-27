-- Add recurring invoice columns to invoices table
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS recurring_interval text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS next_due_date timestamptz;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS parent_invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL;

-- Add a check constraint for recurring_interval values (using a trigger for flexibility)
CREATE OR REPLACE FUNCTION public.validate_recurring_interval()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.recurring_interval IS NOT NULL AND NEW.recurring_interval NOT IN ('weekly', 'fortnightly', 'monthly', 'quarterly') THEN
    RAISE EXCEPTION 'Invalid recurring_interval. Must be one of: weekly, fortnightly, monthly, quarterly';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS validate_recurring_interval_trigger ON public.invoices;
CREATE TRIGGER validate_recurring_interval_trigger
BEFORE INSERT OR UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.validate_recurring_interval();

-- Create index for recurring invoices
CREATE INDEX IF NOT EXISTS idx_invoices_is_recurring ON public.invoices(is_recurring) WHERE is_recurring = true;
CREATE INDEX IF NOT EXISTS idx_invoices_next_due_date ON public.invoices(next_due_date) WHERE next_due_date IS NOT NULL;