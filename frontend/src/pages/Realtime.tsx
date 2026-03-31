import React, { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { Activity, Eye, LogIn, Clock, Loader2, Radio, Zap, Timer, Monitor, Globe, Key, LogOut, Shield, User } from 'lucide-react';

const AL: any = { LOGIN:'fez login', LOGOUT:'saiu', PASSWORD_VIEWED:'visualizou senha', PASSWORD_CREATED:'criou senha', PASSWORD_CHANGED:'alterou senha', PASSWORD_SELF_CHANGED:'trocou senha', PROFILE_UPDATED:'atualizou perfil', TERM_ACCEPTED:'aceitou termo', SCREENSHOT_ATTEMPT:'tentou capturar tela', USER_CREATED:'criou usuário', PASSWORD_DELETED:'removeu senha', GROUP_CREATED:'criou grupo' };
const ICON_MAP: any = { LOGIN: LogIn, LOGOUT: LogOut, PASSWORD_VIEWED: Eye, PASSWORD_CREATED: Key, PASSWORD_CHANGED: Shield, SCREENSHOT_ATTEMPT: Monitor };
const MODULE_LABELS: any = { '/passwords':'Senhas', '/admin/dashboard':'Dashboard', '/admin/users':'Usuários', '/admin/realtime':'Tempo Real', '/admin/groups':'Grupos', '/admin/organizations':'Organização', '/admin/terms':'Termos LGPD', '/admin/logs':'Logs', '/settings':'Configurações', '/password-requests':'Solicitações', login:'Login', browsing:'Navegando', browsing_passwords:'Senhas' };

function fmtDuration(secs: number): string {
  if (secs < 60) return secs + 's';
  const m = Math.floor(secs / 60); const s = secs % 60;
  if (m < 60) return m + 'min ' + s + 's';
  const h = Math.floor(m / 60); return h + 'h ' + (m % 60) + 'min';
}

function parseAction(s: any): string {
  const act = s.current_action || 'online';
  if (act.startsWith('viewed_password:')) return 'Visualizou: ' + act.split(':').slice(1).join(':');
  const mod = s.current_module || '';
  if (MODULE_LABELS[mod]) return MODULE_LABELS[mod];
  if (MODULE_LABELS[act]) return MODULE_LABELS[act];
  return act === 'online' ? 'Navegando' : act;
}

export default function Realtime() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const iv = useRef<any>(null);
  const tickRef = useRef<any>(null);

  useEffect(() => {
    loadAll();
    iv.current = setInterval(loadAll, 5000);
    tickRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(iv.current); clearInterval(tickRef.current); };
  }, []);

  async function loadAll() {
    try {
      const [s, t, a, st] = await Promise.all([
        api.get('/realtime/sessions'), api.get('/realtime/timeline'),
        api.get('/realtime/activity'), api.get('/realtime/stats'),
      ]);
      setSessions(s.sessions); setTimeline(t.timeline); setActivity(a.activity); setStats(st);
    } catch {} finally { setLoading(false); }
  }

  const maxEv = Math.max(...timeline.map((t: any) => t.events), 1);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 size={32} className="animate-spin text-vault-400" /></div>;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative"><div className="w-4 h-4 rounded-full bg-green-400 animate-pulse" /><div className="absolute inset-0 w-4 h-4 rounded-full bg-green-400 animate-ping opacity-30" /></div>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-green-300 to-vault-400 bg-clip-text text-transparent">Tempo Real</h1>
        <span className="text-xs text-slate-500 bg-vault-900/50 px-2 py-1 rounded-full">Atualiza a cada 5s</span>
      </div>

      {/* Stats rápidos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Online Agora', value: sessions.length, icon: Radio, color: 'text-green-400', bg: 'from-green-500/20 to-green-600/5' },
          { label: 'Logins Hoje', value: stats.todayLogins || 0, icon: LogIn, color: 'text-blue-400', bg: 'from-blue-500/20 to-blue-600/5' },
          { label: 'Visualizações Hoje', value: stats.todayViews || 0, icon: Eye, color: 'text-amber-400', bg: 'from-amber-500/20 to-amber-600/5' },
          { label: 'Tempo Médio', value: fmtDuration(stats.avgSessionSeconds || 0), icon: Timer, color: 'text-cyan-400', bg: 'from-cyan-500/20 to-cyan-600/5' },
        ].map((s, i) => (
          <div key={i} className="glass rounded-xl p-4 relative overflow-hidden">
            <div className={'absolute inset-0 bg-gradient-to-br ' + s.bg + ' opacity-50'} />
            <div className="relative"><s.icon size={18} className={s.color + ' mb-2'} /><p className="text-xl font-bold">{s.value}</p><p className="text-[10px] text-slate-500 uppercase tracking-wider">{s.label}</p></div>
          </div>
        ))}
      </div>

      {/* Usuários Online — Cards */}
      <div className="glass rounded-xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-4"><Radio size={18} className="text-green-400" /><h2 className="font-bold text-sm">{sessions.length} usuário(s) online agora</h2></div>
        {sessions.length === 0 ? <p className="text-sm text-slate-500 text-center py-6">Nenhum usuário online no momento</p> :
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sessions.map((s: any) => {
              const onlineSecs = Math.max(0, Math.floor((now - new Date(s.started_at).getTime()) / 1000));
              const idleSecs = Math.max(0, Math.floor((now - new Date(s.last_activity).getTime()) / 1000));
              const isIdle = idleSecs > 120;
              return (
                <div key={s.id} className={'rounded-xl p-4 border transition-all ' + (isIdle ? 'bg-vault-900/30 border-vault-700/20' : 'bg-vault-900/60 border-vault-600/30 shadow-lg shadow-vault-500/5')}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-vault-600 flex items-center justify-center text-white font-bold text-sm">{(s.user_name || '?').charAt(0).toUpperCase()}</div>
                      <div className={'absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-vault-950 ' + (isIdle ? 'bg-amber-400' : 'bg-green-400 animate-pulse')} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{s.user_name}</p>
                      <p className="text-[10px] text-slate-500">{isIdle ? 'Inativo' : 'Ativo'}</p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs"><Zap size={12} className="text-vault-400 flex-shrink-0" /><span className="text-slate-300 truncate">{parseAction(s)}</span></div>
                    <div className="flex items-center gap-2 text-xs"><Timer size={12} className="text-cyan-400 flex-shrink-0" /><span className="text-slate-400">Online há <span className="text-cyan-300 font-medium">{fmtDuration(onlineSecs)}</span></span></div>
                    {s.ip_address && <div className="flex items-center gap-2 text-xs"><Globe size={12} className="text-slate-500 flex-shrink-0" /><span className="text-slate-500">{s.ip_address}</span></div>}
                  </div>
                </div>
              );
            })}
          </div>}
      </div>

      {/* Timeline de Atividade */}
      <div className="glass rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-sm flex items-center gap-2"><Activity size={18} className="text-vault-400" /> Atividade (últimas 2 horas)</h2>
          <span className="text-[10px] text-slate-500 bg-vault-900/50 px-2 py-1 rounded-full">{timeline.reduce((a: number, t: any) => a + t.events, 0)} eventos</span>
        </div>
        <div className="h-36 flex items-end gap-[1px]">
          {timeline.map((t: any, i: number) => {
            const h = (t.events / maxEv) * 100; const has = t.events > 0;
            return <div key={i} className="flex-1 flex flex-col items-center group relative">
              <div className={'w-full rounded-t transition-all ' + (has ? 'bg-gradient-to-t from-vault-600/80 to-vault-400/60 hover:from-vault-500 hover:to-vault-300' : 'bg-vault-900/30')} style={{ height: Math.max(h, has ? 4 : 1) + '%' }} />
              {has && <div className="hidden group-hover:block absolute -top-20 bg-vault-800 text-white text-[9px] px-3 py-2 rounded-lg whitespace-nowrap z-10 shadow-xl max-w-56">
                <p className="font-bold text-vault-300 mb-1">{t.time} — {t.events} evento(s)</p>
                {t.details.slice(0, 4).map((d: any, j: number) => <p key={j} className="text-slate-300"><span className="text-white">{d.user}:</span> {AL[d.action] || d.action}{d.resource ? ' "' + d.resource + '"' : ''}</p>)}
                {t.details.length > 4 && <p className="text-slate-400 mt-1">+{t.details.length - 4} mais</p>}
              </div>}
            </div>;
          })}
        </div>
        <div className="flex justify-between mt-1"><span className="text-[8px] text-slate-600">{timeline[0]?.time}</span><span className="text-[8px] text-slate-600">Agora</span></div>
      </div>

      {/* Feed de Atividade em Tempo Real */}
      <div className="glass rounded-xl overflow-hidden">
        <div className="p-4 border-b border-vault-700/30"><h2 className="font-bold text-sm flex items-center gap-2"><Clock size={18} className="text-vault-400" /> Feed — Últimos 5 minutos</h2></div>
        <div className="divide-y divide-vault-700/20 max-h-[500px] overflow-y-auto">
          {activity.length === 0 ? <p className="p-6 text-sm text-slate-500 text-center">Nenhuma atividade recente</p> :
            activity.map((a: any) => {
              const Icon = ICON_MAP[a.action] || Activity;
              const colorMap: any = { LOGIN:'bg-green-500/10 text-green-400', LOGOUT:'bg-slate-500/10 text-slate-400', PASSWORD_VIEWED:'bg-blue-500/10 text-blue-400', PASSWORD_CREATED:'bg-emerald-500/10 text-emerald-400', PASSWORD_CHANGED:'bg-amber-500/10 text-amber-400', SCREENSHOT_ATTEMPT:'bg-red-500/10 text-red-400' };
              const col = colorMap[a.action] || 'bg-vault-500/10 text-vault-400';
              return (
                <div key={a.id} className="flex items-center gap-3 p-3 hover:bg-vault-800/20 transition-colors">
                  <div className={'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ' + col}><Icon size={15} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm"><span className="font-semibold">{a.user_name || 'Sistema'}</span> <span className="text-slate-400">{AL[a.action] || a.action}</span>{a.resource_name && <span className="text-vault-300 font-medium"> "{a.resource_name}"</span>}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-600">
                      <span>{new Date(a.created_at).toLocaleTimeString('pt-BR')}</span>
                      {a.ip_address && <span>• {a.ip_address}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
