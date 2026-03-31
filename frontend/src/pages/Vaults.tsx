import React, { useEffect, useState } from 'react';
import { Lock, Plus, Users, Key, Shield, AlertTriangle, Loader2, X, Trash2, Edit2, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { hasPermission } from '../lib/access';
import { api } from '../lib/api';

export default function Vaults() {
  const { user } = useAuth();
  const canManage = hasPermission(user, 'vaults.manage');
  const [vaults, setVaults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', description: '', icon: 'lock', color: '#6366f1', organization_id: '' });
  const [orgs, setOrgs] = useState<any[]>([]);
  const [detail, setDetail] = useState<any>(null);
  const [detailData, setDetailData] = useState<any>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [memberUserId, setMemberUserId] = useState('');
  const [memberPerm, setMemberPerm] = useState('VIEW');
  const [showEmergency, setShowEmergency] = useState(false);
  const [emergencyReason, setEmergencyReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [v, o] = await Promise.all([api.get('/vaults'), api.get('/organizations')]);
      setVaults(v.vaults || []);
      setOrgs(o.organizations || o || []);
    } catch {} finally { setLoading(false); }
  }

  async function loadDetail(vault: any) {
    setDetail(vault);
    try {
      const data = await api.get('/vaults/' + vault.id);
      setDetailData(data);
    } catch {}
  }

  async function saveVault(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api.put('/vaults/' + editing.id, form);
      } else {
        await api.post('/vaults', form);
      }
      setShowForm(false);
      setEditing(null);
      setForm({ name: '', description: '', icon: 'lock', color: '#6366f1', organization_id: '' });
      load();
    } catch {} finally { setSaving(false); }
  }

  async function deleteVault(id: string) {
    if (!confirm('Excluir este cofre? As senhas serao desvinculadas.')) return;
    try { await api.del('/vaults/' + id); setDetail(null); setDetailData(null); load(); } catch {}
  }

  async function addMember() {
    if (!memberUserId || !detail) return;
    try {
      await api.post('/vaults/' + detail.id + '/members', { user_id: memberUserId, permission_level: memberPerm });
      setMemberUserId('');
      loadDetail(detail);
    } catch {}
  }

  async function removeMember(userId: string) {
    if (!detail) return;
    try { await api.del('/vaults/' + detail.id + '/members/' + userId); loadDetail(detail); } catch {}
  }

  async function requestEmergency() {
    if (!detail || !emergencyReason) return;
    try {
      await api.post('/vaults/' + detail.id + '/emergency', { reason: emergencyReason });
      setShowEmergency(false);
      setEmergencyReason('');
      loadDetail(detail);
    } catch {}
  }

  function openEdit(v: any) {
    setEditing(v);
    setForm({ name: v.name, description: v.description || '', icon: v.icon || 'lock', color: v.color || '#6366f1', organization_id: v.organization_id || '' });
    setShowForm(true);
  }

  async function loadUsers() {
    if (allUsers.length) return;
    try { const d = await api.get('/admin/users'); setAllUsers(d.users || d || []); } catch {}
  }

  const permLabels: Record<string, string> = { VIEW: 'Visualizar', USE_ONLY: 'Usar', EDIT: 'Editar', MANAGE: 'Gerenciar' };
  const permColors: Record<string, string> = { VIEW: 'bg-slate-500/20 text-slate-300', USE_ONLY: 'bg-blue-500/20 text-blue-300', EDIT: 'bg-amber-500/20 text-amber-300', MANAGE: 'bg-emerald-500/20 text-emerald-300' };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-vault-400" size={32} /></div>;

  // Detail view
  if (detail && detailData) {
    const v = detailData.vault;
    return (
      <div>
        <button onClick={() => { setDetail(null); setDetailData(null); }} className="flex items-center gap-1 text-sm text-slate-400 hover:text-white mb-4">
          <ChevronRight size={14} className="rotate-180" /> Voltar aos cofres
        </button>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: v.color + '20' }}>
              <Lock size={24} style={{ color: v.color }} />
            </div>
            <div>
              <h1 className="text-xl font-bold">{v.name}</h1>
              <p className="text-sm text-slate-400">{v.description || 'Sem descricao'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {!canManage && (
              <button onClick={() => setShowEmergency(true)} className="flex items-center gap-2 bg-red-600/20 hover:bg-red-600/30 text-red-300 px-3 py-2 rounded-lg text-sm">
                <AlertTriangle size={16} /> Acesso Emergencial
              </button>
            )}
            {canManage && (
              <button onClick={() => { loadUsers(); setShowMembers(true); }} className="flex items-center gap-2 bg-vault-600/20 hover:bg-vault-600/30 text-vault-300 px-3 py-2 rounded-lg text-sm">
                <Users size={16} /> Membros ({detailData.members?.length || 0})
              </button>
            )}
          </div>
        </div>

        {/* Senhas do cofre */}
        <div className="glass rounded-xl p-4 mb-6">
          <h2 className="font-semibold mb-3 flex items-center gap-2"><Key size={18} className="text-vault-400" /> Senhas ({detailData.passwords?.length || 0})</h2>
          {detailData.passwords?.length === 0 ? <p className="text-sm text-slate-500">Nenhuma senha neste cofre</p> : (
            <div className="space-y-2">
              {detailData.passwords.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between bg-vault-900/40 rounded-lg px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{p.system_name}</p>
                    <p className="text-xs text-slate-500">{p.username} {p.url ? '- ' + p.url : ''}</p>
                  </div>
                  {p.categories && <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: p.categories.color + '20', color: p.categories.color }}>{p.categories.name}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Membros */}
        <div className="glass rounded-xl p-4 mb-6">
          <h2 className="font-semibold mb-3 flex items-center gap-2"><Users size={18} className="text-vault-400" /> Membros</h2>
          <div className="space-y-2">
            {(detailData.members || []).map((m: any) => (
              <div key={m.id} className="flex items-center justify-between bg-vault-900/40 rounded-lg px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-vault-600 flex items-center justify-center text-white text-xs font-bold">
                    {(m.profiles?.display_name || m.profiles?.full_name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{m.profiles?.display_name || m.profiles?.full_name}</p>
                    <p className="text-xs text-slate-500">{m.profiles?.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={'text-xs px-2 py-1 rounded-full ' + (permColors[m.permission_level] || '')}>{permLabels[m.permission_level]}</span>
                  {canManage && m.user_id !== user?.id && (
                    <button onClick={() => removeMember(m.user_id)} className="text-red-400 hover:text-red-300 p-1"><Trash2 size={14} /></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Log de emergencia */}
        {detailData.emergencyLogs?.length > 0 && (
          <div className="glass rounded-xl p-4">
            <h2 className="font-semibold mb-3 flex items-center gap-2"><AlertTriangle size={18} className="text-amber-400" /> Acessos de Emergencia</h2>
            <div className="space-y-2">
              {detailData.emergencyLogs.map((e: any) => (
                <div key={e.id} className="bg-vault-900/40 rounded-lg px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm">{e.profiles?.display_name || e.profiles?.full_name} - <span className="text-slate-400">{e.reason}</span></p>
                    <p className="text-xs text-slate-500">{new Date(e.created_at).toLocaleString('pt-BR')}</p>
                  </div>
                  <span className={'text-xs px-2 py-1 rounded-full ' + (e.status === 'APPROVED' ? 'bg-green-500/20 text-green-300' : e.status === 'DENIED' ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300')}>{e.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal emergencia */}
        {showEmergency && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowEmergency(false)}>
            <div className="w-full max-w-md glass rounded-2xl p-6 animate-in" onClick={e => e.stopPropagation()}>
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><AlertTriangle className="text-red-400" size={20} /> Acesso de Emergencia</h3>
              <p className="text-sm text-slate-400 mb-4">Informe o motivo. Administradores serao notificados e esta acao sera registrada.</p>
              <textarea value={emergencyReason} onChange={e => setEmergencyReason(e.target.value)} placeholder="Motivo do acesso de emergencia..." className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm mb-4 min-h-[100px]" />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowEmergency(false)} className="px-4 py-2 text-sm text-slate-400">Cancelar</button>
                <button onClick={requestEmergency} disabled={!emergencyReason} className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">Solicitar</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal gerenciar membros */}
        {showMembers && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowMembers(false)}>
            <div className="w-full max-w-md glass rounded-2xl p-6 animate-in" onClick={e => e.stopPropagation()}>
              <h3 className="font-bold text-lg mb-4">Adicionar Membro</h3>
              <div className="space-y-3">
                <select value={memberUserId} onChange={e => setMemberUserId(e.target.value)} className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm">
                  <option value="">Selecionar usuario...</option>
                  {allUsers.filter((u: any) => !(detailData.members || []).find((m: any) => m.user_id === u.id)).map((u: any) => (
                    <option key={u.id} value={u.id}>{u.display_name || u.full_name} ({u.email})</option>
                  ))}
                </select>
                <select value={memberPerm} onChange={e => setMemberPerm(e.target.value)} className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm">
                  <option value="VIEW">Visualizar</option>
                  <option value="USE_ONLY">Usar</option>
                  <option value="EDIT">Editar</option>
                  <option value="MANAGE">Gerenciar</option>
                </select>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowMembers(false)} className="px-4 py-2 text-sm text-slate-400">Fechar</button>
                  <button onClick={addMember} disabled={!memberUserId} className="bg-vault-600 hover:bg-vault-500 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">Adicionar</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // List view
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3"><Lock className="text-vault-400" size={28} /> Cofres</h1>
          <p className="text-sm text-slate-400 mt-1">Gerencie cofres de senhas por departamento</p>
        </div>
        {canManage && (
          <button onClick={() => { setEditing(null); setForm({ name: '', description: '', icon: 'lock', color: '#6366f1', organization_id: '' }); setShowForm(true); }} className="flex items-center gap-2 bg-vault-600 hover:bg-vault-500 text-white px-4 py-2 rounded-xl text-sm">
            <Plus size={16} /> Novo Cofre
          </button>
        )}
      </div>

      {vaults.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <Lock size={48} className="mx-auto mb-4 opacity-30" />
          <p>Nenhum cofre encontrado</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {vaults.map(v => (
            <div key={v.id} onClick={() => loadDetail(v)} className="glass rounded-xl p-5 cursor-pointer hover:bg-vault-800/30 transition-all group">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: v.color + '20' }}>
                  <Lock size={20} style={{ color: v.color }} />
                </div>
                {canManage && (
                  <button onClick={e => { e.stopPropagation(); openEdit(v); }} className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-white">
                    <Edit2 size={14} />
                  </button>
                )}
              </div>
              <h3 className="font-semibold text-sm mb-1">{v.name}</h3>
              <p className="text-xs text-slate-500 mb-3 line-clamp-2">{v.description || 'Sem descricao'}</p>
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1"><Key size={12} /> {v.password_count} senhas</span>
                <span className="flex items-center gap-1"><Users size={12} /> {v.member_count} membros</span>
              </div>
              {v.organizations?.name && <p className="text-[10px] text-slate-500 mt-2">{v.organizations.name}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Modal criar/editar */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <form onSubmit={saveVault} className="w-full max-w-lg glass rounded-2xl p-6 animate-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">{editing ? 'Editar Cofre' : 'Novo Cofre'}</h3>
              <button type="button" onClick={() => setShowForm(false)}><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nome do cofre" required className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm" />
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Descricao" className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm" />
              <div className="flex gap-3">
                <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="w-12 h-10 rounded-lg cursor-pointer bg-transparent" />
                <select value={form.organization_id} onChange={e => setForm({ ...form, organization_id: e.target.value })} className="flex-1 bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm">
                  <option value="">Sem organizacao</option>
                  {orgs.map((o: any) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-slate-400">Cancelar</button>
              {editing && canManage && <button type="button" onClick={() => { deleteVault(editing.id); setShowForm(false); }} className="text-red-400 hover:text-red-300 px-4 py-2 text-sm">Excluir</button>}
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
