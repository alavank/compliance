import { SupabaseClient } from '@supabase/supabase-js';

export async function logAudit(sb: SupabaseClient, entry: {
  userId: string; userName: string; action: string; resourceType: string;
  resourceId?: string; resourceName?: string; details?: any;
  ipAddress?: string; userAgent?: string;
}) {
  try {
    await sb.from('audit_logs').insert({
      user_id: entry.userId, user_name: entry.userName,
      action: entry.action, resource_type: entry.resourceType,
      resource_id: entry.resourceId || null, resource_name: entry.resourceName || null,
      details: entry.details || {}, ip_address: entry.ipAddress || null,
      user_agent: entry.userAgent || null,
    });
  } catch (err) { console.error('Audit error:', err); }
}

export async function notifyUsers(sb: SupabaseClient, userIds: string[], title: string, message: string, type: string = 'info') {
  try {
    await sb.from('notifications').insert(userIds.map(uid => ({ user_id: uid, title, message, type })));
  } catch (err) { console.error('Notify error:', err); }
}

export async function updateSession(sb: SupabaseClient, userId: string, userName: string, action: string, ip?: string, userAgent?: string) {
  try {
    const { data: existing } = await sb.from('active_sessions').select('id, started_at').eq('user_id', userId).single();
    if (existing) {
      await sb.from('active_sessions').update({
        last_activity: new Date().toISOString(), current_action: action, user_name: userName,
        ip_address: ip || undefined, user_agent: userAgent || undefined,
      }).eq('id', existing.id);
    } else {
      await sb.from('active_sessions').insert({
        user_id: userId, user_name: userName, current_action: action,
        ip_address: ip || null, user_agent: userAgent || null,
        started_at: new Date().toISOString(),
      });
    }
  } catch {}
}

export async function removeSession(sb: SupabaseClient, userId: string) {
  try { await sb.from('active_sessions').delete().eq('user_id', userId); } catch {}
}
