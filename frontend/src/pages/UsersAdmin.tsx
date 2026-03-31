import React, { useState, useEffect } from 'react';
import OrganizationTreeSelect from '../components/OrganizationTreeSelect';
import { api } from '../lib/api';
import { getRoleBadgeClass, getRoleLabel, ROLE_OPTIONS } from '../lib/access';
import type { OrgNode } from '../lib/organizations';
import { Users, Plus, Power, KeyRound, Loader2, X, Eye, EyeOff, Trash2, Clock, Activity, AlertTriangle, Calendar, Edit3, FolderOpen, Building2 } from 'lucide-react';

const DAYS = [
  { value: '0', label: 'Dom' }, { value: '1', label: 'Seg' }, { value: '2', label: 'Ter' },
  { value: '3', label: 'Qua' }, { value: '4', label: 'Qui' }, { value: '5', label: 'Sex' }, { value: '6', label: 'Sáb' },
];
const AL: any = { LOGIN:'fez login', LOGOUT:'saiu', PASSWORD_VIEWED:'visualizou senha', PASSWORD_CREATED:'criou senha', PASSWORD_CHANGED:'alterou senha', PASSWORD_SELF_CHANGED:'trocou própria senha', USER_CREATED:'criou usuário', '2FA_ENABLED':'ativou 2FA', PROFILE_UPDATED:'atualizou perfil', TERM_ACCEPTED:'aceitou termo' };

