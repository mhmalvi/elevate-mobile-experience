-- Function to safely fetch invitation details by token
-- Bypasses RLS to allow reading Team Name even if not a member yet
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(lookup_token text)
RETURNS TABLE (
  id uuid,
  email text,
  role text,
  token text,
  accepted boolean,
  expires_at timestamptz,
  team_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ti.id,
    ti.email,
    ti.role,
    ti.token,
    ti.accepted,
    ti.expires_at,
    t.name as team_name
  FROM team_invitations ti
  JOIN teams t ON t.id = ti.team_id
  WHERE ti.token = lookup_token
  AND ti.accepted = false;
END;
$$;

-- Grant access to everyone (public)
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO service_role;
