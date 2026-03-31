import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { authenticate, AuthRequest, requirePermission } from '../middleware/auth';
import { logAudit } from '../services/audit';
import { isAdminRole } from '../lib/permissions';

const router = Router();
const db = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// ========== BASES ==========

router.get('/bases', authenticate, async (req: AuthRequest, res) => {
  try {
    const sb = db();
    const { data } = await sb.from('kb_bases').select('*, organizations(name), profiles!kb_bases_created_by_fkey(full_name, display_name)').eq('is_active', true).order('name');

    // Contar artigos por base
    const baseIds = (data || []).map((b: any) => b.id);
    const { data: articleCounts } = await sb.from('kb_articles').select('base_id, id').in('base_id', baseIds);
    const countMap: Record<string, number> = {};
    (articleCounts || []).forEach((a: any) => { countMap[a.base_id] = (countMap[a.base_id] || 0) + 1; });

    res.json({ bases: (data || []).map((b: any) => ({ ...b, article_count: countMap[b.id] || 0 })) });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/bases', authenticate, requirePermission('kb.manage'), async (req: AuthRequest, res) => {
  try {
    const sb = db();
    const { name, description, icon, color, organization_id, visibility } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome obrigatorio' });

    const { data, error } = await sb.from('kb_bases').insert({
      name, description, icon: icon || 'book-open', color: color || '#6366f1',
      organization_id, visibility: visibility || 'INTERNAL', created_by: req.user!.id,
    }).select().single();
    if (error) throw error;

    await logAudit(sb, { userId: req.user!.id, userName: req.user!.full_name, action: 'KB_BASE_CREATED', resourceType: 'kb_base', resourceId: data.id, resourceName: name, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ base: data });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/bases/:id', authenticate, requirePermission('kb.manage'), async (req: AuthRequest, res) => {
  try {
    const sb = db();
    const { name, description, icon, color, organization_id, visibility, is_active } = req.body;
    const { data, error } = await sb.from('kb_bases').update({
      name, description, icon, color, organization_id, visibility, is_active, updated_at: new Date().toISOString(),
    }).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ base: data });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete('/bases/:id', authenticate, requirePermission('kb.manage'), async (req: AuthRequest, res) => {
  try {
    const sb = db();
    const { error } = await sb.from('kb_bases').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ========== CATEGORIAS ==========

router.get('/bases/:baseId/categories', authenticate, async (req: AuthRequest, res) => {
  try {
    const sb = db();
    const { data } = await sb.from('kb_categories').select('*').eq('base_id', req.params.baseId).order('sort_order').order('name');
    res.json({ categories: data || [] });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/categories', authenticate, requirePermission('kb.manage'), async (req: AuthRequest, res) => {
  try {
    const sb = db();
    const { base_id, name, description, icon, parent_id, sort_order } = req.body;
    if (!base_id || !name) return res.status(400).json({ error: 'base_id e name obrigatorios' });
    const { data, error } = await sb.from('kb_categories').insert({ base_id, name, description, icon, parent_id, sort_order: sort_order || 0 }).select().single();
    if (error) throw error;
    res.json({ category: data });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/categories/:id', authenticate, requirePermission('kb.manage'), async (req: AuthRequest, res) => {
  try {
    const sb = db();
    const { name, description, icon, parent_id, sort_order } = req.body;
    const { data, error } = await sb.from('kb_categories').update({ name, description, icon, parent_id, sort_order, updated_at: new Date().toISOString() }).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ category: data });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete('/categories/:id', authenticate, requirePermission('kb.manage'), async (req: AuthRequest, res) => {
  try {
    const sb = db();
    await sb.from('kb_categories').delete().eq('id', req.params.id);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ========== LABELS ==========

router.get('/labels', authenticate, async (_req: AuthRequest, res) => {
  try {
    const { data } = await db().from('kb_labels').select('*').order('name');
    res.json({ labels: data || [] });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/labels', authenticate, requirePermission('kb.manage'), async (req: AuthRequest, res) => {
  try {
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome obrigatorio' });
    const { data, error } = await db().from('kb_labels').insert({ name, color: color || '#64748b' }).select().single();
    if (error) throw error;
    res.json({ label: data });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ========== ARTIGOS ==========

router.get('/articles', authenticate, async (req: AuthRequest, res) => {
  try {
    const sb = db();
    let query = sb.from('kb_articles').select('*, kb_bases(name, icon, color), kb_categories(name), profiles!kb_articles_created_by_fkey(full_name, display_name)');

    if (req.query.base_id) query = query.eq('base_id', req.query.base_id as string);
    if (req.query.category_id) query = query.eq('category_id', req.query.category_id as string);
    if (req.query.article_type) query = query.eq('article_type', req.query.article_type as string);
    if (req.query.status) query = query.eq('status', req.query.status as string);
    else query = query.neq('status', 'ARCHIVED');
    if (req.query.search) query = query.or(`title.ilike.%${req.query.search}%,content.ilike.%${req.query.search}%`);

    const { data, error } = await query.order('is_pinned', { ascending: false }).order('updated_at', { ascending: false });
    if (error) throw error;

    // Carregar labels dos artigos
    const articleIds = (data || []).map((a: any) => a.id);
    const { data: articleLabels } = await sb.from('kb_article_labels').select('article_id, label_id, kb_labels(id, name, color)').in('article_id', articleIds);

    const labelMap: Record<string, any[]> = {};
    (articleLabels || []).forEach((al: any) => {
      if (!labelMap[al.article_id]) labelMap[al.article_id] = [];
      labelMap[al.article_id].push(al.kb_labels);
    });

    res.json({ articles: (data || []).map((a: any) => ({ ...a, labels: labelMap[a.id] || [] })) });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/articles/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const sb = db();
    const { data: article } = await sb.from('kb_articles').select('*, kb_bases(name, icon, color), kb_categories(name), profiles!kb_articles_created_by_fkey(full_name, display_name)').eq('id', req.params.id).single();
    if (!article) return res.status(404).json({ error: 'Artigo nao encontrado' });

    // Incrementar view_count
    await sb.from('kb_articles').update({ view_count: (article.view_count || 0) + 1 }).eq('id', req.params.id);

    const [{ data: versions }, { data: labels }, { data: attachments }, { data: reviews }] = await Promise.all([
      sb.from('kb_article_versions').select('*, profiles!kb_article_versions_created_by_fkey(full_name, display_name)').eq('article_id', req.params.id).order('version_number', { ascending: false }),
      sb.from('kb_article_labels').select('label_id, kb_labels(id, name, color)').eq('article_id', req.params.id),
      sb.from('kb_article_attachments').select('*').eq('article_id', req.params.id).order('created_at', { ascending: false }),
      sb.from('kb_article_reviews').select('*, profiles!kb_article_reviews_reviewer_id_fkey(full_name, display_name)').eq('article_id', req.params.id).order('review_date', { ascending: false }),
    ]);

    res.json({
      article, versions: versions || [],
      labels: (labels || []).map((l: any) => l.kb_labels),
      attachments: attachments || [], reviews: reviews || [],
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/articles', authenticate, requirePermission('kb.manage'), async (req: AuthRequest, res) => {
  try {
    const sb = db();
    const { base_id, category_id, title, content, summary, article_type, visibility, status, is_pinned, label_ids } = req.body;
    if (!base_id || !title) return res.status(400).json({ error: 'base_id e title obrigatorios' });

    const published_at = status === 'PUBLISHED' ? new Date().toISOString() : null;
    const { data: article, error } = await sb.from('kb_articles').insert({
      base_id, category_id, title, content: content || '', summary, article_type: article_type || 'TUTORIAL',
      visibility: visibility || 'INTERNAL', status: status || 'DRAFT', is_pinned: is_pinned || false,
      created_by: req.user!.id, updated_by: req.user!.id, published_at,
    }).select().single();
    if (error) throw error;

    // Criar versao inicial
    await sb.from('kb_article_versions').insert({
      article_id: article.id, version_number: 1, title, content: content || '',
      change_notes: 'Versao inicial', created_by: req.user!.id,
    });

    // Associar labels
    if (label_ids?.length) {
      await sb.from('kb_article_labels').insert(label_ids.map((lid: string) => ({ article_id: article.id, label_id: lid })));
    }

    await logAudit(sb, { userId: req.user!.id, userName: req.user!.full_name, action: 'KB_ARTICLE_CREATED', resourceType: 'kb_article', resourceId: article.id, resourceName: title, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ article });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/articles/:id', authenticate, requirePermission('kb.manage'), async (req: AuthRequest, res) => {
  try {
    const sb = db();
    const { category_id, title, content, summary, article_type, visibility, status, is_pinned, label_ids, change_notes } = req.body;

    const { data: current } = await sb.from('kb_articles').select('*').eq('id', req.params.id).single();
    if (!current) return res.status(404).json({ error: 'Artigo nao encontrado' });

    const published_at = status === 'PUBLISHED' && current.status !== 'PUBLISHED' ? new Date().toISOString() : current.published_at;
    const { data: article, error } = await sb.from('kb_articles').update({
      category_id, title, content, summary, article_type, visibility, status, is_pinned,
      updated_by: req.user!.id, updated_at: new Date().toISOString(), published_at,
    }).eq('id', req.params.id).select().single();
    if (error) throw error;

    // Se conteudo mudou, criar nova versao
    if (content !== current.content || title !== current.title) {
      const { data: lastVersion } = await sb.from('kb_article_versions').select('version_number').eq('article_id', req.params.id).order('version_number', { ascending: false }).limit(1).single();
      await sb.from('kb_article_versions').insert({
        article_id: req.params.id, version_number: (lastVersion?.version_number || 0) + 1,
        title, content, change_notes: change_notes || null, created_by: req.user!.id,
      });
    }

    // Atualizar labels
    if (label_ids !== undefined) {
      await sb.from('kb_article_labels').delete().eq('article_id', req.params.id);
      if (label_ids.length) {
        await sb.from('kb_article_labels').insert(label_ids.map((lid: string) => ({ article_id: req.params.id, label_id: lid })));
      }
    }

    await logAudit(sb, { userId: req.user!.id, userName: req.user!.full_name, action: 'KB_ARTICLE_UPDATED', resourceType: 'kb_article', resourceId: req.params.id, resourceName: title, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ article });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete('/articles/:id', authenticate, requirePermission('kb.manage'), async (req: AuthRequest, res) => {
  try {
    const sb = db();
    await sb.from('kb_articles').delete().eq('id', req.params.id);
    await logAudit(sb, { userId: req.user!.id, userName: req.user!.full_name, action: 'KB_ARTICLE_DELETED', resourceType: 'kb_article', resourceId: req.params.id, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ========== REVIEWS ==========

router.post('/articles/:id/reviews', authenticate, requirePermission('kb.manage'), async (req: AuthRequest, res) => {
  try {
    const sb = db();
    const { reviewer_id, review_date, notes } = req.body;
    if (!review_date) return res.status(400).json({ error: 'review_date obrigatoria' });
    const { data, error } = await sb.from('kb_article_reviews').insert({
      article_id: req.params.id, reviewer_id: reviewer_id || req.user!.id, review_date, notes,
    }).select().single();
    if (error) throw error;
    res.json({ review: data });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/reviews/:id', authenticate, requirePermission('kb.manage'), async (req: AuthRequest, res) => {
  try {
    const sb = db();
    const { status, notes } = req.body;
    const completed_at = status === 'COMPLETED' ? new Date().toISOString() : null;
    const { data, error } = await sb.from('kb_article_reviews').update({ status, notes, completed_at }).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ review: data });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
