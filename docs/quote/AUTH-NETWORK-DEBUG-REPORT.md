# Marocora — Auth Network Debugging

Recorded 15 November 2026. The owner reports the staging migration/seed/accounts
were applied and the app connected, but login failed. This task did not apply
SQL, alter managed tables/settings, create accounts or send email.

## Latest RPC diagnosis and prepared repair — 15 November 2026

Direct live Auth remains successful. The requested `REAL RPC ERROR:` logging
was added inside the adapter's `invoke`, and the live E2E command was rerun.
It exited 1 with this exact RPC object:

```text
REAL RPC ERROR: {
  code: '42501',
  details: null,
  hint: null,
  message: 'permission denied for schema public'
}
```

The error is a schema permission denial, not missing-function/cache or
`UNAVAILABLE`. It prevents the request from invoking the session function, so
no conclusion about allowlist/staff UUID matching is established. No account
UUIDs were queried or invented. The checked-in seed deliberately keeps
`staff_id uuid := NULL` as an owner-editable template; the managed seed copy
cannot be inferred from it.

Root preparation gap: the export granted specific function EXECUTE privileges
but relied on preexisting schema USAGE. Earlier disposable SQL harnesses explicitly
granted schema USAGE before applying the migration, masking this managed-project
difference. Function EXECUTE and schema USAGE are both required.

Local fix: both the unified migration and its export script now explicitly grant
`USAGE ON SCHEMA public TO authenticated,service_role`. Added
`supabase/repairs/20261115_translation_schema_usage.sql` for the existing managed
schema. It grants no CREATE, direct table access or extra function execution and
changes no RLS, allowlist or workflow switches. NOTIFY refreshes PostgREST after
the grant; NOTIFY alone cannot repair permissions.

A new disposable PostgreSQL regression starts without public-schema USAGE for
client roles, verifies fresh migration access, reproduces the exact schema denial,
applies the repair twice, and verifies staff context works while table/core
access stays denied, anon schema access stays absent and switches stay OFF.
Final guarded `npm test`: **197 passed, 0 failed, 0 skipped/cancelled**.
Existing tests were not edited.

**Managed repair has not been applied by Codex.** Use the intended staging
Dashboard → SQL Editor → New query as `postgres`/database owner, and run:

```sql
BEGIN;
GRANT USAGE ON SCHEMA public TO authenticated,service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
```

Then run `node scripts/test-e2e-auth.mjs`. Do not rerun the full migration or
broaden table/function grants. SQL Editor owner access is needed for this repair;
the Auth/HTTP test scripts do not provide an administrative SQL execution route.
If the next response is `UNAVAILABLE`, investigate the actual Auth UUID and
managed staging allowlist then; that is not the present error.

Evidence: `auth-debug-evidence/live-rpc-schema-permission.txt` and
`auth-debug-evidence/npm-test-schema-usage.txt`. The older live verification
below remains historical; its generic RPC error is now explained by the exact
schema denial above. E2E is still failing until managed repair and retest.

Continuation point: after owner applies the narrow SQL repair, continue
**Marocora — Schema Permission Repair Verification**. Read this latest section,
run the existing E2E command, and follow only its newly evidenced error. Do not
repeat DNS/Auth investigation or completed local tests unless code changes.

---

## Latest live verification — 15 November 2026

**LIVE AUTHENTICATION IS SUCCESSFUL.** This refers to direct Supabase Auth;
**managed bridge E2E is not yet successful**.

The owner corrected the missing letter in the configured Project URL. Missing
`STAGING_AUTH_TEST_EMAIL` and `STAGING_AUTH_TEST_PASSWORD` variables were appended
to the private ignored `.env` using the expressly supplied synthetic staff
credentials, without printing the file or credentials. No keys/URLs were changed.
The file permissions were set to 0600.

`node scripts/test-real-auth.mjs` exited **0**. Exact output:

```text
MODE: REAL AUTH (no workflow/database mutations)
AUTH_CONNECTIVITY {"httpStatus":200,"reachedServer":true}
DIRECT_AUTH_PASS {"accessToken":"[REDACTED]","tokenFormatValid":true,"userVerified":true,"emailConfirmed":true,"anonymous":false,"expiresIn":3600}
```

