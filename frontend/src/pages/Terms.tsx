import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { CheckCircle2, Clock, FileText, Loader2, PencilLine, Plus, Trash2, Users, X } from 'lucide-react';

type Term = {
  id: string;
  title: string;
  content: string;
  version: string;
  elaboration_date?: string | null;
  created_at: string;
  updated_at?: string;
  profiles?: { full_name?: string | null; display_name?: string | null; email?: string | null } | null;
};

type FormState = {
  title: string;
  version: string;
  elaboration_date: string;
  content: string;
};

const emptyForm: FormState = { title: '', version: '', elaboration_date: '', content: '' };

export default function Terms() {
  const [terms, setTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingTerm, setEditingTerm] = useState<Term | null>(null);
  const [showAcceptances, setShowAcceptances] = useState<Term | null>(null);
  const [acceptances, setAcceptances] = useState<any[]>([]);
  const [accLoading, setAccLoading] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const d = await api.get('/terms');
      setTerms(d.terms || []);
    } catch {
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingTerm(null);
    setForm(emptyForm);
    setShowEditor(true);
  }

  function openEdit(term: Term) {
    setEditingTerm(term);
    setForm({
      title: term.title,
      version: term.version || '',
      elaboration_date: term.elaboration_date || '',
      content: term.content,
    });
    setShowEditor(true);
  }

  function closeEditor() {
    setShowEditor(false);
    setEditingTerm(null);
    setForm(emptyForm);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingTerm) {
        await api.put('/terms/' + editingTerm.id, form);
        msg('Termo atualizado.');
      } else {
        await api.post('/terms', form);
        msg('Nova versão criada! Todos deverão aceitar.');
      }
      closeEditor();
      load();
    } catch (err: any) {
      msg(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(term: Term) {
    const ok = window.confirm(`Excluir o termo "${term.title}" (v${term.version})?\n\nSe ele já teve aceites, eles também serão removidos.`);
    if (!ok) return;

    setDeletingId(term.id);
    try {
      await api.delete('/terms/' + term.id);
      msg('Termo excluído.');
      if (showAcceptances?.id === term.id) {
        setShowAcceptances(null);
        setAcceptances([]);
      }
      load();
    } catch (err: any) {
      msg(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  async function viewAcceptances(term: Term) {
    setShowAcceptances(term);
    setAccLoading(true);
    try {
      const d = await api.get('/terms/' + term.id + '/acceptances');
      setAcceptances(d.acceptances || []);
    } catch {
    } finally {
      setAccLoading(false);
    }
  }

  function msg(m: string) {
    setToast(m);
    setTimeout(() => setToast(null), 3000);
  }

  function publishedBy(term: Term) {
    return term.profiles?.display_name || term.profiles?.full_name || term.profiles?.email || 'Administrador';
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 size={32} className="animate-spin text-vault-400" /></div>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Termos LGPD</h1>
          <p className="text-sm text-slate-500">Gerenciar versões, correções e exclusões de termos</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-vault-600 hover:bg-vault-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium">
          <Plus size={16} /> Nova Versão
        </button>
      </div>

      <div className="space-y-3">
        {terms.map((t, i) => (
          <div key={t.id} className={'glass rounded-xl p-4 ' + (i === 0 ? 'border-vault-500/30' : '')}>
            <div className="flex items-start gap-3">
              <div className={'w-10 h-10 rounded-xl flex items-center justify-center ' + (i === 0 ? 'bg-vault-500/20' : 'bg-slate-500/10')}>
                <FileText size={18} className={i === 0 ? 'text-vault-400' : 'text-slate-500'} />
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-sm">{t.title}</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-vault-800/50 text-slate-400">v{t.version}</span>
                  {i === 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">Ativo</span>}
                </div>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{t.content.substring(0, 150)}...</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-600">
                  <p className="flex items-center gap-1"><Clock size={10} /> Publicado em {new Date(t.created_at).toLocaleString('pt-BR')}</p>
                  <p>Elaboração: {t.elaboration_date ? new Date(t.elaboration_date + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</p>
                  <p>Publicado por: {publishedBy(t)}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                <button onClick={() => viewAcceptances(t)} className="flex items-center gap-1 px-3 py-1.5 glass-light rounded-lg text-xs text-vault-300 hover:bg-vault-800/50">
                  <Users size={12} /> Aceites
                </button>
                <button onClick={() => openEdit(t)} className="flex items-center gap-1 px-3 py-1.5 glass-light rounded-lg text-xs text-slate-300 hover:bg-vault-800/50">
                  <PencilLine size={12} /> Editar
                </button>
                <button
                  onClick={() => handleDelete(t)}
                  disabled={deletingId === t.id}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-red-300 border border-red-500/20 hover:bg-red-500/10 disabled:opacity-50"
                >
                  {deletingId === t.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  Excluir
                </button>
              </div>
            </div>
          </div>
        ))}
        {terms.length === 0 && <div className="text-center py-16 text-slate-500"><FileText size={40} className="mx-auto mb-3 opacity-30" /><p className="text-sm">Nenhum termo cadastrado</p></div>}
      </div>

      {showEditor && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={closeEditor}>
          <div className="w-full max-w-2xl glass rounded-2xl shadow-2xl animate-in max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-vault-700/30">
              <h2 className="font-semibold">{editingTerm ? `Editar Termo v${editingTerm.version}` : 'Nova Versão do Termo'}</h2>
              <button onClick={closeEditor} className="p-1"><X size={18} /></button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div className="px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-300">
                {editingTerm
                  ? 'Use edição para corrigir erros de texto. Se a mudança alterar o conteúdo de forma relevante, o ideal continua sendo criar uma nova versão.'
                  : 'Ao criar uma nova versão, todos os usuários serão obrigados a aceitar novamente no próximo login.'}
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Título *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-vault-500"
                  required
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Versão *</label>
                  <input
                    type="text"
                    value={form.version}
                    onChange={e => setForm(f => ({ ...f, version: e.target.value }))}
                    className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-vault-500"
                    placeholder="Ex.: 1.0, 2.1, 2025-01"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Data de Elaboração *</label>
                  <input
                    type="date"
                    value={form.elaboration_date}
                    onChange={e => setForm(f => ({ ...f, elaboration_date: e.target.value }))}
                    className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-vault-500"
                    required
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Data de Publicação</label>
                  <input
                    type="text"
                    value={editingTerm ? new Date(editingTerm.created_at).toLocaleString('pt-BR') : 'Automática ao publicar'}
                    className="w-full bg-vault-900/30 border border-vault-700/20 rounded-xl px-3 py-2.5 text-sm text-slate-500"
                    readOnly
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Publicado por</label>
                  <input
                    type="text"
                    value={editingTerm ? publishedBy(editingTerm) : 'Automático pelo usuário logado'}
                    className="w-full bg-vault-900/30 border border-vault-700/20 rounded-xl px-3 py-2.5 text-sm text-slate-500"
                    readOnly
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Conteúdo do Termo *</label>
                <textarea
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-vault-500 resize-none"
                  rows={12}
                  required
                />
              </div>
              <button type="submit" disabled={saving} className="w-full bg-vault-600 hover:bg-vault-500 text-white py-3 rounded-xl font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                {saving && <Loader2 size={16} className="animate-spin" />}
                {editingTerm ? 'Salvar Alterações' : 'Publicar Termo'}
              </button>
            </form>
          </div>
        </div>
      )}

      {showAcceptances && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowAcceptances(null)}>
          <div className="w-full max-w-lg glass rounded-2xl shadow-2xl animate-in max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-vault-700/30">
              <h2 className="font-semibold">Aceites - v{showAcceptances.version}</h2>
              <button onClick={() => setShowAcceptances(null)} className="p-1"><X size={18} /></button>
            </div>
            <div className="p-5">
              {accLoading ? <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-vault-400" /></div> :
                acceptances.length === 0 ? <p className="text-sm text-slate-500 text-center py-4">Nenhum aceite registrado</p> :
                <div className="space-y-2">
                  {acceptances.map((a: any) => (
                    <div key={a.id} className="flex items-center gap-3 p-3 bg-vault-900/30 rounded-lg">
                      <CheckCircle2 size={16} className="text-green-400 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{a.profiles?.full_name || a.full_name_typed}</p>
                        <p className="text-[10px] text-slate-500">{a.profiles?.email} • {new Date(a.accepted_at).toLocaleString('pt-BR')}</p>
                        {a.cpf && <p className="text-[10px] text-slate-500">CPF: {a.cpf}</p>}
                      </div>
                    </div>
                  ))}
                </div>}
            </div>
          </div>
        </div>
      )}

      {toast && <div className="fixed bottom-24 lg:bottom-6 right-6 glass px-4 py-3 rounded-xl text-sm toast-enter shadow-xl z-50">{toast}</div>}
    </div>
  );
}
