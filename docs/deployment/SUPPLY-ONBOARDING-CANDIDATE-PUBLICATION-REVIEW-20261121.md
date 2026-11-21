# Marocora — Narrowed Candidate Publication Review and Freeze Proposal

21 November 2026, Africa/Casablanca. Local review only. Gate 1 OPEN. No freeze, staging, commit, push, CI run, production change or migration application performed.

## Candidate-specific evidence

Owner reports **370/370**, build PASS, offline frozen-lockfile install OK, inputs and lock unchanged. Record as owner-run candidate-specific local evidence, not agent-run tests or production verification. The latest message does not supply duration, detailed fail/cancelled/skipped/todo totals or fresh network-guard output; do not invent them. Earlier 362/362 remains historical working-tree evidence. No build/test rerun was performed for this review.

Candidate: `/Users/tareqnaser/Documents/ChatGPT/Marocora Site building/output/marocora-onboarding-candidate-6db8a6d-20261121`.
Baseline: `6db8a6d0d573a8c401691cd60080e71fad44c03e`, detached worktree; input record says targetPreexisted=false. B remains empty.

Input manifest SHA-256: `72a25ad36fa390490796f3186abb042ff436faf7dc744cb01af956e2013924b9`.

Publication manifest SHA-256: `203ed889c26f0553d41c434b686fe291069b887dcbed9fd1fe20c9520350c0a8`.

Lockfile SHA-256: `73ea2b9589ff807e0d9bf529ed9ae96ce4aa0291ba581283a64d19a38b64f19c`.

## Observed read-only publication review

**PASS: 113 expected files, 113 manifest entries, 113 files on disk.** Expected paths derive from the pinned candidate build script: permitted root public extensions and named files, permitted direct learn assets excluding its two stores, and its explicit bundle outputs. This verifies the build policy and requested exclusions; it is not a new claim that every legacy public page is launch-ready. The complete reviewed path list is below.

- Zero missing or additional paths against the expected set and manifest. All 113 output SHA-256 hashes match the manifest.
- All four supply HTML pages and matching .mjs modules present; supply-client.mjs, supply-copy.mjs, supply.css and site-extra-copy.mjs present.
- professionals.html retains the Apply as a supply partner CTA to supply-register.html. production-login.html/.mjs present; login module retains supply dashboard/review destinations and same-origin /api/auth/login. Dashboard has /api/supply/applications and approved profile link. These are source/reference observations, not hosted auth/API smoke tests.
- No trailing/space-before-extension names or case/space-normalized duplicate paths; no stale extra files relative to the exact expected build set. This cannot establish the contents of a remote deployment/cache.
- No server/test/ops/supabase/node_modules/.git paths, SQL, environment-named files or rollback-named output. No symlinks in the output tree. None of the required supply/CTA/login payload hashes match the rollback-only replacement payloads. The seven-file boundary remains outside publication.
- Every selected input still matches inputs.json; all six B hashes match their pinned HEAD blobs. All fifteen original-checkout overlay files also match the verified candidate hashes, so no local overlay drift was observed during this review.

## Exact proposed commit scope — owner authorization required

Propose a new `codex/supply-onboarding-candidate` branch from the pinned baseline, preserving main and every existing working-tree change. No branch creation or Git mutation is authorized/performed in this review. Commit **17 additions only**: the fifteen tested overlays below plus this review and the new candidate handoff (documentation-only additions). All onboarding code already at the baseline remains inherited, not restaged from dirty local copies.

Before a future authorized commit, use an isolated index based on the full baseline tree and stage only these explicit paths. The filtered worktree omitted protected files; their absence must NOT become staged deletions. Preserve all baseline entries through Git tree/index metadata without reading environment-file contents. Review the exact staged names/status and hashes; any extra modification/deletion, unknown preexisting staging, overlay/hash mismatch or additional dependency is a STOP. Do not use git add ., git add -A or commit -a. Do not copy the existing checkout wholesale. Any changed runtime/test input after this review invalidates its verified identity until reviewed.

