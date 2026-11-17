# Marocora — owner-managed Supabase staging setup

Prepared 14 November 2026. **Local/cloud integration preparation only.** The
schema, seed and bridge were verified with disposable local PostgreSQL and
mocked Supabase SDK responses. They have **not** been applied to or tested against
your managed project. No live connection or public deployment was made by Codex.

**Local testing only: this app is not safe for public deployment or real customer
documents.** Use only confirmed synthetic accounts and harmless synthetic files.
No public launch, real customer access, payments, real emails, real Cloudmersive
requests or interpretation implementation is authorized by this preparation.

## 1. Check the staging target and create test Auth accounts yourself

Confirm in your Supabase Dashboard that you are using the intended **staging**
project. Codex does not create/manage the project, sign in to it or handle keys.
The schema assumes Supabase's existing `auth.users`, `auth.uid()`, `auth.role()`
and standard `anon`, `authenticated`, `service_role` roles. It does not create
Auth roles/users or replace Supabase's authentication functions.

Use the Dashboard's Auth user administration to create confirmed synthetic
staff/customer/provider accounts with passwords you control. Use the admin
creation/confirmation route without sending invitations or confirmation emails;
do not initiate password recovery, magic-link or signup email flows. Copy their
Auth UUIDs for the seed. Do not give Codex passwords, API keys or access tokens.
Keep public signup/customer access closed for this owner-only exercise.

All translation users must also be in the owner-controlled staging allowlist.
A valid/confirmed Auth account alone does not grant entry. No email address or
user-metadata role is trusted as staff authorization.

## 2. Run the schema SQL in the staging SQL Editor

Open `supabase/migrations/202611140001_translation_workflow.sql`, copy its entire
contents and run them in the staging project's SQL Editor. This is a standalone
translation schema; do **not** run the old learning/vendor migrations, fixture
files, Auth bootstrap, draft files or local overlays into the project.

The migration contains the final regular/sworn/fulfillment tables and functions,
restricted RPC grants, immutable triggers, enabled RLS and restrictive deny-direct-
access policies. Clients use controlled RPCs, not direct table reads or writes.
There are no local target guards, runtime function-text patches, temporary/test
schemas, Auth emulation, permanent fixture identities, fixture seed rows or
rollback statements. The empty operational exclusion registry remains part of
the security model; it is not a populated test fixture.

The initial preflight refuses existing translation tables. If you receive
`TRANSLATION_SCHEMA_ALREADY_EXISTS_STOP_AND_COMPARE`, stop: do not drop tables or
rerun legacy SQL to get past it. A separate compatibility review is needed for
an already-populated translation schema. No destructive reset is provided here.

Only translation-related triggers are included; existing vendor/Formspree/mail
triggers and learning-platform functions are not installed by this migration.
No mock email queue has a transport/dispatcher attached.

## 3. Configure and run the owner seed

Open `supabase/migrations/202611140002_translation_seed.sql` in the SQL Editor.
Edit its in-editor configuration, not a committed secret file:

- Replace `staff_id uuid := NULL` with the existing confirmed synthetic staff
  Auth UUID as a UUID literal.
- Put your confirmed synthetic customer Auth UUID(s) in the `customers` JSON
  array. The default empty list authorizes no customers.
- Optionally fill the `providers` array with your existing confirmed synthetic
  provider Auth UUID and synthetic display name. This enables the local-style
  walkthrough's provider selection. Leaving it empty means there are no selectable
  providers until you explicitly configure one.

Run the whole seed after editing. It deliberately stops before writes if the
staff UUID is unset or unconfirmed. It seeds the staff membership, request owner,
explicit staging allowlist, staging-only participation/acceptance policies and
OFF settings. It creates no Auth users and invents no passwords or API keys.

Optional provider entries are explicit owner setup of synthetic provider approval,
capabilities and staging participation acknowledgement. They are not real
provider consent or Ministry credential approval. Moroccan sworn credentials still
need the image upload and separate staff review in the app. Use synthetic data.
Repeated seed execution leaves existing policy/history intact and forces settings
OFF; it does not overwrite a different existing staff owner.

