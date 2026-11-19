# Marocora — Modern Supabase Key Rollout

Status: **prepared locally; not committed, deployed or used to revoke any key**.
Project: `zonojgzczpzmcfaekuml`. Owner reports the new production secret is saved
privately. The agent has not received or read it. LiveKit replacement is already
complete according to the owner; do not repeat it.

## Resulting behavior

The browser was already using a modern publishable key. Its existing value was
neither printed nor changed. New browser guards reject secret or legacy keys,
and Edge requests continue carrying the signed-in user's access token. SDK
requests omit only a redundant opaque publishable key in the Bearer header;
actual user session JWTs remain intact. The four language versions, homepage,
page allowlist and protected workspace/lesson routing are unchanged.

The server accepts the modern configuration below in preference to stale legacy
variables. Any partially supplied modern pair fails closed. Setting
`SUPABASE_REQUIRE_MODERN_KEYS` to `true` makes modern credentials mandatory.
Temporary legacy compatibility exists only when no modern configuration is
supplied and that flag is absent; never use it after the cutover.

Opaque API keys travel in `apikey`. The transport removes an SDK-generated
Bearer header only when it exactly repeats that opaque key. User-authenticated
RPCs retain their real JWT; admin RPCs use the server API key, with the existing
verified-user checks and caller arguments unchanged. No SQL or grants change.

Edge Functions select the explicitly named modern secret, or an explicit private
override. They never fall back to `SUPABASE_SERVICE_ROLE_KEY`. Existing origin,
Auth `/user`, email-verification, staff, idempotency and RPC authorization remain.
API-key-only callers and opaque API keys used as user Bearer tokens are rejected.

## Gate 1 — Review, publish and CI

Review only this change set; preserve the existing uncommitted learning-bootstrap
and documentation work. Do not stage credentials or generated artifacts. Commit
and push require separate authorization; neither has happened in this stage.

Production builds and the local guarded suite pass: **281 passed, 0 failed,
0 skipped** (273 existing plus eight new tests). After publication, require green
CI for the new commit. The known optional `cloudflared` skip may yield 280 passed,
0 failed, 1 skipped out of 281; record the actual result. Do not weaken it.

## Gate 2 — Private configuration, owner only

No key values belong in this document, shell arguments, chat, screenshots or
source control. The owner enters them through private runtime/secret settings.

| Runtime | Setting | Purpose |
| --- | --- | --- |
| Droplet | `SUPABASE_URL` | Existing project URL; keep the correct project |
| Droplet | `SUPABASE_PUBLISHABLE_KEY` | Existing browser publishable key from the same project |
| Droplet | `SUPABASE_SECRET_KEY` | Newly created, privately saved production secret |
| Droplet | `SUPABASE_REQUIRE_MODERN_KEYS` | Set to `true` for cutover and keep it true |
| Edge | `MAROCORA_SUPABASE_SECRET_KEY_NAME` | Exact non-secret key name in the platform's JSON map; defaults to `marocora-production-20261119` |
| Edge | `SUPABASE_SECRET_KEYS` | Supabase-provided JSON map, not a plain key string |
| Edge, optional | `MAROCORA_SUPABASE_SECRET_KEY` | Explicit private override if the platform map does not include the chosen key |

If the new secret has a different name, configure that exact name rather than
selecting an arbitrary/default entry. The named entry must actually contain the
intended replacement. A missing/malformed map or key stops Edge startup with a
fixed error that never includes values. The override takes precedence and must
also be modern; an invalid override never falls back.

Do not read the legacy platform variables to populate replacements. Do not
assume the automatic map includes every key until the owner confirms its
available names privately. The two Edge Functions must both receive this setup.

Existing browser publishable configuration needs no key replacement solely
because a server secret leaked. Deploy the newly built browser bundles so the
new validation and header behavior are in use. Never put the new secret in the
browser, including through a build-time variable.

## Gate 3 — Deploy a candidate without retiring legacy trust

This stage's standing restrictions prohibit PM2 restart and active-release edits.
**No running server can adopt an environment change merely because files were
pulled.** Obtain explicit authorization for a candidate release and controlled
runtime configuration/reload before claiming the Droplet is migrated. Keep the
current active release intact while preparing/reviewing the candidate.

For the authorized deployment stage, both Edge entrypoints include the new shared
module `server/supabase-api-keys.mjs`. Bundle/deploy from the reviewed repository
with the normal Supabase tooling or dashboard. Owner-run CLI deployment commands,
shown for review only (not run here):

