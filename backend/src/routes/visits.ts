import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { supabaseAdmin } from '../services/supabase';

const router = Router();

const VALID_STATUSES = ['PTP', 'Not Found', 'Partial Received', 'Received', 'Others'];

// POST /api/visits - [field_agent only] Submit a new visit
router.post('/', requireAuth, requireRole('field_agent'), async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      loan_number,
      person_visited,
      status,
      comments,
      photo_urls,
      latitude,
      longitude,
      address,
    } = req.body;

    const agent = req.user!;

    // Validate loan number - exactly 21 digits
    if (!loan_number || !/^\d{21}$/.test(loan_number)) {
      res.status(400).json({ error: 'Loan number must be exactly 21 digits' });
      return;
    }

    // Validate required fields
    if (!person_visited || typeof person_visited !== 'string' || person_visited.trim().length === 0) {
      res.status(400).json({ error: 'Person visited is required' });
      return;
    }

    if (!status || !VALID_STATUSES.includes(status)) {
      res.status(400).json({ error: `Status must be one of: ${VALID_STATUSES.join(', ')}` });
      return;
    }

    if (!comments || typeof comments !== 'string' || comments.trim().length === 0) {
      res.status(400).json({ error: 'Comments are required' });
      return;
    }

    // Validate photos
    if (!Array.isArray(photo_urls) || photo_urls.length < 1 || photo_urls.length > 5) {
      res.status(400).json({ error: 'Between 1 and 5 photos are required' });
      return;
    }

    // Validate geo
    if (latitude === undefined || latitude === null || longitude === undefined || longitude === null) {
      res.status(400).json({ error: 'Geolocation is required' });
      return;
    }

    if (!address || typeof address !== 'string' || address.trim().length === 0) {
      res.status(400).json({ error: 'Address is required' });
      return;
    }

    // Insert visit (append-only, no update/delete)
    const { data: visit, error } = await supabaseAdmin
      .from('visits')
      .insert({
        loan_number,
        agent_id: agent.id,
        agent_name: agent.name,
        agent_phone: agent.phone,
        person_visited: person_visited.trim(),
        status,
        comments: comments.trim(),
        photo_urls,
        latitude,
        longitude,
        address: address.trim(),
      })
      .select()
      .single();

    if (error) {
      console.error('Visit insert error:', error);
      res.status(500).json({ error: 'Failed to save visit' });
      return;
    }

    res.status(201).json({ visit });
  } catch (err) {
    console.error('Submit visit error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/visits/my?loan_number= - [field_agent] Get own visits by loan number
router.get('/my', requireAuth, requireRole('field_agent'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { loan_number } = req.query;
    const agent = req.user!;

    if (!loan_number || !/^\d{21}$/.test(loan_number as string)) {
      res.status(400).json({ error: 'Valid 21-digit loan number is required' });
      return;
    }

    const { data: visits, error } = await supabaseAdmin
      .from('visits')
      .select('*')
      .eq('agent_id', agent.id)
      .eq('loan_number', loan_number)
      .order('visited_at', { ascending: false });

    if (error) {
      console.error('Fetch visits error:', error);
      res.status(500).json({ error: 'Failed to fetch visits' });
      return;
    }

    res.json({ visits: visits || [] });
  } catch (err) {
    console.error('Get visits error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/visits/search - [collection_manager only]
router.get('/search', requireAuth, requireRole('collection_manager'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { loan_number, agent_query } = req.query;

    if (!loan_number && !agent_query) {
      res.status(400).json({ error: 'At least one search parameter is required' });
      return;
    }

    let query = supabaseAdmin
      .from('visits')
      .select('*')
      .order('visited_at', { ascending: false })
      .limit(200);

    if (loan_number && (loan_number as string).trim().length > 0) {
      query = query.eq('loan_number', (loan_number as string).trim());
    }

    if (agent_query && (agent_query as string).trim().length > 0) {
      const q = (agent_query as string).trim();
      query = query.or(`agent_name.ilike.%${q}%,agent_phone.ilike.%${q}%`);
    }

    const { data: visits, error } = await query;

    if (error) {
      console.error('Search error:', error);
      res.status(500).json({ error: 'Failed to search visits' });
      return;
    }

    res.json({ visits: visits || [] });
  } catch (err) {
    console.error('Search visits error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
