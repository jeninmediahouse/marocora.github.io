# Marocora — Supply Onboarding Launch Record

## Live state, 25 November 2026, 23:40 UTC (current)

Production is `/srv/marocora/releases/supabase-5628ab3.legal-20261125-r1`,
source `5628ab31d48807dea9ec0b34669e65856911a064`, PM2 registration
`marocora-supply-5628ab3` online on 4195; `pm2 save` performed. Published files
121; guarded suite 431/431. This release adds `legal.html`, `privacy.html`,
`terms.html`, `imprint.html` and `legal.css`, with footer links from the
homepage, contact and learning pages. Verified after switch: all four pages and
their stylesheet are byte-identical to the frozen build, private pages still
redirect 302, `/api/auth/me` still 401, and the public profiles API is intact.
`marocora-supply-22da9ff` is stopped and retained for rollback.

## Previous live state, 25 November 2026 (superseded)

Production is `/srv/marocora/releases/supabase-22da9ff.site-polish-20261125-r1`,
source `22da9ff3f74b21263daa3a69709ef2c8ac71587f`, served by PM2 registration
`marocora-supply-22da9ff` online on port 4195; `pm2 save` was performed.

That commit is a one-line correction over `b6d3735` — the homepage loaded the
shared language script but not `site-language.css`, so the bar rendered unstyled.
The fix adds the stylesheet every other page already loads, plus a regression
test. Verified after switch: live `index.html` is byte-identical to the frozen
build (`2c62022e24b75cd1834518a4bf84c566ea571818f5fe2d0e76cadd515a039`), the old
four-button bar markup is absent, and the language control renders with the
shared dark-green styling. Suite 442/442 in the isolated build.

Retained rollbacks on the server: `marocora-supply-b6d3735` (stopped) and, before
it, `marocora-supply-df35fe5`. No SQL, template, DNS or legal-page change was
deployed in this step.

Same-day operations unrelated to the site release, recorded here so the date is
traceable: a deleted DigitalOcean Spaces key had stopped `translation-db-backup`
and `translation-db-prune` since 18 November; both were repaired and verified
(snapshot `db/2026-11-25T200512Z`), an alerting unit
`marocora-db-freshness.timer` was installed, and the first database restore drill
passed. See `BACKUP-OUTAGE-AND-REPAIR-20261125.md` and
`RESTORE-DRILL-RESULT-20261125.md`.


Code-recovery follow-up23November (LOCAL ONLY):773cd7c87abcdbbf699134a2ff40ba877504eb96
fixes two synthetic fixtures and exposes Send a new code on the initial form.
Three-file commit; server logic unchanged.24reset/full412expected-not-run; owner
427pass/2fail diagnostic inputs not established as clean-candidate release proof.
116names/digest unchanged; wrappers retuned to773cd7c/newroot, not run. Live still
owner-reported1dc890c; no deploy/template/SQL/push/restart/send. Prior notes retained.

## Code recovery preparation and owner live-state update23November

Owner reports live /srv/marocora/releases/supabase-1dc890c.final-precampaign-20261123-r1,
source1dc890c, PM2marocora-supply-1dc890c online4195, save performed; f48stopped.
SMTP already working via Resend/auth.marocora.com. These facts supersede older
pending-rollout/shared-sender entries below, not independently rechecked by agent.
Owner's accepted-link/page-error evidence closes redirect investigation; no retry.

New local candidate76b9beea858dabc64b445300a4b8a49c1ba1762f prepares six-digit code
recovery, honest ambiguous/provider/service reasons, per-email/IP limits and Send
a new code; not deployed.116public filenames/digest unchanged; expected412suite,
not run. Deploy new code-capable release FIRST, owner Reset password template
Token-only edit SECOND, then specifically authorized legitimate code smoke. No new
SQL/SMTP/provider/DNS/auth-rule changes. Excluded QA owner may test recovery but
must never be approved/published; genuine-publication proof uses another eligible
non-excluded consenting vendor, otherwise OPEN. Current1dc403owner-run evidence
does not prove new candidate. No agent build/tests/email/template/production step.
See HANDOFF-CODE-PASSWORD-RECOVERY-20261123.md and committed exact template/order
in CODE-PASSWORD-RECOVERY-PREPARATION-20261123.md. Prior records retained below.

