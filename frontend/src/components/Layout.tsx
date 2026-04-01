import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Shield, Key, Users, ScrollText, LayoutDashboard, Bell, LogOut, Menu, X, Settings, ChevronRight, AlertTriangle, Loader2, FolderOpen, FileText, Activity, Search, Building2, Send, Lock, BookOpen, Server, UserPlus, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getRoleLabel, hasPermission, isAuditorRole } from '../lib/access';
import { api } from '../lib/api';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout, updateUser } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const [sidebar, setSidebar] = useState(false);
  const [notifs, setNotifs] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [showNotif, setShowNotif] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [term, setTerm] = useState<any>(null);
  const [termName, setTermName] = useState('');
  const [termCpf, setTermCpf] = useState('');
  const [termAccepting, setTermAccepting] = useState(false);
  const [showExtraEmail, setShowExtraEmail] = useState(false);
  const [extraEmail, setExtraEmail] = useState('');
  const [showForcePw, setShowForcePw] = useState(false);
  const [newPw, setNewPw] = useState('');
  const [changingPw, setChangingPw] = useState(false);
  const [pwErr, setPwErr] = useState('');
  const [quickSearch, setQuickSearch] = useState(false);

  const canViewPasswords = hasPermission(user, 'passwords.view');
  const canViewDashboard = hasPermission(user, 'dashboard.view');
  const canViewRealtime = hasPermission(user, 'realtime.view');
  const canManageUsers = hasPermission(user, 'users.manage');
  const canManageGroups = hasPermission(user, 'groups.manage');
  const canManageOrganizations = hasPermission(user, 'organizations.manage');
  const canManageTerms = hasPermission(user, 'terms.manage');
  const canViewLogs = hasPermission(user, 'audit_logs.view');
  const canViewVaults = hasPermission(user, 'vaults.view');
  const canViewKb = hasPermission(user, 'kb.view');
  const canViewCmdb = hasPermission(user, 'cmdb.view');
  const canViewOnboarding = hasPermission(user, 'onboarding.view');
  const canViewCompliance = hasPermission(user, 'compliance.view');
  const isAuditor = isAuditorRole(user?.role);
  const daysLeft = user?.password_days_left;
  const showExpBar = typeof daysLeft === 'number' && daysLeft > 0 && daysLeft <= 5;

  const navItems = [
    ...(canViewPasswords && !isAuditor ? [{ to: '/passwords', label: 'Senhas', icon: Key, highlight: true }] : []),
    ...(!isAuditor ? [{ to: '/password-requests', label: 'Solicitacoes', icon: Send }] : []),
    ...(canViewVaults ? [{ to: '/vaults', label: 'Cofres', icon: Lock }] : []),
    ...(canViewKb ? [{ to: '/kb', label: 'Base Conhecimento', icon: BookOpen }] : []),
    ...(canViewCmdb ? [{ to: '/cmdb', label: 'CMDB / TI', icon: Server }] : []),
    ...(canViewOnboarding ? [{ to: '/onboarding', label: 'Onboarding', icon: UserPlus }] : []),
    ...(canViewCompliance ? [{ to: '/compliance', label: 'Compliance', icon: ShieldCheck }] : []),
    ...(canViewDashboard ? [{ to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard }] : []),
    ...(canViewRealtime ? [{ to: '/admin/realtime', label: 'Tempo Real', icon: Activity }] : []),
    ...(canManageUsers ? [{ to: '/admin/users', label: 'Usuarios', icon: Users }] : []),
    ...(canManageGroups ? [{ to: '/admin/groups', label: 'Grupos', icon: FolderOpen }] : []),
    ...(canManageOrganizations ? [{ to: '/admin/organizations', label: 'Organizacao', icon: Building2 }] : []),
    ...(canManageTerms ? [{ to: '/admin/terms', label: 'Termos LGPD', icon: FileText }] : []),
    ...(canViewLogs ? [{ to: '/admin/logs', label: 'Logs', icon: ScrollText }] : []),
    { to: '/settings', label: 'Configuracoes', icon: Settings },
  ];

  useEffect(() => {
    if (user?.needs_term_acceptance) {
      loadTerm();
      setShowTerms(true);
    } else if (user?.must_change_password) {
      setShowForcePw(true);
    }
  }, [user?.needs_term_acceptance, user?.must_change_password]);

  useEffect(() => {
    fetchNotifs();
    const intervalId = setInterval(fetchNotifs, 30000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        setQuickSearch(true);
      }
      if (event.key === 'Escape') setQuickSearch(false);
      if (event.key === 'PrintScreen') {
        try {
          api.post('/auth/log-action', { action: 'SCREENSHOT_ATTEMPT' });
        } catch {}
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    const beat = () => {
      try {
        api.post('/realtime/heartbeat', { module: loc.pathname });
      } catch {}
    };
    beat();
    const intervalId = setInterval(beat, 15000);
    return () => clearInterval(intervalId);
  }, [loc.pathname]);

  async function loadTerm() {
    try {
      const data = await api.get('/terms/latest');
      setTerm(data.term);
    } catch {}
  }

  function formatCpf(value: string) {
    const nums = value.replace(/\D/g, '').slice(0, 11);
    if (nums.length <= 3) return nums;
    if (nums.length <= 6) return nums.slice(0, 3) + '.' + nums.slice(3);
    if (nums.length <= 9) return nums.slice(0, 3) + '.' + nums.slice(3, 6) + '.' + nums.slice(6);
    return nums.slice(0, 3) + '.' + nums.slice(3, 6) + '.' + nums.slice(6, 9) + '-' + nums.slice(9);
  }

  async function acceptTerm(event: React.FormEvent) {
    event.preventDefault();
    if (!term) return;
    setTermAccepting(true);
    try {
      await api.post('/terms/accept', {
        term_id: term.id,
        term_version: term.version,
        full_name_typed: termName,
        cpf: termCpf.replace(/\D/g, ''),
        extra_email: showExtraEmail ? extraEmail : null,
      });
      await updateUser();
      setShowTerms(false);
      setTermName('');
      setTermCpf('');
      setExtraEmail('');
      setShowExtraEmail(false);
      if (user?.must_change_password) setShowForcePw(true);
    } catch {
    } finally {
      setTermAccepting(false);
    }
  }

  async function handleForcePw(event: React.FormEvent) {
    event.preventDefault();
    if (newPw.length < 6) {
      setPwErr('Minimo 6 caracteres');
      return;
    }
    setChangingPw(true);
    setPwErr('');
    try {
      await api.post('/auth/update-password', { password: newPw });
      await updateUser();
      setShowForcePw(false);
      setNewPw('');
    } catch (err: any) {
      setPwErr(err.message);
    } finally {
      setChangingPw(false);
    }
  }

  async function fetchNotifs() {
    try {
      const data = await api.get('/notifications');
      setNotifs(data.notifications);
      setUnread(data.unreadCount);
    } catch {}
  }

  async function markAllRead() {
    try {
      await api.put('/notifications/read-all');
      setUnread(0);
      setNotifs((current) => current.map((item) => ({ ...item, is_read: true })));
    } catch {}
  }

  async function markRead(id: string) {
    try {
      await api.put('/notifications/' + id + '/read');
      setNotifs((current) => current.map((item) => (item.id === id ? { ...item, is_read: true } : item)));
      setUnread((current) => Math.max(0, current - 1));
    } catch {}
  }

  const dn = user?.display_name || user?.full_name || 'Usuario';
  const av = user?.avatar_url;
  const roleLabel = getRoleLabel(user?.role);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {showTerms && term && (
        <div className="fixed inset-0 bg-black/90 z-[110] flex items-center justify-center p-4">
          <div className="w-full max-w-2xl glass rounded-2xl shadow-2xl animate-in max-h-[95vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <FileText size={28} className="text-vault-400" />
                <div>
                  <h2 className="font-bold text-lg">{term.title}</h2>
                  <p className="text-xs text-slate-400">Versao {term.version}</p>
                </div>
              </div>
              <div className="bg-vault-950/50 rounded-xl p-4 max-h-60 overflow-y-auto mb-4 text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                {term.content}
              </div>
              <form onSubmit={acceptTerm} className="space-y-3">
                <div className="flex items-center gap-2 px-3 py-2 bg-vault-800/50 rounded-lg text-xs text-slate-400">
                  <AlertTriangle size={14} className="text-amber-400 flex-shrink-0" />
                  <span>Para aceitar, digite seu nome completo e CPF abaixo como assinatura eletronica.</span>
                </div>
                <input type="text" value={termName} onChange={(event) => setTermName(event.target.value)} placeholder="Digite seu nome completo" required className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-vault-500" autoFocus />
                <input type="text" value={termCpf} onChange={(event) => setTermCpf(formatCpf(event.target.value))} placeholder="Digite seu CPF (000.000.000-00)" required className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-vault-500" />
                <div className="bg-vault-900/40 rounded-lg p-3 text-xs text-slate-400">
                  <p>
                    Uma copia sera enviada para <strong className="text-vault-300">{user?.email}</strong>
                  </p>
                  <label className="flex items-center gap-2 mt-2 cursor-pointer">
                    <input type="checkbox" checked={showExtraEmail} onChange={() => setShowExtraEmail(!showExtraEmail)} className="rounded" />
                    <span>Enviar copia para outro email</span>
                  </label>
                </div>
                {showExtraEmail && <input type="email" value={extraEmail} onChange={(event) => setExtraEmail(event.target.value)} placeholder="Email adicional" className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-vault-500" />}
                <button type="submit" disabled={termAccepting || !termName || termCpf.replace(/\D/g, '').length < 11} className="w-full bg-vault-600 hover:bg-vault-500 text-white py-3 rounded-xl font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                  {termAccepting && <Loader2 size={16} className="animate-spin" />} Li e aceito os termos
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {showForcePw && (
        <div className="fixed inset-0 bg-black/90 z-[110] flex items-center justify-center p-4">
          <div className="w-full max-w-md glass rounded-2xl shadow-2xl animate-in p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle size={28} className="text-amber-400" />
              <div>
                <h2 className="font-bold text-lg">Troque sua senha</h2>
                <p className="text-xs text-slate-400">Obrigatorio no primeiro acesso</p>
              </div>
            </div>
            <form onSubmit={handleForcePw} className="space-y-4">
              <input type="password" value={newPw} onChange={(event) => setNewPw(event.target.value)} placeholder="Nova senha (minimo 6 caracteres)" className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-vault-500" minLength={6} required />
              {pwErr && <p className="text-red-400 text-xs">{pwErr}</p>}
              <button type="submit" disabled={changingPw} className="w-full bg-vault-600 hover:bg-vault-500 text-white py-3 rounded-xl font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                {changingPw && <Loader2 size={16} className="animate-spin" />} Alterar Senha
              </button>
            </form>
          </div>
        </div>
      )}

      {quickSearch && (
        <div className="fixed inset-0 bg-black/60 z-[90] flex items-start justify-center pt-20 p-4" onClick={() => setQuickSearch(false)}>
          <div className="w-full max-w-lg glass rounded-2xl shadow-2xl animate-in" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center gap-3 p-4 border-b border-vault-700/30">
              <Search size={18} className="text-slate-500" />
              <input type="text" placeholder="Buscar senhas, usuarios, acoes..." autoFocus className="flex-1 bg-transparent text-sm focus:outline-none" />
              <kbd className="text-[10px] text-slate-500 bg-vault-800/50 px-2 py-0.5 rounded">ESC</kbd>
            </div>
            <div className="p-4 text-center text-sm text-slate-500">
              <p>Ctrl+K para busca rapida</p>
            </div>
          </div>
        </div>
      )}

      {showExpBar && !showForcePw && !showTerms && (
        <div className="fixed top-0 left-0 right-0 z-[70] bg-amber-500 text-black px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium">
          <AlertTriangle size={16} /> Sua senha expira em {daysLeft} dia(s). Altere em Configuracoes.
        </div>
      )}

      <header className={'lg:hidden flex items-center justify-between p-4 glass border-b border-vault-700/30 sticky top-0 z-50 ' + (showExpBar && !showForcePw && !showTerms ? 'mt-10' : '')}>
        <button onClick={() => setSidebar(true)} className="p-2">
          <Menu size={22} />
        </button>
        <div className="flex items-center gap-2">
          <Shield size={20} className="text-vault-400" />
          <span className="font-semibold text-sm">Cofre de Senhas</span>
        </div>
        <button onClick={() => setShowNotif(!showNotif)} className="p-2 relative">
          <Bell size={20} />
          {unread > 0 && <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">{unread > 9 ? '9+' : unread}</span>}
        </button>
      </header>

      {sidebar && (
        <div className="lg:hidden fixed inset-0 bg-black/60 z-50" onClick={() => setSidebar(false)}>
          <div className="w-72 h-full glass animate-in" onClick={(event) => event.stopPropagation()}>
            <SideContent items={navItems} loc={loc} dn={dn} av={av} role={roleLabel} close={() => setSidebar(false)} onLogout={() => { logout(); nav('/login'); }} />
          </div>
        </div>
      )}

      <aside className={'hidden lg:flex lg:flex-col lg:w-64 xl:w-72 glass border-r border-vault-700/30 sticky h-screen ' + (showExpBar && !showForcePw && !showTerms ? 'top-10' : 'top-0')}>
        <SideContent items={navItems} loc={loc} dn={dn} av={av} role={roleLabel} close={() => {}} onLogout={() => { logout(); nav('/login'); }} />
      </aside>

      <main className={'flex-1 min-h-screen pb-20 lg:pb-0 ' + (showExpBar && !showForcePw && !showTerms ? 'mt-10' : '')}>
        <div className="hidden lg:flex items-center justify-between p-4 border-b border-vault-700/20">
          <button onClick={() => setQuickSearch(true)} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 glass-light rounded-lg px-3 py-1.5">
            <Search size={14} /> Buscar... <kbd className="text-[10px] text-slate-600 bg-vault-800/50 px-1.5 py-0.5 rounded ml-2">Ctrl+K</kbd>
          </button>
          <div className="flex items-center gap-4">
            <button onClick={() => setShowNotif(!showNotif)} className="p-2 relative hover:bg-vault-800/50 rounded-lg">
              <Bell size={20} />
              {unread > 0 && <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">{unread > 9 ? '9+' : unread}</span>}
            </button>
            <Link to="/settings" className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200">
              {av ? <img src={av} alt="" className="w-8 h-8 rounded-full object-cover" /> : <div className="w-8 h-8 rounded-full bg-vault-600 flex items-center justify-center text-white font-bold text-xs">{dn.charAt(0).toUpperCase()}</div>}
              <span>{dn}</span>
            </Link>
          </div>
        </div>

        {showNotif && (
          <>
            <div className="fixed right-4 top-16 lg:top-14 w-80 max-h-96 glass rounded-xl shadow-2xl z-[60] overflow-hidden animate-in">
              <div className="flex items-center justify-between p-3 border-b border-vault-700/30">
                <span className="font-semibold text-sm">Notificacoes</span>
                {unread > 0 && <button onClick={markAllRead} className="text-xs text-vault-400 hover:text-vault-300">Marcar todas</button>}
              </div>
              <div className="overflow-y-auto max-h-72">
                {notifs.length === 0 ? (
                  <p className="p-4 text-center text-slate-500 text-sm">Nenhuma notificacao</p>
                ) : (
                  notifs.map((item) => (
                    <div key={item.id} onClick={() => markRead(item.id)} className={'p-3 border-b border-vault-700/20 cursor-pointer hover:bg-vault-800/30 ' + (!item.is_read ? 'bg-vault-900/40' : '')}>
                      <div className="flex items-start gap-2">
                        {!item.is_read && <div className="w-2 h-2 rounded-full bg-vault-400 mt-1.5 flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.title}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{item.message}</p>
                          <p className="text-[10px] text-slate-500 mt-1">{new Date(item.created_at).toLocaleString('pt-BR')}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="fixed inset-0 z-[55]" onClick={() => setShowNotif(false)} />
          </>
        )}

        <div className="p-4 lg:p-6 animate-in">{children}</div>
      </main>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 glass border-t border-vault-700/30 z-40">
        <div className="flex justify-around py-2">
          {navItems.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const active = loc.pathname === item.to;
            return (
              <Link key={item.to} to={item.to} className={'flex flex-col items-center gap-0.5 p-2 rounded-lg ' + (active ? 'text-vault-400' : 'text-slate-500')}>
                <Icon size={18} />
                <span className="text-[9px]">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function SideContent({ items, loc, dn, av, role, close, onLogout }: any) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-vault-500 to-vault-700 flex items-center justify-center pulse-glow">
            <Shield size={20} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-base">Cofre de Senhas</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">Departamento TI</p>
          </div>
        </div>
        <button onClick={close} className="lg:hidden p-1">
          <X size={18} />
        </button>
      </div>

      <Link to="/settings" onClick={close} className="mx-4 mb-4 p-3 rounded-xl bg-vault-900/40 border border-vault-700/20 hover:bg-vault-800/40">
        <div className="flex items-center gap-3">
          {av ? <img src={av} alt="" className="w-10 h-10 rounded-full object-cover" /> : <div className="w-10 h-10 rounded-full bg-vault-600 flex items-center justify-center text-white font-bold text-sm">{dn?.charAt(0)?.toUpperCase()}</div>}
          <div>
            <p className="text-sm font-medium truncate">{dn}</p>
            <p className="text-[10px] text-slate-500">{role}</p>
          </div>
        </div>
      </Link>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {items.map((item: any) => {
          const Icon = item.icon;
          const active = loc.pathname === item.to;
          const highlight = item.highlight && !active;
          return (
            <Link key={item.to} to={item.to} onClick={close} className={'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ' + (active ? 'bg-vault-600/30 text-vault-300 border border-vault-500/30' : highlight ? 'bg-vault-600/10 text-vault-300 border border-vault-600/20 hover:bg-vault-600/20' : 'text-slate-400 hover:bg-vault-800/30 hover:text-slate-200 border border-transparent')}>
              <Icon size={18} />
              <span className={item.highlight ? 'font-semibold' : ''}>{item.label}</span>
              {active && <ChevronRight size={14} className="ml-auto" />}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-vault-700/20">
        <button onClick={onLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-400 hover:bg-red-500/10 w-full">
          <LogOut size={18} /> Sair
        </button>
      </div>
    </div>
  );
}