`node scripts/test-e2e-auth.mjs` ran immediately afterward and exited **1**.
Exact output:

```text
MODE: REAL E2E AUTH (temporary loopback app; no workflow/database mutations)
AUTH_TEST_FAILED {"error":{"name":"Error","message":"E2E_LOGIN_FAILED: STAGING_RPC_FAILED","status":"503"},"hint":"Check the structured error code/cause. HTTP Auth errors mean the server was reached; transport failures do not establish bad credentials."}
```

The reachability, password sign-in, bearer format and verified confirmed identity
checks now pass. The E2E login fails at the subsequent database RPC stage before
`/api/me` can be verified. During login the adapter calls
`translation_session_context` after Auth verification; the generic RPC failure
alone does not reveal the underlying PostgREST/database error. Do not infer that
RLS, staff role resolution or managed runtime settings were verified.

Next task: capture the sanitized underlying RPC error code/message for
`translation_session_context`, then check that evidenced error against the
managed function/grant/schema-cache/allowlist configuration. No SQL, grants,
managed workflow rows or settings were changed in this verification. Successful
password sign-ins created normal Auth sessions; no tokens were printed or saved.
The temporary E2E listener/directory was cleaned up by the script.

Evidence: `auth-debug-evidence/live-auth-after-url-correction.txt` and
`auth-debug-evidence/live-e2e-after-url-correction.txt`. No source/test changes
were made; the last local regression result remains 196/196 (not rerun for this
configuration-and-live-verification task).

The following original investigation is retained as historical evidence; its
DNS and missing-credential blockers are superseded by the live results above.

---

## Finding

The actual underlying network failure is:

```text
TypeError: fetch failed
cause.code: ENOTFOUND
cause.errno: -3008
cause.syscall: getaddrinfo
cause.message: getaddrinfo ENOTFOUND [configured hostname redacted]
```

It reproduced outside the desktop tool sandbox. Two public DNS control domains
resolved in the same environment; the configured Supabase hostname did not.
The hostname has the normal Supabase hostname shape and was not classified as an
obvious placeholder, but that does not prove it matches the owner's actual project.

This establishes a configured-hostname DNS failure, before TLS/HTTP/Auth/RLS.
An exact wrong reference, stale/filtered DNS or unavailable project remains to
be distinguished by comparing the Dashboard Project URL privately. A larger
timeout does not repair an unresolved hostname. There is no evidence yet of a
bad password, TLS failure or RLS failure in the live sign-in.

## Changes

- `server/block1/network-diagnostics.mjs`: shared 45-second deadline, preservation
  of caller abort signals, exact-origin enforcement, redirect rejection, nested
  cause/code diagnostics and actionable hints. Logs redact keys, login fields,
  bearer tokens and URLs; TLS verification remains enabled.
- `server/block1/supabase-database.mjs`: uses that transport, preserves the original
  fetch cause internally, replaces the owner's raw error-object console log with
  sanitized diagnostics, and returns HTTP 503 on login transport failure.
- `scripts/test-real-auth.mjs`: loads the checkout's `.env` programmatically,
  probes Auth reachability, calls SDK `signInWithPassword`, checks bearer format,
  and verifies the returned identity using `getUser`. It uses only the anon key.
  Default logs redact tokens/user details; explicit `--show-sensitive` prints the
  full SDK result locally, as requested. That option was not run by Codex.
- `scripts/test-e2e-auth.mjs`: creates a temporary loopback HTTP app using the same
  adapter/HTTP handlers as the staging launcher. It checks POST login HTTP 200,
  token format, and authenticated GET `/api/me` HTTP 200/role/settings. It closes
  the listener and removes its temporary directory on success/failure. It never
  calls privileged scan RPCs or workflow mutations and leaves the existing server
  and retained files alone.
- `scripts/auth-test-support.mjs`: private environment loading, configuration and
  credential checks, safe reporting and explicit no-cloud mock mode.
- `tests/auth-diagnostics.test.mjs`: eight added regression tests, including cause
  redaction, cancellation/deadline behavior, origin restriction, direct SDK Auth,
  real loopback E2E, allowlist failure, and transport error HTTP 503.
- `docs/quote/STAGING-SETUP.md`: new **Troubleshooting Login** section with exact
  commands, variable names, error interpretation and owner next steps.

