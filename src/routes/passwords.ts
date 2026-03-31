import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { AuthRequest, authenticate, requirePermission } from '../middleware/auth';
import { buildOrganizationPathMap } from '../lib/organizations';
import { hasPermission, isAdminRole } from '../lib/permissions';
import { encrypt, decrypt } from '../services/encryption';
import { logAudit, updateSession } from '../services/audit';

const router = Router();
const sb = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function fmtDate(d: string | null): string {
  if (!d) return '';
  try {
    const dt = new Date(d);
    return (
      String(dt.getDate()).padStart(2, '0') +
      '/' +
      String(dt.getMonth() + 1).padStart(2, '0') +
      '/' +
      dt.getFullYear() +
      ' ' +
      String(dt.getHours()).padStart(2, '0') +
      ':' +
      String(dt.getMinutes()).padStart(2, '0')
    );
  } catch {
    return '';
  }
}

function fmtDateShort(d: string | null): string {
  if (!d) return '';
  try {
    const dt = new Date(d);
    return String(dt.getDate()).padStart(2, '0') + '/' + String(dt.getMonth() + 1).padStart(2, '0') + '/' + dt.getFullYear();
  } catch {
    return '';
  }
}

function uniqueIds(values: string[] | undefined | null) {
  return [...new Set((values || []).filter(Boolean))];
}

function buildManyToManyMap(items: any[], keyField: string, valueField: string) {
  return (items || []).reduce<Record<string, string[]>>((acc, item) => {
    const key = item[keyField];
    const value = item[valueField];
    if (!key || !value) return acc;
    if (!acc[key]) acc[key] = [];
    acc[key].push(value);
    return acc;
  }, {});
}

function getPasswordOrganizationIds(password: any, passwordOrgMap: Record<string, string[]>) {
  const scopedIds = uniqueIds(passwordOrgMap[password.id] || []);
  if (scopedIds.length > 0) return scopedIds;
  return password.organization_id ? [password.organization_id] : [];
}

function canAccessPassword(
  req: AuthRequest,
  password: any,
  passwordGroupMap: Record<string, string[]>,
  passwordExceptionMap: Record<string, string[]>,
  passwordOrgMap: Record<string, string[]>,
  userOrgIds: Set<string>
) {
  if (!req.user) return false;
  if (req.user.role === 'auditor') return false;
  if (isAdminRole(req.user.role)) return true;
  if (!hasPermission(req.user, 'passwords.view')) return false;

  const passwordExceptionIds = new Set(passwordExceptionMap[password.id] || []);
  if (passwordExceptionIds.has(req.user.id)) return false;

  const passwordOrganizationIds = getPasswordOrganizationIds(password, passwordOrgMap);
  if (passwordOrganizationIds.length === 0) return false;

  const passwordGroupIds = passwordGroupMap[password.id] || [];
  if (passwordGroupIds.length > 0) {
    return passwordGroupIds.some((groupId) => req.user!.group_ids.includes(groupId));
  }

  return passwordOrganizationIds.some((organizationId) => userOrgIds.has(organizationId));
}

