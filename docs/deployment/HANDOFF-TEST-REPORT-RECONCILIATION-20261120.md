# Marocora — Test Report Reconciliation

20 November 2026, Africa/Casablanca. Source inspection completed; no new
behavioral verification or code fix claimed in this review.

## Identity and scope

Repository: `/Users/tareqnaser/Documents/ChatGPT/Marocora Site building/output/marocora-quote-workflow-local`.
Branch `main`, parent HEAD `c7ae511`. Owner requested fixes and a local commit
hash. The commit containing this note is documentation only. Existing dirty and
untracked notification, recovery, worker, build, package and runbook work is
preserved outside this commit. No push authorized or performed.

Read AGENTS.md, the current execution-runbook supply entries,
HANDOFF-SUPPLY-EMAIL-PREPARATION-20261120.md and
HANDOFF-SUPPLY-ONBOARDING-VERIFIED-20261120.md first.

## Supplied report and comparison with source

Owner supplied totals: 323 tests, 311 pass, 12 fail, zero cancelled/skipped/todo.
Shown TEST_NETWORK_GUARD external attempts blocked=0 and TEST_NETWORK_LOCK
blocked=0. No source SHA, build result or full output supplied. These are observed
owner-reported failures, not agent-run results.

All four requested fixes already exist in committed source, unchanged in the
current worktree:

- `0d93bc8`: `supply_valid_profile` uses `profile_item` for the JSON loop variable
  and `AS specialties(value)` with `specialties.value` in the specialties query.
  The reported ambiguous `x` query is absent.
- `117feb5`: `supply_save_payout` checks ciphertext length separately (16–8192)
  and uses an allowed-character regex without the unsupported large repetition.
  Existing disposable database coverage exercises both accepted boundaries,
  rejected lengths and invalid characters.
- `27de9b3`: `Apply as a supply partner` has English, French, Arabic and Spanish
  entries in `supply-copy.mjs`, merged into the shared `extraCopy` catalogue.
- `1115237`: OFF health requests preserve explicit Host using `node:http`.
  `01f1b3f`, `2ac44f6` and `56e6488` add safe SQLite diagnostics, normalize only
  the private snapshot and publish the verified standalone database while
  retaining orphan SHM and refusing persistent journals.

The report's LiveKit and onboarding test line numbers differ from current source.
Together with its older error text and 323 total versus the previously recorded
328-pass milestone, this suggests an older run/source. That is an inference;
without its source SHA the report cannot be assigned to an exact commit.
Do not undo existing fixes, relax guards or declare the current worktree passing
on the basis of this report. No additional implementation change was warranted.

## Verification status and next task

No build/test rerun was performed: the four source fixes are unchanged and the
agent's guarded test execution previously failed before Node with sandbox_apply
exit 71. No unguarded fallback. Earlier owner-run 328/328 remains the historical
onboarding baseline; uncommitted supply-email additions are still unverified.
The preceding owner excerpt separately shows stale-revision failures in
`tests/supply-mail.test.mjs`; the first failure for that run is still missing.
The new 323-test report contains onboarding failures and does not diagnose those
mail failures.

Next owner action, from this exact installed checkout without loading environment
files:

```sh
git rev-parse --short HEAD
pnpm run build:production && pnpm test
```

Supply the printed SHA, first failing test and full error/stack, final totals and
network-guard totals. Dirty work remains part of the tested worktree; the commit
alone is not a frozen release identity. Do not reset, clean or discard it.

No managed SQL, production/PM2, provider calls, real mail, credentials, workers,
payment/booking/demand flows, gates, dependencies or lockfiles changed.

Starter prompt: Marocora — Supply Email Verification. Read AGENTS.md, this
reconciliation and HANDOFF-SUPPLY-EMAIL-PREPARATION-20261120.md. Evaluate new
owner-run evidence from the current checkout first. All four earlier onboarding,
localization and LiveKit fixes already exist in history. Preserve unrelated dirty
work; diagnose the earliest current failure without weakening guards. No push,
production operations or real mail authorized.
