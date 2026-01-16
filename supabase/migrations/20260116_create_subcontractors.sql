-- Create subcontractors table
CREATE TABLE IF NOT EXISTS public.subcontractors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    trade TEXT NOT NULL DEFAULT '',
    phone TEXT,
    email TEXT,
    abn TEXT,
    hourly_rate DECIMAL(10,2),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE public.subcontractors ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own subcontractors
CREATE POLICY "Users can view own subcontractors"
    ON public.subcontractors
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can create their own subcontractors
CREATE POLICY "Users can create own subcontractors"
    ON public.subcontractors
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own subcontractors
CREATE POLICY "Users can update own subcontractors"
    ON public.subcontractors
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Policy: Users can delete their own subcontractors
CREATE POLICY "Users can delete own subcontractors"
    ON public.subcontractors
    FOR DELETE
    USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_subcontractors_user_id ON public.subcontractors(user_id);

-- Grant access to authenticated users
GRANT ALL ON public.subcontractors TO authenticated;
