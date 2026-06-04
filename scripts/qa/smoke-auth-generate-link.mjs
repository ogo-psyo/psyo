#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const expectedAppUrl = process.env.EXPECTED_APP_URL || process.env.NEXT_PUBLIC_APP_URL;
const email = process.env.QA_EMAIL || `qa-auth-smoke-${Date.now()}@example.com`;

function fail(code, message) {
  console.error(message);
  process.exit(code);
}

function sanitize(value) {
  return String(value || '')
    .replace(/(token=)[^&]+/g, '$1[redacted]')
    .replace(/(token_hash=)[^&]+/g, '$1[redacted]')
    .replace(/(access_token=)[^&]+/g, '$1[redacted]')
    .replace(/(refresh_token=)[^&]+/g, '$1[redacted]')
    .replace(/(code=)[^&]+/g, '$1[redacted]');
}

if (!supabaseUrl || !serviceKey || !expectedAppUrl) {
  fail(3, 'Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or EXPECTED_APP_URL/NEXT_PUBLIC_APP_URL');
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await supabase.auth.admin.generateLink({
  type: 'magiclink',
  email,
  options: { redirectTo: expectedAppUrl },
});

if (error) fail(2, `Supabase generateLink failed: ${error.message}`);

const actionLink = data?.properties?.action_link || '';
const decoded = decodeURIComponent(actionLink);
const badLocalhost = decoded.includes('localhost') || decoded.includes('127.0.0.1');
const expected = decoded.includes(expectedAppUrl);

const result = {
  generated: Boolean(actionLink),
  expectedAppUrl,
  containsExpectedAppUrl: expected,
  containsLocalhost: badLocalhost,
  actionLinkSanitized: sanitize(decoded),
};

console.log(JSON.stringify(result, null, 2));

if (!actionLink || badLocalhost || !expected) process.exit(1);
