import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { getRoleBadgeClass, getRoleLabel, hasPermission } from '../lib/access';
import { Inbox, Plus, Loader2, X, CheckCircle2, XCircle, Clock, Send } from 'lucide-react';

export default function PasswordRequests() {
  const { user } = useAuth();
  const canManageRequests = hasPermission(user, 'password_requests.manage');
  const [requests, setRequests] = useState<any[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showResolve, setShowResolve] = useState<any>(null);
  const [form, setForm] = useState({
    system_name: '',
    url: '',
    username: '',
    notes: '',
    category_id: '',
    organization_id: '',
    assigned_to: [] as string[],
  });
  const [resolveForm, setResolveForm] = useState({ status: 'approved', admin_notes: '' });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);

    try {
      const [requestData, adminData, orgData, categoryData] = await Promise.all([
        api.get('/password-requests'),
        api.get('/password-requests/admins'),
        api.get('/organizations'),
        api.get('/admin/categories'),
      ]);

      setRequests(requestData.requests || []);
      setAdmins(adminData.admins || []);
      setOrgs(orgData.organizations || []);
      setCategories(categoryData.categories || []);
    } catch {
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);

    try {
      await api.post('/password-requests', form);
      setShowCreate(false);
      setForm({
        system_name: '',
        url: '',
        username: '',
        notes: '',
        category_id: '',
        organization_id: '',
        assigned_to: [],
      });
      msg('Solicitacao enviada.');
      load();
    } catch (error: any) {
      msg(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleResolve(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);

    try {
      await api.put('/password-requests/' + showResolve.id, resolveForm);
      setShowResolve(null);
      msg('Solicitacao ' + (resolveForm.status === 'approved' ? 'aprovada.' : 'rejeitada.'));
      load();
    } catch (error: any) {
      msg(error.message);
    } finally {
      setSaving(false);
    }
  }

  function toggleAdmin(id: string) {
    setForm((current) => ({
      ...current,
      assigned_to: current.assigned_to.includes(id)
        ? current.assigned_to.filter((item) => item !== id)
        : [...current.assigned_to, id],
    }));
  }

  function msg(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }

  const statusColors: any = {
    pending: 'text-amber-400 bg-amber-500/10',
    approved: 'text-green-400 bg-green-500/10',
    rejected: 'text-red-400 bg-red-500/10',
  };
  const statusLabels: any = { pending: 'Pendente', approved: 'Aprovada', rejected: 'Rejeitada' };

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
          <h1 className="text-xl font-bold">Solicitacoes de Senhas</h1>
          <p className="text-sm text-slate-500">{requests.length} solicitacao(oes)</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-xl bg-vault-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-vault-500"
        >
          <Plus size={16} /> Nova Solicitacao
        </button>
      </div>

      <div className="space-y-3">
        {requests.map((request) => (
          <div
            key={request.id}
            className="glass rounded-xl p-4"
            onClick={() =>
              canManageRequests && request.status === 'pending'
                ? (setShowResolve(request), setResolveForm({ status: 'approved', admin_notes: '' }))
                : null
            }
          >
            <div className="flex items-start gap-3">
              <div className={'flex h-10 w-10 items-center justify-center rounded-xl ' + (statusColors[request.status] || '')}>
                {request.status === 'pending' ? (
                  <Clock size={18} />
                ) : request.status === 'approved' ? (
                  <CheckCircle2 size={18} />
                ) : (
                  <XCircle size={18} />
                )}
              </div>

              <div className="flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <h3 className="text-sm font-semibold">{request.system_name}</h3>
                  <span className={'rounded-full px-2 py-0.5 text-[10px] ' + (statusColors[request.status] || '')}>
                    {statusLabels[request.status]}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Solicitado por <span className="text-slate-300">{request.requester_name}</span>
                </p>
                {request.url && <p className="mt-1 text-xs text-slate-600">URL: {request.url}</p>}
                {request.notes && <p className="mt-1 text-xs text-slate-600">{request.notes}</p>}
                {request.admin_notes && <p className="mt-1 text-xs text-amber-400">Obs: {request.admin_notes}</p>}
                <p className="mt-1 text-[10px] text-slate-600">{new Date(request.created_at).toLocaleString('pt-BR')}</p>
              </div>

              {canManageRequests && request.status === 'pending' && (
                <span className="cursor-pointer text-xs text-vault-400">Resolver -&gt;</span>
              )}
            </div>
          </div>
        ))}

        {requests.length === 0 && (
          <div className="py-16 text-center text-slate-500">
            <Inbox size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhuma solicitacao.</p>
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowCreate(false)}>
          <div
            className="glass max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl shadow-2xl animate-in"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-vault-700/30 p-5">
              <h2 className="font-semibold">Solicitar Cadastro de Senha</h2>
              <button onClick={() => setShowCreate(false)} className="p-1">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 p-5">
              <div>
                <label className="mb-1 block text-xs text-slate-400">Nome do Sistema *</label>
                <input
                  type="text"
                  value={form.system_name}
                  onChange={(event) => setForm((current) => ({ ...current, system_name: event.target.value }))}
                  className="w-full rounded-xl border border-vault-700/30 bg-vault-900/50 px-3 py-2.5 text-sm focus:border-vault-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-slate-400">Categoria</label>
                <select
                  value={form.category_id}
                  onChange={(event) => setForm((current) => ({ ...current, category_id: event.target.value }))}
                  className="w-full rounded-xl border border-vault-700/30 bg-vault-900/50 px-3 py-2.5 text-sm focus:border-vault-500 focus:outline-none"
                >
                  <option value="">Selecione</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs text-slate-400">URL</label>
                <input
                  type="text"
                  value={form.url}
                  onChange={(event) => setForm((current) => ({ ...current, url: event.target.value }))}
                  className="w-full rounded-xl border border-vault-700/30 bg-vault-900/50 px-3 py-2.5 text-sm focus:border-vault-500 focus:outline-none"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-slate-400">Usuario / Login</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
                  className="w-full rounded-xl border border-vault-700/30 bg-vault-900/50 px-3 py-2.5 text-sm focus:border-vault-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-slate-400">Observacoes</label>
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  className="w-full resize-none rounded-xl border border-vault-700/30 bg-vault-900/50 px-3 py-2.5 text-sm focus:border-vault-500 focus:outline-none"
                  rows={3}
                />
              </div>

              {orgs.length > 0 && (
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Local / Organizacao</label>
                  <select
                    value={form.organization_id}
                    onChange={(event) => setForm((current) => ({ ...current, organization_id: event.target.value }))}
                    className="w-full rounded-xl border border-vault-700/30 bg-vault-900/50 px-3 py-2.5 text-sm focus:border-vault-500 focus:outline-none"
                  >
                    <option value="">Nenhum</option>
                    {orgs.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="mb-2 block text-xs text-slate-400">Encaminhar para *</label>
                <div className="space-y-1">
                  {admins.map((admin) => (
                    <label
                      key={admin.id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-vault-800/30"
                    >
                      <input
                        type="checkbox"
                        checked={form.assigned_to.includes(admin.id)}
                        onChange={() => toggleAdmin(admin.id)}
                        className="rounded"
                      />
                      <span className="min-w-0 flex-1 truncate">{admin.display_name || admin.full_name}</span>
                      <span className={'rounded-full px-2 py-0.5 text-[10px] ' + getRoleBadgeClass(admin.role)}>
                        {getRoleLabel(admin.role)}
                      </span>
                    </label>
                  ))}
                </div>
                {admins.length === 0 && <p className="text-xs text-slate-500">Nenhum responsavel disponivel.</p>}
              </div>

              <button
                type="submit"
                disabled={saving || !form.system_name || form.assigned_to.length === 0}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-vault-600 py-3 text-sm font-medium text-white hover:bg-vault-500 disabled:opacity-50"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Enviar Solicitacao
              </button>
            </form>
          </div>
        </div>
      )}

      {showResolve && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowResolve(null)}>
          <div className="glass w-full max-w-md rounded-2xl shadow-2xl animate-in" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-vault-700/30 p-5">
              <h2 className="font-semibold">Resolver Solicitacao</h2>
              <button onClick={() => setShowResolve(null)} className="p-1">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleResolve} className="space-y-4 p-5">
              <div className="rounded-lg bg-vault-900/40 p-3">
                <p className="text-sm font-medium">{showResolve.system_name}</p>
                <p className="mt-1 text-xs text-slate-500">Solicitado por {showResolve.requester_name}</p>
                {showResolve.url && <p className="mt-1 text-xs text-slate-600">URL: {showResolve.url}</p>}
                {showResolve.notes && <p className="mt-1 text-xs text-slate-500">{showResolve.notes}</p>}
              </div>

              <div>
                <label className="mb-1 block text-xs text-slate-400">Decisao</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setResolveForm((current) => ({ ...current, status: 'approved' }))}
                    className={
                      'flex-1 rounded-xl border py-2.5 text-sm font-medium ' +
                      (resolveForm.status === 'approved'
                        ? 'border-green-500/40 bg-green-500/20 text-green-400'
                        : 'border-vault-700/30 text-slate-500')
                    }
                  >
                    Aprovar
                  </button>
                  <button
                    type="button"
                    onClick={() => setResolveForm((current) => ({ ...current, status: 'rejected' }))}
                    className={
                      'flex-1 rounded-xl border py-2.5 text-sm font-medium ' +
                      (resolveForm.status === 'rejected'
                        ? 'border-red-500/40 bg-red-500/20 text-red-400'
                        : 'border-vault-700/30 text-slate-500')
                    }
                  >
                    Rejeitar
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs text-slate-400">Observacoes</label>
                <textarea
                  value={resolveForm.admin_notes}
                  onChange={(event) => setResolveForm((current) => ({ ...current, admin_notes: event.target.value }))}
                  className="w-full resize-none rounded-xl border border-vault-700/30 bg-vault-900/50 px-3 py-2.5 text-sm focus:border-vault-500 focus:outline-none"
                  rows={2}
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className={
                  'flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium text-white disabled:opacity-50 ' +
                  (resolveForm.status === 'approved' ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500')
                }
              >
                {saving && <Loader2 size={16} className="animate-spin" />}
                {resolveForm.status === 'approved' ? 'Aprovar' : 'Rejeitar'}
              </button>
            </form>
          </div>
        </div>
      )}

      {toast && <div className="toast-enter fixed bottom-24 right-6 z-50 rounded-xl px-4 py-3 text-sm shadow-xl glass lg:bottom-6">{toast}</div>}
    </div>
  );
}
