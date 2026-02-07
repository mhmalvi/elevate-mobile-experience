-- Fix: increment_usage_count() had a duplicate column bug
-- Bug: format('%I', 'clients_created') inserted the column name into the INSERT column list,
-- but that column already appeared in the explicit list, causing:
--   ERROR 42701: column "clients_created" specified more than once
-- This caused ALL inserts on clients/quotes/invoices/jobs to fail with 400
-- Fix: Use INSERT DO NOTHING + separate UPDATE to avoid duplicate column issue

CREATE OR REPLACE FUNCTION increment_usage_count()
RETURNS TRIGGER AS $$
DECLARE
  current_month TEXT;
  limit_column TEXT;
BEGIN
  -- Get current month in YYYY-MM format
  current_month := TO_CHAR(CURRENT_DATE, 'YYYY-MM');

  -- Determine which column to increment
  IF TG_TABLE_NAME = 'quotes' THEN
    limit_column := 'quotes_created';
  ELSIF TG_TABLE_NAME = 'invoices' THEN
    limit_column := 'invoices_created';
  ELSIF TG_TABLE_NAME = 'jobs' THEN
    limit_column := 'jobs_created';
  ELSIF TG_TABLE_NAME = 'clients' THEN
    limit_column := 'clients_created';
  ELSE
    -- Unknown table, skip
    RETURN NEW;
  END IF;

  -- Ensure the usage_tracking row exists for this user/month
  INSERT INTO usage_tracking (user_id, month_year, quotes_created, invoices_created, jobs_created, clients_created, emails_sent, sms_sent)
  VALUES (NEW.user_id, current_month, 0, 0, 0, 0, 0, 0)
  ON CONFLICT (user_id, month_year)
  DO NOTHING;

  -- Increment the specific column
  EXECUTE format('
    UPDATE usage_tracking
    SET %I = COALESCE(%I, 0) + 1
    WHERE user_id = $1 AND month_year = $2
  ', limit_column, limit_column)
  USING NEW.user_id, current_month;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
