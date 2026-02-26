import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { supabaseAdmin } from '../services/supabase';

const router = Router();

// GET /api/users - [collection_manager] List all users
router.get('/', requireAuth, requireRole('collection_manager'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { data: users, error } = await supabaseAdmin
      .from('profiles')
      .select('id, name, phone, role, is_active, created_at, created_by')
      .order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ error: 'Failed to fetch users' });
      return;
    }

    res.json({ users: users || [] });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users - [collection_manager] Create new user
router.post('/', requireAuth, requireRole('collection_manager'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, phone, password, role } = req.body;
    const manager = req.user!;

    // Validate fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    if (!phone || typeof phone !== 'string' || phone.trim().length === 0) {
      res.status(400).json({ error: 'Phone number is required' });
      return;
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    if (!role || !['field_agent', 'collection_manager'].includes(role)) {
      res.status(400).json({ error: 'Role must be field_agent or collection_manager' });
      return;
    }

    // Use fake email trick — phone number as email, no Twilio needed
    const fakeEmail = `${phone.replace(/\D/g, '').replace(/^91/, '')}@loanapp.internal`;

    // Create auth user using Supabase Admin
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: fakeEmail,
      password,
      email_confirm: true, // auto-confirm, no email OTP needed
    });

    if (authError || !authData.user) {
      if (authError?.message?.includes('already')) {
        res.status(409).json({ error: 'Phone number already in use' });
      } else {
        res.status(500).json({ error: authError?.message || 'Failed to create auth user' });
      }
      return;
    }

    // Insert profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authData.user.id,
        name: name.trim(),
        phone: phone.trim(),
        role,
        is_active: true,
        created_by: manager.id,
      })
      .select()
      .single();

    if (profileError) {
      // Rollback auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      res.status(500).json({ error: 'Failed to create user profile' });
      return;
    }

    // Audit log
    await supabaseAdmin.from('audit_logs').insert({
      action: 'USER_CREATED',
      performed_by: manager.id,
      performed_by_name: manager.name,
      target_user_id: profile.id,
      metadata: { name: profile.name, phone: profile.phone, role: profile.role },
    });

    res.status(201).json({
      user: {
        id: profile.id,
        name: profile.name,
        phone: profile.phone,
        role: profile.role,
        is_active: profile.is_active,
        created_at: profile.created_at,
      },
    });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/users/:id/deactivate - [collection_manager] Deactivate user
router.patch('/:id/deactivate', requireAuth, requireRole('collection_manager'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const manager = req.user!;

    // Prevent self-deactivation
    if (id === manager.id) {
      res.status(400).json({ error: 'You cannot deactivate your own account' });
      return;
    }

    // Check target user exists
    const { data: targetUser, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !targetUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (!targetUser.is_active) {
      res.status(400).json({ error: 'User is already deactivated' });
      return;
    }

    // Deactivate
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ is_active: false })
      .eq('id', id);

    if (updateError) {
      res.status(500).json({ error: 'Failed to deactivate user' });
      return;
    }

    // Disable auth user
    await supabaseAdmin.auth.admin.updateUserById(id, { ban_duration: '87600h' });

    // Audit log
    await supabaseAdmin.from('audit_logs').insert({
      action: 'USER_DEACTIVATED',
      performed_by: manager.id,
      performed_by_name: manager.name,
      target_user_id: id,
      metadata: { name: targetUser.name, phone: targetUser.phone },
    });

    res.json({ message: 'User deactivated successfully' });
  } catch (err) {
    console.error('Deactivate user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/users/:id/reset-password - [collection_manager] Reset password
router.patch('/:id/reset-password', requireAuth, requireRole('collection_manager'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { new_password } = req.body;
    const manager = req.user!;

    if (!new_password || new_password.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters' });
      return;
    }

    const { data: targetUser, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !targetUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const { error: resetError } = await supabaseAdmin.auth.admin.updateUserById(id, {
      password: new_password,
    });

    if (resetError) {
      res.status(500).json({ error: 'Failed to reset password' });
      return;
    }

    // Audit log
    await supabaseAdmin.from('audit_logs').insert({
      action: 'PASSWORD_RESET',
      performed_by: manager.id,
      performed_by_name: manager.name,
      target_user_id: id,
      metadata: { name: targetUser.name, phone: targetUser.phone },
    });

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
