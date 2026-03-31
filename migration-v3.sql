-- ============================================================
-- COFRE DE SENHAS v3 — SCHEMA COMPLETO
-- Usa Supabase Auth para autenticacao
-- Tabela "profiles" para dados extras do usuario
-- Rodar no Supabase SQL Editor (uma unica vez)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES (dados extras dos usuarios do Supabase Auth)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT NOT NULL DEFAULT 'Usuario',
  display_name TEXT,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  must_change_password BOOLEAN DEFAULT true,
  totp_secret TEXT,
  totp_enabled BOOLEAN DEFAULT false,
  password_expires_days INTEGER DEFAULT 90,
  password_changed_at TIMESTAMPTZ,
  last_login TIMESTAMPTZ,
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMPTZ,
  allowed_days TEXT DEFAULT '0,1,2,3,4,5,6',
  allowed_time_start TEXT DEFAULT '00:00',
  allowed_time_end TEXT DEFAULT '23:59',
  email_notifications BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TRIGGER: auto-criar profile quando user eh criado no Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuario')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. TENTATIVAS DE LOGIN
CREATE TABLE IF NOT EXISTS login_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT,
  ip_address TEXT,
  success BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. HIERARQUIA ORGANIZACIONAL
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sectors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. GRUPOS (com permissoes JSONB e vinculo ao setor)
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  sector_id UUID REFERENCES sectors(id) ON DELETE SET NULL,
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. MEMBROS DOS GRUPOS
CREATE TABLE IF NOT EXISTS group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- 7. CATEGORIAS DE SENHAS
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'folder',
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. SENHAS
CREATE TABLE IF NOT EXISTS passwords (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  system_name TEXT NOT NULL,
  url TEXT,
  username TEXT,
  encrypted_password TEXT NOT NULL,
  notes TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. VINCULO SENHA <-> GRUPO
CREATE TABLE IF NOT EXISTS password_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  password_id UUID NOT NULL REFERENCES passwords(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(password_id, group_id)
);

-- 10. LOGS DE AUDITORIA
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  user_name TEXT,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  resource_name TEXT,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. NOTIFICACOES
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT DEFAULT 'info',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. SESSOES ATIVAS
CREATE TABLE IF NOT EXISTS active_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  user_name TEXT,
  avatar_url TEXT,
  totp_enabled BOOLEAN DEFAULT false,
  ip_address TEXT,
  login_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity TIMESTAMPTZ DEFAULT NOW()
);

-- 13. TERMOS LGPD
CREATE TABLE IF NOT EXISTS terms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  version TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. ACEITES DE TERMOS
CREATE TABLE IF NOT EXISTS term_acceptances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  term_id UUID REFERENCES terms(id) ON DELETE CASCADE,
  term_version TEXT,
  full_name_typed TEXT,
  cpf TEXT,
  extra_email TEXT,
  ip_address TEXT,
  accepted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, term_id)
);

-- ============================================================
-- INDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_passwords_category ON passwords(category_id);
CREATE INDEX IF NOT EXISTS idx_passwords_created_by ON passwords(created_by);
CREATE INDEX IF NOT EXISTS idx_password_groups_password ON password_groups(password_id);
CREATE INDEX IF NOT EXISTS idx_password_groups_group ON password_groups(group_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_user ON active_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_groups_sector ON groups(sector_id);
CREATE INDEX IF NOT EXISTS idx_units_org ON units(organization_id);
CREATE INDEX IF NOT EXISTS idx_sectors_unit ON sectors(unit_id);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);

-- ============================================================
-- DADOS INICIAIS
-- ============================================================

INSERT INTO categories (name, icon, color) VALUES
  ('Sistemas Web', 'globe', '#4c6ef5'),
  ('Servidores', 'server', '#22c55e'),
  ('Email', 'mail', '#f59e0b'),
  ('Wi-Fi', 'wifi', '#06b6d4'),
  ('Banco de Dados', 'database', '#a855f7'),
  ('Redes Sociais', 'share-2', '#ec4899'),
  ('VPN / Seguranca', 'shield', '#ef4444'),
  ('Outros', 'folder', '#64748b')
ON CONFLICT DO NOTHING;

INSERT INTO organizations (name) VALUES ('Organizacao Principal');

INSERT INTO groups (name, description, color, permissions) VALUES (
  'Administradores',
  'Grupo com acesso total ao sistema',
  '#ef4444',
  '{"view_passwords":true,"create_passwords":true,"edit_passwords":true,"delete_passwords":true,"view_dashboard":true,"view_logs":true,"view_realtime":true,"manage_users":true,"manage_groups":true,"manage_terms":true,"manage_organization":true}'
);

INSERT INTO groups (name, description, color, permissions) VALUES (
  'Usuarios',
  'Acesso basico - visualizar e copiar senhas',
  '#6366f1',
  '{"view_passwords":true}'
);

-- ============================================================
-- PRONTO! Agora crie o usuario admin no Supabase Dashboard:
-- Authentication > Users > Add User
-- Depois rode no SQL Editor:
--
-- UPDATE profiles SET full_name = 'Administrador', must_change_password = false
-- WHERE email = 'SEU_EMAIL_AQUI';
--
-- INSERT INTO group_members (user_id, group_id)
-- SELECT p.id, g.id FROM profiles p, groups g
-- WHERE p.email = 'SEU_EMAIL_AQUI' AND g.name = 'Administradores';
-- ============================================================
