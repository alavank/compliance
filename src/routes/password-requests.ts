import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { AuthRequest, authenticate, requirePermission } from '../middleware/auth';
import { buildPermissionMap, hasPermission } from '../lib/permissions';
import { logAudit, notifyUsers } from '../services/audit';

const router = Router();
const sb = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const db = sb();
    let query = db.from('password_requests').select('*').order('created_at', { ascending: false });

    if (!hasPermission(req.user, 'password_requests.manage')) {
      query = query.eq('requester_id', req.user!.id);
    }

    const { data } = await query;
    return res.json({ requests: data || [] });
  } catch {
    return res.status(500).json({ error: 'Erro' });
  }
});

router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { system_name, url, username, notes, category_id, organization_id, assigned_to } = req.body;

    if (!system_name) {
      return res.status(400).json({ error: 'Nome do sistema obrigatorio' });
    }

    const db = sb();
    const { data, error } = await db
      .from('password_requests')
      .insert({
        requester_id: req.user!.id,
        requester_name: req.user!.full_name,
        system_name,
        url: url || null,
        username: username || null,
        notes: notes || null,
        category_id: category_id || null,
        organization_id: organization_id || null,
        assigned_to: assigned_to || [],
      })
      .select()
      .single();

    if (error) throw error;

    if (assigned_to?.length) {
      await notifyUsers(
        db,
        assigned_to,
        'Nova Solicitacao de Senha',
        req.user!.full_name + ' solicitou cadastro da senha "' + system_name + '"',
        'info'
      );
    }

    await logAudit(db, {
      userId: req.user!.id,
      userName: req.user!.full_name,
      action: 'PASSWORD_REQUESTED',
      resourceType: 'password_request',
      resourceId: data.id,
      resourceName: system_name,
      ipAddress: req.ip,
    });

    return res.status(201).json({ request: data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Erro' });
  }
});

router.put('/:id', authenticate, requirePermission('password_requests.manage'), async (req: AuthRequest, res) => {
  try {
    const { status, admin_notes } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status invalido' });
    }

    const db = sb();
    const { data: currentRequest } = await db.from('password_requests').select('*').eq('id', req.params.id).single();

    if (!currentRequest) {
      return res.status(404).json({ error: 'Solicitacao nao encontrada' });
    }

    await db
      .from('password_requests')
      .update({
        status,
        admin_notes: admin_notes || null,
        resolved_by: req.user!.id,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', req.params.id);

    await notifyUsers(
      db,
      [currentRequest.requester_id],
      'Solicitacao ' + (status === 'approved' ? 'Aprovada' : 'Rejeitada'),
      'Sua solicitacao para "' + currentRequest.system_name + '" foi ' + (status === 'approved' ? 'aprovada' : 'rejeitada') + '.',
      status === 'approved' ? 'success' : 'warning'
    );

    await logAudit(db, {
      userId: req.user!.id,
      userName: req.user!.full_name,
      action: 'PASSWORD_REQUEST_' + status.toUpperCase(),
      resourceType: 'password_request',
      resourceId: req.params.id,
      resourceName: currentRequest.system_name,
      ipAddress: req.ip,
    });

    return res.json({ message: 'Atualizado' });
  } catch {
    return res.status(500).json({ error: 'Erro' });
  }
});

router.get('/admins', authenticate, async (req: AuthRequest, res) => {
  try {
    const db = sb();
    const [{ data: profiles }, { data: memberships }] = await Promise.all([
      db.from('profiles').select('id, full_name, display_name, role').eq('is_active', true),
      db.from('group_members').select('user_id, groups(permissions)'),
    ]);

    const permissionRecordsByUser = new Map<string, any[]>();

    (memberships || []).forEach((membership: any) => {
      const current = permissionRecordsByUser.get(membership.user_id) || [];
      current.push(membership.groups?.permissions || {});
      permissionRecordsByUser.set(membership.user_id, current);
    });

    const admins = (profiles || [])
      .filter((profile: any) =>
        hasPermission(
          {
            role: profile.role,
            permissions: buildPermissionMap(profile.role, permissionRecordsByUser.get(profile.id) || []),
          },
          'password_requests.manage'
        )
      )
      .map((profile: any) => ({
        id: profile.id,
        full_name: profile.full_name,
        display_name: profile.display_name,
        role: profile.role,
      }));

    return res.json({ admins });
  } catch {
    return res.status(500).json({ error: 'Erro' });
  }
});

export default router;
