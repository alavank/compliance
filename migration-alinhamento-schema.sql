-- ============================================================
-- ALINHAMENTO DE SCHEMA COM O CODIGO ATUAL
-- Rode no Supabase SQL Editor
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------
-- profiles
-- ------------------------------------------------------------
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user',
ADD COLUMN IF NOT EXISTS cpf TEXT;

UPDATE public.profiles
SET role = COALESCE(NULLIF(role, ''), 'user');

-- ------------------------------------------------------------
-- groups
-- ------------------------------------------------------------
ALTER TABLE public.groups
ADD COLUMN IF NOT EXISTS created_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ------------------------------------------------------------
-- organizations: organograma flexivel
-- ------------------------------------------------------------
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'Organizacao',
ADD COLUMN IF NOT EXISTS parent_id UUID NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS created_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.organizations
SET type = COALESCE(NULLIF(type, ''), 'Organizacao');

CREATE INDEX IF NOT EXISTS idx_organizations_parent_id ON public.organizations(parent_id);

-- ------------------------------------------------------------
-- passwords
-- ------------------------------------------------------------
ALTER TABLE public.passwords
ADD COLUMN IF NOT EXISTS iv TEXT,
ADD COLUMN IF NOT EXISTS auth_tag TEXT,
ADD COLUMN IF NOT EXISTS organization_id UUID NULL REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_passwords_organization_id ON public.passwords(organization_id);

-- ------------------------------------------------------------
-- active_sessions
-- ------------------------------------------------------------
ALTER TABLE public.active_sessions
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS current_module TEXT,
ADD COLUMN IF NOT EXISTS current_action TEXT DEFAULT 'login',
ADD COLUMN IF NOT EXISTS user_agent TEXT;

UPDATE public.active_sessions
SET started_at = COALESCE(started_at, login_at, NOW())
WHERE started_at IS NULL;

-- ------------------------------------------------------------
-- user_organizations
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_user_organizations_user_id ON public.user_organizations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_organizations_organization_id ON public.user_organizations(organization_id);

-- ------------------------------------------------------------
-- password_exceptions
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.password_exceptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  password_id UUID NOT NULL REFERENCES public.passwords(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(password_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_password_exceptions_password_id ON public.password_exceptions(password_id);
CREATE INDEX IF NOT EXISTS idx_password_exceptions_user_id ON public.password_exceptions(user_id);

-- ------------------------------------------------------------
-- password_history
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.password_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  password_id UUID NOT NULL REFERENCES public.passwords(id) ON DELETE CASCADE,
  encrypted_password TEXT NOT NULL,
  iv TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  changed_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_history_password_id ON public.password_history(password_id);

-- ------------------------------------------------------------
-- password_requests
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.password_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requester_name TEXT,
  system_name TEXT NOT NULL,
  url TEXT,
  username TEXT,
  notes TEXT,
  category_id UUID NULL REFERENCES public.categories(id) ON DELETE SET NULL,
  organization_id UUID NULL REFERENCES public.organizations(id) ON DELETE SET NULL,
  assigned_to JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'pending',
  admin_notes TEXT,
  resolved_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_requests_requester_id ON public.password_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_password_requests_status ON public.password_requests(status);
