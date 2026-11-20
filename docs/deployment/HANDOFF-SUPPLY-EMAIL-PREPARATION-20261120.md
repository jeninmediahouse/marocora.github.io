# Marocora — Supply Email Notification Preparation

## Current checkpoint — SQL NULL test-harness fix

20 November 2026. Parent HEAD `71afda7`, branch `main`. Owner's newer pasted
tail again shows supply-mail failures at lines 138, 144 and 166, without the
first failure, source SHA, final totals or guard totals. This supersedes the
reconciliation note as the active task; earlier onboarding fixes remain intact.

Source inspection found a definite fixture defect: `to_jsonb(SQL NULL)` remains
SQL NULL, and psql prints an empty field. `JSON.parse` cannot parse that output.
Mail claim and finish legitimately return NULL for empty queues or unaccepted
completion tokens. The fixture query now uses
`coalesce(to_jsonb(public.<rpc>(...)), 'null'::jsonb)`, including concurrent claim
queries. Added a disposable-database case exercising the real empty historical
application queue and an unknown completion token, both expected to return null
without writing an event. All prior revision, fencing and concurrency assertions
remain unchanged. There are now 20 declarations: seven top-level (including the
database parent) and thirteen nested.

The blank-field parsing bug explains how an early case can abort before later
saves and cause fixed-revision cases to fail. Attribution to this exact owner run
is still an inference because its earliest error was omitted. Do not claim a
runtime pass or assume no other failures remain.

Final `node --check` passed on both server modules and the updated test. Scoped
whitespace checks passed on all four implementation/test files. `pnpm test`
was attempted after this fix and again exited 71 BEFORE Node:
`sandbox-exec: sandbox_apply: Operation not permitted`. No assertions ran in the
agent channel and no unguarded fallback was used. Prior build remains applicable:
this fix changes only the test harness; no browser/build input changed.

The owner requested a local commit for rerun. The commit containing this section
includes the four prepared supply-email implementation/test files and this
handoff so imports and migration fixtures are available together. It does not
include unrelated dirty/untracked work or the mixed execution-runbook changes.
Earlier wording below describing these scoped files as uncommitted is historical.
No push, production wiring, real mail/provider calls, managed migration, secrets,
dependency/lockfile, worker, payment/booking or feature-gate changes.

Next owner action from this checkout, without loading environment files:

```sh
git rev-parse --short HEAD
pnpm run build:production && pnpm test
```

Supply the printed SHA, FIRST failing test with complete error/stack if any,
final summary and network-guard totals. Preserve dirty work. Behavioral
verification remains pending; prior owner-run 328/328 is only the onboarding
baseline. No need to switch chats while this verification is unfinished.

20 November 2026, Africa/Casablanca. Implementation prepared locally with explicit
owner approval of the five-point plan. **Behavioral verification is pending.**
Prior onboarding baseline remains owner-run 328/328, zero failed/cancelled/skipped/
todo; it does not verify these new changes.

## Owner-run verification update — 20 November 2026

Owner supplied a failed `pnpm test` tail: `ELIFECYCLE Test failed`, with
`SUPPLY_STALE_REVISION` from `supply_save_application` in
`tests/supply-mail.test.mjs:144` and `:166`. Tests reached disposable PostgreSQL;
this is distinct from the agent's earlier pre-execution sandbox failure.
The supplied excerpt omits the first failure, final totals and network-guard
totals. No new passing milestone or build result can be established from it.

Inspection shows these cases share an application and use fixed revision
numbers. An earlier case stopping before all its saves could cause later stale
revision errors; this is an inference, not a diagnosed root cause. Await the
earliest failing test name/error/stack and final summary from the same run before
changing behavior. No implementation, guard or test changes made in this review;
no repeat test run performed. Behavioral verification remains open with observed
owner-run failures. Production and all operational gates remain unchanged.

## Identities and preservation

Repository: `/Users/tareqnaser/Documents/ChatGPT/Marocora Site building/output/marocora-quote-workflow-local`.
Branch `main`, base/current HEAD `c7ae511`. This work is uncommitted. Read AGENTS.md
and HANDOFF-SUPPLY-ONBOARDING-VERIFIED-20261120.md for preceding verification and
paused operational work. Preserve all pre-existing dirty/untracked files, including
package/build/recovery/worker/runbook changes. No commit or push authorized.

## Implementation

- `supabase/migrations/202611200002_supply_mail_outbox.sql`: new single-transaction
  migration draft; unapplied to managed databases. Checks original RPC body hashes,
  ownership, security-definer/search-path settings, RPC grants and private table
  access/RLS prerequisites. Refuses missing/drifted prerequisites or repeat apply.
  Original supply migration and RPC bodies remain unchanged.
