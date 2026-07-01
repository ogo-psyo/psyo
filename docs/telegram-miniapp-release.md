# Псё Telegram Mini App release checklist

## Current product frame

Release target: adapt the existing PSYO web product, not a reduced rebuild.

Core MVP:

- social dog passport;
- care reminders;
- shareable public card;
- PDF passport for external people;
- local-first preview;
- Telegram Mini App session bridge with pseudonymous `psyo_user_id`.

## Environment

Required for Telegram session validation:

```bash
TELEGRAM_BOT_TOKEN=...
PSYO_ID_PEPPER=...
NEXT_PUBLIC_APP_URL=https://...
```

Optional but recommended for bot webhook verification:

```bash
TELEGRAM_WEBHOOK_SECRET=...
```

`TELEGRAM_BOT_TOKEN` is used only server-side to validate Telegram `initData`.
`PSYO_ID_PEPPER` is used only server-side to derive:

```text
psyo_user_id = HMAC_SHA256(PSYO_ID_PEPPER, telegram_user_id)
```

Do not log raw Telegram `initData` or raw Telegram user id.

## Telegram BotFather setup

1. Deploy the web app to HTTPS.
2. In BotFather, set the Mini App / Web App URL to the Vercel URL.
3. Add a bot menu button that opens the Mini App.
4. Set Telegram webhook to `/api/telegram/webhook`.
5. Open from Telegram and verify the Mini App panel says Telegram session is connected.
6. Send `/start` to the bot and verify it replies with an `Открыть Псё` button.

## Release gate

- `npm run check` passes.
- Public dog card opens.
- PDF action opens printable card.
- Share action works in browser or Telegram share URL fallback.
- Telegram session endpoint returns `mode=telegram` only with valid `initData`.
- Telegram bot replies to `/start` and `/card` with a Mini App launch button.
- App remains usable in browser preview without Telegram.
