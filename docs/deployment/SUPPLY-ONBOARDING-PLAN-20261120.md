# Marocora — Supply-Side Onboarding

20 November 2026. Local implementation only. No migration is applied to production.
The owner shifted priority from the unfinished LiveKit package to supply intake.
Demand-side work and all payment/booking/video gates remain frozen.

## Proposed additive schema

- `supply_applications`: one application per authenticated owner and vendor type;
  UUID reference, revision, pending_review/approved/rejected status, reviewed
  revision and timestamps. Creation always starts pending_review. Profile edits
  increment the revision and remove approval until an administrator reviews again.
- `supply_teacher_profiles`: validated profile with bio, languages, hourly rate
  in integer minor units/currency, timezone, weekly availability and intro URL.
- `supply_translation_profiles`: individual/agency identity, language pairs,
  Legal/Medical/Technical/Sworn specialties and bio.
- `supply_transport_profiles`: company bio, sedan/van/bus types, capacity,
  service regions and integer base rate/currency.
- `supply_credentials`: private scanned file descriptors attached to translation
  applications. Download requires ownership or current administrator membership.
  Sworn approval requires a clean credential and explicit administrator review.
- `supply_reviews`: immutable decision history tied to the exact profile revision;
  staff membership is locked for decisions, self-review is refused.
- `supply_payouts`: pending connection only; AES-256-GCM encrypted banking envelope,
  nonce/tag, last four IBAN characters. No raw banking data in database/UI output.
  Server key comes from separately owner-injected configuration. Without that key,
  profile onboarding still works and bank submission fails closed. No provider call.

All new private tables use RLS and deny direct anon/authenticated access. Narrow
security-definer RPCs enforce ownership, verified email and administrator status.
Existing learning_review_staff/exclusions provide current admin/QA controls; no
staff membership is granted. Existing schemas, workflow tables, pinned functions,
authentication rules and payment eligibility are not replaced. New approval does
not enable a translation account, teaching publication, booking or worker.

Public output is a bounded whitelist of approved, consented, currently verified,
non-excluded profiles at the reviewed revision. It contains no email, auth UUID,
credential descriptor, payout value or internal review notes. No student/request/
checkout/demand-side interface is part of this change.

The additive migration has a missing-prerequisite and existing-object guard.
It must be verified on disposable PostgreSQL before any later production review.
No ad-hoc execution against Supabase is authorized.

## Implemented local entry points

| Page | Access / purpose |
| --- | --- |
| `/supply-register.html` | Public account registration; verified email required before applying |
| `/supply-dashboard.html` | Authenticated owner; three profile forms, status, private credentials, optional bank details, zero earnings |
| `/supply-review.html` | Verified current learning_review_staff administrator only, checked at HTTP and RPC boundaries |
| `/supply-profile.html?id=…` | Read-only approved public profile; unavailable for unapproved/withdrawn-consent/excluded accounts |

The professional network page links to registration. Existing sign-in accepts
supply dashboard/admin destinations while preserving its prior destination list.
No new demand-side form, request, booking, checkout or directory interface was added.

Backend: server/supply/http.mjs and payout.mjs; existing production HTTP and
Supabase adapters dispatch narrow supply RPCs. Signup uses the existing Supabase
Auth adapter and returns a generic confirmation response. The future project's
approved email redirect allowlist must include the supply sign-in return route;
no provider settings or real signup request were used here.

The migration is additive and deliberately refuses any pre-existing supply_*
relation/routine. It does not copy/import legacy vendor applications. The old
teacher/vendor intake workflows remain intact; new supply approval is independent
of their publication and commercial eligibility. Any future consolidation requires
a separate reviewed data-migration plan, not an automatic import.

## Banking and file handling

`SUPPLY_PAYOUT_ENCRYPTION_KEY` is a new server-only configuration contract: a
canonical base64-encoded 32-byte AES key, separately owner-injected in a future
authorized environment. No key was generated for production, requested, read or
written to an environment file. Only explicit synthetic keys exist in tests.
The endpoint never returns plaintext or ciphertext: only pending/configured and
last-four metadata. Ciphertext authenticates the application/owner via associated
data. There is no decrypt, connect, pay, checkout, webhook or earnings-write route.
Encryption at rest does not authenticate banking ownership; no such claim is made.
Key custody, rotation and retention need an owner decision before collecting real
bank data. Payouts can be omitted without blocking profile submission or review.

Credential intake accepts PDF/JPEG/PNG, maximum 5 MiB and five attachments per
translation application. It verifies ownership, validates content signatures and
requires a clean result through the existing byte scanner before private storage.
Production scanning restrictions are unchanged. There is no scanner bypass or
public object URL. Download rechecks ownership/current staff access, streams an
attachment and inherits no-store/nosniff headers. Uploading another credential
increments the revision and removes public approval. Ambiguous storage/RPC writes
retain private objects for future authorized reconciliation; no destructive
cleanup/job is enabled by this work.

## Verification and limits — 20 November

- Agent-observed production build: PASS, exit 0 after final UI/navigation edits.
- Syntax: all 12 changed/new onboarding JavaScript files PASS.
- Scoped tracked diff whitespace: PASS. Four HTML pages have unique IDs and all
  explicit label targets resolve (static HTML inspection).
