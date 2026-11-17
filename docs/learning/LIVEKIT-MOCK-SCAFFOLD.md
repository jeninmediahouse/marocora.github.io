# Marocora — LiveKit Learning Room Mock Scaffold

**Historical mock-stage closeout.** The subsequent live SDK implementation and
current first-call instructions are in [LIVEKIT-LIVE-SETUP.md](LIVEKIT-LIVE-SETUP.md).
Statements below about unimplemented cloud adapters describe the completed mock
stage; the original mock-only service and launcher remain available.

16 November 2026 (Africa/Casablanca). **Ready for local review.** Translation V3
and its owner-applied migration 003 are unchanged. No existing database switches,
managed database, credentials or LiveKit project were changed. No live LiveKit
calls, media, camera/microphone access, real lessons, charges or deployment.

## Review locally

From the checkout:

```sh
pnpm run learning:video:mock
```

This starts loopback port 4196 with the video gate **OFF**. Open the printed
one-use student or teacher link; Join returns `LEARNING_VIDEO_DISABLED`.

To explicitly enable only the isolated local mock:

```sh
pnpm run learning:video:mock --enable-local-video-mock
```

Use the newly printed student/teacher links in separate browser profiles. Each
link signs in to a synthetic account using a one-use hash ticket, immediately
removed from browser history. Authentication then uses an HttpOnly SameSite
cookie. The booking reference is already filled. Click Join, toggle microphone
and camera, then Leave. The “otherStudent” link demonstrates denial for a user
who does not own that booking. No JWT, secret, email or real identity is in a link.

The demo creates a separate **in-memory SQLite marketplace** and one confirmed,
free synthetic 45-minute lesson, beginning two minutes after launch. Stop with
Ctrl-C; all fixture accounts, bookings, sessions, mock signing keys and leases
are discarded. No retained application database or workflow gate is involved.
`--port=0` is available for automated ephemeral-port testing.

The grid's counterpart is explicitly simulated, not proof that a real teacher
or student is present. Buttons only change mock state. The code does not create
an RTCPeerConnection, request getUserMedia or use a LiveKit client SDK. The local
server also sets device-denial Permissions-Policy and self-only connection CSP.

## Backend API

The existing `server/api.mjs` handler now accepts a constructor-injected
`learningRooms` service. If absent, room endpoints fail closed. Existing routes
and trusted `authenticate(request) → accountId` integration are preserved.

| POST endpoint | JSON request | Purpose |
| --- | --- | --- |
| `/api/learning/room-token` | `{bookingId}` | Authorize the booking and issue a signed mock JWT |
| `/api/learning/room-connect` | `{bookingId, token}` | Redeem once and create an authorized mock connection |
| `/api/learning/room-heartbeat` | `{connectionId}` | Revalidate access and extend a short mock lease |
| `/api/learning/room-leave` | `{connectionId}` | Release only the caller's connection |

Requests require same-origin JSON and an authenticated account. Responses are
`Cache-Control: no-store`. The room-token response includes `token`, `expiresAt`,
`bookingId`, server-derived role/room/identity, `transport: 'mock'`, `mock: true`,
and `serverUrl: null`. The token is not displayed, put into a query string,
persisted to browser storage or logged. No API signing secret is returned.

Authorization reads the authoritative booking, account and instructor records:

- Only its student (`student`) and linked instructor account (`teacher` in room
  grants) can join. Other students/teachers and administrators are not participants.
- Organization bookings additionally require current membership in that same
  organization. Personal bookings remain limited to the exact two booking parties.
- Booking must be confirmed, online, and linked to an active instructor. Join is
  allowed from ten minutes before start until ten minutes after scheduled end.
  Held, unpaid/unconfirmed, cancelled, expired and completed records fail closed.
- Tenant, role, room name, identity and grants cannot be selected in request JSON.
  Ownership and membership are checked again on redemption and heartbeat, so a
  cancellation or access removal after token issuance does not authorize a join.

