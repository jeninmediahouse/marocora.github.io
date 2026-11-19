# Marocora — Supabase Key Migration Preparation Handoff

Date: 19 November 2026, Africa/Casablanca.
Status: **local preparation complete; production retirement NOT complete**.

## Current authorization and security state

The owner reports that the new Supabase secret is saved privately and asks for
browser, server and Edge Function updates before retiring the exposed credential.
The value has not been requested, received, read or embedded. LiveKit's old key
was already deleted according to the owner. Do not repeat that rotation.

Read root `AGENTS.md`, the prior execution handoff and the key-rotation plan.
This work is local/read-only with respect to production. No browser or native
editor was opened in this preparation stage. No environment file, provider key
value or PM2 dump was read. Only configuration structure, redacted public-source
classification and synthetic fixtures were inspected.

No credential was disabled/revoked, no production SQL was executed, no Edge
Function was deployed, and no Droplet or PM2 operation occurred. Payments,
bookings, video, RLS, migration 004, page allowlist and four-language homepage
remain unchanged. No commit or push was authorized or performed.

## Prepared code

- `server/supabase-api-keys.mjs`: shared Node/Deno key selection and HTTP header
  helpers. Modern explicit settings take precedence; partial modern settings
  fail closed. A modern-only cutover flag rejects legacy-only environments.
- `server/block1/supabase-database.mjs`: accepts the modern pair through the
  existing production/staging adapter interface.
- `server/block1/network-diagnostics.mjs`: removes SDK-generated API-key Bearer
  headers only when exactly equal to an opaque API key; keeps real user JWTs,
  remote-origin guard, redirect policy, timeouts and redaction.
- `server/service-intake.mjs`, `server/vendor-workflow.mjs`: privileged REST
  calls use modern keys in `apikey` only; caller-scoped RPCs still use the
  verified user token. Opaque API keys cannot substitute for a user session.
- Both `supabase/functions/*/index.ts` entrypoints select the named modern
  secret with no legacy/default fallback. No gateway guard was disabled.
- `learn/supabase-public.mjs`, `learn/instructor-store.mjs`,
  `service-verification.mjs`, `vendor-client.mjs`: public-only config validation,
  unchanged signed-in user identity and modern SDK header handling. The browser
  already used a publishable key; that existing value was not printed or changed.
- `scripts/auth-test-support.mjs`: modern configuration and error redaction for
  owner-run diagnostics. No real-auth command was executed here.
- `scripts/test-local.mjs`: additionally excludes the new Edge private-variable
  namespace from the local test process; existing network guards stay enabled.
- `scripts/check-supabase-modern-keys.mjs`: owner-run, read-only readiness and
  anonymous Edge rejection canary. It does not load dotenv files itself, write
  data, create accounts, send email, scan files, start PM2 or prove active-runtime
  credential adoption. Tested with synthetic responses only.
- `tests/supabase-key-migration.test.mjs`: eight new behavior tests, including
  real Edge entrypoint imports with a mocked Deno environment, SDK wire headers,
  fail-closed configuration, public/private separation and staff/Auth refusal.

## Verification

- `pnpm run build:production`: **passed** (pages plus learning-room browser build).
- Full `pnpm test` with existing OS/JavaScript network guards: **281 passed,
  0 failed, 0 skipped**, including eight new tests. External connections remain
  prohibited. The final log is local temporary evidence, not a release input.
- Browser artifact scan: **zero secret-key literals** found. Key values were not
  printed. No private environment values or new secrets were part of the build.
- `git diff --check`: passed.
- No actual Deno deployment/typecheck, Supabase gateway call, provider canary,
  production sign-in or active-PM2 configuration verification was performed.
  Local Node entrypoint tests do not replace those production checks.

## Deployment gates and next actions

Use `docs/deployment/SUPABASE-MODERN-KEYS-ROLLOUT-20261119.md` for exact settings,
owner-run command examples and stop conditions. Principal gates:

1. Review/publish the scoped change and require green CI for its new commit.
2. Owner privately supplies `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`
   and `SUPABASE_REQUIRE_MODERN_KEYS=true` for the Droplet candidate.
3. Edge selects the key named `marocora-production-20261119` from
   `SUPABASE_SECRET_KEYS`, or the owner supplies the exact name/explicit private
   override. Missing selection fails startup; never guess an arbitrary key.
4. Deploy browser bundles and both Edge Functions with existing gateway/user
   authorization intact. Do not use `--no-verify-jwt` or `verify_jwt=false`.
5. Obtain explicit authorization for the necessary controlled server runtime
   update; the no-PM2-restart and no-active-release-edit instruction still applies.
   Pulling the retained checkout alone does not update a running release.
6. Verify candidate credentials, active runtime and signed-in role-restricted
   flows. The anonymous canary alone is insufficient. Stop on gateway signing
   incompatibility rather than disabling authentication.
7. Only after replacements are verified, owner disables legacy API keys and
   revokes the compromised legacy signing secret using the reviewed procedure.
   Never re-enable the exposed credential as rollback.

The legacy key remains a risk until retirement is actually completed; creation
of a new secret does not revoke it. A decision for immediate containment with
downtime requires explicit owner direction. No attack activity was investigated
or ruled out during this source preparation.

## Other project work preserved

Base published commit remains `49523d31110292590f61f433e94193928ad9b2cb` on `main`.
The earlier CI run was green with the accepted optional cloudflared skip. It
does not verify this uncommitted candidate. After publication, the new CI total
should be 281, with the same optional skip possible; report actual numbers.

Existing owner edits to `package.json` and the execution runbook, and untracked
bootstrap/preflight/proof/AGENTS/earlier handoff files were preserved. They were
not staged, committed, overwritten or folded into a release automatically.

The learning bootstrap remains unapplied. Its physical-backup restore path was
previously verified at **19 Nov 2026 03:45:36 UTC** in the correct Supabase project;
refresh recovery/preflight evidence when that separate SQL stage resumes. No
fresh backup or SQL check occurred in this code-preparation stage.

Cloudmersive replacement and Authorize.net approval remain pending per the last
known owner/support state; no provider status was rechecked.

## Ready-to-use next-task prompt

> Marocora — Review and Deploy Modern Supabase Key Migration. Read AGENTS.md,
> HANDOFF-SUPABASE-KEY-MIGRATION-20261119.md and the modern-key rollout checklist.
> The owner saved a replacement privately. Code/builds are prepared locally and
> all 281 tests pass with network guards; nothing is committed or deployed.
> Preserve unrelated bootstrap work. Review the scoped changes and obtain the
> specific publish/runtime authorization needed; never read or request secrets.
> Keep gateway verification, Auth/RLS and payment/booking/video restrictions.
> Migrate browser/server/Edge consumers and verify real signed-in flows before
> owner-only legacy deactivation/signing-secret revocation. Do not restart PM2,
> edit active releases or apply the pending learning bootstrap without separate
> explicit authorization. Do not repeat completed LiveKit rotation.
