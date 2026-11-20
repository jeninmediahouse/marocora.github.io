# Marocora — Supply Onboarding Verification

20 November 2026, Africa/Casablanca. Active priority: supply-side foundation.
Owner explicitly shifted focus away from the unfinished LiveKit local package.
Implementation is local. The owner has now authorized a scoped local supply
commit; the commit containing this update is an implementation snapshot with
verification pending. No push or production/migration/credential/provider/
payment/worker action occurred. Unrelated work remains uncommitted.

## Read first

1. AGENTS.md and this handoff.
2. SUPPLY-ONBOARDING-PLAN-20261120.md (schema, routes, privacy, exact verification).
3. HANDOFF-LIVEKIT-PACKAGE-PAUSED-20261120.md for preserved unfinished drafts.
4. EXECUTION-RUNBOOK-20261119.md: newest status notes precede historical commands.

Repo: /Users/tareqnaser/Documents/ChatGPT/Marocora Site building/output/marocora-quote-workflow-local.
Branch main; recorded base HEAD 346be721e626a6dfab425985213490dc7e3d6d3e.
Preserve all pre-existing modified/untracked files. The latest owner directive additionally authorizes a scoped local supply
milestone commit, but no push. Scope: new supply files and their production/login/
professional-page integration plus this handoff/plan. Exclude unrelated LiveKit,
worker, package-manager and mixed historical runbook changes.

## Implemented

- New guarded single-transaction migration:
  supabase/migrations/202611200001_supply_onboarding.sql.
  Seven private RLS tables: application, three typed profiles, credentials,
  immutable reviews, encrypted pending payouts. Narrow verified-owner/admin RPCs;
  strict profile validation; public projection omits private/consent data.
- server/supply/http.mjs: owner/review/public routes, clean-scan-only private
  uploads and protected downloads; authenticated banking endpoint.
- server/supply/payout.mjs: AES-256-GCM, random nonce, owner/application associated
  data, checksum/format checks and last-four output. No real key read/generated.
- Existing server/production/{http,site,supabase}.mjs integration; adminPages
  protected separately so existing private-page assertions retain their semantics.
- supply-{register,dashboard,review,profile}.html and corresponding browser JS;
  supply-client.mjs and supply.css. Responsive forms, weekly teacher availability,
  status/edit/review/credential/payout panels, zero earnings, consented public page.
- production-login.mjs adds supply destinations; professionals.html adds supply
  registration link. Existing demand pages/flows and eligibility remain intact.
- tests/supply-onboarding.test.mjs: 15 authored declarations including isolated
  PostgreSQL schema/review checks and synthetic HTTP/auth/scan/encryption cases.

New approval does not populate teaching publications, translation allowlists,
bookings, memberships, payments or jobs. Existing teacher/vendor intake is not
replaced or imported. Future consolidation is a separate decision.

## Latest owner-run failure and fixture fix

Owner pasted a concrete failure: supply HTTP test at the first dashboard redirect
assertion, `403 !== 302`. The same message also included an unfilled terminal
placeholder and generic “all tests passed” wording. Those do not establish a pass.
No suite totals or later successful run were supplied. NOT VERIFIED / RERUN REQUIRED.

Source-based diagnosis: fetch may replace the explicit synthetic Host with the
loopback authority, hitting HOST_DENIED before the intended authentication test.
The test now uses node:http.request, matching production.test.mjs, preserving all
original expectations and adding a foreign-Host 403 HOST_DENIED assertion.
Production behavior/guards were not changed in this fix. Syntax passed. The
post-fix guarded focused launch again failed BEFORE Node with sandbox_apply exit
71; no post-fix assertions ran here. Owner has been asked for `pnpm test` results.
The full-suite and PostgreSQL proof remain pending. The prior build still applies
because this fix changed only the test fixture and documentation.

## Earlier verification observed (before owner failure report)

- Production build PASS (exit 0), after final UI/navigation edits.
- Syntax PASS for all 12 onboarding JS files; scoped diff whitespace PASS.
- Four HTML pages: unique IDs and valid explicit label targets (static check).
- New behavioral tests: ZERO executed. Guarded supply test launch failed BEFORE
  Node: `sandbox-exec: sandbox_apply: Operation not permitted`, exit 71.
- Earlier new LiveKit package test launch and escalated retry had the same error.
  Guards were never weakened; no alternate unguarded execution occurred.
- Prior owner-run 298/298 belongs to the preceding recovery state only. Do not
  claim the current suite passes until the owner supplies current results.
- No PostgreSQL migration proof or browser QA yet. The migration remains a review
  draft; a successful build does not validate SQL/runtime behavior.
- Usage checked at this stage: 9% of the reported weekly window used, ordinary
  usage allowed. No forced chat switch is needed while verification is unfinished.

## Outstanding work

The owner has been asked to run, in the repository:

    pnpm run build:production && pnpm test

Await POST-FIX results and exact summary; retain the supplied failed run in history. The standard runner includes both new
supply tests and paused package tests. Fix observed failures, rebuild only for
changed build inputs, and rerun necessary guarded checks. Never bypass OS or JS
network guards, package-manager pinning or denied environment-file access.

Before any real collection/rollout: owner review of migration and restore path,
confirmed disposable-PostgreSQL proof/CI, approved auth redirect configuration,
current admin membership, private storage/scanning and owner-managed payout-key
custody/retention. These are future gates, not authorized production steps.

## Starter prompt

Marocora — Supply Onboarding Verification. Read AGENTS.md, this handoff and
SUPPLY-ONBOARDING-PLAN-20261120.md. Review owner output for the guarded full suite.
Build and static checks passed. The owner-run HTTP test failed with 403 versus
302; the explicit-Host fixture fix awaits a guarded rerun. The agent channel still
fails before Node due sandbox_apply exit 71. Do not mark the milestone PASSED. Do not repeat old media/worker investigations
or treat prior 298 passes as current. Fix new onboarding test failures locally,
preserve unfinished LiveKit drafts and all unrelated work. No demand-side work,
payments, production access, secrets, migration application or push. A scoped
local supply snapshot commit was explicitly authorized and contains this handoff;
resolve its identity with git log rather than assuming all working-tree work is
committed. Next recommended implementation after tests pass: local transactional
email outbox/notification tests; public directory follows vetted supply.