Final compatibility update23November (PREPARATION, NOT DEPLOYED): frozen source
1dc890cf0d472d121bd640141e207160a8bd108a supersedes e84ebc7; do not verifye84ebc7.
Exactly two source/test files changed for timeout feature detection and two cases;
no other runtime behavior or filename change. Expected403suite/10directory tests,
not run.116count/digest76cb1e372b588ea800140eb7bb8522516c6e74e41f667256a3c4b38dd7fd14de
unchanged, no filename-set recomputation needed; lock unchanged. New planned root
/srv/marocora/releases/supabase-1dc890c.final-precampaign-20261123-r1.
Retuned existing wrapper/README locally, no execution/new workspace file. B/dirty/
mail/failed directories/registrations preserved, index empty. Live remains f48;
all isolated-build/guarded-suite/CI/SQL/SMTP/publication gates remain open. Older
e84ebc7/401references below are historical, not current release instructions.

## 23 November final-campaign preparation addendum — NOT DEPLOYED

This addendum preserves the completed22November f48 release record below.
Live remains owner-recorded f48c343/113public files; no fresh production check.
The new frozen local candidate is e84ebc7b1681024e3a39b6d0e13b5d008e07fe16,
not pushed/deployed. Prepared product promise: one published-partner section on
professionals.html, with public name/type/bio and direct unauthenticated profile
links. No search/city browsing/ratings/ranking/map/booking. API is eligibility
authority; fail-closed public-contract validation prevents false-consent leakage.
Existing100profile cap is a known limit; no pagination. This behavior is prepared
in code, not yet delivered by the live site. Do not advertise live discovery yet.

- the corrected optional-video file's 4 tests pass (owner-run)
- a 410-test dirty-tree suite passed, as debugging evidence only
- the frozen candidate's expected total, stated as expected-not-run
- isolated build, guarded suite and CI for the frozen candidate: unconfirmed

Concrete expected total:401, expected-not-run. Eight directory declarations added
to393; no tests deleted.410 is never release evidence. New public filename count
116, one addition supply-directory.mjs, no rename; expected name-set digest
76cb1e372b588ea800140eb7bb8522516c6e74e41f667256a3c4b38dd7fd14de.
This is source-name evidence only, not a new build. Local source commit10files,
no B/unrelated dirty work. SQL/adapter/mail migration untouched in this batch.

Auth delivery is a campaign prerequisite. Owner states shared sender is currently
the only Auth channel; it is not a production fallback. Pre-switch actual SMTP
receipt via isolated non-production Supabase dashboard configuration (P1) must
precede an authorized production SMTP switch; post-switch real Auth receipt/link
proof (P2) is separate. Credentials only privately in dashboard. Recovery is
previously verified custom configuration if available, otherwise controlled pause
and correction. No default-sender fallback, real sends or settings changes here.

Open gates: frozen-source isolated build/guarded401suite/matching CI; owner
target/backup/preflight and optional-video migration202611230001 before deploy;
frozen-source staging/canary/live switch; provider/auth-domain DNS/Google DKIM/
DMARC and P1; authorized SMTP switch and P2; confirmation-template proof if only
recovery tested; genuine eligible-vendor API/profile/directory discovery proof.
If no eligible approved consenting vendor exists, publication verification=OPEN.
No synthetic production vendor, demonstration-only approval or consent bypass.

Read FINAL-PRECAMPAIGN-LAUNCH-GATES-20261123.md,
HANDOFF-FINAL-PRECAMPAIGN-FROZEN-20261123.md and ops/final-precampaign-stage/README.md.
Any commit after verification requires new build/CI/canary; do not verify803648b.
New helper/artifact paths preserve all prior/failed roots and old registrations.
No build/tests/DNS/provider/API/credentials/SQL/push/deploy/restart/save/smoke in
this preparation. Operational record/inventory updates are outside frozen source.

