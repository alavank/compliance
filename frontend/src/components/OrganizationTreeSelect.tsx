import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronRight } from 'lucide-react';
import { buildOrgPathMap, type OrgNode } from '../lib/organizations';

type Props = {
  tree: OrgNode[];
  selectedIds: string[];
  onChange: (next: string[]) => void;
  helperText?: string;
  emptyText?: string;
};

export default function OrganizationTreeSelect({
  tree,
  selectedIds,
  onChange,
  helperText,
  emptyText = 'Nenhum local selecionado',
}: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const next: Record<string, boolean> = {};
    const visit = (nodes: OrgNode[]) => {
      nodes.forEach((node) => {
        next[node.id] = true;
        if (node.children?.length) visit(node.children);
      });
    };
    visit(tree);
    setExpanded(next);
  }, [tree]);

  const pathMap = useMemo(() => buildOrgPathMap(tree), [tree]);
  const selectedLabels = selectedIds.map((id) => pathMap[id]).filter(Boolean);

  function toggleExpand(nodeId: string) {
    setExpanded((current) => ({ ...current, [nodeId]: !current[nodeId] }));
  }

  function toggleSelect(nodeId: string) {
    if (selectedIds.includes(nodeId)) {
      onChange(selectedIds.filter((id) => id !== nodeId));
      return;
    }
    onChange([...selectedIds, nodeId]);
  }

  function renderNode(node: OrgNode, depth = 0): React.ReactNode {
    const hasChildren = Boolean(node.children?.length);
    const isExpanded = expanded[node.id] ?? true;
    const isSelected = selectedIds.includes(node.id);

    return (
      <div key={node.id}>
        <div
          className={
            'flex items-center gap-1.5 rounded-lg border px-2 py-1.5 transition-colors ' +
            (isSelected
              ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100'
              : 'border-vault-700/20 bg-vault-900/30 text-slate-200 hover:border-vault-500/30 hover:bg-vault-800/30')
          }
          style={{ marginLeft: depth * 14 }}
        >
          <button
            type="button"
            onClick={() => hasChildren && toggleExpand(node.id)}
            className={'rounded p-0.5 ' + (hasChildren ? 'text-slate-500 hover:bg-vault-800/50 hover:text-slate-200' : 'text-transparent')}
          >
            {hasChildren ? (isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />) : <ChevronRight size={13} />}
          </button>

          <button
            type="button"
            onClick={() => toggleSelect(node.id)}
            className={
              'flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors ' +
              (isSelected ? 'border-emerald-300 bg-emerald-400 text-vault-950' : 'border-vault-600/40 bg-vault-950/60 text-transparent')
            }
          >
            <Check size={11} />
          </button>

          <span className="rounded-full bg-vault-500/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-vault-300 flex-shrink-0">
            {node.label || node.type || 'Estrutura'}
          </span>
          <span className="truncate text-xs text-slate-200">{node.name}</span>
        </div>

        {hasChildren && isExpanded && <div className="mt-1 space-y-1">{node.children!.map((child) => renderNode(child, depth + 1))}</div>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-vault-700/20 bg-vault-950/40 p-3">
        {selectedLabels.length === 0 ? (
          <p className="text-sm text-slate-500">{emptyText}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {selectedLabels.map((label) => (
              <span key={label} className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-200">
                {label}
              </span>
            ))}
          </div>
        )}
      </div>

      {helperText && <p className="text-[11px] text-slate-500">{helperText}</p>}

      <div className="max-h-52 space-y-1 overflow-y-auto rounded-xl border border-vault-700/20 bg-vault-950/20 p-2">
        {tree.map((node) => renderNode(node))}
      </div>
    </div>
  );
}
