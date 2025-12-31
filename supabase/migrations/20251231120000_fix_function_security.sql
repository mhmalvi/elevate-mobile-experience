-- Fix search_path security vulnerability for database functions
-- This prevents SQL injection attacks via search_path manipulation
-- Reference: https://www.postgresql.org/docs/current/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY

-- Fix update_branding_settings_updated_at function (no security definer, but add for consistency)
ALTER FUNCTION public.update_branding_settings_updated_at()
  SET search_path = public, pg_temp;

-- Fix get_user_team_role function (correct signature: two uuid parameters)
ALTER FUNCTION public.get_user_team_role(p_team_id uuid, p_user_id uuid)
  SET search_path = public, pg_temp;

-- Fix user_is_team_member function (already security definer)
ALTER FUNCTION public.user_is_team_member(p_team_id uuid, p_user_id uuid)
  SECURITY DEFINER SET search_path = public, pg_temp;

-- Fix user_has_team_role function (already security definer, correct signature)
ALTER FUNCTION public.user_has_team_role(p_team_id uuid, p_user_id uuid, p_roles text[])
  SECURITY DEFINER SET search_path = public, pg_temp;

-- Fix test_auth function (already security definer)
ALTER FUNCTION public.test_auth()
  SECURITY DEFINER SET search_path = public, pg_temp;
