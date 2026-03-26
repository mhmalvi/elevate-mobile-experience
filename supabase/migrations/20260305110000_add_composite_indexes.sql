-- Composite indexes for soft-delete queries
-- These indexes speed up the common pattern: WHERE user_id = ? AND deleted_at IS NULL

CREATE INDEX IF NOT EXISTS idx_clients_user_deleted ON clients(user_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_invoices_user_deleted ON invoices(user_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_quotes_user_deleted ON quotes(user_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_jobs_user_deleted ON jobs(user_id, deleted_at);
