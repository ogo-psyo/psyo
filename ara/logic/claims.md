# Claims

## C01: Production P0 is not yet an end-to-end authenticated journey
- **Statement**: Existing P0 surfaces and contracts do not yet prove a new Telegram owner can complete activation and use all P0 modules with owner/pet isolation.
- **Status**: supported
- **Provenance**: ai-suggested
- **Falsification criteria**: A behavioral real-Telegram, two-owner, two-dog suite passes the full activation and P0 CRUD journey.
- **Proof**: [`docs/superpowers/plans/2026-08-13-psyo-production-p0-roadmap.md`]
- **Dependencies**: []
- **Tags**: P0, readiness, Telegram, RLS

## C02: Canonical PRD scope excludes billing and real social/AI capabilities from P0
- **Statement**: Telegram notifications and social capabilities are Beta; Stars, Plus, and AI-agent actions are Later in the canonical PRD.
- **Status**: supported
- **Provenance**: user
- **Falsification criteria**: The owner revises the canonical PRD scope.
- **Proof**: [`docs/PSYO_FINAL_PRD.md` §19]
- **Dependencies**: []
- **Tags**: scope, P0, Beta, Later
