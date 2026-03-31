import React, { useEffect, useState } from 'react';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  GitBranch,
  Loader2,
  PencilLine,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { api } from '../lib/api';

type OrgNode = {
  id: string;
  name: string;
  type?: string;
  label?: string;
  parent_id?: string | null;
  children?: OrgNode[];
};

type FormState = {
  name: string;
  label: string;
  parent_id: string;
};

type ActiveForm =
  | { mode: 'create'; parentId: string | null }
  | { mode: 'edit'; nodeId: string }
  | null;

const emptyForm: FormState = { name: '', label: '', parent_id: '' };

export default function Organization() {
  const [tree, setTree] = useState<OrgNode[]>([]);
  const [flatNodes, setFlatNodes] = useState<OrgNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [activeForm, setActiveForm] = useState<ActiveForm>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [treeData, flatData] = await Promise.all([api.get('/organizations/tree'), api.get('/organizations')]);
      setTree(treeData.tree || []);
      setFlatNodes(flatData.organizations || []);
      setExpanded((current) => {
        const next = { ...current };
        (flatData.organizations || []).forEach((node: OrgNode) => {
          if (next[node.id] === undefined) next[node.id] = true;
        });
        return next;
      });
    } catch (err: any) {
      msg(err.message);
    } finally {
      setLoading(false);
    }
  }

  function msg(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 3000);
  }

  function openCreate(parentId: string | null = null) {
    setActiveForm({ mode: 'create', parentId });
    setForm({
      name: '',
      label: parentId ? suggestChildLabel(parentId) : 'Organizacao',
      parent_id: parentId || '',
    });
    if (parentId) {
      setExpanded((current) => ({ ...current, [parentId]: true }));
    }
  }

  function openEdit(node: OrgNode) {
    setActiveForm({ mode: 'edit', nodeId: node.id });
    setForm({
      name: node.name || '',
      label: node.label || node.type || '',
      parent_id: node.parent_id || '',
    });
  }

  function closeForm() {
    setActiveForm(null);
    setForm(emptyForm);
  }

  function suggestChildLabel(parentId: string) {
    const parent = flatNodes.find((node) => node.id === parentId);
    const parentLabel = (parent?.label || parent?.type || '').toLowerCase();
    if (parentLabel.includes('organiz')) return 'Secretaria';
    if (parentLabel.includes('secret')) return 'Departamento';
    if (parentLabel.includes('depart')) return 'Setor';
    return 'Subdivisao';
  }

  function collectDescendantIds(nodeId: string): Set<string> {
    const childrenByParent = new Map<string, string[]>();
    flatNodes.forEach((node) => {
      const parentId = node.parent_id || '';
      if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
      childrenByParent.get(parentId)!.push(node.id);
    });

    const ids = new Set<string>();
    const queue = [nodeId];
    while (queue.length) {
      const current = queue.shift()!;
      const children = childrenByParent.get(current) || [];
      children.forEach((childId) => {
        if (!ids.has(childId)) {
          ids.add(childId);
          queue.push(childId);
        }
      });
    }
    return ids;
  }

  function availableParents() {
    if (activeForm?.mode !== 'edit') return flatNodes;
    const blocked = collectDescendantIds(activeForm.nodeId);
    blocked.add(activeForm.nodeId);
    return flatNodes.filter((node) => !blocked.has(node.id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.label.trim()) {
      msg('Preencha nome e nomenclatura.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        label: form.label.trim(),
        parent_id: form.parent_id || null,
      };

      if (activeForm?.mode === 'edit') {
        await api.put('/organizations/' + activeForm.nodeId, payload);
        msg('Estrutura atualizada.');
      } else {
        await api.post('/organizations', payload);
        msg('Estrutura criada.');
      }

      closeForm();
      await load();
    } catch (err: any) {
      msg(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(node: OrgNode) {
    const ok = window.confirm(`Excluir "${node.name}" e toda a estrutura abaixo dele?`);
    if (!ok) return;

    try {
      await api.delete('/organizations/' + node.id);
      msg('Estrutura removida.');
      await load();
    } catch (err: any) {
      msg(err.message);
    }
  }

  function toggleNode(nodeId: string) {
    setExpanded((current) => ({ ...current, [nodeId]: !current[nodeId] }));
  }

  function renderInlineForm(anchorLabel: string) {
    return (
      <form onSubmit={handleSubmit} className="mt-3 rounded-2xl border border-vault-700/30 bg-vault-900/40 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">{activeForm?.mode === 'edit' ? 'Editar estrutura' : 'Nova estrutura'}</p>
            <p className="text-xs text-slate-500">{anchorLabel}</p>
          </div>
          <button type="button" onClick={closeForm} className="rounded-lg p-1 text-slate-500 hover:bg-vault-800/50 hover:text-slate-200">
            <X size={16} />
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-slate-400">Nomenclatura</label>
            <input
              value={form.label}
              onChange={(e) => setForm((current) => ({ ...current, label: e.target.value }))}
              className="w-full rounded-xl border border-vault-700/30 bg-vault-950/60 px-3 py-2.5 text-sm focus:border-vault-500 focus:outline-none"
              placeholder="Ex.: Secretaria, Departamento, Coordenação"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-400">Nome</label>
            <input
              value={form.name}
              onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
              className="w-full rounded-xl border border-vault-700/30 bg-vault-950/60 px-3 py-2.5 text-sm focus:border-vault-500 focus:outline-none"
              placeholder="Ex.: Secretaria de Administração"
              required
            />
          </div>
        </div>

        <div className="mt-3">
          <label className="mb-1 block text-xs text-slate-400">Pertence a</label>
          <select
            value={form.parent_id}
            onChange={(e) => setForm((current) => ({ ...current, parent_id: e.target.value }))}
            className="w-full appearance-none rounded-xl border border-vault-700/30 bg-vault-950/60 px-3 py-2.5 text-sm focus:border-vault-500 focus:outline-none"
          >
            <option value="">Raiz do organograma</option>
            {availableParents().map((node) => (
              <option key={node.id} value={node.id}>
                {(node.label || node.type || 'Estrutura') + ': ' + node.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-vault-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-vault-500 disabled:opacity-50"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            {activeForm?.mode === 'edit' ? 'Salvar' : 'Criar'}
          </button>
          <button
            type="button"
            onClick={closeForm}
            className="rounded-xl border border-vault-700/30 px-4 py-2.5 text-sm text-slate-300 hover:bg-vault-800/40"
          >
            Cancelar
          </button>
        </div>
      </form>
    );
  }

  function renderNode(node: OrgNode, depth = 0): React.ReactNode {
    const hasChildren = Boolean(node.children?.length);
    const isExpanded = expanded[node.id] ?? true;
    const isCreatingHere = activeForm?.mode === 'create' && activeForm.parentId === node.id;
    const isEditingHere = activeForm?.mode === 'edit' && activeForm.nodeId === node.id;
    const borderColor = depth === 0 ? 'border-vault-500/30' : 'border-vault-700/20';

    return (
      <div key={node.id} className={depth > 0 ? 'ml-3 border-l border-vault-700/20 pl-3' : ''}>
        <div className={'rounded-2xl border bg-vault-900/20 px-3 py-2.5 ' + borderColor}>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => hasChildren && toggleNode(node.id)}
                className={'rounded-lg p-0.5 ' + (hasChildren ? 'text-slate-400 hover:bg-vault-800/50 hover:text-slate-100' : 'text-slate-700')}
              >
                {hasChildren ? (isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />) : <span className="block h-4 w-4" />}
              </button>

              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-vault-600/20 text-vault-300">
                <GitBranch size={14} />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-vault-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-vault-300">
                  {node.label || node.type || 'Estrutura'}
                </span>
                <h3 className="text-sm font-semibold text-slate-100">{node.name}</h3>
                {hasChildren && (
                  <span className="text-[10px] text-slate-500">
                    {node.children!.length} sub{node.children!.length > 1 ? 'estruturas' : 'estrutura'}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => openCreate(node.id)}
                className="inline-flex items-center gap-1 rounded-xl bg-vault-600/20 px-3 py-2 text-xs font-medium text-vault-200 hover:bg-vault-600/30"
              >
                <Plus size={14} />
                Adicionar abaixo
              </button>
              <button
                type="button"
                onClick={() => openEdit(node)}
                className="inline-flex items-center gap-1 rounded-xl border border-vault-700/30 px-3 py-2 text-xs text-slate-300 hover:bg-vault-800/40"
              >
                <PencilLine size={14} />
                Editar
              </button>
              <button
                type="button"
                onClick={() => handleDelete(node)}
                className="inline-flex items-center gap-1 rounded-xl border border-red-500/20 px-3 py-2 text-xs text-red-300 hover:bg-red-500/10"
              >
                <Trash2 size={14} />
                Excluir
              </button>
            </div>
          </div>

          {isCreatingHere && renderInlineForm('Novo item abaixo de ' + node.name)}
          {isEditingHere && renderInlineForm('Editando ' + node.name)}
        </div>

        {hasChildren && isExpanded && (
          <div className="mt-2 space-y-2">
            {node.children!.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 size={32} className="animate-spin text-vault-400" />
      </div>
    );
  }

  const showRootForm = activeForm?.mode === 'create' && activeForm.parentId === null;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-vault-700/30 bg-vault-900/30 px-3 py-1 text-xs text-vault-300">
            <Building2 size={14} />
            Organograma flexível
          </div>
          <h1 className="text-2xl font-bold">Estrutura organizacional</h1>
          <p className="mt-1 text-sm text-slate-400">
            Monte o organograma do jeito que a organização funciona: secretaria, departamento, coordenação, divisão ou qualquer outro nível.
          </p>
        </div>

        <button
          type="button"
          onClick={() => openCreate(null)}
          className="inline-flex items-center gap-2 self-start rounded-2xl bg-vault-600 px-4 py-3 text-sm font-medium text-white hover:bg-vault-500"
        >
          <Plus size={16} />
          Nova raiz
        </button>
      </div>

      {showRootForm && renderInlineForm('Criar estrutura principal do organograma')}

      <div className="rounded-3xl border border-vault-700/20 bg-vault-950/20 p-3 lg:p-4">
        {tree.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <Building2 size={42} className="mx-auto mb-4 opacity-40" />
            <p className="text-sm">Nenhuma estrutura criada ainda.</p>
            <p className="mt-1 text-xs text-slate-600">Comece pela organização principal e depois vá adicionando os níveis com o botão +.</p>
          </div>
        ) : (
          <div className="space-y-2">{tree.map((node) => renderNode(node))}</div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-24 right-6 z-50 rounded-xl border border-vault-700/30 bg-vault-900/90 px-4 py-3 text-sm shadow-xl lg:bottom-6">
          {toast}
        </div>
      )}
    </div>
  );
}
