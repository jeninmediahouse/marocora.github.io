# Marocora — Production-readiness audit

Recorded: **14 November 2026**. Scope: documentation and static source inspection
of this checkout only. **The regular-translation application is not ready for
public customer commitments or payments.** Block 1.6 completed its authorized
local implementation and owner real-scan check; that is a different gate from
production readiness.

**Keep out:** production deployment, email transport, payments, customer
activation, Block 2 (sworn translation) and Block 3 (interpretation) remain
**strictly unauthorized**. Every unchecked item below describes a future gap,
not permission to implement, configure, test, connect or enable anything. This
audit changes no business policy or pricing and selects no infrastructure vendor.

## Evidence and limits

- Source reviewed: `server/block1/`, `server/quote/contracts.mjs`, `docs/quote/`
  and the relevant quote, intake, provider and learning SQL under `supabase/`.
  Existing service-intake/vendor adapters, static build and public form routing
  were inspected to distinguish existing capabilities from missing quote wiring.
- Historical evidence: Block 1.6 recorded 152 passing local/mock tests; the
  owner reported a real synthetic-PDF scan, corroborated at the previous
  closeout by `Cloudmersive / clean / API_CLEAN` at
  `2026-11-13T21:19:03.456308+00:00`. The owner reported authorized download,
  quote issuance and acceptance **available**, not that each was executed.
  No tests, scan requests or provider-account checks were run in this audit.
- Last recorded quote controls: capture OFF, commands OFF, notifications OFF;
  PostgreSQL stopped; 13 pending notification rows and zero transported rows
  at the Block 1.6 closeout. Those are historical SQL observations, not fresh
  database queries. This audit does not connect to a database or attest remote
  production state. The local `postmaster.pid` was absent at inspection.
- Local implementation has real safeguards: validated bounded uploads, private
  disk permissions, clean-only document access/quote/acceptance, immutable scan
  and agreement evidence, current provider checks, revisions and idempotency,
  CSRF/origin/Host checks, restricted SQL privileges and default OFF switches.
  Preserve those controls when resolving gaps; do not replace them with a
  synthetic “clean” result, manual release or caller-supplied identity.
- `LOCAL-DRAFT.md`, `BLOCK1-LOCAL.md`, `BLOCK15-LOCAL.md` and their JSON evidence
  describe earlier stages. Their “no uploads”, TXT-only, ClamAV or switches-ON
  statements are historical. `BLOCK16-CLOUDMERSIVE.md` and its owner closeout
  establish the current scanner/local completion status. None is launch approval.

## Authentication and authorization — before public account access

Current evidence: `server/block1/http.mjs` creates synthetic actor tickets and
in-memory eight-hour sessions; `database.mjs` seeds synthetic users and sets
local SQL claims. `server/quote/contracts.mjs` is a pure validation module, not
an authentication gateway. The local cookie is configured for loopback HTTP,
not an established production HTTPS session arrangement.

- [ ] Replace synthetic ticket issuance/login with an authorized managed
  Supabase Auth/JWT boundary. Validate tokens through a trusted mechanism;
  derive actor identity from verified claims, never command JSON or client roles.
- [ ] Establish real customer/provider/staff onboarding, verified-email handling,
  account recovery, sign-out, token expiry/refresh and revocation behavior.
  Configure actual permitted callback URLs only under a future directive.
- [ ] Resolve how validated identities reach SQL without the local database-owner
  claim shim. Preserve restricted helper/core execution and minimal grants;
  do not expose `quote_command_core` or scan-recording privileges as public APIs.
- [ ] Establish actual staff memberships, request ownership and approved provider
  readiness/participation evidence. `/api/options` currently supplies a fixed
  synthetic translator; seed approvals and synthetic policies are not production
  approvals. Keep Tanya and all test identities excluded from customer surfaces.
- [ ] Verify customer, invited provider, accepted assigned provider, staff owner,
  unrelated staff, revoked provider and unrelated account projections against
  the managed boundary. Preserve redacted invitations, owner-only customer
  contact details and current eligibility checks on document downloads/replay.
- [ ] Establish production session/cookie and CSRF behavior over HTTPS, including
  secure-cookie settings, expiry, rotation and multi-instance behavior. Local
  session/ticket maps disappear on restart and are not a durable shared session
  system. Remove synthetic session-link logging from any future live route.
- [ ] Specify privileged-account protections and operational access review;
  validate them separately from ordinary customer authorization.

## Database and schema — before real records are accepted

