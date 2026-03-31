-- =============================================
-- FASE 5: Compliance Core (Denuncias, LGPD, Treinamentos)
-- =============================================

-- Canal de denuncias
CREATE TABLE IF NOT EXISTS complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT 'GENERAL'
    CHECK (category IN ('CORRUPTION', 'HARASSMENT', 'FRAUD', 'ETHICS', 'SAFETY', 'DISCRIMINATION', 'GENERAL')),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  is_anonymous BOOLEAN DEFAULT true,
  reporter_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reporter_name TEXT,
  reporter_email TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'IN_REVIEW', 'INVESTIGATING', 'RESOLVED', 'DISMISSED', 'CLOSED')),
  priority TEXT DEFAULT 'MEDIUM'
    CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolution TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_complaints_protocol ON complaints(protocol);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_category ON complaints(category);
CREATE INDEX IF NOT EXISTS idx_complaints_assigned ON complaints(assigned_to);

-- Mensagens do canal de denuncia (thread)
CREATE TABLE IF NOT EXISTS complaint_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL DEFAULT 'REPORTER'
    CHECK (sender_type IN ('REPORTER', 'HANDLER', 'SYSTEM')),
  sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_complaint_messages_complaint ON complaint_messages(complaint_id);

-- Demandas de titulares LGPD
CREATE TABLE IF NOT EXISTS lgpd_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol TEXT NOT NULL UNIQUE,
  request_type TEXT NOT NULL
    CHECK (request_type IN ('ACCESS', 'CORRECTION', 'DELETION', 'PORTABILITY', 'REVOKE_CONSENT', 'INFORMATION')),
  requester_name TEXT NOT NULL,
  requester_email TEXT NOT NULL,
  requester_cpf TEXT,
  requester_phone TEXT,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'RECEIVED'
    CHECK (status IN ('RECEIVED', 'IN_ANALYSIS', 'IN_PROGRESS', 'AWAITING_INFO', 'COMPLETED', 'DENIED')),
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  response TEXT,
  legal_basis TEXT,
  due_date DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lgpd_requests_protocol ON lgpd_requests(protocol);
CREATE INDEX IF NOT EXISTS idx_lgpd_requests_status ON lgpd_requests(status);
CREATE INDEX IF NOT EXISTS idx_lgpd_requests_type ON lgpd_requests(request_type);

-- Treinamentos
CREATE TABLE IF NOT EXISTS trainings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  training_type TEXT DEFAULT 'COMPLIANCE'
    CHECK (training_type IN ('COMPLIANCE', 'LGPD', 'SECURITY', 'ONBOARDING', 'TECHNICAL', 'GENERAL')),
  kb_article_id UUID REFERENCES kb_articles(id) ON DELETE SET NULL,
  duration_minutes INTEGER DEFAULT 60,
  is_mandatory BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  passing_score INTEGER DEFAULT 70,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trainings_type ON trainings(training_type);
CREATE INDEX IF NOT EXISTS idx_trainings_kb ON trainings(kb_article_id);

-- Atribuicoes de treinamento
CREATE TABLE IF NOT EXISTS training_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id UUID NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'EXEMPTED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(training_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_training_assignments_training ON training_assignments(training_id);
CREATE INDEX IF NOT EXISTS idx_training_assignments_user ON training_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_training_assignments_status ON training_assignments(status);

-- Conclusoes de treinamento
CREATE TABLE IF NOT EXISTS training_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES training_assignments(id) ON DELETE CASCADE,
  training_id UUID NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  score INTEGER,
  passed BOOLEAN DEFAULT false,
  time_spent_minutes INTEGER,
  certificate_url TEXT,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_completions_user ON training_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_training_completions_training ON training_completions(training_id);
