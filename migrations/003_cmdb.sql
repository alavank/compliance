-- =============================================
-- FASE 3: CMDB / TI - Ativos, Topologia, Runbooks
-- =============================================

-- Tipos de Configuration Items
CREATE TABLE IF NOT EXISTS ci_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  icon TEXT DEFAULT 'server',
  color TEXT DEFAULT '#6366f1',
  description TEXT,
  fields_schema JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Localizacoes fisicas
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location_type TEXT DEFAULT 'ROOM'
    CHECK (location_type IN ('DATACENTER', 'BUILDING', 'FLOOR', 'ROOM', 'RACK', 'OTHER')),
  parent_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_locations_parent ON locations(parent_id);
CREATE INDEX IF NOT EXISTS idx_locations_type ON locations(location_type);

-- Configuration Items (ativos)
CREATE TABLE IF NOT EXISTS configuration_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ci_type_id UUID NOT NULL REFERENCES ci_types(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'INACTIVE', 'MAINTENANCE', 'DECOMMISSIONED', 'PLANNED')),
  criticality TEXT DEFAULT 'MEDIUM'
    CHECK (criticality IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  ip_address TEXT,
  hostname TEXT,
  serial_number TEXT,
  manufacturer TEXT,
  model TEXT,
  os TEXT,
  specs JSONB DEFAULT '{}',
  custom_fields JSONB DEFAULT '{}',
  managed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ci_type ON configuration_items(ci_type_id);
CREATE INDEX IF NOT EXISTS idx_ci_status ON configuration_items(status);
CREATE INDEX IF NOT EXISTS idx_ci_location ON configuration_items(location_id);
CREATE INDEX IF NOT EXISTS idx_ci_organization ON configuration_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_ci_criticality ON configuration_items(criticality);

-- Relacionamentos entre CIs
CREATE TABLE IF NOT EXISTS ci_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_ci_id UUID NOT NULL REFERENCES configuration_items(id) ON DELETE CASCADE,
  target_ci_id UUID NOT NULL REFERENCES configuration_items(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL DEFAULT 'DEPENDS_ON'
    CHECK (relationship_type IN ('DEPENDS_ON', 'CONNECTS_TO', 'RUNS_ON', 'CONTAINS', 'BACKS_UP', 'MONITORS')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_ci_id, target_ci_id, relationship_type)
);

CREATE INDEX IF NOT EXISTS idx_ci_rel_source ON ci_relationships(source_ci_id);
CREATE INDEX IF NOT EXISTS idx_ci_rel_target ON ci_relationships(target_ci_id);

-- Segmentos de rede
CREATE TABLE IF NOT EXISTS network_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  vlan_id INTEGER,
  subnet TEXT,
  gateway TEXT,
  description TEXT,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_network_segments_location ON network_segments(location_id);

-- Associacao CI - Segmento de rede
CREATE TABLE IF NOT EXISTS ci_network_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ci_id UUID NOT NULL REFERENCES configuration_items(id) ON DELETE CASCADE,
  segment_id UUID NOT NULL REFERENCES network_segments(id) ON DELETE CASCADE,
  ip_in_segment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ci_id, segment_id)
);

-- Runbooks (procedimentos de TI)
CREATE TABLE IF NOT EXISTS runbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  ci_id UUID REFERENCES configuration_items(id) ON DELETE SET NULL,
  kb_article_id UUID REFERENCES kb_articles(id) ON DELETE SET NULL,
  category TEXT DEFAULT 'GENERAL'
    CHECK (category IN ('INCIDENT', 'MAINTENANCE', 'DEPLOYMENT', 'BACKUP', 'RECOVERY', 'GENERAL')),
  severity TEXT DEFAULT 'MEDIUM'
    CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_runbooks_ci ON runbooks(ci_id);
CREATE INDEX IF NOT EXISTS idx_runbooks_kb ON runbooks(kb_article_id);
CREATE INDEX IF NOT EXISTS idx_runbooks_category ON runbooks(category);

-- Versoes de runbooks
CREATE TABLE IF NOT EXISTS runbook_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  runbook_id UUID NOT NULL REFERENCES runbooks(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  content TEXT NOT NULL,
  change_notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(runbook_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_runbook_versions_runbook ON runbook_versions(runbook_id);

-- Tipos padrao de CI
INSERT INTO ci_types (name, icon, color, description) VALUES
  ('Servidor Fisico', 'server', '#22c55e', 'Servidores fisicos e bare-metal'),
  ('Maquina Virtual', 'monitor', '#3b82f6', 'VMs e instancias virtualizadas'),
  ('Switch', 'network', '#f59e0b', 'Switches de rede L2/L3'),
  ('Firewall', 'shield', '#ef4444', 'Firewalls e appliances de seguranca'),
  ('Roteador', 'router', '#8b5cf6', 'Roteadores de rede'),
  ('Access Point', 'wifi', '#06b6d4', 'Pontos de acesso Wi-Fi'),
  ('Storage', 'hard-drive', '#ec4899', 'Storage e NAS'),
  ('Banco de Dados', 'database', '#a855f7', 'Instancias de banco de dados'),
  ('Aplicacao', 'app-window', '#14b8a6', 'Aplicacoes e servicos web'),
  ('Impressora', 'printer', '#64748b', 'Impressoras e multifuncionais'),
  ('Nobreak/UPS', 'zap', '#eab308', 'Nobreaks e UPS'),
  ('Camera IP', 'camera', '#78716c', 'Cameras de vigilancia IP')
ON CONFLICT (name) DO NOTHING;
