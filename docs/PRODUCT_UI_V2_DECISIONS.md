# NABD Product UI V2 — source-led decisions and acceptance map

Date: 2026-10-17. This PR is **stacked on NABD reliability PR #1** and is intentionally not a new standalone stack or a production launch. Owner requested a real financial product and a substantial improvement to the supplied soft-white/lilac financial UI references.

## Source comparison: inspected, not cloned

| Pinned repository | What is useful for NABD | Why not transplant its stack? |
| --- | --- | --- |
| [Shadcn Fintech](https://github.com/abderrahimghazali/shadcn-fintech/tree/e338240d10c908ab49403adbcd0bb4cc980ebfce), MIT | Modular finance navigation, readable white surfaces, differentiated insight modules, interactive filters | 11-page Next.js app with Clerk, Redis optional, crypto/widgets and additional operational dependencies that do not satisfy NABD's actual merchant cashflow use case. |
| [Finance Dashboard](https://github.com/aamamunszone/finance-dashboard/tree/fc9014a5052f8f9d3907f767ce7ea53443e266ac), MIT | Correctly linked filter/search/export/transaction controls instead of inert cards | Front-end project explicitly describes simulated roles and static/mock chart limitations; copying these would create fake auth and unreliable financial feedback. |
| [Dashboard-Design](https://github.com/sjorsbogers/Dashboard-Design/tree/7705dfc0d13889e45c26a55ad5908da6a7a9a605), MIT | Acceptance-first philosophy: a search box must really search, a table must mutate durable data | Enterprise SaaS setup includes server-side auth/billing/organization complexity unpriced for NABD. |
| [Actual Budget](https://github.com/actualbudget/actual/tree/8d59f30cfb36b177882116e0bd0dae39e30d2751), MIT | Honest local-first data ownership and data restore experience | Broader personal budgeting product; syncing is an entire separate security/operations feature. |

All referenced license files/README descriptions were checked on GitHub. There is **no copied source, borrowed asset, or dependency** from those projects in this PR, so third-party licensing/attribution does not quietly enter NABD's All Rights Reserved code. User-supplied images are visual direction, not redistributed images.

## Actual product implementation in this scope

- **Overview:** derived current net (opening balance plus completed transactions), incoming/outgoing and net of selected period, six-month actual transaction chart, specific 14-day negative balance risk, expense-category visualization and editable recent transactions. No fabricated change percentages, bank accounts or profitability numbers.
- **Transactions:** create/edit/delete, type/status/search, 20-item pagination, input validation, storage preservation on failed writes, exact duplicate detection with explicit owner confirmation, actual CSV import, CSV export and backup.
- **Analytics:** category decomposition from completed expense records, six-month cash movement based on dated completed inputs, no separate invented analytics dataset.
- **What if?:** 3 parameter controls actually change the deterministic engine; impact marked hypothetical.
- **Decision view:** exposes named phases and evidence-derived risks/actions; **these are deterministic rules, not autonomous LLM agents**.
- **Settings:** opening balance, JSON backup/restore, local-only disclosure, reset with confirmation and owner-controlled records.
- **Visual:** owner-requested light/purple dashboard, RTL Arabic components, responsive grid, mobile navigation, selectable reporting window, modest lightweight CSS graphs, inline static SVG icons and no online fonts/CDN/animations/libraries.

The site still hosts only static files; the UI does not call a backend or spend on a paid service. Data remains in browser localStorage. That's appropriate for a demonstrable private/local tool, but **NOT a production privacy and reliability solution for multiple merchants**. The owner's statement "real product" is an explicit requirement to plan secure storage, account tenancy and operational support next, *not* evidence that their budget or access model is known.

## 500-item catalogue — applicability, not checklist theatre

Relevant items from [Senior-level-website-development-skills](https://github.com/ahpa5246-lgtm/Senior-level-website-development-skills/blob/feat/portfolio-intake-supervisor-v1/docs/500-senior-pairs-ar.md):

- **CSS/responsiveness** (#21–40): responsive Grid/Flex and clamped typography, semantic mobile navigation, no forced body overflow clipping, keyboard focus outlines. One real Chrome viewport-overflow failure was detected and fixed.
- **Interactions/performance** (#41–60): no giant charting library for 6 bars or an SVG icon pack; no CDN; avoid 3D or expensive full-page blur; limit on-screen transactions to 20 per page; avoid re-render on each scenario slider input.
- **Data/security/integrity:** do not silently accept malformed financial CSV, allow script injection, invent calculation results, duplicate imports silently, or claim cached local data is an encrypted persistent backend.
- **Quality gates:** tests and screenshots must be generated by *real executable* app paths, not UI mock data built separately. Budget, security and tenant isolation remain unresolved blocker checks.

## Real product launch gates — distinct from this PR

1. **Ownership/tenancy:** decide whether each merchant has one owner and staff roles, and whether multiple concurrent devices/users must share financial data. Browser localStorage has no tenant isolation or cross-device synchronization.
2. **Financial truth:** each account needs a dated opening balance, consistent currency, entry history, duplicate review, correction/audit history, partial payments and actual reconciliation. Cashflow prediction must explain how scheduled transactions were obtained; no bank integration has been implemented.
3. **Authentication and encrypted managed persistence:** before real merchant data, implement server-side ID/access checks (not browser role toggles), transaction audit records, secure session handling, safe storage and documented backup/restore and deletion; run tests for IDOR, double-submit, concurrency and tenant leaks.
4. **Hosting economics:** owner monthly ceiling, launch-day peak concurrency, required region, free-plan limits, egress, DB operations, backup, domain, support and failure recovery must have official dated quotes in normal/peak/recovery cases. No unverified $0 claim.
5. **Independent verification:** real browser E2E including RTL/mobile/offline, keyboard + screen-reader workflows, transactional correctness, security review, restore drill, production logging and small merchant pilot.
6. **Agent strategy:** if true intelligent autonomous agents are part of NABD product vision or competition obligations, separately define their tools, boundaries, inference expense and objective evaluation against a deterministic baseline; do not pretend the existing six labels satisfy that requirement.

## Tests and acceptance

The branch preserves and extends the 16 earlier Node regression cases (CSV, overdue dates, damaged storage, arithmetic). Additional Chrome E2E covers:
- Desktop load with visible DEMO badge and computed metrics.
- Create/edit/delete real IQD transactions; first real entry does not mix in demo records.
- Search/filter, real persisted opening balance, statistics derived from edits.
- CSV import including quoted description and duplicate protection.
- Scenario results changing with inputs.
- Mobile viewport without unwanted horizontal scrolling; offline PWA reload.
- Sanitized desktop/mobile screenshots from actual rendered product, not concept illustrations.

No claim that this is a full WCAG or financial-compliance certification. PR must remain draft pending the owner's product decisions, full real-data security work and acceptable visual preview.
