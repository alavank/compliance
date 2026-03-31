import React, { useEffect, useState } from 'react';
import { BookOpen, Plus, Search, FileText, Tag, Eye, Edit2, Trash2, Loader2, X, ChevronRight, Clock, CheckCircle, Filter } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { hasPermission } from '../lib/access';
import { api } from '../lib/api';

const TYPE_LABELS: Record<string, string> = { POP: 'POP', TUTORIAL: 'Tutorial', FAQ: 'FAQ', RUNBOOK_TI: 'Runbook TI', POLITICA: 'Politica', MANUAL: 'Manual' };
const TYPE_COLORS: Record<string, string> = { POP: 'bg-blue-500/20 text-blue-300', TUTORIAL: 'bg-emerald-500/20 text-emerald-300', FAQ: 'bg-amber-500/20 text-amber-300', RUNBOOK_TI: 'bg-purple-500/20 text-purple-300', POLITICA: 'bg-red-500/20 text-red-300', MANUAL: 'bg-cyan-500/20 text-cyan-300' };
const STATUS_LABELS: Record<string, string> = { DRAFT: 'Rascunho', PUBLISHED: 'Publicado', ARCHIVED: 'Arquivado' };
const STATUS_COLORS: Record<string, string> = { DRAFT: 'bg-slate-500/20 text-slate-300', PUBLISHED: 'bg-green-500/20 text-green-300', ARCHIVED: 'bg-red-500/20 text-red-300' };