Confirm the final seed result has:

```text
capture_enabled       false
commands_enabled      false
notifications_enabled false
```

Policy wording is marked STAGING ONLY; it is not approved live commercial policy.
The seed is an owner-editable SQL Editor template, not an unattended migration.

## 4. Configure the local process environment

In the checkout, copy `.env.example` to `.env` locally and set only:

```text
SUPABASE_URL=https://your-staging-project.supabase.co
SUPABASE_ANON_KEY=your-staging-anon-or-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-staging-service-role-key
CLOUDMERSIVE_API_KEY=
RESEND_API_KEY=
```

Use your project's API settings. The service-role key is server-only: never put
it in HTML, browser code, a URL, a command argument, chat or a Git commit. Keep
`.env` private and confirm it is ignored by Git. No actual `.env` was created or
read during preparation. Do not paste its contents back to Codex.

Cloudmersive and Resend variables are defined for configuration completeness but
are deliberately empty and unused in staging. Scanning always uses the injected
SDK transport mock; email always remains a database mock queue. Setting those
keys does not enable a real scanner or sender in the staging launcher.

Node's `--env-file` loads `.env` for the staging command below. The adapter also
recognizes already-exported complete Supabase variables. Any partial Supabase
configuration fails closed; it does not silently start local PostgreSQL.
Without any cloud variables, ordinary database construction retains local mode.
Historical local preview launchers explicitly remain local even if staging
variables happen to exist. The staging launcher refuses absent configuration
before opening any local PostgreSQL instance.

## 5. Start Staging Mode locally

From the checkout, with the required Node version already installed:

```sh
node --env-file=.env server/block1/start-staging.mjs
```

Expected local URL:

```text
http://127.0.0.1:4199/staging-login.html
```

This binds loopback only. It starts no local PostgreSQL, applies no SQL, creates
no account and changes no cloud switch. Startup prepares the SDK clients; the
owner's sign-in/API actions subsequently contact the configured staging project's
Auth/RPC endpoints. The server transport restricts requests to that exact HTTPS
project origin and rejects redirects. This is a future owner action, not a live
connection performed during implementation.

Sign in with a synthetic staging account/password. Use separate browser profiles
for staff/customer/provider. The loopback server uses Supabase Auth password
sign-in and verifies the returned token with `auth.getUser`. Each authenticated
API request verifies its Bearer token again and obtains its current role from
database records. Client role/identity headers and command fields cannot select
an actor. Missing/invalid/revoked/unallowlisted identity fails closed.

Staging has no synthetic-ticket login or local-cookie fallback. A malformed or
invalid Authorization header is rejected rather than downgrading to cookies.
Historical local mode retains its original cookie/CSRF login without cloud keys.

The staging UI keeps the access token in this tab's session storage and sends it
in Authorization headers, including private downloads—not in URL query strings.
Treat the token as a secret. There is no refresh-token flow: sign in again after
expiry. Sign-out clears the tab token; it is not a project-wide token-revocation
mechanism. No service-role key is returned to the browser.

## 6. Optional owner-only synthetic walkthrough

With all settings OFF you can verify sign-in, current role and read-only views.
To exercise mutations, the owner may explicitly enable only this staging
project's gates in its SQL Editor:

```sql
UPDATE public.quote_settings
SET capture_enabled=true, commands_enabled=true, notifications_enabled=true;
```

Notifications here means queue creation, not real sending. Follow `BLOCK2-LOCAL.md`
for the synthetic credential review, required Moroccan original scan, request
submission lock and regular fulfillment walkthrough. All scan outcomes in this
launcher are mocked clean, not evidence of a real antivirus scan. No real Ministry
verification, encryption, shipping, money or final translation delivery occurs.

