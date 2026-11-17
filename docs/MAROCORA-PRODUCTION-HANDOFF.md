# Marocora — Production Integration Handoff

Recorded **17 November 2026**, Africa/Casablanca.

## Production bootstrap update — 17 November 2026

The production entry point and Spaces adapter are now implemented and prepared
for source release. See [PRODUCTION-BOOTSTRAP.md](deployment/PRODUCTION-BOOTSTRAP.md)
for the current environment, production-only migration 004, real-account enrolment,
PM2 command and canary requirements. Current local suite: 265 tests, prior 258
preserved. New runtime: `server/start-production.mjs`; command
`pnpm run build:production` then `pnpm run start:production`.

Older future-tense storage/bootstrap items below describe the handoff before this
implementation. They are no longer missing code. Actual production migration,
private Spaces/Supabase canary, backup jobs and deployment have not been run.
Real payments remain unimplemented and are disabled in the production path.

## Completed and verified

**Learning Service LiveKit Video Integration is verified and closed.** The owner
connected **Mac (Teacher)** with **Windows laptop (Student)** over the Cloudflare
HTTPS tunnel. Room joins, live video, audio and camera toggles worked. This is
owner-reported live verification; do not reopen first-call, tunnel or JWT 401
debugging without a new regression.

Translation Instant Pricing V3 and its cleanup are complete. The owner confirmed
migration 003 applied to staging. pnpm is the sole package manager; the scanned
PDF/manual-review bypass and the existing translation workflow remain intact.
Interpretation remains removed from active services. Do not blindly reapply
completed migrations or repeat these closed investigations.

Final local `pnpm test`: **258 passed, 0 failed, 0 skipped/cancelled**. The full
suite ran with the unchanged OS and JavaScript internet-denial guards. This
closeout edits documentation only, not application behavior, credentials, remote
gates or deployment settings. No fresh live call, merchant charge, storage
transfer, commit, push or deployment was performed.

Known macOS usability note: on smaller displays, the camera/microphone prompt
may place Allow off-screen. Use a larger display/more display space or review
browser permissions in System Settings → Privacy & Security → Camera/Microphone;
then reopen the lesson and confirm site permissions as needed. This is a
documented owner-observed workaround, not an application or OS bug fix.

## Checkout and artifacts

- Repository: `/Users/tareqnaser/Documents/ChatGPT/Marocora Site building/output/marocora-quote-workflow-local`.
- Branch: `codex/marocora-quote-workflow-local`.
- Current video guide: `docs/learning/LIVEKIT-LIVE-SETUP.md`.
- V3 history: `docs/quote/INSTANT-PRICING-V3.md`, `docs/quote/V3-CLEANUP-CLOSEOUT.md`.
- Final test evidence: `docs/learning/video-closeout-evidence/pnpm-test.txt` and
  `verification.json`. Previous SDK/tunnel/auth reports retain dated evidence;
  their pending-video wording is superseded by this owner-confirmed closeout.
- Server integration: `server/api.mjs`, `server/livekit-adapter.mjs`,
  `server/live-learning-room.mjs`, `server/learning-room-http.mjs`.
- Developer launcher: `server/start-learning-lan.mjs`,
  `server/learning-video-lan.mjs`, `server/cloudflare-tunnel.mjs`.
- Browser integration: `learning-room.html`, `learn/live-learning-room.mjs`,
  `learn/lesson-login.mjs`, `learn/livekit-diagnostics.mjs`.
- Pricing/fulfilment: `server/quote/instant-pricing.mjs`,
  `server/block1/instant-http.mjs`, existing quote RPCs and migration 003.

Developer retest, only if needed:

```sh
LEARNING_TUNNEL_PROVIDER=cloudflare pnpm run test:lan
```

This explicit command enables its isolated synthetic live test; the normal
launchers' default gates remain OFF. It is not the production server. Ctrl-C
stops its server/tunnel. Set `LEARNING_VIDEO_DEBUG=false` for normal testing;
keep keys, secrets and raw tokens private.

## Remaining production work

### 1. Payment gateway

Current boundary: V3 has the 50/50 **mock** payment workflow. Learning has payment
adapter/webhook abstractions and local fixtures; no live merchant integration
is claimed.

Next work:

- Owner selects the gateway/merchant account and confirms supported MAD checkout,
  settlement and intended translation/learning payment scope. Keep credentials
  in the private server environment or secret manager.
- Implement sandbox checkout and verified server-side webhooks. Preserve stored
  quote amounts, MAD minor-unit rounding, VAT, deposit/balance split, consent and
  booking ownership. A browser success redirect must not mark an order paid.
