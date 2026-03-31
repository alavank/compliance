import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { authenticate, AuthRequest, requirePermission } from '../middleware/auth';
import { logAudit } from '../services/audit';
import { isAdminRole } from '../lib/permissions';

const router = Router();
const db = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Listar cofres que o usuario tem acesso
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const sb = db();
    const userId = req.user!.id;
    const isAdmin = isAdminRole(req.user!.role);

    let vaults: any[] = [];
    if (isAdmin) {
      const { data } = await sb.from('vaults').select('*, organizations(name), profiles!vaults_created_by_fkey(full_name, display_name)').eq('is_active', true).order('name');
      vaults = data || [];
    } else {
      const { data: memberVaults } = await sb.from('vault_members').select('vault_id, permission_level, vaults(*, organizations(name), profiles!vaults_created_by_fkey(full_name, display_name))').eq('user_id', userId).eq('vaults.is_active', true);
      vaults = (memberVaults || []).filter((m: any) => m.vaults).map((m: any) => ({ ...m.vaults, my_permission: m.permission_level }));
    }

    // Contar senhas e membros por cofre
    const vaultIds = vaults.map((v: any) => v.id);
    const { data: pwCounts } = await sb.from('passwords').select('vault_id').in('vault_id', vaultIds);
    const { data: memberCounts } = await sb.from('vault_members').select('vault_id').in('vault_id', vaultIds);

    const pwMap: Record<string, number> = {};
    const memMap: Record<string, number> = {};
    (pwCounts || []).forEach((p: any) => { pwMap[p.vault_id] = (pwMap[p.vault_id] || 0) + 1; });
    (memberCounts || []).forEach((m: any) => { memMap[m.vault_id] = (memMap[m.vault_id] || 0) + 1; });

    const result = vaults.map((v: any) => ({
      ...v,
      password_count: pwMap[v.id] || 0,
      member_count: memMap[v.id] || 0,
    }));

    res.json({ vaults: result });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Detalhes do cofre
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const sb = db();
    const vaultId = req.params.id;
    const userId = req.user!.id;
    const isAdmin = isAdminRole(req.user!.role);

    const { data: vault } = await sb.from('vaults').select('*, organizations(name)').eq('id', vaultId).single();
    if (!vault) return res.status(404).json({ error: 'Cofre nao encontrado' });

    if (!isAdmin) {
      const { data: member } = await sb.from('vault_members').select('permission_level').eq('vault_id', vaultId).eq('user_id', userId).single();
      if (!member) return res.status(403).json({ error: 'Voce nao tem acesso a este cofre' });
      (vault as any).my_permission = member.permission_level;
    }

    const { data: members } = await sb.from('vault_members').select('*, profiles(id, full_name, display_name, email, avatar_url)').eq('vault_id', vaultId);
    const { data: passwords } = await sb.from('passwords').select('id, system_name, url, username, category_id, expires_at, created_at, categories(name, icon, color)').eq('vault_id', vaultId).order('system_name');
    const { data: emergencyLogs } = await sb.from('emergency_access').select('*, profiles!emergency_access_user_id_fkey(full_name, display_name)').eq('vault_id', vaultId).order('created_at', { ascending: false }).limit(20);

    res.json({ vault, members: members || [], passwords: passwords || [], emergencyLogs: emergencyLogs || [] });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Criar cofre
