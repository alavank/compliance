-- ============================================================
-- CAMPOS ADICIONAIS PARA TERMOS LGPD
-- Rode no Supabase SQL Editor
-- ============================================================

ALTER TABLE public.terms
ADD COLUMN IF NOT EXISTS elaboration_date DATE,
ADD COLUMN IF NOT EXISTS created_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL;
