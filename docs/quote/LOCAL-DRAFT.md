# Marocora — Quote Workflow Private SQL Implementation

The private SQL implementation is verified in a disposable native PostgreSQL 17
cluster. All capture, command and notification switches remain false. Production,
existing source workflows, real applicants and credentials remain untouched.
This is a local review draft, not a migration or deployed quote workspace.

Worktree: `output/marocora-quote-workflow-local`.
Branch: `codex/marocora-quote-workflow-local`.
Production baseline: `cc95f5a063d907a43c137fa3a29032f78e452f1d`.
The previous contracts/fixtures commit is `d2ae915`.

## Implemented SQL

`supabase/quote_workflow.draft.sql` defines seventeen private tables with restricted
foreign keys, RLS, no direct application-role privileges, partial unique indexes
for active assignments/current offers/accepted offers, immutable history and
immutable offer content. Creation commands use expected revision zero; subsequent
commands require the exact current revision.

`supabase/quote_commands.draft.sql` implements the owner-only transaction core,
strict SQL validation, current eligibility, command replay, suppressed outbox,
public disabled wrapper, participant projections and private summaries.

The command core covers:

- Explicit receipt enrollment, staff ownership and ownership transfer.
- New readiness versions, exact provider participation acknowledgement,
  staff enable/closure and auditable replacement of the old enabled version.
- Provider invitation, acceptance/decline to assess, revocation and scope
  reconfirmation. An unavailable provider returns a revised request to staff.
- Provider-authored immutable offers, supersession, withdrawal, customer decline
  and exact acceptance into `accepted_pending_activation`.
- Customer/staff cancellation, staff unfulfilled closure, information threads,
  participant answers and private concerns, including a past provider's concern
  after read access has been revoked.

Acceptance never activates a service. The final acceptance expiry check uses
`clock_timestamp()` after eligibility locks. Accepted offers and exact acceptance
records survive cancellation. Reads derive `eligibilityHold` after later provider
approval/readiness/identity loss. Staff audit preserves cancellation reasons and
recorded customer communication; participant projections withhold staff audit.

Approval comes only from `vendor_applications`, with the current revision and latest
approval-event provenance. Eligibility also requires a verified matching account,
exact readiness acknowledgement/participation policy, service/direction/currency
capabilities and no self-assignment. It consults `vendor_test_fixtures` at both
application and account level, learning exclusions, the quote registry and the
legacy `translation_exclusions` register when installed. A malformed installed
legacy register raises an error instead of silently allowing eligibility.

The existing currency snapshot is repeated in an immutable SQL helper; totals
are integer minor units, 1 through 999999999999, with declared currency precision.
Optional budgets allow zero. Typed scope, interpretation and certified receiving
requirements are validated again in SQL. Caller-selected actors, recipients,
production/test overrides, uploads, payment and work-start commands are rejected.

## Receipt boundary and switches

Enrollment is explicit, staff-authorized and classification-dependent. It reads
`service_intakes.fields.quote_scope_v1`, a **future server-canonicalized typed
scope**, rather than accepting staff-authored scope or impersonating the customer.
The current intake endpoint does not yet create this field. The local fixture
seeds it as synthetic customer-authored receipt data. Legacy form-field mapping,
canonical receipt enrichment and automatic capture are the next integration work;
this draft does not enroll existing production intakes or backfill anything.
Enrollment records the existing receipt and creates no second receipt email.

The public `quote_command` wrapper refuses mutations while the command switch is
false. All helper functions and the core are revoked from PUBLIC, anonymous,
authenticated and service roles. Only the narrow public wrapper/read functions
are granted to authenticated accounts. Existing Auth claims are the actor source;
no command payload supplies an actor or a role.

Both SQL drafts retain BEGIN/ROLLBACK wrappers and are absent from deployment
scripts. The fixture runner composes their contents in its own disposable
transaction; it does not edit or apply either file to production. A separate
`quote_fixture` schema, loaded only from the tests directory, allows synthetic
actors to exercise the exact core while **every switch stays false**. There is
no bypass argument or test exception in the application API.

