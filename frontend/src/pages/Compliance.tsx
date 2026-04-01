import React, { useEffect, useState } from 'react';
import { ShieldCheck, Plus, Loader2, X, Edit2, ChevronRight, MessageSquare, AlertTriangle, FileText, GraduationCap, Users, Clock, Search, Send, Eye, Filter } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { hasPermission } from '../lib/access';
import { api } from '../lib/api';

type Tab = 'complaints' | 'lgpd' | 'trainings';

const COMPLAINT_STATUS_LABELS: Record<string, string> = { OPEN: 'Aberta', IN_PROGRESS: 'Em analise', RESOLVED: 'Resolvida', CLOSED: 'Fechada' };
const COMPLAINT_STATUS_COLORS: Record<string, string> = { OPEN: 'bg-amber-500/20 text-amber-300', IN_PROGRESS: 'bg-blue-500/20 text-blue-300', RESOLVED: 'bg-green-500/20 text-green-300', CLOSED: 'bg-slate-500/20 text-slate-300' };
const COMPLAINT_CATEGORY_LABELS: Record<string, string> = { GENERAL: 'Geral', ETHICS: 'Etica', FRAUD: 'Fraude', HARASSMENT: 'Assedio', CORRUPTION: 'Corrupcao', DISCRIMINATION: 'Discriminacao', SAFETY: 'Seguranca', OTHER: 'Outro' };
const PRIORITY_LABELS: Record<string, string> = { LOW: 'Baixa', MEDIUM: 'Media', HIGH: 'Alta', CRITICAL: 'Critica' };
const PRIORITY_COLORS: Record<string, string> = { LOW: 'bg-slate-500/20 text-slate-300', MEDIUM: 'bg-blue-500/20 text-blue-300', HIGH: 'bg-amber-500/20 text-amber-300', CRITICAL: 'bg-red-500/20 text-red-300' };

const LGPD_STATUS_LABELS: Record<string, string> = { PENDING: 'Pendente', IN_PROGRESS: 'Em analise', COMPLETED: 'Concluida', REJECTED: 'Rejeitada' };
const LGPD_STATUS_COLORS: Record<string, string> = { PENDING: 'bg-amber-500/20 text-amber-300', IN_PROGRESS: 'bg-blue-500/20 text-blue-300', COMPLETED: 'bg-green-500/20 text-green-300', REJECTED: 'bg-red-500/20 text-red-300' };
const LGPD_TYPE_LABELS: Record<string, string> = { ACCESS: 'Acesso aos Dados', RECTIFICATION: 'Retificacao', DELETION: 'Exclusao', PORTABILITY: 'Portabilidade', OPPOSITION: 'Oposicao', INFORMATION: 'Informacao' };

const TRAINING_TYPE_LABELS: Record<string, string> = { COMPLIANCE: 'Compliance', LGPD: 'LGPD', SECURITY: 'Seguranca', ETHICS: 'Etica', ONBOARDING: 'Onboarding', TECHNICAL: 'Tecnico' };

