# Marocora — Supabase Legacy Service Credential Retirement

Date: 19 November 2026, Africa/Casablanca.
Status: owner reports the replacement secret is saved privately. Modern-key
browser/server/Edge updates are prepared locally; **not deployed or revoked**.
Project: `zonojgzczpzmcfaekuml`.

Follow-up: the owner completed the credential-creation handoff without sending
the value. Use `SUPABASE-MODERN-KEYS-ROLLOUT-20261119.md` and the newer
`HANDOFF-SUPABASE-KEY-MIGRATION-20261119.md` for the prepared implementation and
remaining deployment gates. Historical observations below remain unchanged.

## Observed without revealing credentials

The authenticated API Keys page has publishable and secret key sections, each
with a default entry, and a `New secret key` control. No value was revealed,
copied, read from an input or tested against an API.

The legacy page offers `Disable JWT-based API keys`, establishing that legacy
API keys are currently enabled. The signing-key history lists an ECC (P-256)
entry and a previous HS256 (Shared Secret) entry. The previous entry's menu offers
`Revoke key`. No signing-key action was selected. The menu tab was closed after
inspection, and the modern API Keys page is left available for owner handoff.

These metadata observations do **not** prove that the exact exposed service-role
credential has been revoked or replaced. Its secret value was not compared or
submitted for testing. Treat its retirement as unconfirmed.

The owner explicitly confirms that the exposed LiveKit secret was replaced and
its old key deleted. Do not repeat that completed rotation.

## Required owner-only credential step

Browser policy requires owner handoff for changing authentication credentials;
`AGENTS.md` also prohibits the agent from handling new secret values.

1. Open [API Keys](https://supabase.com/dashboard/project/zonojgzczpzmcfaekuml/settings/api-keys).
2. Choose **New secret key** and use a descriptive name, e.g.
   `marocora-production-20261119`.
3. Generate it and save it privately in the owner's password manager. Do not
   share the value in chat, screenshots, shell arguments or source control.
4. Report only **saved**. Generation adds a replacement but does not revoke the
   compromised legacy credential.

Do not click `Disable JWT-based API keys` or revoke the previous signing key
before dependent clients have a coordinated replacement, unless the owner
explicitly chooses immediate containment with service disruption. The exposed
credential remains a risk until retirement is completed; generating another key
alone is not remediation.

## Coordinated rollout that must follow

The legacy disable control affects both `anon` and `service_role`. Supabase's
compromised-key guide additionally requires revoking the legacy JWT secret after
a legacy service-role exposure. A new secret API key is the backend replacement;
publishable API keys replace legacy anonymous API keys in public clients.

Review findings from source code, without opening environment files:

- `server/block1/supabase-database.mjs` and `server/production/supabase.mjs` use
  the configured anonymous/service values with `@supabase/supabase-js`. Variable
  names alone do not establish the type of the currently deployed value.
- `supabase/functions/service-intake/index.ts` and
  `supabase/functions/vendor-workflow/index.ts` read the platform-provided
  `SUPABASE_SERVICE_ROLE_KEY`. Their dependent RPC paths must be migrated and
  tested before legacy keys are disabled; changing only the Droplet is not enough.
- Public learning and form clients must be inventoried for legacy anonymous
  configuration. Do not read or print existing key literals while doing so.
- Raw request adapters in `server/service-intake.mjs` and
  `server/vendor-workflow.mjs`, and the Edge Function gateway configuration, need
  compatibility verification against the documented modern API key behavior.
  Do not turn off gateway verification or application authentication as a shortcut.

Before retirement: prepare/test necessary source changes locally; owner enters
replacement credentials privately; verify authorized backend operations, normal
sign-in and public forms with the replacement configuration. A production
deployment/runtime environment reload may be necessary. The standing prohibition
on PM2 restart and active-release edits remains in effect until explicitly
authorized for this credential rollout. No such deployment occurred here.

Then the owner performs the reviewed legacy-key deactivation and legacy-secret
revocation in the provider dashboard. Confirm the disabled/revoked status using
metadata, then verify production behavior. Revoking old signing trust can affect
sessions that still depend on it; coordinate that transition. Do not re-enable
the exposed credential as rollback. Stop and repair missed clients instead.

## Official guidance reviewed

- [Rotate a leaked or compromised API key](https://supabase.com/docs/guides/security/rotate-leaked-api-keys).
- [Migrating to publishable and secret API keys](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys).
- [JWT Signing Keys](https://supabase.com/docs/guides/auth/signing-keys).

This plan does not claim a completed rotation, verified old-key rejection,
incident audit or absence of unauthorized access. No production SQL, PM2 command,
database connection, migration, feature-gate change, commit or push was performed.
The learning bootstrap remains pending until the credential incident is resolved.
