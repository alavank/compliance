import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { AuthRequest, authenticate, requirePermission } from '../middleware/auth';
import { isAdminRole } from '../lib/permissions';
import { logAudit, notifyUsers } from '../services/audit';

const router = Router();
const sb = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

router.get('/users', authenticate, requirePermission('users.manage'), async (req: AuthRequest, res) => {
  try { const { data } = await sb().from('profiles').select('*').order('full_name');
    return res.json({ users: (data || []).map((u: any) => ({ ...u, totp_secret: undefined })) });
  } catch { return res.status(500).json({ error: 'Erro' }); }
});

router.post('/users', authenticate, requirePermission('users.manage'), async (req: AuthRequest, res) => {
  try {
    const { email, full_name, password, password_expires_days, role, group_ids, organization_ids, allowed_days, allowed_time_start, allowed_time_end, restrict_schedule } = req.body;
    if (!email || !full_name || !password) return res.status(400).json({ error: 'Campos obrigatórios' });
    const db = sb();
    const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name, role: role || 'user' } });
    if (error) throw error;
    await db.from('profiles').update({
      must_change_password: isAdminRole(role) ? false : true, password_expires_days: password_expires_days || 90,
      password_changed_at: isAdminRole(role) ? new Date().toISOString() : null, role: role || 'user',
      allowed_days: restrict_schedule ? (allowed_days || '1,2,3,4,5') : '0,1,2,3,4,5,6',
      allowed_time_start: restrict_schedule ? (allowed_time_start || '08:00') : '00:00',
      allowed_time_end: restrict_schedule ? (allowed_time_end || '18:00') : '23:59',
    }).eq('id', data.user.id);
    if (group_ids?.length) await db.from('group_members').insert(group_ids.map((gid: string) => ({ group_id: gid, user_id: data.user.id })));
    if (organization_ids?.length) await db.from('user_organizations').insert(organization_ids.map((oid: string) => ({ organization_id: oid, user_id: data.user.id })));
    await logAudit(db, { userId: req.user!.id, userName: req.user!.full_name, action: 'USER_CREATED', resourceType: 'user', resourceId: data.user.id, resourceName: full_name, ipAddress: req.ip });
    return res.status(201).json({ message: 'Usuário criado', userId: data.user.id });
  } catch (err: any) { return res.status(500).json({ error: err.message || 'Erro' }); }
});

router.put('/users/:id', authenticate, requirePermission('users.manage'), async (req: AuthRequest, res) => {
  try {
    const { full_name, password_expires_days, role, allowed_days, allowed_time_start, allowed_time_end, restrict_schedule, group_ids, organization_ids } = req.body;
    const db = sb();
    const { data: current } = await db.from('profiles').select('full_name').eq('id', req.params.id).single();
    if (!current) return res.status(404).json({ error: 'Não encontrado' });
    const upd: any = { updated_at: new Date().toISOString() };
    if (full_name !== undefined) upd.full_name = full_name;
    if (password_expires_days !== undefined) upd.password_expires_days = password_expires_days;
    if (role !== undefined) upd.role = role;
    if (restrict_schedule !== undefined) {
      if (restrict_schedule) { upd.allowed_days = allowed_days || '1,2,3,4,5'; upd.allowed_time_start = allowed_time_start || '08:00'; upd.allowed_time_end = allowed_time_end || '18:00'; }
      else { upd.allowed_days = '0,1,2,3,4,5,6'; upd.allowed_time_start = '00:00'; upd.allowed_time_end = '23:59'; }
    }
    await db.from('profiles').update(upd).eq('id', req.params.id);
    if (group_ids !== undefined) {
      await db.from('group_members').delete().eq('user_id', req.params.id);
      if (group_ids.length) await db.from('group_members').insert(group_ids.map((gid: string) => ({ group_id: gid, user_id: req.params.id })));
    }
    if (organization_ids !== undefined) {
      await db.from('user_organizations').delete().eq('user_id', req.params.id);
      if (organization_ids.length) await db.from('user_organizations').insert(organization_ids.map((oid: string) => ({ organization_id: oid, user_id: req.params.id })));
    }
    await logAudit(db, { userId: req.user!.id, userName: req.user!.full_name, action: 'USER_UPDATED', resourceType: 'user', resourceId: req.params.id, resourceName: full_name || current.full_name, ipAddress: req.ip });
    return res.json({ message: 'Usuário atualizado' });
  } catch (err: any) { return res.status(500).json({ error: err.message || 'Erro' }); }
});

