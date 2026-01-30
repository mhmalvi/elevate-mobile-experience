-- Fix for PostgREST relationship detection
-- PostgREST needs a clear Foreign Key relationship to embed resources
-- This adds a relationship between team_members and profiles

-- 1. Ensure profiles.user_id is unique (it should be, as it's 1:1 with auth.users)
-- We check if it's already a PK or has a unique index
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'public.profiles'::regclass 
        AND (contype = 'p' OR contype = 'u')
        AND array_length(conkey, 1) = 1
        AND (
            SELECT attname FROM pg_attribute 
            WHERE attrelid = 'public.profiles'::regclass 
            AND attnum = conkey[1]
        ) = 'user_id'
    ) THEN
        ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);
    END IF;
END $$;

-- 2. Add Foreign Key from team_members.user_id to profiles.user_id
-- This allows PostgREST to infer the relationship team_members -> profiles
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'team_members_user_id_fkey_profiles'
    ) THEN
        ALTER TABLE public.team_members
        ADD CONSTRAINT team_members_user_id_fkey_profiles
        FOREIGN KEY (user_id)
        REFERENCES public.profiles(user_id)
        ON DELETE CASCADE;
    END IF;
END $$;
