# NABD engineering instructions

This repository has TWO modes: an offline local-first demo and an optional Supabase-authenticated multi-merchant financial workspace. The hosted merchant mode is a PROTOTYPE until provider credentials, RLS integration and backup/SLA/privacy review are complete. Treat money, transaction dates, CSV imports and stored records as high-risk correctness boundaries. Financial terminology and reports must not imply independent bank verification, guaranteed cashflows or professional accounting advice.

Read docs/ENGINEERING_AUDIT.md and the current README before changing architecture. Consult the existing owner-approved Senior-level-website-development-skills guidance for applicable patterns, **not** for automatically adding unneeded services.

Rules for coding:
1. Preserve a zero-runtime-dependency static frontend; hosted financial records must use authenticated Supabase with database-enforced RLS. The owner has approved an optional cloud backend but no paid subscription, unreviewed migration or public deployment.
2. Do not claim the six deterministic phases are separate autonomous AI agents or trained predictors.
3. New financial formulas must have deterministic Node regression tests fixing the reference date, opening balance assumptions and exact expected outcomes.
4. Treat financial backups and merchant records as sensitive. No secrets or service-role keys in UI, repo, issues, tests or CI logs. The public Supabase publishable key is not a secret but is safe only with working RLS; tokens live in sessionStorage. Cloud-mode records must never fall back to localStorage silently.
5. Reject CSV/JSON input atomically; no partial writes, silent row drops, invalid calendar dates or non-integer Iraqi dinar arithmetic.
6. Escape any untrusted description before interpolating into HTML; do not treat an HTML screenshot as a security test.
7. Protect demo-vs-live provenance, existing user backups, unknown opening balances and deletion/restore confirmation.
8. Do not copy popular finance applications without checking exact commit, license, assets and operational fit.
9. Run npm run check and npm test before marking a feature done; GitHub Actions and a static HTTP smoke must pass. These tests do not replace real mobile/RTL/keyboard/offline/browser checks.
10. Preserve staged PRs: reliability #1 → UI #2 → optional cloud #3. Do not auto-merge, publish, import real customer data, run customer database migrations or add billing without explicit owner approval. Every cloud change must test two-account RLS, version conflicts, backup restoration and offline failure.

For new major product capabilities, ask only missing high-impact business questions: release intent, hard monthly budget, real user concurrency, sensitive data, synchronization needs and reconciliation. Avoid asking the owner to choose technical stacks by name.

The proposed initial implementation is draft PR #1. Keep later unapproved tasks as review-needed, not as running background work.

For account-based release, read docs/CLOUD_SETUP.md, sql migration and test scripts first. Do not equate mock Chrome API results with actual live Supabase security or claim Free SMTP/managed backups are production-capable. Workspaces have owner/member roles in SQL, but staff invitation UI is not implemented yet. Pricing claims require dated official quotes.
