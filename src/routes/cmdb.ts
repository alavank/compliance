import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { authenticate, AuthRequest, requirePermission } from '../middleware/auth';
import { logAudit } from '../services/audit';

const router = Router();
const db = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// ========== CI TYPES ==========

router.get('/ci-types', authenticate, async (_req: AuthRequest, res) => {
  try {
    const { data } = await db().from('ci_types').select('*').order('name');
    res.json({ types: data || [] });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/ci-types', authenticate, requirePermission('cmdb.manage'), async (req: AuthRequest, res) => {
  try {
    const { name, icon, color, description, fields_schema } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome obrigatorio' });
    const { data, error } = await db().from('ci_types').insert({ name, icon, color, description, fields_schema }).select().single();
    if (error) throw error;
    res.json({ type: data });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ========== LOCATIONS ==========

router.get('/locations', authenticate, async (_req: AuthRequest, res) => {
  try {
    const { data } = await db().from('locations').select('*').order('name');
    res.json({ locations: data || [] });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/locations', authenticate, requirePermission('cmdb.manage'), async (req: AuthRequest, res) => {
  try {
    const { name, location_type, parent_id, address, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome obrigatorio' });
    const { data, error } = await db().from('locations').insert({ name, location_type, parent_id, address, notes }).select().single();
    if (error) throw error;
    res.json({ location: data });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/locations/:id', authenticate, requirePermission('cmdb.manage'), async (req: AuthRequest, res) => {
  try {
    const { name, location_type, parent_id, address, notes } = req.body;
    const { data, error } = await db().from('locations').update({ name, location_type, parent_id, address, notes, updated_at: new Date().toISOString() }).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ location: data });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete('/locations/:id', authenticate, requirePermission('cmdb.manage'), async (req: AuthRequest, res) => {
  try {
    await db().from('locations').delete().eq('id', req.params.id);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ========== CONFIGURATION ITEMS ==========

router.get('/items', authenticate, async (req: AuthRequest, res) => {
  try {
    const sb = db();
    let query = sb.from('configuration_items').select('*, ci_types(name, icon, color), locations(name), organizations(name), profiles!configuration_items_managed_by_fkey(full_name, display_name)');

    if (req.query.ci_type_id) query = query.eq('ci_type_id', req.query.ci_type_id as string);
    if (req.query.status) query = query.eq('status', req.query.status as string);
    if (req.query.criticality) query = query.eq('criticality', req.query.criticality as string);
    if (req.query.location_id) query = query.eq('location_id', req.query.location_id as string);
    if (req.query.organization_id) query = query.eq('organization_id', req.query.organization_id as string);
    if (req.query.search) query = query.or(`name.ilike.%${req.query.search}%,hostname.ilike.%${req.query.search}%,ip_address.ilike.%${req.query.search}%`);

    const { data, error } = await query.order('name');
    if (error) throw error;
    res.json({ items: data || [] });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/items/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const sb = db();
    const { data: item } = await sb.from('configuration_items').select('*, ci_types(name, icon, color), locations(name, location_type), organizations(name), profiles!configuration_items_managed_by_fkey(full_name, display_name, email)').eq('id', req.params.id).single();
    if (!item) return res.status(404).json({ error: 'CI nao encontrado' });

    const [{ data: relOut }, { data: relIn }, { data: segments }, { data: runbooks }] = await Promise.all([
      sb.from('ci_relationships').select('*, configuration_items!ci_relationships_target_ci_id_fkey(id, name, status, ci_types(name, icon, color))').eq('source_ci_id', req.params.id),
      sb.from('ci_relationships').select('*, configuration_items!ci_relationships_source_ci_id_fkey(id, name, status, ci_types(name, icon, color))').eq('target_ci_id', req.params.id),
      sb.from('ci_network_segments').select('*, network_segments(id, name, vlan_id, subnet)').eq('ci_id', req.params.id),
      sb.from('runbooks').select('*, runbook_versions(id, version_number, created_at)').eq('ci_id', req.params.id).eq('is_active', true).order('title'),
    ]);

    res.json({
      item,
      relationships_out: relOut || [], relationships_in: relIn || [],
      network_segments: (segments || []).map((s: any) => ({ ...s.network_segments, ip_in_segment: s.ip_in_segment })),
      runbooks: runbooks || [],
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/items', authenticate, requirePermission('cmdb.manage'), async (req: AuthRequest, res) => {
  try {
    const sb = db();
    const { ci_type_id, name, description, status, criticality, location_id, organization_id, ip_address, hostname, serial_number, manufacturer, model, os, specs, custom_fields, managed_by } = req.body;
    if (!ci_type_id || !name) return res.status(400).json({ error: 'ci_type_id e name obrigatorios' });

    const { data, error } = await sb.from('configuration_items').insert({
      ci_type_id, name, description, status: status || 'ACTIVE', criticality: criticality || 'MEDIUM',
      location_id, organization_id, ip_address, hostname, serial_number, manufacturer, model, os,
      specs: specs || {}, custom_fields: custom_fields || {}, managed_by, created_by: req.user!.id,
    }).select().single();
    if (error) throw error;

    await logAudit(sb, { userId: req.user!.id, userName: req.user!.full_name, action: 'CI_CREATED', resourceType: 'ci', resourceId: data.id, resourceName: name, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ item: data });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/items/:id', authenticate, requirePermission('cmdb.manage'), async (req: AuthRequest, res) => {
  try {
    const sb = db();
    const { ci_type_id, name, description, status, criticality, location_id, organization_id, ip_address, hostname, serial_number, manufacturer, model, os, specs, custom_fields, managed_by } = req.body;

    const { data, error } = await sb.from('configuration_items').update({
      ci_type_id, name, description, status, criticality, location_id, organization_id,
      ip_address, hostname, serial_number, manufacturer, model, os, specs, custom_fields,
      managed_by, updated_at: new Date().toISOString(),
    }).eq('id', req.params.id).select().single();
    if (error) throw error;

    await logAudit(sb, { userId: req.user!.id, userName: req.user!.full_name, action: 'CI_UPDATED', resourceType: 'ci', resourceId: req.params.id, resourceName: name, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ item: data });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete('/items/:id', authenticate, requirePermission('cmdb.manage'), async (req: AuthRequest, res) => {
  try {
    const sb = db();
    await sb.from('configuration_items').delete().eq('id', req.params.id);
    await logAudit(sb, { userId: req.user!.id, userName: req.user!.full_name, action: 'CI_DELETED', resourceType: 'ci', resourceId: req.params.id, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ========== RELATIONSHIPS ==========

router.post('/relationships', authenticate, requirePermission('cmdb.manage'), async (req: AuthRequest, res) => {
  try {
    const { source_ci_id, target_ci_id, relationship_type, description } = req.body;
    if (!source_ci_id || !target_ci_id) return res.status(400).json({ error: 'source e target obrigatorios' });
    const { data, error } = await db().from('ci_relationships').insert({ source_ci_id, target_ci_id, relationship_type: relationship_type || 'DEPENDS_ON', description }).select().single();
    if (error) throw error;
    res.json({ relationship: data });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete('/relationships/:id', authenticate, requirePermission('cmdb.manage'), async (req: AuthRequest, res) => {
  try {
    await db().from('ci_relationships').delete().eq('id', req.params.id);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ========== NETWORK SEGMENTS ==========

router.get('/network-segments', authenticate, async (_req: AuthRequest, res) => {
  try {
    const { data } = await db().from('network_segments').select('*, locations(name)').order('name');
    res.json({ segments: data || [] });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/network-segments', authenticate, requirePermission('cmdb.manage'), async (req: AuthRequest, res) => {
  try {
    const { name, vlan_id, subnet, gateway, description, location_id } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome obrigatorio' });
    const { data, error } = await db().from('network_segments').insert({ name, vlan_id, subnet, gateway, description, location_id }).select().single();
    if (error) throw error;
    res.json({ segment: data });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/network-segments/:id', authenticate, requirePermission('cmdb.manage'), async (req: AuthRequest, res) => {
  try {
    const { name, vlan_id, subnet, gateway, description, location_id, is_active } = req.body;
    const { data, error } = await db().from('network_segments').update({ name, vlan_id, subnet, gateway, description, location_id, is_active, updated_at: new Date().toISOString() }).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ segment: data });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ========== RUNBOOKS ==========

router.get('/runbooks', authenticate, async (req: AuthRequest, res) => {
  try {
    const sb = db();
    let query = sb.from('runbooks').select('*, configuration_items(name, ci_types(name, icon)), profiles!runbooks_created_by_fkey(full_name, display_name)').eq('is_active', true);
    if (req.query.ci_id) query = query.eq('ci_id', req.query.ci_id as string);
    if (req.query.category) query = query.eq('category', req.query.category as string);
    const { data } = await query.order('title');
    res.json({ runbooks: data || [] });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/runbooks/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const sb = db();
    const { data: runbook } = await sb.from('runbooks').select('*, configuration_items(name, ci_types(name, icon)), profiles!runbooks_created_by_fkey(full_name, display_name)').eq('id', req.params.id).single();
    if (!runbook) return res.status(404).json({ error: 'Runbook nao encontrado' });

    const { data: versions } = await sb.from('runbook_versions').select('*, profiles!runbook_versions_created_by_fkey(full_name, display_name)').eq('runbook_id', req.params.id).order('version_number', { ascending: false });
    res.json({ runbook, versions: versions || [] });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/runbooks', authenticate, requirePermission('cmdb.manage'), async (req: AuthRequest, res) => {
  try {
    const sb = db();
    const { title, description, ci_id, kb_article_id, category, severity, content } = req.body;
    if (!title) return res.status(400).json({ error: 'Titulo obrigatorio' });

    const { data: runbook, error } = await sb.from('runbooks').insert({
      title, description, ci_id, kb_article_id, category: category || 'GENERAL',
      severity: severity || 'MEDIUM', created_by: req.user!.id,
    }).select().single();
    if (error) throw error;

    if (content) {
      await sb.from('runbook_versions').insert({
        runbook_id: runbook.id, version_number: 1, content, change_notes: 'Versao inicial', created_by: req.user!.id,
      });
    }

    await logAudit(sb, { userId: req.user!.id, userName: req.user!.full_name, action: 'RUNBOOK_CREATED', resourceType: 'runbook', resourceId: runbook.id, resourceName: title, ipAddress: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ runbook });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/runbooks/:id', authenticate, requirePermission('cmdb.manage'), async (req: AuthRequest, res) => {
  try {
    const sb = db();
    const { title, description, ci_id, kb_article_id, category, severity, is_active, content, change_notes } = req.body;

    const { data: runbook, error } = await sb.from('runbooks').update({
      title, description, ci_id, kb_article_id, category, severity, is_active, updated_at: new Date().toISOString(),
    }).eq('id', req.params.id).select().single();
    if (error) throw error;

    if (content) {
      const { data: lastVer } = await sb.from('runbook_versions').select('version_number').eq('runbook_id', req.params.id).order('version_number', { ascending: false }).limit(1).single();
      await sb.from('runbook_versions').insert({
        runbook_id: req.params.id, version_number: (lastVer?.version_number || 0) + 1,
        content, change_notes, created_by: req.user!.id,
      });
    }

    res.json({ runbook });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