Private file bytes remain on the local machine under `tmp/staging-private` in
0700 directories/0600 files; only metadata and workflow records are in Supabase.
Keep that directory private and persistent between restarts. Cloud metadata alone
cannot restore a missing local file. This preparation does not provide managed
object storage, multi-machine durability, backups or production file hosting.
Use harmless synthetic files only. Never expose or sync this directory publicly.

## 7. Close the owner exercise and record non-secret outcomes

In the staging SQL Editor, force the three gates OFF and inspect them:

```sql
UPDATE public.quote_settings
SET capture_enabled=false, commands_enabled=false, notifications_enabled=false;
SELECT capture_enabled,commands_enabled,notifications_enabled
FROM public.quote_settings;
```

Then sign out, close the browser test profiles and stop the local server with
Ctrl-C. Unlike the local PostgreSQL preview, this launcher does not alter cloud
settings on shutdown; the owner SQL step above is required. Do not infer cloud
OFF from a stopped Node process. Keep `.env` private/remove it when appropriate.

Return only non-secret results: migration/seed success or exact sanitized error,
account role, synthetic workflow outcomes and final OFF values. Never send API
keys, account passwords, JWTs, private URLs/headers or document bytes to chat.

## Remaining launch boundaries

This is a staging bridge, not production launch authorization. Managed-project
execution, real JWT/network behavior, SQL Editor ownership/default privileges and
PostgREST schema cache must still be checked by the owner in staging. Local SQL
tests use an Auth compatibility surface; SDK tests use injected responses. They
do not establish that a live project was connected or successfully configured.
Production deployment/public URLs, real customer access/data, live payments,
real email, real scanner requests and Block 3 remain unauthorized. The broader
`PRODUCTION-READINESS.md` remains applicable as a dated gap inventory.