router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const db = sb();
    if (req.user!.role === 'auditor') return res.json({ passwords: [] });
    if (!hasPermission(req.user, 'passwords.view')) {
      return res.status(403).json({ error: 'Voce nao possui permissao para visualizar senhas' });
    }

    const { data, error } = await db
      .from('passwords')
      .select('id, system_name, url, username, notes, category_id, created_at, updated_at, expires_at, created_by, organization_id, categories(name, icon, color)')
      .order('system_name');
    if (error) throw error;

    const [{ data: allPwGroups }, { data: allPwExceptions }, { data: allPwOrganizations }, { data: orgsData }, { data: userOrgRows }] =
      await Promise.all([
        db.from('password_groups').select('password_id, group_id'),
        db.from('password_exceptions').select('password_id, user_id'),
        db.from('password_organizations').select('password_id, organization_id'),
        db.from('organizations').select('id, name, type, parent_id'),
        db.from('user_organizations').select('organization_id').eq('user_id', req.user!.id),
      ]);

    const passwordGroupMap = buildManyToManyMap(allPwGroups || [], 'password_id', 'group_id');
    const passwordExceptionMap = buildManyToManyMap(allPwExceptions || [], 'password_id', 'user_id');
    const passwordOrgMap = buildManyToManyMap(allPwOrganizations || [], 'password_id', 'organization_id');
    const userOrgIds = new Set((userOrgRows || []).map((row: any) => row.organization_id));

    const creatorIds = [...new Set((data || []).map((password: any) => password.created_by).filter(Boolean))];
    let names: Record<string, string> = {};
    if (creatorIds.length > 0) {
      const { data: profiles } = await db.from('profiles').select('id, full_name, display_name').in('id', creatorIds);
      if (profiles) {
        profiles.forEach((profile: any) => {
          names[profile.id] = profile.display_name || profile.full_name || 'Admin';
        });
      }
    }

    const organizationById: Record<string, any> = {};
    (orgsData || []).forEach((organization: any) => {
      organizationById[organization.id] = organization;
    });
    const orgPathMap = buildOrganizationPathMap(orgsData || []);

    const passwords = (data || [])
      .filter((password: any) =>
        canAccessPassword(req, password, passwordGroupMap, passwordExceptionMap, passwordOrgMap, userOrgIds)
      )
      .map((password: any) => {
        const updatedAtMs = password.updated_at ? new Date(password.updated_at).getTime() : Date.now();
        const expiresDate = password.expires_at ? new Date(password.expires_at) : new Date(updatedAtMs + 90 * 86400000);
        const expiresIn = Math.ceil((expiresDate.getTime() - Date.now()) / 86400000);
        const passwordGroupIds = uniqueIds(passwordGroupMap[password.id] || []);
        const passwordExceptionIds = uniqueIds(passwordExceptionMap[password.id] || []);
        const passwordOrganizationIds = getPasswordOrganizationIds(password, passwordOrgMap);
        const passwordOrganizationPaths = passwordOrganizationIds
          .map((organizationId) => orgPathMap[organizationId] || organizationById[organizationId]?.name)
          .filter(Boolean);

        return {
          ...password,
          needsRotation: expiresIn <= 0,
          expiresIn,
          expiresDate: fmtDateShort(expiresDate.toISOString()),
          updatedFormatted: fmtDate(password.updated_at || password.created_at),
          updatedBy: names[password.created_by] || 'Admin',
          rotationMessage: expiresIn <= 0 ? 'Senha expirada! Troque imediatamente.' : null,
          organization_id: passwordOrganizationIds[0] || null,
          organization_name: passwordOrganizationPaths[0] || null,
          organization_ids: passwordOrganizationIds,
          organization_paths: passwordOrganizationPaths,
          group_ids: passwordGroupIds,
          exception_user_ids: passwordExceptionIds,
        };
      });

    await updateSession(db, req.user!.id, req.user!.full_name, 'browsing_passwords');
    return res.json({ passwords });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao listar' });
  }
});

router.post('/reveal/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    if (req.user!.role === 'auditor') return res.status(403).json({ error: 'Auditores nao podem ver senhas' });
    if (!hasPermission(req.user, 'passwords.reveal')) {
      return res.status(403).json({ error: 'Voce nao possui permissao para revelar senhas' });
    }

    const db = sb();
    const { data } = await db.from('passwords').select('*').eq('id', req.params.id).single();
    if (!data) return res.status(404).json({ error: 'Nao encontrada' });

    const [{ data: pwGroups }, { data: pwExceptions }, { data: pwOrganizations }, { data: userOrgRows }] = await Promise.all([
      db.from('password_groups').select('password_id, group_id').eq('password_id', req.params.id),
      db.from('password_exceptions').select('password_id, user_id').eq('password_id', req.params.id),
      db.from('password_organizations').select('password_id, organization_id').eq('password_id', req.params.id),
      db.from('user_organizations').select('organization_id').eq('user_id', req.user!.id),
    ]);

    const passwordGroupMap = buildManyToManyMap(pwGroups || [], 'password_id', 'group_id');
    const passwordExceptionMap = buildManyToManyMap(pwExceptions || [], 'password_id', 'user_id');
    const passwordOrgMap = buildManyToManyMap(pwOrganizations || [], 'password_id', 'organization_id');
    const userOrgIds = new Set((userOrgRows || []).map((row: any) => row.organization_id));

    if (!canAccessPassword(req, data, passwordGroupMap, passwordExceptionMap, passwordOrgMap, userOrgIds)) {
      return res.status(403).json({ error: 'Voce nao possui acesso a esta senha' });
    }

    const decrypted = decrypt(data.encrypted_password, data.iv, data.auth_tag);
    await logAudit(db, {
      userId: req.user!.id,
      userName: req.user!.full_name,
      action: 'PASSWORD_VIEWED',
      resourceType: 'password',
      resourceId: data.id,
      resourceName: data.system_name,
      details: { username: data.username },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string,
    });
    await updateSession(db, req.user!.id, req.user!.full_name, 'viewed_password:' + data.system_name);
    return res.json({ password: decrypted });
  } catch {
    return res.status(500).json({ error: 'Erro' });
  }
});

