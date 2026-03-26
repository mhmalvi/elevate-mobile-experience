-- DB-M3: Add soft-delete support to subcontractors table.
-- All other entities use deleted_at for soft-delete; subcontractors should too.

BEGIN;

-- Add deleted_at column
ALTER TABLE public.subcontractors
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_subcontractors_user_deleted
    ON public.subcontractors(user_id, deleted_at);

-- Recreate SELECT policy to exclude soft-deleted rows
DROP POLICY IF EXISTS "Users can view own subcontractors" ON public.subcontractors;
CREATE POLICY "Users can view own subcontractors"
    ON public.subcontractors
    FOR SELECT
    USING (auth.uid() = user_id AND deleted_at IS NULL);

-- Recreate UPDATE policy to exclude soft-deleted rows
DROP POLICY IF EXISTS "Users can update own subcontractors" ON public.subcontractors;
CREATE POLICY "Users can update own subcontractors"
    ON public.subcontractors
    FOR UPDATE
    USING (auth.uid() = user_id AND deleted_at IS NULL);

-- Recreate DELETE policy to exclude soft-deleted rows
DROP POLICY IF EXISTS "Users can delete own subcontractors" ON public.subcontractors;
CREATE POLICY "Users can delete own subcontractors"
    ON public.subcontractors
    FOR DELETE
    USING (auth.uid() = user_id AND deleted_at IS NULL);

COMMIT;
