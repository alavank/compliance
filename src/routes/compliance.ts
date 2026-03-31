import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { authenticate, AuthRequest, requirePermission } from '../middleware/auth';
import { logAudit, notifyUsers } from '../services/audit';
import { isAdminRole } from '../lib/permissions';

const router = Router();
const db = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function generateProtocol(prefix: string) {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${y}${m}-${rand}`;
}

// ========== CANAL DE DENUNCIAS ==========

// Registrar denuncia (pode ser anonimo, sem autenticacao)
router.post('/complaints', async (req: any, res) => {
  try {
    const sb = db();
    const { category, subject, description, is_anonymous, reporter_name, reporter_email } = req.body;
    if (!subject || !description) return res.status(400).json({ error: 'Assunto e descricao obrigatorios' });

    const protocol = generateProtocol('DEN');

    // Tentar extrair user autenticado se houver token
    let reporter_id = null;
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token && !is_anonymous) {
      try {
        const { data: { user } } = await sb.auth.getUser(token);
        if (user) reporter_id = user.id;
      } catch {}
    }

    const { data, error } = await sb.from('complaints').insert({
      protocol, category: category || 'GENERAL', subject, description,
      is_anonymous: is_anonymous !== false, reporter_id,
      reporter_name: is_anonymous ? null : reporter_name,
      reporter_email: is_anonymous ? null : reporter_email,
    }).select().single();
    if (error) throw error;

    // Notificar admins de compliance
    const { data: admins } = await sb.from('profiles').select('id').in('role', ['admin', 'super_admin']).eq('is_active', true);
    if (admins?.length) {
      await sb.from('notifications').insert(admins.map((a: any) => ({
        user_id: a.id, title: 'Nova Denuncia Recebida',
        message: `Protocolo ${protocol} - ${category || 'GENERAL'}`, type: 'warning',
      })));
    }

    res.json({ complaint: { protocol: data.protocol, id: data.id, status: data.status } });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Consultar denuncia por protocolo (sem autenticacao - denunciante acompanha)
router.get('/complaints/track/:protocol', async (req, res) => {
  try {
    const sb = db();
    const { data } = await sb.from('complaints').select('protocol, status, category, subject, created_at, updated_at, resolution').eq('protocol', req.params.protocol).single();
    if (!data) return res.status(404).json({ error: 'Protocolo nao encontrado' });

    const { data: messages } = await sb.from('complaint_messages').select('sender_type, message, created_at').eq('complaint_id', data.protocol).eq('is_internal', false).order('created_at');

    // Buscar por complaint id real
    const { data: complaint } = await sb.from('complaints').select('id').eq('protocol', req.params.protocol).single();
    const { data: msgs } = await sb.from('complaint_messages').select('sender_type, message, created_at').eq('complaint_id', complaint?.id).eq('is_internal', false).order('created_at');

    res.json({ complaint: data, messages: msgs || [] });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Adicionar mensagem ao protocolo (denunciante)
router.post('/complaints/track/:protocol/messages', async (req, res) => {
  try {
    const sb = db();
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Mensagem obrigatoria' });

    const { data: complaint } = await sb.from('complaints').select('id').eq('protocol', req.params.protocol).single();
    if (!complaint) return res.status(404).json({ error: 'Protocolo nao encontrado' });

    const { data, error } = await sb.from('complaint_messages').insert({
      complaint_id: complaint.id, sender_type: 'REPORTER', message,
    }).select().single();
    if (error) throw error;
    res.json({ message: data });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Listar denuncias (admin)
router.get('/complaints', authenticate, requirePermission('compliance.manage'), async (req: AuthRequest, res) => {
  try {
    const sb = db();
    let query = sb.from('complaints').select('*, profiles!complaints_assigned_to_fkey(full_name, display_name)');
    if (req.query.status) query = query.eq('status', req.query.status as string);
    if (req.query.category) query = query.eq('category', req.query.category as string);
    const { data } = await query.order('created_at', { ascending: false });
    res.json({ complaints: data || [] });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Detalhes da denuncia (admin)
router.get('/complaints/:id/detail', authenticate, requirePermission('compliance.manage'), async (req: AuthRequest, res) => {
  try {
    const sb = db();
    const { data: complaint } = await sb.from('complaints').select('*').eq('id', req.params.id).single();
    if (!complaint) return res.status(404).json({ error: 'Denuncia nao encontrada' });
    const { data: messages } = await sb.from('complaint_messages').select('*, profiles(full_name, display_name)').eq('complaint_id', req.params.id).order('created_at');
    res.json({ complaint, messages: messages || [] });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Atualizar denuncia (admin)
router.put('/complaints/:id', authenticate, requirePermission('compliance.manage'), async (req: AuthRequest, res) => {
  try {
    const sb = db();
    const { status, assigned_to, priority, resolution } = req.body;
    const updates: any = { updated_at: new Date().toISOString() };
    if (status) updates.status = status;
    if (assigned_to !== undefined) updates.assigned_to = assigned_to;
    if (priority) updates.priority = priority;
    if (resolution) { updates.resolution = resolution; updates.resolved_at = new Date().toISOString(); }

    const { data, error } = await sb.from('complaints').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;

    await logAudit(sb, { userId: req.user!.id, userName: req.user!.full_name, action: 'COMPLAINT_UPDATED', resourceType: 'complaint', resourceId: req.params.id, details: { status, priority }, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ complaint: data });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Responder denuncia (admin - mensagem do handler)
router.post('/complaints/:id/messages', authenticate, requirePermission('compliance.manage'), async (req: AuthRequest, res) => {
  try {
    const sb = db();
    const { message, is_internal } = req.body;
    if (!message) return res.status(400).json({ error: 'Mensagem obrigatoria' });

    const { data, error } = await sb.from('complaint_messages').insert({
      complaint_id: req.params.id, sender_type: 'HANDLER', sender_id: req.user!.id,
      message, is_internal: is_internal || false,
    }).select().single();
    if (error) throw error;
    res.json({ message: data });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ========== LGPD REQUESTS ==========

router.get('/lgpd-requests', authenticate, requirePermission('compliance.manage'), async (req: AuthRequest, res) => {
  try {
    const sb = db();
    let query = sb.from('lgpd_requests').select('*, profiles!lgpd_requests_assigned_to_fkey(full_name, display_name)');
    if (req.query.status) query = query.eq('status', req.query.status as string);
    if (req.query.request_type) query = query.eq('request_type', req.query.request_type as string);
    const { data } = await query.order('created_at', { ascending: false });
    res.json({ requests: data || [] });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/lgpd-requests', async (req, res) => {
  try {
    const sb = db();
    const { request_type, requester_name, requester_email, requester_cpf, requester_phone, description } = req.body;
    if (!request_type || !requester_name || !requester_email || !description) {
      return res.status(400).json({ error: 'Campos obrigatorios: request_type, requester_name, requester_email, description' });
    }

    const protocol = generateProtocol('LGPD');
    const due_date = new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0]; // 15 dias uteis (simplificado)

    const { data, error } = await sb.from('lgpd_requests').insert({
      protocol, request_type, requester_name, requester_email,
      requester_cpf, requester_phone, description, due_date,
    }).select().single();
    if (error) throw error;

    // Notificar admins
    const { data: admins } = await sb.from('profiles').select('id').in('role', ['admin', 'super_admin']).eq('is_active', true);
    if (admins?.length) {
      await sb.from('notifications').insert(admins.map((a: any) => ({
        user_id: a.id, title: 'Nova Demanda LGPD',
        message: `Protocolo ${protocol} - ${request_type}`, type: 'warning',
      })));
    }

    res.json({ request: { protocol: data.protocol, id: data.id } });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/lgpd-requests/:id', authenticate, requirePermission('compliance.manage'), async (req: AuthRequest, res) => {
  try {
    const sb = db();
    const { status, assigned_to, response, legal_basis } = req.body;
    const updates: any = { updated_at: new Date().toISOString() };
    if (status) updates.status = status;
    if (assigned_to !== undefined) updates.assigned_to = assigned_to;
    if (response) updates.response = response;
    if (legal_basis) updates.legal_basis = legal_basis;
    if (status === 'COMPLETED') updates.completed_at = new Date().toISOString();

    const { data, error } = await sb.from('lgpd_requests').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;

    await logAudit(sb, { userId: req.user!.id, userName: req.user!.full_name, action: 'LGPD_REQUEST_UPDATED', resourceType: 'lgpd_request', resourceId: req.params.id, details: { status }, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ request: data });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ========== TREINAMENTOS ==========

router.get('/trainings', authenticate, async (req: AuthRequest, res) => {
  try {
    const sb = db();
    const isAdmin = isAdminRole(req.user!.role);
    let query = sb.from('trainings').select('*, kb_articles(title), profiles!trainings_created_by_fkey(full_name, display_name)').eq('is_active', true);
    if (req.query.training_type) query = query.eq('training_type', req.query.training_type as string);
    const { data: trainings } = await query.order('title');

    if (!isAdmin) {
      // Para usuario normal, trazer so os atribuidos
      const { data: assignments } = await sb.from('training_assignments').select('*, trainings(*, kb_articles(title))').eq('user_id', req.user!.id);
      const { data: completions } = await sb.from('training_completions').select('training_id, passed, score, completed_at').eq('user_id', req.user!.id);
      const compMap: Record<string, any> = {};
      (completions || []).forEach((c: any) => { compMap[c.training_id] = c; });

      return res.json({
        trainings: (assignments || []).map((a: any) => ({
          ...a.trainings, assignment: { id: a.id, status: a.status, due_date: a.due_date },
          completion: compMap[a.training_id] || null,
        })),
      });
    }

    // Para admin: contar atribuicoes e conclusoes
    const tids = (trainings || []).map((t: any) => t.id);
    const { data: assignments } = await sb.from('training_assignments').select('training_id, status').in('training_id', tids);
    const statsMap: Record<string, { assigned: number; completed: number }> = {};
    (assignments || []).forEach((a: any) => {
      if (!statsMap[a.training_id]) statsMap[a.training_id] = { assigned: 0, completed: 0 };
      statsMap[a.training_id].assigned++;
      if (a.status === 'COMPLETED') statsMap[a.training_id].completed++;
    });

    res.json({ trainings: (trainings || []).map((t: any) => ({ ...t, stats: statsMap[t.id] || { assigned: 0, completed: 0 } })) });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/trainings', authenticate, requirePermission('compliance.manage'), async (req: AuthRequest, res) => {
  try {
    const sb = db();
    const { title, description, training_type, kb_article_id, duration_minutes, is_mandatory, passing_score } = req.body;
    if (!title) return res.status(400).json({ error: 'Titulo obrigatorio' });

    const { data, error } = await sb.from('trainings').insert({
      title, description, training_type: training_type || 'COMPLIANCE',
      kb_article_id, duration_minutes: duration_minutes || 60,
      is_mandatory: is_mandatory || false, passing_score: passing_score || 70,
      created_by: req.user!.id,
    }).select().single();
    if (error) throw error;

    await logAudit(sb, { userId: req.user!.id, userName: req.user!.full_name, action: 'TRAINING_CREATED', resourceType: 'training', resourceId: data.id, resourceName: title, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ training: data });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/trainings/:id', authenticate, requirePermission('compliance.manage'), async (req: AuthRequest, res) => {
  try {
    const { title, description, training_type, kb_article_id, duration_minutes, is_mandatory, passing_score, is_active } = req.body;
    const { data, error } = await db().from('trainings').update({
      title, description, training_type, kb_article_id, duration_minutes, is_mandatory, passing_score, is_active, updated_at: new Date().toISOString(),
    }).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ training: data });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Atribuir treinamento a usuarios
router.post('/trainings/:id/assign', authenticate, requirePermission('compliance.manage'), async (req: AuthRequest, res) => {
  try {
    const sb = db();
    const { user_ids, due_date } = req.body;
    if (!user_ids?.length) return res.status(400).json({ error: 'user_ids obrigatorio' });

    const assignments = user_ids.map((uid: string) => ({
      training_id: req.params.id, user_id: uid, assigned_by: req.user!.id,
      due_date: due_date || null,
    }));

    const { data, error } = await sb.from('training_assignments').upsert(assignments, { onConflict: 'training_id,user_id' }).select();
    if (error) throw error;

    await notifyUsers(sb, user_ids, 'Novo Treinamento Atribuido', 'Voce recebeu um novo treinamento. Acesse a area de treinamentos.', 'info');
    res.json({ assignments: data });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Registrar conclusao de treinamento
router.post('/trainings/:id/complete', authenticate, async (req: AuthRequest, res) => {
  try {
    const sb = db();
    const { score, time_spent_minutes } = req.body;

    const { data: assignment } = await sb.from('training_assignments').select('id').eq('training_id', req.params.id).eq('user_id', req.user!.id).single();
    if (!assignment) return res.status(404).json({ error: 'Atribuicao nao encontrada' });

    const { data: training } = await sb.from('trainings').select('passing_score').eq('id', req.params.id).single();
    const passed = (score || 0) >= (training?.passing_score || 70);

    const { data, error } = await sb.from('training_completions').insert({
      assignment_id: assignment.id, training_id: req.params.id, user_id: req.user!.id,
      score, passed, time_spent_minutes,
    }).select().single();
    if (error) throw error;

    await sb.from('training_assignments').update({ status: passed ? 'COMPLETED' : 'IN_PROGRESS' }).eq('id', assignment.id);

    res.json({ completion: data });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
