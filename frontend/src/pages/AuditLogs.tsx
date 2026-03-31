import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { ScrollText, Download, Loader2, ChevronLeft, ChevronRight, Filter, Clock, Activity, X, Globe, Monitor, MapPin } from 'lucide-react';

function friendlyAction(log: any): string {
  const n = log.resource_name ? ' "' + log.resource_name + '"' : '';
  const map: any = {
    LOGIN: 'fez login no sistema', LOGOUT: 'saiu do sistema', PASSWORD_VIEWED: 'visualizou a senha' + n,
    PASSWORD_CREATED: 'criou a senha' + n, PASSWORD_CHANGED: 'alterou a senha' + n,
    PASSWORD_UPDATED: 'atualizou dados da senha' + n, PASSWORD_DELETED: 'removeu a senha' + n,
    PASSWORD_SELF_CHANGED: 'trocou a própria senha de login', USER_CREATED: 'criou o usuário' + n,
    USER_ACTIVATED: 'ativou o usuário' + n, USER_DEACTIVATED: 'desativou o usuário' + n,
    USER_DELETED: 'excluiu o usuário' + n, USER_PASSWORD_RESET: 'redefiniu a senha de' + n,
    '2FA_ENABLED': 'ativou autenticação de dois fatores', '2FA_DISABLED': 'desativou autenticação de dois fatores',
    PROFILE_UPDATED: 'atualizou o perfil', TERM_ACCEPTED: 'aceitou o termo de uso',
    GROUP_CREATED: 'criou o grupo' + n, GROUP_UPDATED: 'atualizou o grupo' + n, GROUP_DELETED: 'excluiu o grupo' + n,
    SCREENSHOT_ATTEMPT: 'tentou capturar a tela', USER_SCHEDULE_UPDATED: 'atualizou horário de acesso de' + n,
  };
  return map[log.action] || log.action + n;
}

function actionColor(action: string): string {
  if (action === 'LOGIN') return 'text-green-400 bg-green-500/10';
  if (action === 'LOGOUT') return 'text-slate-400 bg-slate-500/10';
  if (action.includes('VIEWED')) return 'text-blue-400 bg-blue-500/10';
  if (action.includes('DELETED') || action.includes('DEACTIVATED')) return 'text-red-400 bg-red-500/10';
  if (action.includes('CHANGED') || action.includes('RESET')) return 'text-amber-400 bg-amber-500/10';
  if (action.includes('CREATED') || action.includes('ACTIVATED')) return 'text-emerald-400 bg-emerald-500/10';
  if (action === 'SCREENSHOT_ATTEMPT') return 'text-red-400 bg-red-500/10';
  return 'text-vault-400 bg-vault-500/10';
}

