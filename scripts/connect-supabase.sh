#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

read -rp "Supabase project ref (e.g. abcdefghijklmno): " PROJECT_REF
read -rp "Canonical app URL [https://pso-mvp-uglanovrms-projects.vercel.app]: " APP_URL
APP_URL=${APP_URL:-https://pso-mvp-uglanovrms-projects.vercel.app}
read -rp "NEXT_PUBLIC_SUPABASE_URL: " SUPABASE_URL
read -rsp "NEXT_PUBLIC_SUPABASE_ANON_KEY: " SUPABASE_ANON_KEY
printf '\n'
read -rsp "SUPABASE_SERVICE_ROLE_KEY: " SERVICE_ROLE_KEY
printf '\n'

if [[ -z "$PROJECT_REF" || -z "$APP_URL" || -z "$SUPABASE_URL" || -z "$SUPABASE_ANON_KEY" || -z "$SERVICE_ROLE_KEY" ]]; then
  echo "Missing required value" >&2
  exit 1
fi

echo "Linking Supabase project..."
npx supabase link --project-ref "$PROJECT_REF"

echo "Pushing database migrations..."
npx supabase db push

echo "Pushing Supabase config..."
npx supabase config push --project-ref "$PROJECT_REF" --yes

add_env() {
  local name="$1"
  local value="$2"
  local target="$3"
  # Remove existing value if present; ignore errors.
  npx vercel env rm "$name" "$target" --yes >/dev/null 2>&1 || true
  printf '%s' "$value" | npx vercel env add "$name" "$target" >/dev/null
}

echo "Adding Vercel env vars for production and preview..."
for target in production preview; do
  add_env NEXT_PUBLIC_APP_URL "$APP_URL" "$target"
  add_env NEXT_PUBLIC_SUPABASE_URL "$SUPABASE_URL" "$target"
  add_env NEXT_PUBLIC_SUPABASE_ANON_KEY "$SUPABASE_ANON_KEY" "$target"
  add_env SUPABASE_SERVICE_ROLE_KEY "$SERVICE_ROLE_KEY" "$target"
done

echo "Running local QA gate..."
npm run qa:local

echo "Redeploying production..."
npx vercel deploy --prod --yes

echo "Done. Verify:"
echo "APP_URL=$APP_URL npm run qa:bootstrap"
echo "npm run qa:local"