| Added path | Verified candidate SHA-256 |
| --- | --- |
| `server/supply-resend.mjs` | `798ce572ca9fac305f8a6419505ca6e4b05ff4e33b8e6a88aed4547000899961` |
| `tests/supply-resend.test.mjs` | `2c7d5766f6f61c85fd6251b1d6765946e718821ef75b6561b621f86eae109f6e` |
| `tests/supply-rpc-containment.test.mjs` | `c30feee2c0e7ed03aa138ce57b252af4f092d2b38c44dc52ba51d1f2da886eb2` |
| `tests/supply-static-boundary.test.mjs` | `0cddf31e5f9beebb630c26608b4451e44e49ab88a5a60ba00b1afcba7908767a` |
| `supabase/rollback/20261121_supply_rpc_suspend.sql` | `c7cf41a282c643a812a5bb9bc132c46a26faaaf56c26edc2a1f23056f98e16fa` |
| `supabase/rollback/20261121_supply_rpc_restore.sql` | `3b182d3c661d65b258ec823841b6c1e2039d4b3ef040b95a954c584203eb1d21` |
| `ops/supply-rollback/static-boundary/manifest.json` | `cb49816a93bfc46f49c75fc5d784aa99f3450ad8b58195ca76aa689a931edbaf` |
| `ops/supply-rollback/static-boundary/README.md` | `c0a194620c84f5fc566c36fbf2f94a87206c69168b0d174454b0fbdbfaa5282b` |
| `ops/supply-rollback/static-boundary/overlay/supply-register.html` | `cd3d189cf2451576a6c08998c03585933dc742ace662731d2ea32f88bb3b0b37` |
| `ops/supply-rollback/static-boundary/overlay/supply-dashboard.html` | `cd3d189cf2451576a6c08998c03585933dc742ace662731d2ea32f88bb3b0b37` |
| `ops/supply-rollback/static-boundary/overlay/supply-review.html` | `cd3d189cf2451576a6c08998c03585933dc742ace662731d2ea32f88bb3b0b37` |
| `ops/supply-rollback/static-boundary/overlay/supply-profile.html` | `cd3d189cf2451576a6c08998c03585933dc742ace662731d2ea32f88bb3b0b37` |
| `ops/supply-rollback/static-boundary/overlay/professionals.html` | `fa1403dbffc5f0d1216302c91b0d9ceb37e5bdeda4f1a1f7282a4d85a86284b0` |
| `ops/supply-rollback/static-boundary/overlay/production-login.mjs` | `c459780c59b20c49a768fc0d1b653d0fe539405407e2e4e3a1efa6777690608a` |
| `ops/supply-rollback/static-boundary/overlay/site-extra-copy.mjs` | `89e1e4606bbf4e74c5f6b5876a328a7b50b66e8a1e05814eff818d8e64772c4e` |

The two additional review-only paths are exactly:

- `docs/deployment/SUPPLY-ONBOARDING-CANDIDATE-PUBLICATION-REVIEW-20261121.md`
- `docs/deployment/HANDOFF-SUPPLY-ONBOARDING-CANDIDATE-VERIFIED-20261121.md`

Their final text/hash must be reviewed at commit authorization; they were not part of the 370-test input manifest. No other dirty documentation or operational work is in the proposed commit. Preserve it locally.

Commit message:

```text
feat(supply): add isolated Resend adapter and rollback readiness artifacts
```

Exclude all six modified B working-tree versions; server/learning-room-store.mjs; recovery/bootstrap/worker tests/support and other untracked operations; generated .pages-dist, .learning-room-assets, node_modules and evidence; credentials/environment changes; CI/config changes. In particular scripts/build-pages.mjs and package.json stay at baseline, since the narrowed build passed. SQL rollback drafts are committed review material only, not migrations or execution permission; mail adapter stays dormant. Do not apply the mail migration or bulk-apply SQL.

## CI expectation and publication hold

The existing workflow expects macOS, Node 24, pnpm 11.25.0 and PostgreSQL 17; frozen-lockfile install, production build, then guarded pnpm test. Require green with zero failures and no unexplained omissions/count regression; reconcile actual counts with the 370 local result. Only a specifically identified existing optional cloudflared skip may be considered under the already documented exception; no new skips are accepted silently. No CI result has been observed for this candidate commit because it does not exist yet.

