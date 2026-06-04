#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

if (process.env.ALLOW_REAL_EMAIL_SEND !== '1') {
  console.error('Refusing to send real email. Set ALLOW_REAL_EMAIL_SEND=1 and QA_EMAIL explicitly.');
  process.exit(3);
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const expectedAppUrl = process.env.EXPECTED_APP_URL || process.env.NEXT_PUBLIC_APP_URL;
const email = process.env.QA_EMAIL;

if (!supabaseUrl || !anonKey || !expectedAppUrl || !email) {
  console.error('Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, EXPECTED_APP_URL/NEXT_PUBLIC_APP_URL, or QA_EMAIL');
  process.exit(3);
}

const supabase = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { error } = await supabase.auth.signInWithOtp({
  email,
  options: { emailRedirectTo: expectedAppUrl },
});

if (error) {
  console.error(JSON.stringify({ ok: false, status: error.status, message: error.message }, null, 2));
  process.exit(error.status === 429 ? 4 : 2);
}

console.log(JSON.stringify({ ok: true, email, expectedAppUrl, note: 'One real email send requested.' }, null, 2));