`server/learning-room.mjs` signs HS256 JWTs with a random server-only mock key.
They have a maximum 120-second initial-join TTL, opaque HMAC-derived room/identity,
booking/role metadata, and a mock-only issuer/audience. A nonce registry, constant-
time signature checking, expiry validation and one-time redemption reject forged,
expired, cross-account, mismatched-booking and replayed tokens. Restart invalidates
all outstanding mock tokens. These are deliberately **not usable LiveKit Cloud
credentials**. Production must use the official server SDK/signer adapter later.

Both roles can publish camera/microphone and subscribe. Teacher grants also
reserve screen-share sources for a future teacher-only feature; this UI does not
implement screen sharing. Neither role gets room administration, creation,
recording, data publishing or metadata-update privileges. No guest links, recording,
ingress, egress, telephony or agents are implemented.

Connected mock sessions use 90-second leases, refreshed every 30 seconds. Missed
heartbeats expire a lease; the maximum mock session is 60 minutes and also bounded
by the booking window. Leave/page exit releases best-effort; a closed tab's missed
heartbeats eventually reclaim its slot. Token expiry limits initial joining,
not an already-authorized session's lifetime. A real SFU disconnect/revocation
integration is still needed before live use.

## OFF-by-default gates

`ROOM_DEFAULTS.enabled` is false. Shared-server configuration is explicit:

```javascript
const rooms = createLearningRooms({
  marketplace,
  config: learningRoomConfig(process.env)
});
const handler = createApiHandler({
  marketplace, authenticate, origin, learningRooms: rooms
});
```

`learningRoomConfig` reads only `LEARNING_VIDEO_ENABLED` and `LEARNING_VIDEO_MODE`.
The enabled flag accepts only `true`/`false`; the default mode is `mock`. It never
reads API secrets or changes SQLite/Supabase/V3 switches. The local demo ignores
`.env` and uses its explicit mock-enable flag instead.

Any enabled mode other than `mock` fails with `LIVEKIT_CLOUD_NOT_IMPLEMENTED`.
Adding real keys alone cannot activate a cloud path. The local mock has now been
verified; cloud implementation/testing remains a separate owner-directed stage.

## Ship tier design target

