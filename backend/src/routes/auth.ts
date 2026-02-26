import { Router, Request, Response } from 'express';
import { supabase, supabaseAdmin } from '../services/supabase';

// Helper: convert phone number to fake email (avoids Twilio requirement)
function phoneToEmail(phone: string): string {
  const cleaned = phone.replace(/\D/g, '').replace(/^91/, '');
  return `${cleaned}@loanapp.internal`;
}

const router = Router();

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      res.status(400).json({ error: 'Phone and password are required' });
      return;
    }

    // Use fake email trick — no Twilio/SMS needed
    const fakeEmail = phoneToEmail(phone);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: fakeEmail,
      password,
    });

    if (error || !data.session) {
      res.status(401).json({ error: 'Invalid phone number or password' });
      return;
    }

    // Fetch profile to check is_active
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile) {
      res.status(401).json({ error: 'User profile not found' });
      return;
    }

    if (!profile.is_active) {
      res.status(403).json({ error: 'Account is deactivated. Please contact your manager.' });
      return;
    }

    res.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: {
        id: profile.id,
        name: profile.name,
        phone: profile.phone,
        role: profile.role,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      res.status(400).json({ error: 'Refresh token is required' });
      return;
    }

    const { data, error } = await supabase.auth.refreshSession({ refresh_token });

    if (error || !data.session) {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    res.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
  } catch (err) {
    console.error('Refresh error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
