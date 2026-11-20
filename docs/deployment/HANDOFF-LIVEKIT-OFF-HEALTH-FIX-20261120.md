# Marocora — LiveKit OFF Health Verification

20 November 2026, Africa/Casablanca. Current step: owner-run full-suite rerun
following local OFF-health checker fix. NOT VERIFIED; no exact final totals yet.

## Sources and scope

Read AGENTS.md, this handoff, HANDOFF-SUPPLY-ONBOARDING-20261120.md,
HANDOFF-LIVEKIT-PACKAGE-PAUSED-20261120.md and current execution-runbook notes.
Full supply failure history remains in SUPPLY-ONBOARDING-PLAN-20261120.md.
Repo: /Users/tareqnaser/Documents/ChatGPT/Marocora Site building/output/marocora-quote-workflow-local.
Branch main; previous commit 27de9b3 (supply localization). Owner explicitly asked
for this OFF-health fix and a new LOCAL commit hash; no push or production action.

The existing ops/livekit-release/{contract,launch,freeze,backup,check}.mjs and
 tests/livekit-release-package.test.mjs were untracked. The commit containing
this handoff includes those helper/test sources so the snapshot's imports are
self-contained. Only check.mjs and its tests were changed for this fix. Contract
identity/configuration rules and production routing/auth were reviewed and left
unchanged. No source archive or release-manifest.json was generated. The package
remains a draft: drain/rollback documentation, frozen full recovery source,
Linux artifact preparation and operational validation are unfinished. Recovery
implementation, worker changes and unrelated owner work remain outside this commit.

## Owner evidence and diagnosis

Owner says supply tests now seem to pass, but supplied no full counts or complete
passing supply output. Record that as tentative owner reporting, not a verified
milestone. Concrete failure: tests/livekit-release-package.test.mjs, credential-free
OFF checks, RELEASE_HTTP_CHECK_FAILED from healthCheck(). No response body/status
was supplied. Source-based diagnosis: fetch with a loopback URL can replace the
explicit Host, triggering production HOST_DENIED before the intended route.
Supply handlers only match /api/supply/ and do not intercept these learning routes.
Do not claim a routing regression or a confirmed runtime diagnosis from this excerpt.

## Local fix

- check.mjs uses node:http.request with explicit Host/Origin and no redirect
  following, a five-second overall timeout, bounded response bodies and fixed
  error codes. Base is constrained to credential-free HTTP on 127.0.0.1.
- Preserved checks: both approved Hosts health 200 with exact {status:ok}, foreign
  Host 403, unauthenticated room-config 401, local login endpoint 404, private page
  redirect 302 and foreign POST Origin 403. No authentication tokens/provider calls.
- Actual production-routing fixture now captures all seven request Hosts and
  the foreign-Origin POST. Negative coverage rejects malformed/wrong health
  bodies, redirects without following, foreign-Host and foreign-Origin acceptance,
  and nonloopback targets. Eleven package test declarations now exist.
- No video gate, role/auth condition, expected status, source manifest contract,
  package manager, network profile or network guard was weakened.

## Verification and next action

All five helper modules and test-file syntax PASS (six files). Scoped whitespace
PASS. Focused unchanged guarded launch again failed BEFORE Node:
`sandbox-exec: sandbox_apply: Operation not permitted`, exit 71. Zero assertions
ran in the agent channel; no unguarded fallback. Earlier production build remains
current: no browser/build inputs changed in this fix. Owner must run pnpm test and
supply all failure blocks and final counts. Do not mark either milestone PASSED
until current evidence supports it. No deployment, provider request, real env/
credential access, push, migration application, worker or gate change occurred.

Starter: Marocora — Full-Suite Verification. Read this handoff, AGENTS.md and supply
handoff. Review owner pnpm test results for the local commit containing this file.
OFF checker now uses explicit Host node:http transport; all strict status/body/
origin checks remain. Agent guarded channel still exits 71 before Node. Preserve
unrelated work; fix observed failures locally without touching production,
credentials, demand-side flows, payments or gates. Scoped local commits authorized;
no push. The LiveKit package is not yet an executable release package.
