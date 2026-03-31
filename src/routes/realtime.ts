import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { AuthRequest, authenticate, requirePermission } from '../middleware/auth';

const router = Router();
const sb = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

router.get('/sessions', authenticate, requirePermission('realtime.view'), async (req: AuthRequest, res) => {
  try {
    const db = sb();
    await db.from('active_sessions').delete().lt('last_activity', new Date(Date.now() - 20 * 60000).toISOString());
    const { data } = await db.from('active_sessions').select('*').order('last_activity', { ascending: false });
    // Calcular tempo online de cada sessão
    const sessions = (data || []).map((s: any) => ({
      ...s,
      online_seconds: Math.floor((Date.now() - new Date(s.started_at).getTime()) / 1000),
      idle_seconds: Math.floor((Date.now() - new Date(s.last_activity).getTime()) / 1000),
    }));
    return res.json({ sessions });
  } catch { return res.status(500).json({ error: 'Erro' }); }
});

router.get('/activity', authenticate, requirePermission('realtime.view'), async (req: AuthRequest, res) => {
  try {
    const minutes = parseInt(req.query.minutes as string) || 5;
    const since = new Date(Date.now() - minutes * 60000).toISOString();
    const { data } = await sb().from('audit_logs').select('*').gte('created_at', since).order('created_at', { ascending: false }).limit(100);
    return res.json({ activity: data || [] });
  } catch { return res.status(500).json({ error: 'Erro' }); }
});

router.get('/timeline', authenticate, requirePermission('realtime.view'), async (req: AuthRequest, res) => {
  try {
    const hours = parseInt(req.query.hours as string) || 2;
    const since = new Date(Date.now() - hours * 60 * 60000).toISOString();
    const { data } = await sb().from('audit_logs').select('created_at, action, user_name, resource_name').gte('created_at', since).order('created_at', { ascending: true });
    const minuteMap: any = {};
    (data || []).forEach((log: any) => {
      const d = new Date(log.created_at);
      const key = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      if (!minuteMap[key]) minuteMap[key] = { time: key, events: 0, details: [] };
      minuteMap[key].events++;
      minuteMap[key].details.push({ action: log.action, user: log.user_name, resource: log.resource_name });
    });
    const timeline: any[] = [];
    const totalMinutes = hours * 60;
    for (let i = totalMinutes; i >= 0; i--) {
      const d = new Date(Date.now() - i * 60000);
      const key = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      timeline.push(minuteMap[key] || { time: key, events: 0, details: [] });
    }
    return res.json({ timeline });
  } catch { return res.status(500).json({ error: 'Erro' }); }
});

// Stats gerais de tempo real
router.get('/stats', authenticate, requirePermission('realtime.view'), async (req: AuthRequest, res) => {
  try {
    const db = sb();
    const { count: onlineCount } = await db.from('active_sessions').select('id', { count: 'exact', head: true });
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const { count: todayLogins } = await db.from('audit_logs').select('id', { count: 'exact', head: true }).eq('action', 'LOGIN').gte('created_at', todayStart.toISOString());
    const { count: todayViews } = await db.from('audit_logs').select('id', { count: 'exact', head: true }).eq('action', 'PASSWORD_VIEWED').gte('created_at', todayStart.toISOString());
    const { data: sessions } = await db.from('active_sessions').select('started_at');
    let avgTime = 0;
    if (sessions?.length) {
      avgTime = Math.floor(sessions.reduce((s: number, sess: any) => s + (Date.now() - new Date(sess.started_at).getTime()), 0) / sessions.length / 1000);
    }
    return res.json({ online: onlineCount || 0, todayLogins: todayLogins || 0, todayViews: todayViews || 0, avgSessionSeconds: avgTime });
  } catch { return res.status(500).json({ error: 'Erro' }); }
});

export default router;

// Heartbeat do frontend
router.post('/heartbeat', authenticate, async (req: AuthRequest, res) => {
  try {
    const db = sb();
    const { module } = req.body;
    const { data: existing } = await db.from('active_sessions').select('id').eq('user_id', req.user!.id).limit(1).single();
    if (existing) {
      await db.from('active_sessions').update({
        last_activity: new Date().toISOString(),
        current_module: module || 'browsing',
        user_agent: req.headers['user-agent'] || null,
        ip_address: req.ip || null,
      }).eq('id', existing.id);
    } else {
      await db.from('active_sessions').insert({
        user_id: req.user!.id,
        user_name: req.user!.full_name || req.user!.display_name || 'Usuário',
        current_module: module || 'login',
        current_action: 'browsing',
        started_at: new Date().toISOString(),
        last_activity: new Date().toISOString(),
        user_agent: req.headers['user-agent'] || null,
        ip_address: req.ip || null,
      });
    }
    return res.json({ ok: true });
  } catch { return res.json({ ok: false }); }
});
