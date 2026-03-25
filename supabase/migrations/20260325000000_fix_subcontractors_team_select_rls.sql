-- Fix: subcontractors_team_select was missing deleted_at IS NULL filter.
-- Soft-deleted subcontractors were visible to team members because PostgreSQL
-- ORs all matching SELECT policies. This migration drops the old team policy
-- and recreates it with the deleted_at guard.

DROP POLICY IF EXISTS "subcontractors_team_select" ON public.subcontractors;

CREATE POLICY "subcontractors_team_select" ON public.subcontractors
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      user_id = auth.uid()
      OR team_id IN (
        SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
      )
    )
  );

-- Also add WITH CHECK to profiles_update to prevent user_id takeover
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
