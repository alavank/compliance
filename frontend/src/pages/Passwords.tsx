import React, { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Search, Plus, Edit3, Trash2, ExternalLink, Copy, Clock, Loader2, Wand2, X, Globe, Server, Mail, Wifi, Database, Share2, ShieldCheck, Folder, CheckCircle2, Key, Calendar, Timer, Building2, FolderOpen, UserMinus } from 'lucide-react';
import OrganizationTreeSelect from '../components/OrganizationTreeSelect';
import { useAuth } from '../contexts/AuthContext';
import { hasPermission } from '../lib/access';
import { api } from '../lib/api';
import type { OrgNode } from '../lib/organizations';

const ICON_MAP: any = { globe: Globe, server: Server, mail: Mail, wifi: Wifi, database: Database, 'share-2': Share2, shield: ShieldCheck, folder: Folder };
const INITIAL_FORM = {
  system_name: '',
  urlProtocol: 'https://',
  urlPath: '',
  username: '',
  password: '',
  notes: '',
  category_id: '',
  expires_days: '',
  organization_ids: [] as string[],
  group_ids: [] as string[],
  exception_user_ids: [] as string[],
};

export default function Passwords() {
  const { user } = useAuth();
  const canCreatePassword = hasPermission(user, 'passwords.create');
  const canEditPassword = hasPermission(user, 'passwords.edit');
  const canDeletePassword = hasPermission(user, 'passwords.delete');
  const canRevealPassword = hasPermission(user, 'passwords.reveal');
  const canManageScopes = canCreatePassword || canEditPassword;

  const [passwords, setPasswords] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [orgTree, setOrgTree] = useState<OrgNode[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [loading, setLoading] = useState(true);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [revealedPw, setRevealedPw] = useState('');
  const [revealing, setRevealing] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [showExceptions, setShowExceptions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const timerRef = useRef<any>(null);
  const countdownRef = useRef<any>(null);
  const [genLength, setGenLength] = useState(16);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (countdown > 0) {
      countdownRef.current = setTimeout(() => setCountdown((current) => current - 1), 1000);
    } else if (countdown === 0 && revealedId) {
      hidePassword();
    }
    return () => clearTimeout(countdownRef.current);
  }, [countdown, revealedId]);

  async function load() {
    setLoading(true);
    try {
      const [passwordData, categoryData] = await Promise.all([api.get('/passwords'), api.get('/admin/categories')]);
      setPasswords(passwordData.passwords || []);
      setCategories(categoryData.categories || []);
      if (canManageScopes) {
        const [groupData, orgData, userData] = await Promise.all([
          api.get('/groups'),
          api.get('/organizations/tree'),
          api.get('/admin/users'),
        ]);
        setGroups(groupData.groups || []);
        setOrgTree(orgData.tree || []);
        setAllUsers(userData.users || []);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }

  async function revealPassword(id: string) {
    if (!canRevealPassword) return;
    if (revealedId === id) {
      hidePassword();
      return;
    }
    setRevealing(true);
    try {
      const data = await api.post('/passwords/reveal/' + id);
      setRevealedId(id);
      setRevealedPw(data.password);
      setCountdown(5);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(hidePassword, 5000);
    } catch (err: any) {
      showToast(err.message);
    } finally {
      setRevealing(false);
    }
  }

  function hidePassword() {
    setRevealedId(null);
    setRevealedPw('');
    setCountdown(0);
    clearTimeout(timerRef.current);
    clearTimeout(countdownRef.current);
  }

  async function copyPassword(id: string) {
    if (!canRevealPassword) return;
    try {
      const data = await api.post('/passwords/reveal/' + id);
      await navigator.clipboard.writeText(data.password);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
      showToast('Senha copiada!');
    } catch {}
  }

  async function generatePassword() {
    try {
      const data = await api.post('/passwords/generate', { length: genLength });
      setForm((current) => ({ ...current, password: data.password }));
      showToast('Senha gerada!');
    } catch {}
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (form.organization_ids.length === 0) {
      showToast('Selecione ao menos um local da organizacao.');
      return;
    }
    setSaving(true);
    try {
      const fullUrl = form.urlPath ? form.urlProtocol + form.urlPath : '';
      const payload = {
        system_name: form.system_name,
        url: fullUrl || null,
        username: form.username,
        password: form.password,
        notes: form.notes,
        category_id: form.category_id || null,
        expires_days: form.expires_days ? parseInt(form.expires_days) : null,
        organization_ids: form.organization_ids,
        group_ids: form.group_ids,
        exception_user_ids: form.exception_user_ids,
      };
      if (editId) {
        await api.put('/passwords/' + editId, payload);
        showToast('Senha atualizada!');
      } else {
        await api.post('/passwords', payload);
        showToast('Senha criada!');
      }
      setShowModal(false);
      resetForm();
      load();
    } catch (err: any) {
      showToast(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm('Remover "' + name + '"?')) return;
    try {
      await api.delete('/passwords/' + id);
      showToast('Removida');
      load();
    } catch (err: any) {
      showToast(err.message);
    }
  }

  function openEdit(password: any) {
    let protocol = 'https://';
    let path = password.url || '';
    if (path.startsWith('https://')) {
      protocol = 'https://';
      path = path.replace('https://', '');
    } else if (path.startsWith('http://')) {
      protocol = 'http://';
      path = path.replace('http://', '');
    }

    setEditId(password.id);
    setForm({
      system_name: password.system_name,
      urlProtocol: protocol,
      urlPath: path,
      username: password.username || '',
      password: '',
      notes: password.notes || '',
      category_id: password.category_id || '',
      expires_days: '',
      organization_ids: password.organization_ids || (password.organization_id ? [password.organization_id] : []),
      group_ids: password.group_ids || [],
      exception_user_ids: password.exception_user_ids || [],
    });
    setShowExceptions((password.exception_user_ids || []).length > 0);
    setShowModal(true);
  }

  function resetForm() {
    setEditId(null);
    setForm(INITIAL_FORM);
    setShowExceptions(false);
  }

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }

  function toggleGroup(groupId: string) {
    setForm((current) => ({
      ...current,
      group_ids: current.group_ids.includes(groupId)
        ? current.group_ids.filter((id) => id !== groupId)
        : [...current.group_ids, groupId],
    }));
  }

  function toggleException(userId: string) {
    setForm((current) => ({
      ...current,
      exception_user_ids: current.exception_user_ids.includes(userId)
        ? current.exception_user_ids.filter((id) => id !== userId)
        : [...current.exception_user_ids, userId],
    }));
  }

  const filtered = passwords.filter((password) => {
    const matchesSearch =
      password.system_name.toLowerCase().includes(search.toLowerCase()) ||
      password.username?.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (!filterCat || password.category_id === filterCat);
  });

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 size={32} className="animate-spin text-vault-400" /></div>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-vault-300 to-blue-400 bg-clip-text text-transparent flex items-center gap-2"><Key size={24} className="text-vault-400" /> Cofre de Senhas</h1>
          <p className="text-sm text-slate-500 mt-1">{filtered.length} senha(s)</p>
        </div>
        {canCreatePassword && <button onClick={() => { resetForm(); setShowModal(true); }} className="flex items-center gap-2 bg-vault-600 hover:bg-vault-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg shadow-vault-600/20"><Plus size={16} /> Nova Senha</button>}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1 relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input type="text" value={search} onChange={(event) => setSearch(event.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-vault-900/50 border border-vault-700/30 rounded-xl text-sm focus:outline-none focus:border-vault-500" placeholder="Buscar senhas..." /></div>
        {categories.length > 0 && <select value={filterCat} onChange={(event) => setFilterCat(event.target.value)} className="bg-vault-900/50 border border-vault-700/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-vault-500 appearance-none"><option value="">Todas</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>}
      </div>

      <div className="space-y-3">
        {filtered.map((password) => {
          const category = categories.find((item) => item.id === password.category_id);
          const CategoryIcon = category ? (ICON_MAP[category.icon] || Folder) : Key;
          const isRevealed = revealedId === password.id;

          return (
            <div key={password.id} className={'glass rounded-xl p-4 transition-all ' + (password.needsRotation ? 'border border-red-500/30' : '')}>
              <div className="flex items-start gap-3">
                <div className={'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ' + (category ? '' : 'bg-vault-600/20')} style={category ? { backgroundColor: category.color + '20', color: category.color } : undefined}>
                  <CategoryIcon size={18} className={category ? '' : 'text-vault-400'} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-sm truncate">{password.system_name}</h3>
                    {password.url && <a href={password.url} target="_blank" rel="noopener noreferrer" className="text-vault-400 hover:text-vault-300 flex-shrink-0"><ExternalLink size={13} /></a>}
                  </div>
                  {password.username && <p className="text-xs text-slate-400 mb-2">Usuario: <span className="text-slate-300">{password.username}</span></p>}

                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-vault-950/50 rounded-lg px-3 py-2 font-mono text-sm flex items-center">
                      {isRevealed ? <span className="text-vault-300 break-all">{revealedPw}</span> : <span className="text-slate-600 tracking-wider">{'•'.repeat(12)}</span>}
                    </div>
                    {canRevealPassword && <button onClick={() => revealPassword(password.id)} disabled={revealing} className={'p-2 rounded-lg transition-colors relative ' + (isRevealed ? 'bg-vault-600/30 text-vault-300' : 'hover:bg-vault-800/50 text-slate-500')} title={isRevealed ? 'Ocultar' : 'Revelar'}>{revealing ? <Loader2 size={16} className="animate-spin" /> : isRevealed ? <EyeOff size={16} /> : <Eye size={16} />}{isRevealed && countdown > 0 && <span className="absolute -top-2 -right-2 bg-vault-500 text-white text-[9px] rounded-full w-5 h-5 flex items-center justify-center font-bold">{countdown}</span>}</button>}
                    {canRevealPassword && <button onClick={() => copyPassword(password.id)} className={'p-2 rounded-lg transition-colors ' + (copied === password.id ? 'text-green-400 bg-green-500/10' : 'hover:bg-vault-800/50 text-slate-500')} title="Copiar">{copied === password.id ? <CheckCircle2 size={16} /> : <Copy size={16} />}</button>}
                  </div>
                  {isRevealed && countdown > 0 && <p className="text-[10px] text-vault-400 mt-1 flex items-center gap-1"><Timer size={10} /> Oculta em {countdown}s</p>}

                  {password.notes && <p className="text-xs text-slate-500 mt-2">{password.notes}</p>}

                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {category && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: category.color + '20', color: category.color }}>{category.name}</span>}
                    {(password.organization_paths || []).map((path: string) => <span key={path} className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-300 flex items-center gap-1"><Building2 size={9} />{path}</span>)}
                    <span className="text-[10px] text-slate-500 flex items-center gap-1"><Clock size={10} /> Senha criada: {password.updatedFormatted} por {password.updatedBy}</span>
                  </div>

                  {password.expiresDate && password.expiresIn !== null && (
                    <div className={'mt-2 text-[10px] flex items-center gap-1 px-2 py-1 rounded-lg w-fit ' + (password.needsRotation ? 'bg-red-500/10 text-red-400' : password.expiresIn <= 15 ? 'bg-amber-500/10 text-amber-400' : 'bg-vault-800/40 text-slate-400')}>
                      <Calendar size={10} />
                      {password.needsRotation ? 'Expirada em ' + password.expiresDate : 'Expira em ' + password.expiresDate + ' - faltam ' + password.expiresIn + ' dia(s)'}
                    </div>
                  )}
                </div>

                {(canEditPassword || canDeletePassword) && (
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    {canEditPassword && <button onClick={() => openEdit(password)} className="p-2 hover:bg-vault-800/50 rounded-lg text-slate-500 hover:text-vault-300"><Edit3 size={14} /></button>}
                    {canDeletePassword && <button onClick={() => handleDelete(password.id, password.system_name)} className="p-2 hover:bg-red-500/10 rounded-lg text-slate-500 hover:text-red-400"><Trash2 size={14} /></button>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <div className="text-center py-16 text-slate-500"><Key size={40} className="mx-auto mb-3 opacity-30" /><p className="text-sm">Nenhuma senha encontrada</p></div>}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="w-full max-w-lg glass rounded-2xl shadow-2xl animate-in max-h-[90vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-vault-700/30"><h2 className="font-semibold">{editId ? 'Editar Senha' : 'Nova Senha'}</h2><button onClick={() => setShowModal(false)} className="p-1 hover:bg-vault-800/50 rounded-lg"><X size={18} /></button></div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div><label className="text-xs text-slate-400 mb-1 block">Nome do Sistema *</label><input type="text" value={form.system_name} onChange={(event) => setForm((current) => ({ ...current, system_name: event.target.value }))} className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-vault-500" placeholder="Ex: Portal da Transparencia" required /></div>
              <div><label className="text-xs text-slate-400 mb-1 block">URL de Acesso</label><div className="flex gap-0"><select value={form.urlProtocol} onChange={(event) => setForm((current) => ({ ...current, urlProtocol: event.target.value }))} className="bg-vault-800/70 border border-vault-700/30 border-r-0 rounded-l-xl px-2 py-2.5 text-xs text-vault-300 focus:outline-none appearance-none"><option value="https://">https://</option><option value="http://">http://</option></select><input type="text" value={form.urlPath} onChange={(event) => setForm((current) => ({ ...current, urlPath: event.target.value }))} className="flex-1 bg-vault-900/50 border border-vault-700/30 rounded-r-xl px-3 py-2.5 text-sm focus:outline-none focus:border-vault-500" placeholder="www.exemplo.com.br" /></div></div>
              <div><label className="text-xs text-slate-400 mb-1 block">Usuario / Login</label><input type="text" value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-vault-500" placeholder="admin@sistema.com" /></div>
              <div><label className="text-xs text-slate-400 mb-1 block">Senha {editId ? '(vazio = manter)' : '*'}</label><div className="flex gap-2"><input type="text" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} className="flex-1 bg-vault-900/50 border border-vault-700/30 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-vault-500" placeholder={editId ? '••••••••' : 'Senha segura'} required={!editId} /><button type="button" onClick={generatePassword} className="flex items-center gap-1 px-3 bg-vault-700/50 hover:bg-vault-600/50 rounded-xl text-xs text-vault-300"><Wand2 size={14} /> Gerar</button></div><div className="mt-2"><div className="flex items-center justify-between mb-1"><label className="text-[10px] text-slate-500">Tamanho: {genLength}</label><span className="text-[10px] text-slate-600">6 - 20</span></div><input type="range" min={6} max={20} value={genLength} onChange={(event) => setGenLength(parseInt(event.target.value))} className="w-full accent-vault-500" /></div></div>
              <div><label className="text-xs text-slate-400 mb-1 block">Expira em (dias)</label><input type="number" value={form.expires_days} onChange={(event) => setForm((current) => ({ ...current, expires_days: event.target.value }))} className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-vault-500" placeholder="90 (padrao)" min={1} /></div>
              <div><label className="text-xs text-slate-400 mb-1 block">Categoria</label><select value={form.category_id} onChange={(event) => setForm((current) => ({ ...current, category_id: event.target.value }))} className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-vault-500 appearance-none"><option value="">Sem categoria</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div>

              {orgTree.length > 0 && (
                <div>
                  <label className="text-xs text-slate-400 mb-1 block flex items-center gap-1"><Building2 size={12} /> Local da Organizacao *</label>
                  <OrganizationTreeSelect tree={orgTree} selectedIds={form.organization_ids} onChange={(organization_ids) => setForm((current) => ({ ...current, organization_ids }))} helperText="A senha sempre precisa estar vinculada a pelo menos um local. Sem local selecionado, o cadastro nao e salvo." emptyText="Nenhum local selecionado" />
                </div>
              )}

              {groups.length > 0 && (
                <div>
                  <label className="text-xs text-slate-400 mb-1 block flex items-center gap-1"><FolderOpen size={12} /> Grupos com acesso</label>
                  <div className="flex flex-wrap gap-2">{groups.map((group) => <button key={group.id} type="button" onClick={() => toggleGroup(group.id)} className={'px-3 py-1.5 rounded-lg text-xs border transition-colors ' + (form.group_ids.includes(group.id) ? 'bg-vault-600/30 border-vault-500/50 text-vault-300' : 'border-vault-700/30 text-slate-500 hover:border-vault-600/30')}>{group.name}</button>)}</div>
                  <p className="text-[10px] text-slate-500 mt-1">Sem grupos selecionados: qualquer usuario vinculado a um dos locais pode ver. Com grupos: somente membros desses grupos veem, mesmo que outros usuarios estejam no local.</p>
                </div>
              )}

              <div><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={showExceptions} onChange={() => setShowExceptions(!showExceptions)} className="rounded" /><span className="text-xs text-slate-400 flex items-center gap-1"><UserMinus size={12} /> Excluir usuarios especificos do acesso</span></label></div>
              {showExceptions && allUsers.length > 0 && (
                <div className="bg-vault-900/30 rounded-xl p-3 border border-vault-700/20">
                  <p className="text-[10px] text-slate-500 mb-2">Marque os usuarios que NAO devem ver esta senha, mesmo que facam parte do grupo ou do local.</p>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">{allUsers.filter((item) => item.role !== 'admin' && item.role !== 'super_admin').map((item) => <button key={item.id} type="button" onClick={() => toggleException(item.id)} className={'px-2 py-1 rounded-lg text-[11px] border transition-colors ' + (form.exception_user_ids.includes(item.id) ? 'bg-red-600/20 border-red-500/40 text-red-300' : 'border-vault-700/30 text-slate-500 hover:border-red-600/30')}>{item.display_name || item.full_name}</button>)}</div>
                </div>
              )}

              <div><label className="text-xs text-slate-400 mb-1 block">Observacoes</label><textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-vault-500 resize-none" rows={3} placeholder="Anotacoes..." /></div>
              <button type="submit" disabled={saving} className="w-full bg-vault-600 hover:bg-vault-500 text-white py-3 rounded-xl font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2">{saving && <Loader2 size={16} className="animate-spin" />}{editId ? 'Salvar Alteracoes' : 'Criar Senha'}</button>
            </form>
          </div>
        </div>
      )}

      {toast && <div className="fixed bottom-24 lg:bottom-6 right-6 glass px-4 py-3 rounded-xl text-sm toast-enter shadow-xl z-50">{toast}</div>}
    </div>
  );
}