Current evidence: `database.mjs` creates a native PostgreSQL cluster, invokes
local binaries synchronously and strips inherited connection variables. It
accepts no production connection configuration. Both quote draft SQL files end
in `ROLLBACK`. `local.sql` and `block15.sql` require the local database/user;
they patch installed function text and are expressly not production migrations.

- [ ] Produce a separately authorized, reviewed managed-database migration plan,
  including prerequisites, version tracking, controlled application, verification
  and recovery. Do not remove rollback/local-target guards to deploy these files.
- [ ] Reconcile the base draft with the local overlays: base offers are provider
  authored; the local overlay makes staff the issuer and freezes document
  evidence. Production schema/functions must preserve the intended final
  behavior explicitly rather than depend on runtime string replacement.
- [ ] Preserve RLS, direct-table revocations, `SECURITY DEFINER` search paths,
  actor derivation, exact acceptance digests, immutable history and current-access
  checks before command replay. Review actual managed owners/grants/extensions
  and service-role privileges; local emulated Auth is insufficient evidence.
- [ ] Replace local owner-shell SQL execution with an authorized production
  connection/RPC boundary, connection limits and transaction handling. Ensure
  neither a database-owner credential nor a service credential reaches browsers.
- [ ] Resolve canonical intake enrollment: the existing public intake handler
  stores validated form fields but does not create the typed `quote_scope_v1`
  required by quote enrollment. The local capture path creates synthetic typed
  receipts, classifications and ownership itself. Define and validate one
  production receipt-to-quote path without duplicate receipts or backfill.
- [ ] Keep test classifications/fixtures permanently separated from real records;
  synthetic local accounts, policies, files and approvals must not become live
  customer data merely by copying this cluster.
- [ ] Assess the global advisory mutex and lock order against expected load.
  Resolve the documented concurrent independent-exclusion-insert limitation;
  current rechecks do not establish serializability for every exclusion writer.
- [ ] Establish schema drift checks, bounded queries and history/thread pagination.
  Draft list RPCs have cursor pagination, but the local workspace uses a bounded
  100-row list and aggregate detail; that is not a complete large-history UI.

## Hosting, infrastructure and private document storage

Current evidence: the Node application binds `127.0.0.1`; the build script and
Pages workflow publish static assets. Local API/UI assets and private disk state
are not included in that public artifact. Static hosting can serve a frontend
that calls a separate backend, but cannot execute this Node/SQL upload workflow.

- [ ] Authorize an HTTPS backend/runtime and managed database configuration for
  one stateful regular-translation flow, alongside the existing static site as
  appropriate. Confirm host/service terms and actual deployment suitability
  before a later launch; this audit makes no current hosting-contract claim.
- [ ] Define domain routing, TLS, backend identity, environment separation and
  safe deployment/rollback controls. The current Pages artifact is not a
  deployable quote backend, even if the public form is already visible.
- [ ] Provision private durable document storage suitable for the chosen runtime.
  Local 0700 directories/0600 files are useful access controls, not an established
  production encryption, replication, backup or multi-instance storage strategy.
- [ ] Preserve UUID storage names, hash-bound scan status, exact quote document
  lists and current owner/assigned-provider authorization for every download.
  Prevent public buckets, cache leakage, exposed filesystem paths or access that
  survives revocation. Assess expiring URL semantics if a future design uses them.
- [ ] Preserve attachment disposition, canonical MIME and nosniff behavior. The
  customer currently uploads but cannot download document bytes through this
  flow; retain that boundary unless a separate directive changes it.
- [ ] Coordinate database and file durability. Address interrupted writes,
  orphaned files/metadata, disk exhaustion and the interval between registration,
  scanner response and scan-event commit. Fail closed if no clean evidence exists.
- [ ] Align upload limits across frontend, proxy, runtime, storage and database:
  application **10,000,000 bytes per file**, five files per request; one selected
  file per form submit. Paid scanner entitlement does not increase these limits.
- [ ] Establish graceful shutdown, request deadlines, health/readiness checks and
  restart behavior without exposing synthetic tickets or changing gates
  unexpectedly. Local signal handlers are not a production supervisor/runbook.

## Communications — queue records are not delivered messages

Current evidence: `quote_deliveries` is a notification outbox, not a translated
document-delivery or provider-earnings ledger. Draft notifications are suppressed;
the local overlay creates pending frozen rows with no sender. A Resend adapter
exists for the separate vendor workflow, and service intake uses Formspree;
neither is a quote notification dispatcher.

