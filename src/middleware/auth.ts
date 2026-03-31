import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { hasAnyPermission, hasPermission, isAdminRole, resolveUserPermissions, type PermissionMap } from '../lib/permissions';

const getSupabase = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    full_name: string;
    display_name?: string | null;
    permissions: PermissionMap;
    group_ids: string[];
  };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Token nao fornecido' });
    const sb = getSupabase();
    const { data: { user }, error } = await sb.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Token invalido' });
    const { data: profile } = await sb.from('profiles').select('*').eq('id', user.id).single();
    if (!profile) return res.status(403).json({ error: 'Perfil nao encontrado' });
    if (!profile.is_active) return res.status(403).json({ error: 'Conta desativada' });
    const { permissions, groupIds } = await resolveUserPermissions(sb, user.id, profile.role);

    // Verificar horario de acesso
    const now = new Date();
    const dayOfWeek = now.getDay();
    const currentTime = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    const allowedDays = (profile.allowed_days || '0,1,2,3,4,5,6').split(',').map(Number);
    const timeStart = profile.allowed_time_start || '00:00';
    const timeEnd = profile.allowed_time_end || '23:59';

    if (!allowedDays.includes(dayOfWeek) || currentTime < timeStart || currentTime > timeEnd) {
      if (!isAdminRole(profile.role)) {
        return res.status(403).json({ error: 'Acesso nao permitido neste horario. Seu acesso e permitido de ' + timeStart + ' as ' + timeEnd + '.' });
      }
    }

    req.user = {
      id: user.id,
      email: user.email!,
      role: profile.role,
      full_name: profile.display_name || profile.full_name,
      display_name: profile.display_name || null,
      permissions,
      group_ids: groupIds,
    };
    next();
  } catch (err) { return res.status(500).json({ error: 'Erro de autenticacao' }); }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || !isAdminRole(req.user.role)) return res.status(403).json({ error: 'Acesso restrito a administradores' });
  next();
};

export const requireAdminOrAuditor = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || (!isAdminRole(req.user.role) && req.user.role !== 'auditor')) return res.status(403).json({ error: 'Acesso restrito' });
  next();
};

export const requirePermission = (permissionKey: string) => (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || !hasPermission(req.user, permissionKey)) {
    return res.status(403).json({ error: 'Voce nao possui permissao para esta acao' });
  }
  next();
};

export const requireAnyPermission = (permissionKeys: string[]) => (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || !hasAnyPermission(req.user, permissionKeys)) {
    return res.status(403).json({ error: 'Voce nao possui permissao para esta acao' });
  }
  next();
};
