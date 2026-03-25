-- ==========================================================================
-- Team-scoped RLS for timesheets and expenses:
-- Team owners/admins can view team member timesheets (for approval) and expenses.
-- ==========================================================================

-- ========== 1. Timesheets: team admins can view for approval =================

-- Drop the existing SELECT policy and recreate with team scope
DROP POLICY IF EXISTS "Users can view own timesheets" ON public.timesheets;
CREATE POLICY "Users can view own or team timesheets" ON public.timesheets
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR auth.uid() = member_id
    OR (
      team_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.team_id = timesheets.team_id
          AND tm.user_id = auth.uid()
          AND tm.role IN ('owner', 'admin')
      )
    )
  );

-- Also allow team admins to update timesheets (approve/reject)
DROP POLICY IF EXISTS "Users can update own timesheets" ON public.timesheets;
CREATE POLICY "Users can update own or team timesheets" ON public.timesheets
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR auth.uid() = member_id
    OR (
      team_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.team_id = timesheets.team_id
          AND tm.user_id = auth.uid()
          AND tm.role IN ('owner', 'admin')
      )
    )
  );

-- Timesheet entries: team admins can view entries for timesheets they can see
DROP POLICY IF EXISTS "Users can view own timesheet entries" ON public.timesheet_entries;
CREATE POLICY "Users can view own or team timesheet entries" ON public.timesheet_entries
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.timesheets t
      WHERE t.id = timesheet_entries.timesheet_id
        AND (
          t.user_id = auth.uid()
          OR t.member_id = auth.uid()
          OR (
            t.team_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM public.team_members tm
              WHERE tm.team_id = t.team_id
                AND tm.user_id = auth.uid()
                AND tm.role IN ('owner', 'admin')
            )
          )
        )
    )
  );

-- ========== 2. Expenses: team admins can view team expenses ==================

DROP POLICY IF EXISTS "Users can view own expenses" ON public.expenses;
CREATE POLICY "Users can view own or team expenses" ON public.expenses
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      auth.uid() = user_id
      OR (
        team_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.team_members tm
          WHERE tm.team_id = expenses.team_id
            AND tm.user_id = auth.uid()
            AND tm.role IN ('owner', 'admin')
        )
      )
    )
  );