export default function UsersAdmin() {
  const [users, setUsers] = useState<any[]>([]); const [groups, setGroups] = useState<any[]>([]);
  const [orgTree, setOrgTree] = useState<OrgNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false); const [showReset, setShowReset] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState<any>(null); const [showDetails, setShowDetails] = useState<any>(null);
  const [detailsLogs, setDetailsLogs] = useState<any[]>([]); const [detailsGroups, setDetailsGroups] = useState<any[]>([]);
  const [detailsOrgs, setDetailsOrgs] = useState<any[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', password: '', password_expires_days: '90', role: 'user', group_ids: [] as string[], organization_ids: [] as string[], allowed_days: ['1','2','3','4','5'], allowed_time_start: '08:00', allowed_time_end: '18:00' });
  const [resetPw, setResetPw] = useState(''); const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('');
  const [showEdit, setShowEdit] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false); const [toast, setToast] = useState<string | null>(null); const [showPw, setShowPw] = useState(false);
  const [restrictSchedule, setRestrictSchedule] = useState(false);
  const [editRestrictSchedule, setEditRestrictSchedule] = useState(false);

  useEffect(() => { load(); loadGroups(); loadOrgs(); }, []);

  async function load() { setLoading(true); try { const d = await api.get('/admin/users'); setUsers(d.users); } catch {} finally { setLoading(false); } }
  async function loadGroups() { try { const d = await api.get('/groups'); setGroups(d.groups); } catch {} }
  async function loadOrgs() { try { const d = await api.get('/organizations/tree'); setOrgTree(d.tree || []); } catch {} }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      await api.post('/admin/users', {
        ...form, password_expires_days: parseInt(form.password_expires_days) || 90,
        allowed_days: form.allowed_days.join(','), restrict_schedule: restrictSchedule,
      });
      setShowCreate(false); resetForm(); msg('Usuário criado!'); load();
    } catch (err: any) { msg(err.message); } finally { setSaving(false); }
  }

  function resetForm() {
    setForm({ full_name: '', email: '', password: '', password_expires_days: '90', role: 'user', group_ids: [], organization_ids: [], allowed_days: ['1','2','3','4','5'], allowed_time_start: '08:00', allowed_time_end: '18:00' });
    setRestrictSchedule(false);
  }

  async function openEditUser(u: any) {
    const isRestricted = u.allowed_days !== '0,1,2,3,4,5,6' || u.allowed_time_start !== '00:00' || u.allowed_time_end !== '23:59';
    setEditRestrictSchedule(isRestricted);
    try {
      const d = await api.get('/admin/users/' + u.id + '/details');
      setEditForm({ id: u.id, full_name: u.full_name, role: u.role, password_expires_days: String(u.password_expires_days || 90),
        allowed_days: (u.allowed_days || '1,2,3,4,5').split(','), allowed_time_start: u.allowed_time_start || '08:00', allowed_time_end: u.allowed_time_end || '18:00',
        group_ids: (d.groups || []).map((g: any) => g.id),
        organization_ids: (d.organizations || []).map((o: any) => o.id),
      });
    } catch {
      setEditForm({ id: u.id, full_name: u.full_name, role: u.role, password_expires_days: String(u.password_expires_days || 90),
        allowed_days: (u.allowed_days || '1,2,3,4,5').split(','), allowed_time_start: u.allowed_time_start || '08:00', allowed_time_end: u.allowed_time_end || '18:00', group_ids: [], organization_ids: [] });
    }
    setShowEdit(u);
  }

  async function handleEditUser(e: React.FormEvent) {
    e.preventDefault();
    if (!confirm('Confirma as alterações neste usuário?')) return;
    setSaving(true);
    try {
      await api.put('/admin/users/' + editForm.id, {
        full_name: editForm.full_name, role: editForm.role,
        password_expires_days: parseInt(editForm.password_expires_days) || 90,
        restrict_schedule: editRestrictSchedule,
        allowed_days: editForm.allowed_days.join(','),
        allowed_time_start: editForm.allowed_time_start,
        allowed_time_end: editForm.allowed_time_end,
        group_ids: editForm.group_ids,
        organization_ids: editForm.organization_ids,
      });
      setShowEdit(null); msg('Usuário atualizado!'); load();
    } catch (err: any) { msg(err.message); } finally { setSaving(false); }
  }

  function toggleEditDay(day: string) { setEditForm((f: any) => ({ ...f, allowed_days: f.allowed_days.includes(day) ? f.allowed_days.filter((d: string) => d !== day) : [...f.allowed_days, day] })); }
  function toggleEditGroup(gid: string) { setEditForm((f: any) => ({ ...f, group_ids: f.group_ids.includes(gid) ? f.group_ids.filter((id: string) => id !== gid) : [...f.group_ids, gid] })); }
  function toggleEditOrg(oid: string) { setEditForm((f: any) => ({ ...f, organization_ids: (f.organization_ids || []).includes(oid) ? f.organization_ids.filter((id: string) => id !== oid) : [...(f.organization_ids || []), oid] })); }

  async function toggleUser(id: string) { try { await api.put('/admin/users/' + id + '/toggle'); load(); } catch {} }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try { await api.put('/admin/users/' + showReset + '/reset-password', { password: resetPw }); setShowReset(null); setResetPw(''); msg('Senha redefinida!'); }
    catch (err: any) { msg(err.message); } finally { setSaving(false); }
  }

  async function handleDeleteConfirm(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/users/' + showDelete.id, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ confirm_email: deleteConfirmEmail }),
      });
      const data = await res.json(); if (!res.ok) throw new Error(data.error);
      setShowDelete(null); setDeleteConfirmEmail(''); msg('Usuário excluído!'); load();
    } catch (err: any) { msg(err.message); } finally { setSaving(false); }
  }

  async function openDetails(u: any) {
    setShowDetails(u); setDetailsLoading(true);
    try { const d = await api.get('/admin/users/' + u.id + '/details'); setShowDetails(d.user); setDetailsLogs(d.logs); setDetailsGroups(d.groups || []); setDetailsOrgs(d.organizations || []); }
    catch {} finally { setDetailsLoading(false); }
  }

  function msg(m: string) { setToast(m); setTimeout(() => setToast(null), 4000); }
  function fmtDate(d: string | null) { if (!d) return 'Nunca'; try { return new Date(d).toLocaleString('pt-BR'); } catch { return d || ''; } }
  function fmtAccessPeriod(u: any) {
    const days = u.allowed_days || '';
    const start = u.allowed_time_start || '00:00';
    const end = u.allowed_time_end || '23:59';
    if (!days || (days === '0,1,2,3,4,5,6' && start === '00:00' && end === '23:59')) return 'Sem limitação definida';
    const dayLabels = days.split(',').map((d: string) => DAYS.find(day => day.value === d.trim())?.label || d).join(', ');
    return `Período: ${dayLabels} das ${start} às ${end}`;
  }
  function toggleDay(day: string) { setForm(f => ({ ...f, allowed_days: f.allowed_days.includes(day) ? f.allowed_days.filter(d => d !== day) : [...f.allowed_days, day] })); }
  function toggleGroup(gid: string) { setForm(f => ({ ...f, group_ids: f.group_ids.includes(gid) ? f.group_ids.filter(id => id !== gid) : [...f.group_ids, gid] })); }
  function toggleOrg(oid: string) { setForm(f => ({ ...f, organization_ids: f.organization_ids.includes(oid) ? f.organization_ids.filter(id => id !== oid) : [...f.organization_ids, oid] })); }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 size={32} className="animate-spin text-vault-400" /></div>;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Gerenciar Usuários</h1>
        <button onClick={() => { resetForm(); setShowCreate(true); }} className="flex items-center gap-2 bg-vault-600 hover:bg-vault-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium"><Plus size={16} /> Novo Usuário</button>
      </div>

      <div className="space-y-3">
        {users.map(u => (
          <div key={u.id} className="glass rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className={'w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm overflow-hidden ' + (u.is_active ? 'bg-vault-600/30 text-vault-300' : 'bg-red-500/10 text-red-400')}>
                {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-10 h-10 object-cover" /> : u.full_name?.charAt(0)?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openDetails(u)}>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm truncate hover:text-vault-300">{u.display_name || u.full_name}</p>
                  <span className={'text-[10px] px-2 py-0.5 rounded-full ' + getRoleBadgeClass(u.role)}>
                    {getRoleLabel(u.role)}
                  </span>
                </div>
                <p className="text-xs text-slate-500">{u.email}</p>
                <div className="flex flex-wrap items-center gap-3 mt-1 text-[10px] text-slate-600">
                  <span>2FA: {u.totp_enabled ? 'Ativo' : 'Inativo'}</span>
                  <span>Último Login: {fmtDate(u.last_login)}</span>
                  <span className="flex items-center gap-1"><Clock size={10} /> Senha expira em: {u.password_expires_days || 90} dias</span>
                  <span className="flex items-center gap-1"><Calendar size={10} /> {fmtAccessPeriod(u)}</span>
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => toggleUser(u.id)} title={u.is_active ? 'Desativar' : 'Ativar'} className={'p-2 rounded-lg ' + (u.is_active ? 'hover:bg-red-500/10 text-red-400' : 'hover:bg-green-500/10 text-green-400')}><Power size={16} /></button>
                <button onClick={() => openEditUser(u)} title="Editar" className="p-2 hover:bg-vault-800/50 rounded-lg text-slate-500 hover:text-vault-300"><Edit3 size={16} /></button>
                <button onClick={() => { setShowReset(u.id); setResetPw(''); }} title="Redefinir senha" className="p-2 hover:bg-vault-800/50 rounded-lg text-slate-500 hover:text-vault-300"><KeyRound size={16} /></button>
                {u.role !== 'admin' && u.role !== 'super_admin' && <button onClick={() => { setShowDelete(u); setDeleteConfirmEmail(''); }} title="Excluir" className="p-2 hover:bg-red-500/10 rounded-lg text-slate-500 hover:text-red-400"><Trash2 size={16} /></button>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Criar Usuário */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-lg glass rounded-2xl shadow-2xl animate-in max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-vault-700/30"><h2 className="font-semibold">Novo Usuário</h2><button onClick={() => setShowCreate(false)} className="p-1"><X size={18} /></button></div>
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              <div><label className="text-xs text-slate-400 mb-1 block">Nome Completo *</label>
                <input type="text" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-vault-500" required /></div>
              <div><label className="text-xs text-slate-400 mb-1 block">Email *</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-vault-500" required /></div>
              <div><label className="text-xs text-slate-400 mb-1 block">Tipo de Usuário *</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-vault-500 appearance-none">
                  {ROLE_OPTIONS.map(role => <option key={role.value} value={role.value}>{role.label}</option>)}
                </select></div>
              <div><label className="text-xs text-slate-400 mb-1 block">Senha Inicial *</label>
                <div className="relative"><input type={showPw ? 'text' : 'password'} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-3 py-2.5 pr-10 text-sm focus:outline-none focus:border-vault-500" required minLength={6} />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">{showPw ? <EyeOff size={14} /> : <Eye size={14} />}</button></div></div>
              <div><label className="text-xs text-slate-400 mb-1 block">Senha expira a cada (dias) *</label>
                <input type="number" value={form.password_expires_days} onChange={e => setForm(f => ({ ...f, password_expires_days: e.target.value }))} className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-vault-500" min={7} max={365} required /></div>

              {/* Grupos */}
              {groups.length > 0 && (
                <div><label className="text-xs text-slate-400 mb-1 block flex items-center gap-1"><FolderOpen size={12} /> Grupos</label>
                  <div className="flex flex-wrap gap-2">{groups.map(g => (
                    <button key={g.id} type="button" onClick={() => toggleGroup(g.id)}
                      className={'px-3 py-1.5 rounded-lg text-xs border transition-colors ' + (form.group_ids.includes(g.id) ? 'bg-vault-600/30 border-vault-500/50 text-vault-300' : 'border-vault-700/30 text-slate-500 hover:border-vault-600/30')}>{g.name}</button>
                  ))}</div></div>
              )}

              {/* Organizacoes */}
              {orgTree.length > 0 && (
                <div><label className="text-xs text-slate-400 mb-1 block flex items-center gap-1"><Building2 size={12} /> Locais da Organizacao</label>
                  <p className="text-[10px] text-slate-500 mb-2">Marque os locais onde este usuario esta vinculado</p>
                  <OrganizationTreeSelect tree={orgTree} selectedIds={form.organization_ids} onChange={(organization_ids) => setForm(f => ({ ...f, organization_ids }))} helperText="Esses locais determinam os vinculos do usuario no organograma." emptyText="Nenhum local vinculado ao usuario" /></div>
              )}

              {/* Horário de acesso */}
              <div><label className="flex items-center gap-2 cursor-pointer mb-2"><input type="checkbox" checked={restrictSchedule} onChange={() => setRestrictSchedule(!restrictSchedule)} className="rounded" /><span className="text-xs text-slate-400">Limitar dias e horários de acesso</span></label></div>
              {restrictSchedule && <><div><label className="text-xs text-slate-400 mb-1 block">Dias permitidos de acesso</label>
                <div className="flex gap-1">{DAYS.map(d => (
                  <button key={d.value} type="button" onClick={() => toggleDay(d.value)}
                    className={'flex-1 py-2 rounded-lg text-xs font-medium transition-colors ' + (form.allowed_days.includes(d.value) ? 'bg-vault-600/40 text-vault-300 border border-vault-500/30' : 'bg-vault-900/30 text-slate-600 border border-vault-700/20')}>{d.label}</button>
                ))}</div></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-slate-400 mb-1 block">Horário início</label><input type="time" value={form.allowed_time_start} onChange={e => setForm(f => ({ ...f, allowed_time_start: e.target.value }))} className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-vault-500" /></div>
                <div><label className="text-xs text-slate-400 mb-1 block">Horário fim</label><input type="time" value={form.allowed_time_end} onChange={e => setForm(f => ({ ...f, allowed_time_end: e.target.value }))} className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-vault-500" /></div>
              </div></>}
              <button type="submit" disabled={saving} className="w-full bg-vault-600 hover:bg-vault-500 text-white py-3 rounded-xl font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2">{saving && <Loader2 size={16} className="animate-spin" />} Criar Usuário</button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Reset */}
      {showReset && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowReset(null)}>
          <div className="w-full max-w-md glass rounded-2xl shadow-2xl animate-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-vault-700/30"><h2 className="font-semibold">Redefinir Senha</h2><button onClick={() => setShowReset(null)} className="p-1"><X size={18} /></button></div>
            <form onSubmit={handleReset} className="p-5 space-y-4">
              <p className="text-sm text-slate-400">O usuário deverá trocar no próximo acesso.</p>
              <input type="text" value={resetPw} onChange={e => setResetPw(e.target.value)} className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-vault-500" placeholder="Nova senha" required minLength={6} />
              <button type="submit" disabled={saving} className="w-full bg-vault-600 hover:bg-vault-500 text-white py-3 rounded-xl font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2">{saving && <Loader2 size={16} className="animate-spin" />} Redefinir</button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Excluir */}
      {showDelete && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowDelete(null)}>
          <div className="w-full max-w-md glass rounded-2xl shadow-2xl animate-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-red-500/30"><h2 className="font-semibold text-red-400">Excluir Usuário</h2><button onClick={() => setShowDelete(null)} className="p-1"><X size={18} /></button></div>
            <form onSubmit={handleDeleteConfirm} className="p-5 space-y-4">
              <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg"><AlertTriangle size={20} className="text-red-400 flex-shrink-0" /><p className="text-sm text-red-300">Ação irreversível. <strong>{showDelete.full_name}</strong> será excluído permanentemente.</p></div>
              <div><label className="text-xs text-slate-400 mb-1 block">Digite o email para confirmar:</label><p className="text-xs text-slate-500 mb-2 font-mono">{showDelete.email}</p>
                <input type="text" value={deleteConfirmEmail} onChange={e => setDeleteConfirmEmail(e.target.value)} className="w-full bg-vault-900/50 border border-red-500/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-500" placeholder="Digite o email aqui" required /></div>
              <button type="submit" disabled={saving || deleteConfirmEmail !== showDelete.email} className="w-full bg-red-600 hover:bg-red-500 text-white py-3 rounded-xl font-medium text-sm disabled:opacity-30 flex items-center justify-center gap-2">{saving ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Excluir Permanentemente</button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detalhes */}
      {showDetails && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowDetails(null)}>
          <div className="w-full max-w-lg glass rounded-2xl shadow-2xl animate-in max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-vault-700/30"><h2 className="font-semibold">Detalhes do Usuário</h2><button onClick={() => setShowDetails(null)} className="p-1"><X size={18} /></button></div>
            <div className="p-5">
              {detailsLoading ? <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-vault-400" /></div> : <>
                <div className="flex items-center gap-4 mb-5">
                  {showDetails.avatar_url ? <img src={showDetails.avatar_url} alt="" className="w-16 h-16 rounded-2xl object-cover" /> :
                    <div className="w-16 h-16 rounded-2xl bg-vault-600 flex items-center justify-center text-white font-bold text-2xl">{(showDetails.display_name || showDetails.full_name)?.charAt(0)?.toUpperCase()}</div>}
                  <div><h3 className="font-bold text-lg">{showDetails.display_name || showDetails.full_name}</h3><p className="text-sm text-slate-400">{showDetails.email}</p>
                    <span className={'text-[10px] px-2 py-0.5 rounded-full mt-1 inline-block ' + getRoleBadgeClass(showDetails.role)}>{getRoleLabel(showDetails.role)}</span></div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="bg-vault-900/40 rounded-lg p-3"><p className="text-[10px] text-slate-500">Status</p><p className={'text-sm font-medium ' + (showDetails.is_active ? 'text-green-400' : 'text-red-400')}>{showDetails.is_active ? 'Ativo' : 'Inativo'}</p></div>
                  <div className="bg-vault-900/40 rounded-lg p-3"><p className="text-[10px] text-slate-500">2FA</p><p className="text-sm font-medium">{showDetails.totp_enabled ? 'Ativo' : 'Inativo'}</p></div>
                  <div className="bg-vault-900/40 rounded-lg p-3"><p className="text-[10px] text-slate-500">Último Login</p><p className="text-sm font-medium">{fmtDate(showDetails.last_login)}</p></div>
                  <div className="bg-vault-900/40 rounded-lg p-3"><p className="text-[10px] text-slate-500">Expiração Senha</p><p className="text-sm font-medium">{showDetails.password_expires_days || 90} dias</p></div>
                  <div className="bg-vault-900/40 rounded-lg p-3"><p className="text-[10px] text-slate-500">Horário Acesso</p><p className="text-sm font-medium">{showDetails.allowed_time_start || '00:00'} - {showDetails.allowed_time_end || '23:59'}</p></div>
                  <div className="bg-vault-900/40 rounded-lg p-3"><p className="text-[10px] text-slate-500">Cadastrado em</p><p className="text-sm font-medium">{fmtDate(showDetails.created_at)}</p></div>
                </div>
                {detailsGroups.length > 0 && (<div className="mb-4"><p className="text-xs text-slate-500 mb-2 flex items-center gap-1"><FolderOpen size={12} /> Grupos</p><div className="flex flex-wrap gap-2">{detailsGroups.map((g: any, i: number) => <span key={i} className="text-xs px-2 py-1 bg-vault-800/50 rounded-lg">{g.name}</span>)}</div></div>)}
                {detailsOrgs.length > 0 && (<div className="mb-4"><p className="text-xs text-slate-500 mb-2 flex items-center gap-1"><Building2 size={12} /> Locais</p><div className="flex flex-wrap gap-2">{detailsOrgs.map((o: any, i: number) => <span key={i} className="text-xs px-2 py-1 bg-green-800/30 rounded-lg text-green-300">{o.name}</span>)}</div></div>)}
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2"><Activity size={14} /> Atividade Recente</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {detailsLogs.length === 0 ? <p className="text-sm text-slate-500 text-center py-4">Nenhuma atividade</p> :
                    detailsLogs.map((l: any) => (
                      <div key={l.id} className="flex items-start gap-2 p-2 bg-vault-900/30 rounded-lg">
                        <Activity size={12} className="text-vault-400 mt-0.5 flex-shrink-0" />
                        <div><p className="text-xs"><span className="text-vault-300">{AL[l.action] || l.action}</span>{l.resource_name && <span className="text-slate-400"> — {l.resource_name}</span>}</p>
                          <p className="text-[10px] text-slate-600">{fmtDate(l.created_at)} {l.ip_address ? '• ' + l.ip_address : ''}</p></div>
                      </div>
                    ))}
                </div>
              </>}
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Usuário */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowEdit(null)}>
          <div className="w-full max-w-lg glass rounded-2xl shadow-2xl animate-in max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-vault-700/30"><h2 className="font-semibold">Editar Usuário — {showEdit.full_name}</h2><button onClick={() => setShowEdit(null)} className="p-1"><X size={18} /></button></div>
            <form onSubmit={handleEditUser} className="p-5 space-y-4">
              <div><label className="text-xs text-slate-400 mb-1 block">Nome Completo</label>
                <input type="text" value={editForm.full_name || ''} onChange={e => setEditForm((f: any) => ({ ...f, full_name: e.target.value }))} className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-vault-500" required /></div>
              <div><label className="text-xs text-slate-400 mb-1 block">Tipo</label>
                <select value={editForm.role || 'user'} onChange={e => setEditForm((f: any) => ({ ...f, role: e.target.value }))} className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-vault-500 appearance-none">
                  {ROLE_OPTIONS.map(role => <option key={role.value} value={role.value}>{role.label}</option>)}
                </select></div>
              <div><label className="text-xs text-slate-400 mb-1 block">Senha expira a cada (dias)</label>
                <input type="number" value={editForm.password_expires_days || '90'} onChange={e => setEditForm((f: any) => ({ ...f, password_expires_days: e.target.value }))} className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-vault-500" min={7} max={365} /></div>

              {/* Grupos no editar */}
              {groups.length > 0 && (
                <div><label className="text-xs text-slate-400 mb-1 block flex items-center gap-1"><FolderOpen size={12} /> Grupos</label>
                  <div className="flex flex-wrap gap-2">{groups.map(g => (
                    <button key={g.id} type="button" onClick={() => toggleEditGroup(g.id)}
                      className={'px-3 py-1.5 rounded-lg text-xs border transition-colors ' + ((editForm.group_ids || []).includes(g.id) ? 'bg-vault-600/30 border-vault-500/50 text-vault-300' : 'border-vault-700/30 text-slate-500 hover:border-vault-600/30')}>{g.name}</button>
                  ))}</div></div>
              )}

              {/* Organizacoes no editar */}
              {orgTree.length > 0 && (
                <div><label className="text-xs text-slate-400 mb-1 block flex items-center gap-1"><Building2 size={12} /> Locais da Organizacao</label>
                  <OrganizationTreeSelect tree={orgTree} selectedIds={editForm.organization_ids || []} onChange={(organization_ids) => setEditForm((f: any) => ({ ...f, organization_ids }))} helperText="Atualize os locais para refletir o vinculo real do usuario no organograma." emptyText="Nenhum local vinculado ao usuario" /></div>
              )}

              <div><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={editRestrictSchedule} onChange={() => setEditRestrictSchedule(!editRestrictSchedule)} className="rounded" /><span className="text-xs text-slate-400">Limitar dias e horarios de acesso</span></label></div>
              {editRestrictSchedule && <>
                <div><label className="text-xs text-slate-400 mb-1 block">Dias permitidos</label>
                  <div className="flex gap-1">{DAYS.map(d => (
                    <button key={d.value} type="button" onClick={() => toggleEditDay(d.value)}
                      className={'flex-1 py-2 rounded-lg text-xs font-medium ' + ((editForm.allowed_days || []).includes(d.value) ? 'bg-vault-600/40 text-vault-300 border border-vault-500/30' : 'bg-vault-900/30 text-slate-600 border border-vault-700/20')}>{d.label}</button>
                  ))}</div></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-slate-400 mb-1 block">Inicio</label><input type="time" value={editForm.allowed_time_start || '08:00'} onChange={e => setEditForm((f: any) => ({ ...f, allowed_time_start: e.target.value }))} className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-vault-500" /></div>
                  <div><label className="text-xs text-slate-400 mb-1 block">Fim</label><input type="time" value={editForm.allowed_time_end || '18:00'} onChange={e => setEditForm((f: any) => ({ ...f, allowed_time_end: e.target.value }))} className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-vault-500" /></div>
                </div>
              </>}
              <button type="submit" disabled={saving} className="w-full bg-vault-600 hover:bg-vault-500 text-white py-3 rounded-xl font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2">{saving && <Loader2 size={16} className="animate-spin" />} Salvar Alterações</button>
            </form>
          </div>
        </div>
      )}

      {toast && <div className="fixed bottom-24 lg:bottom-6 right-6 glass px-4 py-3 rounded-xl text-sm toast-enter shadow-xl z-50">{toast}</div>}
    </div>
  );
}