export default function KnowledgeBase() {
  const { user } = useAuth();
  const canManage = hasPermission(user, 'kb.manage');
  const [bases, setBases] = useState<any[]>([]);
  const [articles, setArticles] = useState<any[]>([]);
  const [labels, setLabels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'bases' | 'articles' | 'detail'>('bases');
  const [selectedBase, setSelectedBase] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [detail, setDetail] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [showBaseForm, setShowBaseForm] = useState(false);
  const [editingBase, setEditingBase] = useState<any>(null);
  const [baseForm, setBaseForm] = useState({ name: '', description: '', visibility: 'INTERNAL', color: '#6366f1' });
  const [form, setForm] = useState({ base_id: '', category_id: '', title: '', content: '', summary: '', article_type: 'TUTORIAL', visibility: 'INTERNAL', status: 'DRAFT', is_pinned: false, label_ids: [] as string[], change_notes: '' });
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadBases(); }, []);

  async function loadBases() {
    setLoading(true);
    try {
      const [b, l] = await Promise.all([api.get('/kb/bases'), api.get('/kb/labels')]);
      setBases(b.bases || []);
      setLabels(l.labels || []);
    } catch {} finally { setLoading(false); }
  }

  async function openBase(base: any) {
    setSelectedBase(base);
    setView('articles');
    setLoading(true);
    try {
      const [a, c] = await Promise.all([
        api.get('/kb/articles?base_id=' + base.id),
        api.get('/kb/bases/' + base.id + '/categories'),
      ]);
      setArticles(a.articles || []);
      setCategories(c.categories || []);
    } catch {} finally { setLoading(false); }
  }

  async function loadArticle(id: string) {
    try {
      const d = await api.get('/kb/articles/' + id);
      setDetail(d);
      setView('detail');
    } catch {}
  }

  async function saveBase(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingBase) { await api.put('/kb/bases/' + editingBase.id, baseForm); }
      else { await api.post('/kb/bases', baseForm); }
      setShowBaseForm(false);
      setEditingBase(null);
      loadBases();
    } catch {} finally { setSaving(false); }
  }

  async function saveArticle(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) { await api.put('/kb/articles/' + editing.id, form); }
      else { await api.post('/kb/articles', form); }
      setShowForm(false);
      setEditing(null);
      if (selectedBase) openBase(selectedBase);
    } catch {} finally { setSaving(false); }
  }

  async function deleteArticle(id: string) {
    if (!confirm('Excluir este artigo?')) return;
    try { await api.del('/kb/articles/' + id); if (selectedBase) openBase(selectedBase); } catch {}
  }

  function openArticleForm(article?: any) {
    if (article) {
      setEditing(article);
      setForm({ base_id: article.base_id, category_id: article.category_id || '', title: article.title, content: article.content, summary: article.summary || '', article_type: article.article_type, visibility: article.visibility, status: article.status, is_pinned: article.is_pinned, label_ids: (article.labels || []).map((l: any) => l.id), change_notes: '' });
    } else {
      setEditing(null);
      setForm({ base_id: selectedBase?.id || '', category_id: '', title: '', content: '', summary: '', article_type: 'TUTORIAL', visibility: 'INTERNAL', status: 'DRAFT', is_pinned: false, label_ids: [], change_notes: '' });
    }
    setShowForm(true);
  }

  const filteredArticles = articles.filter(a => {
    if (search && !a.title.toLowerCase().includes(search.toLowerCase()) && !(a.content || '').toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType && a.article_type !== filterType) return false;
    if (filterStatus && a.status !== filterStatus) return false;
    return true;
  });

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-vault-400" size={32} /></div>;

  // Article detail view
  if (view === 'detail' && detail) {
    const a = detail.article;
    return (
      <div>
        <button onClick={() => setView('articles')} className="flex items-center gap-1 text-sm text-slate-400 hover:text-white mb-4"><ChevronRight size={14} className="rotate-180" /> Voltar</button>
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={'text-xs px-2 py-0.5 rounded-full ' + (TYPE_COLORS[a.article_type] || '')}>{TYPE_LABELS[a.article_type]}</span>
              <span className={'text-xs px-2 py-0.5 rounded-full ' + (STATUS_COLORS[a.status] || '')}>{STATUS_LABELS[a.status]}</span>
              {a.is_pinned && <span className="text-xs text-amber-400">Fixado</span>}
            </div>
            <h1 className="text-2xl font-bold">{a.title}</h1>
            {a.summary && <p className="text-sm text-slate-400 mt-1">{a.summary}</p>}
            <p className="text-xs text-slate-500 mt-2">Por {a.profiles?.display_name || a.profiles?.full_name} - {new Date(a.updated_at).toLocaleDateString('pt-BR')} - {a.view_count} visualizacoes</p>
          </div>
          {canManage && <button onClick={() => openArticleForm(a)} className="flex items-center gap-2 bg-vault-600/20 text-vault-300 px-3 py-2 rounded-lg text-sm hover:bg-vault-600/30"><Edit2 size={14} /> Editar</button>}
        </div>
        {detail.labels?.length > 0 && (
          <div className="flex gap-2 mb-4 flex-wrap">{detail.labels.map((l: any) => <span key={l.id} className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: l.color + '20', color: l.color }}><Tag size={10} className="inline mr-1" />{l.name}</span>)}</div>
        )}
        <div className="glass rounded-xl p-6 mb-6 prose prose-invert max-w-none">
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{a.content}</div>
        </div>
        {detail.versions?.length > 1 && (
          <div className="glass rounded-xl p-4 mb-4">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Clock size={16} className="text-vault-400" /> Historico ({detail.versions.length} versoes)</h3>
            <div className="space-y-2">
              {detail.versions.map((v: any) => (
                <div key={v.id} className="flex items-center justify-between bg-vault-900/40 rounded-lg px-4 py-2 text-xs">
                  <span>v{v.version_number} - {v.profiles?.display_name || v.profiles?.full_name}</span>
                  <span className="text-slate-500">{new Date(v.created_at).toLocaleString('pt-BR')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {detail.attachments?.length > 0 && (
          <div className="glass rounded-xl p-4">
            <h3 className="font-semibold text-sm mb-3">Anexos</h3>
            {detail.attachments.map((att: any) => (
              <a key={att.id} href={att.file_url} target="_blank" className="block bg-vault-900/40 rounded-lg px-4 py-2 text-sm text-vault-300 hover:text-vault-200 mb-1">{att.file_name}</a>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Articles list
  if (view === 'articles' && selectedBase) {
    return (
      <div>
        <button onClick={() => { setView('bases'); setSelectedBase(null); }} className="flex items-center gap-1 text-sm text-slate-400 hover:text-white mb-4"><ChevronRight size={14} className="rotate-180" /> Voltar as bases</button>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3"><BookOpen size={24} style={{ color: selectedBase.color }} /> {selectedBase.name}</h1>
            <p className="text-sm text-slate-400 mt-1">{selectedBase.description || ''}</p>
          </div>
          {canManage && <button onClick={() => openArticleForm()} className="flex items-center gap-2 bg-vault-600 hover:bg-vault-500 text-white px-4 py-2 rounded-xl text-sm"><Plus size={16} /> Novo Artigo</button>}
        </div>
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="flex-1 min-w-[200px] relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar artigos..." className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl pl-10 pr-4 py-2.5 text-sm" />
          </div>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="bg-vault-900/50 border border-vault-700/30 rounded-xl px-3 py-2.5 text-sm">
            <option value="">Todos os tipos</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-vault-900/50 border border-vault-700/30 rounded-xl px-3 py-2.5 text-sm">
            <option value="">Todos os status</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        {filteredArticles.length === 0 ? <p className="text-center text-slate-500 py-10">Nenhum artigo encontrado</p> : (
          <div className="space-y-3">
            {filteredArticles.map(a => (
              <div key={a.id} onClick={() => loadArticle(a.id)} className="glass rounded-xl p-4 cursor-pointer hover:bg-vault-800/30 transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {a.is_pinned && <span className="text-amber-400 text-xs">📌</span>}
                      <span className={'text-[10px] px-1.5 py-0.5 rounded-full ' + (TYPE_COLORS[a.article_type] || '')}>{TYPE_LABELS[a.article_type]}</span>
                      <span className={'text-[10px] px-1.5 py-0.5 rounded-full ' + (STATUS_COLORS[a.status] || '')}>{STATUS_LABELS[a.status]}</span>
                    </div>
                    <h3 className="font-medium text-sm">{a.title}</h3>
                    {a.summary && <p className="text-xs text-slate-500 mt-1 line-clamp-1">{a.summary}</p>}
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500">
                      <span>{a.profiles?.display_name || a.profiles?.full_name}</span>
                      <span>{new Date(a.updated_at).toLocaleDateString('pt-BR')}</span>
                      <span className="flex items-center gap-0.5"><Eye size={10} /> {a.view_count}</span>
                    </div>
                    {a.labels?.length > 0 && (
                      <div className="flex gap-1 mt-2">{a.labels.slice(0, 3).map((l: any) => <span key={l.id} className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: l.color + '20', color: l.color }}>{l.name}</span>)}</div>
                    )}
                  </div>
                  {canManage && (
                    <div className="flex gap-1 ml-3">
                      <button onClick={e => { e.stopPropagation(); openArticleForm(a); }} className="p-1 text-slate-400 hover:text-white"><Edit2 size={14} /></button>
                      <button onClick={e => { e.stopPropagation(); deleteArticle(a.id); }} className="p-1 text-slate-400 hover:text-red-400"><Trash2 size={14} /></button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {/* Article Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
            <form onSubmit={saveArticle} className="w-full max-w-2xl glass rounded-2xl p-6 animate-in max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">{editing ? 'Editar Artigo' : 'Novo Artigo'}</h3>
                <button type="button" onClick={() => setShowForm(false)}><X size={18} /></button>
              </div>
              <div className="space-y-3">
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Titulo do artigo" required className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm" />
                <input value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} placeholder="Resumo (opcional)" className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm" />
                <div className="grid grid-cols-2 gap-3">
                  <select value={form.article_type} onChange={e => setForm({ ...form, article_type: e.target.value })} className="bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm">
                    {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <select value={form.visibility} onChange={e => setForm({ ...form, visibility: e.target.value })} className="bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm">
                    <option value="INTERNAL">Interno</option>
                    <option value="DEPARTMENT_ONLY">Departamento</option>
                    <option value="PUBLIC">Publico</option>
                  </select>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm">
                    {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <select value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })} className="bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm">
                    <option value="">Sem categoria</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="Conteudo do artigo..." rows={12} className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm font-mono" />
                {editing && <input value={form.change_notes} onChange={e => setForm({ ...form, change_notes: e.target.value })} placeholder="Notas da alteracao (opcional)" className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm" />}
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_pinned} onChange={e => setForm({ ...form, is_pinned: e.target.checked })} className="rounded" /> Fixar artigo no topo</label>
              </div>
              <div className="flex gap-2 justify-end mt-4">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-400">Cancelar</button>
                <button type="submit" disabled={saving} className="bg-vault-600 hover:bg-vault-500 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50 flex items-center gap-2">
                  {saving && <Loader2 size={14} className="animate-spin" />} Salvar
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  // Bases view
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3"><BookOpen className="text-vault-400" size={28} /> Base de Conhecimento</h1>
          <p className="text-sm text-slate-400 mt-1">POPs, tutoriais, manuais e documentacao</p>
        </div>
        {canManage && (
          <button onClick={() => { setEditingBase(null); setBaseForm({ name: '', description: '', visibility: 'INTERNAL', color: '#6366f1' }); setShowBaseForm(true); }} className="flex items-center gap-2 bg-vault-600 hover:bg-vault-500 text-white px-4 py-2 rounded-xl text-sm">
            <Plus size={16} /> Nova Base
          </button>
        )}
      </div>
      {bases.length === 0 ? (
        <div className="text-center py-20 text-slate-500"><BookOpen size={48} className="mx-auto mb-4 opacity-30" /><p>Nenhuma base criada</p></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {bases.map(b => (
            <div key={b.id} onClick={() => openBase(b)} className="glass rounded-xl p-5 cursor-pointer hover:bg-vault-800/30 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: b.color + '20' }}><BookOpen size={20} style={{ color: b.color }} /></div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate">{b.name}</h3>
                  <p className="text-xs text-slate-500">{b.article_count} artigos</p>
                </div>
              </div>
              {b.description && <p className="text-xs text-slate-500 line-clamp-2">{b.description}</p>}
            </div>
          ))}
        </div>
      )}
      {/* Base Form */}
      {showBaseForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowBaseForm(false)}>
          <form onSubmit={saveBase} className="w-full max-w-md glass rounded-2xl p-6 animate-in" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-4">{editingBase ? 'Editar Base' : 'Nova Base'}</h3>
            <div className="space-y-3">
              <input value={baseForm.name} onChange={e => setBaseForm({ ...baseForm, name: e.target.value })} placeholder="Nome da base" required className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm" />
              <textarea value={baseForm.description} onChange={e => setBaseForm({ ...baseForm, description: e.target.value })} placeholder="Descricao" className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm" />
              <div className="flex gap-3">
                <input type="color" value={baseForm.color} onChange={e => setBaseForm({ ...baseForm, color: e.target.value })} className="w-12 h-10 rounded-lg cursor-pointer bg-transparent" />
                <select value={baseForm.visibility} onChange={e => setBaseForm({ ...baseForm, visibility: e.target.value })} className="flex-1 bg-vault-900/50 border border-vault-700/30 rounded-xl px-3 py-2.5 text-sm">
                  <option value="INTERNAL">Interno</option>
                  <option value="DEPARTMENT_ONLY">Departamento</option>
                  <option value="PUBLIC">Publico</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button type="button" onClick={() => setShowBaseForm(false)} className="px-4 py-2 text-sm text-slate-400">Cancelar</button>
              <button type="submit" disabled={saving} className="bg-vault-600 hover:bg-vault-500 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">Salvar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