---

22 November 2026, Africa/Casablanca. **This records a completed production
change.** It is not an instruction or an authorization.

## What is live

The vendor supply-onboarding release is serving `marocora.com`. nginx proxies
every path for `marocora.com` and `www.marocora.com` to `127.0.0.1:4195`, which
is now the new application. The application serves its own pages from
`<release>/.pages-dist` behind the allowlists in
`server/production/site.mjs`; GitHub Pages is not in the live request path.

| Surface | Result |
| --- | --- |
| `https://marocora.com/` | public homepage, unchanged |
| `https://marocora.com/supply-register.html` | live sign-up page (previously 404) |
| `https://marocora.com/health` | `{"status":"ok"}` |
| `https://marocora.com/api/auth/me` | `401 {"error":"AUTH_REQUIRED"}` |
| `https://marocora.com/api/supply/profiles` | `[]` — nothing published |
| `https://marocora.com/supply-review.html` | reviewer queue for authorized staff; `SUPPLY_ADMIN_REQUIRED` for everyone else |

## Release identity

```text
Release path   /srv/marocora/releases/supabase-f48c343.onboarding-20261122-r1
Source commit  f48c343429888ffc060a37d318e601ba29e36081
Public pages   113
Dependency files (regular)  11206
```

```text
archiveSha256            993372011b4971610abe96f7877d857d0715a6bed0a556881639bda5f753e174
manifestSha256           c519fbe8bc01fdaa13af4be9284d472547bc1ef639282eed1bdbc324808ca6ab
freshPagesManifestSha256 9e3d946bdf7994ca29d64eea7ba3d388d2b4b38300e1dbc499dc6abf69a742e3
helperSha256 (server-stage.py) fbb4fcbecbe2ea640f2531d6e72842397470704dd58d5fbaa55dcc4bb15a2357
```

The archive hash was reproduced identically on five separate builds, and the
113-file set matched the pre-existing local build with zero differing files.

`<release>/.env` is a blind byte copy of the previous release's file, owner
`marocora`, group `marocora`, mode `0600`. Its contents were never read,
printed or hashed by any tool in this work. `SUPPLY_PAYOUT_ENCRYPTION_KEY` is
deliberately absent; it is only needed when bank details are submitted.

## PM2 state as saved

| id | name | status | notes |
| --- | --- | --- | --- |
| 0 | `marocora` | stopped | pre-existing registration, purpose unknown, untouched |
| 1 | `marocora-modern-346be72` | **stopped** | previous release, preserved as rollback |
| 3 | `marocora-supply-f48c343` | **online** | pid 938983, `127.0.0.1:4195` |

`pm2 save` was run after the switch, with the new process online and the old
one stopped. PM2's `resurrect` behaviour for stopped entries was **not**
independently verified; do not rely on it without checking after any reboot.

Launch shape of the live process:

```text
/usr/bin/env -i HOME=/home/marocora PATH=<tool path>
  /opt/node/node-v24.20.0-linux-x64/bin/node
  --env-file=.env server/start-production.mjs
```

managed by PM2 as `/usr/bin/env` with `--interpreter none`, cwd set to the
release path.

## Database

Applied earlier and unchanged by this launch:

- learning bootstrap — `202611190002_learning_bootstrap.sql`
- supply onboarding — `202611200001_supply_onboarding.sql`

No SQL, grant or auth-rule change was part of this deployment.

Backup reference point: **22 Nov 2026 03:46:47 UTC, PHYSICAL.**

## Deliberately off

Payments, merchant services, email sending, learning video, bookings and
workers remain disabled. The dashboard states "Payments are paused" and the
payout panel stays in a pending state.

## Verification performed

Local, before transfer: offline install, page build, exact 113-file gate,
allowlist membership, hash manifest, no private or environment files in the
payload.

