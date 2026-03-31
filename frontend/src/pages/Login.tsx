import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getDefaultRoute } from '../lib/access';
import { api } from '../lib/api';
import { Shield, Eye, EyeOff, Loader2, Mail, Lock, KeyRound, AlertTriangle } from 'lucide-react';

export default function Login() {
  const { login, inactivityLogout, clearInactivity } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [totp, setTotp] = useState('');
  const [showPw, setShowPw] = useState(false); const [needs2FA, setNeeds2FA] = useState(false);
  const [loading, setLoading] = useState(false); const [err, setErr] = useState('');
  const [forgot, setForgot] = useState(false); const [forgotSent, setForgotSent] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setErr(''); clearInactivity();
    try {
      const d = await login(email, pw, needs2FA ? totp : undefined);
      if (d.requires2FA) setNeeds2FA(true);
      else nav(getDefaultRoute(d.user));
    } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  }
  async function handleForgot(e: React.FormEvent) {
    e.preventDefault(); setLoading(true);
    try { await api.post('/auth/forgot-password', { email }); setForgotSent(true); } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-vault-950 via-[#0c1222] to-slate-950" />
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-vault-600/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-vault-500/10 rounded-full blur-3xl" />
      <div className="relative w-full max-w-md animate-in">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-vault-500 to-vault-700 flex items-center justify-center mb-4 pulse-glow shadow-xl shadow-vault-500/20"><Shield size={32} className="text-white" /></div>
          <h1 className="text-2xl font-bold">Cofre de Senhas</h1>
          <p className="text-slate-500 text-sm mt-1">Departamento de TI</p>
        </div>
        {inactivityLogout && (
          <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-xl animate-in">
            <AlertTriangle size={18} className="text-amber-400 flex-shrink-0" />
            <p className="text-sm text-amber-300">Por quest\u00f5es de seguran\u00e7a, voc\u00ea foi deslogado por inatividade. Fa\u00e7a login novamente.</p>
          </div>
        )}
        <div className="glass rounded-2xl p-6 shadow-2xl">
          {forgot ? (
            <form onSubmit={handleForgot} className="space-y-4">
              <h2 className="text-lg font-semibold text-center">Recuperar Senha</h2>
              {forgotSent ? <div className="text-center py-4"><Mail size={40} className="mx-auto text-vault-400 mb-3" /><p className="text-sm text-slate-300">Link enviado se o email existir.</p><button type="button" onClick={() => { setForgot(false); setForgotSent(false); }} className="mt-4 text-vault-400 text-sm hover:underline">Voltar</button></div> : <>
                <div className="relative"><Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-vault-500" placeholder="seu@email.com" required /></div>
                {err && <p className="text-red-400 text-xs">{err}</p>}
                <button type="submit" disabled={loading} className="w-full bg-vault-600 hover:bg-vault-500 text-white py-3 rounded-xl font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2">{loading ? <Loader2 size={16} className="animate-spin" /> : 'Enviar'}</button>
                <button type="button" onClick={() => setForgot(false)} className="w-full text-slate-500 text-sm">Voltar</button>
              </>}
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <h2 className="text-lg font-semibold text-center">{needs2FA ? 'Verifica\u00e7\u00e3o 2FA' : 'Entrar'}</h2>
              {!needs2FA ? <>
                <div className="relative"><Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-vault-500" placeholder="seu@email.com" required autoFocus /></div>
                <div className="relative"><Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input type={showPw ? 'text' : 'password'} value={pw} onChange={e => setPw(e.target.value)} className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl pl-10 pr-10 py-3 text-sm focus:outline-none focus:border-vault-500" placeholder="Senha" required /><button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">{showPw ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
              </> : <div className="space-y-3"><KeyRound size={32} className="mx-auto text-vault-400" /><p className="text-sm text-slate-400 text-center">C\u00f3digo do autenticador</p>
                <input type="text" value={totp} onChange={e => setTotp(e.target.value.replace(/\D/g, '').slice(0, 6))} className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-4 py-3 text-center text-2xl font-mono tracking-[0.5em] focus:outline-none focus:border-vault-500" placeholder="000000" maxLength={6} required autoFocus /></div>}
              {err && <p className="text-red-400 text-xs text-center">{err}</p>}
              <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-vault-600 to-vault-500 hover:from-vault-500 hover:to-vault-400 text-white py-3 rounded-xl font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-vault-600/20">{loading && <Loader2 size={16} className="animate-spin" />}{needs2FA ? 'Verificar' : 'Entrar'}</button>
              {!needs2FA && <button type="button" onClick={() => setForgot(true)} className="w-full text-slate-500 text-sm hover:text-vault-400">Esqueci minha senha</button>}
              {needs2FA && <button type="button" onClick={() => { setNeeds2FA(false); setTotp(''); }} className="w-full text-slate-500 text-sm">Voltar</button>}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
