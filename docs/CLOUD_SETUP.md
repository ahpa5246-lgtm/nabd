# NABD Secure Merchant Cloud — Setup and Release Gates

Status: draft PR #3 is stacked on product UI PR #2 and correctness PR #1. The cloud connection is DISABLED until a test project is configured. No merchant data, account, SMTP, payment method or hosted production service was provisioned in this PR.

## Setup for a non-programmer owner

1. Create a Free project on https://supabase.com/ in a deliberate region. Never enter a payment method for an unapproved upgrade. Do not use an existing production database.
2. In Supabase SQL Editor, review and apply supabase/migrations/20261017_secure_multitenant.sql. It installs workspace, membership, transaction and audit tables, authorization policies, protected audit hooks, version locking and an atomic owner-only restore function.
3. Under Authentication, review email/password and allowed Site URL/redirect settings. The bundled test email sender is NOT for public customer signup: it allows only pre-authorized team addresses and presently has a 2-email/hour limit. Plan a separately costed custom SMTP provider before general release.
4. Find your project HTTPS URL and the public sb_publishable key in Project Settings → API. Enter only these two values in cloud-config.js. Never enter a service-role, sb_secret, dashboard token, database password or SMTP password in the frontend/repository. The publishable key depends on correct RLS.
5. Preview an authorized branch. render.yaml now runs the no-dependency static build script and publishes the limited dist directory, not SQL files, tests, logs or repository internals. Do not merge or deploy publicly yet.
6. With two authorized synthetic test accounts, create Shop A and Shop B. Add fake records to A. Verify B sees zero of A's records through both UI and direct Supabase API; then try cross-tenant write requests. GitHub CI already tests the PostgreSQL rules with distinct users, but that does NOT constitute a real Supabase Auth integration test.
7. Open the same test store on two devices. Update a transaction on device A, then attempt an older edit on B. The version guard must reject B's stale write. Check logout, expired sessions, import, manual export, restore and loss of connectivity.
8. Keep old local data PRIVATE: the site never silently moves localStorage ledgers into the cloud. Manual export and owner-confirmed restore are provided, but remote restore is limited to 1,000 items per operation.
9. Before accepting actual merchant financial information: establish reliable encrypted backups and restoration drills, acceptable terms, data residency, disclosure of subprocessors, customer support, incident response and an independent security review.

## How the implementation works

- A separate Supabase Auth identity is required before any cloud financial records can be loaded.
- Each owner creates one or more named business workspaces; ownership and membership are verified by PostgreSQL Row Level Security. The database supports owner, editor and viewer roles, but the staff-invitation UI is NOT implemented yet; initial workspaces contain only their creator.
- Financial transactions are stored server-side and isolated per workspace. Audit rows record creation, edits and deletions. Clients must use the last seen version when editing or deleting, to avoid accidental overwrites across devices.
- Only public credentials appear in the browser. Tokens live in current-tab sessionStorage and are removed on logout; neither password nor server secret is persisted by frontend code.
- Cloud requests are not cached as financial data. The app shell can be viewed offline, but a disconnected cloud write cannot be marked saved. Offline mutation queues do not exist yet.
- Local demo is still available when cloud-config.js is blank.

## Pricing reality as of 2026-10-17

- Render static sites can be deployed for $0 within workspace bandwidth and pipeline limits; unexpected usage and operations are not automatically free.
- Supabase Free: currently 500 MB PostgreSQL, 50,000 monthly active users, 5 GB egress, two active free projects; eligible projects can be paused after a period of inactivity.
- Supabase Free does not provide downloadable automated database backups. Use independent backups and a genuine recovery test before launch.
- The included Auth email service is for pre-authorized team addresses and restricted sending. Commercial registration/password recovery requires SMTP and separately verified pricing.
- A custom public domain and merchant customer support may add costs. A small-scale test is possible at $0 but there is no evidenced unconditional zero-cost commercial production SLA.

Official sources:
https://supabase.com/pricing
https://supabase.com/docs/guides/database/postgres/row-level-security
https://supabase.com/docs/guides/auth/auth-smtp
https://supabase.com/docs/guides/platform/free-project-pausing
https://supabase.com/docs/guides/platform/backups
https://render.com/docs/free

## Evidence and known gaps

npm test checks input math, auth-token handling, client request failures and optimistic concurrency. GitHub Actions runs a real PostgreSQL 16 test for cross-tenant read/write denial, fake owner grants, read-only staff, server audit and atomic restore. Another workflow uses real Chrome with mocked Supabase endpoints to test sign in, onboarding, account switching, persistence and no fallback to unsafe localStorage. These simulations are not an external penetration test or live account test.

Before paid launch decide: subscription vs one-time licensing, users/staff per merchant, required bank reconciliation, opening balances, refund policy, data retention and recovery target, support model and monthly infrastructure budget. Keep this PR draft until these requirements and real provider validation are completed.
