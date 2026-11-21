# Marocora rollback-only supply static boundary

Local artifact only. **Not deployed; no production authorization.**

`overlay/` contains seven replacements for an explicitly approved rollback static deployment. It is a partial overlay, not a complete site and not an `index.html` hosting root. `manifest.json` identifies every payload file/hash and fourteen untouched authored source files. The artifact lives under `ops/`, outside the normal build script's root/learn web-file copying. It has no installer, build hook, server import or automatic deployment.

The four supply HTML entry points contain only accessible EN/FR/AR/ES unavailable notices and public navigation. They have no forms, scripts, remote resources, API calls or query reflection. The professional-page supply CTA becomes the notice, preserving unrelated page content and legacy links. The login overlay removes supply destinations, routes all four supply return paths to `/professionals.html#supply-unavailable` before requesting credentials, and preserves the ten existing legacy login destinations and same-origin auth request.

The public professional page is used as the login fallback because its path is present in the old Node public allowlist. `site-extra-copy.mjs` is copied from the known local `346be72` source, omitting the newer supply-copy dependency that old Node does not allow. This is an inspected local source choice, not an assertion that the server directory contains that commit. The other required locale modules must come from the approved complete static base; this overlay is not their replacement. Four-language boundary text is present inline, marked to avoid shared translation rewriting.

## Verification and provenance

- Payload hashes, exact seven-file inventory and fourteen original-source fingerprints checked statically.
- Four notice pages parsed for inert markup, languages, navigation and unique IDs. Professional CTA and shared-import checks passed.
- `production-login.mjs`, `site-extra-copy.mjs` and the new test file passed `node --check`.
- `tests/supply-static-boundary.test.mjs` has ten synthetic declarations, including fake-DOM/fake-fetch VM checks for login redirects, no auth on supply returns, legacy destinations, external/malformed redirects, failures and query/token exclusion. **Behavioral execution pending.** No unguarded run or unchanged failing agent-harness retry.
- No new browser preview, narrowed-candidate build/test or full-suite run. Visual layout and actual hosted routing remain unverified.

The original onboarding HTML/modules, professional page, login module and locale module are unchanged. The payload is an immutable-by-review snapshot: a legitimate future source change requires a newly reviewed boundary/manifest, not changing test expectations merely to pass.

## Limits before any later deployment

1. Owner approval must identify the complete static base, route map, overlay fingerprints and coordinated Node rollback. Do not publish this folder wholesale or copy it into the live source as an informal fix.
2. Old Node itself rejects the four supply page paths. Their static unavailable pages require an approved static/Pages-serving route or a separately authorized proxy boundary. No Node allowlist/configuration was changed. The professional fallback path is allowed, but the real served professional/login assets must be verified.
3. This artifact is not the database fence. The separate full-RPC suspension must be specifically authorized/applied/verified for rollback; its 15/15 owner-run disposable proof is not production application.
4. Old browser tabs/caches, confirmation links, global Auth signup, unrelated join/legacy workflows, private storage and in-flight requests remain outside static enforcement. No claim of total account-signup suspension. A static notice may return HTTP 200; no custom 503/Retry-After or cache behavior is promised.
5. Do not change DNS, auth settings, dependencies, configuration, payments, workers, booking, video or email wiring. No SQL, restart, deployment, commit or push is authorized by this artifact.

Gate 1 stays open. The B-empty onboarding candidate is separate and remains unbuilt/untested; the historical 362/362 applies only to the earlier working tree. Active source commit remains UNKNOWN and the identity search is closed.