```bash
supabase functions deploy service-intake --project-ref zonojgzczpzmcfaekuml
supabase functions deploy vendor-workflow --project-ref zonojgzczpzmcfaekuml
```

Use the owner's existing authenticated CLI setup; do not request tokens or put
them in arguments. Preserve the existing gateway JWT verification. Do **not**
deploy with `--no-verify-jwt`, set `verify_jwt=false`, or change RLS/auth policies.
The browser sends a real user JWT in addition to its publishable API key. If the
current gateway rejects that signing algorithm, stop for a separately reviewed
solution that retains authentication. No gateway/live compatibility result is
claimed by the local tests, and this restriction was not relaxed to match a
documentation example.

Legacy keys remain enabled until replacement deployment and verification are
complete, unless the owner explicitly chooses immediate containment with the
associated outage. Prepare that incident decision separately if active abuse is
suspected; do not silently leave a known compromised key enabled indefinitely.

## Gate 4 — Read-only credential canary and real-flow verification

The new `scripts/check-supabase-modern-keys.mjs` requires a modern pair even if
old variables exist. It calls only `production_runtime_status` and submits empty
anonymous requests to the two Edge Functions, requiring HTTP 401. No synthetic
production accounts, application records, email or scans are created.

After the owner has privately configured the reviewed retained checkout, this
root-console command can test the candidate configuration without starting PM2:

```bash
runuser -l marocora -s /bin/bash -c 'cd /srv/marocora/app && node --env-file=.env scripts/check-supabase-modern-keys.mjs'
```

Do not run it until the new script and private modern settings are present.
It suppresses response bodies and secrets and stops on any failure. This command
does not load settings into PM2 and does **not** prove the active application is
using the replacement. Verify that separately in the authorized release step.
Never print PM2 environments or dumps to do so.

The canary also does **not** prove successful authenticated Edge gateway behavior
or correct account authorization. Before deactivation, verify with existing
authorized accounts through normal UI flows:

- public pages in English, French, Arabic and Spanish still render;
- sign-in works and private workspaces/lessons remain protected;
- signed-in verified intake reaches its server-authorized receipt;
- vendor/staff permissions remain enforced; do not approve or publish fake data;
- unauthenticated requests remain denied and secrets do not appear in responses;
- currently operational backend scan/record paths use the replacement key, without
  relaxing malware scanning or any payment, booking or video restrictions.

The learning catalogue is a separate known missing-schema task. Its unresolved
RPC does not justify weakening authentication or enabling feature gates to get
this credential rollout through verification.

## Gate 5 — Retire the compromised legacy credential, owner only

Inventory other consumers first: Supabase Edge environments, browser bundles,
old deployments, CI, external integrations, scheduled jobs, webhooks and any
`pg_net`/Vault-based requests. Do not inspect or copy stored secret values.

After verifying replacements, the owner uses **Settings → API Keys → View legacy
API keys → Disable JWT-based API keys**. This disables the legacy pair, not just
`service_role`. Then use the reviewed JWT-key procedure to revoke the legacy
HS256 signing secret. Current ECC signing already exists according to the prior
metadata inspection; do not create/rotate an unrelated current signing key.
Old sessions depending on legacy signing trust may need to sign in again.

New-key creation alone is not revocation. Confirm dashboard disabled/revoked
metadata and repeat functional checks after retirement. Do not re-enable the
exposed key as rollback; fix missed consumers using the replacement. Any future
key deletion or signing change is an owner-controlled credential operation.

## Evidence and limitations

Eight new tests cover configuration precedence/fail-closed behavior, SDK wire
headers, public-only browser configuration, real Deno entrypoint wiring imported
with a synthetic environment, user authentication, service-vs-user RPC scopes and
the read-only canary. Existing tests/guards were retained. The local test runner
also excludes the new Edge-specific private environment-variable namespace.

Node tests do not substitute for a Deno deployment/typecheck or a real Supabase
gateway check. No real key was supplied, read or embedded; only clearly synthetic
test values were used. The canary was tested with injected local responses, not
executed against production. No production SQL, PM2, deployment, key disabling,
signing-key revocation, commit or push happened in this preparation stage.

References:
[key migration](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys),
[compromised-key retirement](https://supabase.com/docs/guides/security/rotate-leaked-api-keys).
