-- Users: allow local auth
ALTER TABLE users
  ALTER COLUMN auth_provider DROP DEFAULT;

ALTER TABLE users
  ALTER COLUMN auth_provider SET DEFAULT 'local';

-- Make auth_provider_id optional (Auth0 legacy)
ALTER TABLE users
  ALTER COLUMN auth_provider_id DROP NOT NULL;

-- Add password_hash for local auth
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Optional: status flags (safe defaults)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) NOT NULL DEFAULT 'active';

-- Organizations (business accounts)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(120) UNIQUE NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT org_name_len CHECK (LENGTH(name) >= 2 AND LENGTH(name) <= 255),
  CONSTRAINT org_slug_len CHECK (LENGTH(slug) >= 2 AND LENGTH(slug) <= 120)
);

CREATE TABLE IF NOT EXISTS organization_members (
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (org_id, user_id),
  CONSTRAINT org_role_check CHECK (role IN ('owner','admin','editor','viewer'))
);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);

-- Projects: rename user_id -> owner_user_id, add owner_org_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='projects' AND column_name='user_id'
  ) THEN
    ALTER TABLE projects RENAME COLUMN user_id TO owner_user_id;
  END IF;
END $$;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS owner_org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Ensure at least one owner is set (personal OR org)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='projects_owner_oneof'
  ) THEN
    ALTER TABLE projects
      ADD CONSTRAINT projects_owner_oneof
      CHECK (
        (owner_user_id IS NOT NULL AND owner_org_id IS NULL)
        OR
        (owner_user_id IS NULL AND owner_org_id IS NOT NULL)
      );
  END IF;
END $$;

-- Update indexes (keep old name if exists, create new safely)
DROP INDEX IF EXISTS idx_projects_user_id;
CREATE INDEX IF NOT EXISTS idx_projects_owner_user_id ON projects(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_projects_owner_org_id ON projects(owner_org_id);
