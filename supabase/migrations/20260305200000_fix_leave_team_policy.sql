-- Fix migration ordering: the original 20240131_add_leave_team_policy.sql referenced
-- team_members which doesn't exist until 20251228150000. This migration recreates
-- the same policy at a safe point in the migration sequence.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'team_members'
        AND policyname = 'Users can delete their own team membership'
    ) THEN
        CREATE POLICY "Users can delete their own team membership"
        ON public.team_members
        FOR DELETE
        USING (auth.uid() = user_id);
    END IF;
END
$$;
