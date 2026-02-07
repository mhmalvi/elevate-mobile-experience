-- Staff Timesheets feature
-- Weekly timesheets for team members with daily entries and approval workflow

-- Main timesheets table (one per team member per week)
CREATE TABLE IF NOT EXISTS public.timesheets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    week_starting DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
    total_hours DECIMAL(6,2) DEFAULT 0,
    notes TEXT,
    approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(member_id, week_starting)
);

-- Daily timesheet entries (multiple per timesheet)
CREATE TABLE IF NOT EXISTS public.timesheet_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timesheet_id UUID NOT NULL REFERENCES public.timesheets(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    break_minutes INTEGER DEFAULT 0,
    hours DECIMAL(5,2) NOT NULL DEFAULT 0,
    job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_timesheets_user_id ON public.timesheets(user_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_member_id ON public.timesheets(member_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_team_id ON public.timesheets(team_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_week_starting ON public.timesheets(week_starting);
CREATE INDEX IF NOT EXISTS idx_timesheets_status ON public.timesheets(status);
CREATE INDEX IF NOT EXISTS idx_timesheet_entries_timesheet_id ON public.timesheet_entries(timesheet_id);
CREATE INDEX IF NOT EXISTS idx_timesheet_entries_date ON public.timesheet_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_timesheet_entries_job_id ON public.timesheet_entries(job_id);

-- Enable RLS
ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timesheet_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for timesheets
CREATE POLICY "Users can view own timesheets"
    ON public.timesheets FOR SELECT
    USING (auth.uid() = user_id OR auth.uid() = member_id);

CREATE POLICY "Users can insert own timesheets"
    ON public.timesheets FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own timesheets"
    ON public.timesheets FOR UPDATE
    USING (auth.uid() = user_id OR auth.uid() = member_id);

CREATE POLICY "Users can delete own timesheets"
    ON public.timesheets FOR DELETE
    USING (auth.uid() = user_id);

-- RLS Policies for timesheet_entries
CREATE POLICY "Users can view own timesheet entries"
    ON public.timesheet_entries FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.timesheets t
        WHERE t.id = timesheet_id
        AND (t.user_id = auth.uid() OR t.member_id = auth.uid())
    ));

CREATE POLICY "Users can insert own timesheet entries"
    ON public.timesheet_entries FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.timesheets t
        WHERE t.id = timesheet_id
        AND (t.user_id = auth.uid() OR t.member_id = auth.uid())
    ));

CREATE POLICY "Users can update own timesheet entries"
    ON public.timesheet_entries FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM public.timesheets t
        WHERE t.id = timesheet_id
        AND (t.user_id = auth.uid() OR t.member_id = auth.uid())
    ));

CREATE POLICY "Users can delete own timesheet entries"
    ON public.timesheet_entries FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM public.timesheets t
        WHERE t.id = timesheet_id
        AND (t.user_id = auth.uid() OR t.member_id = auth.uid())
    ));

-- Grant permissions
GRANT ALL ON public.timesheets TO authenticated;
GRANT ALL ON public.timesheet_entries TO authenticated;