router.post('/generate', authenticate, async (req: AuthRequest, res) => {
  const len = Math.min(Math.max(req.body.length || 16, 6), 40);
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*?';
  const bytes = crypto.randomBytes(len * 2);
  const arr: string[] = [];
  for (let i = 0; i < len; i++) arr.push(chars[bytes[i] % chars.length]);
  if (!/[a-zA-Z]/.test(arr.join(''))) arr[0] = 'K';
  if (!/[0-9]/.test(arr.join(''))) arr[Math.min(1, len - 1)] = '7';
  if (!/[!@#$%&*?]/.test(arr.join(''))) arr[Math.min(2, len - 1)] = '@';
  return res.json({ password: arr.join('') });
});

router.post('/', authenticate, requirePermission('passwords.create'), async (req: AuthRequest, res) => {
  try {
    const { system_name, url, username, password, notes, category_id, expires_days, group_ids, organization_ids, exception_user_ids } = req.body;
    const scopedOrganizationIds = uniqueIds(organization_ids);
    if (!system_name || !password) return res.status(400).json({ error: 'Nome e senha obrigatorios' });
    if (scopedOrganizationIds.length === 0) {
      return res.status(400).json({ error: 'Selecione pelo menos um local da organizacao' });
    }

    const { encrypted, iv, authTag } = encrypt(password);
    const db = sb();
    const now = new Date().toISOString();
    const exp = expires_days
      ? new Date(Date.now() + parseInt(expires_days) * 86400000).toISOString()
      : new Date(Date.now() + 90 * 86400000).toISOString();

    const { data, error } = await db
      .from('passwords')
      .insert({
        system_name,
        url: url || null,
        username: username || null,
        encrypted_password: encrypted,
        iv,
        auth_tag: authTag,
        notes: notes || null,
        category_id: category_id || null,
        organization_id: scopedOrganizationIds[0],
        created_by: req.user!.id,
        created_at: now,
        updated_at: now,
        expires_at: exp,
      })
      .select()
      .single();
    if (error) throw error;

    await db.from('password_organizations').insert(
      scopedOrganizationIds.map((organizationId: string) => ({ password_id: data.id, organization_id: organizationId }))
    );
    if (group_ids?.length) {
      await db.from('password_groups').insert(group_ids.map((groupId: string) => ({ password_id: data.id, group_id: groupId })));
    }
    if (exception_user_ids?.length) {
      await db.from('password_exceptions').insert(
        exception_user_ids.map((userId: string) => ({ password_id: data.id, user_id: userId }))
      );
    }

    await logAudit(db, {
      userId: req.user!.id,
      userName: req.user!.full_name,
      action: 'PASSWORD_CREATED',
      resourceType: 'password',
      resourceId: data.id,
      resourceName: system_name,
      ipAddress: req.ip,
    });
    return res.status(201).json({ password: data });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao criar' });
  }
});

router.put('/:id', authenticate, requirePermission('passwords.edit'), async (req: AuthRequest, res) => {
  try {
    const db = sb();
    const { system_name, url, username, password, notes, category_id, expires_days, group_ids, organization_ids, exception_user_ids } = req.body;
    const scopedOrganizationIds = uniqueIds(organization_ids);
    if (scopedOrganizationIds.length === 0) {
      return res.status(400).json({ error: 'Selecione pelo menos um local da organizacao' });
    }

    if (password) {
      const { data: currentPassword } = await db.from('passwords').select('*').eq('id', req.params.id).single();
      if (currentPassword) {
        await db.from('password_history').insert({
          password_id: currentPassword.id,
          encrypted_password: currentPassword.encrypted_password,
          iv: currentPassword.iv,
          auth_tag: currentPassword.auth_tag,
          changed_by: req.user!.id,
        });
        const { data: historyRows } = await db
          .from('password_history')
          .select('id')
          .eq('password_id', currentPassword.id)
          .order('changed_at', { ascending: false });
        if (historyRows && historyRows.length > 3) {
          await db.from('password_history').delete().in('id', historyRows.slice(3).map((row: any) => row.id));
        }
      }
    }

    const updatePayload: any = {
      system_name,
      url: url || null,
      username: username || null,
      notes: notes || null,
      category_id: category_id || null,
      organization_id: scopedOrganizationIds[0],
      updated_at: new Date().toISOString(),
      created_by: req.user!.id,
    };
    if (password) {
      const { encrypted, iv, authTag } = encrypt(password);
      updatePayload.encrypted_password = encrypted;
      updatePayload.iv = iv;
      updatePayload.auth_tag = authTag;
    }
    if (expires_days && parseInt(expires_days) > 0) {
      updatePayload.expires_at = new Date(Date.now() + parseInt(expires_days) * 86400000).toISOString();
    }

    await db.from('passwords').update(updatePayload).eq('id', req.params.id);
    await db.from('password_organizations').delete().eq('password_id', req.params.id);
    await db.from('password_organizations').insert(
      scopedOrganizationIds.map((organizationId: string) => ({ password_id: req.params.id, organization_id: organizationId }))
    );

    if (group_ids !== undefined) {
      await db.from('password_groups').delete().eq('password_id', req.params.id);
      if (group_ids?.length) {
        await db.from('password_groups').insert(group_ids.map((groupId: string) => ({ password_id: req.params.id, group_id: groupId })));
      }
    }
    if (exception_user_ids !== undefined) {
      await db.from('password_exceptions').delete().eq('password_id', req.params.id);
      if (exception_user_ids?.length) {
        await db.from('password_exceptions').insert(
          exception_user_ids.map((userId: string) => ({ password_id: req.params.id, user_id: userId }))
        );
      }
    }

    await logAudit(db, {
      userId: req.user!.id,
      userName: req.user!.full_name,
      action: password ? 'PASSWORD_CHANGED' : 'PASSWORD_UPDATED',
      resourceType: 'password',
      resourceId: req.params.id,
      resourceName: system_name,
      ipAddress: req.ip,
    });
    return res.json({ message: 'Atualizado' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro' });
  }
});

router.delete('/:id', authenticate, requirePermission('passwords.delete'), async (req: AuthRequest, res) => {
  try {
    const db = sb();
    const { data: password } = await db.from('passwords').select('system_name').eq('id', req.params.id).single();
    await db.from('passwords').delete().eq('id', req.params.id);
    await logAudit(db, {
      userId: req.user!.id,
      userName: req.user!.full_name,
      action: 'PASSWORD_DELETED',
      resourceType: 'password',
      resourceId: req.params.id,
      resourceName: password?.system_name,
      ipAddress: req.ip,
    });
    return res.json({ message: 'Removida' });
  } catch {
    return res.status(500).json({ error: 'Erro' });
  }
});

router.get('/:id/groups', authenticate, requirePermission('passwords.edit'), async (req: AuthRequest, res) => {
  try {
    const { data } = await sb().from('password_groups').select('group_id').eq('password_id', req.params.id);
    return res.json({ group_ids: (data || []).map((row: any) => row.group_id) });
  } catch {
    return res.status(500).json({ error: 'Erro' });
  }
});

export default router;
