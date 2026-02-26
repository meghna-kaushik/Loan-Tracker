import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function seed() {
  console.log('🌱 Seeding initial Collection Manager...');

  const phone = '9999999999';
  const password = 'Manager@123';
  const name = 'Admin Manager';
  const fakeEmail = `${phone}@loanapp.internal`;

  // Create auth user using fake email (no Twilio/SMS needed)
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: fakeEmail,
    password,
    email_confirm: true,
  });

  if (authError) {
    if (authError.message.includes('already')) {
      console.log('⚠️  Auth user already exists, skipping...');
      return;
    }
    console.error('❌ Failed to create auth user:', authError.message);
    process.exit(1);
  }

  const userId = authData.user!.id;

  // Insert profile
  const { error: profileError } = await supabaseAdmin.from('profiles').insert({
    id: userId,
    name,
    phone: '9999999999',
    role: 'collection_manager',
    is_active: true,
  });

  if (profileError) {
    console.error('❌ Failed to create profile:', profileError.message);
    process.exit(1);
  }

  console.log('✅ Initial Collection Manager created!');
  console.log('📱 Phone: 9999999999');
  console.log('🔑 Password: Manager@123');
  console.log('');
  console.log('⚠️  IMPORTANT: Change this password immediately after first login!');
}

seed().catch(console.error);