- [ ] Under separate authorization, connect an actual quote email transport
  (Resend is an existing example, not a selection made here), with verified
  sender/domain, protected credentials and configured production URLs.
- [ ] Define queue claiming, idempotency, recovery, ambiguous-provider outcomes,
  bounded retries and operator-visible failures. Prevent duplicate dispatches
  and distinguish provider acceptance, actual delivery, bounce and complaint.
- [ ] Provide approved quote/invitation/response templates and authenticated
  deep links. Do not embed document bytes, unrestricted downloads, synthetic
  tickets or private concerns in messages. Preserve recipient derivation from
  authoritative records and current permissions on opening a link.
- [ ] Establish email-provider event handling and operational evidence, where
  used, without treating a queued row as an email or a delivered email as quote
  acceptance. Avoid duplicate notifications with existing intake/vendor flows.
- [ ] Exclude synthetic/old local backlog from future dispatch. No blanket replay
  of the 13 historically pending local rows is authorized by this audit.
- [ ] Keep queue creation and transport enablement as explicit separate controls.
  No quote transport is configured, started or enabled in Block 1.7.

## Payments, commercial commitments and fulfilment

Current evidence: acceptance records an immutable agreement in
`accepted_pending_activation`. The UI explicitly says no work is scheduled and
no payment is due. There is no payment gateway, paid state, work-start/completion
command, final translated-document delivery flow or provider settlement ledger
in the local regular-translation implementation.

- [ ] Separate any future public inquiry launch, commercial quote commitments
  and payment-capable launch into explicit approved gates. A public information
  or inquiry page is not proof that real orders or charges are supported.
- [ ] Obtain approved commercial acceptance wording and activation conditions;
  represent the authorized operational state honestly. Recording acceptance
  must not silently imply payment, work started, guaranteed availability or
  completed service. This checklist chooses none of those business rules.
- [ ] Before accepting funds, authorize and integrate the selected merchant
  service, including account/credential setup, authoritative amount/currency,
  payment-to-quote binding, authenticated callbacks, event idempotency,
  reconciliation and customer-visible receipt/status recovery.
- [ ] Distinguish an acceptance event, a deposit/full charge if authorized,
  provider settlement and notification delivery. Never use a browser return URL
  alone as payment confirmation. No merchant or payment timing is selected here.
- [ ] Establish approved cancellation, refund, dispute and chargeback handling
  with versioned evidence and corresponding operational controls before making
  those promises. No policy, amount, fee, tax treatment or pricing is proposed.
- [ ] Define the authorized regular-translation fulfilment boundary, including
  real provider assignment/availability, work authorization, progress, final
  delivery, revisions and completion evidence before selling completed work.
  Their absence cannot be solved by renaming acceptance “completed”.
- [ ] Before promising automatic provider payment, establish the required
  earnings/payout/reconciliation capability under a separate future directive.
  The present outbox and scan history are not that capability.

## Security, scanner operations and abuse controls

Current evidence: `uploads.mjs` checks type/size/hash and uses strict Boolean
Cloudmersive results with a 30-second deadline. No real scan occurs in this
audit. The paid Basic plan and 1 GB entitlement are owner-reported historical
checkout facts; the free tier was documented as **3.5 MB**, separate from the
application's **10 MB** maximum. No subscription/pricing recheck was performed.

- [ ] Establish production secret storage, access restrictions, rotation/revocation
  and separate environment credentials. Keep Cloudmersive and database/mail/
  merchant secrets out of source, browser bundles, command arguments and logs.
  The local environment-variable mechanism alone is not a complete secret
  lifecycle. Never ask for the owner's key in chat.
- [ ] Plan scanner availability/quota/budget monitoring and controlled recovery
  for timeouts, auth failure, quota exhaustion and malformed results. Preserve
  quarantine and immutable scan history; no manual clean override or unbounded
  automatic paid scan retries. One real clean PDF does not establish uptime or
  malware-detection coverage for every supported format.
- [ ] Protect costly upload/rescan operations with production abuse controls,
  concurrency limits and precondition checks before resource consumption.
  Existing safeguards include body limits, local intake limits and a draft
  per-actor command limit; they are not comprehensive perimeter/login/download/
  rescan rate limiting or protection against slow and parallel requests.
- [ ] Assess synchronous filesystem/SQL calls, full-buffer uploads and downloads,
  and concurrent 30-second scan waits against the chosen hosting capacity.
  Bound connection, body-read, scan and response resources without opening gates.