- Private RLS outbox with no direct client/service-role table access. Profile-table
  triggers capture initial saves and profile resubmissions; review-table trigger
  captures approved/rejected decisions. Records roll back with the original change.
  No historical backfill. Unique application/revision/kind prevents duplicate events.
- Credential uploads create no acknowledgement event. A credential-only revision
  advance preserves the earlier profile-submission receipt. A newer profile save
  supersedes older unsent receipts; any revision advance suppresses old unsent
  review decisions. Already accepted/uncertain messages cannot be recalled.
- Server-only claim/finish RPCs scope claims to a verified owner/current reviewer.
  Resolve the owner's verified address server-side; pin it on first attempt and
  cancel retries if it changes. Claims use row locks and per-attempt UUID tokens.
  Maximum three attempts; definitively unaccepted sends wait one minute then five
  minutes. Failed, uncertain and cancelled events are terminal in this preparation.
  Expired two-minute claims become uncertain; they never automatically retry.
- `server/vendor-mail.mjs`: supply renderer reuses existing HTML helpers and returns
  one applicant message. Fixed dashboard URL, generic copy, reference/revision only;
  no name/profile/feedback/credential/banking fields or admin copy. Unknown event
  kinds, invalid IDs/revisions and malformed recipients fail closed.
- `server/vendor-workflow.mjs`: additive `createSupplyMailDispatcher` export reuses
  the existing server mail module. Both RPC and mail adapters are mandatory injected
  dependencies, with no environment lookup, implicit fetch, provider adapter, HTTP
  route, scheduler, production wiring or worker activation. Batches cap at five.
  Exceptions/unknown send results become uncertain; safe retry is an explicit
  adapter assertion that no message was accepted. Idempotency key remains stable
  across attempts. Completion RPC reports the persisted terminal/retry state.
  `sent` means transport acceptance, not evidence of inbox delivery.
- `tests/supply-mail.test.mjs`: 19 test declarations (seven top-level including the
  database parent, twelve nested database cases). Unix-socket-only disposable
  PostgreSQL with TCP disabled; synthetic `@fixture.invalid` accounts and fake mail.
  Covers migration prerequisites/drift/grants/repeat/backfill, atomic rollback,
  duplicate submission, private access, claim fencing/concurrency, stale decisions,
  both outcomes, all profile types, credential-only revisions, safe projection,
  retry timing/exhaustion, uncertain/expired sends, changed addresses, revoked
  verification/admin access, invalid input, batch bounds and lost completion ack.

## Observed verification

- Agent `pnpm run build:production`: PASS during this task. Subsequent adjustments
  touched server-only code, SQL and tests; no browser build inputs changed.
- Agent `node --check` on both changed server modules and new test: PASS after final
  code adjustments. Scoped whitespace check: all four implementation/test files PASS.
- Agent `pnpm test`: **could not launch tests**. Existing guarded runner reports:

      sandbox-exec: sandbox_apply: Operation not permitted

  Exit 71, before Node test execution. No test counts or database migration execution
  resulted. This is the known agent execution-channel restriction, not a new test
  assertion failure. No unguarded fallback or guard change was attempted.
- Production migration, provider calls, real mail, credentials, production/PM2,
  demand-side/payment/booking flows, worker and feature-gate changes: NOT PERFORMED.
  No dependencies or lockfiles changed; no commit/push.

## Owner verification and next task

Run from the existing installed local checkout, without loading environment files:

```sh
cd '/Users/tareqnaser/Documents/ChatGPT/Marocora Site building/output/marocora-quote-workflow-local'
pnpm run build:production && pnpm test
```

The unchanged guarded runner automatically includes the new test file. Its database
case applies migrations only to its new disposable cluster, never to a managed DB.
Supply the final summary, shown network-guard totals, and any failing test output
without private data. Do not declare the new work verified until that evidence is
received. Do not repeat the old passed investigation or weaken guards.

Account usage checked at this stage: 9% of the weekly window used, ordinary usage
allowed. No usage-driven urgency to switch chats. Continue here for verification;
a fresh-chat handoff becomes useful after this stage is verified.

Starter prompt if a later handoff is needed:

Marocora — Supply Email Verification. Read AGENTS.md and
`docs/deployment/HANDOFF-SUPPLY-EMAIL-PREPARATION-20261120.md`. Base HEAD c7ae511;
notification work is uncommitted and unrelated dirty work must be preserved. New
outbox migration, supply renderer/dispatcher and 19 test declarations are prepared.
Build and final syntax/whitespace passed; agent guarded tests cannot launch due to
sandbox_apply exit 71. Evaluate owner-run build/test evidence first. Prior 328/328
is only the onboarding baseline. No real mail/providers, secrets, managed migration,
production/PM2, push, demand-side/payment/booking, workers or gate changes authorized.
