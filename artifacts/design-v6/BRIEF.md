# Pso journal v6 implementation

Ruslan selected B «Дневник» on2026-09-06 15:04. Approved visual contract: ../design-reviews/pso-v6/screenshots/b-home-390.png,b-profile-390.png and320 variants. Source CSS/JS in same study. Operate mode, Telegram-first mobile owner care.

Terminal: real home/profile composition faithful to B; shared muted forest/mint/lilac system on map, Gav, things and secondary UI; preserve five sections, scenarios, calendar, voice capture, breed search, profile editors and privacy; local verified preview and screenshots. No deployment, new deps, paid APIs, backend/auth/storage change.

State contract: ProfileService existing profile controls identity; TodayService/ReminderService existing reminders own due/completed state, observations own confirmed notes/timestamps. New journal view model is read-only projection of existing records for local calendar day; rows navigate existing flows. Empty/invalid date states never manufacture activity. Capture retains existing confirm/extract/save transitions; privacy/source errors unchanged. Domain model wins over illustrative comp content. Profile documents/observations/care history stay existing stores and handlers. Existing single selected dog ownership/key retained.

Build slices: (1) day projection + home structure, (2) profile overview + preserved secondary surfaces, (3) shared navigation/theme, (4) qa:local + local browser flow +320/390/1280 visual comparison +fresh skill finish review/documenter.

Base8cff342 reused for verified functional fixes only; v5 visual direction rejected. New branch design/journal-v6-20260906 in wt-pso-journal-v6, isolated from v5 and production.