- Handle duplicate/out-of-order callbacks, retries, cancellation/failure,
  reconciliation and the approved refund process without duplicate charges or
  repeated workflow transitions. Keep merchant transaction/audit references.
- Prove the full sandbox deposit → work/draft → balance → final-download flow,
  plus relevant learning booking confirmation, before a separately authorized
  live merchant test. Preserve existing mock regressions.

Decision still open: provider and merchant configuration. Completing video does
not activate charges or authorize a production payment rollout.

### 2. Real private cloud storage

Current boundary: source/draft/final translation bytes use private local disk;
managed database records alone do not make those bytes durable cloud storage.

Next work:

- Select the storage service, environment/region and retention/access policy.
  Implement private object storage behind the existing file-access boundary.
- Keep tenant/role checks, upload limits/type validation, checksums, quarantine
  and actual scanner gating. Draft access and final-file access must preserve
  the existing payment restrictions. Never make customer buckets public.
- Use authorized short-lived access or server-mediated downloads. Reconcile
  metadata/object failures and retries without deleting ambiguous committed
  files or exposing quarantined content.
- Validate cross-tenant denial, failed/partial transfers, expired access,
  restart recovery and backup/restore. Plan any existing-byte migration only
  after scope is known; no files were transferred during this phase.

Decision still open: storage provider and operational policy. Keep test objects
synthetic until real customer processing is separately authorized.

### 3. Deployment and managed service integration

Current boundary: the temporary tunnel is for development. The learning launcher
uses an in-memory synthetic marketplace, local login tickets and process-local
admission/usage state. A static Pages artifact cannot serve the token signer or
Node APIs by itself.

Next work:

- Choose stable frontend/backend hosting and approved HTTPS origins. Deploy the
  server-side APIs to a persistent Node-capable runtime; preserve exact Origin,
  proxy-trust, cookie and private-file protections. Replace temporary tunnels.
- Connect learning to authoritative managed authentication, booking/instructor
  and tenant membership records. Synthetic role links must not be public login.
  Preserve booking-scoped JWTs, current authorization, cancellation/lease
  enforcement and server-only LiveKit credentials.
- Persist/share usage, capacity and rate controls across restarts/instances.
  Add provider metrics/billing alerts and verify quotas; process-local targets
  do not enforce a fixed LiveKit bill.
- Configure separate staging/production secrets, durable DB/storage, backups,
  restore checks, logging/alerts, scanner availability and payment monitoring.
  Review the actual migration history before applying any production SQL.
- Run frozen pnpm install, the existing guarded tests and appropriate builds in
  CI. Then verify managed auth/RLS, gateway sandbox, private storage and stable
  HTTPS media access in the intended staging topology. Record rollback/gate-OFF
  procedures and obtain a scoped production release decision before activation.

Decisions still open: hosting/runtime/topology, stable domain and production
operations ownership. Public activation, real charges and migration of customer
files are separate actions, not implied by this documentation handoff.

## Suggested next stage and session handoff

Start with **Marocora — Payment Gateway Sandbox Integration** once the owner
provides the chosen provider/scope (credentials stay private). Cloud storage and
deployment preparation follow, with managed learning identity/booking integration
included in the deployment work. Preserve the closed video and V3 milestones.

`docs/quote/PRODUCTION-READINESS.md` is a historical gap inventory from before
later V3/video implementation; use current artifacts and this handoff rather
than treating its older unimplemented-feature statements as current facts.
No infrastructure vendor is selected by this handoff.

The phase is closed, so this is a good point to start a fresh chat. Starter:

> Continue **Marocora — Payment Gateway Sandbox Integration**. Read
> `docs/MAROCORA-PRODUCTION-HANDOFF.md`,
> `docs/quote/INSTANT-PRICING-V3.md` and
> `docs/learning/LIVEKIT-LIVE-SETUP.md` in the existing checkout. V3 cleanup and
> owner-confirmed Mac Teacher / Windows Student Cloudflare video are complete;
> joins, video, audio and camera toggles passed. Final local suite: 258/258.
> Do not repeat closed video/tunnel/JWT or V3 investigations. Next work is a real
> payment gateway in sandbox, then private cloud storage and deployment with
> managed learning auth/bookings. Confirm provider/scope from available context
> before implementation; never ask me to paste credentials into chat. Preserve
> current pricing, consent, tenant authorization, quarantine, OFF-default gates
> and the removal of Interpretation. Do not deploy or activate real charges
> without a specific subsequent instruction.
