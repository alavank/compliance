import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { getRoleBadgeClass, getRoleLabel, normalizePermissionMap, PERMISSION_GROUPS } from '../lib/access';
import { Shield, Plus, Edit3, Trash2, Users, Loader2, X, AlertTriangle, UserPlus, UserMinus, Check } from 'lucide-react';

type GroupForm = {
  name: string;
  description: string;
  color: string;
  permissions: Record<string, boolean>;
};

const EMPTY_FORM: GroupForm = {
  name: '',
  description: '',
  color: '#6366f1',
  permissions: {},
};

function PermissionEditor({
  permissions,
  onToggle,
  onToggleSection,
}: {
  permissions: Record<string, boolean>;
  onToggle: (permissionKey: string) => void;
  onToggleSection: (groupId: string, checked: boolean) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs text-slate-300">Permissoes detalhadas</p>
        <p className="text-[11px] text-slate-500">
          Estas permissoes controlam exatamente o que os membros deste grupo podem acessar no sistema.
        </p>
      </div>

      <div className="space-y-3">
        {PERMISSION_GROUPS.map((permissionGroup) => {
          const total = permissionGroup.permissions.length;
          const selected = permissionGroup.permissions.filter((permission) => permissions[permission.key]).length;
          const allChecked = total > 0 && selected === total;

          return (
            <div key={permissionGroup.id} className="rounded-2xl border border-vault-700/30 bg-vault-950/30 p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-100">{permissionGroup.label}</p>
                  <p className="text-[11px] text-slate-500">
                    {selected} de {total} marcadas
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleSection(permissionGroup.id, !allChecked)}
                  className={
                    'rounded-lg border px-3 py-1.5 text-[11px] transition-colors ' +
                    (allChecked
                      ? 'border-vault-500/40 bg-vault-600/20 text-vault-200'
                      : 'border-vault-700/30 text-slate-400 hover:border-vault-500/30 hover:text-slate-200')
                  }
                >
                  {allChecked ? 'Desmarcar bloco' : 'Marcar bloco'}
                </button>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                {permissionGroup.permissions.map((permission) => {
                  const checked = !!permissions[permission.key];

                  return (
                    <label
                      key={permission.key}
                      className={
                        'flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition-colors ' +
                        (checked
                          ? 'border-vault-500/40 bg-vault-600/15'
                          : 'border-vault-700/20 bg-vault-900/20 hover:border-vault-600/30 hover:bg-vault-900/35')
                      }
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggle(permission.key)}
                        className="mt-0.5 rounded"
                      />
                      <div className="min-w-0">
                        <p className="text-sm text-slate-100">{permission.label}</p>
                        <p className="mt-1 text-[10px] font-mono text-slate-500">{permission.key}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Groups() {
  const [groups, setGroups] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState<any>(null);
  const [showDelete, setShowDelete] = useState<any>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [showMembers, setShowMembers] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [removingMember, setRemovingMember] = useState<string | null>(null);
  const [form, setForm] = useState<GroupForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    load();
    loadUsers();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get('/groups');
      setGroups((data.groups || []).map((group: any) => ({ ...group, permissions: normalizePermissionMap(group.permissions) })));
    } catch {
    } finally {
      setLoading(false);
    }
  }

  async function loadUsers() {
    try {
      const data = await api.get('/admin/users');
      setAllUsers(data.users || []);
    } catch {
    }
  }

  function resetForm() {
    setForm(EMPTY_FORM);
  }

  function openCreate() {
    resetForm();
    setShowCreate(true);
  }

  function openEdit(group: any) {
    setForm({
      name: group.name,
      description: group.description || '',
      color: group.color || '#6366f1',
      permissions: normalizePermissionMap(group.permissions),
    });
    setShowEdit(group);
  }

  function togglePermission(permissionKey: string) {
    setForm((current) => ({
      ...current,
      permissions: current.permissions[permissionKey]
        ? Object.fromEntries(Object.entries(current.permissions).filter(([key]) => key !== permissionKey))
        : { ...current.permissions, [permissionKey]: true },
    }));
  }

  function togglePermissionSection(groupId: string, checked: boolean) {
    const permissionGroup = PERMISSION_GROUPS.find((item) => item.id === groupId);
    if (!permissionGroup) return;

    setForm((current) => {
      const next = { ...current.permissions };

      permissionGroup.permissions.forEach((permission) => {
        if (checked) next[permission.key] = true;
        else delete next[permission.key];
      });

      return { ...current, permissions: next };
    });
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);

    try {
      await api.post('/groups', form);
      setShowCreate(false);
      resetForm();
      msg('Grupo criado com sucesso.');
      load();
    } catch (error: any) {
      msg(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);

    try {
      await api.put('/groups/' + showEdit.id, form);
      setShowEdit(null);
      msg('Grupo atualizado com sucesso.');
      load();
    } catch (error: any) {
      msg(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteConfirm(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);

    try {
      await api.del('/groups/' + showDelete.id);
      setShowDelete(null);
      setDeleteConfirmName('');
      msg('Grupo excluido.');
      load();
    } catch (error: any) {
      msg(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function openMembers(group: any) {
    setShowMembers({ ...group, permissions: normalizePermissionMap(group.permissions) });
    setMembersLoading(true);
    setShowAddMember(false);

    try {
      const data = await api.get('/groups/' + group.id + '/members');
      setMembers(data.members || []);
    } catch {
    } finally {
      setMembersLoading(false);
    }
  }

  async function removeMember(userId: string, userName: string) {
    if (!showMembers) return;
    if (!confirm('Remover "' + userName + '" do grupo "' + showMembers.name + '"?')) return;

    setRemovingMember(userId);

    try {
      const memberIds = members.filter((member) => member.id !== userId).map((member) => member.id);
      await api.put('/groups/' + showMembers.id, {
        name: showMembers.name,
        description: showMembers.description,
        color: showMembers.color,
        permissions: normalizePermissionMap(showMembers.permissions),
        member_ids: memberIds,
      });
      setMembers((current) => current.filter((member) => member.id !== userId));
      msg(userName + ' removido do grupo.');
      load();
    } catch (error: any) {
      msg(error.message);
    } finally {
      setRemovingMember(null);
    }
  }

  async function addMember(userId: string) {
    if (!showMembers) return;

    try {
      const memberIds = [...members.map((member) => member.id), userId];
      await api.put('/groups/' + showMembers.id, {
        name: showMembers.name,
        description: showMembers.description,
        color: showMembers.color,
        permissions: normalizePermissionMap(showMembers.permissions),
        member_ids: memberIds,
      });

      const user = allUsers.find((item) => item.id === userId);
      if (user) setMembers((current) => [...current, user]);

      setShowAddMember(false);
      msg('Membro adicionado ao grupo.');
      load();
    } catch (error: any) {
      msg(error.message);
    }
  }

  function msg(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 3500);
  }

  function getPermissionSummary(permissions: Record<string, boolean>) {
    const labels = PERMISSION_GROUPS.flatMap((group) =>
      group.permissions.filter((permission) => permissions[permission.key]).map((permission) => permission.label)
    );

    if (labels.length === 0) return 'Sem permissoes detalhadas configuradas';
    if (labels.length <= 2) return labels.join(' • ');
    return labels.slice(0, 2).join(' • ') + ' +' + (labels.length - 2);
  }

  const nonMembers = allUsers.filter((user) => !members.some((member) => member.id === user.id));

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 size={32} className="animate-spin text-vault-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Grupos</h1>
          <p className="text-sm text-slate-500">As permissoes do sistema passam pelos grupos. Configure cada acesso aqui.</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-xl bg-vault-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-vault-500"
        >
          <Plus size={16} /> Novo Grupo
        </button>
      </div>

      <div className="space-y-3">
        {groups.map((group) => {
          const permissions = normalizePermissionMap(group.permissions);
          const permissionCount = Object.keys(permissions).length;

          return (
            <div key={group.id} className="glass rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => openMembers(group)}
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: (group.color || '#6366f1') + '20' }}
                  title="Ver membros"
                >
                  <Shield size={18} style={{ color: group.color || '#6366f1' }} />
                </button>

                <div className="min-w-0 flex-1 cursor-pointer" onClick={() => openMembers(group)}>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-100 hover:text-vault-300">{group.name}</h3>
                    <span className="rounded-full bg-vault-700/30 px-2 py-0.5 text-[10px] text-vault-200">
                      {group.member_count || 0} membro(s)
                    </span>
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
                      {permissionCount} permissao(oes)
                    </span>
                  </div>

                  {group.description && <p className="mt-1 text-xs text-slate-500">{group.description}</p>}
                </div>

                <div className="flex gap-1">
                  <button
                    onClick={() => openEdit(group)}
                    className="rounded-lg p-2 text-slate-500 hover:bg-vault-800/50 hover:text-vault-300"
                    title="Editar grupo"
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    onClick={() => {
                      setShowDelete(group);
                      setDeleteConfirmName('');
                    }}
                    className="rounded-lg p-2 text-slate-500 hover:bg-red-500/10 hover:text-red-400"
                    title="Excluir grupo"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {groups.length === 0 && (
          <div className="glass rounded-2xl px-6 py-16 text-center text-slate-500">
            <Shield size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhum grupo criado ainda.</p>
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowCreate(false)}>
          <div
            className="glass max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl shadow-2xl animate-in"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-vault-700/30 p-5">
              <h2 className="font-semibold">Novo Grupo</h2>
              <button onClick={() => setShowCreate(false)} className="p-1">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-5 p-5">
              <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Nome *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    className="w-full rounded-xl border border-vault-700/30 bg-vault-900/50 px-3 py-2.5 text-sm focus:border-vault-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Cor</label>
                  <input
                    type="color"
                    value={form.color}
                    onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))}
                    className="h-11 w-14 cursor-pointer rounded-xl bg-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs text-slate-400">Descricao</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  className="w-full rounded-xl border border-vault-700/30 bg-vault-900/50 px-3 py-2.5 text-sm focus:border-vault-500 focus:outline-none"
                  placeholder="Ex.: Tecnicos da infraestrutura"
                />
              </div>

              <PermissionEditor
                permissions={form.permissions}
                onToggle={togglePermission}
                onToggleSection={togglePermissionSection}
              />

              <button
                type="submit"
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-vault-600 py-3 text-sm font-medium text-white hover:bg-vault-500 disabled:opacity-50"
              >
                {saving && <Loader2 size={16} className="animate-spin" />} Criar Grupo
              </button>
            </form>
          </div>
        </div>
      )}

      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowEdit(null)}>
          <div
            className="glass max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl shadow-2xl animate-in"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-vault-700/30 p-5">
              <h2 className="font-semibold">Editar Grupo</h2>
              <button onClick={() => setShowEdit(null)} className="p-1">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEdit} className="space-y-5 p-5">
              <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Nome *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    className="w-full rounded-xl border border-vault-700/30 bg-vault-900/50 px-3 py-2.5 text-sm focus:border-vault-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Cor</label>
                  <input
                    type="color"
                    value={form.color}
                    onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))}
                    className="h-11 w-14 cursor-pointer rounded-xl bg-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs text-slate-400">Descricao</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  className="w-full rounded-xl border border-vault-700/30 bg-vault-900/50 px-3 py-2.5 text-sm focus:border-vault-500 focus:outline-none"
                />
              </div>

              <PermissionEditor
                permissions={form.permissions}
                onToggle={togglePermission}
                onToggleSection={togglePermissionSection}
              />

              <button
                type="submit"
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-vault-600 py-3 text-sm font-medium text-white hover:bg-vault-500 disabled:opacity-50"
              >
                {saving && <Loader2 size={16} className="animate-spin" />} Salvar Alteracoes
              </button>
            </form>
          </div>
        </div>
      )}

      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowDelete(null)}>
          <div className="glass w-full max-w-md rounded-2xl shadow-2xl animate-in" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-red-500/30 p-5">
              <h2 className="font-semibold text-red-400">Excluir Grupo</h2>
              <button onClick={() => setShowDelete(null)} className="p-1">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleDeleteConfirm} className="space-y-4 p-5">
              <div className="flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3">
                <AlertTriangle size={20} className="flex-shrink-0 text-red-400" />
                <p className="text-sm text-red-300">
                  O grupo <strong>{showDelete.name}</strong> sera excluido. As senhas nao serao apagadas.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs text-slate-400">Digite o nome do grupo para confirmar</label>
                <p className="mb-2 font-mono text-xs text-slate-500">{showDelete.name}</p>
                <input
                  type="text"
                  value={deleteConfirmName}
                  onChange={(event) => setDeleteConfirmName(event.target.value)}
                  className="w-full rounded-xl border border-red-500/30 bg-vault-900/50 px-3 py-2.5 text-sm focus:border-red-500 focus:outline-none"
                  placeholder="Nome do grupo"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={saving || deleteConfirmName !== showDelete.name}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-30"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Excluir Grupo
              </button>
            </form>
          </div>
        </div>
      )}

      {showMembers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowMembers(null)}>
          <div
            className="glass max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl shadow-2xl animate-in"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-vault-700/30 p-5">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{ backgroundColor: (showMembers.color || '#6366f1') + '20' }}
                >
                  <Shield size={15} style={{ color: showMembers.color || '#6366f1' }} />
                </div>
                <div>
                  <h2 className="font-semibold">{showMembers.name}</h2>
                  <p className="text-[10px] text-slate-500">{members.length} membro(s)</p>
                </div>
              </div>
              <button onClick={() => setShowMembers(null)} className="p-1">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="rounded-xl border border-vault-700/20 bg-vault-950/20 p-3">
                <p className="mb-2 flex items-center gap-2 text-xs text-slate-400">
                  <Check size={12} /> Permissoes ativas neste grupo
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(normalizePermissionMap(showMembers.permissions)).length === 0 ? (
                    <span className="text-xs text-slate-500">Nenhuma permissao detalhada configurada.</span>
                  ) : (
                    PERMISSION_GROUPS.flatMap((permissionGroup) =>
                      permissionGroup.permissions
                        .filter((permission) => showMembers.permissions?.[permission.key])
                        .map((permission) => (
                          <span key={permission.key} className="rounded-full bg-vault-700/30 px-2 py-1 text-[10px] text-vault-200">
                            {permission.label}
                          </span>
                        ))
                    )
                  )}
                </div>
              </div>

              {membersLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 size={24} className="animate-spin text-vault-400" />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {members.length === 0 ? (
                      <p className="py-4 text-center text-sm text-slate-500">Nenhum membro neste grupo.</p>
                    ) : (
                      members.map((member) => (
                        <div key={member.id} className="flex items-center gap-3 rounded-xl bg-vault-900/30 p-2.5">
                          {member.avatar_url ? (
                            <img src={member.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                          ) : (
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-vault-600 text-xs font-bold text-white">
                              {(member.display_name || member.full_name)?.charAt(0)?.toUpperCase()}
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-medium">{member.display_name || member.full_name}</p>
                              <span className={'rounded-full px-2 py-0.5 text-[10px] ' + getRoleBadgeClass(member.role)}>
                                {getRoleLabel(member.role)}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500">{member.email}</p>
                          </div>

                          <button
                            onClick={() => removeMember(member.id, member.display_name || member.full_name)}
                            disabled={removingMember === member.id}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-400"
                            title="Remover do grupo"
                          >
                            {removingMember === member.id ? <Loader2 size={14} className="animate-spin" /> : <UserMinus size={14} />}
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {!showAddMember ? (
                    <button
                      onClick={() => setShowAddMember(true)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-vault-700/30 py-2.5 text-sm text-vault-400 hover:border-vault-500/30 hover:bg-vault-800/30"
                    >
                      <UserPlus size={14} /> Adicionar membro
                    </button>
                  ) : (
                    <div className="space-y-2 rounded-xl border border-vault-700/30 p-3">
                      <p className="text-xs text-slate-400">Selecione um usuario para incluir</p>
                      <div className="max-h-44 space-y-1 overflow-y-auto">
                        {nonMembers.length === 0 ? (
                          <p className="py-2 text-center text-xs text-slate-500">Todos os usuarios ja participam deste grupo.</p>
                        ) : (
                          nonMembers.map((user) => (
                            <button
                              key={user.id}
                              onClick={() => addMember(user.id)}
                              className="flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm hover:bg-vault-800/30"
                            >
                              <UserPlus size={12} className="flex-shrink-0 text-vault-400" />
                              <span className="truncate">{user.display_name || user.full_name}</span>
                              <span className="ml-auto text-[10px] text-slate-500">{user.email}</span>
                            </button>
                          ))
                        )}
                      </div>
                      <button onClick={() => setShowAddMember(false)} className="text-xs text-slate-500 hover:text-slate-300">
                        Cancelar
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast-enter fixed bottom-24 right-6 z-50 rounded-xl px-4 py-3 text-sm shadow-xl glass lg:bottom-6">{toast}</div>}
    </div>
  );
}
