-- Grant permissions to team_invitations table
-- This is often required when creating tables manually or via different roles
GRANT ALL ON TABLE public.team_invitations TO postgres;
GRANT ALL ON TABLE public.team_invitations TO service_role;
GRANT ALL ON TABLE public.team_invitations TO authenticated;

-- Ensure Sequence permissions if any (not needed for uuid but good practice)
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Verify RLS is enabled
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;