On the server, before the switch: archive and manifest hashes, tar member
safety, 113-file set, 11,206 dependency files, ownership and mode checks,
`node --check` on every server module, production import resolution, blind
`.env` copy.

Canary on port 4196, twice (start, then restart): `/health` 200, `/api/auth/me`
401, `/api/supply/profiles` 200 `[]`, `/supply-register.html` 200 HTML, gated
pages redirect to `production-login.html`. Canary deleted, 4196 closed, live
4195 and the old release metadata unchanged throughout.

After the switch: the four local probes passed, the public endpoints listed
above passed, and one real owner profile was submitted and saved as
**pending review**.

Reviewer pipeline verified the same day: one verified account was added to
`public.learning_review_staff` as an independent reviewer, the queue rendered for
that account, and the owner's pending application was **rejected** with a reason.
The rejection was recorded, the queue emptied, and `/api/supply/profiles`
remained `[]`. Approval with publication was not exercised; the submitted
profile carried no publication consent, so approval could not have published it.

## Known gaps

| Gap | Effect | Status |
| --- | --- | --- |
| **No password-reset page** | a vendor who forgets their password cannot regain access; no page accepts a recovery link | open — highest priority |
| Introduction video is mandatory | a teacher without a video cannot apply | open — needs a code change plus a new migration |
| Double Marocora header on supply pages | cosmetic | open |
| Redundant "Create an account" link on the create-account page | cosmetic | open |
| Stopped `marocora` (id 0) registration | unexplained legacy entry | recorded, untouched |

Reviewer access is now granted to one verified independent account. Self-review
remains refused by the database, so an applicant's own account can never decide
its own application. The remaining operational gap is password recovery: there is
no page that accepts a Supabase recovery link, so a locked-out vendor stays
locked out.

A new account for the reviewer was created manually after the original was
deleted to free the email address. Note that once that account records a review,
it can no longer be deleted, because review history references it.

## Rollback

The previous release and its `.env` are untouched. Rollback is a process swap,
not a restore.

```bash
runuser -u marocora -- /usr/bin/env -i HOME=/home/marocora PM2_HOME=/home/marocora/.pm2 \
  PATH=/opt/node/node-v24.20.0-linux-x64/bin:/usr/local/bin:/usr/bin:/bin \
  /opt/node/node-v24.20.0-linux-x64/bin/pm2 stop marocora-supply-f48c343

ss -ltnp | grep 4195 || echo "PORT_4195_FREE"

runuser -u marocora -- /usr/bin/env -i HOME=/home/marocora PM2_HOME=/home/marocora/.pm2 \
  PATH=/opt/node/node-v24.20.0-linux-x64/bin:/usr/local/bin:/usr/bin:/bin \
  /opt/node/node-v24.20.0-linux-x64/bin/pm2 restart marocora-modern-346be72
```

After a rollback the expected old behaviour returns: `/api/supply/profiles`
answers `AUTH_REQUIRED` and `/supply-register.html` returns `NOT_FOUND`. Those
are restore evidence, not failures. A rollback leaves the supply database
objects and their grants in place; a full database restore is a separate
last-resort decision with accepted data loss.

## Retained artifacts

```text
/srv/marocora/releases/supabase-f48c343.onboarding-20261122-r1.failed-20261122-r1
/tmp/marocora-supply-f48c343-20261122-r1.failed-20261122-r1
```

Both are incomplete earlier attempts, renamed rather than deleted. Keep them
until someone reviews them; deletion needs explicit authorization.

Local evidence for the successful build:
`<build worktree>/docs/deployment/fresh-stage-evidence/` (`pages-output.json`,
`release-manifest.json`, `payload.tar`, `hashes.json`).

## Do not

- Do not delete either `.failed-20261122-r1` directory without authorization.
- Do not delete or replace the stopped `marocora-modern-346be72` registration.
- Do not run `pm2 save` again while the state is anything other than new
  online / old stopped.
- Do not enable payments, email, video, bookings or workers as part of any
  follow-up fix.
- Do not treat this file as permission for anything.
