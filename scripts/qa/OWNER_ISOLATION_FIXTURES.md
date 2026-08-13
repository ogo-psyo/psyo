# Owner isolation QA fixtures

`npm run qa:identity:isolation` always runs the synthetic Telegram signature,
session-cookie and fixture-topology checks. The live behavioral section skips
safely unless `PSYO_QA_ISOLATION_RUN=1` is set.

The live runner is deliberately restricted to a loopback app whose health
endpoint reports `APP_ENV=qa`. Use a dedicated QA Supabase project only. Never
point it at production or at human-owned records.

Required fixture topology:

- owner A: two pre-created dogs (`A1`, `A2`);
- owner B: one pre-created dog (`B1`);
- two distinct, fresh, signed Telegram `initData` strings bridged to those QA
  owners;
- UUIDs for all three dogs.

Environment contract (provide values through the process environment; do not
commit them):

```text
PSYO_QA_ISOLATION_RUN=1
PSYO_QA_ISOLATION_BASE_URL=http://127.0.0.1:3100
PSYO_QA_ISOLATION_TARGET=qa
PSYO_QA_ISOLATION_ACK=isolated-fixtures-only
PSYO_QA_OWNER_A_INIT_DATA=<fresh signed fixture>
PSYO_QA_OWNER_B_INIT_DATA=<fresh signed fixture>
PSYO_QA_OWNER_A_PET_1_ID=<uuid>
PSYO_QA_OWNER_A_PET_2_ID=<uuid>
PSYO_QA_OWNER_B_PET_1_ID=<uuid>
```

The runner asserts the HttpOnly/SameSite/Secure session cookie, distinct owner
bridges, A1/A2 bootstrap separation, cross-owner read/write denial, and CRUD on
temporary QA reminders. It deletes only the reminder rows it created. It never
prints `initData`, session cookies, raw Telegram IDs, or owner IDs.

A skipped live section is not RLS or IDOR runtime evidence. Preserve the
command output from an enabled isolated run before making that claim.
