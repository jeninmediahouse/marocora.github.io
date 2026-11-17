# Marocora — LiveKit Tunnel Automation

17 November 2026, Africa/Casablanca. One-command developer test is implemented:

```sh
pnpm run test:lan
```

Alias: `pnpm run learning:video:lan`. Explicit HTTP-only fallback:
`pnpm run test:lan --no-tunnel`. The main setup guide contains the owner steps
and prerequisites: existing private LiveKit values and an installed/configured
ngrok CLI. An executable is already present on this Mac; its private config was
not inspected. No extra package dependency or lockfile change was needed.

## Result

- The command bundles the client, loads the private `.env` at owner execution,
  opts this synthetic process into live video, and binds 0.0.0.0 automatically.
- It spawns one owned ngrok CLI process targeting the actual local server port,
  reads its assigned HTTPS URL from JSON output and prints full role links only
  after configuring that exact origin. Startup has a 20-second tunnel deadline.
- HTTPS Host and exact Origin validation, one-time login tickets, original-cookie
  reload checks and server-only LiveKit credentials are preserved. HTTPS login
  cookies include Secure. Arbitrary forwarded headers do not select origins.
- Ctrl-C/SIGTERM clean up the owned agent, HTTP listener, fixture and room service.
  Agent termination escalates from SIGTERM to SIGKILL after 1.5 seconds if needed.
  Tunnel startup failure stops the server without publishing login tickets;
  later agent exit stops the server too. Unrelated ngrok agents are untouched.
- No-tunnel mode detects a private local IPv4 address and uses it in role links,
  with an HTTPS/localhost warning. The ordinary wildcard live launcher retains
  its local role links and additionally prints detected LAN role links. With
  multiple interfaces, all accepted origins are printed for reference.
- The new combined command is an explicit live-test opt-in; normal live/mock
  gate behavior remains unchanged. No SQL or managed DB switches are modified.

The child receives a restricted runtime/ngrok environment, excluding LiveKit
keys. Its request inspector is disabled, raw provider output is not printed,
and errors expose safe symbolic codes only. An ngrok authtoken may be supplied
through its existing private config or NGROK_AUTHTOKEN at owner execution.
The script never dumps that token/config or queries another agent's inspector.

## Verification

Final `pnpm test`: **245 passed, 0 failed/skipped/cancelled**. All prior 238 tests
are unchanged. Seven added tests cover real loopback HTTP with a simulated HTTPS
Host, Secure cookies and Origin denial, agent JSON parsing/environment filtering,
timeout/missing binary cleanup, combined startup/cleanup, failed startup,
detected LAN fallback and Ctrl-C in a child process.

The first new test run hit the existing JavaScript guard because Node's wildcard
listener invokes numeric DNS lookup for 0.0.0.0. The in-process tests now use a
loopback listener while asserting the orchestrator requested wildcard binding;
wildcard listener tests run in subprocesses under the existing OS network guard.
No guard or preexisting test was changed. Actual outbound internet remains denied
throughout the test suite. The final run reported no unexpected outbound attempts.

`pnpm run build:learning-room` and `git diff --check` passed. Preservation hashes,
test/build output and verification summary are in `tunnel-evidence/`.
No real public tunnel was started, actual private `.env` read, LiveKit credential
used, cloud call made, firewall changed, deployment performed, commit or push
created during implementation. The actual provider/account/network path remains
for the owner's next run; success locally with simulated agents is not a claim
that a real tunnel was verified. Provider quotas/authentication/outages remain
external prerequisites.

## Handoff — Marocora — Two-Laptop LiveKit Test

Checkout:
`/Users/tareqnaser/Documents/ChatGPT/Marocora Site building/output/marocora-quote-workflow-local`.
Branch: `codex/marocora-quote-workflow-local`.
Main artifacts: `server/start-learning-lan.mjs`, `server/learning-video-lan.mjs`,
`server/ngrok-tunnel.mjs`, updated HTTP server/binding helper, package scripts,
`tests/learning-tunnel.test.mjs`, `LIVEKIT-LIVE-SETUP.md` and `tunnel-evidence/`.
The owner reports prior live media already worked; do not redo SDK integration.

Completed: V3, mock rooms, official SDKs, retained login tickets, explicit LAN
binding and one-command tunnel automation. Next task: owner runs `pnpm run
test:lan`, opens the new student/teacher HTTPS links on different laptops and
checks join/media/toggles/leave/Ctrl-C. No outstanding code decision blocks that
test. Public customer authentication/bookings and persistent metering remain
outside this synthetic developer launcher. This is a good fresh-chat milestone.

Starter prompt:

> Continue **Marocora — Two-Laptop LiveKit Test**. Read
> `docs/learning/LIVEKIT-LIVE-SETUP.md` and
> `docs/learning/TUNNEL-AUTOMATION-CLOSEOUT.md`. The one-command
> `pnpm run test:lan` launcher is complete: wildcard HTTP bind, owned ngrok HTTPS
> tunnel, dynamic role links, safe Origin checks and Ctrl-C cleanup. Local mocked
> verification is 245/245 tests, prior 238 unchanged. Help verify my two-laptop
> run without reading or printing keys. Do not repeat V3, SDK, login-ticket or
> wildcard-binding work. Production customer integration remains separate.