function parseUA(ua: string | null): { browser: string; device: string } {
  if (!ua) return { browser: 'Desconhecido', device: 'Desconhecido' };
  let b = 'Navegador desconhecido', d = 'Desktop';
  if (ua.includes('Chrome') && !ua.includes('Edg')) b = 'Chrome';
  else if (ua.includes('Edg')) b = 'Edge';
  else if (ua.includes('Firefox')) b = 'Firefox';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) b = 'Safari';
  if (ua.includes('Mobile') || ua.includes('Android')) d = 'Mobile';
  else if (ua.includes('iPad')) d = 'Tablet';
  if (ua.includes('Windows')) d += ' (Windows)';
  else if (ua.includes('Mac')) d += ' (Mac)';
  else if (ua.includes('Linux') && !ua.includes('Android')) d += ' (Linux)';
  else if (ua.includes('Android')) d += ' (Android)';
  else if (ua.includes('iPhone') || ua.includes('iPad')) d += ' (iOS)';
  return { browser: b, device: d };
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<any[]>([]); const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1); const [total, setTotal] = useState(0);
  const [filterAction, setFilterAction] = useState(''); const [selectedLog, setSelectedLog] = useState<any>(null);
  const limit = 30;

  useEffect(() => { load(); }, [page, filterAction]);

  async function load() {
    setLoading(true);
    try { let url = '/admin/audit-logs?page=' + page + '&limit=' + limit; if (filterAction) url += '&action=' + filterAction;
      const d = await api.get(url); setLogs(d.logs); setTotal(d.total);
    } catch {} finally { setLoading(false); }
  }

  async function exportCSV() {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/reports/export-csv', { headers: { Authorization: 'Bearer ' + token } });
      const blob = await res.blob(); const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'audit-logs.csv'; a.click();
    } catch {}
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div><h1 className="text-xl font-bold">Logs de Auditoria</h1><p className="text-sm text-slate-500">{total} registros</p></div>
        <button onClick={exportCSV} className="flex items-center gap-2 glass hover:bg-vault-800/50 px-4 py-2.5 rounded-xl text-sm"><Download size={16} /> Exportar CSV</button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <Filter size={16} className="text-slate-500" />
        <select value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(1); }}
          className="bg-vault-900/50 border border-vault-700/30 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-vault-500 appearance-none">
          <option value="">Todas as ações</option>
          <option value="LOGIN">Login</option><option value="LOGOUT">Logout</option>
          <option value="PASSWORD_VIEWED">Visualizou senha</option><option value="PASSWORD_CREATED">Criou senha</option>
          <option value="PASSWORD_CHANGED">Alterou senha</option><option value="PASSWORD_DELETED">Removeu senha</option>
          <option value="PASSWORD_SELF_CHANGED">Trocou própria senha</option>
          <option value="USER_CREATED">Criou usuário</option><option value="USER_DELETED">Excluiu usuário</option>
          <option value="TERM_ACCEPTED">Aceitou termo</option><option value="SCREENSHOT_ATTEMPT">Tentou capturar tela</option>
        </select>
      </div>

      {loading ? <div className="flex items-center justify-center h-32"><Loader2 size={24} className="animate-spin text-vault-400" /></div> : <>
        <div className="glass rounded-xl overflow-hidden">
          <div className="divide-y divide-vault-700/20">
            {logs.map(log => {
              const colors = actionColor(log.action);
              return <div key={log.id} className="p-3 hover:bg-vault-800/20 cursor-pointer" onClick={() => setSelectedLog(log)}>
                <div className="flex items-start gap-3">
                  <div className={'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ' + colors}><Activity size={14} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm"><span className="font-medium">{log.user_name || 'Sistema'}</span> <span className="text-slate-400">{friendlyAction(log)}</span></p>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-[10px] text-slate-600">
                      <span className="flex items-center gap-1"><Clock size={10} />{new Date(log.created_at).toLocaleString('pt-BR')}</span>
                      {log.ip_address && <span>• IP: {log.ip_address}</span>}
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-600">Detalhes →</span>
                </div>
              </div>;
            })}
            {logs.length === 0 && <div className="text-center py-12 text-slate-500 text-sm">Nenhum log encontrado</div>}
          </div>
        </div>
        {totalPages > 1 && <div className="flex items-center justify-center gap-4 mt-6">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 glass rounded-lg disabled:opacity-30"><ChevronLeft size={16} /></button>
          <span className="text-sm text-slate-400">{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 glass rounded-lg disabled:opacity-30"><ChevronRight size={16} /></button>
        </div>}
      </>}

      {/* Modal detalhes */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setSelectedLog(null)}>
          <div className="w-full max-w-lg glass rounded-2xl shadow-2xl animate-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-vault-700/30"><h2 className="font-semibold">Detalhes do Log</h2><button onClick={() => setSelectedLog(null)} className="p-1"><X size={18} /></button></div>
            <div className="p-5 space-y-4">
              <div className={'px-3 py-2 rounded-lg ' + actionColor(selectedLog.action)}>
                <p className="text-sm font-medium">{selectedLog.user_name || 'Sistema'} {friendlyAction(selectedLog)}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <IBox label="Data e Hora" value={new Date(selectedLog.created_at).toLocaleString('pt-BR')} icon={Clock} />
                <IBox label="Endereço IP" value={selectedLog.ip_address || 'Não registrado'} icon={Globe} />
                {(() => { const ua = parseUA(selectedLog.user_agent); return <><IBox label="Navegador" value={ua.browser} icon={Monitor} /><IBox label="Dispositivo" value={ua.device} icon={MapPin} /></>; })()}
              </div>
              {selectedLog.resource_name && <div className="bg-vault-900/40 rounded-lg p-3"><p className="text-[10px] text-slate-500 mb-1">Recurso</p><p className="text-sm">{selectedLog.resource_type}: <span className="text-vault-300 font-medium">{selectedLog.resource_name}</span></p></div>}
              {selectedLog.details && Object.keys(selectedLog.details).length > 0 && <div className="bg-vault-900/40 rounded-lg p-3"><p className="text-[10px] text-slate-500 mb-1">Detalhes</p>{Object.entries(selectedLog.details).map(([k, v]: any) => <p key={k} className="text-xs text-slate-400"><span className="text-slate-500">{k}:</span> {String(v)}</p>)}</div>}
              {selectedLog.user_agent && <div className="bg-vault-900/40 rounded-lg p-3"><p className="text-[10px] text-slate-500 mb-1">User Agent</p><p className="text-[10px] text-slate-600 break-all">{selectedLog.user_agent}</p></div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function IBox({ label, value, icon: Icon }: any) {
  return <div className="bg-vault-900/40 rounded-lg p-3"><div className="flex items-center gap-1 mb-1"><Icon size={10} className="text-slate-500" /><p className="text-[10px] text-slate-500">{label}</p></div><p className="text-sm font-medium">{value}</p></div>;
}
