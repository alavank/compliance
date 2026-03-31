import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { AuthRequest, authenticate } from '../middleware/auth';
import { isAdminRole, resolveUserPermissions } from '../lib/permissions';
import { logAudit, updateSession, removeSession } from '../services/audit';

const router = Router();
const sb = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

router.post('/login', async (req: AuthRequest, res) => {
  try {
    const { email, password, totpCode } = req.body;
    const db = sb(); const ip = req.ip || '';

    const { data: profile } = await db.from('profiles').select('*').eq('email', email).single();
    if (profile?.locked_until && new Date(profile.locked_until) > new Date()) {
      return res.status(423).json({ error: 'Conta bloqueada. Tente em ' + Math.ceil((new Date(profile.locked_until).getTime() - Date.now()) / 60000) + ' min.' });
    }
    if (profile && !profile.is_active) return res.status(403).json({ error: 'Conta desativada' });

    // Verificar horario de acesso
    if (profile && !isAdminRole(profile.role)) {
      const now = new Date();
      const day = now.getDay();
      const time = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
      const days = (profile.allowed_days || '0,1,2,3,4,5,6').split(',').map(Number);
      if (!days.includes(day) || time < (profile.allowed_time_start || '00:00') || time > (profile.allowed_time_end || '23:59')) {
        return res.status(403).json({ error: 'Acesso nao permitido neste horario. Permitido: ' + (profile.allowed_time_start || '00:00') + ' as ' + (profile.allowed_time_end || '23:59') });
      }
    }

    const { data: authData, error: authError } = await db.auth.signInWithPassword({ email, password });
    if (authError) {
      if (profile) {
        const att = (profile.failed_login_attempts || 0) + 1;
        const upd: any = { failed_login_attempts: att };
        if (att >= 5) upd.locked_until = new Date(Date.now() + 30 * 60000).toISOString();
        await db.from('profiles').update(upd).eq('id', profile.id);
      }
      await db.from('login_attempts').insert({ email, ip_address: ip, success: false });
      return res.status(401).json({ error: 'Email ou senha invalidos' });
    }

    if (profile?.totp_enabled && profile?.totp_secret) {
      if (!totpCode) return res.json({ requires2FA: true });
      if (!authenticator.verify({ token: totpCode, secret: profile.totp_secret })) return res.status(401).json({ error: 'Codigo 2FA invalido' });
    }

    // Expiracao de senha
    let pwExpired = false, pwDaysLeft = null;
    if (profile?.password_changed_at && profile?.password_expires_days) {
      const exp = new Date(new Date(profile.password_changed_at).getTime() + profile.password_expires_days * 86400000);
      pwDaysLeft = Math.ceil((exp.getTime() - Date.now()) / 86400000);
      if (pwDaysLeft <= 0) pwExpired = true;
    }
    const mustChange = profile?.must_change_password === true || pwExpired;

    // Verificar se aceitou ultimo termo
    const { data: latestTerm } = await db.from('terms').select('id, version').order('created_at', { ascending: false }).limit(1).single();
    let needsTermAcceptance = false;
    if (latestTerm) {
      const { data: acceptance } = await db.from('term_acceptances').select('id')
        .eq('user_id', authData.user.id).eq('term_version', latestTerm.version).single();
      if (!acceptance) needsTermAcceptance = true;
    }

    const { permissions, groupIds } = await resolveUserPermissions(db, authData.user.id, profile?.role || 'user');

    await db.from('profiles').update({ failed_login_attempts: 0, locked_until: null, last_login: new Date().toISOString() }).eq('id', authData.user.id);
    await db.from('login_attempts').insert({ email, ip_address: ip, success: true });
    await logAudit(db, { userId: authData.user.id, userName: profile?.full_name || email, action: 'LOGIN', resourceType: 'auth', resourceName: 'Login no sistema', ipAddress: ip, userAgent: req.headers['user-agent'] as string });
    await updateSession(db, authData.user.id, profile?.display_name || profile?.full_name || email, 'login', ip);

    return res.json({
      token: authData.session.access_token,
      refreshToken: authData.session.refresh_token,
      user: {
        id: authData.user.id, email: authData.user.email,
        full_name: profile?.full_name || 'Usuario', role: profile?.role || 'user',
        totp_enabled: profile?.totp_enabled || false,
        must_change_password: mustChange,
        needs_term_acceptance: needsTermAcceptance,
        password_expires_days: profile?.password_expires_days || 90,
        password_days_left: pwDaysLeft,
        avatar_url: profile?.avatar_url || null,
        display_name: profile?.display_name || null,
        cpf: profile?.cpf || null,
        email_notifications: profile?.email_notifications || false,
        allowed_days: profile?.allowed_days || '0,1,2,3,4,5,6',
        allowed_time_start: profile?.allowed_time_start || '00:00',
        allowed_time_end: profile?.allowed_time_end || '23:59',
        permissions,
        group_ids: groupIds,
      },
    });
  } catch (err) { console.error('Login:', err); return res.status(500).json({ error: 'Erro interno' }); }
});

router.post('/forgot-password', async (req, res) => {
  try { await sb().auth.resetPasswordForEmail(req.body.email, { redirectTo: process.env.APP_URL + '/reset-password' }); return res.json({ message: 'Link enviado se o email existir.' }); }
  catch { return res.status(500).json({ error: 'Erro' }); }
});

