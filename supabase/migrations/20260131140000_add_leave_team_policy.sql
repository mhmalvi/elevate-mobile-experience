-- Allow users to delete their own team membership (Leave Team)
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
