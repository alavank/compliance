import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { AuthRequest, authenticate } from '../middleware/auth';

const router = Router();
const sb = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { data } = await sb().from('notifications').select('*').eq('user_id', req.user!.id).order('created_at', { ascending: false }).limit(50);
    return res.json({ notifications: data || [], unreadCount: (data || []).filter((n: any) => !n.is_read).length });
  } catch { return res.status(500).json({ error: 'Erro' }); }
});

router.put('/:id/read', authenticate, async (req: AuthRequest, res) => {
  try { await sb().from('notifications').update({ is_read: true }).eq('id', req.params.id).eq('user_id', req.user!.id); return res.json({ message: 'OK' }); }
  catch { return res.status(500).json({ error: 'Erro' }); }
});

router.put('/read-all', authenticate, async (req: AuthRequest, res) => {
  try { await sb().from('notifications').update({ is_read: true }).eq('user_id', req.user!.id).eq('is_read', false); return res.json({ message: 'OK' }); }
  catch { return res.status(500).json({ error: 'Erro' }); }
});

export default router;
