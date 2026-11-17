# Marocora — ngrok Redirect-Safe Login Tickets

17 November 2026, Africa/Casablanca. Owner reported the ngrok Visit Site page
losing the fragment on the second laptop. That live behavior was not accessed
during this fix; local verification uses synthetic redirects and accounts.

The command is unchanged:

```sh
pnpm run test:lan
```

Stop the old process first and use the newly printed Student/Teacher links:

```text
https://<assigned-domain>/learning-room.html?bookingId=<booking-id>&ticket=<ticket>
```

Public tunnel links now carry the local login ticket in the query, not the
fragment. `createLessonLogin` reads query tickets first and retains support for
old fragment-only links. It refuses malformed, duplicate or conflicting query
tickets, exchanges exactly once with the login API and makes Join await success.
The UI removes only the matching query ticket after acknowledgement, preserving
the current booking, language, unrelated parameters and legacy fragment. A
failed exchange keeps the URL and Join stays disabled. Reload without a ticket
continues using the authenticated HttpOnly session cookie.

This does not suppress ngrok's initial browser notice. App code cannot set a
custom header on a top-level navigation before it loads. An upstream Host rewrite
is unrelated to the interstitial, and arbitrary forwarded-header trust was not
added. Click Visit Site if shown; query-preserving redirects retain the new
ticket format. See ngrok's
[warning documentation](https://github.com/ngrok/ngrok-docs/blob/main/pricing-limits/free-plan-limits.mdx).

Query tickets reach the provider/initial HTTP request; they are removed after
login, not copied into storage or room grants. Keep printed sign-in links private.
Existing no-referrer/no-store policies, disabled ngrok inspector, Secure/HttpOnly
cookies, original-session ticket reload checks and booking/tenant authorization
remain intact. The local ticket is not a LiveKit participant JWT.

Verification: **249 passed, 0 failed/skipped/cancelled**. All prior 245 test cases
remain present and pass; two test sources were updated for the intentional new
public-link format and acknowledgement-only cleanup. Four added tests cover
delayed query exchange and cleanup, failed exchange, ambiguity/legacy behavior,
and an actual loopback HTTP 302 followed by login. The existing HTTPS Host test
now extracts the printed query ticket and performs its real local API exchange.

Browser review used a synthetic query link on the isolated mock launcher:
account-ready appeared, the query ticket disappeared only after login, and Join
connected as student. No devices, actual ngrok endpoint or LiveKit cloud calls
were used. `pnpm run build:pages` and `git diff --check` passed. Evidence, screenshot,
test output, preservation hashes and verification JSON are in
`ticket-query-evidence/`. The temporary tab/server were stopped afterward.

No `.env` read, private key used, DB switch changed, commit, push or deployment.
Main changes: `learn/lesson-login.mjs`, `learning-room.mjs`, public link generation
in `server/learning-room-http.mjs`, two existing regression assertions and
`tests/lesson-query-login.test.mjs`.

## Handoff — Marocora — Two-Laptop ngrok Ticket Verification

Checkout:
`/Users/tareqnaser/Documents/ChatGPT/Marocora Site building/output/marocora-quote-workflow-local`.
Branch `codex/marocora-quote-workflow-local`. Owner has verified prior real SDK
media and the combined server/tunnel command. Next action is owner retrying the
new query-based links through the actual Visit Site page on two laptops. Do not
repeat prior SDK, gate, wildcard-bind or tunnel-automation implementation.
This completed fix is a suitable fresh-chat milestone if another stage follows.

Starter prompt:

> Continue **Marocora — Two-Laptop ngrok Ticket Verification**. Read
> `docs/learning/LIVEKIT-LIVE-SETUP.md` and `NGROK-TICKET-QUERY-FIX.md` in that
> directory. `pnpm run test:lan` prints HTTPS links with `&ticket=...`; the UI
> exchanges the ticket before Join and cleans it from the URL only after login.
> 249/249 local tests and mock browser login/join pass. Help verify my actual
> second-laptop Visit Site flow without reading or printing private credentials.
