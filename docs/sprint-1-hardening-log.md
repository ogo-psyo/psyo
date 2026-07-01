# Sprint 1 Hardening Log

Date: 2026-05-07

## Implemented P0 changes

### Backend/data safety

- `GET /api/app/bootstrap`
  - No longer returns the first real pet from Supabase to unauthenticated requests.
  - Unauthenticated Supabase mode now returns empty sign-in-needed state.

- `POST /api/assistant`
  - Requires authenticated user when Supabase is enabled.
  - Pet context is loaded only when `pets.owner_id` matches the authenticated user.
  - Still demo answer, but no longer open service-role context read by arbitrary `petId`.

- `GET/POST /api/wishlist`
  - Requires authenticated user when Supabase is enabled.
  - Reads/writes only wishlist items for pets owned by the authenticated user.
  - Checks pet ownership before insert.

- `POST /api/pets`
  - Added UI/Russian value → DB enum mapping for vaccine, parasite, social mode, and friendliness fields.
  - Reduces DB check-constraint failures from UI values.

### Auth UX

- Added explicit auth UI state machine:
  - `idle`
  - `sending`
  - `sent`
  - `rate_limited`
  - `retryable_error`
- Magic-link button disables during sending and cooldown.
- Added persistent sent state with target email and open-mail CTA.
- Added 429/rate-limit user-readable state.
- Added retry cooldown and change-email action.
- Removed short-lived sent toast as the only success state.

### QA/release tooling

Added:

- `scripts/qa/check-env-contract.mjs`
- `scripts/qa/check-auth-redirect-source.mjs`
- `scripts/qa/smoke-auth-generate-link.mjs`
- `scripts/qa/smoke-auth-send-email.mjs`
- `scripts/qa/smoke-bootstrap-auth.mjs`

Package scripts:

- `npm run qa:local`
- `npm run qa:auth:generate-link`
- `npm run qa:auth:send`
- `npm run qa:bootstrap`

### Env/setup hardening

- `.env.example` now includes:
  - `NEXT_PUBLIC_APP_URL`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `OPENAI_API_KEY`
- `.gitignore` now ignores `.env`, `.env.*`, and `.secrets/` while keeping `.env.example`.
- `scripts/connect-supabase.sh` now asks for app URL, anon key, service key, pushes Supabase config, adds all required Vercel env vars, and runs `qa:local` before deploy.

## Verification run

- `npm run qa:local` passed.
  - `next build` passed.
  - env contract passed.
  - auth redirect source check passed.
- `npm run qa:auth:generate-link` passed against Supabase project `cnqcwchseefwqgjgnmyn`.
  - generated link contains production URL.
  - generated link does not contain localhost.
  - no real email sent.

## Still not done

- Real email sending still depends on Supabase/provider quota unless custom SMTP is connected.
- Assistant remains demo; real LLM requires safety gates and thread/message persistence.
- Map remains demo until zones CRUD/privacy model is implemented.
- Wishlist UI still not connected; API is safer but feature is not product-ready.
- Public dog card remains demo/query-backed until DB-backed public-safe route/policy exists.
- Avatar generation still lacks persistent storage.

## 2026-06-25 UI kit + DB foundation pass

- Updated the Today foundation screen toward the imported UI kit direction:
  - cream/mint soft iOS surface;
  - large dog-first hero;
  - compact profile/reminder/place metrics;
  - next-care action card;
  - quick Calendar/Map/Passport actions.
- Moved the v1 BFF/ProfileService readiness into a quieter DB/BFF status panel instead of making it the visual focus.
- Fixed onboarding CTA clickability by preventing the decorative preview layer from intercepting taps.
- Removed symbolic tab labels that created a noisy bottom-nav artifact in screenshots.
- Screenshot evidence: `reports/ui-kit-db-foundation-390.png`.
- Verification: `npm run qa:local` passed.

### Follow-up

- Replaced the low-value `profile / reminders / places` counter strip with a daily-status strip:
  - walk context;
  - care/reminder context;
  - mood/social context.
- Screenshot evidence: `reports/ui-kit-daily-status-390.png`.
- Verification: `npm run qa:local` passed.
