-- Consolidated migration for new features
-- Applies: Custom Branding and Team Support
-- Date: 2025-12-28

-- ============================================================================
-- PART 1: Custom Branding (from 20251228130000_add_custom_branding.sql)
-- ============================================================================

-- Create branding_settings table
CREATE TABLE IF NOT EXISTS branding_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Logo settings
  logo_url TEXT,
  logo_position TEXT DEFAULT 'left' CHECK (logo_position IN ('left', 'center', 'right')),
  show_logo_on_documents BOOLEAN DEFAULT true,

  -- Color settings
  primary_color TEXT DEFAULT '#3b82f6',
  secondary_color TEXT DEFAULT '#8b5cf6',
  text_color TEXT DEFAULT '#1f2937',
  accent_color TEXT DEFAULT '#10b981',

  -- Email branding
  email_header_color TEXT DEFAULT '#3b82f6',
  email_footer_text TEXT,
  email_signature TEXT,

  -- Document branding
  document_header_style TEXT DEFAULT 'gradient' CHECK (document_header_style IN ('gradient', 'solid', 'minimal')),
  default_quote_terms TEXT,
  default_invoice_terms TEXT,
  document_footer_text TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one branding settings per user
  UNIQUE(user_id)
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_branding_settings_user_id ON branding_settings(user_id);

-- Enable RLS
ALTER TABLE branding_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'branding_settings' AND policyname = 'Users can view their own branding settings') THEN
    CREATE POLICY "Users can view their own branding settings"
      ON branding_settings FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'branding_settings' AND policyname = 'Users can insert their own branding settings') THEN
    CREATE POLICY "Users can insert their own branding settings"
      ON branding_settings FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'branding_settings' AND policyname = 'Users can update their own branding settings') THEN
    CREATE POLICY "Users can update their own branding settings"
      ON branding_settings FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'branding_settings' AND policyname = 'Users can delete their own branding settings') THEN
    CREATE POLICY "Users can delete their own branding settings"
      ON branding_settings FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_branding_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_branding_settings_timestamp ON branding_settings;
CREATE TRIGGER update_branding_settings_timestamp
  BEFORE UPDATE ON branding_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_branding_settings_updated_at();

-- ============================================================================
-- PART 2: Team Support (from 20251228140000_add_team_support.sql)
-- ============================================================================

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_tier TEXT DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Team members with roles
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

-- Team invitations
CREATE TABLE IF NOT EXISTS team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'member', 'viewer')),
  token TEXT NOT NULL UNIQUE,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accepted BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_teams_owner ON teams(owner_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_token ON team_invitations(token);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON team_invitations(email);

-- Add team_id to existing tables
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'team_id') THEN
    ALTER TABLE profiles ADD COLUMN team_id UUID REFERENCES teams(id) ON DELETE SET NULL;
    CREATE INDEX idx_profiles_team ON profiles(team_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'team_id') THEN
    ALTER TABLE quotes ADD COLUMN team_id UUID REFERENCES teams(id) ON DELETE CASCADE;
    CREATE INDEX idx_quotes_team ON quotes(team_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'team_id') THEN
    ALTER TABLE invoices ADD COLUMN team_id UUID REFERENCES teams(id) ON DELETE CASCADE;
    CREATE INDEX idx_invoices_team ON invoices(team_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'team_id') THEN
    ALTER TABLE clients ADD COLUMN team_id UUID REFERENCES teams(id) ON DELETE CASCADE;
    CREATE INDEX idx_clients_team ON clients(team_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'jobs') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'team_id') THEN
      ALTER TABLE jobs ADD COLUMN team_id UUID REFERENCES teams(id) ON DELETE CASCADE;
      CREATE INDEX idx_jobs_team ON jobs(team_id);
    END IF;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

-- Teams policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'teams' AND policyname = 'Users can view their team') THEN
    CREATE POLICY "Users can view their team"
      ON teams FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM team_members
          WHERE team_members.team_id = teams.id
          AND team_members.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Helper Functions
CREATE OR REPLACE FUNCTION get_user_team_role(p_team_id UUID, p_user_id UUID)
RETURNS TEXT AS $$
  SELECT role FROM team_members
  WHERE team_id = p_team_id AND user_id = p_user_id
  LIMIT 1;
$$ LANGUAGE SQL STABLE;

COMMENT ON TABLE branding_settings IS 'Stores custom branding settings for users';
COMMENT ON TABLE teams IS 'Teams for multi-user collaboration';
COMMENT ON TABLE team_members IS 'Team membership and roles';
