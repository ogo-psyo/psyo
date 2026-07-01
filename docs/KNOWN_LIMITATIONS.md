# RC1 Foundation Known Limitations

- Billing is intentionally disabled by default.
- `GET /api/billing/entitlements` returns a free entitlement snapshot only.
- Telegram Stars invoice creation is not enabled.
- Reminder dispatch exists as product direction, not a production scheduler.
- Legal/support pages are placeholders, not approved legal documents.
- Public card safety still uses the existing route and needs the RC1 projection model.
- Production Mini App uses the deployed Vercel app, but full Telegram manual matrix is not complete.
