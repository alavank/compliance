import type { User } from '../contexts/AuthContext';

export const ROLE_OPTIONS = [
  { value: 'user', label: 'Usuario' },
  { value: 'technician', label: 'Tecnico' },
  { value: 'admin', label: 'Admin' },
  { value: 'super_admin', label: 'Super-Admin' },
  { value: 'auditor', label: 'Auditor Externo' },
] as const;

export const PERMISSION_GROUPS = [
  {
    id: 'passwords',
    label: 'Senhas',
    permissions: [
      { key: 'passwords.view', label: 'Visualizar listagem de senhas' },
      { key: 'passwords.reveal', label: 'Revelar e copiar senhas' },
      { key: 'passwords.create', label: 'Cadastrar senhas' },
      { key: 'passwords.edit', label: 'Editar senhas' },
      { key: 'passwords.delete', label: 'Excluir senhas' },
    ],
  },
  {
    id: 'requests',
    label: 'Solicitacoes',
    permissions: [{ key: 'password_requests.manage', label: 'Gerenciar solicitacoes de senha' }],
  },
  {
    id: 'monitoring',
    label: 'Acompanhamento',
    permissions: [
      { key: 'dashboard.view', label: 'Acessar dashboard' },
      { key: 'realtime.view', label: 'Acessar tempo real' },
      { key: 'audit_logs.view', label: 'Acessar logs de auditoria' },
      { key: 'reports.export', label: 'Exportar relatorios' },
    ],
  },
  {
    id: 'management',
    label: 'Administracao',
    permissions: [
      { key: 'users.manage', label: 'Gerenciar usuarios' },
      { key: 'groups.manage', label: 'Gerenciar grupos' },
      { key: 'organizations.manage', label: 'Gerenciar organograma' },
      { key: 'terms.manage', label: 'Gerenciar termos LGPD' },
    ],
  },
  {
    id: 'vaults',
    label: 'Cofres',
    permissions: [
      { key: 'vaults.view', label: 'Visualizar cofres' },
      { key: 'vaults.manage', label: 'Gerenciar cofres e membros' },
    ],
  },
  {
    id: 'kb',
    label: 'Base de Conhecimento',
    permissions: [
      { key: 'kb.view', label: 'Visualizar artigos' },
      { key: 'kb.manage', label: 'Gerenciar bases e artigos' },
    ],
  },
  {
    id: 'cmdb',
    label: 'CMDB / TI',
    permissions: [
      { key: 'cmdb.view', label: 'Visualizar ativos e runbooks' },
      { key: 'cmdb.manage', label: 'Gerenciar ativos e infraestrutura' },
    ],
  },
  {
    id: 'onboarding',
    label: 'Onboarding',
    permissions: [
      { key: 'onboarding.view', label: 'Visualizar onboarding' },
      { key: 'onboarding.manage', label: 'Gerenciar templates e instancias' },
    ],
  },
  {
    id: 'compliance',
    label: 'Compliance',
    permissions: [
      { key: 'compliance.view', label: 'Visualizar compliance' },
      { key: 'compliance.manage', label: 'Gerenciar denuncias, LGPD e treinamentos' },
    ],
  },
] as const;

export function isAdminRole(role?: string | null) {
  return role === 'admin' || role === 'super_admin';
}

export function isAuditorRole(role?: string | null) {
  return role === 'auditor';
}

export function hasPermission(user: User | null | undefined, permissionKey: string) {
  if (!user) return false;
  if (isAdminRole(user.role)) return true;
  return !!user.permissions?.[permissionKey];
}

export function getRoleLabel(role?: string | null) {
  switch (role) {
    case 'user':
      return 'Usuario';
    case 'technician':
      return 'Tecnico';
    case 'admin':
      return 'Admin';
    case 'super_admin':
      return 'Super-Admin';
    case 'auditor':
      return 'Auditor Externo';
    default:
      return 'Usuario';
  }
}

export function getRoleBadgeClass(role?: string | null) {
  switch (role) {
    case 'super_admin':
      return 'bg-rose-500/15 text-rose-300';
    case 'admin':
      return 'bg-amber-500/10 text-amber-400';
    case 'auditor':
      return 'bg-sky-500/10 text-sky-300';
    case 'technician':
      return 'bg-emerald-500/10 text-emerald-300';
    default:
      return 'bg-slate-500/10 text-slate-400';
  }
}

export function getDefaultRoute(user: User | null | undefined) {
  if (!user) return '/login';
  if (hasPermission(user, 'dashboard.view')) return '/admin/dashboard';
  if (hasPermission(user, 'passwords.view')) return '/passwords';
  if (!isAuditorRole(user.role)) return '/password-requests';
  return '/settings';
}

const LEGACY_PERMISSION_ALIASES: Record<string, string> = {
  view_passwords: 'passwords.view',
  create_passwords: 'passwords.create',
  edit_passwords: 'passwords.edit',
  delete_passwords: 'passwords.delete',
  view_dashboard: 'dashboard.view',
  view_logs: 'audit_logs.view',
  view_realtime: 'realtime.view',
  manage_users: 'users.manage',
  manage_groups: 'groups.manage',
  manage_terms: 'terms.manage',
  manage_organization: 'organizations.manage',
};

export function normalizePermissionMap(input: Record<string, boolean> | undefined | null) {
  const normalized: Record<string, boolean> = {};
  Object.entries(input || {}).forEach(([key, value]) => {
    if (!value) return;
    normalized[LEGACY_PERMISSION_ALIASES[key] || key] = true;
  });
  if (normalized['passwords.view'] && normalized['passwords.reveal'] === undefined) {
    normalized['passwords.reveal'] = true;
  }
  if ((normalized['dashboard.view'] || normalized['audit_logs.view']) && normalized['reports.export'] === undefined) {
    normalized['reports.export'] = true;
  }
  return normalized;
}