export default function Compliance() {
  const { user } = useAuth();
  const canManage = hasPermission(user, 'compliance.manage');
  const [tab, setTab] = useState<Tab>('complaints');
  const [loading, setLoading] = useState(true);

  // Data
  const [complaints, setComplaints] = useState<any[]>([]);
  const [lgpdRequests, setLgpdRequests] = useState<any[]>([]);
  const [trainings, setTrainings] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [search, setSearch] = useState('');

  // Detail
  const [complaintDetail, setComplaintDetail] = useState<any>(null);
  const [lgpdDetail, setLgpdDetail] = useState<any>(null);

  // Forms
  const [showTrainingForm, setShowTrainingForm] = useState(false);
  const [editingTraining, setEditingTraining] = useState<any>(null);
  const [trainingForm, setTrainingForm] = useState({ title: '', description: '', training_type: 'COMPLIANCE', duration_minutes: 60, is_mandatory: false, passing_score: 70 });

  const [showAssignForm, setShowAssignForm] = useState(false);
  const [assignTrainingId, setAssignTrainingId] = useState('');
  const [assignUserIds, setAssignUserIds] = useState<string[]>([]);
  const [assignDueDate, setAssignDueDate] = useState('');

  // Reply to complaint
  const [replyMsg, setReplyMsg] = useState('');
  const [replyInternal, setReplyInternal] = useState(false);

  // LGPD update
  const [lgpdResponse, setLgpdResponse] = useState('');

  const [saving, setSaving] = useState(false);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const promises: Promise<any>[] = [api.get('/compliance/trainings')];
      if (canManage) {
        promises.push(api.get('/compliance/complaints'), api.get('/compliance/lgpd-requests'));
      }
      const [t, c, l] = await Promise.all(promises);
      setTrainings(t.trainings || []);
      if (c) setComplaints(c.complaints || []);
      if (l) setLgpdRequests(l.requests || []);
    } catch {} finally { setLoading(false); }
  }

  async function loadUsers() {
    if (allUsers.length) return;
    try { const d = await api.get('/admin/users'); setAllUsers(d.users || d || []); } catch {}
  }

  // Complaint detail
  async function loadComplaint(id: string) {
    try {
      const d = await api.get('/compliance/complaints/' + id + '/detail');
      setComplaintDetail(d);
    } catch {}
  }

  async function updateComplaint(id: string, updates: any) {
    try {
      await api.put('/compliance/complaints/' + id, updates);
      loadComplaint(id);
      loadAll();
    } catch {}
  }

  async function sendReply(id: string) {
    if (!replyMsg) return;
    setSaving(true);
    try {
      await api.post('/compliance/complaints/' + id + '/messages', { message: replyMsg, is_internal: replyInternal });
      setReplyMsg('');
      setReplyInternal(false);
      loadComplaint(id);
    } catch {} finally { setSaving(false); }
  }

  // LGPD
  async function updateLgpd(id: string, updates: any) {
    try {
      await api.put('/compliance/lgpd-requests/' + id, updates);
      setLgpdDetail(null);
      loadAll();
    } catch {}
  }

  // Trainings
  async function saveTraining(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingTraining) await api.put('/compliance/trainings/' + editingTraining.id, trainingForm);
      else await api.post('/compliance/trainings', trainingForm);
      setShowTrainingForm(false); setEditingTraining(null); loadAll();
    } catch {} finally { setSaving(false); }
  }

  async function assignTraining(e: React.FormEvent) {
    e.preventDefault();
    if (!assignTrainingId || !assignUserIds.length) return;
    setSaving(true);
    try {
      await api.post('/compliance/trainings/' + assignTrainingId + '/assign', {
        user_ids: assignUserIds, due_date: assignDueDate || null,
      });
      setShowAssignForm(false); setAssignUserIds([]); loadAll();
    } catch {} finally { setSaving(false); }
  }

  const filteredComplaints = complaints.filter(c => {
    if (filterStatus && c.status !== filterStatus) return false;
    if (filterCategory && c.category !== filterCategory) return false;
    if (search && !c.subject.toLowerCase().includes(search.toLowerCase()) && !c.protocol.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const filteredLgpd = lgpdRequests.filter(r => {
    if (filterStatus && r.status !== filterStatus) return false;
    if (search && !r.requester_name?.toLowerCase().includes(search.toLowerCase()) && !r.protocol?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-vault-400" size={32} /></div>;

  // Complaint Detail View
  if (complaintDetail) {
    const c = complaintDetail.complaint;
    const msgs = complaintDetail.messages || [];
    return (
      <div>
        <button onClick={() => setComplaintDetail(null)} className="flex items-center gap-1 text-sm text-slate-400 hover:text-white mb-4"><ChevronRight size={14} className="rotate-180" /> Voltar</button>
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-mono text-vault-400">{c.protocol}</span>
              <span className={'text-xs px-2 py-0.5 rounded-full ' + (COMPLAINT_STATUS_COLORS[c.status] || '')}>{COMPLAINT_STATUS_LABELS[c.status]}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-vault-700/30 text-slate-300">{COMPLAINT_CATEGORY_LABELS[c.category] || c.category}</span>
              {c.priority && <span className={'text-xs px-2 py-0.5 rounded-full ' + (PRIORITY_COLORS[c.priority] || '')}>{PRIORITY_LABELS[c.priority]}</span>}
            </div>
            <h1 className="text-xl font-bold">{c.subject}</h1>
            <p className="text-xs text-slate-500 mt-1">
              {c.is_anonymous ? 'Denuncia anonima' : `${c.reporter_name || 'Sem nome'} - ${c.reporter_email || ''}`}
              {' '} - {new Date(c.created_at).toLocaleString('pt-BR')}
            </p>
          </div>
          {canManage && (
            <div className="flex gap-2">
              <select value={c.status} onChange={e => updateComplaint(c.id, { status: e.target.value })} className="bg-vault-900/50 border border-vault-700/30 rounded-lg px-3 py-2 text-sm">
                {Object.entries(COMPLAINT_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select value={c.priority || ''} onChange={e => updateComplaint(c.id, { priority: e.target.value })} className="bg-vault-900/50 border border-vault-700/30 rounded-lg px-3 py-2 text-sm">
                <option value="">Prioridade</option>
                {Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Description */}
        <div className="glass rounded-xl p-4 mb-4">
          <h3 className="font-semibold text-sm mb-2">Descricao</h3>
          <p className="text-sm text-slate-300 whitespace-pre-wrap">{c.description}</p>
        </div>

        {/* Resolution */}
        {c.resolution && (
          <div className="glass rounded-xl p-4 mb-4 border border-green-500/20">
            <h3 className="font-semibold text-sm mb-2 text-green-300">Resolucao</h3>
            <p className="text-sm text-slate-300 whitespace-pre-wrap">{c.resolution}</p>
          </div>
        )}

        {/* Messages */}
        <div className="glass rounded-xl p-4 mb-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><MessageSquare size={16} className="text-vault-400" /> Mensagens ({msgs.length})</h3>
          {msgs.length === 0 ? <p className="text-sm text-slate-500">Nenhuma mensagem</p> : (
            <div className="space-y-3 mb-4">
              {msgs.map((m: any) => (
                <div key={m.id} className={'rounded-lg px-4 py-3 text-sm ' + (m.sender_type === 'HANDLER' ? (m.is_internal ? 'bg-amber-900/20 border border-amber-500/20' : 'bg-vault-900/40') : 'bg-slate-800/40')}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium">{m.sender_type === 'HANDLER' ? (m.profiles?.display_name || m.profiles?.full_name || 'Equipe') : 'Denunciante'}</span>
                    {m.is_internal && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">Interno</span>}
                    <span className="text-[10px] text-slate-500">{new Date(m.created_at).toLocaleString('pt-BR')}</span>
                  </div>
                  <p className="text-slate-300">{m.message}</p>
                </div>
              ))}
            </div>
          )}

          {/* Reply */}
          {canManage && (
            <div className="border-t border-vault-700/20 pt-3">
              <textarea value={replyMsg} onChange={e => setReplyMsg(e.target.value)} placeholder="Escrever resposta..." className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm mb-2" rows={3} />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs text-slate-400"><input type="checkbox" checked={replyInternal} onChange={e => setReplyInternal(e.target.checked)} className="rounded" /> Nota interna (nao visivel ao denunciante)</label>
                <button onClick={() => sendReply(c.id)} disabled={!replyMsg || saving} className="flex items-center gap-2 bg-vault-600 hover:bg-vault-500 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">
                  {saving && <Loader2 size={14} className="animate-spin" />} <Send size={14} /> Enviar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // LGPD Detail View
  if (lgpdDetail) {
    const r = lgpdDetail;
    return (
      <div>
        <button onClick={() => setLgpdDetail(null)} className="flex items-center gap-1 text-sm text-slate-400 hover:text-white mb-4"><ChevronRight size={14} className="rotate-180" /> Voltar</button>
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-mono text-vault-400">{r.protocol}</span>
              <span className={'text-xs px-2 py-0.5 rounded-full ' + (LGPD_STATUS_COLORS[r.status] || '')}>{LGPD_STATUS_LABELS[r.status]}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-vault-700/30 text-slate-300">{LGPD_TYPE_LABELS[r.request_type] || r.request_type}</span>
            </div>
            <h1 className="text-xl font-bold">Demanda LGPD - {LGPD_TYPE_LABELS[r.request_type]}</h1>
            <p className="text-xs text-slate-500 mt-1">{r.requester_name} - {r.requester_email} - {new Date(r.created_at).toLocaleString('pt-BR')}</p>
            {r.due_date && <p className="text-xs text-amber-400 mt-1">Prazo: {new Date(r.due_date).toLocaleDateString('pt-BR')}</p>}
          </div>
          {canManage && (
            <select value={r.status} onChange={e => updateLgpd(r.id, { status: e.target.value })} className="bg-vault-900/50 border border-vault-700/30 rounded-lg px-3 py-2 text-sm">
              {Object.entries(LGPD_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          )}
        </div>

        <div className="glass rounded-xl p-4 mb-4">
          <h3 className="font-semibold text-sm mb-2">Dados do Solicitante</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <p><span className="text-slate-500">Nome:</span> {r.requester_name}</p>
            <p><span className="text-slate-500">Email:</span> {r.requester_email}</p>
            {r.requester_cpf && <p><span className="text-slate-500">CPF:</span> {r.requester_cpf}</p>}
            {r.requester_phone && <p><span className="text-slate-500">Telefone:</span> {r.requester_phone}</p>}
          </div>
        </div>

        <div className="glass rounded-xl p-4 mb-4">
          <h3 className="font-semibold text-sm mb-2">Descricao da Solicitacao</h3>
          <p className="text-sm text-slate-300 whitespace-pre-wrap">{r.description}</p>
        </div>

        {r.response && (
          <div className="glass rounded-xl p-4 mb-4 border border-green-500/20">
            <h3 className="font-semibold text-sm mb-2 text-green-300">Resposta</h3>
            <p className="text-sm text-slate-300 whitespace-pre-wrap">{r.response}</p>
          </div>
        )}

        {canManage && !r.response && (
          <div className="glass rounded-xl p-4">
            <h3 className="font-semibold text-sm mb-2">Responder</h3>
            <textarea value={lgpdResponse} onChange={e => setLgpdResponse(e.target.value)} placeholder="Escrever resposta para o titular..." className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm mb-2" rows={4} />
            <div className="flex justify-end">
              <button onClick={() => { updateLgpd(r.id, { response: lgpdResponse, status: 'COMPLETED' }); setLgpdResponse(''); }} disabled={!lgpdResponse} className="bg-vault-600 hover:bg-vault-500 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">Responder e Concluir</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Tab nav
  const tabs: { key: Tab; label: string; icon: any; count?: number }[] = [
    ...(canManage ? [{ key: 'complaints' as Tab, label: 'Denuncias', icon: AlertTriangle, count: complaints.filter(c => c.status === 'OPEN' || c.status === 'IN_PROGRESS').length }] : []),
    ...(canManage ? [{ key: 'lgpd' as Tab, label: 'LGPD', icon: FileText, count: lgpdRequests.filter(r => r.status === 'PENDING' || r.status === 'IN_PROGRESS').length }] : []),
    { key: 'trainings', label: 'Treinamentos', icon: GraduationCap },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3"><ShieldCheck className="text-vault-400" size={28} /> Compliance</h1>
          <p className="text-sm text-slate-400 mt-1">Denuncias, LGPD e treinamentos</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-vault-900/40 rounded-xl p-1 w-fit">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => { setTab(t.key); setFilterStatus(''); setFilterCategory(''); setSearch(''); }} className={'flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ' + (tab === t.key ? 'bg-vault-600/30 text-vault-300' : 'text-slate-400 hover:text-slate-200')}>
              <Icon size={16} /> {t.label}
              {t.count != null && t.count > 0 && <span className="bg-red-500 text-white text-[10px] rounded-full px-1.5 min-w-[18px] text-center">{t.count}</span>}
            </button>
          );
        })}
      </div>

      {/* === COMPLAINTS TAB === */}
      {tab === 'complaints' && canManage && (
        <div>
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="flex-1 min-w-[200px] relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por protocolo ou assunto..." className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl pl-10 pr-4 py-2.5 text-sm" />
            </div>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-vault-900/50 border border-vault-700/30 rounded-xl px-3 py-2.5 text-sm">
              <option value="">Todos os status</option>
              {Object.entries(COMPLAINT_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="bg-vault-900/50 border border-vault-700/30 rounded-xl px-3 py-2.5 text-sm">
              <option value="">Todas as categorias</option>
              {Object.entries(COMPLAINT_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          {filteredComplaints.length === 0 ? <p className="text-center text-slate-500 py-10">Nenhuma denuncia encontrada</p> : (
            <div className="space-y-2">
              {filteredComplaints.map(c => (
                <div key={c.id} onClick={() => loadComplaint(c.id)} className="glass rounded-xl p-4 cursor-pointer hover:bg-vault-800/30 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-vault-400">{c.protocol}</span>
                        <span className={'text-xs px-2 py-0.5 rounded-full ' + (COMPLAINT_STATUS_COLORS[c.status] || '')}>{COMPLAINT_STATUS_LABELS[c.status]}</span>
                        <span className="text-xs text-slate-500">{COMPLAINT_CATEGORY_LABELS[c.category] || c.category}</span>
                        {c.priority && <span className={'text-xs px-1.5 py-0.5 rounded-full ' + (PRIORITY_COLORS[c.priority] || '')}>{PRIORITY_LABELS[c.priority]}</span>}
                      </div>
                      <h3 className="font-medium text-sm">{c.subject}</h3>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500">
                        <span>{c.is_anonymous ? 'Anonima' : c.reporter_name || 'Identificada'}</span>
                        <span>{new Date(c.created_at).toLocaleDateString('pt-BR')}</span>
                        {c.profiles?.display_name && <span>Atribuida: {c.profiles.display_name}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* === LGPD TAB === */}
      {tab === 'lgpd' && canManage && (
        <div>
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="flex-1 min-w-[200px] relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por protocolo ou nome..." className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl pl-10 pr-4 py-2.5 text-sm" />
            </div>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-vault-900/50 border border-vault-700/30 rounded-xl px-3 py-2.5 text-sm">
              <option value="">Todos os status</option>
              {Object.entries(LGPD_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          {filteredLgpd.length === 0 ? <p className="text-center text-slate-500 py-10">Nenhuma demanda LGPD encontrada</p> : (
            <div className="space-y-2">
              {filteredLgpd.map(r => (
                <div key={r.id} onClick={() => setLgpdDetail(r)} className="glass rounded-xl p-4 cursor-pointer hover:bg-vault-800/30 transition-all">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-vault-400">{r.protocol}</span>
                        <span className={'text-xs px-2 py-0.5 rounded-full ' + (LGPD_STATUS_COLORS[r.status] || '')}>{LGPD_STATUS_LABELS[r.status]}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-vault-700/30 text-slate-300">{LGPD_TYPE_LABELS[r.request_type] || r.request_type}</span>
                      </div>
                      <h3 className="font-medium text-sm">{r.requester_name}</h3>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500">
                        <span>{r.requester_email}</span>
                        <span>{new Date(r.created_at).toLocaleDateString('pt-BR')}</span>
                        {r.due_date && <span className="text-amber-400">Prazo: {new Date(r.due_date).toLocaleDateString('pt-BR')}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* === TRAININGS TAB === */}
      {tab === 'trainings' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-400">{trainings.length} treinamentos</p>
            {canManage && (
              <div className="flex gap-2">
                <button onClick={() => { loadUsers(); setShowAssignForm(true); }} className="flex items-center gap-2 bg-vault-600/20 hover:bg-vault-600/30 text-vault-300 px-3 py-2 rounded-xl text-sm"><Users size={14} /> Atribuir</button>
                <button onClick={() => { setEditingTraining(null); setTrainingForm({ title: '', description: '', training_type: 'COMPLIANCE', duration_minutes: 60, is_mandatory: false, passing_score: 70 }); setShowTrainingForm(true); }} className="flex items-center gap-2 bg-vault-600 hover:bg-vault-500 text-white px-4 py-2 rounded-xl text-sm"><Plus size={16} /> Novo Treinamento</button>
              </div>
            )}
          </div>

          {trainings.length === 0 ? <p className="text-center text-slate-500 py-10">Nenhum treinamento encontrado</p> : (
            <div className="space-y-2">
              {trainings.map(t => {
                const hasCompletion = t.completion;
                const hasAssignment = t.assignment;
                return (
                  <div key={t.id} className="glass rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <GraduationCap size={20} className="text-vault-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <h3 className="font-medium text-sm">{t.title}</h3>
                            <span className="text-xs px-1.5 py-0.5 rounded bg-vault-800/50 text-slate-400">{TRAINING_TYPE_LABELS[t.training_type] || t.training_type}</span>
                            {t.is_mandatory && <span className="text-[10px] text-red-400">Obrigatorio</span>}
                          </div>
                          {t.description && <p className="text-xs text-slate-500 line-clamp-1">{t.description}</p>}
                          <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500">
                            <span>{t.duration_minutes} min</span>
                            <span>Nota minima: {t.passing_score}%</span>
                            {t.stats && <span>{t.stats.completed}/{t.stats.assigned} concluidos</span>}
                            {hasAssignment && <span className={'px-1.5 py-0.5 rounded ' + (hasAssignment.status === 'COMPLETED' ? 'bg-green-500/20 text-green-300' : 'bg-blue-500/20 text-blue-300')}>{hasAssignment.status === 'COMPLETED' ? 'Concluido' : 'Pendente'}</span>}
                            {hasCompletion && <span>{hasCompletion.passed ? 'Aprovado' : 'Reprovado'} - Nota: {hasCompletion.score}%</span>}
                          </div>
                        </div>
                      </div>
                      {canManage && (
                        <button onClick={() => { setEditingTraining(t); setTrainingForm({ title: t.title, description: t.description || '', training_type: t.training_type, duration_minutes: t.duration_minutes, is_mandatory: t.is_mandatory, passing_score: t.passing_score }); setShowTrainingForm(true); }} className="p-1 text-slate-400 hover:text-white"><Edit2 size={14} /></button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* === MODALS === */}

      {/* Training Form */}
      {showTrainingForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowTrainingForm(false)}>
          <form onSubmit={saveTraining} className="w-full max-w-md glass rounded-2xl p-6 animate-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">{editingTraining ? 'Editar Treinamento' : 'Novo Treinamento'}</h3>
              <button type="button" onClick={() => setShowTrainingForm(false)}><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <input value={trainingForm.title} onChange={e => setTrainingForm({ ...trainingForm, title: e.target.value })} placeholder="Titulo do treinamento" required className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm" />
              <textarea value={trainingForm.description} onChange={e => setTrainingForm({ ...trainingForm, description: e.target.value })} placeholder="Descricao" className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm" />
              <div className="grid grid-cols-2 gap-3">
                <select value={trainingForm.training_type} onChange={e => setTrainingForm({ ...trainingForm, training_type: e.target.value })} className="bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm">
                  {Object.entries(TRAINING_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <input type="number" value={trainingForm.duration_minutes} onChange={e => setTrainingForm({ ...trainingForm, duration_minutes: parseInt(e.target.value) || 60 })} placeholder="Duracao (min)" className="bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="number" value={trainingForm.passing_score} onChange={e => setTrainingForm({ ...trainingForm, passing_score: parseInt(e.target.value) || 70 })} placeholder="Nota minima (%)" className="bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm" />
                <label className="flex items-center gap-2 text-sm px-4"><input type="checkbox" checked={trainingForm.is_mandatory} onChange={e => setTrainingForm({ ...trainingForm, is_mandatory: e.target.checked })} className="rounded" /> Obrigatorio</label>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button type="button" onClick={() => setShowTrainingForm(false)} className="px-4 py-2 text-sm text-slate-400">Cancelar</button>
              <button type="submit" disabled={saving} className="bg-vault-600 hover:bg-vault-500 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">Salvar</button>
            </div>
          </form>
        </div>
      )}

      {/* Assign Training */}
      {showAssignForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowAssignForm(false)}>
          <form onSubmit={assignTraining} className="w-full max-w-md glass rounded-2xl p-6 animate-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">Atribuir Treinamento</h3>
              <button type="button" onClick={() => setShowAssignForm(false)}><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <select value={assignTrainingId} onChange={e => setAssignTrainingId(e.target.value)} required className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm">
                <option value="">Selecionar treinamento...</option>
                {trainings.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
              <div className="bg-vault-900/50 border border-vault-700/30 rounded-xl p-3 max-h-48 overflow-y-auto">
                <p className="text-xs text-slate-500 mb-2">Selecionar usuarios:</p>
                {allUsers.map(u => (
                  <label key={u.id} className="flex items-center gap-2 py-1 text-sm cursor-pointer hover:bg-vault-800/30 px-2 rounded">
                    <input type="checkbox" checked={assignUserIds.includes(u.id)} onChange={e => {
                      if (e.target.checked) setAssignUserIds([...assignUserIds, u.id]);
                      else setAssignUserIds(assignUserIds.filter(id => id !== u.id));
                    }} className="rounded" />
                    {u.display_name || u.full_name} <span className="text-xs text-slate-500">({u.email})</span>
                  </label>
                ))}
              </div>
              <input type="date" value={assignDueDate} onChange={e => setAssignDueDate(e.target.value)} className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm" placeholder="Prazo (opcional)" />
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button type="button" onClick={() => setShowAssignForm(false)} className="px-4 py-2 text-sm text-slate-400">Cancelar</button>
              <button type="submit" disabled={saving || !assignTrainingId || !assignUserIds.length} className="bg-vault-600 hover:bg-vault-500 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50 flex items-center gap-2">
                {saving && <Loader2 size={14} className="animate-spin" />} Atribuir ({assignUserIds.length})
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
