import React, { useEffect, useState } from 'react';
import { UserPlus, Plus, Loader2, X, Edit2, Trash2, ChevronRight, ClipboardList, Users, CheckCircle, Clock, AlertTriangle, FileText, BookOpen, Key, Server, Filter } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { hasPermission } from '../lib/access';
import { api } from '../lib/api';

type Tab = 'instances' | 'templates' | 'profiles';

const INSTANCE_STATUS_LABELS: Record<string, string> = { PENDING: 'Pendente', IN_PROGRESS: 'Em andamento', COMPLETED: 'Concluido', CANCELLED: 'Cancelado' };
const INSTANCE_STATUS_COLORS: Record<string, string> = { PENDING: 'bg-slate-500/20 text-slate-300', IN_PROGRESS: 'bg-blue-500/20 text-blue-300', COMPLETED: 'bg-green-500/20 text-green-300', CANCELLED: 'bg-red-500/20 text-red-300' };
const TASK_STATUS_LABELS: Record<string, string> = { PENDING: 'Pendente', IN_PROGRESS: 'Em andamento', COMPLETED: 'Concluido', SKIPPED: 'Ignorado' };
const TASK_STATUS_COLORS: Record<string, string> = { PENDING: 'bg-slate-500/20 text-slate-300', IN_PROGRESS: 'bg-blue-500/20 text-blue-300', COMPLETED: 'bg-green-500/20 text-green-300', SKIPPED: 'bg-amber-500/20 text-amber-300' };
const TASK_TYPE_LABELS: Record<string, string> = { MANUAL: 'Manual', READ_DOCUMENT: 'Leitura', ACCESS_CREDENTIAL: 'Credencial', SYSTEM_ACCESS: 'Acesso', TRAINING: 'Treinamento', ACKNOWLEDGEMENT: 'Aceite' };

