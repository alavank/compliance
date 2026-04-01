import React, { useEffect, useState } from 'react';
import { Server, Plus, Search, Loader2, X, Edit2, Trash2, ChevronRight, MapPin, Network, BookOpen, AlertTriangle, Link2, Monitor, Database, Wifi, Shield, HardDrive, Globe, Filter } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { hasPermission } from '../lib/access';
import { api } from '../lib/api';

type Tab = 'items' | 'locations' | 'network' | 'runbooks';

const CRITICALITY_LABELS: Record<string, string> = { LOW: 'Baixa', MEDIUM: 'Media', HIGH: 'Alta', CRITICAL: 'Critica' };
const CRITICALITY_COLORS: Record<string, string> = { LOW: 'bg-slate-500/20 text-slate-300', MEDIUM: 'bg-blue-500/20 text-blue-300', HIGH: 'bg-amber-500/20 text-amber-300', CRITICAL: 'bg-red-500/20 text-red-300' };
const STATUS_LABELS: Record<string, string> = { ACTIVE: 'Ativo', INACTIVE: 'Inativo', MAINTENANCE: 'Manutencao', DECOMMISSIONED: 'Desativado' };
const STATUS_COLORS: Record<string, string> = { ACTIVE: 'bg-green-500/20 text-green-300', INACTIVE: 'bg-slate-500/20 text-slate-300', MAINTENANCE: 'bg-amber-500/20 text-amber-300', DECOMMISSIONED: 'bg-red-500/20 text-red-300' };
const RB_CATEGORY_LABELS: Record<string, string> = { GENERAL: 'Geral', INCIDENT: 'Incidente', CHANGE: 'Mudanca', MAINTENANCE: 'Manutencao', SECURITY: 'Seguranca', BACKUP: 'Backup', DEPLOY: 'Deploy' };
const RB_SEVERITY_LABELS: Record<string, string> = { LOW: 'Baixa', MEDIUM: 'Media', HIGH: 'Alta', CRITICAL: 'Critica' };

