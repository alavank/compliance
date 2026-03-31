-- ============================================================
-- ORGANOGRAMA FLEXIVEL
-- Ajusta a tabela organizations para suportar arvore livre
-- Rode no Supabase SQL Editor
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'Organizacao',
ADD COLUMN IF NOT EXISTS parent_id UUID NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS created_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.organizations
SET type = COALESCE(NULLIF(type, ''), 'Organizacao');

CREATE INDEX IF NOT EXISTS idx_organizations_parent_id ON public.organizations(parent_id);

CREATE TABLE IF NOT EXISTS public.user_organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_user_organizations_user_id ON public.user_organizations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_organizations_organization_id ON public.user_organizations(organization_id);