- New supply tests authored: four top-level cases plus eleven nested database
  checks (15 test declarations). Cover encryption/associated data, all three
  models, pending/public gating, admin review and rejection, revisions, ownership,
  sworn credentials, bank privacy, verified email/consent/exclusions, direct-table
  denial, staff revocation, HTTP guards/scanning and mocked Auth signup.
- Behavioral tests executed here: ZERO. The guarded supply invocation failed
  before Node with `sandbox-exec: sandbox_apply: Operation not permitted`, exit 71.
  The earlier release-package invocation and escalated retry failed identically.
  No unguarded fallback, PostgreSQL proof or browser QA was performed.
- Prior 298/298 is owner-run evidence for the earlier state, not for these changes.
  Existing tests/assertions were not edited for this task. Build does not prove
  SQL application, authorization behavior or regression safety.

Owner-run verification from the repository: `pnpm run build:production && pnpm test`.
Keep the macOS sandbox, both JavaScript guards and package-manager check intact.
The normal runner includes the new supply tests and preserved paused LiveKit
package tests. Share failures and final counts; do not run any migration against
a managed database as a substitute. No new dependency or lockfile change occurred.

## Owner-run failure and local fix — current status

The owner supplied an actual failing result for the supply HTTP test:
`AssertionError [ERR_ASSERTION]: 403 !== 302` at the first dashboard redirect
assertion (previously line 116). The same message contained an unfilled results
placeholder and a generic statement that all tests passed. The concrete failure
is the current evidence; there are no final suite counts or subsequent passing
results. Status: NOT VERIFIED / RERUN REQUIRED. Do not mark PASSED.

The fixture used fetch against a loopback URL while setting a synthetic Host.
The failure is consistent with Host replacement by that fetch implementation,
which would hit HOST_DENIED before authentication. The fix replaces only the
fixture transport with node:http.request, matching the existing production tests,
and adds an explicit foreign-Host assertion expecting 403 HOST_DENIED. Existing
302/401/403 expectations, application code and all guards remain unchanged.
This diagnosis is source-based; a passing runtime rerun has not been observed.

The post-fix file passed syntax checking. The guarded focused rerun again failed
before Node: `sandbox-exec: sandbox_apply: Operation not permitted`, exit 71.
No new behavioral assertions ran in the agent channel. The earlier production
build remains applicable because only the test fixture and records changed.
Owner has been asked to rerun `pnpm test` and supply exact totals/failures.

The owner now explicitly authorized a scoped LOCAL supply milestone commit;
no push. That commit is an implementation snapshot with verification pending,
not a passed release. It excludes unrelated recovery/package/worker changes and
the mixed historical runbook edits. No deployment or migration was performed.

Recommended next implementation after the full guarded suite passes: supply
application acknowledgement and review-decision email notifications using a
transactional outbox, bounded retries and synthetic delivery tests. Prepare locally
first; provider activation remains separately authorized. Public directory UI can
follow vetted inventory and publication consent. Demand-side and payments stay
paused. No notification or directory work was started in this verification fix.

## SQL name collision fixed — latest verification status

Owner reported PostgreSQL ambiguity in supply_valid_profile(text,jsonb):
`It could refer to either a PL/pgSQL variable or a table column`, in the
vehicleTypes membership query. The declared JSON loop variable x collided with
the set-returning query's x column alias; the specialties query had the same
collision. Both branches are now explicit: profile_item is the loop variable,
vehicles.value and specialties.value are qualified query columns. The shared
string-array helper also uses qualified elements.value references. No conflict
setting, validation rule, grant, RLS policy or migration guard was weakened.

Added one disposable-PostgreSQL regression check exercising valid teacher,
translator and transport profiles, plus invalid schedules/specialties/vehicles.
Current authored supply declarations: 16 (four top-level plus twelve nested).
Test-file syntax and scoped whitespace checks PASS. Guarded focused launch still
fails BEFORE Node with `sandbox-exec: sandbox_apply: Operation not permitted`,
exit 71. No runtime pass or exact full-suite totals have been observed. This
supersedes the earlier assumption that only the HTTP fixture needed correction.
Status remains NOT VERIFIED / OWNER GUARDED RERUN REQUIRED: `pnpm test`.

The migration is still an unapplied local draft, so the correction is made in its
original source; tests provision a fresh disposable cluster. Do not run it against
production or bypass its existing-object guard. The scoped follow-up local commit
contains this fix, regression check and records only; no push or production action.

## PostgreSQL boolean serialization fixed — latest status

Owner supplied `SyntaxError: Unexpected end of JSON input` in value()/rpc(),
when checking supply_admin_access() after staff revocation. The test helper
selected RPC results directly: psql emits booleans as t/f, which are not JSON.
It now selects to_jsonb(public.RPC(...)); direct profile-validator checks also
serialize their boolean outputs. No blank-output fallback, false substitution,
production access-rule change or exception suppression was added.

Added a regression checking actual admin true/non-admin false RPC values plus
both boolean literals. Current supply test declarations: 17 (four top-level,
thirteen nested). Syntax and scoped whitespace checks PASS. The guarded focused
launch still failed BEFORE Node with sandbox_apply exit 71; no new behavioral
assertions ran here. Status remains NOT VERIFIED. Owner must rerun pnpm test and
provide exact final counts and any failures. Build inputs were unchanged, so
no build rerun was needed. Follow-up commit is local only; no push or production
action. Earlier failure reports remain historical evidence, not passing results.