No dependency or lockfile changes. Existing 188 tests and their fixtures were
not edited. The official offline runner and network policies were not changed.

## Execution results

| Run | Result |
| --- | --- |
| Final `npm test` under existing OS/JS internet denial | **196 passed, 0 failed, 0 skipped/cancelled** |
| Original checks preserved | **188**, plus eight new checks |
| Preexisting test/fixture files preserved | **34/34**, SHA-256 identical |
| Direct Auth CLI `--mock` | PASS; sign-in and verified identity |
| E2E CLI `--mock` | PASS; POST login and GET `/api/me` HTTP 200 |
| Real `--probe-only`, outside tool sandbox | FAIL; configured hostname `ENOTFOUND` |
| Real direct-auth script, outside tool sandbox | FAIL at read-only reachability probe; same `ENOTFOUND`; no password request sent |
| Real E2E script | FAIL before launch; test email/password absent |
| DNS controls | Configured project fails; two public domains resolve |

All ordinary regression workers reported zero outbound attempts. Mock CLI runs
also used the existing OS sandbox and both JS guards. Real diagnostic runs were
separate opt-in network commands, not added as live calls to `npm test`.

No initial regression failures occurred in this stage. The first 195/195 run
passed; one additional regression was then added for the HTTP 503 fix, producing
the final 196/196 run. Live failures remain accurately reported, not marked pass.

## Owner next steps

1. Privately compare `.env` `SUPABASE_URL` with the exact Project URL in the intended
   staging Dashboard. Confirm project availability. Fix any mismatch locally.
   Clear stale exported Supabase variables if necessary; exported values take
   precedence over Node's `.env` loader.
2. Run `node scripts/test-real-auth.mjs --probe-only` in a normal Terminal.
   Require HTTP 200. If DNS still fails with the verified URL, investigate DNS/VPN
   filtering or try another trusted network. Do not change SQL/RLS for this error.
3. Privately add `STAGING_AUTH_TEST_EMAIL` and `STAGING_AUTH_TEST_PASSWORD` to
   ignored `.env`, using an existing confirmed, allowlisted synthetic account.
4. Run `node scripts/test-real-auth.mjs`, then `node scripts/test-e2e-auth.mjs`.
   No browser clicks required. These run once, without retry loops; keep gates OFF.
5. Share only sanitized status/error codes. Do not share `.env`, headers, passwords
   or any output from `--show-sensitive`. Restart the old staging process only
   if retrying the browser after changing code/environment.

Successful real Auth and managed E2E behavior remain **unverified** until these
inputs are corrected privately. The scripts are implemented and mock-verified;
credentials were not guessed and a project hostname was not invented.

## Evidence and continuation

Evidence lives in `docs/quote/auth-debug-evidence/`: `real-connectivity.txt`,
`real-connectivity-unrestricted.txt`, `real-auth.txt`, `real-e2e-auth.txt`,
`dns-controls.txt`, `mock-real-auth.txt`, `mock-e2e-auth.txt`, `npm-test-final.txt`,
`before-test-hashes.json`, and `preservation.json`.

Checkout: `/Users/tareqnaser/Documents/ChatGPT/Marocora Site building/output/marocora-quote-workflow-local`.
Branch: `codex/marocora-quote-workflow-local`; existing HEAD
`127cba9a6b6a429f4913b9cb70b154fc234dbe41`. No commit/push/deploy occurred.
Preexisting uncommitted work was preserved. The earlier autonomous preparation
report is historical; its statement that managed SQL is not applied is superseded
by the owner's report, not by a database verification performed in this task.

After the owner corrects the inputs, a fresh chat is a useful continuation point.
Starter prompt:

> Continue **Marocora — Auth Network Verification**. Read
> `docs/quote/AUTH-NETWORK-DEBUG-REPORT.md` and the Troubleshooting Login section
> of `docs/quote/STAGING-SETUP.md`. The 196 local tests pass and original 188 are
> unchanged. Live Auth previously failed DNS (`ENOTFOUND`) for the configured
> project while public DNS controls resolved; test account variables were absent.
> I have corrected the private configuration. Interpret my sanitized real-auth
> and E2E output; do not repeat completed local investigation or change SQL unless
> a new error justifies it. Never print credentials or connect to production.
