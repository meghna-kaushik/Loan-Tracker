import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { supabaseAdmin } from '../services/supabase';

const router = Router();

// GET /api/audit - [collection_manager] List all audit logs
router.get('/', requireAuth, requireRole('collection_manager'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { action } = req.query;

    let query = supabaseAdmin
      .from('audit_logs')
      .select(`
        id,
        action,
        performed_by,
        performed_by_name,
        target_user_id,
        metadata,
        created_at
      `)
      .order('created_at', { ascending: false })
      .limit(500);

    if (action && typeof action === 'string' && action.trim().length > 0) {
      query = query.eq('action', action.trim());
    }

    const { data: logs, error } = await query;

    if (error) {
      console.error('Fetch audit logs error:', error);
      res.status(500).json({ error: 'Failed to fetch audit logs' });
      return;
    }

    res.json({ logs: logs || [] });
  } catch (err) {
    console.error('Get audit logs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
