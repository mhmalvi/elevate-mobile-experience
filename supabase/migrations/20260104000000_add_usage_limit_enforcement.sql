-- Add Server-Side Usage Limit Enforcement
-- SECURITY: Prevents subscription tier bypass by enforcing limits at database level
-- Created: 2026-01-04

-- Function to check usage limits before insert
CREATE OR REPLACE FUNCTION check_usage_limit()
RETURNS TRIGGER AS $$
DECLARE
  user_tier TEXT;
  current_month TEXT;
  usage_count INTEGER;
  tier_limit INTEGER;
  limit_column TEXT;
BEGIN
  -- Get current month in YYYY-MM format
  current_month := TO_CHAR(CURRENT_DATE, 'YYYY-MM');

  -- Get user's subscription tier
  SELECT subscription_tier INTO user_tier
  FROM profiles
  WHERE user_id = NEW.user_id;

  -- Default to 'free' if not set
  IF user_tier IS NULL THEN
    user_tier := 'free';
  END IF;

  -- Determine which usage column to check based on table
  IF TG_TABLE_NAME = 'quotes' THEN
    limit_column := 'quotes_created';
    -- Set limits per tier
    CASE user_tier
      WHEN 'free' THEN tier_limit := 5;
      ELSE tier_limit := NULL; -- Unlimited for paid tiers
    END CASE;
  ELSIF TG_TABLE_NAME = 'invoices' THEN
    limit_column := 'invoices_created';
    CASE user_tier
      WHEN 'free' THEN tier_limit := 5;
      ELSE tier_limit := NULL;
    END CASE;
  ELSIF TG_TABLE_NAME = 'jobs' THEN
    limit_column := 'jobs_created';
    CASE user_tier
      WHEN 'free' THEN tier_limit := 10;
      ELSE tier_limit := NULL;
    END CASE;
  ELSIF TG_TABLE_NAME = 'clients' THEN
    limit_column := 'clients_created';
    CASE user_tier
      WHEN 'free' THEN tier_limit := 10;
      ELSE tier_limit := NULL;
    END CASE;
  ELSE
    -- Unknown table, allow
    RETURN NEW;
  END IF;

  -- If unlimited (NULL), allow
  IF tier_limit IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get current usage count for this month
  EXECUTE format('
    SELECT COALESCE(%I, 0)
    FROM usage_tracking
    WHERE user_id = $1 AND month_year = $2
  ', limit_column)
  INTO usage_count
  USING NEW.user_id, current_month;

  -- Check if limit exceeded
  IF usage_count >= tier_limit THEN
    RAISE EXCEPTION 'Usage limit exceeded for % on % tier. Limit: %, Used: %',
      TG_TABLE_NAME, user_tier, tier_limit, usage_count
    USING ERRCODE = '42501'; -- insufficient_privilege error code
  END IF;

  -- Allow the operation
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for usage limit enforcement
-- These run BEFORE INSERT to prevent tier bypass
DROP TRIGGER IF EXISTS enforce_quote_limit ON quotes;
CREATE TRIGGER enforce_quote_limit
  BEFORE INSERT ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION check_usage_limit();

DROP TRIGGER IF EXISTS enforce_invoice_limit ON invoices;
CREATE TRIGGER enforce_invoice_limit
  BEFORE INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION check_usage_limit();

DROP TRIGGER IF EXISTS enforce_job_limit ON jobs;
CREATE TRIGGER enforce_job_limit
  BEFORE INSERT ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION check_usage_limit();

DROP TRIGGER IF EXISTS enforce_client_limit ON clients;
CREATE TRIGGER enforce_client_limit
  BEFORE INSERT ON clients
  FOR EACH ROW
  EXECUTE FUNCTION check_usage_limit();

-- Function to automatically increment usage after successful insert
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

  -- Upsert usage tracking record
  EXECUTE format('
    INSERT INTO usage_tracking (user_id, month_year, %I, quotes_created, invoices_created, jobs_created, clients_created, emails_sent, sms_sent)
    VALUES ($1, $2, 1, 0, 0, 0, 0, 0, 0)
    ON CONFLICT (user_id, month_year)
    DO UPDATE SET %I = usage_tracking.%I + 1
  ', limit_column, limit_column, limit_column)
  USING NEW.user_id, current_month;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers to auto-increment usage
-- These run AFTER INSERT to track actual creations
DROP TRIGGER IF EXISTS track_quote_usage ON quotes;
CREATE TRIGGER track_quote_usage
  AFTER INSERT ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION increment_usage_count();

DROP TRIGGER IF EXISTS track_invoice_usage ON invoices;
CREATE TRIGGER track_invoice_usage
  AFTER INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION increment_usage_count();

DROP TRIGGER IF EXISTS track_job_usage ON jobs;
CREATE TRIGGER track_job_usage
  AFTER INSERT ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION increment_usage_count();

DROP TRIGGER IF EXISTS track_client_usage ON clients;
CREATE TRIGGER track_client_usage
  AFTER INSERT ON clients
  FOR EACH ROW
  EXECUTE FUNCTION increment_usage_count();

-- Add comments for documentation
COMMENT ON FUNCTION check_usage_limit() IS 'Enforces subscription tier usage limits before entity creation';
COMMENT ON FUNCTION increment_usage_count() IS 'Automatically increments usage tracking after successful entity creation';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION check_usage_limit() TO authenticated;
GRANT EXECUTE ON FUNCTION increment_usage_count() TO authenticated;
