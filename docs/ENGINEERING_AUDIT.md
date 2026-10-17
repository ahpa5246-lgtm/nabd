# NABD: engineering audit and reviewed roadmap

Baseline: 2026-10-17. Scope: the existing Iraqi dinar local-first cashflow prototype at https://github.com/ahpa5246-lgtm/nabd. This is an engineering review of its current source and draft corrections, not a live merchant pilot or independent accounting/security certification.

## Current architecture: observed, not assumed

NABD consists of static HTML/CSS, ES-module JavaScript, manually imported CSV transactions, browser localStorage, a 14-day cashflow scenario and an offline service worker. The render.yaml configuration publishes static files and does not provision backend compute or database storage. There is no server authentication, cross-device sync, payment gateway, bank feed or AI inference API.

Six named stages are evaluated in one deterministic JavaScript run. They are **not six independent LLM agents**. The math uses scheduled transaction dates; it is not a statistical forecast. The default “balance” is net completed transactions with an assumed opening balance of zero, not a confirmed account balance.

The project is publicly visible but has an All Rights Reserved license. Do not treat it as an open-source template for unrestricted redistribution.

## Failure modes found and addressed in draft PR #1

| Priority | Problem in original | Proposed correction | Evidence |
| --- | --- | --- | --- |
| Critical | Naive split(',') corrupted quoted CSV and silently discarded invalid lines | Quoted CSV parser, strict dates/types/amounts, atomic reject and deduplication | Node unit tests |
| Critical | Demo entries were saved and user CSV appended to sample balances | Demo badge and first-real-import isolation | Mocked app event tests |
| High | Invalid persisted JSON crashed the app and unconditional save could erase it | Explicit read-error recovery, raw backup option and confirmed reset | Corrupt-storage regression |
| High | Raw agent summary text could interpolate a transaction description into HTML | Escape untrusted description in agent summaries | DOM-entry mock injection test |
| High | Overdue outgoing obligations were invisible and future completed income affected current cash | Conservative day-zero due expense, no presumed overdue receipts, future-completed warning | Fixed-date financial test cases |
| High | Percentage scenario produced fractional IQD then invalidated a scheduled expense | Round amount to integer while preserving original transaction input | Scenario regression |
| High | Some action impact amounts were unsupported estimates | Remove unsupported numerical impact; label collection gap an assumed target | Action code review |
| Medium | Broad service worker interception could retain unintended requests | Same-origin static shell restriction and cache version bump | Static CI; **real offline browser testing still pending** |
| Medium | Text at 8–11px and non-focusable file inputs | Larger copy, keyboard focus, skip navigation | Real accessibility tests pending |

## What still blocks a real financial product

1. **Opening balance:** must know the date and amount *before* the first transaction in the imported period; otherwise no verified current cash claim. Future feature: explicit starting balance and reconciliation workflow.
2. **Data protection:** localStorage and unencrypted JSON backups are sensitive on shared devices. Users cannot safely assume encryption, account isolation or recovery after browser data deletion. Need business review and privacy/retention policy for real financial data.
3. **Real-world accounting:** refunds, partial payments, double-entry balancing, multiple wallets/currencies, counterparty confirmations and bank reconciliation are absent. Duplication heuristics can hide legitimate repeated transactions and need user-controlled review.
4. **Deployment economics:** static hosting avoids dedicated app servers, but zero recurring cost and provider quotas must be substantiated with current dated terms for the actual traffic and domain requirement. Do not invent a universal free hosting plan.
5. **Installability and accessibility:** real offline reload, PWA icons/install prompts, screen-reader output, low-end phone behavior and RTL layouts have **not** been checked in real browsers by these tests.
6. **Multi-agent requirements:** six deterministic stages can be explainable and useful; they do not establish actual agentic AI or autonomy if a competition requires tool-using intelligent agents. The next design depends on contest rules.

## Reference repositories (learning, not cloning)

- Actual Budget: https://github.com/actualbudget/actual/tree/8d59f30cfb36b177882116e0bd0dae39e30d2751 — maintained local-first personal budgeting, optional synchronization, MIT LICENSE.txt. Good inspiration for backup, history, data ownership and user trust. Different business objective and a larger operational footprint.
- Firefly III: https://github.com/firefly-iii/firefly-iii/tree/b9c31006e8d3008df3d12e23de86b66088c9480e — larger self-hosted personal finance product; AGPLv3, with different server/maintenance costs. License compatibility must be reviewed before copying code.
- maybe-finance/maybe — repository was archived at review time; not preferred as an actively maintained basis.

None of these have been security-audited or deployed as part of this work. No code has been copied from them. Choosing a highly starred finance app does not solve the budget, data ownership or feature-fit problem.

## Sequenced tasks with observable completion criteria

| ID | Status | Work and acceptance |
| --- | --- | --- |
| NABD-T01 | Audited | Inspect source, licensing, architecture and active GitHub work |
| NABD-T02 | Draft PR | CSV import rejects malformed rows atomically and handles quotes/UTF-8 |
| NABD-T03 | Draft PR | Forecast handles overdue outgoing, uncertain overdue incoming and future completed |
| NABD-T04 | Draft PR | Local corruption recovery, reliable backup import and demo isolation |
| NABD-T05 | Draft PR | Agent output escapes descriptions; negative tests for injected HTML |
| NABD-T06 | Draft PR | Tests, static-site smoke, safer SW scope, keyboard/readability baseline |
| NABD-T07 | Owner decision | Explicit opening balance and start-of-ledger date; reconciliation |
| NABD-T08 | Owner decision | Business privacy/identity, currency/wallet model, retention |
| NABD-T09 | Pending | Actual cross-browser/mobile, offline and accessibility tests with evidence |
| NABD-T10 | Pending | Hosting normal/peak/recovery usage with dated verified provider quotas |
| NABD-T11 | Conditional | Genuine agentic workflow only if project/contest requires it |
| NABD-T12 | Needs design approval | Distinctive mobile UX concept and verified working states |

Completed-by-PR is not identical to merged, user-accepted or production-verified. Keep work in a feature branch and avoid duplicates in the autonomous supervisor.

## Questions requiring the owner's judgment

1. Is NABD intended for hackathon demonstration, a private pilot, or actual merchants?
2. Is zero monthly spending a hard requirement, and is a custom public domain necessary?
3. Must cashflow use IQD in one account, or several accounts/currencies and a known opening balance?
4. Does the product need login and data synchronization across devices?
5. Is a deterministic explainable engine accepted, or do the actual evaluation criteria require independent AI agents?

## Verification limitations

GitHub Actions uses Node built-in tests, a **mocked** document for app interactions and a static HTTP smoke check. This is not a real mobile/desktop browser end-to-end run, accessibility audit, security penetration test, merchant trial or verified hosting quotation. Do not claim those checks passed without additional evidence.
