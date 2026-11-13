# Marocora — Quote Workflow Local Implementation

Local additive foundation based on production `cc95f5a063d907a43c137fa3a29032f78e452f1d`.
Branch: `codex/marocora-quote-workflow-local`. No frontend, deployed entry point,
existing intake, vendor module, key, applicant, fixture or public listing is changed.

The requested first stage is implemented: validation/state contracts and disconnected
synthetic fixtures. A private SQL structure is supplied for the next stage's review.
This is not a completed production workflow or a deployment package.

Run the new checks only, from this worktree:

```sh
node --test tests/quote-contracts.test.mjs
```

`server/quote/contracts.mjs` validates typed scopes, interpretation appointments,
certified receiving requirements, integer minor-unit totals (1 through
999999999999), the repository's existing currency snapshot, immutable offer
contents and canonical command hashes. It checks unified vendor approval,
application revision, approval event, provider identity, exact participation
acknowledgement, capability direction and permanent exclusions. Its imported
validation/currency files remain unchanged. Input uses resolved language names;
an unresolved Other selection is rejected. Budget permits zero and is separate
from the strictly positive offer total. No currency conversion occurs.

`tests/fixtures/quote-store.mjs` is a test-only reference model. Every identity
uses a synthetic UUID and `.invalid` email. It never reads environment variables,
loads credentials, authenticates, contacts a database or calls a transport.
The fixture's command switch is true solely to exercise transitions; the exported
runtime defaults and SQL switches are false. Existing Tanya identifiers are never
copied into fixtures or modified. Tests model her permanent application/account
exclusion, including an alternate application on the same excluded account.

The model uses one serialized queue and a cloned transaction state. Commands
commit state, result, event and suppressed delivery rows together. Replays check
current access first, then the actor and canonical payload hash, then revision.
It covers staff ownership, readiness proposal/acknowledgement/enable/closure,
provider invitation/response, customer scope revision with reconfirmation,
provider-only offer issue/withdrawal, customer decline/exact acceptance and
cancellation/closure. Acceptance cannot progress beyond
`accepted_pending_activation`; accepted evidence survives cancellation.
Read projections withhold staff notes and contact/intake identity from providers;
an invitation initially exposes only service/language direction. Reassignment
removes provider read and replay access. Draft policy approval exists only as
synthetic fixture data; no actual wording is approved by these tests.

`supabase/quote_workflow.draft.sql` proposes all seventeen `quote_*` tables,
foreign keys to `service_intakes` and `vendor_applications`, one-active indexes,
immutable history/offer guards, private privileges and disabled settings. It has
no capture trigger, backfill, command RPC, read RPC, direct grants or sender.
It ends with ROLLBACK deliberately. It has not been executed, parsed by PostgreSQL
or established as compatible with the full deployed schema. Do not remove the
rollback as a way of deploying it.

The JavaScript race checks demonstrate serialized reference-model behavior only.
They do not demonstrate PostgreSQL row locking, RLS, privilege isolation, process
crash durability, database-time expiry, restart recovery or real concurrent
vendor decisions. PostgreSQL tools were unavailable locally at this stage.
No browser/UI evidence is claimed; no new browser surface was added.

Next implementation stage:

1. Use a disposable local PostgreSQL fixture containing the full deployed schema
   and synthetic auth/staff/vendor/intake records. Resolve SQL compatibility and
   privilege/concurrency tests before treating the schema as a migration.
2. Implement controlled SQL commands and narrow reads. Lock request, readiness,
   vendor and relevant auth/staff records in a consistent order. Resolve exclusions
   from existing learning/translation registers, vendor fixture accounts and the
   new quote registry, failing closed if required context is unavailable. Match
   active approval-event provenance to the current vendor revision. Repeat typed
   scope/currency validation in SQL; a three-letter currency constraint alone is
   insufficient. Never grant table access in place of command authorization.
3. Add sticky classification, capture for new verified intakes only, receipt
   recovery, pagination, reporting, questions/answers/concerns and rate limits.
   No automatic historical enrollment. The existing Formspree receipt remains the
   only initial email. Do not integrate the current typed scope contract directly
   into legacy form fields without an explicit validated mapping.
4. Add the separate Edge/client/workspace paths and four-language copy, then fake
   mail/outbox claim, frozen-recipient and uncertainty behavior. The fixture
   suppresses every delivery; it does not implement a dispatcher or template.
5. Prepare a separately reviewed deployment package only after local full-schema,
   access, recovery, browser and delivery checks. Preserve completed vendor/recovery
   evidence; do not repeat live tests to fill local verification gaps.

Activation decisions remain in the November 12 design: exact policies, inbox owner
and coverage, cancellation/complaint process, real provider readiness, public test
listing treatment, retention and commercial hosting. Uploads, payments, booking
and work-start remain absent. Vendor Resend, Chrome operations, Formspree Business
and the already scheduled November 19/26 reviews remain untouched.
