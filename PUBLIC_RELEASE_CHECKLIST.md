# Public Release Checklist

Use this before creating the public GitHub repository for the Codex for Open Source application.

## Repository

- [ ] Create a standalone public GitHub repository.
- [ ] Confirm GitHub profile visibility is public.
- [ ] Add a license approved by the maintainer.
- [ ] Add the production/demo URL if it should be public.
- [ ] Add repository topics such as `pwa`, `nextjs`, `supabase`, `pet-care`, `privacy`, `typescript`.

## Privacy And Secrets

- [ ] No `.env`, `.env.local`, or real environment files.
- [ ] No `.secrets` directory.
- [ ] No `.vercel` directory.
- [ ] No `.next`, `node_modules`, `reports`, `playwright-report`, or `test-results`.
- [ ] No private photos, personal messages, Telegram files, local absolute paths, or real user data.
- [ ] No service-role keys, API keys, tokens, passwords, or deployment credentials.

## Code And Docs

- [ ] `npm install` works from a clean checkout.
- [ ] `npm run build` passes.
- [ ] `npm run qa:local` passes or documented env blockers are clear.
- [ ] README explains scope, stack, local dev, verification, env, roadmap, and OSS status.
- [ ] `.env.example` contains placeholders only.
- [ ] Supabase setup docs do not expose a private project secret.

## Grant Form

- [ ] Use only `https://openai.com/form/codex-for-oss/`.
- [ ] Fill repository URL with the public GitHub URL.
- [ ] Role: `Primary maintainer`.
- [ ] Select `Codex Security` and `API credits for my project`.
- [ ] Use the prepared application text from Obsidian:
  `reports/grants/codex-for-oss-pso-leadgen-application-2026-06-04.md`.