export default function Onboarding() {
  const { user } = useAuth();
  const canManage = hasPermission(user, 'onboarding.manage');
  const [tab, setTab] = useState<Tab>('instances');
  const [loading, setLoading] = useState(true);

  // Data
  const [instances, setInstances] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [jobProfiles, setJobProfiles] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');

  // Detail
  const [instanceDetail, setInstanceDetail] = useState<any>(null);
  const [templateDetail, setTemplateDetail] = useState<any>(null);

  // Forms
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [editingProfile, setEditingProfile] = useState<any>(null);
  const [profileForm, setProfileForm] = useState({ name: '', description: '', organization_id: '', default_role: 'user' });

  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [templateForm, setTemplateForm] = useState({ name: '', description: '', template_type: 'ONBOARDING', job_profile_id: '', organization_id: '' });

  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', task_type: 'MANUAL', sort_order: 0, is_required: true, due_days: 7, assigned_role: '' });

  const [showInstanceForm, setShowInstanceForm] = useState(false);
  const [instanceForm, setInstanceForm] = useState({ template_id: '', user_id: '', due_date: '', notes: '' });

  const [saving, setSaving] = useState(false);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [inst, tmpl, prof, o] = await Promise.all([
        api.get('/onboarding/instances'), api.get('/onboarding/templates'),
        api.get('/onboarding/job-profiles'), api.get('/organizations'),
      ]);
      setInstances(inst.instances || []);
      setTemplates(tmpl.templates || []);
      setJobProfiles(prof.profiles || []);
      setOrgs(o.organizations || o || []);
    } catch {} finally { setLoading(false); }
  }

  async function loadUsers() {
    if (allUsers.length) return;
    try { const d = await api.get('/admin/users'); setAllUsers(d.users || d || []); } catch {}
  }

  // Instance detail
  async function loadInstance(id: string) {
    try {
      const d = await api.get('/onboarding/instances/' + id);
      setInstanceDetail(d);
    } catch {}
  }

  // Template detail
  async function loadTemplate(id: string) {
    try {
      const d = await api.get('/onboarding/templates/' + id);
      setTemplateDetail(d);
    } catch {}
  }

  // Task status update
  async function updateTaskStatus(taskId: string, status: string) {
    try {
      await api.put('/onboarding/tasks/' + taskId, { status });
      if (instanceDetail?.instance?.id) loadInstance(instanceDetail.instance.id);
    } catch {}
  }

  // CRUD Profiles
  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingProfile) await api.put('/onboarding/job-profiles/' + editingProfile.id, profileForm);
      else await api.post('/onboarding/job-profiles', profileForm);
      setShowProfileForm(false); setEditingProfile(null); loadAll();
    } catch {} finally { setSaving(false); }
  }

  // CRUD Templates
  async function saveTemplate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingTemplate) await api.put('/onboarding/templates/' + editingTemplate.id, templateForm);
      else await api.post('/onboarding/templates', templateForm);
      setShowTemplateForm(false); setEditingTemplate(null); loadAll();
    } catch {} finally { setSaving(false); }
  }

  // Add task to template
  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!templateDetail?.template?.id) return;
    setSaving(true);
    try {
      await api.post('/onboarding/templates/' + templateDetail.template.id + '/tasks', taskForm);
      setShowTaskForm(false);
      setTaskForm({ title: '', description: '', task_type: 'MANUAL', sort_order: 0, is_required: true, due_days: 7, assigned_role: '' });
      loadTemplate(templateDetail.template.id);
    } catch {} finally { setSaving(false); }
  }

  async function deleteTask(taskId: string) {
    if (!confirm('Excluir esta tarefa?')) return;
    try {
      await api.del('/onboarding/template-tasks/' + taskId);
      if (templateDetail?.template?.id) loadTemplate(templateDetail.template.id);
    } catch {}
  }

  // Create instance
  async function createInstance(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/onboarding/instances', instanceForm);
      setShowInstanceForm(false);
      setInstanceForm({ template_id: '', user_id: '', due_date: '', notes: '' });
      loadAll();
    } catch {} finally { setSaving(false); }
  }

  const filteredInstances = instances.filter(i => {
    if (filterStatus && i.status !== filterStatus) return false;
    if (filterType && i.instance_type !== filterType) return false;
    return true;
  });

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-vault-400" size={32} /></div>;

  // Instance Detail View
  if (instanceDetail) {
    const inst = instanceDetail.instance;
    const tasks = instanceDetail.tasks || [];
    const completed = tasks.filter((t: any) => t.status === 'COMPLETED').length;
    const pct = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;
    return (
      <div>
        <button onClick={() => setInstanceDetail(null)} className="flex items-center gap-1 text-sm text-slate-400 hover:text-white mb-4"><ChevronRight size={14} className="rotate-180" /> Voltar</button>
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold">{inst.onboarding_templates?.name || 'Onboarding'}</h1>
            <div className="flex items-center gap-3 mt-2">
              <div className="flex items-center gap-2">
                {inst.profiles?.avatar_url ? <img src={inst.profiles.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" /> : <div className="w-8 h-8 rounded-full bg-vault-600 flex items-center justify-center text-white text-xs font-bold">{(inst.profiles?.display_name || inst.profiles?.full_name || '?').charAt(0).toUpperCase()}</div>}
                <div>
                  <p className="text-sm font-medium">{inst.profiles?.display_name || inst.profiles?.full_name}</p>
                  <p className="text-xs text-slate-500">{inst.profiles?.email}</p>
                </div>
              </div>
              <span className={'text-xs px-2 py-0.5 rounded-full ' + (INSTANCE_STATUS_COLORS[inst.status] || '')}>{INSTANCE_STATUS_LABELS[inst.status]}</span>
              <span className="text-xs text-slate-500">{inst.instance_type === 'ONBOARDING' ? 'Onboarding' : 'Offboarding'}</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-vault-400">{pct}%</p>
            <p className="text-xs text-slate-500">{completed}/{tasks.length} tarefas</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-vault-900/50 rounded-full h-2 mb-6">
          <div className="bg-vault-500 h-2 rounded-full transition-all" style={{ width: pct + '%' }} />
        </div>

        {/* Tasks */}
        <div className="space-y-2">
          {tasks.map((task: any) => (
            <div key={task.id} className="glass rounded-xl p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <button
                    onClick={() => updateTaskStatus(task.id, task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED')}
                    className={'w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ' + (task.status === 'COMPLETED' ? 'bg-green-500 border-green-500' : task.status === 'IN_PROGRESS' ? 'border-blue-400' : 'border-slate-600 hover:border-vault-400')}
                  >
                    {task.status === 'COMPLETED' && <CheckCircle size={14} className="text-white" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className={'text-sm font-medium ' + (task.status === 'COMPLETED' ? 'line-through text-slate-500' : '')}>{task.title}</h4>
                      {task.is_required && <span className="text-[10px] text-red-400">Obrigatorio</span>}
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-vault-800/50 text-slate-400">{TASK_TYPE_LABELS[task.task_type] || task.task_type}</span>
                    </div>
                    {task.description && <p className="text-xs text-slate-500 mt-1">{task.description}</p>}
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500">
                      {task.due_date && <span className="flex items-center gap-1"><Clock size={10} /> {new Date(task.due_date).toLocaleDateString('pt-BR')}</span>}
                      {task.kb_articles?.title && <span className="flex items-center gap-1"><BookOpen size={10} /> {task.kb_articles.title}</span>}
                      {task.vaults?.name && <span className="flex items-center gap-1"><Key size={10} /> {task.vaults.name}</span>}
                      {task.configuration_items?.name && <span className="flex items-center gap-1"><Server size={10} /> {task.configuration_items.name}</span>}
                      {task.runbooks?.title && <span className="flex items-center gap-1"><FileText size={10} /> {task.runbooks.title}</span>}
                      {task.completed_by && task.profiles && <span>Concluido por {task.profiles.display_name || task.profiles.full_name}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={'text-xs px-2 py-0.5 rounded-full ' + (TASK_STATUS_COLORS[task.status] || '')}>{TASK_STATUS_LABELS[task.status]}</span>
                  {task.status !== 'COMPLETED' && task.status !== 'SKIPPED' && (
                    <select value={task.status} onChange={e => updateTaskStatus(task.id, e.target.value)} className="bg-vault-900/50 border border-vault-700/30 rounded-lg px-2 py-1 text-xs">
                      <option value="PENDING">Pendente</option>
                      <option value="IN_PROGRESS">Em andamento</option>
                      <option value="COMPLETED">Concluido</option>
                      <option value="SKIPPED">Ignorar</option>
                    </select>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {inst.notes && (
          <div className="glass rounded-xl p-4 mt-4">
            <h3 className="font-semibold text-sm mb-2">Observacoes</h3>
            <p className="text-sm text-slate-400">{inst.notes}</p>
          </div>
        )}
      </div>
    );
  }

  // Template Detail View
  if (templateDetail) {
    const tmpl = templateDetail.template;
    const tasks = templateDetail.tasks || [];
    return (
      <div>
        <button onClick={() => setTemplateDetail(null)} className="flex items-center gap-1 text-sm text-slate-400 hover:text-white mb-4"><ChevronRight size={14} className="rotate-180" /> Voltar</button>
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold">{tmpl.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs px-2 py-0.5 rounded-full bg-vault-600/20 text-vault-300">{tmpl.template_type === 'ONBOARDING' ? 'Onboarding' : 'Offboarding'}</span>
              {tmpl.job_profiles?.name && <span className="text-xs text-slate-500">Perfil: {tmpl.job_profiles.name}</span>}
              {tmpl.organizations?.name && <span className="text-xs text-slate-500">Org: {tmpl.organizations.name}</span>}
            </div>
            {tmpl.description && <p className="text-sm text-slate-400 mt-2">{tmpl.description}</p>}
          </div>
          {canManage && (
            <div className="flex gap-2">
              <button onClick={() => { setShowTaskForm(true); setTaskForm({ ...taskForm, sort_order: tasks.length }); }} className="flex items-center gap-2 bg-vault-600 hover:bg-vault-500 text-white px-3 py-2 rounded-lg text-sm"><Plus size={14} /> Nova Tarefa</button>
              <button onClick={() => { setEditingTemplate(tmpl); setTemplateForm({ name: tmpl.name, description: tmpl.description || '', template_type: tmpl.template_type, job_profile_id: tmpl.job_profile_id || '', organization_id: tmpl.organization_id || '' }); setShowTemplateForm(true); }} className="flex items-center gap-1 bg-vault-600/20 text-vault-300 px-3 py-2 rounded-lg text-sm"><Edit2 size={14} /> Editar</button>
            </div>
          )}
        </div>

        {/* Tasks list */}
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><ClipboardList size={16} className="text-vault-400" /> Tarefas ({tasks.length})</h3>
        {tasks.length === 0 ? <p className="text-sm text-slate-500 py-6 text-center">Nenhuma tarefa neste template</p> : (
          <div className="space-y-2">
            {tasks.map((task: any, idx: number) => (
              <div key={task.id} className="glass rounded-xl p-4 flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-vault-800/50 flex items-center justify-center text-xs text-slate-400 flex-shrink-0 mt-0.5">{idx + 1}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium">{task.title}</h4>
                      {task.is_required && <span className="text-[10px] text-red-400">Obrigatorio</span>}
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-vault-800/50 text-slate-400">{TASK_TYPE_LABELS[task.task_type] || task.task_type}</span>
                    </div>
                    {task.description && <p className="text-xs text-slate-500 mt-1">{task.description}</p>}
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500">
                      <span>Prazo: {task.due_days} dias</span>
                      {task.kb_articles?.title && <span>KB: {task.kb_articles.title}</span>}
                      {task.vaults?.name && <span>Cofre: {task.vaults.name}</span>}
                      {task.configuration_items?.name && <span>CI: {task.configuration_items.name}</span>}
                      {task.runbooks?.title && <span>Runbook: {task.runbooks.title}</span>}
                    </div>
                  </div>
                </div>
                {canManage && <button onClick={() => deleteTask(task.id)} className="p-1 text-slate-400 hover:text-red-400"><Trash2 size={14} /></button>}
              </div>
            ))}
          </div>
        )}

        {/* Task Form Modal */}
        {showTaskForm && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowTaskForm(false)}>
            <form onSubmit={addTask} className="w-full max-w-lg glass rounded-2xl p-6 animate-in" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">Nova Tarefa</h3>
                <button type="button" onClick={() => setShowTaskForm(false)}><X size={18} /></button>
              </div>
              <div className="space-y-3">
                <input value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="Titulo da tarefa" required className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm" />
                <textarea value={taskForm.description} onChange={e => setTaskForm({ ...taskForm, description: e.target.value })} placeholder="Descricao" className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm" />
                <div className="grid grid-cols-2 gap-3">
                  <select value={taskForm.task_type} onChange={e => setTaskForm({ ...taskForm, task_type: e.target.value })} className="bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm">
                    {Object.entries(TASK_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <input type="number" value={taskForm.due_days} onChange={e => setTaskForm({ ...taskForm, due_days: parseInt(e.target.value) || 7 })} placeholder="Prazo (dias)" className="bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" value={taskForm.sort_order} onChange={e => setTaskForm({ ...taskForm, sort_order: parseInt(e.target.value) || 0 })} placeholder="Ordem" className="bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm" />
                  <input value={taskForm.assigned_role} onChange={e => setTaskForm({ ...taskForm, assigned_role: e.target.value })} placeholder="Papel responsavel (opcional)" className="bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm" />
                </div>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={taskForm.is_required} onChange={e => setTaskForm({ ...taskForm, is_required: e.target.checked })} className="rounded" /> Tarefa obrigatoria</label>
              </div>
              <div className="flex gap-2 justify-end mt-4">
                <button type="button" onClick={() => setShowTaskForm(false)} className="px-4 py-2 text-sm text-slate-400">Cancelar</button>
                <button type="submit" disabled={saving} className="bg-vault-600 hover:bg-vault-500 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">Adicionar</button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  // Tab nav
  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'instances', label: 'Instancias', icon: Users },
    { key: 'templates', label: 'Templates', icon: ClipboardList },
    { key: 'profiles', label: 'Perfis de Cargo', icon: UserPlus },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3"><UserPlus className="text-vault-400" size={28} /> Onboarding / Offboarding</h1>
          <p className="text-sm text-slate-400 mt-1">Checklists de entrada e saida de servidores</p>
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

      {/* === INSTANCES TAB === */}
      {tab === 'instances' && (
        <div>
          <div className="flex flex-wrap gap-3 mb-4">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-vault-900/50 border border-vault-700/30 rounded-xl px-3 py-2.5 text-sm">
              <option value="">Todos os status</option>
              {Object.entries(INSTANCE_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} className="bg-vault-900/50 border border-vault-700/30 rounded-xl px-3 py-2.5 text-sm">
              <option value="">Todos os tipos</option>
              <option value="ONBOARDING">Onboarding</option>
              <option value="OFFBOARDING">Offboarding</option>
            </select>
            {canManage && (
              <button onClick={() => { loadUsers(); setShowInstanceForm(true); }} className="flex items-center gap-2 bg-vault-600 hover:bg-vault-500 text-white px-4 py-2 rounded-xl text-sm ml-auto"><Plus size={16} /> Novo Onboarding</button>
            )}
          </div>

          {filteredInstances.length === 0 ? <p className="text-center text-slate-500 py-10">Nenhuma instancia encontrada</p> : (
            <div className="space-y-2">
              {filteredInstances.map(inst => {
                const pct = inst.progress?.total > 0 ? Math.round((inst.progress.completed / inst.progress.total) * 100) : 0;
                return (
                  <div key={inst.id} onClick={() => loadInstance(inst.id)} className="glass rounded-xl p-4 cursor-pointer hover:bg-vault-800/30 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-vault-600 flex items-center justify-center text-white text-xs font-bold">
                          {(inst.profiles?.display_name || inst.profiles?.full_name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-medium text-sm">{inst.profiles?.display_name || inst.profiles?.full_name}</h3>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                            <span>{inst.onboarding_templates?.name}</span>
                            <span>{inst.instance_type === 'ONBOARDING' ? 'Onboarding' : 'Offboarding'}</span>
                            <span>{new Date(inst.created_at).toLocaleDateString('pt-BR')}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-sm font-semibold text-vault-400">{pct}%</p>
                          <p className="text-[10px] text-slate-500">{inst.progress?.completed}/{inst.progress?.total}</p>
                        </div>
                        <span className={'text-xs px-2 py-0.5 rounded-full ' + (INSTANCE_STATUS_COLORS[inst.status] || '')}>{INSTANCE_STATUS_LABELS[inst.status]}</span>
                      </div>
                    </div>
                    {/* Mini progress bar */}
                    <div className="w-full bg-vault-900/50 rounded-full h-1.5 mt-3">
                      <div className="bg-vault-500 h-1.5 rounded-full transition-all" style={{ width: pct + '%' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* === TEMPLATES TAB === */}
      {tab === 'templates' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-400">{templates.length} templates</p>
            {canManage && <button onClick={() => { setEditingTemplate(null); setTemplateForm({ name: '', description: '', template_type: 'ONBOARDING', job_profile_id: '', organization_id: '' }); setShowTemplateForm(true); }} className="flex items-center gap-2 bg-vault-600 hover:bg-vault-500 text-white px-4 py-2 rounded-xl text-sm"><Plus size={16} /> Novo Template</button>}
          </div>
          {templates.length === 0 ? <p className="text-center text-slate-500 py-10">Nenhum template cadastrado</p> : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {templates.map(tmpl => (
                <div key={tmpl.id} onClick={() => loadTemplate(tmpl.id)} className="glass rounded-xl p-5 cursor-pointer hover:bg-vault-800/30 transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <ClipboardList size={20} className="text-vault-400" />
                    <span className="text-xs px-2 py-0.5 rounded-full bg-vault-600/20 text-vault-300">{tmpl.template_type === 'ONBOARDING' ? 'Onboarding' : 'Offboarding'}</span>
                  </div>
                  <h3 className="font-semibold text-sm mb-1">{tmpl.name}</h3>
                  {tmpl.description && <p className="text-xs text-slate-500 line-clamp-2 mb-2">{tmpl.description}</p>}
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    {tmpl.job_profiles?.name && <span>{tmpl.job_profiles.name}</span>}
                    <span>{tmpl.task_count} tarefas</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* === PROFILES TAB === */}
      {tab === 'profiles' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-400">{jobProfiles.length} perfis de cargo</p>
            {canManage && <button onClick={() => { setEditingProfile(null); setProfileForm({ name: '', description: '', organization_id: '', default_role: 'user' }); setShowProfileForm(true); }} className="flex items-center gap-2 bg-vault-600 hover:bg-vault-500 text-white px-4 py-2 rounded-xl text-sm"><Plus size={16} /> Novo Perfil</button>}
          </div>
          {jobProfiles.length === 0 ? <p className="text-center text-slate-500 py-10">Nenhum perfil cadastrado</p> : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {jobProfiles.map(prof => (
                <div key={prof.id} className="glass rounded-xl p-5">
                  <div className="flex items-start justify-between mb-2">
                    <UserPlus size={20} className="text-vault-400" />
                    {canManage && (
                      <button onClick={() => { setEditingProfile(prof); setProfileForm({ name: prof.name, description: prof.description || '', organization_id: prof.organization_id || '', default_role: prof.default_role || 'user' }); setShowProfileForm(true); }} className="p-1 text-slate-400 hover:text-white"><Edit2 size={14} /></button>
                    )}
                  </div>
                  <h3 className="font-semibold text-sm mb-1">{prof.name}</h3>
                  {prof.description && <p className="text-xs text-slate-500 line-clamp-2 mb-2">{prof.description}</p>}
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    {prof.organizations?.name && <span>{prof.organizations.name}</span>}
                    <span>Role: {prof.default_role}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* === MODALS === */}

      {/* Profile Form */}
      {showProfileForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowProfileForm(false)}>
          <form onSubmit={saveProfile} className="w-full max-w-md glass rounded-2xl p-6 animate-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">{editingProfile ? 'Editar Perfil' : 'Novo Perfil de Cargo'}</h3>
              <button type="button" onClick={() => setShowProfileForm(false)}><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <input value={profileForm.name} onChange={e => setProfileForm({ ...profileForm, name: e.target.value })} placeholder="Nome do perfil (ex: Analista TI)" required className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm" />
              <textarea value={profileForm.description} onChange={e => setProfileForm({ ...profileForm, description: e.target.value })} placeholder="Descricao" className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm" />
              <select value={profileForm.organization_id} onChange={e => setProfileForm({ ...profileForm, organization_id: e.target.value })} className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm">
                <option value="">Sem organizacao</option>
                {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              <select value={profileForm.default_role} onChange={e => setProfileForm({ ...profileForm, default_role: e.target.value })} className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm">
                <option value="user">Usuario</option>
                <option value="technician">Tecnico</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button type="button" onClick={() => setShowProfileForm(false)} className="px-4 py-2 text-sm text-slate-400">Cancelar</button>
              <button type="submit" disabled={saving} className="bg-vault-600 hover:bg-vault-500 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">Salvar</button>
            </div>
          </form>
        </div>
      )}

      {/* Template Form */}
      {showTemplateForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowTemplateForm(false)}>
          <form onSubmit={saveTemplate} className="w-full max-w-md glass rounded-2xl p-6 animate-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">{editingTemplate ? 'Editar Template' : 'Novo Template'}</h3>
              <button type="button" onClick={() => setShowTemplateForm(false)}><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <input value={templateForm.name} onChange={e => setTemplateForm({ ...templateForm, name: e.target.value })} placeholder="Nome do template" required className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm" />
              <textarea value={templateForm.description} onChange={e => setTemplateForm({ ...templateForm, description: e.target.value })} placeholder="Descricao" className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm" />
              <select value={templateForm.template_type} onChange={e => setTemplateForm({ ...templateForm, template_type: e.target.value })} className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm">
                <option value="ONBOARDING">Onboarding</option>
                <option value="OFFBOARDING">Offboarding</option>
              </select>
              <select value={templateForm.job_profile_id} onChange={e => setTemplateForm({ ...templateForm, job_profile_id: e.target.value })} className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm">
                <option value="">Sem perfil de cargo</option>
                {jobProfiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select value={templateForm.organization_id} onChange={e => setTemplateForm({ ...templateForm, organization_id: e.target.value })} className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm">
                <option value="">Sem organizacao</option>
                {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button type="button" onClick={() => setShowTemplateForm(false)} className="px-4 py-2 text-sm text-slate-400">Cancelar</button>
              <button type="submit" disabled={saving} className="bg-vault-600 hover:bg-vault-500 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">Salvar</button>
            </div>
          </form>
        </div>
      )}

      {/* Instance Form */}
      {showInstanceForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowInstanceForm(false)}>
          <form onSubmit={createInstance} className="w-full max-w-md glass rounded-2xl p-6 animate-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">Novo Onboarding/Offboarding</h3>
              <button type="button" onClick={() => setShowInstanceForm(false)}><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <select value={instanceForm.template_id} onChange={e => setInstanceForm({ ...instanceForm, template_id: e.target.value })} required className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm">
                <option value="">Selecionar template...</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.template_type})</option>)}
              </select>
              <select value={instanceForm.user_id} onChange={e => setInstanceForm({ ...instanceForm, user_id: e.target.value })} required className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm">
                <option value="">Selecionar servidor...</option>
                {allUsers.map(u => <option key={u.id} value={u.id}>{u.display_name || u.full_name} ({u.email})</option>)}
              </select>
              <input type="date" value={instanceForm.due_date} onChange={e => setInstanceForm({ ...instanceForm, due_date: e.target.value })} className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm" placeholder="Prazo final" />
              <textarea value={instanceForm.notes} onChange={e => setInstanceForm({ ...instanceForm, notes: e.target.value })} placeholder="Observacoes (opcional)" className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm" />
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button type="button" onClick={() => setShowInstanceForm(false)} className="px-4 py-2 text-sm text-slate-400">Cancelar</button>
              <button type="submit" disabled={saving} className="bg-vault-600 hover:bg-vault-500 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50 flex items-center gap-2">
                {saving && <Loader2 size={14} className="animate-spin" />} Iniciar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
