import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import PDFDocument from 'pdfkit';
import { AuthRequest, authenticate, requireAnyPermission, requirePermission } from '../middleware/auth';

const router = Router();
const sb = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function fmtDate(d: string) {
  try { const dt = new Date(d); return String(dt.getDate()).padStart(2,'0')+'/'+String(dt.getMonth()+1).padStart(2,'0')+'/'+dt.getFullYear()+' '+String(dt.getHours()).padStart(2,'0')+':'+String(dt.getMinutes()).padStart(2,'0'); } catch { return d; }
}

const ACTION_PT: any = {
  LOGIN: 'fez login', LOGOUT: 'saiu do sistema', PASSWORD_VIEWED: 'visualizou senha',
  PASSWORD_CREATED: 'criou senha', PASSWORD_CHANGED: 'alterou senha',
  PASSWORD_DELETED: 'removeu senha', PASSWORD_SELF_CHANGED: 'trocou propria senha',
  USER_CREATED: 'criou usuario', USER_DELETED: 'excluiu usuario',
  TERM_ACCEPTED: 'aceitou termo', PROFILE_UPDATED: 'atualizou perfil',
  '2FA_ENABLED': 'ativou 2FA', '2FA_DISABLED': 'desativou 2FA',
};

// Relatorio do admin (completo)
router.get('/admin', authenticate, requireAnyPermission(['dashboard.view', 'audit_logs.view']), async (req: AuthRequest, res) => {
  try {
    const db = sb();
    const days = parseInt(req.query.days as string) || 30;
    const since = new Date(Date.now() - days * 86400000).toISOString();

    const [pwds, users, logsRes] = await Promise.all([
      db.from('passwords').select('id, system_name, updated_at, expires_at'),
      db.from('profiles').select('id, full_name, last_login, is_active'),
      db.from('audit_logs').select('*').gte('created_at', since).order('created_at', { ascending: false }).limit(500),
    ]);
    const logs = logsRes.data || [];
    const loginCount = logs.filter((l: any) => l.action === 'LOGIN').length;
    const viewCount = logs.filter((l: any) => l.action === 'PASSWORD_VIEWED').length;
    const expired = (pwds.data || []).filter((p: any) => {
      if (p.expires_at) return new Date(p.expires_at) <= new Date();
      return (Date.now() - new Date(p.updated_at).getTime()) / 86400000 >= 90;
    }).length;

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=relatorio-cofre-senhas.pdf');
    doc.pipe(res);

    doc.fontSize(22).fillColor('#1B3A6B').text('Cofre de Senhas - Relatorio de Atividades', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor('#666').text('Periodo: ultimos ' + days + ' dias | Gerado em: ' + fmtDate(new Date().toISOString()), { align: 'center' });
    doc.moveDown(1.5);

    doc.fontSize(14).fillColor('#1B3A6B').text('Resumo Geral');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#333');
    doc.text('Total de senhas: ' + (pwds.data?.length || 0));
    doc.text('Senhas expiradas: ' + expired);
    doc.text('Usuarios ativos: ' + (users.data || []).filter((u: any) => u.is_active).length + '/' + (users.data?.length || 0));
    doc.text('Total de logins no periodo: ' + loginCount);
    doc.text('Total de visualizacoes de senhas: ' + viewCount);
    doc.moveDown(1);

    doc.fontSize(14).fillColor('#1B3A6B').text('Ultimas Atividades');
    doc.moveDown(0.5);
    doc.fontSize(9).fillColor('#333');
    logs.slice(0, 50).forEach((l: any) => {
      const action = ACTION_PT[l.action] || l.action;
      doc.text(fmtDate(l.created_at) + ' | ' + (l.user_name || 'Sistema') + ' ' + action + (l.resource_name ? ' "' + l.resource_name + '"' : '') + (l.ip_address ? ' | IP: ' + l.ip_address : ''));
    });

    doc.end();
  } catch (err) { console.error(err); return res.status(500).json({ error: 'Erro ao gerar relatorio' }); }
});

// Relatorio do usuario (so os dados dele)
router.get('/user', authenticate, async (req: AuthRequest, res) => {
  try {
    const db = sb();
    const days = parseInt(req.query.days as string) || 30;
    const since = new Date(Date.now() - days * 86400000).toISOString();

    const { data: logs } = await db.from('audit_logs').select('*').eq('user_id', req.user!.id).gte('created_at', since).order('created_at', { ascending: false }).limit(200);

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=meu-relatorio.pdf');
    doc.pipe(res);

    doc.fontSize(22).fillColor('#1B3A6B').text('Cofre de Senhas - Meu Relatorio', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor('#666').text('Usuario: ' + req.user!.full_name + ' | Periodo: ' + days + ' dias', { align: 'center' });
    doc.moveDown(1.5);

    doc.fontSize(14).fillColor('#1B3A6B').text('Resumo');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#333');
    const myLogins = (logs || []).filter((l: any) => l.action === 'LOGIN').length;
    const myViews = (logs || []).filter((l: any) => l.action === 'PASSWORD_VIEWED').length;
    doc.text('Total de acessos (logins): ' + myLogins);
    doc.text('Total de senhas visualizadas: ' + myViews);
    doc.moveDown(1);

    doc.fontSize(14).fillColor('#1B3A6B').text('Historico de Atividades');
    doc.moveDown(0.5);
    doc.fontSize(9).fillColor('#333');
    (logs || []).forEach((l: any) => {
      const action = ACTION_PT[l.action] || l.action;
      doc.text(fmtDate(l.created_at) + ' | ' + action + (l.resource_name ? ' "' + l.resource_name + '"' : '') + (l.ip_address ? ' | IP: ' + l.ip_address : ''));
    });

    doc.end();
  } catch (err) { console.error(err); return res.status(500).json({ error: 'Erro' }); }
});

// Export CSV dos logs
router.get('/export-csv', authenticate, requirePermission('reports.export'), async (req: AuthRequest, res) => {
  try {
    const { data } = await sb().from('audit_logs').select('*').order('created_at', { ascending: false }).limit(2000);
    const csv = ['Data,Usuario,Acao,Recurso,Nome,IP,User Agent',
      ...(data || []).map((l: any) => '"'+l.created_at+'","'+(l.user_name||'')+'","'+l.action+'","'+l.resource_type+'","'+(l.resource_name||'')+'","'+(l.ip_address||'')+'","'+(l.user_agent||'')+'"')
    ].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.csv');
    return res.send('\uFEFF' + csv); // BOM para Excel
  } catch { return res.status(500).json({ error: 'Erro' }); }
});

export default router;
