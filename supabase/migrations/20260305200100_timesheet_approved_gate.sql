-- DB-M2: Prevent modification of timesheet_entries when the parent timesheet
-- has been approved. This ensures approved timesheets are immutable.

BEGIN;

-- Drop existing UPDATE policy on timesheet_entries
DROP POLICY IF EXISTS "Users can update own timesheet entries" ON public.timesheet_entries;

-- Recreate UPDATE policy with approved-status gate
CREATE POLICY "Users can update own timesheet entries"
    ON public.timesheet_entries FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.timesheets t
            WHERE t.id = timesheet_entries.timesheet_id
            AND (t.user_id = auth.uid() OR t.member_id = auth.uid())
            AND t.status <> 'approved'
        )
    );

-- Drop existing DELETE policy on timesheet_entries
DROP POLICY IF EXISTS "Users can delete own timesheet entries" ON public.timesheet_entries;

-- Recreate DELETE policy with approved-status gate
CREATE POLICY "Users can delete own timesheet entries"
    ON public.timesheet_entries FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.timesheets t
            WHERE t.id = timesheet_entries.timesheet_id
            AND (t.user_id = auth.uid() OR t.member_id = auth.uid())
            AND t.status <> 'approved'
        )
    );

COMMIT;