router.post('/update-password', authenticate, async (req: AuthRequest, res) => {
  try {
    const db = sb();
    await db.auth.admin.updateUserById(req.user!.id, { password: req.body.password });
    await db.from('profiles').update({ must_change_password: false, password_changed_at: new Date().toISOString() }).eq('id', req.user!.id);
    await logAudit(db, { userId: req.user!.id, userName: req.user!.full_name, action: 'PASSWORD_SELF_CHANGED', resourceType: 'auth', ipAddress: req.ip });
    return res.json({ message: 'Senha atualizada' });
  } catch (err) { return res.status(500).json({ error: 'Erro ao atualizar senha' }); }
});

router.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const db = sb();
    const { data: p } = await db.from('profiles').select('*').eq('id', req.user!.id).single();
    if (!p) return res.status(404).json({ error: 'Nao encontrado' });

    let pwDaysLeft = null, pwExpired = false;
    if (p.password_changed_at && p.password_expires_days) {
      pwDaysLeft = Math.ceil((new Date(new Date(p.password_changed_at).getTime() + p.password_expires_days * 86400000).getTime() - Date.now()) / 86400000);
      if (pwDaysLeft <= 0) pwExpired = true;
    }

    const { data: latestTerm } = await db.from('terms').select('id, version').order('created_at', { ascending: false }).limit(1).single();
    let needsTermAcceptance = false;
    if (latestTerm) {
      const { data: acc } = await db.from('term_acceptances').select('id').eq('user_id', req.user!.id).eq('term_version', latestTerm.version).single();
      if (!acc) needsTermAcceptance = true;
    }

    await updateSession(db, req.user!.id, req.user!.full_name, 'browsing');

    const { permissions, groupIds } = await resolveUserPermissions(db, req.user!.id, p.role);

    return res.json({
      user: {
        ...p,
        totp_secret: undefined,
        must_change_password: p.must_change_password === true || pwExpired,
        password_days_left: pwDaysLeft,
        needs_term_acceptance: needsTermAcceptance,
        permissions,
        group_ids: groupIds,
      },
    });
  } catch { return res.status(500).json({ error: 'Erro' }); }
});

router.put('/profile', authenticate, async (req: AuthRequest, res) => {
  try {
    const db = sb();
    const upd: any = { updated_at: new Date().toISOString() };
    if (req.body.display_name !== undefined) upd.display_name = req.body.display_name;
    if (req.body.avatar_url !== undefined) upd.avatar_url = req.body.avatar_url;
    if (req.body.email_notifications !== undefined) upd.email_notifications = req.body.email_notifications;
    await db.from('profiles').update(upd).eq('id', req.user!.id);
    await logAudit(db, { userId: req.user!.id, userName: req.user!.full_name, action: 'PROFILE_UPDATED', resourceType: 'auth', ipAddress: req.ip });
    return res.json({ message: 'Perfil atualizado' });
  } catch { return res.status(500).json({ error: 'Erro' }); }
});

router.post('/setup-2fa', authenticate, async (req: AuthRequest, res) => {
  try { const s = authenticator.generateSecret(); return res.json({ secret: s, qrCodeUrl: await QRCode.toDataURL(authenticator.keyuri(req.user!.email, 'CofreSenhas', s)) }); }
  catch { return res.status(500).json({ error: 'Erro' }); }
});
router.post('/verify-2fa', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!authenticator.verify({ token: req.body.token, secret: req.body.secret })) return res.status(400).json({ error: 'Codigo invalido' });
    const db = sb(); await db.from('profiles').update({ totp_enabled: true, totp_secret: req.body.secret }).eq('id', req.user!.id);
    await logAudit(db, { userId: req.user!.id, userName: req.user!.full_name, action: '2FA_ENABLED', resourceType: 'auth' });
    return res.json({ message: '2FA ativado' });
  } catch { return res.status(500).json({ error: 'Erro' }); }
});
router.post('/disable-2fa', authenticate, async (req: AuthRequest, res) => {
  try { const db = sb(); await db.from('profiles').update({ totp_enabled: false, totp_secret: null }).eq('id', req.user!.id);
    await logAudit(db, { userId: req.user!.id, userName: req.user!.full_name, action: '2FA_DISABLED', resourceType: 'auth' }); return res.json({ message: '2FA desativado' });
  } catch { return res.status(500).json({ error: 'Erro' }); }
});
router.post('/logout', authenticate, async (req: AuthRequest, res) => {
  try { const db = sb(); await removeSession(db, req.user!.id);
    await logAudit(db, { userId: req.user!.id, userName: req.user!.full_name, action: 'LOGOUT', resourceType: 'auth' }); return res.json({ message: 'Logout' });
  } catch { return res.status(500).json({ error: 'Erro' }); }
});


// Registrar ações do frontend (screenshot, etc)
router.post('/log-action', authenticate, async (req: AuthRequest, res) => {
  try {
    const { action } = req.body;
    if (!action) return res.status(400).json({ error: 'Ação obrigatória' });
    const db = sb();
    await logAudit(db, { userId: req.user!.id, userName: req.user!.full_name, action, resourceType: 'system', ipAddress: req.ip, userAgent: req.headers['user-agent'] as string });
    return res.json({ message: 'Registrado' });
  } catch { return res.status(500).json({ error: 'Erro' }); }
});

export default router;
