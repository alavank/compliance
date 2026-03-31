import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { AuthRequest, authenticate, requirePermission } from '../middleware/auth';
import { logAudit } from '../services/audit';
import { sendEmail, buildTermAcceptanceEmail } from '../services/email';

const router = Router();
const sb = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

router.get('/latest', authenticate, async (_req: AuthRequest, res) => {
  try {
    const { data } = await sb().from('terms').select('*').order('created_at', { ascending: false }).limit(1).single();
    return res.json({ term: data });
  } catch {
    return res.status(500).json({ error: 'Erro' });
  }
});

router.post('/accept', authenticate, async (req: AuthRequest, res) => {
  try {
    const { term_id, term_version, full_name_typed, cpf, extra_email } = req.body;
    if (!term_id || !full_name_typed) return res.status(400).json({ error: 'Dados obrigatorios' });

    const db = sb();
    const { data: term } = await db.from('terms').select('*').eq('id', term_id).single();
    if (!term) return res.status(404).json({ error: 'Termo nao encontrado' });

    const now = new Date().toISOString();
    const hashContent = term.content + '|' + full_name_typed + '|' + (cpf || '') + '|' + req.user!.id + '|' + now + '|' + (req.ip || '');
    const hash = crypto.createHash('sha256').update(hashContent).digest('hex');

    await db.from('term_acceptances').insert({
      user_id: req.user!.id,
      term_id,
      term_version: String(term_version || term.version || '1'),
      full_name_typed,
      cpf: cpf || null,
      extra_email: extra_email || null,
      ip_address: req.ip || null,
    });

    await logAudit(db, {
      userId: req.user!.id,
      userName: req.user!.full_name,
      action: 'TERM_ACCEPTED',
      resourceType: 'term',
      resourceId: term_id,
      details: { version: term_version, hash },
      ipAddress: req.ip,
    });

    const emailHtml = buildTermAcceptanceEmail({
      userName: full_name_typed,
      cpf: cpf || 'Nao informado',
      hash,
      termTitle: term.title,
      termVersion: term.version,
      termContent: term.content,
      acceptedAt: new Date(now).toLocaleString('pt-BR'),
      ipAddress: req.ip || 'Nao registrado',
    });

    await sendEmail(req.user!.email, 'Comprovante de Aceite - Cofre de Senhas', emailHtml);
    if (extra_email && extra_email.includes('@')) {
      await sendEmail(extra_email, 'Comprovante de Aceite - Cofre de Senhas', emailHtml);
    }

    return res.json({ message: 'Termo aceito', hash });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Erro' });
  }
});

router.post('/', authenticate, requirePermission('terms.manage'), async (req: AuthRequest, res) => {
  try {
    const { title, version, elaboration_date, content } = req.body;
    if (!title || !version || !elaboration_date || !content) {
      return res.status(400).json({ error: 'Titulo, versao, data de elaboracao e conteudo sao obrigatorios' });
    }

    const db = sb();
    const { data, error } = await db
      .from('terms')
      .insert({
        title,
        version: String(version).trim(),
        elaboration_date,
        content,
        created_by: req.user!.id,
      })
      .select()
      .single();
    if (error) throw error;

    await logAudit(db, {
      userId: req.user!.id,
      userName: req.user!.full_name,
      action: 'TERM_CREATED',
      resourceType: 'term',
      resourceId: data.id,
      details: { version: data.version, elaboration_date },
      ipAddress: req.ip,
    });

    return res.status(201).json({ term: data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Erro' });
  }
});

router.put('/:id', authenticate, requirePermission('terms.manage'), async (req: AuthRequest, res) => {
  try {
    const { title, version, elaboration_date, content } = req.body;
    if (!title || !version || !elaboration_date || !content) {
      return res.status(400).json({ error: 'Titulo, versao, data de elaboracao e conteudo sao obrigatorios' });
    }

    const db = sb();
    const { data: current } = await db.from('terms').select('id, title, version, elaboration_date').eq('id', req.params.id).single();
    if (!current) return res.status(404).json({ error: 'Termo nao encontrado' });

    const { data, error } = await db
      .from('terms')
      .update({
        title,
        version: String(version).trim(),
        elaboration_date,
        content,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;

    await logAudit(db, {
      userId: req.user!.id,
      userName: req.user!.full_name,
      action: 'TERM_UPDATED',
      resourceType: 'term',
      resourceId: req.params.id,
      resourceName: title,
      details: {
        previous_title: current.title,
        previous_version: current.version,
        previous_elaboration_date: current.elaboration_date,
        version: data.version,
        elaboration_date,
      },
      ipAddress: req.ip,
    });

    return res.json({ term: data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Erro' });
  }
});

router.delete('/:id', authenticate, requirePermission('terms.manage'), async (req: AuthRequest, res) => {
  try {
    const db = sb();
    const { data: current } = await db.from('terms').select('id, title, version').eq('id', req.params.id).single();
    if (!current) return res.status(404).json({ error: 'Termo nao encontrado' });

    const { error } = await db.from('terms').delete().eq('id', req.params.id);
    if (error) throw error;

    await logAudit(db, {
      userId: req.user!.id,
      userName: req.user!.full_name,
      action: 'TERM_DELETED',
      resourceType: 'term',
      resourceId: req.params.id,
      resourceName: current.title,
      details: { version: current.version },
      ipAddress: req.ip,
    });

    return res.json({ message: 'Termo excluido' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Erro' });
  }
});

router.get('/', authenticate, requirePermission('terms.manage'), async (_req: AuthRequest, res) => {
  try {
    const db = sb();
    const { data, error } = await db.from('terms').select('*').order('created_at', { ascending: false });
    if (error) throw error;

    const creatorIds = [...new Set((data || []).map((term: any) => term.created_by).filter(Boolean))];
    let creators: Record<string, any> = {};

    if (creatorIds.length) {
      const { data: profiles } = await db.from('profiles').select('id, full_name, display_name, email').in('id', creatorIds);
      (profiles || []).forEach((profile: any) => {
        creators[profile.id] = profile;
      });
    }

    const terms = (data || []).map((term: any) => ({
      ...term,
      profiles: term.created_by ? creators[term.created_by] || null : null,
    }));

    return res.json({ terms });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Erro' });
  }
});

router.get('/:id/acceptances', authenticate, requirePermission('terms.manage'), async (req: AuthRequest, res) => {
  try {
    const { data } = await sb()
      .from('term_acceptances')
      .select('*, profiles(full_name, email)')
      .eq('term_id', req.params.id)
      .order('accepted_at', { ascending: false });
    return res.json({ acceptances: data || [] });
  } catch {
    return res.status(500).json({ error: 'Erro' });
  }
});

export default router;
