import React, { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getRoleLabel, hasPermission } from '../lib/access';
import { api } from '../lib/api';
import { ShieldCheck, ShieldOff, Loader2, Lock, QrCode, CheckCircle2, Camera, User, Bell, Download } from 'lucide-react';

export default function Settings() {
  const { user, updateUser } = useAuth();
  const [loading2FA, setLoading2FA] = useState(false);
  const [setup2FA, setSetup2FA] = useState<{ secret: string; qrCodeUrl: string } | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [changingPw, setChangingPw] = useState(false); const [newPw, setNewPw] = useState('');
  const [displayName, setDisplayName] = useState(user?.display_name || user?.full_name || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar_url || '');
  const [emailNotif, setEmailNotif] = useState(user?.email_notifications || false);
  const [toast, setToast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 2 * 1024 * 1024) { showToast('Imagem deve ter no máximo 2MB'); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string; setAvatarPreview(dataUrl);
      try { await api.put('/auth/profile', { avatar_url: dataUrl }); await updateUser(); showToast('Avatar atualizado!'); }
      catch (err: any) { showToast(err.message); }
    };
    reader.readAsDataURL(file);
  }

  async function saveDisplayName() {
    setSavingProfile(true);
    try { await api.put('/auth/profile', { display_name: displayName }); await updateUser(); showToast('Nome atualizado!'); }
    catch (err: any) { showToast(err.message); } finally { setSavingProfile(false); }
  }

  async function toggleEmailNotif() {
    const newVal = !emailNotif; setEmailNotif(newVal);
    try { await api.put('/auth/profile', { email_notifications: newVal }); await updateUser(); showToast(newVal ? 'Notificações por email ativadas' : 'Notificações por email desativadas'); }
    catch (err: any) { showToast(err.message); setEmailNotif(!newVal); }
  }

  async function downloadReport() {
    try {
      const token = localStorage.getItem('token');
      const url = hasPermission(user, 'dashboard.view') || hasPermission(user, 'audit_logs.view') ? '/api/reports/admin?days=30' : '/api/reports/user?days=30';
      const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
      const blob = await res.blob();
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'relatorio-cofre-senhas.pdf'; a.click();
      URL.revokeObjectURL(a.href); showToast('Relatório baixado!');
    } catch { showToast('Erro ao baixar relatório'); }
  }

  async function startSetup2FA() { setLoading2FA(true); try { const d = await api.post('/auth/setup-2fa'); setSetup2FA(d); } catch (err: any) { showToast(err.message); } finally { setLoading2FA(false); } }
  async function verify2FA(e: React.FormEvent) {
    e.preventDefault(); setLoading2FA(true);
    try { await api.post('/auth/verify-2fa', { secret: setup2FA!.secret, token: verifyCode }); setSetup2FA(null); setVerifyCode(''); await updateUser(); showToast('2FA ativado!'); }
    catch (err: any) { showToast(err.message); } finally { setLoading2FA(false); }
  }
  async function disable2FA() {
    if (!confirm('Tem certeza que deseja desativar a autenticação de dois fatores?')) return;
    setLoading2FA(true); try { await api.post('/auth/disable-2fa'); await updateUser(); showToast('2FA desativado'); } catch (err: any) { showToast(err.message); } finally { setLoading2FA(false); }
  }
  async function changePassword(e: React.FormEvent) {
    e.preventDefault(); setChangingPw(true);
    try { await api.post('/auth/update-password', { password: newPw }); setNewPw(''); await updateUser(); showToast('Senha atualizada!'); }
    catch (err: any) { showToast(err.message); } finally { setChangingPw(false); }
  }

  function showToast(m: string) { setToast(m); setTimeout(() => setToast(null), 3000); }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-6">Configurações</h1>

      {/* Perfil */}
      <div className="glass rounded-xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-4"><User size={18} className="text-vault-400" /><h2 className="font-semibold text-sm">Perfil</h2></div>
        <div className="flex items-center gap-5 mb-5">
          <div className="relative group cursor-pointer" onClick={() => fileRef.current?.click()}>
            {avatarPreview ? <img src={avatarPreview} alt="" className="w-20 h-20 rounded-2xl object-cover border-2 border-vault-600/30" /> :
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-vault-500 to-vault-700 flex items-center justify-center text-white font-bold text-2xl">{(displayName || user?.full_name)?.charAt(0)?.toUpperCase()}</div>}
            <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Camera size={20} className="text-white" /></div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
          </div>
          <div className="flex-1"><p className="text-xs text-slate-400">Clique na foto para alterar</p><p className="text-[10px] text-slate-500">Máximo 2MB. JPG, PNG</p></div>
        </div>
        <div className="space-y-3">
          <div><label className="text-xs text-slate-400 mb-1 block">Nome de Exibição</label>
            <div className="flex gap-2">
              <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} className="flex-1 bg-vault-900/50 border border-vault-700/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-vault-500" placeholder="Como você quer ser chamado" />
              <button onClick={saveDisplayName} disabled={savingProfile} className="bg-vault-600 hover:bg-vault-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50">{savingProfile ? <Loader2 size={14} className="animate-spin" /> : 'Salvar'}</button>
            </div>
          </div>
          <div className="text-xs text-slate-500"><p>Email: {user?.email}</p><p>Cargo: {getRoleLabel(user?.role)}</p>{user?.cpf && <p>CPF: {user.cpf}</p>}</div>
        </div>
      </div>

      {/* Notificações por email */}
      <div className="glass rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><Bell size={18} className="text-vault-400" /><div><h2 className="font-semibold text-sm">Notificações por Email</h2><p className="text-xs text-slate-500">Receba alertas de eventos críticos por email</p></div></div>
          <button onClick={toggleEmailNotif} className={'w-12 h-7 rounded-full transition-colors relative ' + (emailNotif ? 'bg-vault-500' : 'bg-vault-800/50')}>
            <div className={'w-5 h-5 rounded-full bg-white absolute top-1 transition-all ' + (emailNotif ? 'left-6' : 'left-1')} />
          </button>
        </div>
      </div>

      {/* Relatório */}
      <div className="glass rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><Download size={18} className="text-vault-400" /><div><h2 className="font-semibold text-sm">Relatório Mensal</h2><p className="text-xs text-slate-500">Baixe um PDF com suas atividades dos últimos 30 dias</p></div></div>
          <button onClick={downloadReport} className="flex items-center gap-2 bg-vault-600 hover:bg-vault-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium"><Download size={14} /> Baixar PDF</button>
        </div>
      </div>

      {/* Alterar Senha */}
      <div className="glass rounded-xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-4"><Lock size={18} className="text-vault-400" /><h2 className="font-semibold text-sm">Alterar Senha de Login</h2></div>
        {user?.password_days_left !== null && user?.password_days_left !== undefined && (
          <div className={'mb-3 px-3 py-2 rounded-lg text-xs ' + (user.password_days_left <= 5 ? 'bg-red-500/10 border border-red-500/20 text-red-300' : user.password_days_left <= 15 ? 'bg-amber-500/10 border border-amber-500/20 text-amber-300' : 'bg-vault-800/50 text-slate-400')}>
            Sua senha expira em {user.password_days_left} dia(s). Validade: {user.password_expires_days} dias.
          </div>
        )}
        <form onSubmit={changePassword} className="space-y-3">
          <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-vault-500" placeholder="Nova senha (mínimo 6 caracteres)" required minLength={6} />
          <button type="submit" disabled={changingPw} className="bg-vault-600 hover:bg-vault-500 text-white px-6 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 flex items-center gap-2">{changingPw && <Loader2 size={14} className="animate-spin" />} Alterar Senha</button>
        </form>
      </div>

      {/* 2FA */}
      <div className="glass rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4"><ShieldCheck size={18} className="text-vault-400" /><h2 className="font-semibold text-sm">Autenticação de Dois Fatores (2FA)</h2></div>
        {user?.totp_enabled ? (
          <div>
            <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-lg"><CheckCircle2 size={14} className="text-green-400" /><span className="text-sm text-green-300">2FA está ativo</span></div>
            <button onClick={disable2FA} disabled={loading2FA} className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 px-4 py-2.5 rounded-xl text-sm">{loading2FA ? <Loader2 size={14} className="animate-spin" /> : <ShieldOff size={14} />} Desativar 2FA</button>
          </div>
        ) : setup2FA ? (
          <form onSubmit={verify2FA} className="space-y-4">
            <p className="text-sm text-slate-400">Escaneie o QR Code com Google Authenticator, Authy, etc:</p>
            <div className="flex justify-center p-4 bg-white rounded-xl"><img src={setup2FA.qrCodeUrl} alt="QR" className="w-48 h-48" /></div>
            <div className="text-center"><p className="text-[10px] text-slate-500 mb-1">Ou insira manualmente:</p><code className="text-xs text-vault-300 bg-vault-900/50 px-3 py-1 rounded-lg break-all">{setup2FA.secret}</code></div>
            <div><label className="text-xs text-slate-400 mb-1 block">Código de 6 dígitos:</label>
              <input type="text" value={verifyCode} onChange={e => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))} className="w-full bg-vault-900/50 border border-vault-700/30 rounded-xl px-3 py-3 text-center text-xl font-mono tracking-[0.5em] focus:outline-none focus:border-vault-500" placeholder="000000" maxLength={6} required /></div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setSetup2FA(null)} className="flex-1 glass hover:bg-vault-800/50 py-2.5 rounded-xl text-sm">Cancelar</button>
              <button type="submit" disabled={loading2FA} className="flex-1 bg-vault-600 hover:bg-vault-500 text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">{loading2FA && <Loader2 size={14} className="animate-spin" />} Ativar</button>
            </div>
          </form>
        ) : (
          <div>
            <p className="text-sm text-slate-400 mb-4">Adicione uma camada extra de segurança com um aplicativo autenticador.</p>
            <button onClick={startSetup2FA} disabled={loading2FA} className="flex items-center gap-2 bg-vault-600 hover:bg-vault-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium">{loading2FA ? <Loader2 size={14} className="animate-spin" /> : <QrCode size={14} />} Configurar 2FA</button>
          </div>
        )}
      </div>

      {toast && <div className="fixed bottom-24 lg:bottom-6 right-6 glass px-4 py-3 rounded-xl text-sm toast-enter shadow-xl z-50">{toast}</div>}
    </div>
  );
}
