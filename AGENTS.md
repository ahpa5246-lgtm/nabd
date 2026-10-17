# NABD engineering instructions

This repository is a static, client-side local-first **financial decision-support prototype**. Treat money, transaction dates, CSV imports and stored records as high-risk correctness boundaries. Financial terminology and reports must not imply independent bank verification, guaranteed cashflows or professional accounting advice.

Read docs/ENGINEERING_AUDIT.md and the current README before changing architecture. Consult the existing owner-approved Senior-level-website-development-skills guidance for applicable patterns, **not** for automatically adding unneeded services.

Rules for coding:
1. Preserve zero-backend and no paid API dependencies unless the owner explicitly approves a new requirement and documented ongoing costs.
2. Do not claim the six deterministic phases are separate autonomous AI agents or trained predictors.
3. New financial formulas must have deterministic Node regression tests fixing the reference date, opening balance assumptions and exact expected outcomes.
4. Treat localStorage and exported backups as private finance information; never put real merchant records or API keys in issues, CI logs or public fixtures.
5. Reject CSV/JSON input atomically; no partial writes, silent row drops, invalid calendar dates or non-integer Iraqi dinar arithmetic.
6. Escape any untrusted description before interpolating into HTML; do not treat an HTML screenshot as a security test.
7. Protect demo-vs-live provenance, existing user backups, unknown opening balances and deletion/restore confirmation.
8. Do not copy popular finance applications without checking exact commit, license, assets and operational fit.
9. Run npm run check and npm test before marking a feature done; GitHub Actions and a static HTTP smoke must pass. These tests do not replace real mobile/RTL/keyboard/offline/browser checks.
10. Build bounded PRs; no auto-merge, public release, financial integrations, billing, permanent storage migrations or owner data import without explicit approval.

For new major product capabilities, ask only missing high-impact business questions: release intent, hard monthly budget, real user concurrency, sensitive data, synchronization needs and reconciliation. Avoid asking the owner to choose technical stacks by name.

The proposed initial implementation is draft PR #1. Keep later unapproved tasks as review-needed, not as running background work.
