-- =============================================
-- FASE 1: Cofres (Vaults) e Acesso de Emergencia
-- =============================================

-- Cofres agrupam senhas por departamento/time
CREATE TABLE IF NOT EXISTS vaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'lock',
  color TEXT DEFAULT '#6366f1',
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vaults_organization ON vaults(organization_id);
CREATE INDEX IF NOT EXISTS idx_vaults_created_by ON vaults(created_by);

-- Membros do cofre com permissao granular
CREATE TABLE IF NOT EXISTS vault_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id UUID NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  permission_level TEXT NOT NULL DEFAULT 'VIEW'
    CHECK (permission_level IN ('VIEW', 'USE_ONLY', 'EDIT', 'MANAGE')),
  granted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vault_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_vault_members_vault ON vault_members(vault_id);
CREATE INDEX IF NOT EXISTS idx_vault_members_user ON vault_members(user_id);

-- Acesso de emergencia (break glass)
CREATE TABLE IF NOT EXISTS emergency_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id UUID NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'APPROVED', 'DENIED', 'EXPIRED', 'USED')),
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  accessed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '4 hours'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emergency_access_vault ON emergency_access(vault_id);
CREATE INDEX IF NOT EXISTS idx_emergency_access_user ON emergency_access(user_id);
CREATE INDEX IF NOT EXISTS idx_emergency_access_status ON emergency_access(status);

-- Log dedicado de acesso a segredos
CREATE TABLE IF NOT EXISTS secret_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  password_id UUID REFERENCES passwords(id) ON DELETE SET NULL,
  vault_id UUID REFERENCES vaults(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_name TEXT,
  action TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_secret_access_logs_password ON secret_access_logs(password_id);
CREATE INDEX IF NOT EXISTS idx_secret_access_logs_vault ON secret_access_logs(vault_id);
CREATE INDEX IF NOT EXISTS idx_secret_access_logs_user ON secret_access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_secret_access_logs_created ON secret_access_logs(created_at DESC);

-- Adicionar vault_id na tabela passwords
ALTER TABLE passwords ADD COLUMN IF NOT EXISTS vault_id UUID REFERENCES vaults(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_passwords_vault ON passwords(vault_id);
