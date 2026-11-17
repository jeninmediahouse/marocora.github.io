# Marocora — LiveKit 401 Diagnostics

17 November 2026, Africa/Casablanca. The owner reported HTTP 401 on
`/settings/regions`. No actual owner credentials or project were accessed here;
the specific live rejection is not yet diagnosed.

## Implemented

Set `LEARNING_VIDEO_DEBUG=true` for an explicit diagnostic run. The room-token
adapter uses official `AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)` from the
server's captured startup configuration. After signing, debug mode verifies the
JWT with official TokenVerifier and logs `LIVEKIT_TOKEN_DEBUG` containing decoded
claims (including iss/nbf/exp), canonical configured WSS URL, current server time,
ISO timestamps, TTL and signature/issuer/time checks. Only then does the
authorized endpoint return the token with `debug:true` and that same WSS URL.

The browser adapter passes those exact token/URL values to `room.connect` and
catches its ConnectionError. With debug enabled, it logs an expanded snapshot
under `LIVEKIT_CONNECTION_ERROR`, including normally non-enumerable Error
message/stack, SDK status/reason/code/context and nested cause. JWTs, Bearer
strings, credential fields and token URL parameters are redacted; bounded
snapshotting handles cycles and does not mutate the SDK error. No raw JWT or
API secret is logged. Normal leave/device/admission cleanup remains in place.
Debug is OFF by default and neither gate settings nor cloud permissions expand.

The installed livekit-client RegionUrlProvider sends the participant token as
`Authorization: Bearer ...` to its cloud regions endpoint and maps HTTP 401 to
`ConnectionError.notAllowed(...,401)`. This is distinct from local login tickets
or database authorization. See the official
[RegionUrlProvider source](https://github.com/livekit/client-sdk-js/blob/main/src/room/RegionUrlProvider.ts)
and [LiveKit token claims reference](https://docs.livekit.io/frontends/reference/tokens-grants/).

Key/secret/URL wiring was verified offline with synthetic keys. A local valid
signature proves the signer and verifier agree on the runtime pair; it does not
prove the owner selected the intended project or an active provider key. Stale
shell exports can override `.env`, and the configuration is captured at server
startup. Leading/trailing whitespace in key/secret is now rejected locally.

## Owner run

Stop the previous process, then:

```sh
env -u LIVEKIT_API_KEY -u LIVEKIT_API_SECRET -u LIVEKIT_URL \
  LEARNING_VIDEO_DEBUG=true LEARNING_TUNNEL_PROVIDER=cloudflare pnpm run test:lan
```

Open fresh Student/Teacher links and Join. Privately inspect the two diagnostic
records. Compare issuer/API key and WSS URL within the same dashboard project;
check server UTC time against a reliable clock, with nbf already valid and exp
still future. A token remains valid for at most 120 seconds for initial joining.
Do not paste the API secret or raw token into a report. The `env -u` names affect
only this process and make Node load these values from `.env` instead of existing
exports. [Node precedence documentation](https://nodejs.org/api/cli.html#--env-filefile).
Disable debug afterward. No keys need to be supplied in chat.

## Verification

`pnpm test`: **258 passed, 0 failed/skipped/cancelled**; all prior 255 tests and
preexisting test source/fixture files remain intact. Three added regressions
verify runtime issuer/timestamps/signature/URL/debug opt-in, rejection with wrong
key/secret or credential whitespace, full error-field snapshot/redaction, and
a simulated SDK 401 with original token/URL arguments and failure cleanup.

`pnpm run build:learning-room`, `pnpm run build:pages` and `git diff --check`
passed. Tests ran with unchanged OS/JavaScript internet-denial guards and dummy
credentials. Evidence is in `livekit-auth-evidence/`. No real `.env` read,
LiveKit/tunnel call, device access, DB switch change, commit, push or deployment
was performed. The live 401 still requires the owner's new diagnostic output.

## Handoff — Marocora — LiveKit 401 Claim Verification

Checkout:
`/Users/tareqnaser/Documents/ChatGPT/Marocora Site building/output/marocora-quote-workflow-local`.
Branch `codex/marocora-quote-workflow-local`. Main artifacts:
`server/livekit-adapter.mjs`, `server/live-learning-room.mjs`,
`learn/livekit-diagnostics.mjs`, `learn/live-learning-room.mjs`, `.env.example`,
`tests/livekit-auth-diagnostics.test.mjs` and this report. Next step is the
owner's diagnostic run. Prior Cloudflare CLI fix is complete; do not repeat it.
This is a suitable fresh-chat handoff after the owner captures the results.

Starter prompt:

> Continue **Marocora — LiveKit 401 Claim Verification**. Read
> `docs/learning/LIVEKIT-AUTH-DIAGNOSTICS.md` and `LIVEKIT-LIVE-SETUP.md` there.
> Diagnostics are implemented and 258/258 tests pass, prior 255 unchanged. Help
> interpret my LIVEKIT_TOKEN_DEBUG claims/times/URL and redacted
> LIVEKIT_CONNECTION_ERROR. Code signs and verifies with the server runtime pair;
> the actual project's 401 remains unconfirmed. Do not request or print secrets,
> and do not repeat SDK, ticket, tunnel or CLI implementation work.