- [ ] Translate the existing exact loopback Host/Origin/CSRF restrictions to the
  approved HTTPS topology. Review proxy trust, CORS allowlists, allowed methods,
  headers, cookie credentials and preflight behavior; do not enable wildcard
  authenticated cross-origin access to make integration easier.
- [ ] Preserve existing CSP/no-store/frame/referrer/nosniff protections and assess
  required production headers, cache behavior and error handling. Sanitized
  errors must remain useful operationally without returning provider secrets.
- [ ] Establish structured redacted logs, request/event correlation, restricted
  audit access, monitoring/alert routing and incident response. Local `stats`
  counters do not instrument actual Cloudmersive traffic; their zero values
  must not be used as production evidence that no external requests occurred.
- [ ] Establish dependency/runtime patching, reproducible package/lock handling
  and a defined security-review process. No package installation, update or
  vulnerability scanner was run as part of this documentation-only audit.
- [ ] Establish backups and recovery for both DB evidence and private files,
  encrypted backup access, restore evidence, recovery ownership and incident
  runbooks. Local restart persistence alone is not backup or disaster recovery.

## Legal, privacy and data lifecycle — approvals absent from local fixtures

This is an inventory of approvals/evidence needed, not legal advice or a claim
that any specific jurisdictional requirement has been met.

- [ ] Obtain appropriate approval of real terms of service, translator
  participation terms and quote/acceptance wording. Synthetic four-language
  policy placeholders are not approved commercial terms or proof of enforceability.
- [ ] Establish an accurate privacy notice and data-processing disclosures for
  customer identities, contact details, confidential uploads and recipients.
  A real scan sends document bytes and a generic filename to Cloudmersive;
  local storage does not mean the document stays on the local machine.
- [ ] Review applicable data location/transfer, provider contractual protections,
  authorized processing and customer/translator confidentiality requirements
  with the appropriate adviser. This audit sets no jurisdiction or legal rule.
- [ ] Obtain approved retention, deletion, access-request and legal-hold handling
  for files, contact details, scan events, immutable quotes/acceptances, logs and
  backups. Reconcile deletion requirements with append-only evidence rather than
  silently disabling history protections or inventing a retention duration.
- [ ] Ensure public service descriptions, privacy/terms links and customer
  acknowledgements match actual enabled capabilities and approved languages;
  no unapproved sworn-translation or interpretation promises.

## Public UI, release evidence and operational handover

- [ ] Authorize and wire a production customer/staff/provider UI to the managed
  backend. The local server injects its handler into `translation-request.html`;
  the static public build does not acquire that handler or these APIs by being
  rebuilt. Keep existing receipt/intake routing distinct until deliberately joined.
- [ ] Replace synthetic-only labels/data with approved real customer copy only
  after the backend and commercial boundaries are approved. Validate intended
  languages, accessibility, browser refresh/recovery, expired links/quotes and
  quarantine errors. The new local workspaces are currently English only.
- [ ] Reconcile capabilities exposed in the UI with available commands: the
  local HTTP action allowlist is narrower than the draft SQL command set.
  Real readiness management, exception handling, support and ownership cover
  must have an authorized operational route, not direct SQL improvisation.
- [ ] Obtain future managed-environment validation of real JWTs, RLS/grants,
  network boundary, callbacks, storage authorization, concurrent changes,
  notification delivery and any paid path before authorizing commitments.
  Historical local/mock tests and the owner real scan cannot stand in for that
  evidence. These checks are listed only; none was run in Block 1.7.
- [ ] Produce an explicit scoped release decision with recorded control states,
  accountable operator, rollback/disable procedure and support readiness.
  Preserve separate approvals for deployment, customer activation, email and
  payments. Do not infer approval from completing this checklist document.

## Documentation hygiene outcome — 14 November 2026

- The sweep covers `docs/quote/` and public source files, including the request
  form and copy dictionaries. Scanner terminology in the Block 1.6 guide was
  simplified to **Basic ($19.99/month)** and the recorded free-tier **3.5 MB**
  cap. References to the superseded plan/size labels were removed from that
  guide; historical audit artifacts outside this sweep were not rewritten.
- The application remains **10 MB (10,000,000 bytes) per file**, independent of
  the free-tier cap and the owner's reported paid **1 GB** entitlement. No
  public HTML, JavaScript, translation dictionary, SQL or other executable source
  was edited. Existing public 10 MB wording was retained.
- This is documentation hygiene, not a fresh online price/limit verification.

**Keep out, unchanged:** production deployment, email transport, payments,
customer activation, Block 2 and Block 3 remain strictly unauthorized.
