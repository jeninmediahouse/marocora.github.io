# Marocora — Cloudflare CLI Compatibility Fix

17 November 2026, Africa/Casablanca. **Confirmed cause:** the installed
cloudflared 2026.10.1 rejects `--logformat json`, used by the previous adapter.
Its exact help-mode output was:

```text
Incorrect Usage. flag provided but not defined: -logformat
```

The installed CLI supports `--output json`. The adapter now uses that flag.
The exact corrected argument list was accepted in offline `--help` mode, and
a real temporary Quick Tunnel subsequently started and registered successfully.

## Changes

- `server/cloudflare-tunnel.mjs` exports its canonical argument builder, uses
  `--output json`, and allows 60 seconds for startup.
- The adapter accepts URL and registration messages across stdout/stderr, split
  chunks, JSON/plaintext logs and stream tails without a final newline. JSON
  message/url values are decoded before extraction. It still waits for both the
  assigned trycloudflare HTTPS URL and a registered connection.
- The existing orchestrator registers that exact public origin before printing
  login links; no wildcard public Host or forwarded-header trust was added.
  Existing real loopback Host/Origin authorization tests remain green.
- Early exits wait for stream completion and preserve exit code/signal plus a
  safe classified diagnostic. The launcher prints CLOUDFLARE_DETAIL with an
  allowlisted category, never raw provider stderr or credentials. Timeout and
  Ctrl-C still close the owned agent/server.

Owner command, after stopping the previous test:

```sh
LEARNING_TUNNEL_PROVIDER=cloudflare pnpm run test:lan
```

Use the newly printed student/teacher HTTPS query-ticket links. A second manual
cloudflared terminal is unnecessary. No private `.env` edit or SQL is required.

## Verification and limits

`pnpm test`: **255 passed, 0 failed/skipped/cancelled**. All prior 252 tests and
all preexisting test source/fixture files are unchanged. Three new tests check
the exact argument list against the installed binary (help only, no network),
split JSON/text/tail parsing with origin-before-links ordering, and safe exit
diagnostics. Hosts without the optional executable skip only the new local CLI
compatibility test. This Mac ran it successfully. Existing internet-denial
guards remain active throughout the suite. `git diff --check` passed.

A separate, explicitly network-enabled probe created a real Cloudflare Quick
Tunnel targeting an isolated in-memory learning server with video OFF. The
corrected agent assigned an HTTPS URL and reported a registered connection.
The subsequent public page fetch failed with **ENOTFOUND** from this Mac's
resolver for its assigned trycloudflare hostname, including bounded retries.
Therefore actual public page/login delivery was not verified. This DNS failure
is distinct from the corrected unsupported flag and is not HOST_DENIED.
Both temporary probes stopped their owned server and tunnel afterward.

The probe did not load `.env`, inspect project keys, call LiveKit, access devices,
or change database/firewall/DNS settings. No commit, push or deployment. Evidence
under `cloudflare-cli-evidence/` includes installed version, old/corrected CLI
help output, full test output, actual tunnel probe result, preservation hashes
and verification summary. Public DNS/HTTP delivery remains the owner check.

## Handoff — Marocora — Cloudflare Public DNS Verification

Checkout:
`/Users/tareqnaser/Documents/ChatGPT/Marocora Site building/output/marocora-quote-workflow-local`.
Branch `codex/marocora-quote-workflow-local`. Completed fix: compatible Cloudflare
CLI arguments and stronger parsing/diagnostics, with real agent registration.
Next task: owner retries the combined command and opens its fresh public role
links; if the browser also reports DNS failure, investigate resolver/network
filtering without repeating the SDK, ticket, gate or tunnel lifecycle work.
This is a completed code-fix milestone suitable for a fresh chat if needed.

Starter prompt:

> Continue **Marocora — Cloudflare Public DNS Verification**. Read
> `docs/learning/LIVEKIT-LIVE-SETUP.md` and `CLOUDFLARE-CLI-FIX.md` there.
> The adapter now uses installed-compatible `--output json`; a real temporary
> agent registered successfully. 255/255 tests pass, prior 252 unchanged. A
> separate public HTTP probe hit ENOTFOUND for the assigned trycloudflare host.
> Help verify my fresh two-laptop links or diagnose DNS without reading keys or
> changing network settings without authorization.