Every generated delivery is suppressed, with the quote-specific idempotency key.
There is no sender, pending backlog, Resend import, configuration lookup or mail
adapter. Readiness policies are approved only as synthetic fixture data. No actual
policy wording or applicant readiness decision has been approved by these tests.

## Verification

Run the SQL suite with native PostgreSQL tools installed:

```sh
node tests/quote-sql/run.mjs
```

The default binary directory is `/opt/homebrew/opt/postgresql@17/bin`.
Set `QUOTE_PG_BIN` to another trusted PostgreSQL binary directory if needed.
The runner accepts no database URL, creates its own data/socket directories,
removes inherited PG connection variables, disables TCP, uses private Unix-socket
permissions and destroys the cluster in `finally`. It registers no system service.
PostgreSQL shared memory may require running outside the executor sandbox.

The runner loads all ten applicable baseline SQL files unchanged: learning drafts,
staff review, launch, email verification, service intake, vendor workflow, permanent
fixtures, intake notifications, delivery and reply status. It never executes the
baseline live-test SQL files or repeats completed vendor/recovery walkthroughs.
Supabase Auth is represented by a minimal local `auth.users`/claim compatibility
surface and NOLOGIN application roles. The older operational exclusion register
is represented by its table contract only; the old marketplace is not imported.
All users/apps are synthetic. The permanent-fixture test necessarily retains the
baseline table's fixed delivery-email constraint value; it is never a destination
used by a sender and no real fixture IDs are copied.

The generated `sql-evidence-2026-11-13.json` records the exact engine version,
baseline files, source hashes and passing scenarios. Checks cover role privileges,
RLS, shared validation/hash examples, malformed commands, stale readiness,
permanent exclusions/alternate applications, projections, immutable evidence,
replay conflicts, transactional rollback, sticky classification and summaries.
Independent PostgreSQL sessions exercise acceptance, cancellation, offer issue,
scope changes and vendor-row changes under actual locks. Test contenders wait for
an observed database advisory lock, rather than assuming a scheduling delay.
An immediate local server restart proves committed command/result persistence and
no extra replay event/mail. Expiry is also tested after waiting on a database lock.

The previous 37 pure JavaScript tests remain in `tests/quote-contracts.test.mjs`.
They were unchanged and not rerun as substitute database evidence. The earlier
`local-evidence-2026-11-13.json` is the historical first-stage checkpoint, superseded
for SQL runtime status by the new evidence.

## Limits and next stage

The pilot implementation deliberately serializes quote commands with one advisory
transaction mutex, then takes request/readiness/vendor/auth/policy row locks. It
is suitable for evaluating the small pilot, not a throughput benchmark. Legacy
vendor-row writes still serialize on their real vendor row. Concurrent insertion
into independent exclusion registers is not a tested serializability guarantee;
reads derive holds and commands recheck current exclusions.

Auth is emulated at the database claim boundary: real JWT verification, Edge
origin/body handling, HTTP errors and rate enforcement at the perimeter are not
covered. There is no frontend, callback/reload browser integration, four-language
presentation, Formspree change, capture trigger, dispatcher, delivery receipt or
real policy approval. Detail history is currently returned as one authorized
aggregate; before broader use, add paginated history/threads and a staff readiness
picker alongside the already bounded queue/list reads. No standalone privilege
or full managed-project deployment compatibility claim follows from these local
checks.

Next implement the additive canonical intake mapping, disabled capture hook and
Edge/client boundary with disposable fixtures; then customer/provider/staff views
and four-language browser checks. Handle mail dispatch separately with a fake
transport first. Do not remove draft rollback guards or enable anything merely
to exercise the UI. Production activation remains a separate decision covering
exact terms, inbox owner/absence cover, complaint/cancellation process, real
provider readiness, retention, public Tanya presentation and hosting suitability.

Vendor Resend modules/keys, Tanya's permanent fixture/exclusions, existing Chrome
operations, Formspree Business and November 19/26 scheduled reviews remain
unchanged. Uploads, payments, booking and work-start remain absent.
