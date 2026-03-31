import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Key, Users, AlertTriangle, Activity, Loader2, Clock, Eye, LogIn, Shield, Edit3, BarChart3, TrendingUp, Filter, UserCheck, Download, Monitor, Globe, Calendar, Smartphone, Cpu, Building2, Timer } from 'lucide-react';

const AL: any = { LOGIN:'fez login', LOGOUT:'saiu do sistema', PASSWORD_VIEWED:'visualizou a senha', PASSWORD_CREATED:'criou a senha', PASSWORD_CHANGED:'alterou a senha', PASSWORD_UPDATED:'atualizou dados da senha', PASSWORD_DELETED:'removeu a senha', USER_CREATED:'criou o usuário', USER_ACTIVATED:'ativou o usuário', USER_DEACTIVATED:'desativou o usuário', USER_DELETED:'excluiu o usuário', USER_PASSWORD_RESET:'redefiniu a senha de', '2FA_ENABLED':'ativou 2FA', '2FA_DISABLED':'desativou 2FA', PASSWORD_SELF_CHANGED:'trocou a própria senha', PROFILE_UPDATED:'atualizou o perfil', TERM_ACCEPTED:'aceitou o termo', SCREENSHOT_ATTEMPT:'tentou capturar a tela' };
const AI: any = { LOGIN: LogIn, LOGOUT: LogIn, PASSWORD_VIEWED: Eye, PASSWORD_CREATED: Key, PASSWORD_CHANGED: Edit3 };

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [filterUserId, setFilterUserId] = useState('');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [useCustomDate, setUseCustomDate] = useState(false);

  useEffect(() => { loadUsers(); }, []);
  useEffect(() => { loadDashboard(); }, [days, filterUserId, dateFrom, dateTo, useCustomDate]);

  async function loadUsers() { try { const d = await api.get('/admin/users'); setAllUsers(d.users); } catch {} }
  async function loadDashboard() {
    setLoading(true);
    try {
      let url = '/admin/dashboard?days=' + days;
      if (filterUserId) url += '&userId=' + filterUserId;
      if (useCustomDate && dateFrom) { url += '&dateFrom=' + dateFrom; if (dateTo) url += '&dateTo=' + dateTo; }
      setData(await api.get(url));
    } catch {} finally { setLoading(false); }
  }

  async function downloadReport() {
    try { const token = localStorage.getItem('token');
      const res = await fetch('/api/reports/admin?days=' + days, { headers: { Authorization: 'Bearer ' + token } });
      const blob = await res.blob(); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'relatorio-' + days + 'dias.pdf'; a.click();
    } catch {}
  }

  if (!data && loading) return <div className="flex items-center justify-center h-64"><Loader2 size={32} className="animate-spin text-vault-400" /></div>;
  if (!data) return null;
  const bi = data.bi || {};
  const filterUserName = filterUserId ? allUsers.find((u: any) => u.id === filterUserId)?.full_name : null;

  const stats = [
    { label: 'Senhas', value: data.totalPasswords, icon: Key, color: 'text-blue-400', bg: 'from-blue-500/20 to-blue-600/5' },
    { label: 'Expiradas', value: data.expiredPasswords, icon: AlertTriangle, color: data.expiredPasswords > 0 ? 'text-red-400' : 'text-green-400', bg: data.expiredPasswords > 0 ? 'from-red-500/20 to-red-600/5' : 'from-green-500/20 to-green-600/5' },
    { label: 'Usuários', value: data.activeUsers + '/' + data.totalUsers, icon: Users, color: 'text-violet-400', bg: 'from-violet-500/20 to-violet-600/5' },
    { label: 'Logins', value: data.totalLogins, icon: LogIn, color: 'text-emerald-400', bg: 'from-emerald-500/20 to-emerald-600/5' },
    { label: 'Visualizações', value: data.totalViews, icon: Eye, color: 'text-amber-400', bg: 'from-amber-500/20 to-amber-600/5' },
    { label: 'Online Agora', value: data.onlineNow || 0, icon: Activity, color: 'text-green-400', bg: 'from-green-500/20 to-green-600/5' },
    { label: 'Tempo Médio', value: (data.avgSessionMinutes || 0) + 'min', icon: Timer, color: 'text-cyan-400', bg: 'from-cyan-500/20 to-cyan-600/5' },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-vault-300 to-blue-400 bg-clip-text text-transparent">Dashboard</h1>
          {filterUserName && <p className="text-sm text-vault-400 mt-1">Filtrado: {filterUserName}</p>}
        </div>
        <div className="flex items-center gap-2">
          {loading && <Loader2 size={16} className="animate-spin text-vault-400" />}
          <button onClick={downloadReport} className="flex items-center gap-1 glass-light hover:bg-vault-800/50 px-3 py-1.5 rounded-lg text-xs text-vault-300"><Download size={12} /> PDF</button>
        </div>
      </div>

      {/* Filtros */}
      <div className="glass rounded-xl p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <Filter size={16} className="text-vault-400" />
          {!useCustomDate && <select value={days} onChange={e => setDays(parseInt(e.target.value))} className="bg-vault-900/50 border border-vault-700/30 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-vault-500 appearance-none">
            <option value={7}>7 dias</option><option value={15}>15 dias</option><option value={30}>30 dias</option>
            <option value={60}>60 dias</option><option value={90}>90 dias</option><option value={180}>6 meses</option><option value={365}>1 ano</option>
          </select>}
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer"><input type="checkbox" checked={useCustomDate} onChange={() => setUseCustomDate(!useCustomDate)} className="rounded" />Período customizado</label>
          {useCustomDate && <>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-vault-900/50 border border-vault-700/30 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-vault-500" />
            <span className="text-xs text-slate-500">até</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-vault-900/50 border border-vault-700/30 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-vault-500" />
          </>}
          <select value={filterUserId} onChange={e => setFilterUserId(e.target.value)} className="bg-vault-900/50 border border-vault-700/30 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-vault-500 appearance-none">
            <option value="">Todos os usuários</option>
            {allUsers.map((u: any) => <option key={u.id} value={u.id}>{u.display_name || u.full_name}</option>)}
          </select>
          {(filterUserId || useCustomDate) && <button onClick={() => { setFilterUserId(''); setUseCustomDate(false); setDateFrom(''); setDateTo(''); }} className="text-xs text-vault-400 hover:text-vault-300">Limpar</button>}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        {stats.map((s, i) => (
          <div key={i} className="glass rounded-xl p-3 relative overflow-hidden group hover:scale-[1.02] transition-transform">
            <div className={'absolute inset-0 bg-gradient-to-br ' + s.bg + ' opacity-50'} />
            <div className="relative">
              <s.icon size={16} className={s.color + ' mb-1'} />
              <p className="text-lg font-bold">{s.value}</p>
              <p className="text-[9px] text-slate-500 uppercase tracking-wider">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Gráficos - Linha 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <ChartBar title="Acessos por Dia" icon={BarChart3} data={bi.accessByDay} xKey="day" yKey="count" color="vault" />
        <ChartBar title="Horários Mais Acessados" icon={Clock} data={bi.accessByHour} xKey="hour" yKey="count" color="emerald" labelEvery={4} />
      </div>

      {/* Gráficos - Linha 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <ChartBar title="Dias da Semana" icon={Calendar} data={bi.accessByWeekday} xKey="day" yKey="count" color="violet" showAllLabels />
        <div className="glass rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Smartphone size={16} className="text-vault-400" /> Dispositivos</h3>
          <RankList data={bi.devices} barColor="bg-violet-500/60" />
        </div>
        <div className="glass rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Globe size={16} className="text-vault-400" /> Navegadores</h3>
          <RankList data={bi.browsers} barColor="bg-blue-500/60" />
        </div>
      </div>

      {/* Gráficos - Linha 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="glass rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Eye size={16} className="text-vault-400" /> Senhas Mais Visualizadas</h3>
          <RankList data={bi.topPasswords} />
        </div>
        <div className="glass rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><TrendingUp size={16} className="text-vault-400" /> Usuários Mais Ativos</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><p className="text-[10px] text-slate-500 mb-2">Mais logins</p><MiniRank data={bi.topUserLogins} color="text-vault-400" /></div>
            <div><p className="text-[10px] text-slate-500 mb-2">Mais visualizações</p><MiniRank data={bi.topUserViews} color="text-amber-400" /></div>
          </div>
        </div>
      </div>

      {/* Gráficos - Linha 4 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="glass rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Monitor size={16} className="text-vault-400" /> Top IPs</h3>
          <RankList data={bi.topIps} barColor="bg-cyan-500/60" />
        </div>
        <div className="glass rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Building2 size={16} className="text-vault-400" /> Senhas por Organização</h3>
          <RankList data={bi.passwordsByOrg} barColor="bg-green-500/60" />
        </div>
        <div className="glass rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Activity size={16} className="text-vault-400" /> Tipos de Ação</h3>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {(bi.actionCounts || []).map((a: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-slate-400 truncate">{a.label}</span>
                <span className="text-vault-300 font-medium ml-2 flex-shrink-0">{a.count as number}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Matrizes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="glass rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><UserCheck size={16} className="text-vault-400" /> Senhas Mais Vistas por Usuário</h3>
          <MatrixList data={bi.userTopPasswords} labelKey="name" itemKey="items" colorClass="text-amber-400" />
        </div>
        <div className="glass rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Key size={16} className="text-vault-400" /> Quem Mais Visualiza Cada Senha</h3>
          <MatrixList data={bi.passwordTopUsers} labelKey="name" itemKey="items" colorClass="text-vault-400" />
        </div>
      </div>

      {/* Atividade Recente */}
      <div className="glass rounded-xl overflow-hidden mb-6">
        <div className="p-4 border-b border-vault-700/30"><h2 className="font-semibold text-sm">Atividade Recente</h2></div>
        <div className="divide-y divide-vault-700/20">
          {(data.recentActivity || []).map((log: any) => {
            const Icon = AI[log.action] || Activity;
            return <div key={log.id} className="flex items-center gap-3 p-3 hover:bg-vault-800/20"><div className="w-8 h-8 rounded-lg bg-vault-800/50 flex items-center justify-center flex-shrink-0"><Icon size={14} className="text-vault-400" /></div>
              <div className="flex-1 min-w-0"><p className="text-sm"><span className="font-medium">{log.user_name || 'Sistema'}</span> <span className="text-slate-400">{AL[log.action] || log.action}</span>{log.resource_name && <span className="text-vault-300"> "{log.resource_name}"</span>}</p>
                <div className="flex items-center gap-2 text-[10px] text-slate-600"><Clock size={10} /> {new Date(log.created_at).toLocaleString('pt-BR')}{log.ip_address && <span>• {log.ip_address}</span>}</div></div></div>;
          })}
        </div>
      </div>

      {/* Usuários */}
      <div className="glass rounded-xl overflow-hidden">
        <div className="p-4 border-b border-vault-700/30"><h2 className="font-semibold text-sm">Usuários</h2></div>
        <div className="divide-y divide-vault-700/20">
          {(data.users || []).map((u: any) => (
            <div key={u.id} className="flex items-center gap-3 p-3">
              <div className={'w-2 h-2 rounded-full ' + (u.is_active ? 'bg-green-400' : 'bg-red-400')} />
              {u.avatar_url && <img src={u.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />}
              <div className="flex-1"><p className="text-sm font-medium">{u.full_name}</p><p className="text-[10px] text-slate-600">Último login: {u.last_login ? new Date(u.last_login).toLocaleString('pt-BR') : 'Nunca'}</p></div>
              <span className={'text-[10px] px-2 py-0.5 rounded-full ' + (u.is_active ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400')}>{u.is_active ? 'Ativo' : 'Inativo'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChartBar({ title, icon: Icon, data, xKey, yKey, color, labelEvery = 0, showAllLabels = false }: any) {
  const items = data || []; const max = Math.max(...items.map((d: any) => d[yKey]), 1);
  return <div className="glass rounded-xl p-4">
    <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Icon size={16} className="text-vault-400" /> {title}</h3>
    <div className="h-36 flex items-end gap-[2px]">
      {items.map((d: any, i: number) => { const h = (d[yKey] / max) * 100;
        return <div key={i} className="flex-1 flex flex-col items-center group relative">
          <div className={'w-full rounded-t transition-all hover:opacity-100 opacity-70 bg-' + color + '-500/60'} style={{ height: Math.max(h, d[yKey] > 0 ? 3 : 1) + '%' }} />
          <div className="hidden group-hover:block absolute -top-8 bg-vault-800 text-white text-[9px] px-2 py-1 rounded whitespace-nowrap z-10">{d[xKey]}: {d[yKey]}</div>
          {showAllLabels && <span className="text-[7px] text-slate-600 mt-1">{d[xKey]}</span>}
          {labelEvery > 0 && i % labelEvery === 0 && <span className="text-[7px] text-slate-600 mt-1">{d[xKey]}</span>}
        </div>;
      })}
    </div>
    {!showAllLabels && labelEvery === 0 && items.length > 0 && <div className="flex justify-between mt-1"><span className="text-[8px] text-slate-600">{items[0]?.[xKey]}</span><span className="text-[8px] text-slate-600">{items[items.length - 1]?.[xKey]}</span></div>}
  </div>;
}

function RankList({ data, barColor = 'bg-amber-500/60' }: any) {
  const items = data || []; const max = Math.max(...items.map((x: any) => x.count), 1);
  if (!items.length) return <p className="text-xs text-slate-500 text-center py-4">Sem dados</p>;
  return <div className="space-y-2 max-h-48 overflow-y-auto">{items.map((p: any, i: number) => <div key={i} className="flex items-center gap-3"><span className="text-[10px] text-slate-500 w-4 text-right">{i + 1}</span>
    <div className="flex-1"><div className="flex items-center justify-between mb-0.5"><span className="text-xs font-medium truncate">{p.name}</span><span className="text-[10px] text-slate-400">{p.count as number}x</span></div>
      <div className="h-1.5 bg-vault-900/50 rounded-full overflow-hidden"><div className={'h-full rounded-full ' + barColor} style={{ width: (p.count / max * 100) + '%' }} /></div></div></div>)}</div>;
}

function MiniRank({ data, color }: any) {
  if (!data?.length) return <p className="text-xs text-slate-500">Sem dados</p>;
  return <>{data.map((u: any, i: number) => <div key={i} className="flex items-center justify-between py-1"><span className="text-xs truncate">{u.name}</span><span className={'text-[10px] font-medium ' + color}>{u.count as number}</span></div>)}</>;
}

function MatrixList({ data, labelKey, itemKey, colorClass }: any) {
  if (!data?.length) return <p className="text-xs text-slate-500 text-center py-4">Sem dados</p>;
  return <div className="space-y-3 max-h-60 overflow-y-auto">{data.map((item: any, i: number) => <div key={i}>
    <p className="text-xs font-medium text-vault-300 mb-1">{item[labelKey]}</p>
    {item[itemKey].map((sub: any, j: number) => <div key={j} className="flex items-center justify-between ml-3 text-[10px] text-slate-400"><span>{sub.name}</span><span className={colorClass}>{sub.count}x</span></div>)}
  </div>)}</div>;
}
