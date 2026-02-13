ALTER TABLE jobs ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_assigned_to ON jobs(assigned_to);
