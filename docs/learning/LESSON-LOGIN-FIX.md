# Marocora — Local Lesson Login Fix

16 November 2026. Completed locally; no `.env` read, actual LiveKit key used,
managed database change, provider request or deployment.

## Finding and change

`site-language.mjs` already preserves the fragment when adding `lang`. The old
`learning-room.mjs` intentionally read the local ticket, immediately removed it
with `history.replaceState`, and then posted it to the login API. Its disappearance
alone did not prove the ticket was lost: it had already been captured. However,
removal happened before login acknowledgement, Join was enabled during the
exchange, and failed login could be followed by requests using an older cookie.

The new `learn/lesson-login.mjs` captures the full URL once and retains the
fragment as requested. It posts the ticket to `/api/local/learning-login` and
makes Join await that exchange. The page starts with Join disabled, enabling it
only after login and authenticated room configuration succeed. Errors keep it
disabled and show a fresh-link recovery message. LiveKit participant JWTs still
come separately from the authorized room-token endpoint; local tickets are not
passed to LiveKit or added to booking/grant request fields.

Because the fragment is retained, reloads now retry login safely: the server
accepts a consumed ticket only when the caller already holds its original
unexpired HttpOnly cookie. It stores a ticket hash with the session. Another
cookie, missing cookie, expired session or malformed ticket fails closed. This
does not make sign-in links reusable by another browser profile. No ticket/JWT
is written to localStorage/sessionStorage or application logs.

The reported `ROOM_NOT_AVAILABLE` still means booking authorization denied the
current account. Its exact cause in the owner's running browser was not observed.
Opening `otherStudent` in the same cookie store can replace the authorized
account, and booking IDs from a prior server instance are stale. The regression
proves an outsider remains denied; authorization was not weakened.

## Owner retry

Stop the old process with Ctrl-C, then from the existing checkout run:

```sh
LEARNING_VIDEO_ENABLED=true LEARNING_VIDEO_MODE=live pnpm run learning:video:live
```

Open the **new student link** exactly as printed. Use a separate browser profile
or one normal/one private context for the new teacher link. Avoid the
`otherStudent` link in either authorized profile. Wait for “Local lesson account
ready” before joining. `&lang=en#<ticket>` is valid; do not remove or manually
reconstruct the booking reference/hash. Keep sign-in links private. No SQL or
additional URL gate parameter is required.

## Verification and handoff

- `pnpm test`: **235 passed, 0 failed/skipped/cancelled**. Four added regressions
  cover delayed authentication, fragment/query preservation, failed login
  blocking joins, cookie-only entry, real HTTP redemption/reload/replay rejection,
  authorized room token/connect and outsider denial. All prior 231 tests and
  42 preexisting test source/fixture files are unchanged by SHA-256 comparison.
- Existing OS/JavaScript internet-denial guards remained active; ordinary
  workers attempted zero outbound connections. The new real HTTP test uses only
  the isolated mock launcher and synthetic accounts.
- Browser verified `lang=en` plus the retained fragment, authorized student mock
  join/leave, reload and rejoin. No camera/microphone access or cloud calls.
- `pnpm run build:pages` passed. Evidence and browser screenshot are under
  `lesson-login-evidence/`. The temporary browser tab/server were stopped.

Current checkout:
`/Users/tareqnaser/Documents/ChatGPT/Marocora Site building/output/marocora-quote-workflow-local`.
Branch `codex/marocora-quote-workflow-local`. Main changed files:
`learning-room.html`, `learning-room.mjs`, `learn/lesson-login.mjs`,
`server/learning-room-http.mjs`, `tests/lesson-login.test.mjs`.
No dependency changes, commit or push. Next step remains the owner's first
two-party live call using private keys, with the setup guide's existing gates.

Fresh-chat starter, if useful after retry:

> Continue **Marocora — First LiveKit Staging Call**. Read
> `docs/learning/LIVEKIT-LIVE-SETUP.md` and `docs/learning/LESSON-LOGIN-FIX.md`.
> Live SDKs are implemented; local ticket fragments are retained, Join awaits
> authentication and same-session reloads work. 235/235 tests pass, all prior
> 231 unchanged; mock browser join/reload/rejoin and static build passed. Help
> verify my real two-party call without reading or printing private credentials.