Technical references used in preparation:
[Supabase getUser](https://supabase.com/docs/reference/javascript/auth-getuser),
[Supabase database functions](https://supabase.com/docs/guides/database/functions),
[Supabase RPC](https://supabase.com/docs/reference/javascript/rpc).

## Isolated regression command

`pnpm test` uses `scripts/test-local.mjs`, which removes inherited cloud/mail/PG
connection variables from its child environment and preloads the loopback network
guard. The existing 168 local tests remain unchanged and need no cloud credentials;
new bridge tests inject SDK responses and apply SQL only to disposable local
PostgreSQL. Run this command for isolated regression checks, not a cloud walkthrough.

## Managed Cloud Verification (Owner Action Required)

Prepared 15 November 2026 using local evidence only. **The following are manual
owner actions in a separate staging project. Codex has not performed them.**
Dashboard labels may vary; use **Create new user**, never **Invite user**.

1. Open your Supabase Dashboard, select the intended **staging** project, and
   check its project name/reference before every SQL run. Keep production closed.
   Open **Authentication → Users → Add user → Create new user**. Create these
   synthetic accounts, choosing private passwords yourself and enabling
   **Auto Confirm User** (or the equivalent confirmed-email option):
   `staff@staging.invalid`, `customer@staging.invalid`,
   `provider@staging.invalid`, and `outsider@staging.invalid`.
   Creating users through the admin route with auto-confirm does not send a
   confirmation email. Do not use Invite, signup, magic link, password recovery,
   or any option that sends email. If your dashboard has no no-email creation
   option, stop this step and use the owner-run Admin `createUser` route with
   `email_confirm: true`; do not improvise SQL inserts into `auth.users`.
   Verify each user has a confirmed email and is not anonymous; copy the four
   UUIDs privately. No password, token or key belongs in SQL, Git or chat.

2. In the same project's left sidebar open **SQL Editor → New query**.
   Copy the **entire** local file
   `supabase/migrations/202611140001_translation_workflow.sql` into the query,
   select the database owner (`postgres`) execution role, and click **Run**.
   Expect success. Do not paste Auth bootstrap, test scripts or old migrations.
   A second application is deliberately refused, not silently accepted:
   `TRANSLATION_SCHEMA_ALREADY_EXISTS_STOP_AND_COMPARE`. This means stop and
   compare; never drop tables to retry. The local test proves rejection preserves
   table data, privileges and RLS policies; managed behavior remains owner-verified.

3. Open another **SQL Editor → New query**. Paste the entire file
   `supabase/migrations/202611140002_translation_seed.sql`. In that query only,
   replace the three configuration lines, using your copied UUIDs:

   ```sql
   staff_id uuid := 'STAFF_AUTH_UUID'::uuid;
   customers jsonb := '["CUSTOMER_AUTH_UUID"]';
   providers jsonb := '[{"id":"PROVIDER_AUTH_UUID","name":"Synthetic translator"}]';
   ```

   The uppercase values are placeholders, not executable UUIDs. Leave the
   outsider out of every array and staff table. Run the entire configured seed.
   Do not save a modified seed containing account identities to the repository.

4. In a new owner-role query run:

   ```sql
   SELECT count(*) AS settings_rows,
          bool_and(NOT capture_enabled AND NOT commands_enabled
                   AND NOT notifications_enabled) AS all_off
   FROM public.quote_settings;
   SELECT owner_id FROM public.translation_settings;
   SELECT user_id, enabled FROM public.translation_staging_accounts;
   SELECT count(*) AS rls_tables
   FROM pg_class
   WHERE relnamespace='public'::regnamespace AND relkind='r' AND relrowsecurity;
   SELECT count(*) AS restrictive_policies
   FROM pg_policy
   WHERE polname='translation_rpc_only' AND NOT polpermissive;
   ```

   Expect `settings_rows=1`, `all_off=true`, owner equal to the staff UUID,
   three enabled allowlist accounts, and both security counts equal to **32**.
   A query returning zero settings rows is a failure, even if no switch is true.

5. Prove direct access is denied under client roles. Run each of the following
   in its own new query. Each must fail with **permission denied**, not return
   rows or succeed. If the editor retains an aborted transaction, run `ROLLBACK;`
   before the next check. An owner-role SELECT alone does not test client RLS.

   ```sql
   BEGIN;
   SET LOCAL ROLE anon;
   SELECT * FROM public.quote_settings;
   ROLLBACK;
   ```

   ```sql
   BEGIN;
   SET LOCAL ROLE authenticated;
   SELECT * FROM public.translation_staff;
   ROLLBACK;
   ```

   ```sql
   BEGIN;
   SET LOCAL ROLE service_role;
   UPDATE public.quote_settings SET commands_enabled=true;
   ROLLBACK;
   ```

   To test RLS independently of table privileges, run this owner query **in
   full, including ROLLBACK**. The temporary SELECT grant must never be committed:

   ```sql
   BEGIN;
   GRANT SELECT ON public.quote_settings TO anon;
   SET LOCAL ROLE anon;
   SELECT current_user, count(*) AS visible_rows FROM public.quote_settings;
   ROLLBACK;
   ```

   Expect `current_user=anon`, `visible_rows=0`, despite step 4 proving one
   settings row exists. Repeat with `authenticated` in place of both `anon`
   occurrences; expect zero again. `service_role` bypasses RLS by design;
   its direct access restriction depends on revoked table privileges and narrow
   RPC grants. Do not treat BYPASSRLS as permission to alter quote cores.

6. Check Auth UUID/allowlist resolution with synthetic identities. Substitute
   the staff UUID in **both** places below; expect role `staff` and matching
   actor. Repeat with customer and provider; expect their database roles.

   ```sql
   BEGIN;
   SET LOCAL ROLE authenticated;
   SELECT set_config('request.jwt.claim.sub','STAFF_AUTH_UUID',true);
   SELECT set_config('request.jwt.claim.role','authenticated',true);
   SELECT set_config('request.jwt.claims',
     '{"sub":"STAFF_AUTH_UUID","role":"authenticated"}',true);
   SELECT public.translation_session_context();
   SELECT public.translation_runtime_settings();
   ROLLBACK;
   ```

   Repeat with the outsider UUID; expect `UNAVAILABLE`. Adding a user-editable
   metadata field `role: staff` must not authorize that outsider. These SQL
   claim settings simulate PostgREST identity; they **do not verify a real JWT**.
   Real sign-in through the loopback app in step 9 must also reject the outsider.

7. Confirm transaction cores cannot be invoked by the scanner role. This
   owner query must return **false, false, true**:

   ```sql
   SELECT
     has_function_privilege('service_role',
       'public.quote_command_core(uuid,text,uuid,bigint,jsonb)','execute') AS core,
     has_function_privilege('service_role',
       'public.quote_command(uuid,text,uuid,bigint,jsonb)','execute') AS command,
     has_function_privilege('service_role',
       'public.translation_scan_record_scan(uuid,text,text,text,text,uuid)',
       'execute') AS record_scan;
   ```

   Actual execution of a scan-recording RPC and direct mutation denials is
   covered locally by `scripts/test-staging-sql.mjs`. In managed staging,
   use the optional walkthrough below to exercise recording against an actual
   synthetic file registration; a privilege query alone does not prove runtime
   scan recording, SQL ownership or Auth behavior.

8. While gates remain OFF, add this to the **staff** identity transaction from
   step 6, before ROLLBACK, and run it as a separate negative check:

   ```sql
   SELECT public.quote_command(
     '11111111-1111-4111-8111-111111111111'::uuid,
     'cancel_request','22222222-2222-4222-8222-222222222222'::uuid,0,'{}');
   ```

   Expect `COMMANDS_DISABLED`, with no command/history mutation. No existing
   real request UUID is needed: SQL checks the switch before the command core.
   Recheck the settings count and `all_off` using step 4 afterward.

9. Follow sections 4–5 above to configure credentials privately on your Mac and
   start `node --env-file=.env server/block1/start-staging.mjs`. This is the
   **first owner-authorized real Auth/PostgREST connection**, not part of the
   autonomous tests. Sign in separately as synthetic staff/customer/provider;
   verify current roles, OFF switches and read-only views. Sign in as outsider;
   access must be denied. Check the browser Network view locally: user RPCs must
   carry a user bearer, never the service-role key; do not copy headers to chat.
   Verify invalid/expired sessions require sign-in again. If PostgREST reports
   a missing function after successful migration, run the owner SQL
   `NOTIFY pgrst, 'reload schema';` and retry once; report sanitized errors.

10. Optional actual synthetic scan walkthrough: create a harmless local file
    named `synthetic.txt` containing only `MAROCORA SYNTHETIC STAGING TEST`.
    Enable gates only for the owner-controlled walkthrough in section 6, then reload
    the form so it reads the updated switches; in the
    customer UI create a **Document Translation** request, English → French,
    name `Synthetic customer`, description `Synthetic staging RLS check`.
    Attach that file before submitting the form (the UI creates a draft, uploads,
    then submits). The launcher records a **mock** scan via its service-role
    RPC; verify the customer/staff file view shows the mock result and the owner
    SQL `SELECT count(*) FROM public.translation_scan_events;` increases.
    Use no real documents, deliveries, addresses or money. This verifies the
    managed RPC/grant path, not real malware detection. With switches OFF, the
    same workflow must refuse mutation. Return gates OFF immediately:

    ```sql
    UPDATE public.quote_settings
    SET capture_enabled=false,commands_enabled=false,notifications_enabled=false;
    SELECT count(*) AS settings_rows,
           bool_and(NOT capture_enabled AND NOT commands_enabled
                    AND NOT notifications_enabled) AS all_off
    FROM public.quote_settings;
    ```

    Expect exactly one row and `all_off=true`. Sign out, stop the local server,
    and record only sanitized pass/fail outcomes. A failed walkthrough still
    requires this OFF step.

### Local isolation and remaining blind spots

`pnpm test` now runs under `scripts/test-network.sb` on macOS, denying internet
outbound for Node/native code and child processes while allowing loopback and
Unix sockets for local HTTP/PostgreSQL. The original guard remains unchanged;
`scripts/test-network-lock.mjs` additionally blocks raw TCP/TLS, remote DNS and
UDP, and makes a caught outbound attempt fail its process. Deliberate negative
probes run in an isolated child whose failure is required. Ordinary test workers
must report zero blocked attempts. The runner refuses other platforms until an
OS policy is supplied; it does not silently downgrade isolation. The standalone
SQL command is:

```sh
/usr/bin/sandbox-exec -f scripts/test-network.sb node \
  --import ./tests/fixtures/block16-network-guard.mjs \
  --import ./scripts/test-network-lock.mjs scripts/test-staging-sql.mjs
```

The SQL harness accepts no project URL and always uses a fresh local cluster,
TCP disabled, with disposable Auth compatibility functions. Its temporary tables,
accounts and grants are removed afterward. It does not alter retained app state.

Local success cannot establish managed Auth token validation/revocation, email
provider behavior, real network deadlines/TLS, PostgREST cache/JWT forwarding,
managed owner/default privileges, existing-project compatibility, or Dashboard
UI behavior. A thrown simulated timeout checks error handling, not the passage of
15 seconds against a remote server. The UI walkthrough, real scan provider,
mail transport and managed file durability remain unverified. Private file bytes
remain Mac-local; cloud metadata is not a backup. Never infer managed success or
managed OFF settings from this report.

## Troubleshooting Login

### Observed on 15 November 2026

The configured Auth endpoint failed **before HTTP/TLS/login**:

```text
TypeError: fetch failed
cause.code: ENOTFOUND
cause.syscall: getaddrinfo
cause.message: getaddrinfo ENOTFOUND [configured hostname redacted]
```

This reproduced outside the desktop tool sandbox. Two public control domains
resolved successfully in the same run, while the configured project hostname
failed. This narrows the failure to resolution of that hostname; it does not
prove which character, DNS configuration or project state is responsible.
It is not evidence of an incorrect password, RLS failure or certificate failure.
Do not rerun migrations or change database permissions to address this error.

The adapter now logs `STAGING_NETWORK_ERROR` with the actual nested error
code/message/cause, and a suggested next step, while redacting URLs, keys, bearer
tokens and login fields. The original cause is preserved internally. Login
transport failures return HTTP **503**, rather than claiming bad credentials.
The request deadline is **45 seconds** and combines with caller cancellation;
HTTPS origin restriction and `redirect: error` are preserved. A Node internal
TCP connect timeout may still occur sooner; extending the request deadline does
not override it. Certificate validation remains enabled.

### Fix the configured hostname privately, then run automated checks

1. In the intended staging project's Dashboard, copy its **Project URL** from
   the project's Connect dialog/API settings. Compare it privately with
   `SUPABASE_URL` in this checkout's `.env`. Use the exact HTTPS project origin,
   not a Dashboard URL, database connection string, copied project name or
   an invented reference. Confirm the project still exists and is available.
   Do not paste the URL, key or `.env` contents into chat.
2. The scripts load `.env` beside the checkout's `package.json` automatically;
   they never print its contents. Already-exported environment variables take
   precedence. If you suspect stale shell values, clear those variable names
   in your own Terminal before rerunning:

   ```sh
   unset SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY
   ```

3. Run the credential-free Auth reachability probe from the checkout:

   ```sh
   node scripts/test-real-auth.mjs --probe-only
   ```

   It makes one read-only GET to the configured `/auth/v1/settings` with the
   configured anon key. `AUTH_CONNECTIVITY` with HTTP 200 proves this route is
   reachable; it does not prove a password or allowlist entry. An HTTP 401/403
   means DNS/TLS/HTTP worked but the API key/project configuration needs review.
   If `ENOTFOUND` persists with the exact Dashboard URL, check DNS/VPN filtering,
   compare on another trusted network, and check the project's availability.
   The initial public DNS controls succeeded, so a general DNS outage was not
   observed. Do not disable TLS or alter database policies.

4. In your private ignored `.env`, add these **variable names** using an existing
   confirmed, non-anonymous, allowlisted synthetic account and its password:

   ```text
   STAGING_AUTH_TEST_EMAIL=<your-existing-synthetic-account-email>
   STAGING_AUTH_TEST_PASSWORD=<its-private-password>
   ```

   The angle-bracket text is a placeholder to replace locally. Do not use a
   production account. The diagnostics run found these values absent, so a real
   successful password login/E2E test could not be completed. No passwords were
   guessed and no Auth users were created. Do not put passwords on command lines.

5. Test the Supabase SDK directly, bypassing the staging HTTP server:

   ```sh
   node scripts/test-real-auth.mjs
   ```

   Expected: `AUTH_CONNECTIVITY` HTTP 200, then `DIRECT_AUTH_PASS`, with
   `tokenFormatValid: true` and `userVerified: true`. It calls
   `auth.signInWithPassword`, checks token format, then calls `auth.getUser`
   to verify the returned identity. The anon key is sufficient for this check;
   no service key is used. The default output redacts the token and user details.
   For the originally requested **full SDK result**, including access/refresh
   tokens and the user object, run the following **only in your private local
   Terminal**, without copying the output to chat or a saved/shared transcript:

   ```sh
   node scripts/test-real-auth.mjs --show-sensitive
   ```

   Raw-result output is explicitly opt-in and was not enabled in Codex's runs.
   Sessions stay in memory; no token is written to disk or browser storage.

6. Test the complete bridge automatically:

   ```sh
   node scripts/test-e2e-auth.mjs
   ```

   Expected: `E2E_AUTH_PASS`, `loginStatus: 200`, `meStatus: 200`, and the account's
   database role/settings. This starts a temporary loopback server on an unused
   port using the same HTTP app/adapter as `start-staging.mjs`, POSTs to
   `/api/staging-login` with the correct Origin, validates the token format, and
   GETs `/api/me` with that bearer. It verifies real Auth, allowlist/role resolution
   and runtime settings. It closes its listener and removes its temporary private
   directory even on failure; it does not restart your existing port-4199 server.
   It requires all three Supabase configuration values, but does not call privileged
   scan RPCs, apply SQL, seed users, change switches or issue workflow commands.

7. Restart your usual `start-staging.mjs` process after code/environment changes
   if you also want to retry the browser. A running process keeps its old code
   and environment. No browser interaction is required for steps 3, 5 or 6.
   Keep managed workflow gates OFF throughout these Auth tests. The E2E script
   reports switch values but never enables or disables them.

Run real-network scripts in a normal Terminal. **Do not run them through
`pnpm test` or `sandbox-exec -f scripts/test-network.sb`**, which intentionally
block internet. Live Auth success creates ordinary Auth sessions as part of
sign-in, but these scripts perform no application-database/workflow writes.
Each invocation attempts at most one password sign-in; there is no retry loop.

### Error interpretation

| Observed error | Meaning and next step |
| --- | --- |
| `ENOTFOUND` / `EAI_AGAIN` | DNS lookup failed. Compare exact Project URL, project availability, DNS and VPN. |
| `CERT_*`, `SELF_SIGNED_*`, `UNABLE_TO_VERIFY_*` | TLS trust failure. Check Mac clock and trusted corporate/VPN CA chain; retain certificate verification. |
| `UND_ERR_CONNECT_TIMEOUT`, `ETIMEDOUT`, `TimeoutError` | Connect/request deadline. Check VPN/firewall, routing, IPv4/IPv6 and project availability. A longer outer deadline cannot fix DNS. |
| `EPERM`, `EACCES` | Execution sandbox/firewall denied networking. Use the real scripts outside the offline test sandbox. |
| `invalid_credentials` | Auth reached; check the existing synthetic account/password and project. Do not rerun SQL. |
| `email_not_confirmed` | Auth reached; confirm that synthetic user through the no-email admin route. |
| HTTP 429 | Stop retries and wait for the Auth rate limit to clear. |
| Direct Auth passes, E2E says `UNAVAILABLE` | Check confirmed identity and staging allowlist in the intended project. No client metadata staff override is supported. |
| E2E says `STAGING_RPC_FAILED` | Read the server's sanitized diagnostics; check deployed functions, grants and PostgREST cache separately from Auth. |
| Missing `STAGING_AUTH_TEST_EMAIL` / password | Add the private test inputs locally; the script does not guess credentials. |

### Offline regression of the new scripts

Both scripts support `--mock`. This uses dummy credentials and injected SDK
responses, never loads `.env`, and never contacts Supabase:

```sh
node scripts/test-real-auth.mjs --mock
node scripts/test-e2e-auth.mjs --mock
```

`pnpm test` additionally exercises these functions under its existing OS and
JavaScript network guards. Mock success demonstrates script/bridge behavior,
not managed-project success. See `AUTH-NETWORK-DEBUG-REPORT.md` and its
`auth-debug-evidence/` directory for the current run and preservation hashes.


### Confirmed E2E error: permission denied for schema public

The live RPC diagnostic returned PostgreSQL code `42501` with
`permission denied for schema public`. Direct Auth succeeds, but this denial
prevents calling `translation_session_context`. It is not an allowlist diagnosis
or a missing function. The original migration depended on existing schema USAGE;
local harnesses had supplied it in advance. The migration and export script now
include the explicit grant for new staging installs.

For the **existing** staging project, open **Dashboard → SQL Editor → New query**,
select `postgres`/database owner, and paste the complete file
`supabase/repairs/20261115_translation_schema_usage.sql`, or run:

```sql
BEGIN;
GRANT USAGE ON SCHEMA public TO authenticated,service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
```

This gives schema name resolution for the existing narrowly granted RPCs.
It does not give CREATE, direct table access, new function EXECUTE privileges,
RLS bypass to authenticated users, staff membership or enabled switches.
Do not rerun the full migration, drop objects, or grant ALL as a workaround.
`NOTIFY` by itself only refreshes the cache; it cannot grant permissions.

Optionally verify the grant as owner:

```sql
SELECT has_schema_privilege('authenticated','public','usage') AS user_usage,
       has_schema_privilege('service_role','public','usage') AS scanner_usage;
```

Expect both true, then run `node scripts/test-e2e-auth.mjs` locally. Codex has
prepared and verified this repair only in disposable PostgreSQL; the managed
project still needs the owner SQL step and a fresh live E2E result. If it then
returns `UNAVAILABLE`, compare the actual synthetic staff Auth UUID with managed
`translation_staging_accounts` and `translation_staff` memberships; do not infer
UUIDs from the unchanged seed template's NULL placeholder.

## Instant Pricing V3 — latest staging feature

The Node staging launcher now serves the Instant V3 quote/workspace interface.
Before using it against managed Supabase, apply only the new
`supabase/migrations/202611150003_instant_pricing.sql` after the existing schema
and owner seed. Follow [INSTANT-PRICING-V3.md](INSTANT-PRICING-V3.md) for exact owner
SQL Editor steps, private exchange-rate configuration, synthetic mock workflow,
known storage limits and final OFF checks. The migration has been tested locally
against the exported Supabase-role schema but has not been applied to cloud by
Codex. The previous 197 tests remain intact; final suite is 208/208.

For a completely local preview, use
`node server/block1/start-instant.mjs --enable-local-test` and its fresh printed
synthetic sign-in links. No cloud credentials, rates, real scanner, real money or
email are used by that preview. Its workspace is `/instant-quote.html` on loopback
port 4197. Stop it with Ctrl-C to force its local gates OFF.
