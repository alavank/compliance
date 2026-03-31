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
    permissions: [
      { key: 'password_requests.manage', label: 'Gerenciar solicitacoes de senha' },
    ],
  },
  {
    id: 'monitoring',
    label: 'Acompanhamento',
    permissions: [
      { key: 'dashboard.view', label: 'Acessar dashboard' },
      { key: 'realtime.view', label: 'Acessar monitoramento em tempo real' },
      { key: 'audit_logs.view', label: 'Acessar logs de auditoria' },
      { key: 'reports.export', label: 'Exportar relatorios e arquivos' },
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

export const ALL_PERMISSION_KEYS = PERMISSION_GROUPS.flatMap((group) =>
  group.permissions.map((permission) => permission.key)
);

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

const AUDITOR_PERMISSION_KEYS = [
  'dashboard.view',
  'realtime.view',
  'audit_logs.view',
  'reports.export',
];

export type PermissionMap = Record<string, boolean>;

export function isSuperAdminRole(role?: string | null) {
  return role === 'super_admin';
}

export function isAdminRole(role?: string | null) {
  return role === 'admin' || role === 'super_admin';
}

export function isAuditorRole(role?: string | null) {
  return role === 'auditor';
}

export function normalizePermissionRecord(input: unknown): PermissionMap {
  const normalized: PermissionMap = {};
  const source = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};

  Object.entries(source).forEach(([rawKey, value]) => {
    if (!value) return;
    const key = LEGACY_PERMISSION_ALIASES[rawKey] || rawKey;
    normalized[key] = true;
  });

  if (normalized['passwords.view'] && normalized['passwords.reveal'] === undefined) {
    normalized['passwords.reveal'] = true;
  }

  if (
    (normalized['dashboard.view'] || normalized['audit_logs.view']) &&
    normalized['reports.export'] === undefined
  ) {
    normalized['reports.export'] = true;
  }

  return normalized;
}

export function mergePermissionRecords(records: unknown[]): PermissionMap {
  return records.reduce<PermissionMap>((acc, record) => {
    const normalized = normalizePermissionRecord(record);
    Object.keys(normalized).forEach((key) => {
      acc[key] = true;
    });
    return acc;
  }, {});
}

export function buildPermissionMap(role: string | null | undefined, groupPermissions: unknown[]) {
  if (isAdminRole(role)) {
    return ALL_PERMISSION_KEYS.reduce<PermissionMap>((acc, key) => {
      acc[key] = true;
      return acc;
    }, {});
  }

  const permissions = mergePermissionRecords(groupPermissions);

  if (isAuditorRole(role)) {
    AUDITOR_PERMISSION_KEYS.forEach((key) => {
      permissions[key] = true;
    });
  }

  return permissions;
}

export async function resolveUserPermissions(db: any, userId: string, role: string | null | undefined) {
  const { data: memberships } = await db
    .from('group_members')
    .select('group_id, groups(id, permissions)')
    .eq('user_id', userId);

  const groupIds = (memberships || []).map((membership: any) => membership.group_id);
  const groupPermissions = (memberships || []).map((membership: any) => membership.groups?.permissions || {});

  return {
    groupIds,
    permissions: buildPermissionMap(role, groupPermissions),
  };
}

export function hasPermission(
  permissionSource: { role?: string | null; permissions?: PermissionMap | null } | PermissionMap | null | undefined,
  permissionKey: string
) {
  if (!permissionSource) return false;

  const wrappedSource =
    typeof permissionSource === 'object' && ('permissions' in permissionSource || 'role' in permissionSource)
      ? (permissionSource as { role?: string | null; permissions?: PermissionMap | null })
      : null;

  if (wrappedSource?.role && isAdminRole(wrappedSource.role)) return true;

  const permissions = wrappedSource ? wrappedSource.permissions : permissionSource;
  return !!permissions?.[permissionKey];
}

export function hasAnyPermission(
  permissionSource: { role?: string | null; permissions?: PermissionMap | null } | PermissionMap | null | undefined,
  permissionKeys: string[]
) {
  return permissionKeys.some((permissionKey) => hasPermission(permissionSource, permissionKey));
}
