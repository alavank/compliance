import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { AuthRequest, authenticate, requirePermission } from '../middleware/auth';
import { logAudit } from '../services/audit';

const router = Router();
const sb = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function normalizeNode(item: any) {
  return { ...item, label: item.type || 'Estrutura' };
}

function buildTree(items: any[], parentId: string | null): any[] {
  return items
    .filter((item: any) => (item.parent_id || null) === parentId)
    .sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''))
    .map((item: any) => ({
      ...normalizeNode(item),
      children: buildTree(items, item.id),
    }));
}

router.get('/', authenticate, async (_req: AuthRequest, res) => {
  try {
    const { data } = await sb().from('organizations').select('*').order('name');
    return res.json({ organizations: (data || []).map(normalizeNode) });
  } catch {
    return res.status(500).json({ error: 'Erro' });
  }
});

router.get('/tree', authenticate, async (_req: AuthRequest, res) => {
  try {
    const { data } = await sb().from('organizations').select('*').order('name');
    return res.json({ tree: buildTree(data || [], null) });
  } catch {
    return res.status(500).json({ error: 'Erro' });
  }
});

router.post('/', authenticate, requirePermission('organizations.manage'), async (req: AuthRequest, res) => {
  try {
    const { name, type, label, parent_id } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Nome obrigatorio' });

    const nodeLabel = String(label || type || 'Estrutura').trim() || 'Estrutura';
    const db = sb();
    const payload = { name: name.trim(), type: nodeLabel, parent_id: parent_id || null };
    const { data, error } = await db.from('organizations').insert(payload).select().single();
    if (error) throw error;

    await logAudit(db, {
      userId: req.user!.id,
      userName: req.user!.full_name,
      action: 'ORG_CREATED',
      resourceType: 'organization',
      resourceId: data.id,
      resourceName: payload.name,
      details: { label: nodeLabel, parent_id: payload.parent_id },
      ipAddress: req.ip,
    });

    return res.status(201).json({ organization: normalizeNode(data) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Erro' });
  }
});

router.put('/:id', authenticate, requirePermission('organizations.manage'), async (req: AuthRequest, res) => {
  try {
    const { name, type, label, parent_id } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Nome obrigatorio' });

    const nodeLabel = String(label || type || 'Estrutura').trim() || 'Estrutura';
    const db = sb();
    const payload = { name: name.trim(), type: nodeLabel, parent_id: parent_id || null };
    const { error } = await db.from('organizations').update(payload).eq('id', req.params.id);
    if (error) throw error;

    await logAudit(db, {
      userId: req.user!.id,
      userName: req.user!.full_name,
      action: 'ORG_UPDATED',
      resourceType: 'organization',
      resourceId: req.params.id,
      resourceName: payload.name,
      details: { label: nodeLabel, parent_id: payload.parent_id },
      ipAddress: req.ip,
    });

    return res.json({ message: 'Atualizado' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Erro' });
  }
});

router.delete('/:id', authenticate, requirePermission('organizations.manage'), async (req: AuthRequest, res) => {
  try {
    const db = sb();
    const { data: org } = await db.from('organizations').select('name, type').eq('id', req.params.id).single();
    const { error } = await db.from('organizations').delete().eq('id', req.params.id);
    if (error) throw error;

    await logAudit(db, {
      userId: req.user!.id,
      userName: req.user!.full_name,
      action: 'ORG_DELETED',
      resourceType: 'organization',
      resourceId: req.params.id,
      resourceName: org?.name,
      details: { label: org?.type || null },
      ipAddress: req.ip,
    });

    return res.json({ message: 'Removido' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Erro' });
  }
});

router.put('/user/:userId', authenticate, requirePermission('organizations.manage'), async (req: AuthRequest, res) => {
  try {
    const { organization_ids } = req.body;
    const db = sb();
    await db.from('user_organizations').delete().eq('user_id', req.params.userId);
    if (organization_ids?.length) {
      await db.from('user_organizations').insert(
        organization_ids.map((oid: string) => ({ user_id: req.params.userId, organization_id: oid }))
      );
    }
    return res.json({ message: 'Vinculos atualizados' });
  } catch {
    return res.status(500).json({ error: 'Erro' });
  }
});

router.get('/user/:userId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { data } = await sb()
      .from('user_organizations')
      .select('organization_id, organizations(id, name, type)')
      .eq('user_id', req.params.userId);
    return res.json({ organizations: (data || []).map((item: any) => normalizeNode(item.organizations)) });
  } catch {
    return res.status(500).json({ error: 'Erro' });
  }
});

export default router;