Official pricing checked 16 November 2026 lists Ship **starting at $50/month**,
with **150,000 WebRTC participant minutes**, **1,000 concurrent connections** and
**250 GB downstream transfer** included; overages are metered, including $0.0005
per extra participant minute and $0.12 per extra downstream GB.
[LiveKit pricing](https://livekit.com/pricing)

Local application defaults deliberately stay below those allowances:

| Scaffold policy | Default |
| --- | ---: |
| Participants per booked room | 2 |
| Concurrent mock connections across the process | 20 |
| Mock initial token lifetime | 120 seconds maximum |
| Mock session lifetime | 60 minutes maximum, bounded by booking window |
| Monthly reserved participant-minute budget | 30,000 |
| Target camera settings | 720p, 15 fps, 800 kbit/s video |
| Target audio ceiling | 48 kbit/s |
| Token requests | 5 per authenticated account per minute |

A one-hour two-person lesson consumes 120 participant minutes. At the media
targets above it would transfer roughly 0.76 GB downstream across the pair,
before protocol overhead. A 30,000-minute budget is about 250 such lessons,
leaving headroom within the listed bandwidth allowance under these assumptions.
This is a planning estimate, not measured usage or a guarantee of a $50 bill.
Additional screen-share tracks would need a separate budget review.

The mock reserves the whole permitted session duration per participant at join
and does not refund that conservative reservation on early leave. Its counters,
rate limits and leases are **in-memory and process-local**; restart resets them.
No bitrate is transmitted or provider billing quota enforced by this mock.
Before live: persist and share counters, account for actual media usage using
verified provider events/metrics, configure SFU room limits, and set billing/usage
alerts. Client media targets alone do not enforce a financial cap. Review current
project quotas in the provider dashboard before activation.
[LiveKit quotas and metering](https://docs.livekit.io/deploy/admin/quotas-and-limits/)

## Future server-only environment setup

Mock review requires **none** of the following credentials. When preparing the
separate cloud phase, put these names privately in the server's ignored `.env`
or deployment secret manager; substitute the placeholders locally:

```text
LEARNING_VIDEO_ENABLED=false
LEARNING_VIDEO_MODE=mock
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your-server-api-key
LIVEKIT_API_SECRET=your-server-api-secret
```

Obtain the actual project URL/key/secret from the intended LiveKit staging
project. Never paste them into chat, HTML, frontend configuration, query strings,
Git or a test fixture. No `VITE_`/public prefix belongs on the API secret.
The eventual browser needs only its short-lived authorized participant token and
public project WebSocket URL. The API secret remains exclusively on the server.
[LiveKit token documentation](https://docs.livekit.io/frontends/reference/tokens-grants/)

Do not switch to a live mode yet: this scaffold intentionally rejects it. The
next implementation must add the official LiveKit server/client SDK adapters,
trusted managed-session authentication, a managed booking/tenant resolver, shared
room identity/signing configuration, live room lifecycle enforcement and provider
usage monitoring. Then verify using synthetic accounts in the intended project
before any public or customer access. The mock's random per-process signing and
room-name key is not a multi-server production configuration.

## Verification and artifacts

**Final `pnpm test`: 221 passed, 0 failed, 0 skipped/cancelled**, including all
original **210** unchanged. Eleven added tests cover closed/cloud gates, JWT
signature/TTL/grants, both participants, tenant/role denial, client-field spoofing,
booking status/window checks, token forgery/expiry/replay, cancellation and removed
membership, mock capacity/budget/rate limits, frontend lifecycle, real HTTP API,
and the real loopback launcher/default-OFF/static allowlist/device-denial policy.

The initial full run found a missing four-language brand entry; corrected without
changing any original test. Browser QA then found one omitted static dependency
in the mock launcher's allowlist. That dependency was added and a launcher
regression covers the final asset surface. Final browser join, mute/camera toggles
and leave cleanup passed with no console errors and no horizontal overflow.
No camera/microphone permission prompt was made. The temporary preview was
stopped afterward; its in-memory state was discarded.

The full suite kept its OS/JavaScript internet-denial guards. Ordinary workers
reported zero outbound attempts. `pnpm run build:pages` and `git diff --check`
passed. No new dependency or lockfile change was needed. The static artifact
includes the public room/mock UI, never the server signer, fixture records or keys.
A static-only host has no authorized token backend and fails closed.

Main files:

- `server/learning-room.mjs`: gates, booking authorization, mock JWT/leases/limits.
- `server/api.mjs`: optional authenticated room routes on the existing API.
- `server/learning-room-fixture.mjs`, `server/start-learning-room.mjs`: isolated demo.
- `learning-room.html`, `learning-room.mjs`, `learning-room.css`: room layout/controls.
- `learn/mock-learning-room.mjs`, `learn/room-copy.mjs`: mock transport and EN/FR/AR/ES text.
- `tests/learning-room.test.mjs`: eleven added regression checks.
- `docs/learning/livekit-evidence/`: final test/build output, preservation hashes,
  initial failed-run output and `room-connected.jpg` browser proof.

## Handoff — Marocora — LiveKit Cloud Adapter Planning

Checkout: `/Users/tareqnaser/Documents/ChatGPT/Marocora Site building/output/marocora-quote-workflow-local`.
Branch: `codex/marocora-quote-workflow-local`. Preexisting work preserved. No commit,
push, public deployment, cloud credentials read or database switch changes here.
Local mock scaffold is complete and ready for review. Cloud transport is not
implemented or enabled. Do not repeat the completed V3 or mock investigations.

Next decision: review the mock experience, then explicitly scope the live staging
adapter (managed identity/booking source, official SDKs, usage controls and room
lifecycle). No need to supply secrets in chat.

Starter prompt for a fresh chat after review:

> Continue **Marocora — LiveKit Cloud Adapter Planning**. Read
> `docs/learning/LIVEKIT-MOCK-SCAFFOLD.md`. Mock scaffold is complete: 221/221 local
> tests, original 210 unchanged, build and browser join/toggle/leave QA passed.
> Room access is booking/tenant/role scoped, local gates default OFF, cloud modes
> are intentionally blocked, and no DB switches were changed. Plan the next
> owner-authorized live staging adapter without repeating local work or printing
> keys. Treat Ship pricing as metered allowances, not a guaranteed $50 spend cap.
