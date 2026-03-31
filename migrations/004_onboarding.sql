-- =============================================
-- FASE 4: Onboarding / Offboarding
-- =============================================

-- Perfis de cargo
CREATE TABLE IF NOT EXISTS job_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  default_role TEXT DEFAULT 'user',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_profiles_org ON job_profiles(organization_id);

-- Templates de onboarding por perfil
CREATE TABLE IF NOT EXISTS onboarding_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  template_type TEXT NOT NULL DEFAULT 'ONBOARDING'
    CHECK (template_type IN ('ONBOARDING', 'OFFBOARDING')),
  job_profile_id UUID REFERENCES job_profiles(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onb_templates_profile ON onboarding_templates(job_profile_id);
CREATE INDEX IF NOT EXISTS idx_onb_templates_org ON onboarding_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_onb_templates_type ON onboarding_templates(template_type);

-- Tarefas do template
CREATE TABLE IF NOT EXISTS onboarding_template_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES onboarding_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT DEFAULT 'MANUAL'
    CHECK (task_type IN ('MANUAL', 'READ_ARTICLE', 'ACCESS_VAULT', 'REVIEW_CI', 'SIGN_DOCUMENT', 'TRAINING')),
  sort_order INTEGER DEFAULT 0,
  is_required BOOLEAN DEFAULT true,
  due_days INTEGER DEFAULT 7,
  assigned_role TEXT,
  -- Referencias cruzadas opcionais
  kb_article_id UUID REFERENCES kb_articles(id) ON DELETE SET NULL,
  vault_id UUID REFERENCES vaults(id) ON DELETE SET NULL,
  secret_id UUID REFERENCES passwords(id) ON DELETE SET NULL,
  ci_id UUID REFERENCES configuration_items(id) ON DELETE SET NULL,
  runbook_id UUID REFERENCES runbooks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onb_tasks_template ON onboarding_template_tasks(template_id);

-- Instancias de onboarding (para cada servidor)
CREATE TABLE IF NOT EXISTS onboarding_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES onboarding_templates(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  instance_type TEXT NOT NULL DEFAULT 'ONBOARDING'
    CHECK (instance_type IN ('ONBOARDING', 'OFFBOARDING')),
  status TEXT NOT NULL DEFAULT 'IN_PROGRESS'
    CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  due_date DATE,
  notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onb_instances_user ON onboarding_instances(user_id);
CREATE INDEX IF NOT EXISTS idx_onb_instances_template ON onboarding_instances(template_id);
CREATE INDEX IF NOT EXISTS idx_onb_instances_status ON onboarding_instances(status);

-- Tarefas da instancia (copiadas do template)
CREATE TABLE IF NOT EXISTS onboarding_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES onboarding_instances(id) ON DELETE CASCADE,
  template_task_id UUID REFERENCES onboarding_template_tasks(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT DEFAULT 'MANUAL',
  sort_order INTEGER DEFAULT 0,
  is_required BOOLEAN DEFAULT true,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'BLOCKED')),
  due_date DATE,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  evidence_url TEXT,
  evidence_notes TEXT,
  -- Referencias cruzadas
  kb_article_id UUID REFERENCES kb_articles(id) ON DELETE SET NULL,
  vault_id UUID REFERENCES vaults(id) ON DELETE SET NULL,
  secret_id UUID REFERENCES passwords(id) ON DELETE SET NULL,
  ci_id UUID REFERENCES configuration_items(id) ON DELETE SET NULL,
  runbook_id UUID REFERENCES runbooks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onb_instance_tasks_instance ON onboarding_tasks(instance_id);
CREATE INDEX IF NOT EXISTS idx_onb_instance_tasks_status ON onboarding_tasks(status);