router.put('/users/:id/toggle', authenticate, requirePermission('users.manage'), async (req: AuthRequest, res) => {
  try { const db = sb(); const { data: p } = await db.from('profiles').select('is_active, full_name').eq('id', req.params.id).single();
    if (!p) return res.status(404).json({ error: 'Não encontrado' });
    await db.from('profiles').update({ is_active: !p.is_active }).eq('id', req.params.id);
    await logAudit(db, { userId: req.user!.id, userName: req.user!.full_name, action: !p.is_active ? 'USER_ACTIVATED' : 'USER_DEACTIVATED', resourceType: 'user', resourceId: req.params.id, resourceName: p.full_name, ipAddress: req.ip });
    return res.json({ message: !p.is_active ? 'Ativado' : 'Desativado' });
  } catch { return res.status(500).json({ error: 'Erro' }); }
});

router.put('/users/:id/reset-password', authenticate, requirePermission('users.manage'), async (req: AuthRequest, res) => {
  try { const db = sb(); await db.auth.admin.updateUserById(req.params.id, { password: req.body.password });
    await db.from('profiles').update({ must_change_password: true }).eq('id', req.params.id);
    const { data: p } = await db.from('profiles').select('full_name').eq('id', req.params.id).single();
    await notifyUsers(db, [req.params.id], 'Senha Redefinida', 'Sua senha foi redefinida pelo administrador.', 'warning');
    await logAudit(db, { userId: req.user!.id, userName: req.user!.full_name, action: 'USER_PASSWORD_RESET', resourceType: 'user', resourceId: req.params.id, resourceName: p?.full_name, ipAddress: req.ip });
    return res.json({ message: 'Senha redefinida' });
  } catch { return res.status(500).json({ error: 'Erro' }); }
});

router.delete('/users/:id', authenticate, requirePermission('users.manage'), async (req: AuthRequest, res) => {
  try { const db = sb(); const { data: p } = await db.from('profiles').select('full_name, email, role').eq('id', req.params.id).single();
    if (!p) return res.status(404).json({ error: 'Não encontrado' });
    if (isAdminRole(p.role)) return res.status(403).json({ error: 'Nao e possivel excluir administradores' });
    if (req.body.confirm_email !== p.email) return res.status(400).json({ error: 'Email de confirmação incorreto' });
    const { error } = await db.auth.admin.deleteUser(req.params.id);
    if (error) throw error;
    await logAudit(db, { userId: req.user!.id, userName: req.user!.full_name, action: 'USER_DELETED', resourceType: 'user', resourceId: req.params.id, resourceName: p.full_name, details: { email: p.email }, ipAddress: req.ip });
    return res.json({ message: 'Excluído' });
  } catch (err: any) { return res.status(500).json({ error: err.message || 'Erro' }); }
});

router.get('/users/:id/details', authenticate, requirePermission('users.manage'), async (req: AuthRequest, res) => {
  try { const db = sb();
    const { data: profile } = await db.from('profiles').select('*').eq('id', req.params.id).single();
    if (!profile) return res.status(404).json({ error: 'Não encontrado' });
    const { data: logs } = await db.from('audit_logs').select('*').eq('user_id', req.params.id).order('created_at', { ascending: false }).limit(30);
    const { data: memberships } = await db.from('group_members').select('group_id, groups(id, name, color)').eq('user_id', req.params.id);
    const { data: userOrgs } = await db.from('user_organizations').select('organization_id, organizations(id, name, type)').eq('user_id', req.params.id);
    return res.json({ user: { ...profile, totp_secret: undefined }, logs: logs || [], groups: (memberships || []).map((m: any) => m.groups), organizations: (userOrgs || []).map((o: any) => o.organizations) });
  } catch { return res.status(500).json({ error: 'Erro' }); }
});

router.put('/users/:id/schedule', authenticate, requirePermission('users.manage'), async (req: AuthRequest, res) => {
  try { const { allowed_days, allowed_time_start, allowed_time_end } = req.body; const db = sb();
    await db.from('profiles').update({ allowed_days, allowed_time_start, allowed_time_end }).eq('id', req.params.id);
    const { data: p } = await db.from('profiles').select('full_name').eq('id', req.params.id).single();
    await logAudit(db, { userId: req.user!.id, userName: req.user!.full_name, action: 'USER_SCHEDULE_UPDATED', resourceType: 'user', resourceId: req.params.id, resourceName: p?.full_name, ipAddress: req.ip });
    return res.json({ message: 'Horário atualizado' });
  } catch { return res.status(500).json({ error: 'Erro' }); }
});

router.get('/audit-logs', authenticate, requirePermission('audit_logs.view'), async (req: AuthRequest, res) => {
  try { const db = sb(); const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50; const offset = (page - 1) * limit;
    const action = req.query.action as string; const userId = req.query.userId as string;
    let q = db.from('audit_logs').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    if (action) q = q.eq('action', action); if (userId) q = q.eq('user_id', userId);
    const { data, count } = await q; return res.json({ logs: data || [], total: count || 0, page, limit });
  } catch { return res.status(500).json({ error: 'Erro' }); }
});

