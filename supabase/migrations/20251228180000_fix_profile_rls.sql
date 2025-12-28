-- Fix RLS policies for profiles table to resolve permission denied errors
-- This ensures authenticated users can access their own profiles

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Recreate SELECT policy with explicit USING clause
CREATE POLICY "Users can view their own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Recreate INSERT policy
CREATE POLICY "Users can insert their own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Recreate UPDATE policy with both USING and WITH CHECK
CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add DELETE policy (in case it's needed)
DROP POLICY IF EXISTS "Users can delete their own profile" ON public.profiles;
CREATE POLICY "Users can delete their own profile"
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;

-- Verify RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

COMMENT ON POLICY "Users can view their own profile" ON public.profiles IS 'Allows authenticated users to view their own profile';
COMMENT ON POLICY "Users can update their own profile" ON public.profiles IS 'Allows authenticated users to update their own profile';