export default function CMDB() {
  const { user } = useAuth();
  const canManage = hasPermission(user, 'cmdb.manage');
  const [tab, setTab] = useState<Tab>('items');
  const [loading, setLoading] = useState(true);

  // CI Items
  const [items, setItems] = useState<any[]>([]);
  const [ciTypes, setCiTypes] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [segments, setSegments] = useState<any[]>([]);
  const [runbooks, setRunbooks] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCriticality, setFilterCriticality] = useState('');

  // Detail
  const [detail, setDetail] = useState<any>(null);

  // Forms
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [itemForm, setItemForm] = useState({ ci_type_id: '', name: '', description: '', status: 'ACTIVE', criticality: 'MEDIUM', location_id: '', organization_id: '', ip_address: '', hostname: '', serial_number: '', manufacturer: '', model: '', os: '' });

  const [showLocationForm, setShowLocationForm] = useState(false);
  const [editingLocation, setEditingLocation] = useState<any>(null);
  const [locationForm, setLocationForm] = useState({ name: '', location_type: 'BUILDING', parent_id: '', address: '', notes: '' });

  const [showSegmentForm, setShowSegmentForm] = useState(false);
  const [editingSegment, setEditingSegment] = useState<any>(null);
  const [segmentForm, setSegmentForm] = useState({ name: '', vlan_id: '', subnet: '', gateway: '', description: '', location_id: '' });

  const [showRunbookForm, setShowRunbookForm] = useState(false);
  const [editingRunbook, setEditingRunbook] = useState<any>(null);
  const [runbookForm, setRunbookForm] = useState({ title: '', description: '', ci_id: '', category: 'GENERAL', severity: 'MEDIUM', content: '' });

  const [showTypeForm, setShowTypeForm] = useState(false);
  const [typeForm, setTypeForm] = useState({ name: '', description: '', icon: '', color: '#6366f1' });

  // Relationship
  const [showRelForm, setShowRelForm] = useState(false);
  const [relForm, setRelForm] = useState({ target_ci_id: '', relationship_type: 'DEPENDS_ON', description: '' });

  const [saving, setSaving] = useState(false);
  const [orgs, setOrgs] = useState<any[]>([]);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [i, t, l, s, r, o] = await Promise.all([
        api.get('/cmdb/items'), api.get('/cmdb/ci-types'), api.get('/cmdb/locations'),
        api.get('/cmdb/network-segments'), api.get('/cmdb/runbooks'), api.get('/organizations'),
      ]);
      setItems(i.items || []);
      setCiTypes(t.types || []);
      setLocations(l.locations || []);
      setSegments(s.segments || []);
      setRunbooks(r.runbooks || []);
      setOrgs(o.organizations || o || []);
    } catch {} finally { setLoading(false); }
  }

  async function loadDetail(id: string) {
    try {
      const d = await api.get('/cmdb/items/' + id);
      setDetail(d);
    } catch {}
  }

  // CRUD Items
  async function saveItem(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingItem) await api.put('/cmdb/items/' + editingItem.id, itemForm);
      else await api.post('/cmdb/items', itemForm);
      setShowItemForm(false); setEditingItem(null); loadAll();
    } catch {} finally { setSaving(false); }
  }

  async function deleteItem(id: string) {
    if (!confirm('Excluir este ativo?')) return;
    try { await api.del('/cmdb/items/' + id); setDetail(null); loadAll(); } catch {}
  }

  function openItemEdit(item?: any) {
    if (item) {
      setEditingItem(item);
      setItemForm({ ci_type_id: item.ci_type_id || '', name: item.name, description: item.description || '', status: item.status, criticality: item.criticality, location_id: item.location_id || '', organization_id: item.organization_id || '', ip_address: item.ip_address || '', hostname: item.hostname || '', serial_number: item.serial_number || '', manufacturer: item.manufacturer || '', model: item.model || '', os: item.os || '' });
    } else {
      setEditingItem(null);
      setItemForm({ ci_type_id: ciTypes[0]?.id || '', name: '', description: '', status: 'ACTIVE', criticality: 'MEDIUM', location_id: '', organization_id: '', ip_address: '', hostname: '', serial_number: '', manufacturer: '', model: '', os: '' });
    }
    setShowItemForm(true);
  }

  // CRUD Locations
  async function saveLocation(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingLocation) await api.put('/cmdb/locations/' + editingLocation.id, locationForm);
      else await api.post('/cmdb/locations', locationForm);
      setShowLocationForm(false); setEditingLocation(null); loadAll();
    } catch {} finally { setSaving(false); }
  }

  async function deleteLocation(id: string) {
    if (!confirm('Excluir este local?')) return;
    try { await api.del('/cmdb/locations/' + id); loadAll(); } catch {}
  }

  // CRUD Segments
  async function saveSegment(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingSegment) await api.put('/cmdb/network-segments/' + editingSegment.id, segmentForm);
      else await api.post('/cmdb/network-segments', segmentForm);
      setShowSegmentForm(false); setEditingSegment(null); loadAll();
    } catch {} finally { setSaving(false); }
  }

  // CRUD Runbooks
  async function saveRunbook(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingRunbook) await api.put('/cmdb/runbooks/' + editingRunbook.id, runbookForm);
      else await api.post('/cmdb/runbooks', runbookForm);
      setShowRunbookForm(false); setEditingRunbook(null); loadAll();
    } catch {} finally { setSaving(false); }
  }

  // CRUD CI Types
  async function saveType(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/cmdb/ci-types', typeForm);
      setShowTypeForm(false); loadAll();
    } catch {} finally { setSaving(false); }
  }

  // Relationships
  async function addRelationship(e: React.FormEvent) {
    e.preventDefault();
    if (!detail?.item?.id) return;
    setSaving(true);
    try {
      await api.post('/cmdb/relationships', { source_ci_id: detail.item.id, ...relForm });
      setShowRelForm(false); setRelForm({ target_ci_id: '', relationship_type: 'DEPENDS_ON', description: '' });
      loadDetail(detail.item.id);
    } catch {} finally { setSaving(false); }
  }

  async function removeRelationship(id: string) {
    try { await api.del('/cmdb/relationships/' + id); if (detail?.item?.id) loadDetail(detail.item.id); } catch {}
  }

  const filteredItems = items.filter(i => {
    if (search && !i.name.toLowerCase().includes(search.toLowerCase()) && !(i.hostname || '').toLowerCase().includes(search.toLowerCase()) && !(i.ip_address || '').toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType && i.ci_type_id !== filterType) return false;
    if (filterStatus && i.status !== filterStatus) return false;
    if (filterCriticality && i.criticality !== filterCriticality) return false;
    return true;
  });

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-vault-400" size={32} /></div>;

  // CI Detail View
  if (detail) {
    const ci = detail.item;
    const relOut = detail.relationships_out || [];
    const relIn = detail.relationships_in || [];
    const nets = detail.network_segments || [];
    const rbs = detail.runbooks || [];
    return (
      <div>
        <button onClick={() => setDetail(null)} className="flex items-center gap-1 text-sm text-slate-400 hover:text-white mb-4"><ChevronRight size={14} className="rotate-180" /> Voltar</button>
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ backgroundColor: (ci.ci_types?.color || '#6366f1') + '20' }}>
              <Server size={28} style={{ color: ci.ci_types?.color || '#6366f1' }} />
            </div>
            <div>
              <h1 className="text-xl font-bold">{ci.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className={'text-xs px-2 py-0.5 rounded-full ' + (STATUS_COLORS[ci.status] || '')}>{STATUS_LABELS[ci.status]}</span>
                <span className={'text-xs px-2 py-0.5 rounded-full ' + (CRITICALITY_COLORS[ci.criticality] || '')}>{CRITICALITY_LABELS[ci.criticality]}</span>
                {ci.ci_types?.name && <span className="text-xs text-slate-500">{ci.ci_types.name}</span>}
              </div>
            </div>
          </div>
          {canManage && (
            <div className="flex gap-2">
              <button onClick={() => openItemEdit(ci)} className="flex items-center gap-1 bg-vault-600/20 text-vault-300 px-3 py-2 rounded-lg text-sm hover:bg-vault-600/30"><Edit2 size={14} /> Editar</button>
              <button onClick={() => { deleteItem(ci.id); }} className="flex items-center gap-1 bg-red-600/20 text-red-300 px-3 py-2 rounded-lg text-sm hover:bg-red-600/30"><Trash2 size={14} /></button>
            </div>
          )}
        </div>

        {/* Info Grid */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="glass rounded-xl p-4 space-y-2 text-sm">
            <h3 className="font-semibold text-vault-300 mb-3">Informacoes Gerais</h3>
            {ci.description && <p className="text-slate-400">{ci.description}</p>}
            {ci.hostname && <p><span className="text-slate-500">Hostname:</span> <span className="text-slate-300 font-mono">{ci.hostname}</span></p>}
            {ci.ip_address && <p><span className="text-slate-500">IP:</span> <span className="text-slate-300 font-mono">{ci.ip_address}</span></p>}
            {ci.os && <p><span className="text-slate-500">SO:</span> {ci.os}</p>}
            {ci.manufacturer && <p><span className="text-slate-500">Fabricante:</span> {ci.manufacturer} {ci.model || ''}</p>}
            {ci.serial_number && <p><span className="text-slate-500">Serial:</span> <span className="font-mono">{ci.serial_number}</span></p>}
          </div>
          <div className="glass rounded-xl p-4 space-y-2 text-sm">
            <h3 className="font-semibold text-vault-300 mb-3">Localizacao e Responsavel</h3>
            {ci.locations?.name && <p><span className="text-slate-500">Local:</span> {ci.locations.name}</p>}
            {ci.organizations?.name && <p><span className="text-slate-500">Organizacao:</span> {ci.organizations.name}</p>}
            {ci.profiles && <p><span className="text-slate-500">Responsavel:</span> {ci.profiles.display_name || ci.profiles.full_name}</p>}
            <p><span className="text-slate-500">Criado em:</span> {new Date(ci.created_at).toLocaleDateString('pt-BR')}</p>
            <p><span className="text-slate-500">Atualizado:</span> {new Date(ci.updated_at).toLocaleDateString('pt-BR')}</p>
          </div>
        </div>

        {/* Relationships */}
        <div className="glass rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm flex items-center gap-2"><Link2 size={16} className="text-vault-400" /> Relacionamentos ({relOut.length + relIn.length})</h3>
            {canManage && <button onClick={() => setShowRelForm(true)} className="text-xs text-vault-400 hover:text-vault-300">+ Adicionar</button>}
          </div>
          {relOut.length === 0 && relIn.length === 0 ? <p className="text-sm text-slate-500">Nenhum relacionamento</p> : (
            <div className="space-y-2">
              {relOut.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between bg-vault-900/40 rounded-lg px-4 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">{ci.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-vault-700/30 text-vault-300">{r.relationship_type}</span>
                    <span className="text-slate-300 cursor-pointer hover:text-white" onClick={() => loadDetail(r.configuration_items?.id)}>{r.configuration_items?.name}</span>
                  </div>
                  {canManage && <button onClick={() => removeRelationship(r.id)} className="text-red-400 hover:text-red-300 p-1"><Trash2 size={12} /></button>}
                </div>
              ))}
              {relIn.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between bg-vault-900/40 rounded-lg px-4 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-300 cursor-pointer hover:text-white" onClick={() => loadDetail(r.configuration_items?.id)}>{r.configuration_items?.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-vault-700/30 text-vault-300">{r.relationship_type}</span>
                    <span className="text-slate-400">{ci.name}</span>
                  </div>
                  {canManage && <button onClick={() => removeRelationship(r.id)} className="text-red-400 hover:text-red-300 p-1"><Trash2 size={12} /></button>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Network Segments */}
        {nets.length > 0 && (
          <div className="glass rounded-xl p-4 mb-4">
            <h3 className="font-semibold text-sm flex items-center gap-2 mb-3"><Network size={16} className="text-vault-400" /> Segmentos de Rede</h3>
            <div className="space-y-2">
              {nets.map((n: any) => (
                <div key={n.id} className="bg-vault-900/40 rounded-lg px-4 py-2 text-sm flex items-center gap-4">
                  <span className="font-medium">{n.name}</span>
                  {n.vlan_id && <span className="text-xs text-slate-500">VLAN {n.vlan_id}</span>}
                  {n.subnet && <span className="text-xs font-mono text-slate-400">{n.subnet}</span>}
                  {n.ip_in_segment && <span className="text-xs font-mono text-vault-300">{n.ip_in_segment}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Runbooks */}
        {rbs.length > 0 && (
          <div className="glass rounded-xl p-4">
            <h3 className="font-semibold text-sm flex items-center gap-2 mb-3"><BookOpen size={16} className="text-vault-400" /> Runbooks</h3>
            <div className="space-y-2">
              {rbs.map((rb: any) => (
                <div key={rb.id} className="bg-vault-900/40 rounded-lg px-4 py-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{rb.title}</span>
                    <div className="flex gap-2">
                      <span className="text-xs text-slate-500">{RB_CATEGORY_LABELS[rb.category] || rb.category}</span>
                      <span className={'text-xs px-1.5 py-0.5 rounded ' + (CRITICALITY_COLORS[rb.severity] || '')}>{RB_SEVERITY_LABELS[rb.severity]}</span>
                    </div>
                  </div>
                  {rb.description && <p className="text-xs text-slate-500 mt-1">{rb.description}</p>}
                  {rb.runbook_versions?.length > 0 && <p className="text-[10px] text-slate-600 mt-1">{rb.runbook_versions.length} versao(oes)</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add Relationship Modal */}
        {showRelForm && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowRelForm(false)}>
            <form onSubmit={addRelationship} className="w-full max-w-md glass rounded-2xl p-6 animate-in" onClick={e => e.stopPropagation()}>
              <h3 className="font-bold text-lg mb-4">Novo Relacionamento</h3>
              <div className="space-y-3">
                <select value={relForm.target_ci_id} onChange={e => setRelForm({ ...relForm, target_ci_id: e.target.value })} required className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm">
                  <option value="">Selecionar ativo destino...</option>
                  {items.filter(i => i.id !== ci.id).map(i => <option key={i.id} value={i.id}>{i.name} ({i.ci_types?.name})</option>)}
                </select>
                <select value={relForm.relationship_type} onChange={e => setRelForm({ ...relForm, relationship_type: e.target.value })} className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm">
                  <option value="DEPENDS_ON">Depende de</option>
                  <option value="CONNECTS_TO">Conecta a</option>
                  <option value="RUNS_ON">Roda em</option>
                  <option value="HOSTS">Hospeda</option>
                  <option value="BACKS_UP">Faz backup de</option>
                  <option value="MONITORS">Monitora</option>
                </select>
                <input value={relForm.description} onChange={e => setRelForm({ ...relForm, description: e.target.value })} placeholder="Descricao (opcional)" className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm" />
              </div>
              <div className="flex gap-2 justify-end mt-4">
                <button type="button" onClick={() => setShowRelForm(false)} className="px-4 py-2 text-sm text-slate-400">Cancelar</button>
                <button type="submit" disabled={saving} className="bg-vault-600 hover:bg-vault-500 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">Adicionar</button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  // Tab content
  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'items', label: 'Ativos', icon: Server },
    { key: 'locations', label: 'Locais', icon: MapPin },
    { key: 'network', label: 'Rede', icon: Network },
    { key: 'runbooks', label: 'Runbooks', icon: BookOpen },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3"><Server className="text-vault-400" size={28} /> CMDB / TI</h1>
          <p className="text-sm text-slate-400 mt-1">Ativos, infraestrutura, rede e runbooks</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-vault-900/40 rounded-xl p-1 w-fit">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} className={'flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ' + (tab === t.key ? 'bg-vault-600/30 text-vault-300' : 'text-slate-400 hover:text-slate-200')}>
              <Icon size={16} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* === ITEMS TAB === */}
      {tab === 'items' && (
        <div>
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="flex-1 min-w-[200px] relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, hostname, IP..." className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl pl-10 pr-4 py-2.5 text-sm" />
            </div>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} className="bg-vault-900/50 border border-vault-700/30 rounded-xl px-3 py-2.5 text-sm">
              <option value="">Todos os tipos</option>
              {ciTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-vault-900/50 border border-vault-700/30 rounded-xl px-3 py-2.5 text-sm">
              <option value="">Todos os status</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={filterCriticality} onChange={e => setFilterCriticality(e.target.value)} className="bg-vault-900/50 border border-vault-700/30 rounded-xl px-3 py-2.5 text-sm">
              <option value="">Criticidade</option>
              {Object.entries(CRITICALITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            {canManage && (
              <div className="flex gap-2">
                <button onClick={() => openItemEdit()} className="flex items-center gap-2 bg-vault-600 hover:bg-vault-500 text-white px-4 py-2 rounded-xl text-sm"><Plus size={16} /> Novo Ativo</button>
                <button onClick={() => setShowTypeForm(true)} className="flex items-center gap-2 bg-vault-600/20 hover:bg-vault-600/30 text-vault-300 px-3 py-2 rounded-xl text-sm"><Plus size={14} /> Tipo</button>
              </div>
            )}
          </div>

          {filteredItems.length === 0 ? <p className="text-center text-slate-500 py-10">Nenhum ativo encontrado</p> : (
            <div className="space-y-2">
              {filteredItems.map(item => (
                <div key={item.id} onClick={() => loadDetail(item.id)} className="glass rounded-xl p-4 cursor-pointer hover:bg-vault-800/30 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: (item.ci_types?.color || '#6366f1') + '20' }}>
                        <Server size={18} style={{ color: item.ci_types?.color || '#6366f1' }} />
                      </div>
                      <div>
                        <h3 className="font-medium text-sm">{item.name}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-slate-500">{item.ci_types?.name}</span>
                          {item.hostname && <span className="text-xs font-mono text-slate-400">{item.hostname}</span>}
                          {item.ip_address && <span className="text-xs font-mono text-slate-400">{item.ip_address}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.locations?.name && <span className="text-xs text-slate-500 hidden md:inline">{item.locations.name}</span>}
                      <span className={'text-xs px-2 py-0.5 rounded-full ' + (STATUS_COLORS[item.status] || '')}>{STATUS_LABELS[item.status]}</span>
                      <span className={'text-xs px-2 py-0.5 rounded-full ' + (CRITICALITY_COLORS[item.criticality] || '')}>{CRITICALITY_LABELS[item.criticality]}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* === LOCATIONS TAB === */}
      {tab === 'locations' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-400">{locations.length} locais cadastrados</p>
            {canManage && <button onClick={() => { setEditingLocation(null); setLocationForm({ name: '', location_type: 'BUILDING', parent_id: '', address: '', notes: '' }); setShowLocationForm(true); }} className="flex items-center gap-2 bg-vault-600 hover:bg-vault-500 text-white px-4 py-2 rounded-xl text-sm"><Plus size={16} /> Novo Local</button>}
          </div>
          {locations.length === 0 ? <p className="text-center text-slate-500 py-10">Nenhum local cadastrado</p> : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {locations.map(loc => (
                <div key={loc.id} className="glass rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <MapPin size={20} className="text-vault-400" />
                      <div>
                        <h3 className="font-medium text-sm">{loc.name}</h3>
                        <p className="text-xs text-slate-500">{loc.location_type}</p>
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex gap-1">
                        <button onClick={() => { setEditingLocation(loc); setLocationForm({ name: loc.name, location_type: loc.location_type || 'BUILDING', parent_id: loc.parent_id || '', address: loc.address || '', notes: loc.notes || '' }); setShowLocationForm(true); }} className="p-1 text-slate-400 hover:text-white"><Edit2 size={14} /></button>
                        <button onClick={() => deleteLocation(loc.id)} className="p-1 text-slate-400 hover:text-red-400"><Trash2 size={14} /></button>
                      </div>
                    )}
                  </div>
                  {loc.address && <p className="text-xs text-slate-500 mt-2">{loc.address}</p>}
                  {loc.notes && <p className="text-xs text-slate-400 mt-1">{loc.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* === NETWORK TAB === */}
      {tab === 'network' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-400">{segments.length} segmentos de rede</p>
            {canManage && <button onClick={() => { setEditingSegment(null); setSegmentForm({ name: '', vlan_id: '', subnet: '', gateway: '', description: '', location_id: '' }); setShowSegmentForm(true); }} className="flex items-center gap-2 bg-vault-600 hover:bg-vault-500 text-white px-4 py-2 rounded-xl text-sm"><Plus size={16} /> Novo Segmento</button>}
          </div>
          {segments.length === 0 ? <p className="text-center text-slate-500 py-10">Nenhum segmento cadastrado</p> : (
            <div className="space-y-2">
              {segments.map(seg => (
                <div key={seg.id} className="glass rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Network size={20} className="text-vault-400" />
                    <div>
                      <h3 className="font-medium text-sm">{seg.name}</h3>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                        {seg.vlan_id && <span>VLAN {seg.vlan_id}</span>}
                        {seg.subnet && <span className="font-mono">{seg.subnet}</span>}
                        {seg.gateway && <span className="font-mono">GW: {seg.gateway}</span>}
                        {seg.locations?.name && <span>{seg.locations.name}</span>}
                      </div>
                    </div>
                  </div>
                  {canManage && (
                    <button onClick={() => { setEditingSegment(seg); setSegmentForm({ name: seg.name, vlan_id: seg.vlan_id?.toString() || '', subnet: seg.subnet || '', gateway: seg.gateway || '', description: seg.description || '', location_id: seg.location_id || '' }); setShowSegmentForm(true); }} className="p-1 text-slate-400 hover:text-white"><Edit2 size={14} /></button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* === RUNBOOKS TAB === */}
      {tab === 'runbooks' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-400">{runbooks.length} runbooks</p>
            {canManage && <button onClick={() => { setEditingRunbook(null); setRunbookForm({ title: '', description: '', ci_id: '', category: 'GENERAL', severity: 'MEDIUM', content: '' }); setShowRunbookForm(true); }} className="flex items-center gap-2 bg-vault-600 hover:bg-vault-500 text-white px-4 py-2 rounded-xl text-sm"><Plus size={16} /> Novo Runbook</button>}
          </div>
          {runbooks.length === 0 ? <p className="text-center text-slate-500 py-10">Nenhum runbook cadastrado</p> : (
            <div className="space-y-2">
              {runbooks.map(rb => (
                <div key={rb.id} className="glass rounded-xl p-4 cursor-pointer hover:bg-vault-800/30" onClick={() => { setEditingRunbook(rb); setRunbookForm({ title: rb.title, description: rb.description || '', ci_id: rb.ci_id || '', category: rb.category, severity: rb.severity, content: '' }); setShowRunbookForm(true); }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <BookOpen size={18} className="text-vault-400" />
                      <div>
                        <h3 className="font-medium text-sm">{rb.title}</h3>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                          <span>{RB_CATEGORY_LABELS[rb.category] || rb.category}</span>
                          {rb.configuration_items?.name && <span>CI: {rb.configuration_items.name}</span>}
                          {rb.profiles && <span>{rb.profiles.display_name || rb.profiles.full_name}</span>}
                        </div>
                      </div>
                    </div>
                    <span className={'text-xs px-2 py-0.5 rounded-full ' + (CRITICALITY_COLORS[rb.severity] || '')}>{RB_SEVERITY_LABELS[rb.severity]}</span>
                  </div>
                  {rb.description && <p className="text-xs text-slate-500 mt-2">{rb.description}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* === MODALS === */}

      {/* Item Form */}
      {showItemForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowItemForm(false)}>
          <form onSubmit={saveItem} className="w-full max-w-2xl glass rounded-2xl p-6 animate-in max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">{editingItem ? 'Editar Ativo' : 'Novo Ativo'}</h3>
              <button type="button" onClick={() => setShowItemForm(false)}><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input value={itemForm.name} onChange={e => setItemForm({ ...itemForm, name: e.target.value })} placeholder="Nome do ativo" required className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm" />
                <select value={itemForm.ci_type_id} onChange={e => setItemForm({ ...itemForm, ci_type_id: e.target.value })} required className="bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm">
                  <option value="">Tipo de ativo...</option>
                  {ciTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <textarea value={itemForm.description} onChange={e => setItemForm({ ...itemForm, description: e.target.value })} placeholder="Descricao" className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm" rows={2} />
              <div className="grid grid-cols-2 gap-3">
                <input value={itemForm.hostname} onChange={e => setItemForm({ ...itemForm, hostname: e.target.value })} placeholder="Hostname" className="bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm font-mono" />
                <input value={itemForm.ip_address} onChange={e => setItemForm({ ...itemForm, ip_address: e.target.value })} placeholder="Endereco IP" className="bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm font-mono" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select value={itemForm.status} onChange={e => setItemForm({ ...itemForm, status: e.target.value })} className="bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm">
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <select value={itemForm.criticality} onChange={e => setItemForm({ ...itemForm, criticality: e.target.value })} className="bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm">
                  {Object.entries(CRITICALITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select value={itemForm.location_id} onChange={e => setItemForm({ ...itemForm, location_id: e.target.value })} className="bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm">
                  <option value="">Sem local</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
                <select value={itemForm.organization_id} onChange={e => setItemForm({ ...itemForm, organization_id: e.target.value })} className="bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm">
                  <option value="">Sem organizacao</option>
                  {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <input value={itemForm.manufacturer} onChange={e => setItemForm({ ...itemForm, manufacturer: e.target.value })} placeholder="Fabricante" className="bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm" />
                <input value={itemForm.model} onChange={e => setItemForm({ ...itemForm, model: e.target.value })} placeholder="Modelo" className="bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm" />
                <input value={itemForm.serial_number} onChange={e => setItemForm({ ...itemForm, serial_number: e.target.value })} placeholder="Numero de serie" className="bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm font-mono" />
              </div>
              <input value={itemForm.os} onChange={e => setItemForm({ ...itemForm, os: e.target.value })} placeholder="Sistema operacional" className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm" />
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button type="button" onClick={() => setShowItemForm(false)} className="px-4 py-2 text-sm text-slate-400">Cancelar</button>
              <button type="submit" disabled={saving} className="bg-vault-600 hover:bg-vault-500 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50 flex items-center gap-2">
                {saving && <Loader2 size={14} className="animate-spin" />} Salvar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Location Form */}
      {showLocationForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowLocationForm(false)}>
          <form onSubmit={saveLocation} className="w-full max-w-md glass rounded-2xl p-6 animate-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">{editingLocation ? 'Editar Local' : 'Novo Local'}</h3>
              <button type="button" onClick={() => setShowLocationForm(false)}><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <input value={locationForm.name} onChange={e => setLocationForm({ ...locationForm, name: e.target.value })} placeholder="Nome do local" required className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm" />
              <select value={locationForm.location_type} onChange={e => setLocationForm({ ...locationForm, location_type: e.target.value })} className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm">
                <option value="DATACENTER">Datacenter</option>
                <option value="BUILDING">Predio</option>
                <option value="FLOOR">Andar</option>
                <option value="ROOM">Sala</option>
                <option value="RACK">Rack</option>
              </select>
              <select value={locationForm.parent_id} onChange={e => setLocationForm({ ...locationForm, parent_id: e.target.value })} className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm">
                <option value="">Sem local pai</option>
                {locations.filter(l => l.id !== editingLocation?.id).map(l => <option key={l.id} value={l.id}>{l.name} ({l.location_type})</option>)}
              </select>
              <input value={locationForm.address} onChange={e => setLocationForm({ ...locationForm, address: e.target.value })} placeholder="Endereco" className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm" />
              <textarea value={locationForm.notes} onChange={e => setLocationForm({ ...locationForm, notes: e.target.value })} placeholder="Observacoes" className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm" />
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button type="button" onClick={() => setShowLocationForm(false)} className="px-4 py-2 text-sm text-slate-400">Cancelar</button>
              <button type="submit" disabled={saving} className="bg-vault-600 hover:bg-vault-500 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">Salvar</button>
            </div>
          </form>
        </div>
      )}

      {/* Segment Form */}
      {showSegmentForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowSegmentForm(false)}>
          <form onSubmit={saveSegment} className="w-full max-w-md glass rounded-2xl p-6 animate-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">{editingSegment ? 'Editar Segmento' : 'Novo Segmento'}</h3>
              <button type="button" onClick={() => setShowSegmentForm(false)}><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <input value={segmentForm.name} onChange={e => setSegmentForm({ ...segmentForm, name: e.target.value })} placeholder="Nome do segmento" required className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm" />
              <div className="grid grid-cols-2 gap-3">
                <input value={segmentForm.vlan_id} onChange={e => setSegmentForm({ ...segmentForm, vlan_id: e.target.value })} placeholder="VLAN ID" className="bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm" />
                <input value={segmentForm.subnet} onChange={e => setSegmentForm({ ...segmentForm, subnet: e.target.value })} placeholder="Sub-rede (ex: 10.0.1.0/24)" className="bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm font-mono" />
              </div>
              <input value={segmentForm.gateway} onChange={e => setSegmentForm({ ...segmentForm, gateway: e.target.value })} placeholder="Gateway" className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm font-mono" />
              <select value={segmentForm.location_id} onChange={e => setSegmentForm({ ...segmentForm, location_id: e.target.value })} className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm">
                <option value="">Sem local</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              <textarea value={segmentForm.description} onChange={e => setSegmentForm({ ...segmentForm, description: e.target.value })} placeholder="Descricao" className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm" />
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button type="button" onClick={() => setShowSegmentForm(false)} className="px-4 py-2 text-sm text-slate-400">Cancelar</button>
              <button type="submit" disabled={saving} className="bg-vault-600 hover:bg-vault-500 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">Salvar</button>
            </div>
          </form>
        </div>
      )}

      {/* Runbook Form */}
      {showRunbookForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowRunbookForm(false)}>
          <form onSubmit={saveRunbook} className="w-full max-w-2xl glass rounded-2xl p-6 animate-in max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">{editingRunbook ? 'Editar Runbook' : 'Novo Runbook'}</h3>
              <button type="button" onClick={() => setShowRunbookForm(false)}><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <input value={runbookForm.title} onChange={e => setRunbookForm({ ...runbookForm, title: e.target.value })} placeholder="Titulo do runbook" required className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm" />
              <textarea value={runbookForm.description} onChange={e => setRunbookForm({ ...runbookForm, description: e.target.value })} placeholder="Descricao" className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm" rows={2} />
              <div className="grid grid-cols-3 gap-3">
                <select value={runbookForm.ci_id} onChange={e => setRunbookForm({ ...runbookForm, ci_id: e.target.value })} className="bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm">
                  <option value="">Sem CI vinculado</option>
                  {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
                <select value={runbookForm.category} onChange={e => setRunbookForm({ ...runbookForm, category: e.target.value })} className="bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm">
                  {Object.entries(RB_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <select value={runbookForm.severity} onChange={e => setRunbookForm({ ...runbookForm, severity: e.target.value })} className="bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm">
                  {Object.entries(RB_SEVERITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <textarea value={runbookForm.content} onChange={e => setRunbookForm({ ...runbookForm, content: e.target.value })} placeholder="Conteudo / passos do runbook..." rows={10} className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm font-mono" />
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button type="button" onClick={() => setShowRunbookForm(false)} className="px-4 py-2 text-sm text-slate-400">Cancelar</button>
              <button type="submit" disabled={saving} className="bg-vault-600 hover:bg-vault-500 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50 flex items-center gap-2">
                {saving && <Loader2 size={14} className="animate-spin" />} Salvar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CI Type Form */}
      {showTypeForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowTypeForm(false)}>
          <form onSubmit={saveType} className="w-full max-w-md glass rounded-2xl p-6 animate-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">Novo Tipo de Ativo</h3>
              <button type="button" onClick={() => setShowTypeForm(false)}><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <input value={typeForm.name} onChange={e => setTypeForm({ ...typeForm, name: e.target.value })} placeholder="Nome do tipo (ex: Servidor, Switch, VM...)" required className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm" />
              <textarea value={typeForm.description} onChange={e => setTypeForm({ ...typeForm, description: e.target.value })} placeholder="Descricao" className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm" />
              <div className="flex gap-3">
                <input type="color" value={typeForm.color} onChange={e => setTypeForm({ ...typeForm, color: e.target.value })} className="w-12 h-10 rounded-lg cursor-pointer bg-transparent" />
                <input value={typeForm.icon} onChange={e => setTypeForm({ ...typeForm, icon: e.target.value })} placeholder="Icone (opcional)" className="flex-1 bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm" />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button type="button" onClick={() => setShowTypeForm(false)} className="px-4 py-2 text-sm text-slate-400">Cancelar</button>
              <button type="submit" disabled={saving} className="bg-vault-600 hover:bg-vault-500 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">Criar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
