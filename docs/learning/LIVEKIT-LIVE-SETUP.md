# Marocora — LiveKit Live Integration

**VIDEO INTEGRATION VERIFIED AND COMPLETE — 17 November 2026.**

Owner-confirmed live test: **Mac = Teacher**, **Windows laptop = Student**, joined
across devices through the **Cloudflare HTTPS tunnel**. Room joins, live video,
audio and camera toggles all worked. This closes the Learning Service video
integration phase; no further first-call or 401 investigation is pending.
This evidence is the owner's successful test report, not a new cloud test run
by Codex during documentation closeout.

Final closeout `pnpm test`: **258 passed, 0 failed, 0 skipped/cancelled**. Existing
OS/JavaScript internet-denial guards remained active. Full output and the final
verification record are in `video-closeout-evidence/`.

The official SDKs remain pinned at `livekit-client@2.24.1` and
`livekit-server-sdk@2.19.3`. Production customer launch is a separate stage: the
local test launcher still uses synthetic accounts/bookings and temporary tunnels.
See [Marocora production handoff](../MAROCORA-PRODUCTION-HANDOFF.md) for payment,
private cloud storage, managed identity/booking and deployment work.

### macOS permission popup on smaller displays

Owner-reported UI issue during testing: the camera/microphone permission popup
can push its **Allow** button off-screen on a smaller display. This is recorded
as a permission-dialog/display issue, not a LiveKit connection failure or a
claimed application code fix. Use a larger display or temporarily more display
space, or review the browser's access under **System Settings → Privacy &
Security → Camera / Microphone**. Then reopen the browser/lesson as needed and
confirm the site's own camera/microphone permissions. Page zoom alone may not
change a native macOS dialog. This workaround does not remove permission checks. See Apple's
[privacy controls](https://support.apple.com/en-gb/guide/mac-help/mchl2b29231a/mac)
and [display-resolution settings](https://support.apple.com/en-gb/guide/mac-help/mchl86d72b76/27/mac/27)
for those settings; these references do not independently establish the reported
popup defect.

When testing is finished, Ctrl-C stops the test server/tunnel. Disable optional
`LEARNING_VIDEO_DEBUG` logging for ordinary use. This closeout changes no keys,
managed database switches, payment settings or deployment state.

## One command for two laptops

From the checkout, run:

```sh
pnpm run test:lan
```

Prerequisites are the existing private LiveKit URL/key/secret in `.env`, pnpm
dependencies installed, and **cloudflared on PATH**. This Mac already has the
executable. The default now uses an accountless Cloudflare Quick Tunnel, so
ordinary browser navigation does not encounter ngrok's Visit Site screen.
No Cloudflare login, domain or token is needed for this developer tunnel.
[Quick Tunnel documentation](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).

To override an older private provider setting and force direct loading:

```sh
LEARNING_TUNNEL_PROVIDER=cloudflare pnpm run test:lan
```

The command builds the client adapter, loads `.env`, explicitly enables live
video for this test process, binds `0.0.0.0:4195`, starts its own cloudflared agent,
waits up to 60 seconds for its assigned HTTPS URL and registered connection, registers that exact public
origin with the API, and prints complete **Student** and **Teacher** HTTPS links.
No HOST setting, IP lookup, second terminal or URL editing is needed. The
equivalent alias is `pnpm run learning:video:lan`.

Open the student link on one laptop and the teacher link on the other. Keep the
entire booking query and `ticket` parameter. Wait for the account-ready message,
then Join and permit camera/microphone access. These are real LiveKit calls;
the command deliberately opts into live mode even if the ordinary `.env` gate
is false. The standalone live/mock launchers retain their existing OFF-default
discipline. This command only enables its isolated synthetic test process.

**Ctrl-C stops both the server and the tunnel process it started**, releases the
in-memory fixture and attempts to remove active LiveKit participants. It does
not stop another independently running tunnel agent. If tunnel startup fails,
the server is stopped and no sign-in links are printed. A subsequent tunnel
exit also stops the test server; rerun to obtain fresh links. Account limits,
network access and provider availability can still prevent tunnel creation.

For an intentional HTTP-only LAN fallback:

```sh
pnpm run test:lan --no-tunnel
```

This starts no tunnel, detects a local IPv4 address and prints the role links
using that address. It warns that LAN HTTP cannot capture camera/microphone;
HTTPS or localhost remains necessary. With multiple adapters, it prefers the
first private IPv4 address and prints all accepted origins; select the Wi-Fi
origin if another adapter is listed first. The ordinary `HOST=0.0.0.0` live
launcher also prints additional `student LAN:` / `teacher LAN:` links.
Set `PORT=4197` before either command if 4195 is occupied.

### Redirect-safe tickets and optional ngrok

The combined command now prints tunnel links in this format:

```text
https://<assigned-domain>/learning-room.html?bookingId=<booking-id>&ticket=<local-login-ticket>
```

The query parameter survives a redirect that preserves the path/query but loses
the fragment. The browser exchanges it with the local login API before enabling
Join, then removes **only `ticket`** from the current URL after acknowledgement.
The booking reference and selected language remain. This cleanup is expected:
the authenticated HttpOnly cookie now identifies the account. Failed exchanges
retain the query for retry and keep Join disabled. Existing fragment-only links
still work; ordinary local/mock links keep their previous format.

If you explicitly select ngrok with
`LEARNING_TUNNEL_PROVIDER=ngrok pnpm run test:lan`, its free-plan Visit Site page
may still appear. Click Visit Site and keep
the full query link. The app cannot attach a custom request header before its
initial HTML has loaded; adding `ngrok-skip-browser-warning` to later API fetches
does not change the initial navigation. `--host-header` changes upstream Host
handling and is not a warning-page bypass. We use redirect-safe ticket passing
rather than changing browser headers or weakening existing Host validation.
[ngrok warning documentation](https://github.com/ngrok/ngrok-docs/blob/main/pricing-limits/free-plan-limits.mdx).

Stop the previous server/tunnel and rerun `pnpm run test:lan` to get new links.
Query tickets are visible to the initial HTTP request/provider, so keep links
private. The server sends `Referrer-Policy: no-referrer` and `Cache-Control:
no-store`, does not log incoming URL tickets, and disables the inspector when using ngrok.
LiveKit participant JWTs remain separate and are never put in these links.

The HTTPS tunnel temporarily makes this synthetic test server publicly
reachable. Keep the printed sign-in links private and stop it after testing.
Only the existing static allowlist and authorized learning endpoints are served;
server files, `.env`, credentials and database files are not served. Exact Host
and same-origin checks remain active. The server accepts the assigned public
Host rather than trusting arbitrary `X-Forwarded-*` headers, and its HTTPS login
cookie has `Secure`, `HttpOnly` and `SameSite=Strict`.

The tunnel child receives a restricted runtime environment, without LiveKit
credentials. Default cloudflared uses `--config /dev/null` so the launcher does
not load a developer's named-tunnel configuration. It disables auto-update,
waits for a registered connection, and does not print raw agent logs. Optional
ngrok retains its own runtime/auth environment and `--inspect=false`. This is
a public synthetic test service: both providers terminate/proxy the tunnel's
traffic. No production deployment is implied.

A plain GET/HEAD or link preview does not redeem a ticket. Redemption requires
the explicit same-origin JSON login POST. Local regression tests prove repeated
page requests leave the ticket valid and that live mode stays live; there is
no automatic switch to the mock transport after a login error. The initial
HTML's mock placeholder on a failed login is not evidence that mock mode ran.

### Cloudflare CLI startup troubleshooting

The launcher uses `--output json`, supported by this Mac's cloudflared
2026.10.1. The earlier `--logformat json` caused “flag provided but not defined”
and has been removed. Both stdout/stderr, JSON/plaintext and final partial lines
are parsed; links print only after URL assignment and connection registration,
with the exact public origin already registered in the API allowlist.

`CLOUDFLARE_AGENT_EXITED` now includes a safe `CLOUDFLARE_DETAIL` record with exit
code/signal and a diagnostic category such as UNSUPPORTED_CLI_FLAG, DNS_FAILED,
TLS_CERTIFICATE_FAILED or NETWORK_TIMEOUT. Raw provider logs/credentials are not
printed. `CLOUDFLARE_TUNNEL_TIMEOUT` means no complete startup within 60 seconds.
Do not run a second manual agent for this command; stop the previous test and
use fresh generated links.

The corrected CLI was verified offline against the installed executable and
also opened/registered a real temporary Cloudflare Quick Tunnel with synthetic
accounts and video OFF. A subsequent public HTTP probe hit ENOTFOUND from this
Mac's resolver for the new trycloudflare hostname, so public page/login delivery
was not verified in that earlier probe. The owner has since completed the live
Mac/Windows call through Cloudflare, as recorded at the top of this guide. This is separate from agent startup or an HTTP
HOST_DENIED response. If the browser also cannot resolve its new hostname,
check DNS/network filtering privately; no DNS settings were changed by this fix.
See [CLOUDFLARE-CLI-FIX.md](CLOUDFLARE-CLI-FIX.md) for evidence and verification.

## Debugging LiveKit 401 / settings/regions

Stop the server, then run this command to enable diagnostics and ensure the
three LiveKit values are taken from `.env` rather than stale shell exports:

```sh
env -u LIVEKIT_API_KEY -u LIVEKIT_API_SECRET -u LIVEKIT_URL \
  LEARNING_VIDEO_DEBUG=true LEARNING_TUNNEL_PROVIDER=cloudflare pnpm run test:lan
```

Use the new role links and click Join. Look for:

- Server terminal: `LIVEKIT_TOKEN_DEBUG`, containing decoded `claims.iss`, `nbf`,
  `exp`, opaque identity/room grants/metadata, canonical `serverUrl`, Unix/ISO
  server time, ISO token times, TTL, issuer comparison and local signature check.
- Browser console: expand `LIVEKIT_CONNECTION_ERROR` if `room.connect()` fails.
  It includes the ConnectionError's name, message, stack, code, reason/name,
  HTTP status, context and cause, with token/credential strings redacted. The
  exact `serverUrl` passed to the SDK is logged alongside it. No raw JWT or API
  secret is printed. Failed connections still release admission and stop tracks.

Privately compare `claims.iss` with the API key in the **same LiveKit project**
as the logged WSS URL. `nbf` must not be in the future relative to LiveKit's
clock, and `exp` must be in the future. The join TTL stays at most 120 seconds.
Compare the logged ISO server time with an accurate clock; if it is wrong,
check macOS automatic date/time settings. Browser clock differences alone do
not change the server-signed timestamps.

The official SDK uses the server's configured API key/secret to sign; debug
mode verifies that signature locally with the same pair. This proves internal
consistency, **not** that LiveKit Cloud recognizes that pair or that it belongs
to the URL's project. A 401 can still require checking the project/key pairing,
revocation or server clock. Credentials with leading/trailing whitespace now
fail local validation. No dashboard credentials were inspected during this fix.

Node's `--env-file` gives existing process environment values precedence over
the file. The `env -u` command above clears those three names for this run only;
it does not print or modify them. Restart after changing `.env`.
[Node environment-file behavior](https://nodejs.org/api/cli.html#--env-filefile).

Disable diagnostics with `LEARNING_VIDEO_DEBUG=false` after testing. This setting
is documented in `.env.example`. See [LIVEKIT-AUTH-DIAGNOSTICS.md](LIVEKIT-AUTH-DIAGNOSTICS.md)
for verification and the SDK's region-auth request path.

## First live call

Run these steps from
`/Users/tareqnaser/Documents/ChatGPT/Marocora Site building/output/marocora-quote-workflow-local`.

1. In your ignored local `.env`, add the following names. Replace the three
   placeholders privately with values from the intended LiveKit project. Preserve
   any existing unrelated variables. `.env.example` documents the same names.

   ```dotenv
   LIVEKIT_URL=wss://your-project.livekit.cloud
   LIVEKIT_API_KEY=your-server-api-key
   LIVEKIT_API_SECRET=your-server-api-secret
   LEARNING_VIDEO_MODE=live
   LEARNING_VIDEO_ENABLED=false
   ```

   Use the project WebSocket origin, without a path, query string or embedded
   credentials. The secret must be at least 32 characters. None of these names
   should have a frontend/public prefix. The URL is intentionally returned to
   authorized browsers; the key and secret stay in the Node server.

2. For a closed-gate check, run:

   ```sh
   pnpm run learning:video:live
   ```

   This bundles the browser SDK, then loads `.env` through Node's `--env-file`.
   Open a printed student link. With the flag false, the page reports that video
   is OFF and Join is denied. No room-service call or device capture occurs.

3. Stop with Ctrl-C. Set `LEARNING_VIDEO_ENABLED=true` privately in `.env`, then
   run the same command again. Both explicit live mode and the true flag are
   required. Changing `.env` requires restarting the server.

4. Open the newly printed **student** link in one browser profile and the
   **teacher** link in a separate profile, or use one normal window and one
   private window. Two tabs sharing the same cookie store will share an account;
   two private windows may also share cookies. Each login link redeems once;
   reload/retry is accepted only with the original unexpired session cookie.
   The third `otherStudent` link is an unauthorized-booking denial check.

   For direct local links, the `#...` fragment is a **local login ticket**, not
   a LiveKit JWT. These legacy fragments stay in the address bar when `lang` is
   added. HTTPS tunnel links use `&ticket=...`, which is removed only after
   successful login as documented above. The browser
   exchanges it with `/api/local/learning-login`; Join waits for authentication
   and authenticated configuration before requesting the actual room token.
   Do not share these local sign-in links. After a server restart, use the fresh
   printed links: old tickets and booking IDs belong to the discarded fixture.

5. Click Join in both authorized windows and allow camera/microphone access.
   Joining now makes real LiveKit Cloud calls. The page shows **Live lesson
   video**, and removes the mock-only banner. Expect local preview, the remote
   participant's video/audio, working mute/camera controls and Leave. Click
   Enable audio if the browser blocks autoplay. Use headphones or mute one
   microphone when testing both windows on one computer.

6. Click Leave in both windows and stop the server. Set
   `LEARNING_VIDEO_ENABLED=false` again when finished. Server shutdown attempts
   to remove active provider participants; confirm the room is empty in the
   LiveKit dashboard if connectivity failed during cleanup.

The launcher defaults to `127.0.0.1:4195`. That loopback origin permits browser
camera/microphone access. Explicit `HOST=0.0.0.0` enables LAN HTTP access, as
described below; this remains a synthetic test launcher, not a public deployment.
Restarting generates fresh
synthetic login links and booking records. Its confirmed 45-minute synthetic
lesson begins two minutes after launch; admission runs from ten minutes before
start until ten minutes after its scheduled end.

### Two-laptop LAN HTTP access

Stop the old process and run:

```sh
HOST=0.0.0.0 LEARNING_VIDEO_ENABLED=true LEARNING_VIDEO_MODE=live pnpm run learning:video:live
```

The terminal must show `HTTP_LISTEN: 0.0.0.0:4195`. It also prints allowed
`HTTP_ORIGIN` addresses discovered from the Mac's IPv4 interfaces. `PORT` may
override 4195; the isolated mock command ignores these environment settings and
keeps its loopback binding.

For the second laptop, copy the newly printed teacher link and replace only
`http://127.0.0.1:4195` with `http://192.168.11.113:4195` (or the Mac's current
printed Wi-Fi origin). Preserve the full `?bookingId=...#...` suffix. Use the
student link on the first laptop. Bare `/learning-room.html` does not carry the
initial account/booking ticket. Different devices must use different roles.

This fixes the HTTP listener and Host/Origin checks; it does **not** make an HTTP
LAN origin a browser secure context. The page can load and authenticate over
HTTP, but actual camera/microphone capture on the second laptop requires trusted
HTTPS, or a localhost connection through an SSH tunnel. The LiveKit WSS URL
secures the media/signaling service; it does not secure the page origin.
[Browser media security requirements](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia).
The combined `pnpm run test:lan` command above now manages the HTTPS tunnel.
Do not disable browser security checks to work around the requirement.

No SQL or database gate change is involved. Default binding stays loopback;
wildcard binding is explicit. Host validation accepts only loopback and actual
local IPv4 interface addresses on the listening port. Each POST must have the
same Origin as its accepted Host; arbitrary hosts and foreign origins are denied.
Restart after interface/IP changes so the allowlist is refreshed.

## What is implemented

- Authenticated `POST /api/learning/room-token` resolves the booking's student or
  instructor and current tenant membership from server records. Client-selected
  roles, tenants and room identities are rejected. Gates, booking window, rate,
  capacity and reserved-minute limits run before provider calls.
- The official server SDK signs real JWTs with a maximum 120-second initial-join
  lifetime. Grants permit only the authorized room and media sources. Neither
  participant can administer rooms, record, publish data or change metadata.
  Teacher screen-share sources are reserved; screen-sharing UI is not included.
- The server creates/checks the provider room with a two-participant maximum,
  60-second empty timeout and 20-second departure timeout. Room-service requests
  have a five-second timeout. An incompatible existing participant limit fails
  closed. Public API errors do not include credentials or raw SDK messages.
- The browser obtains a real token, redeems its application admission, connects
  an official SDK `Room`, then captures and publishes microphone/camera tracks.
  Remote subscriptions attach to the grid. Leave and failed joins stop tracks,
  disconnect and release admission. Device access is denied by HTTP policy when
  the live gate is OFF; the mock path never requests devices.
- Application redemption binds the token to the current actor and booking.
  Heartbeats revalidate access every 30 seconds against 90-second leases. A
  15-second server sweep attempts removal for cancelled/revoked/stale sessions;
  provider removal failures are retried. This is eventual revocation, not an
  instantaneous cancellation guarantee. Token TTL limits initial joining, not
  an already-connected call's duration.
- The API key/secret stay inside the server adapter. Browser builds contain the
  client SDK only. JWTs remain in memory and are not displayed or stored in URLs,
  browser storage or logs. The backend returns only the public WebSocket URL,
  scoped participant token and non-secret connection metadata.

See the official [token/grant documentation](https://docs.livekit.io/frontends/reference/tokens-grants/)
and [connection documentation](https://docs.livekit.io/intro/basics/connect/).

## Scope and limits

The live launcher deliberately uses the existing isolated **synthetic in-memory
marketplace**, one-use local login tickets and HttpOnly cookies. It does not use
Supabase credentials or modify managed bookings, translation gates or migration
003. The configured room service can be injected into the existing API handler,
but managed customer authentication/booking integration is a later stage. Do
not expose the synthetic login launcher as a customer service.

The prior Ship-tier design remains: two participants per room, 20 active
application admissions per process, a conservative 30,000 reserved participant
minutes per month, sessions capped at 60 minutes within the booking window,
720p/15 fps camera targets, 800 kbit/s video and 48 kbit/s audio targets. Adaptive
streaming and dynacast are enabled. These are application controls and encoder
targets, not a provider-enforced spending cap. Reservations/rates/leases remain
in memory and reset on restart. Persist/share usage controls and add provider
metrics and billing alerts before customer deployment. Review current project
allowances in the dashboard; this work does not promise a fixed $50 bill.

The original mock command remains internet-isolated and does not load `.env`:

```sh
pnpm run learning:video:mock --enable-local-video-mock
```

A static Pages build includes the browser UI and bundled client, but cannot sign
tokens. It requires an authorized server backend and otherwise fails closed.
No public deployment is included here.

## Verification

**Historical implementation evidence:** dated reports below describe their
respective milestones. The owner-confirmed success and 258-test closeout above
supersede pending first-call/401/DNS verification wording in those reports.

**Login follow-up:** [LESSON-LOGIN-FIX.md](LESSON-LOGIN-FIX.md) records the retained
fragment/readiness fix and then-current **235/235** passing tests, with the prior 231
unchanged. The results below record the preceding SDK implementation milestone.

**LAN follow-up:** [LAN-BINDING-CLOSEOUT.md](LAN-BINDING-CLOSEOUT.md) records the
subsequent explicit IPv4 bind/Host/Origin change and its verification.

**Tunnel follow-up:** [TUNNEL-AUTOMATION-CLOSEOUT.md](TUNNEL-AUTOMATION-CLOSEOUT.md)
records the one-command HTTPS launcher and **245/245** local passing tests.

**Ticket follow-up:** [NGROK-TICKET-QUERY-FIX.md](NGROK-TICKET-QUERY-FIX.md) records
the redirect-safe query format, browser login/join proof and **249/249** tests.

**Direct-loading follow-up:** [DIRECT-TUNNEL-CLOSEOUT.md](DIRECT-TUNNEL-CLOSEOUT.md)
records the Cloudflare default, ngrok limitations and **252/252** local tests.

`pnpm test`: **231 passed, 0 failed, 0 skipped/cancelled**. All preexisting 221
tests remain unchanged, including the original 210. Ten new tests cover official
SDK JWT verification with dummy keys, grants/TTL, gates/configuration, tenant and
role denial, token redemption and ownership, live room limits, stale/cancelled
participant removal, fake SDK media lifecycle and failure cleanup. The suite's
OS and JavaScript guards deny internet access; ordinary workers attempted no
outbound connections.

`pnpm run build:learning-room`, `pnpm run build:pages` and `git diff --check`
passed. Browser review verified live-mode labeling and initial layout using a
dummy WSS origin, without joining or accessing devices. See
`livekit-live-evidence/live-mode-ui.jpg`, test/build logs and `verification.json`.
At that earlier implementation milestone, cloud/media verification was still
pending. The owner has now verified the two-device live call recorded above.

For startup errors: `LIVEKIT_ENV_REQUIRED` means a required variable is absent;
`INVALID_LIVEKIT_URL` means the WSS origin is malformed;
`INVALID_LIVEKIT_CREDENTIALS` means local credential validation failed.
`LIVEKIT_ROOM_SETUP_FAILED` means the provider room could not be safely prepared:
check project URL/key pairing, outbound HTTPS/DNS and project limits privately.
For browser media failure, check device permissions and another app holding the
camera, then rejoin. Do not paste keys or JWTs into chat or issue logs.

## Handoff — Marocora — Production Integration

**Video phase closed.** Do not repeat the completed first-call, ticket, tunnel,
CLI or 401 work. The current production task list, artifact paths, decisions,
acceptance criteria and fresh-chat starter are saved in
[MAROCORA-PRODUCTION-HANDOFF.md](../MAROCORA-PRODUCTION-HANDOFF.md).

Next stage: select and implement the real payment gateway in its sandbox,
replace private local file storage with an authorized cloud adapter, and prepare
managed identity/bookings plus a stable HTTPS frontend/backend deployment.
These are future tasks, not actions performed or enabled by this closeout.