router.post('/', authenticate, requirePermission('vaults.manage'), async (req: AuthRequest, res) => {
  try {
    const sb = db();
    const { name, description, icon, color, organization_id } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome obrigatorio' });

    const { data: vault, error } = await sb.from('vaults').insert({
      name, description, icon: icon || 'lock', color: color || '#6366f1',
      organization_id: organization_id || null, created_by: req.user!.id,
    }).select().single();
    if (error) throw error;

    // Criador vira MANAGE automaticamente
    await sb.from('vault_members').insert({ vault_id: vault.id, user_id: req.user!.id, permission_level: 'MANAGE', granted_by: req.user!.id });

    await logAudit(sb, { userId: req.user!.id, userName: req.user!.full_name, action: 'VAULT_CREATED', resourceType: 'vault', resourceId: vault.id, resourceName: name, ipAddress: req.ip, userAgent: req.headers['user-agent'] });

    res.json({ vault });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Atualizar cofre
router.put('/:id', authenticate, requirePermission('vaults.manage'), async (req: AuthRequest, res) => {
  try {
    const sb = db();
    const { name, description, icon, color, organization_id, is_active } = req.body;

    const { data, error } = await sb.from('vaults').update({
      name, description, icon, color, organization_id, is_active, updated_at: new Date().toISOString(),
    }).eq('id', req.params.id).select().single();
    if (error) throw error;

    await logAudit(sb, { userId: req.user!.id, userName: req.user!.full_name, action: 'VAULT_UPDATED', resourceType: 'vault', resourceId: req.params.id, resourceName: name, ipAddress: req.ip, userAgent: req.headers['user-agent'] });

    res.json({ vault: data });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Excluir cofre
router.delete('/:id', authenticate, requirePermission('vaults.manage'), async (req: AuthRequest, res) => {
  try {
    const sb = db();
    // Desvincula senhas do cofre antes de excluir
    await sb.from('passwords').update({ vault_id: null }).eq('vault_id', req.params.id);
    const { error } = await sb.from('vaults').delete().eq('id', req.params.id);
    if (error) throw error;

    await logAudit(sb, { userId: req.user!.id, userName: req.user!.full_name, action: 'VAULT_DELETED', resourceType: 'vault', resourceId: req.params.id, ipAddress: req.ip, userAgent: req.headers['user-agent'] });

    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// --- Membros do cofre ---

// Adicionar membro
router.post('/:id/members', authenticate, requirePermission('vaults.manage'), async (req: AuthRequest, res) => {
  try {
    const sb = db();
    const { user_id, permission_level } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id obrigatorio' });

    const { data, error } = await sb.from('vault_members').upsert({
      vault_id: req.params.id, user_id, permission_level: permission_level || 'VIEW', granted_by: req.user!.id,
    }, { onConflict: 'vault_id,user_id' }).select().single();
    if (error) throw error;

    await logAudit(sb, { userId: req.user!.id, userName: req.user!.full_name, action: 'VAULT_MEMBER_ADDED', resourceType: 'vault', resourceId: req.params.id, details: { member_user_id: user_id, permission_level }, ipAddress: req.ip, userAgent: req.headers['user-agent'] });

    res.json({ member: data });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Remover membro
router.delete('/:id/members/:userId', authenticate, requirePermission('vaults.manage'), async (req: AuthRequest, res) => {
  try {
    const sb = db();
    await sb.from('vault_members').delete().eq('vault_id', req.params.id).eq('user_id', req.params.userId);

    await logAudit(sb, { userId: req.user!.id, userName: req.user!.full_name, action: 'VAULT_MEMBER_REMOVED', resourceType: 'vault', resourceId: req.params.id, details: { removed_user_id: req.params.userId }, ipAddress: req.ip, userAgent: req.headers['user-agent'] });

    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// --- Acesso de emergencia ---

// Solicitar acesso de emergencia
router.post('/:id/emergency', authenticate, async (req: AuthRequest, res) => {
  try {
    const sb = db();
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: 'Motivo obrigatorio' });

    const { data, error } = await sb.from('emergency_access').insert({
      vault_id: req.params.id, user_id: req.user!.id, reason,
    }).select().single();
    if (error) throw error;

    // Notificar administradores
    const { data: admins } = await sb.from('profiles').select('id').in('role', ['admin', 'super_admin']).eq('is_active', true);
    if (admins?.length) {
      const { data: vault } = await sb.from('vaults').select('name').eq('id', req.params.id).single();
      await sb.from('notifications').insert((admins || []).map((a: any) => ({
        user_id: a.id, title: 'Acesso de Emergencia Solicitado',
        message: `${req.user!.full_name} solicitou acesso de emergencia ao cofre "${vault?.name}"`,
        type: 'warning',
      })));
    }

    await logAudit(sb, { userId: req.user!.id, userName: req.user!.full_name, action: 'EMERGENCY_ACCESS_REQUESTED', resourceType: 'vault', resourceId: req.params.id, details: { reason }, ipAddress: req.ip, userAgent: req.headers['user-agent'] });

    res.json({ emergencyAccess: data });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Aprovar/negar acesso de emergencia
router.put('/emergency/:accessId', authenticate, requirePermission('vaults.manage'), async (req: AuthRequest, res) => {
  try {
    const sb = db();
    const { status } = req.body;
    if (!['APPROVED', 'DENIED'].includes(status)) return res.status(400).json({ error: 'Status invalido' });

    const { data, error } = await sb.from('emergency_access').update({
      status, approved_by: req.user!.id, approved_at: new Date().toISOString(),
    }).eq('id', req.params.accessId).eq('status', 'PENDING').select().single();
    if (error || !data) return res.status(404).json({ error: 'Solicitacao nao encontrada ou ja processada' });

    // Notificar solicitante
    await sb.from('notifications').insert({
      user_id: data.user_id,
      title: status === 'APPROVED' ? 'Acesso de Emergencia Aprovado' : 'Acesso de Emergencia Negado',
      message: status === 'APPROVED' ? 'Seu acesso de emergencia foi aprovado. Voce tem 4 horas.' : 'Seu acesso de emergencia foi negado.',
      type: status === 'APPROVED' ? 'success' : 'warning',
    });

    await logAudit(sb, { userId: req.user!.id, userName: req.user!.full_name, action: 'EMERGENCY_ACCESS_' + status, resourceType: 'vault', resourceId: data.vault_id, details: { access_id: req.params.accessId, requester_id: data.user_id }, ipAddress: req.ip, userAgent: req.headers['user-agent'] });

    res.json({ emergencyAccess: data });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
