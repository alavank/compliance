import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { authenticate, AuthRequest, requirePermission } from '../middleware/auth';
import { logAudit, notifyUsers } from '../services/audit';

const router = Router();
const db = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// ========== JOB PROFILES ==========

router.get('/job-profiles', authenticate, async (_req: AuthRequest, res) => {
  try {
    const { data } = await db().from('job_profiles').select('*, organizations(name)').eq('is_active', true).order('name');
    res.json({ profiles: data || [] });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/job-profiles', authenticate, requirePermission('onboarding.manage'), async (req: AuthRequest, res) => {
  try {
    const { name, description, organization_id, default_role } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome obrigatorio' });
    const { data, error } = await db().from('job_profiles').insert({ name, description, organization_id, default_role, created_by: req.user!.id }).select().single();
    if (error) throw error;
    res.json({ profile: data });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/job-profiles/:id', authenticate, requirePermission('onboarding.manage'), async (req: AuthRequest, res) => {
  try {
    const { name, description, organization_id, default_role, is_active } = req.body;
    const { data, error } = await db().from('job_profiles').update({ name, description, organization_id, default_role, is_active, updated_at: new Date().toISOString() }).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ profile: data });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ========== TEMPLATES ==========

router.get('/templates', authenticate, async (req: AuthRequest, res) => {
  try {
    const sb = db();
    let query = sb.from('onboarding_templates').select('*, job_profiles(name), organizations(name), profiles!onboarding_templates_created_by_fkey(full_name, display_name)').eq('is_active', true);
    if (req.query.type) query = query.eq('template_type', req.query.type as string);
    const { data } = await query.order('name');

    // Contar tarefas por template
    const tids = (data || []).map((t: any) => t.id);
    const { data: taskCounts } = await sb.from('onboarding_template_tasks').select('template_id, id').in('template_id', tids);
    const countMap: Record<string, number> = {};
    (taskCounts || []).forEach((t: any) => { countMap[t.template_id] = (countMap[t.template_id] || 0) + 1; });

    res.json({ templates: (data || []).map((t: any) => ({ ...t, task_count: countMap[t.id] || 0 })) });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/templates/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const sb = db();
    const { data: template } = await sb.from('onboarding_templates').select('*, job_profiles(name), organizations(name)').eq('id', req.params.id).single();
    if (!template) return res.status(404).json({ error: 'Template nao encontrado' });

    const { data: tasks } = await sb.from('onboarding_template_tasks').select('*, kb_articles(title), vaults(name), passwords(system_name), configuration_items(name), runbooks(title)').eq('template_id', req.params.id).order('sort_order');

    res.json({ template, tasks: tasks || [] });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/templates', authenticate, requirePermission('onboarding.manage'), async (req: AuthRequest, res) => {
  try {
    const sb = db();
    const { name, description, template_type, job_profile_id, organization_id } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome obrigatorio' });

    const { data, error } = await sb.from('onboarding_templates').insert({
      name, description, template_type: template_type || 'ONBOARDING',
      job_profile_id, organization_id, created_by: req.user!.id,
    }).select().single();
    if (error) throw error;

    await logAudit(sb, { userId: req.user!.id, userName: req.user!.full_name, action: 'ONBOARDING_TEMPLATE_CREATED', resourceType: 'onboarding_template', resourceId: data.id, resourceName: name, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ template: data });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/templates/:id', authenticate, requirePermission('onboarding.manage'), async (req: AuthRequest, res) => {
  try {
    const { name, description, template_type, job_profile_id, organization_id, is_active } = req.body;
    const { data, error } = await db().from('onboarding_templates').update({
      name, description, template_type, job_profile_id, organization_id, is_active, updated_at: new Date().toISOString(),
    }).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ template: data });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ========== TEMPLATE TASKS ==========

router.post('/templates/:id/tasks', authenticate, requirePermission('onboarding.manage'), async (req: AuthRequest, res) => {
  try {
    const { title, description, task_type, sort_order, is_required, due_days, assigned_role, kb_article_id, vault_id, secret_id, ci_id, runbook_id } = req.body;
    if (!title) return res.status(400).json({ error: 'Titulo obrigatorio' });

    const { data, error } = await db().from('onboarding_template_tasks').insert({
      template_id: req.params.id, title, description, task_type: task_type || 'MANUAL',
      sort_order: sort_order || 0, is_required: is_required !== false, due_days: due_days || 7,
      assigned_role, kb_article_id, vault_id, secret_id, ci_id, runbook_id,
    }).select().single();
    if (error) throw error;
    res.json({ task: data });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/template-tasks/:id', authenticate, requirePermission('onboarding.manage'), async (req: AuthRequest, res) => {
  try {
    const { title, description, task_type, sort_order, is_required, due_days, assigned_role, kb_article_id, vault_id, secret_id, ci_id, runbook_id } = req.body;
    const { data, error } = await db().from('onboarding_template_tasks').update({
      title, description, task_type, sort_order, is_required, due_days, assigned_role,
      kb_article_id, vault_id, secret_id, ci_id, runbook_id,
    }).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ task: data });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete('/template-tasks/:id', authenticate, requirePermission('onboarding.manage'), async (req: AuthRequest, res) => {
  try {
    await db().from('onboarding_template_tasks').delete().eq('id', req.params.id);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ========== INSTANCES ==========

router.get('/instances', authenticate, async (req: AuthRequest, res) => {
  try {
    const sb = db();
    let query = sb.from('onboarding_instances').select('*, profiles!onboarding_instances_user_id_fkey(full_name, display_name, email, avatar_url), onboarding_templates(name, template_type), profiles!onboarding_instances_created_by_fkey(full_name, display_name)');
    if (req.query.status) query = query.eq('status', req.query.status as string);
    if (req.query.type) query = query.eq('instance_type', req.query.type as string);
    const { data } = await query.order('created_at', { ascending: false });

    // Contar progresso das tarefas
    const instanceIds = (data || []).map((i: any) => i.id);
    const { data: tasks } = await sb.from('onboarding_tasks').select('instance_id, status').in('instance_id', instanceIds);

    const progressMap: Record<string, { total: number; completed: number }> = {};
    (tasks || []).forEach((t: any) => {
      if (!progressMap[t.instance_id]) progressMap[t.instance_id] = { total: 0, completed: 0 };
      progressMap[t.instance_id].total++;
      if (t.status === 'COMPLETED') progressMap[t.instance_id].completed++;
    });

    res.json({ instances: (data || []).map((i: any) => ({ ...i, progress: progressMap[i.id] || { total: 0, completed: 0 } })) });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/instances/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const sb = db();
    const { data: instance } = await sb.from('onboarding_instances').select('*, profiles!onboarding_instances_user_id_fkey(full_name, display_name, email), onboarding_templates(name, template_type)').eq('id', req.params.id).single();
    if (!instance) return res.status(404).json({ error: 'Instancia nao encontrada' });

    const { data: tasks } = await sb.from('onboarding_tasks').select('*, kb_articles(title), vaults(name), passwords(system_name), configuration_items(name), runbooks(title), profiles!onboarding_tasks_completed_by_fkey(full_name, display_name)').eq('instance_id', req.params.id).order('sort_order');

    res.json({ instance, tasks: tasks || [] });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Criar instancia a partir de template
router.post('/instances', authenticate, requirePermission('onboarding.manage'), async (req: AuthRequest, res) => {
  try {
    const sb = db();
    const { template_id, user_id, due_date, notes } = req.body;
    if (!template_id || !user_id) return res.status(400).json({ error: 'template_id e user_id obrigatorios' });

    const { data: template } = await sb.from('onboarding_templates').select('*').eq('id', template_id).single();
    if (!template) return res.status(404).json({ error: 'Template nao encontrado' });

    const { data: instance, error } = await sb.from('onboarding_instances').insert({
      template_id, user_id, instance_type: template.template_type, due_date, notes, created_by: req.user!.id,
    }).select().single();
    if (error) throw error;

    // Copiar tarefas do template
    const { data: templateTasks } = await sb.from('onboarding_template_tasks').select('*').eq('template_id', template_id).order('sort_order');
    if (templateTasks?.length) {
      const baseDueDate = due_date ? new Date(due_date) : new Date();
      const instanceTasks = templateTasks.map((tt: any) => ({
        instance_id: instance.id, template_task_id: tt.id, title: tt.title,
        description: tt.description, task_type: tt.task_type, sort_order: tt.sort_order,
        is_required: tt.is_required, kb_article_id: tt.kb_article_id, vault_id: tt.vault_id,
        secret_id: tt.secret_id, ci_id: tt.ci_id, runbook_id: tt.runbook_id,
        due_date: tt.due_days ? new Date(baseDueDate.getTime() + tt.due_days * 86400000).toISOString().split('T')[0] : null,
      }));
      await sb.from('onboarding_tasks').insert(instanceTasks);
    }

    // Notificar o usuario
    await notifyUsers(sb, [user_id], template.template_type === 'ONBOARDING' ? 'Bem-vindo! Onboarding iniciado' : 'Offboarding iniciado', `Seu checklist de ${template.name} esta disponivel.`, 'info');

    await logAudit(sb, { userId: req.user!.id, userName: req.user!.full_name, action: 'ONBOARDING_STARTED', resourceType: 'onboarding_instance', resourceId: instance.id, details: { user_id, template_name: template.name }, ipAddress: req.ip, userAgent: req.headers['user-agent'] });

    res.json({ instance });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ========== INSTANCE TASKS ==========

// Atualizar status de uma tarefa
router.put('/tasks/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const sb = db();
    const { status, evidence_url, evidence_notes } = req.body;

    const updates: any = { status, updated_at: new Date().toISOString() };
    if (status === 'COMPLETED') {
      updates.completed_at = new Date().toISOString();
      updates.completed_by = req.user!.id;
    }
    if (evidence_url !== undefined) updates.evidence_url = evidence_url;
    if (evidence_notes !== undefined) updates.evidence_notes = evidence_notes;

    const { data, error } = await sb.from('onboarding_tasks').update(updates).eq('id', req.params.id).select('*, onboarding_instances(id, template_id, user_id)').single();
    if (error) throw error;

    // Verificar se todas as tarefas estao concluidas
    const instanceId = data.onboarding_instances?.id || data.instance_id;
    const { data: allTasks } = await sb.from('onboarding_tasks').select('status, is_required').eq('instance_id', instanceId);
    const allRequiredDone = (allTasks || []).filter((t: any) => t.is_required).every((t: any) => t.status === 'COMPLETED' || t.status === 'SKIPPED');

    if (allRequiredDone) {
      await sb.from('onboarding_instances').update({ status: 'COMPLETED', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', instanceId);
    }

    res.json({ task: data, instance_completed: allRequiredDone });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
