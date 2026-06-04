# Supabase setup — Псё

## 1. Create or choose project

Use Supabase dashboard or CLI. Required values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Do not paste service role key in chat/logs.

## 2. Apply schema

If linked through CLI:

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push
```

Or paste `supabase/schema.sql` into Supabase SQL editor.

## 3. Add Vercel env

```bash
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
npx vercel env add SUPABASE_SERVICE_ROLE_KEY production
npx vercel env add NEXT_PUBLIC_SUPABASE_URL preview
npx vercel env add SUPABASE_SERVICE_ROLE_KEY preview
```

Then redeploy:

```bash
npx vercel deploy --prod --yes
```

## 4. Verify

```bash
curl https://pso-mvp-uglanovrms-projects.vercel.app/api/app/bootstrap
```

Without `petId`, endpoint intentionally returns demo bootstrap. With real DB, pass `?petId=<uuid>`.

## Notes

Current API routes use server-side service role for MVP speed. Before public launch, add real auth session handling and avoid broad service-role operations from request body alone.
