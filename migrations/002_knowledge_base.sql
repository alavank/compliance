-- =============================================
-- FASE 2: Base de Conhecimento
-- =============================================

-- Bases de conhecimento por area
CREATE TABLE IF NOT EXISTS kb_bases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'book-open',
  color TEXT DEFAULT '#6366f1',
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  visibility TEXT NOT NULL DEFAULT 'INTERNAL'
    CHECK (visibility IN ('INTERNAL', 'DEPARTMENT_ONLY', 'PUBLIC')),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_bases_org ON kb_bases(organization_id);

-- Categorias hierarquicas
CREATE TABLE IF NOT EXISTS kb_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID NOT NULL REFERENCES kb_bases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'folder',
  parent_id UUID REFERENCES kb_categories(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_categories_base ON kb_categories(base_id);
CREATE INDEX IF NOT EXISTS idx_kb_categories_parent ON kb_categories(parent_id);

-- Artigos
CREATE TABLE IF NOT EXISTS kb_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID NOT NULL REFERENCES kb_bases(id) ON DELETE CASCADE,
  category_id UUID REFERENCES kb_categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  slug TEXT,
  content TEXT NOT NULL DEFAULT '',
  summary TEXT,
  article_type TEXT NOT NULL DEFAULT 'TUTORIAL'
    CHECK (article_type IN ('POP', 'TUTORIAL', 'FAQ', 'RUNBOOK_TI', 'POLITICA', 'MANUAL')),
  visibility TEXT NOT NULL DEFAULT 'INTERNAL'
    CHECK (visibility IN ('INTERNAL', 'DEPARTMENT_ONLY', 'PUBLIC')),
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  view_count INTEGER DEFAULT 0,
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_articles_base ON kb_articles(base_id);
CREATE INDEX IF NOT EXISTS idx_kb_articles_category ON kb_articles(category_id);
CREATE INDEX IF NOT EXISTS idx_kb_articles_type ON kb_articles(article_type);
CREATE INDEX IF NOT EXISTS idx_kb_articles_status ON kb_articles(status);
CREATE INDEX IF NOT EXISTS idx_kb_articles_search ON kb_articles USING gin(to_tsvector('portuguese', coalesce(title, '') || ' ' || coalesce(content, '')));

-- Versionamento de artigos
CREATE TABLE IF NOT EXISTS kb_article_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  change_notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(article_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_kb_versions_article ON kb_article_versions(article_id);

-- Labels/tags
CREATE TABLE IF NOT EXISTS kb_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#64748b',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kb_article_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES kb_labels(id) ON DELETE CASCADE,
  UNIQUE(article_id, label_id)
);

CREATE INDEX IF NOT EXISTS idx_kb_article_labels_article ON kb_article_labels(article_id);
CREATE INDEX IF NOT EXISTS idx_kb_article_labels_label ON kb_article_labels(label_id);

-- Anexos
CREATE TABLE IF NOT EXISTS kb_article_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER DEFAULT 0,
  mime_type TEXT,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_attachments_article ON kb_article_attachments(article_id);

-- Agendamento de revisoes
CREATE TABLE IF NOT EXISTS kb_article_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  review_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'COMPLETED', 'SKIPPED')),
  notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_reviews_article ON kb_article_reviews(article_id);
CREATE INDEX IF NOT EXISTS idx_kb_reviews_date ON kb_article_reviews(review_date);
CREATE INDEX IF NOT EXISTS idx_kb_reviews_status ON kb_article_reviews(status);
