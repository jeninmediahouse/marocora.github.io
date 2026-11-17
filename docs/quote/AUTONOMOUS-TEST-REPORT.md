# Marocora — Autonomous staging test report

Recorded: 15 November 2026 (Africa/Casablanca). **Local preparation only; managed
Supabase remains unverified.** No live project was contacted, credentials or
credential files read, accounts created remotely, emails sent, or deployment made.
All SDK responses and keys used in these tests are synthetic.

## Results

| Verification | Passed | Failed | Skipped/cancelled |
| --- | ---: | ---: | ---: |
| Original suite (168 original + 5 bridge checks) | 173 | 0 | 0 |
| New rigorous tests | 15 | 0 | 0 |
| Final `npm test` | **188** | **0** | **0** |
| Standalone disposable PostgreSQL verification groups | 6 | 0 | 0 |

Final `npm test` exited 0 in 7.89 seconds. All **33 preexisting test/fixture files**
match the SHA-256 snapshot taken before edits. No original test was deleted,
rewritten or weakened. The adapter and migration/seed required no product changes.
No dependency or lockfile was changed in this task.

Evidence (relative to this report):

- [Full final npm output](autonomous-evidence/npm-test-final.txt)
- [Standalone SQL output](autonomous-evidence/sql-resilience-final.txt)
- [Original test hashes](autonomous-evidence/original-test-hashes.json)
- [Preservation result](autonomous-evidence/test-preservation.json)
- Initial failure logs: `rigorous-first.txt`, `rigorous-local-access.txt`, and
  `rigorous-os-isolated.txt` in `autonomous-evidence/`.

## Edge cases and actual behavior

- Invalid and expired tokens, unconfirmed email and anonymous users: HTTP 401;
  no session/workflow RPC after rejected Auth. Cookies/role headers do not bypass.
- Confirmed user claiming staff in metadata but absent from allowlist: denied
  with `UNAVAILABLE`; no staff options call. Existing adapter maps this recognized
  database error to HTTP 400; customer-role staff spoofing reaches HTTP 403.
- Database role overrides metadata/headers. Missing or mismatched context actor
  and unrecognized role fail with HTTP 401.
- Simulated timeout and database HTTP 500: HTTP 503 `STAGING_RPC_FAILED`, internal
  database message withheld, followed by a successful request on the same server.
- All settings OFF: the bridge propagates `COMMANDS_DISABLED` from authoritative
  SQL. The adapter does not cache switches or independently authorize commands.
  Real disposable SQL also rejects capture and command execution while OFF.
- All 32 tables deny SELECT/INSERT/UPDATE/DELETE to `anon`, `authenticated` and
  `service_role`: **384 direct permission-denial checks**. All 32 tables have
  restrictive RLS policies. Temporary SELECT grants on seeded settings/staff/
  allowlist tables still expose zero rows to anon/authenticated; grants roll back.
- `service_role` successfully commits a synthetic scan record; anon/authenticated
  cannot record it. Service role cannot call `quote_command_core` or `quote_command`
  or directly alter transaction tables. BYPASSRLS does not override revoked ACLs.
- Repeated seed preserves the singleton and forces OFF. Repeated migration
  intentionally fails with `TRANSLATION_SCHEMA_ALREADY_EXISTS_STOP_AND_COMPARE`.
  This is safe refusal, not a silently rerunnable migration. Table rows, ACLs
  and RLS policies match the pre-retry snapshot, and command gating still works.

## Isolation evidence

The unchanged existing loopback guard is still preloaded. A supplemental guard
blocks fetch/HTTP(S), raw TCP/TLS, remote DNS and UDP, including custom resolver
paths. Any unexpected denial marks the process failed even if code catches it.
Ten deliberate probes run in a child; all throw before network access and its
nonzero exit is required by the parent test. Ordinary workers report zero attempts.

`npm test` additionally launches Node under `scripts/test-network.sb` through
macOS `sandbox-exec`: outbound internet is denied for native code and descendants;
only loopback and Unix sockets are allowed. A child **without JavaScript guards**
attempts TCP to the documentation-only TEST-NET-3 address; the inherited OS policy
immediately returns EPERM/EACCES, as asserted by the passing test. This is a
kernel denial test, not a successful external connection or packet capture.

PostgreSQL runs in a new temporary cluster, with `listen_addresses` empty and a
private Unix socket. All clusters, synthetic records and temporary grants are
removed in `finally`. Retained app databases/private files were not opened.
The runner strips inherited cloud/mail/PG connection configuration and refuses
non-macOS platforms until an equivalent OS policy is supplied. This portability
restriction is intentional; there is no silent isolation downgrade.

## Initial failures and corrections

1. The desktop tool sandbox initially denied loopback listeners and PostgreSQL
   shared memory (`EPERM`). The local run used execution access approved by the
   tool review, with a narrower outbound-denying OS sandbox and both guards.
   No owner confirmation or credentials were requested.
2. The first SQL harness tried a no-op UPDATE of PostgreSQL's `tableoid` system
   column. PostgreSQL rejected that invalid query before checking permissions.
   The harness now selects a real column from the catalog; all 384 ACL checks pass.
3. The synthetic scan fixture initially enabled capture alone. Real SQL correctly
   requires **both capture and commands** for draft creation. The fixture enables
   both only inside its disposable database, then reruns the seed and proves all
   switches OFF. No application gate was relaxed.

No requested product edge case remains failing. Earlier failed runs are retained
as evidence; the final green run includes every original test.

## Deliverables and managed blind spots

Added `tests/staging-rigorous.test.mjs`, `scripts/test-staging-sql.mjs`,
`scripts/test-network-lock.mjs`, `scripts/test-network.sb`, this report and evidence.
Updated `scripts/test-local.mjs` and the requested **Managed Cloud Verification
(Owner Action Required)** section of [STAGING-SETUP.md](STAGING-SETUP.md).
That section gives the exact SQL Editor workflow, no-email synthetic Auth setup,
seed substitutions, dummy identities/files, expected RLS/ACL outcomes, exactly-one
settings-row/OFF checks, and explicit shutdown/OFF actions.

Local Auth compatibility and SDK mocks do not prove real JWT validation,
revocation, managed default privileges/owners, PostgREST cache/forwarding,
Dashboard behavior or remote TLS/deadlines. The timeout is a simulated throw,
not a 15-second real-cloud latency measurement. Managed switch state is **unknown**.
File bytes remain Mac-local; real antivirus, mail, delivery and production hosting
are not validated. Owner actions must use synthetic staging data only.

The next stage is owner-run managed verification, with credentials kept privately
on the owner's machine. See [the concise handoff](MAROCORA-MANAGED-CLOUD-HANDOFF.md).

**LOCAL AUTONOMOUS PREPARATION COMPLETE. OWNER MUST NOW APPLY SQL TO MANAGED CLOUD AND SUPPLY CREDENTIALS PRIVATELY.**