// ==================== DASHBOARD COMPLETO ====================
router.get('/dashboard', authenticate, requirePermission('dashboard.view'), async (req: AuthRequest, res) => {
  try {
    const db = sb(); const days = parseInt(req.query.days as string) || 30;
    const filterUser = req.query.userId as string;
    const dateFrom = req.query.dateFrom as string; const dateTo = req.query.dateTo as string;
    let since: string; let until: string | null = null;
    if (dateFrom) { since = new Date(dateFrom).toISOString(); if (dateTo) until = new Date(dateTo + 'T23:59:59').toISOString(); }
    else { since = new Date(Date.now() - days * 86400000).toISOString(); }

    const [pwds, users, orgs] = await Promise.all([
      db.from('passwords').select('id, system_name, updated_at, expires_at, organization_id'),
      db.from('profiles').select('id, full_name, display_name, last_login, is_active, avatar_url, role'),
      db.from('organizations').select('id, name, type'),
    ]);
    let lq = db.from('audit_logs').select('*').gte('created_at', since).order('created_at', { ascending: false }).limit(5000);
    if (until) lq = lq.lte('created_at', until);
    if (filterUser) lq = lq.eq('user_id', filterUser);
    const { data: logs } = await lq; const all = logs || [];
    const totalPw = pwds.data?.length || 0;
    const expired = (pwds.data || []).filter((p: any) => { if (p.expires_at) return new Date(p.expires_at) <= new Date(); return (Date.now() - new Date(p.updated_at).getTime()) / 86400000 >= 90; }).length;
    const logins = all.filter((l: any) => l.action === 'LOGIN');
    const views = all.filter((l: any) => l.action === 'PASSWORD_VIEWED');

    const accessByDay: any = {}; for (let i = Math.min(days, 90) - 1; i >= 0; i--) { const d = new Date(Date.now() - i * 86400000); accessByDay[String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')] = 0; }
    const accessByHour: any = {}; for (let i = 0; i < 24; i++) accessByHour[String(i).padStart(2,'0')+'h'] = 0;
    const weekDays = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    const accessByWeekday: any = {}; weekDays.forEach(d => accessByWeekday[d] = 0);

    logins.forEach((l: any) => { const d = new Date(l.created_at); const dk = String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0'); const hk = String(d.getHours()).padStart(2,'0')+'h'; const wk = weekDays[d.getDay()]; if (accessByDay[dk] !== undefined) accessByDay[dk]++; if (accessByHour[hk] !== undefined) accessByHour[hk]++; accessByWeekday[wk]++; });

    const pwViews: any = {}; views.forEach((l: any) => { pwViews[l.resource_name || '?'] = (pwViews[l.resource_name || '?'] || 0) + 1; });
    const uLogins: any = {}; const uViews: any = {};
    logins.forEach((l: any) => { uLogins[l.user_name || '?'] = (uLogins[l.user_name || '?'] || 0) + 1; });
    views.forEach((l: any) => { uViews[l.user_name || '?'] = (uViews[l.user_name || '?'] || 0) + 1; });
    const userPwM: any = {}; const pwUserM: any = {};
    views.forEach((l: any) => { const u = l.user_name || '?'; const p = l.resource_name || '?'; if (!userPwM[u]) userPwM[u] = {}; userPwM[u][p] = (userPwM[u][p] || 0) + 1; if (!pwUserM[p]) pwUserM[p] = {}; pwUserM[p][u] = (pwUserM[p][u] || 0) + 1; });

    const devices: any = {}; const browsers: any = {}; const ips: any = {};
    all.forEach((l: any) => {
      if (l.user_agent) {
        let dev = 'Desktop'; if (/Mobile|Android/.test(l.user_agent)) dev = 'Mobile'; else if (/iPad|Tablet/.test(l.user_agent)) dev = 'Tablet';
        let os = ''; if (/Windows/.test(l.user_agent)) os = ' (Windows)'; else if (/Mac/.test(l.user_agent)) os = ' (Mac)'; else if (/Linux/.test(l.user_agent) && !/Android/.test(l.user_agent)) os = ' (Linux)'; else if (/Android/.test(l.user_agent)) os = ' (Android)'; else if (/iPhone|iPad/.test(l.user_agent)) os = ' (iOS)';
        devices[dev + os] = (devices[dev + os] || 0) + 1;
        let br = 'Outro'; if (/Edg/.test(l.user_agent)) br = 'Edge'; else if (/Chrome/.test(l.user_agent)) br = 'Chrome'; else if (/Firefox/.test(l.user_agent)) br = 'Firefox'; else if (/Safari/.test(l.user_agent)) br = 'Safari';
        browsers[br] = (browsers[br] || 0) + 1;
      }
      if (l.ip_address) ips[l.ip_address] = (ips[l.ip_address] || 0) + 1;
    });

    const orgMap: any = {}; (orgs.data || []).forEach((o: any) => orgMap[o.id] = o.name);
    const pwByOrg: any = {}; (pwds.data || []).forEach((p: any) => { const nm = p.organization_id ? (orgMap[p.organization_id] || 'Sem nome') : 'Sem organização'; pwByOrg[nm] = (pwByOrg[nm] || 0) + 1; });
    const actionCounts: any = {}; all.forEach((l: any) => { actionCounts[l.action] = (actionCounts[l.action] || 0) + 1; });
    const actionLabels: any = { LOGIN:'Login', LOGOUT:'Logout', PASSWORD_VIEWED:'Visualizou senha', PASSWORD_CREATED:'Criou senha', PASSWORD_CHANGED:'Alterou senha', PASSWORD_DELETED:'Removeu senha', USER_CREATED:'Criou usuário', TERM_ACCEPTED:'Aceitou termo', SCREENSHOT_ATTEMPT:'Captura de tela', PROFILE_UPDATED:'Atualizou perfil', PASSWORD_SELF_CHANGED:'Trocou própria senha' };

    await db.from('active_sessions').delete().lt('last_activity', new Date(Date.now() - 20 * 60000).toISOString());
    const { count: onlineNow } = await db.from('active_sessions').select('id', { count: 'exact', head: true });
    const { data: sessions } = await db.from('active_sessions').select('started_at');
    let avgSessionMinutes = 0;
    if (sessions?.length) avgSessionMinutes = Math.round(sessions.reduce((s: number, sess: any) => s + (Date.now() - new Date(sess.started_at).getTime()), 0) / sessions.length / 60000);

    const sortObj = (o: any) => Object.entries(o).map(([name, count]) => ({ name, count })).sort((a: any, b: any) => b.count - a.count).slice(0, 10);
    const matrixList = (m: any) => Object.entries(m).map(([name, vals]: any) => ({ name, items: Object.entries(vals).sort((a: any, b: any) => b[1] - a[1]).slice(0, 3).map(([n, c]) => ({ name: n, count: c })) })).sort((a, b) => a.name.localeCompare(b.name));

    return res.json({
      totalPasswords: totalPw, expiredPasswords: expired, totalUsers: users.data?.length || 0, activeUsers: (users.data || []).filter((u: any) => u.is_active).length,
      totalLogins: logins.length, totalViews: views.length, onlineNow: onlineNow || 0, avgSessionMinutes,
      recentActivity: all.slice(0, 15),
      users: (users.data || []).map((u: any) => ({ id: u.id, full_name: u.display_name || u.full_name, last_login: u.last_login, is_active: u.is_active, avatar_url: u.avatar_url, role: u.role })),
      bi: {
        accessByDay: Object.entries(accessByDay).map(([day, count]) => ({ day, count })),
        accessByHour: Object.entries(accessByHour).map(([hour, count]) => ({ hour, count })),
        accessByWeekday: Object.entries(accessByWeekday).map(([day, count]) => ({ day, count })),
        topPasswords: sortObj(pwViews), topUserLogins: sortObj(uLogins), topUserViews: sortObj(uViews),
        userTopPasswords: matrixList(userPwM), passwordTopUsers: matrixList(pwUserM),
        devices: sortObj(devices), browsers: sortObj(browsers), topIps: sortObj(ips),
        passwordsByOrg: sortObj(pwByOrg),
        actionCounts: Object.entries(actionCounts).map(([action, count]) => ({ action, label: actionLabels[action] || action, count })).sort((a: any, b: any) => b.count - a.count),
      },
    });
  } catch (err) { console.error(err); return res.status(500).json({ error: 'Erro' }); }
});

router.get('/categories', authenticate, async (req: AuthRequest, res) => {
  try { const { data } = await sb().from('categories').select('*').order('name'); return res.json({ categories: data || [] }); } catch { return res.status(500).json({ error: 'Erro' }); }
});

router.get('/admins', authenticate, async (req: AuthRequest, res) => {
  try { const { data } = await sb().from('profiles').select('id, full_name, display_name, role').in('role', ['admin', 'super_admin']).eq('is_active', true).order('full_name');
    return res.json({ admins: (data || []).map((a: any) => ({ id: a.id, name: a.display_name || a.full_name })) });
  } catch { return res.status(500).json({ error: 'Erro' }); }
});

export default router;
