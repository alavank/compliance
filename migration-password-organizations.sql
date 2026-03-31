-- ============================================================
-- VINCULO MULTIPLO DE SENHAS COM O ORGANOGRAMA
-- Rode no Supabase SQL Editor
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.password_organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  password_id UUID NOT NULL REFERENCES public.passwords(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(password_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_password_organizations_password_id
  ON public.password_organizations(password_id);

CREATE INDEX IF NOT EXISTS idx_password_organizations_organization_id
  ON public.password_organizations(organization_id);

INSERT INTO public.password_organizations (password_id, organization_id)
SELECT p.id, p.organization_id
FROM public.passwords p
WHERE p.organization_id IS NOT NULL
ON CONFLICT (password_id, organization_id) DO NOTHING;
