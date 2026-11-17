# Marocora — Production Bootstrap and Cloud Storage Closeout

17 November 2026, Africa/Casablanca. **Implementation complete; staged for owner
review. No commit, push, Droplet connection, managed SQL application or live
Supabase/Spaces call was performed.**

## Delivered

- `server/start-production.mjs`: real Supabase-backed entry point with a required
  fixed HTTPS APP_ORIGINS allowlist, loopback-only binding for Nginx, Secure
  HttpOnly cookies and per-request remote Auth verification. Anonymous,
  unconfirmed/invalid users fail closed. Synthetic tickets and test accounts are
  absent. Production role/booking authority comes from database records.
- Production-only migration `202611170004_production_runtime.sql`: an explicit
  disabled-by-default translation-account registry, managed learning bookings and
  tenant memberships with restrictive RLS and a caller-bound room-context RPC.
  Startup checks its service-only status RPC. No accounts/bookings are seeded.
  This changes the quote allowlist to the production registry, requires clean
  mock-payment state and OFF switches, and revokes the mock payment RPC. Review
  and apply only to the intended production project; no auto-migration occurs.
- `server/storage/spaces.mjs`: official pinned S3 SDK, private object requests,
  bounded timeouts/read sizes and SHA-256 checks. Production V3 source/final/
  draft routes use Spaces and byte-based Cloudmersive scanning instead of local
  retained files. Authorization and final-payment download restrictions remain.
  Local/staging disk paths and all prior regressions remain available.
- Browser sign-in uses the same-origin server and HttpOnly cookie. Production
  translation assets do not use staging sessionStorage tokens. Legacy synthetic
  dashboards and hardcoded direct-client configuration are outside the production
  static allowlist. Payment controls are unavailable until a real gateway exists.
- `build:production` / `start:production`, `.env.example`, README and
  [PRODUCTION-BOOTSTRAP.md](PRODUCTION-BOOTSTRAP.md) describe the real startup,
  migration, enrolment, Spaces configuration and PM2 path.

## Tests and reproducibility

**265 passed, 0 failed, 0 skipped/cancelled**, including all original 258 tests
without source/fixture changes. Seven new checks cover cloud object integrity
and descriptor scope, source/final/watermark access, infected-file cleanup,
ambiguous-commit preservation, actual Supabase SDK auth with simulated responses,
fixed-origin HTTP/cookies, learning revocation and real local PostgreSQL migration
permissions/RLS/mock-payment denial. Both production builds pass.

The exact staged sources were exported to a fresh temporary directory, given
temporary Git metadata for the existing ignore-policy regression, built and
tested again: **265/265**. Installed dependencies were reused to avoid another
network install; this is not a fresh Ubuntu/provider canary. The export contains
no private `.env` or previous QA output. A fresh-clone failure exposed one existing
test's assumption that its PDF-output directory existed; the pnpm test runner now
creates that ignored directory. No test was changed to bypass the failure.

The first integration run also caught missing language entries for the new sign-in
page; four-language copy was added. PDF fixtures are marked binary in
`.gitattributes` because their cross-reference spacing is meaningful; their bytes
were preserved rather than altered to satisfy whitespace checks.

Existing OS/JS internet-denial guards stayed intact throughout tests. SDK and Auth
responses were simulated, SQL used disposable local PostgreSQL, and no actual
provider credentials or owner `.env` were read. `git diff --cached --check` passes.
Generated logs, preservation hashes, source review and release verification live
in the ignored local `production-prep-evidence/` directory.

## Git release review

The initial 89 untracked status entries grouped many directories. Their individual
source files were reviewed along with the existing V3/video prerequisites and new
production files. Necessary server/browser code, pnpm lock/config, SQL migrations,
scripts, tests/fixtures and curated Markdown guides are staged. Preexisting public
V3 changes needed by the verified application are included; this closeout does
not claim to have authored all of them.

`.gitignore` excludes `.env` variants except `.env.example`, node_modules, build
directories, private local runtime files, logs, backups, credential-file formats,
generated evidence directories and `.DS_Store`. Intentional synthetic PDF/image/
DOCX fixtures remain included. Source review found no live secret literal to
publish; its credential-shaped finding was the existing negative-validation test
value `short`, not an actual credential. No ignored private files were opened.

Review before committing:

```sh
git diff --cached --stat
git diff --cached --name-only
git status --short
```

Keep commits/pushes under owner control. The current branch is
`codex/marocora-quote-workflow-local`; pushing main triggers the existing GitHub
Pages workflow, while a Node Droplet deploy is a separate operation. No generated
test PDFs, logs or private secrets are needed in the GitHub release.

## Owner action before the first deployed canary

1. Review/commit/push the staged release, then clone that release on the Droplet.
2. Apply production migration 004 after its reviewed 001/003 prerequisites in
   the correct project, with OFF switches and no mock-payment data. Enrol only
   approved real Auth UUIDs. Existing staging accounts are not automatically
   copied into the production registry.
3. Configure the private `.env` with the actual HTTPS app domain, Supabase values,
   SPACES_KEY/SECRET/BUCKET, scanner and LiveKit values. Confirm the primary bucket
   policy is private. Follow the new guide's PM2/Nginx instructions.
4. Run controlled managed-provider checks for auth/RLS, clean scanning, private
   Spaces source/draft/final storage and HTTPS room access before customer use.

Remaining boundaries: real merchant payments, paid-booking confirmation workflow,
scheduled backups/restore verification and shared multi-instance usage accounting
are separate work. The backups bucket is not a configured backup job. Run a single
PM2 instance; process-local counters do not constitute a provider spending cap.
Existing local disk blobs are not silently copied; any data migration needs a
reviewed reconciliation plan.

## Handoff — Marocora — DigitalOcean Deployment Canary

Checkout:
`/Users/tareqnaser/Documents/ChatGPT/Marocora Site building/output/marocora-quote-workflow-local`.
Droplet: `207.154.219.205`, Ubuntu, owner-designated 2 vCPU / 4 GB FRA1.
Primary Spaces bucket: `marocora-translation-ledger-ams3`; reserved backup bucket:
`marocora-translation-backups-ams3`. No infrastructure was accessed in this phase.

This is a completed source-preparation milestone and a good fresh-chat point.
Starter:

> Continue **Marocora — DigitalOcean Deployment Canary**. Read
> `docs/deployment/PRODUCTION-BOOTSTRAP.md` and
> `docs/deployment/PRODUCTION-RELEASE-CLOSEOUT.md`. Production bootstrap, real
> Supabase auth/fixed origins, private Spaces adapter and production-only SQL 004
> are implemented; 265/265 tests and both builds pass, including clean staged-source
> verification. Sources are staged, not committed or pushed. Help review and
> deploy the approved release to 207.154.219.205 with private environment values
> and controlled provider canaries. Do not repeat closed V3/video implementation,
> print keys, auto-apply SQL or activate real payments. Respect the production
> migration's clean-state/allowlist requirements and preserve existing history.
