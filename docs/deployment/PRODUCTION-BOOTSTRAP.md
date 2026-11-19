# Marocora — Production Bootstrap and Spaces Release

17 November 2026. Production entry point and private cloud file adapter are
implemented. This phase performs local verification and Git staging only. It
does not connect to the Droplet, apply managed SQL, read `.env`, upload actual
files to Spaces, enable workflow switches, commit or push.

## Runtime contract

`server/start-production.mjs` starts the real Supabase-backed application on
loopback port 4195. It imports no synthetic marketplace, seeds no users/bookings
and exposes no local/staging login endpoints. `NODE_ENV=production` and a fixed
`APP_ORIGINS` HTTPS allowlist are required. Only loopback binding is accepted;
Nginx terminates HTTPS and overwrites forwarded client-IP information.

The public website is served at `/` and `/index.html`; sign in at
`/production-login.html`. Supabase `auth.getUser` verifies each
session; anonymous, unconfirmed, invalid or revoked users fail closed. Tokens
stay in a Secure, HttpOnly, SameSite=Strict `__Host-` cookie. Business roles come
from database RPCs, never JWT user metadata or caller-supplied IDs. Refresh-token
rotation is not implemented here: expired sessions return to sign-in. The
production translation browser module does not use staging sessionStorage tokens.

The production page allowlist restores the authored public homepage, directories,
profiles, inquiry/application forms, email verification and learning catalogue.
Public forms retain their existing Supabase email-verification and RLS-backed
flows; CSP permits only the configured Supabase origin for those requests.
The translation inquiry at `/translation-request.html` is public; the document
quote/workspace is separate at `/instant-quote.html` (also
`/translation-workspace.html`). Private workspace, review, account, schedule and
lesson HTML redirects unauthenticated or expired sessions to the separate login
page, preserving the destination. API role, booking and file authorization still
runs independently on every request. Legacy synthetic booking/payment pages,
server/test source, `.env` and the old hardcoded learning client configuration
are not served. Original profile scripts receive exact CSP hashes rather than
enabling unrestricted inline JavaScript. GET `/health` is a process liveness check, not proof that all
external dependencies are healthy. Unknown Hosts and mismatched POST Origins
are denied. There is no wildcard CORS or forwarded-origin bypass.

Startup calls the service-role-only `production_runtime_status` RPC and refuses
to listen without production migration 004. LiveKit stays OFF by default.
`/learning-room.html?bookingId=<managed-booking-id>` uses the authenticated
session, with no synthetic login ticket. The new booking-context RPC checks
confirmed status, exact student/teacher, active teacher, online delivery, time
window and tenant membership. Authorization is refreshed for joins/heartbeats
and the 15-second revocation sweep. Existing token grants and cleanup remain.

## Private Spaces storage

