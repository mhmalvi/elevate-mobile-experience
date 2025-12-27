-- Performance Optimization: Add indexes for common query patterns
-- These indexes significantly improve query performance for list views and dashboard stats

-- Quotes table indexes
CREATE INDEX IF NOT EXISTS idx_quotes_user_created
  ON quotes(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quotes_user_status
  ON quotes(user_id, status);

-- Invoices table indexes
CREATE INDEX IF NOT EXISTS idx_invoices_user_created
  ON invoices(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_user_status
  ON invoices(user_id, status);

CREATE INDEX IF NOT EXISTS idx_invoices_user_due_date
  ON invoices(user_id, due_date)
  WHERE status NOT IN ('paid', 'cancelled');

-- Jobs table indexes
CREATE INDEX IF NOT EXISTS idx_jobs_user_created
  ON jobs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_jobs_user_status
  ON jobs(user_id, status);

CREATE INDEX IF NOT EXISTS idx_jobs_user_scheduled
  ON jobs(user_id, scheduled_date)
  WHERE status IN ('scheduled', 'in_progress');

-- Clients table indexes
CREATE INDEX IF NOT EXISTS idx_clients_user_name
  ON clients(user_id, name);

CREATE INDEX IF NOT EXISTS idx_clients_user_created
  ON clients(user_id, created_at DESC);

-- Quote line items for faster quote totals
CREATE INDEX IF NOT EXISTS idx_quote_line_items_quote
  ON quote_line_items(quote_id);

-- Invoice line items for faster invoice totals
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice
  ON invoice_line_items(invoice_id);

-- Profiles subscription lookups
CREATE INDEX IF NOT EXISTS idx_profiles_subscription
  ON profiles(subscription_tier, subscription_expires_at)
  WHERE subscription_tier IS NOT NULL;

COMMENT ON INDEX idx_quotes_user_created IS 'Optimizes quotes list page queries ordered by created_at';
COMMENT ON INDEX idx_quotes_user_status IS 'Optimizes dashboard stats queries filtering by status';
COMMENT ON INDEX idx_invoices_user_created IS 'Optimizes invoices list page queries ordered by created_at';
COMMENT ON INDEX idx_invoices_user_status IS 'Optimizes dashboard stats queries filtering by status';
COMMENT ON INDEX idx_invoices_user_due_date IS 'Optimizes overdue invoices queries (partial index)';
COMMENT ON INDEX idx_jobs_user_created IS 'Optimizes jobs list page queries ordered by created_at';
COMMENT ON INDEX idx_jobs_user_status IS 'Optimizes dashboard and job filtering by status';
COMMENT ON INDEX idx_jobs_user_scheduled IS 'Optimizes calendar view queries for scheduled jobs (partial index)';
COMMENT ON INDEX idx_clients_user_name IS 'Optimizes client search and autocomplete queries';
COMMENT ON INDEX idx_clients_user_created IS 'Optimizes clients list page queries';
COMMENT ON INDEX idx_profiles_subscription IS 'Optimizes subscription status checks (partial index)';
