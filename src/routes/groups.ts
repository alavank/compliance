import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { AuthRequest, authenticate, requirePermission } from '../middleware/auth';
import { logAudit } from '../services/audit';

const router = Router();
const sb = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Listar grupos
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const db = sb();
    const { data: groups } = await db.from('groups').select('*').order('name');
    // Contar membros de cada grupo
    const result = [];
    for (const g of (groups || [])) {
      const { count } = await db.from('group_members').select('id', { count: 'exact', head: true }).eq('group_id', g.id);
      result.push({ ...g, member_count: count || 0 });
    }
    return res.json({ groups: result });
  } catch { return res.status(500).json({ error: 'Erro' }); }
});

// Criar grupo
router.post('/', authenticate, requirePermission('groups.manage'), async (req: AuthRequest, res) => {
  try {
    const { name, description, color, member_ids, permissions } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome obrigatorio' });
    const db = sb();
    const { data, error } = await db.from('groups').insert({
      name,
      description: description || null,
      color: color || '#6366f1',
      permissions: permissions || {},
      created_by: req.user!.id,
    }).select().single();
    if (error) throw error;
    if (member_ids?.length) {
      await db.from('group_members').insert(member_ids.map((uid: string) => ({ group_id: data.id, user_id: uid })));
    }
    await logAudit(db, { userId: req.user!.id, userName: req.user!.full_name, action: 'GROUP_CREATED', resourceType: 'group', resourceId: data.id, resourceName: name, ipAddress: req.ip });
    return res.status(201).json({ group: data });
  } catch (err: any) { return res.status(500).json({ error: err.message || 'Erro' }); }
});

// Editar grupo
router.put('/:id', authenticate, requirePermission('groups.manage'), async (req: AuthRequest, res) => {
  try {
    const { name, description, color, member_ids, permissions } = req.body;
    const db = sb();
    await db.from('groups').update({
      name,
      description: description || null,
      color: color || '#6366f1',
      permissions: permissions || {},
    }).eq('id', req.params.id);
    if (member_ids !== undefined) {
      await db.from('group_members').delete().eq('group_id', req.params.id);
      if (member_ids?.length) await db.from('group_members').insert(member_ids.map((uid: string) => ({ group_id: req.params.id, user_id: uid })));
    }
    await logAudit(db, { userId: req.user!.id, userName: req.user!.full_name, action: 'GROUP_UPDATED', resourceType: 'group', resourceId: req.params.id, resourceName: name, ipAddress: req.ip });
    return res.json({ message: 'Grupo atualizado' });
  } catch { return res.status(500).json({ error: 'Erro' }); }
});

// Deletar grupo
router.delete('/:id', authenticate, requirePermission('groups.manage'), async (req: AuthRequest, res) => {
  try {
    const db = sb();
    const { data: g } = await db.from('groups').select('name').eq('id', req.params.id).single();
    await db.from('groups').delete().eq('id', req.params.id);
    await logAudit(db, { userId: req.user!.id, userName: req.user!.full_name, action: 'GROUP_DELETED', resourceType: 'group', resourceId: req.params.id, resourceName: g?.name, ipAddress: req.ip });
    return res.json({ message: 'Grupo excluido' });
  } catch { return res.status(500).json({ error: 'Erro' }); }
});

// Membros de um grupo
router.get('/:id/members', authenticate, requirePermission('groups.manage'), async (req: AuthRequest, res) => {
  try {
    const { data } = await sb()
      .from('group_members')
      .select('user_id, profiles(id, full_name, display_name, email, avatar_url, role)')
      .eq('group_id', req.params.id);
    return res.json({ members: (data || []).map((m: any) => m.profiles) });
  } catch { return res.status(500).json({ error: 'Erro' }); }
});

export default router;