Production V3 source, translated final and watermarked draft routes use
`server/storage/spaces.mjs` with official `@aws-sdk/client-s3@3.1170.0`.
Required variables are `SPACES_KEY`, `SPACES_SECRET`, `SPACES_BUCKET` and optional
`SPACES_REGION=ams3`. Endpoint is derived as
`https://ams3.digitaloceanspaces.com`, with the SDK signing region `us-east-1`.
No credentials/default AWS metadata-provider lookup is used implicitly.
[DigitalOcean SDK configuration](https://docs.digitalocean.com/products/spaces/reference/aws-sdks/).

Objects use opaque UUID keys below `translation/v1/`, private ACL requests,
stored SHA-256/size/type metadata and bounded read/write requests. Reads verify
bucket/key/size/hash and stream through the authorized application. Neither
public object URLs nor unrestricted bucket operations are exposed. Downloads
still require database authorization, and final bytes remain locked until the
existing full-payment state permits them.

The Cloudmersive adapter now supports in-memory byte scanning. Production does
not write uploaded source/final/draft bytes to retained local storage. Sources
and translated finals must scan clean before recording; the draft is generated
from the verified clean final. Scan failures fail closed. Objects created before
a failed scan are deleted; objects involved in an ambiguous metadata commit are
retained for reconciliation instead of risking deletion of committed evidence.
Local/staging launchers retain their existing private-disk adapter.

Ensure the live bucket policy is private; requesting `ACL: private` is not a
live audit of the owner's bucket configuration. This adapter has been tested
with simulated SDK responses, not the actual Spaces service. Existing local
file descriptors are not silently migrated. A byte-migration/reconciliation job
requires its own reviewed scope. The backups bucket is not used automatically;
scheduled backup/restore work remains separate.

## Owner setup before deployment

1. Use the intended production Supabase project. Review its migration history.
   Migration 001 and 003 must already exist; do not apply the synthetic staging
   seed 002 to populate production accounts.
2. Review and apply `supabase/migrations/202611170004_production_runtime.sql`
   in that project's Dashboard → SQL Editor. **Do not apply it casually to the
   verified staging project.** It replaces `quote_verified` with a new explicit
   production-account allowlist and revokes direct mock-payment execution.
   It refuses existing mock-payment rows or ON workflow switches. Reapplication
   fails transactionally; stop and compare instead of deleting data to force it.
3. New translation allowlist entries are disabled by default; no accounts are
   seeded. Enrol only approved, verified real Auth UUIDs, for example:

   ```sql
   insert into public.production_translation_accounts(user_id, enabled)
   values ('REAL_APPROVED_AUTH_UUID', true);
   ```

   Staff/provider capabilities additionally require the existing authoritative
   staff/provider approval records. The old staging registry is not the new
   production allowlist. User-editable JWT metadata never grants a business role.
4. Managed learning bookings live in `production_learning_bookings`; tenant
   memberships live in `production_learning_memberships`. Only a trusted backend
   or approved operator can create/update them. Defaults are pending/inactive.
   Existing nonbinding lesson requests are not promoted to confirmed bookings.
   Paid booking creation/confirmation awaits the payment-gateway integration;
   this migration does not invent paid entitlements or seed demo lessons.
5. Copy `.env.example` privately on the Droplet, mode 0600. Set:

   ```dotenv
   NODE_ENV=production
   APP_ORIGINS=https://YOUR_APP_DOMAIN
   HOST=127.0.0.1
   PORT=4195
   TRUST_PROXY=true
   SUPABASE_URL=https://YOUR_PRODUCTION_PROJECT.supabase.co
   SUPABASE_ANON_KEY=YOUR_PRIVATE_SERVER_VALUE
   SUPABASE_SERVICE_ROLE_KEY=YOUR_PRIVATE_SERVER_VALUE
   SPACES_REGION=ams3
   SPACES_BUCKET=marocora-translation-ledger-ams3
   SPACES_KEY=YOUR_PRIVATE_VALUE
   SPACES_SECRET=YOUR_PRIVATE_VALUE
   CLOUDMERSIVE_API_KEY=YOUR_PRIVATE_VALUE
   LEARNING_VIDEO_MODE=live
   LEARNING_VIDEO_ENABLED=false
   LEARNING_VIDEO_DEBUG=false
   LIVEKIT_URL=wss://YOUR_PROJECT.livekit.cloud
   LIVEKIT_API_KEY=YOUR_PRIVATE_VALUE
   LIVEKIT_API_SECRET=YOUR_PRIVATE_VALUE
   ```

   `TRUST_PROXY=true` is appropriate only with local Nginx overwriting X-Real-IP.
   Never paste real values into Git, PM2 arguments or chat. Missing scanning
   credentials leave uploads unavailable rather than supplying a fake clean scan.
6. Keep private primary bucket access scoped to the application. Preserve
   `marocora-translation-backups-ams3` for a separate backup/restore design.

## Release and PM2

Review the staged source release, commit and push the reviewed branch/tag yourself
before cloning it on the Droplet. No commit or push was made by this task. A push
to main triggers the existing GitHub Pages workflow; a branch release does not
itself deploy the Node server.

On Ubuntu, from `/srv/marocora/app` as the application user:

```sh
pnpm install --frozen-lockfile
pnpm run build:production
pnpm run start:production
```

After the first controlled start/check, stop the foreground server and use:

```sh
pm2 start server/start-production.mjs --name marocora \
  --cwd /srv/marocora/app \
  --node-args="--env-file=/srv/marocora/app/.env" --time
pm2 save
```

Configure PM2's systemd startup for that application user, and route Nginx to
`http://127.0.0.1:4195`, preserving Host, Origin and X-Forwarded-Proto. The browser
must use one of APP_ORIGINS over valid HTTPS. Health check example:

```sh
curl --fail --header 'Host: YOUR_APP_DOMAIN' http://127.0.0.1:4195/health
```

Use **one PM2 instance**. Admissions/rates/LiveKit budget reservations are still
process-local and are not a provider-enforced spending cap. Two heavy document
requests and 128 total HTTP requests are admitted concurrently. Multi-instance
deployment needs shared rate/admission/usage state before cluster mode.

## Payments and activation boundary

No real gateway is installed in this phase. Production rejects `/pay` with
`PAYMENT_GATEWAY_NOT_CONFIGURED`, hides payment controls and migration 004 revokes
direct access to `instant_pay_mock`. The verified local mock flow stays intact
for regression tests. Do not label mock-paid staging orders as real paid orders.
Commercial payment/booking activation remains a separate integration step.

Before customer activation, run a private managed-project canary for confirmed
Auth, real role/membership denial, a clean scan, private Spaces source/draft/final
bytes, recovery after restart and stable HTTPS media access. That real provider
verification, deployment and activation were not performed here.

## Verification

The full local suite passes with 265 tests, including all prior 258 unchanged.
New tests cover the SDK storage contract, corruption/foreign-descriptor denial,
source/final/watermark download flow, precommit cleanup versus ambiguous commits,
real Supabase SDK auth with simulated responses, secure production HTTP and
Host/Origin denial, managed learning revocation, and disposable PostgreSQL
production migration/RLS/mock-payment revocation. The full suite retains its
OS/JavaScript internet-denial guards. Both production builds pass.

Local generated evidence stays under `production-prep-evidence/` and is ignored
for the source release. Synthetic test PDFs/images/DOCX files under
`tests/fixtures/` are retained as regression inputs. No original test is weakened.
