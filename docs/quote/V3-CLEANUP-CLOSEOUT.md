# Marocora — V3 Cleanup Closeout

16 November 2026 (Africa/Casablanca). **Both cleanup tasks complete.** The owner
reports migration 003 was applied to staging; this task did not connect to cloud,
reapply SQL, change managed gates or handle credentials.

## Subsequent Video Integration closeout — 17 November 2026

**LIVEKIT VIDEO INTEGRATION VERIFIED AND COMPLETE.** The owner successfully
connected **Mac (Teacher)** and **Windows laptop (Student)** through the
Cloudflare HTTPS tunnel. Room joins, video, audio and camera toggles all worked.
This is owner-confirmed live evidence; Codex did not rerun a real cloud call in
this documentation closeout. Translation V3 and the owner-applied staging
migration 003 remain completed; no migration was reapplied.

Latest full suite: **258 passed, 0 failed/skipped/cancelled**, with the existing
internet-denial guards. See `../learning/video-closeout-evidence/` and
[the verified LiveKit setup guide](../learning/LIVEKIT-LIVE-SETUP.md). The original
210-test V3 cleanup evidence below remains a historical milestone, not the
current total.

**macOS permission popup:** on smaller displays the camera/microphone prompt's
Allow button can be pushed off-screen. Record this as an owner-observed display
issue, not an unresolved media connection fault. Use a larger display/more
display space or review the browser under System Settings → Privacy & Security
→ Camera / Microphone, then reopen the lesson and confirm site permissions as
needed. No OS bug fix or automatic permission bypass is claimed.

Remaining production work is documented in
[MAROCORA-PRODUCTION-HANDOFF.md](../MAROCORA-PRODUCTION-HANDOFF.md): real payment
gateway, private cloud storage and stable frontend/backend deployment, including
managed learning identity/bookings and durable usage controls. No real merchant
charges, storage migration, customer activation or production deployment occurred
in this closeout.

## pnpm standardization

- Removed `package-lock.json`; preserved `pnpm-lock.yaml` byte-for-byte.
- Retained the pinned `packageManager: pnpm@11.25.0` value in `package.json`.
- Added the pnpm requirement at install/test/build entry points. npm test/build
  commands now refuse with `PNPM_REQUIRED`, before running tests/building output.
- Ignored competing npm/yarn lockfiles; added the canonical commands to README.
- GitHub Actions uses `pnpm install --frozen-lockfile`, `pnpm test` and
  `pnpm run build:pages`. Its test job uses macOS/PostgreSQL 17 because the existing
  full integration runner intentionally requires macOS OS network isolation;
  the separate Ubuntu public-build job waits for those tests. The remote GitHub
  workflow itself was not dispatched or claimed verified in this task.

Verified locally:

```sh
pnpm install --offline --frozen-lockfile --ignore-scripts
pnpm test
pnpm run build:pages
```

The offline install found the lockfile up to date and did not change resolutions.
An initial install in the restricted tool sandbox could not use the existing
package-store setup; the same offline command passed with local execution access.
No downloads or dependency lifecycle scripts were needed for the verification.

## scanned-PDF bypass

Added `tests/fixtures/instant-v3/image-only-scan.pdf`: one synthetic raster page,
no font/text resources or OCR layer, no customer information. Its README records
provenance from the existing harmless raster fixture.

`document-count-core.mjs` now examines PDF resources, including inherited fonts
and nested Form XObjects, inside the existing bounded worker. PDFs without
usable text resources return manual review before calling the word-count API.
Unreadable/ambiguous documents still fail to manual review; text PDFs retain
normal counting. The explicit customer scanned checkbox also bypasses counting.
Auto-detected image-only PDFs are stored with `scanned=true` even when uploaded
with the checkbox false.

Two new tests prove:

1. A counter spy is invoked **zero times** for both the fixture and the same
   raster page nested inside a Form XObject; the actual worker returns manual
   review with a one-page count and null word count.
2. A real authenticated HTTP upload with `scanned:false` creates an SQL row in
   `manual_review`, visible to staff, with null counted/billable words and null
   subtotal/VAT/total/deposit/balance/delivery date. No currency estimation runs,
   no zero-word instant quote is produced, and deposit payment is refused.

The first run exposed an incorrect pdf-lib dictionary `size()` call in the new
preflight. It was corrected to inspect dictionary keys, and the unchanged text
PDF regressions and all new checks passed. Initial failure output is preserved.

## Final verification

**210 passed, 0 failed, 0 skipped/cancelled**: all original **208** plus two new
checks. All **37 preexisting test/fixture files** match the starting hashes.
The frozen offline install, pnpm build, competing-command refusal checks and
`git diff --check` passed. The suite retained its OS/JS internet-denial guards;
ordinary workers reported zero outbound attempts. No existing test was rewritten
or weakened.

Evidence: `docs/quote/v3-cleanup-evidence/` contains the before hashes,
`verification.json`, `pnpm-install.txt`, `pnpm-test-first.txt`,
`pnpm-test-final.txt`, `pnpm-build.txt`, and negative npm-command checks.

## Handoff — Marocora — Production Integration

Checkout: `/Users/tareqnaser/Documents/ChatGPT/Marocora Site building/output/marocora-quote-workflow-local`.
Branch: `codex/marocora-quote-workflow-local`. V3 cleanup and LiveKit cross-device
video integration are complete. Do not reopen LiveKit planning or repeat the
completed V3 cleanup. No commit, push, production deployment or managed DB
change was performed in the final video closeout.

Read [MAROCORA-PRODUCTION-HANDOFF.md](../MAROCORA-PRODUCTION-HANDOFF.md) for the
current next-stage scope and ready-to-use starter prompt. The next phase is
payment gateway integration, real private cloud storage and deployment
preparation. Preserve private credentials, existing OFF-default controls,
pricing/consent rules and the removal of Interpretation from active services.