**Current workflow publishes Pages on push to main and on workflow_dispatch after tests.** Its deploy job rebuilds Pages separately, so the local 113-file manifest is not an attestation of that later rebuilt artifact. Do not push to main or dispatch merely to obtain CI. A separate publication-safe CI plan and explicit authorization must precede any push/dispatch; if existing environment protections or a verification-only branch/PR trigger are not established, stop for a separately scoped decision. Do not change workflows/configuration here. Local commit authorization is not push/publication approval. Required CI must still precede managed application steps.

Gate 1 remains open: actual origin/API routing, paired static/Node rollback and operational recovery suitability remain owner review/evidence tasks. Active directory path is recorded by directory label; source commit UNKNOWN and search CLOSED. No provider calls, credentials, production fixtures, real mail, configuration/feature gate changes, managed SQL, server commands, deployment, commit or push. Preserve all dirty work.

Updated remaining onboarding coding estimate: **1–3 focused hours**, conditional on no new CI/integration issue; owner-assisted recovery/launch gates, production rollout and waiting are additional. Local coding may already be functionally complete, but CI and hosted smoke checks can reveal further work. This is an estimate, not a launch guarantee.

## Exact expected publication paths

```text
9e214abf-95c6-43e7-b4d5-20c17e8ff5a8.png
CNAME
GOPR1269.JPG
IMG_2526.jpeg
application.html
application.mjs
booking-confirmation.html
booking-data.js
booking-success.html
booking.html
contact-thank-you.html
contact.html
hero-globe.jpg
home-copy.mjs
home-language.mjs
index.html
join.html
launch-report.css
launch-report.html
launch-report.mjs
learn/account-view.mjs
learn/account.html
learn/account.mjs
learn/api.mjs
learn/app.mjs
learn/browse-translations.mjs
learn/catalog.mjs
learn/config.mjs
learn/currencies.mjs
learn/i18n.mjs
learn/index.html
learn/instructor-copy.mjs
learn/instructor-translations.mjs
learn/instructor-validation.mjs
learn/instructor.css
learn/instructor.mjs
learn/launch-copy.mjs
learn/launch-translations.mjs
learn/learning-room-session.mjs
learn/lesson-login.mjs
learn/live-learning-room.mjs
learn/livekit-diagnostics.mjs
learn/locale.mjs
learn/mock-learning-room.mjs
learn/profile-fields.mjs
learn/publication-view.mjs
learn/review-translations.mjs
learn/review-view.mjs
learn/room-copy.mjs
learn/schedule-time.mjs
learn/schedule.html
learn/schedule.mjs
learn/staff-review.mjs
learn/styles.css
learn/supabase-public.mjs
learn/taxonomy.mjs
learning-room.css
learning-room.html
learning-room.mjs
lesson-decision.html
lesson-request.html
lesson-thank-you.html
payment.html
production-login.html
production-login.mjs
professionals.html
receipt.css
service-account.mjs
service-review.html
service-review.mjs
service-verification.mjs
site-copy.mjs
site-extra-copy.mjs
site-language.css
site-language.mjs
site-services.mjs
site-ui-copy.mjs
staff-review.html
supply-client.mjs
supply-copy.mjs
supply-dashboard.html
supply-dashboard.mjs
supply-profile.html
supply-profile.mjs
supply-register.html
supply-register.mjs
supply-review.html
supply-review.mjs
supply.css
teacher-apply.html
teacher-sample.html
teachers-data.js
teachers.html
thank-you.html
translation-copy.mjs
translation-request.html
translation-request.js
translation-service.css
translation-service.mjs
translation-thank-you.html
translation-validation.mjs
translator-application-thank-you.html
translator-apply.html
translator-sample.html
translator-tanya-naser.html
translator-tareq-naser.html
translators.html
vendor-client.mjs
vendor-review.html
vendor-review.mjs
vendor-view.mjs
vendor-workflow.css
verify-email.html
```
