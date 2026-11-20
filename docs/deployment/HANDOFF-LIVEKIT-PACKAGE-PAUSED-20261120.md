# Marocora — LiveKit Local Package Paused for Supply Onboarding

20 November 2026. Owner explicitly shifted priority to supply-side onboarding.
LiveKit package work remains incomplete and preserved; no commit, push, freeze,
production action, credential read or feature activation occurred.

## Local work since the previous handoff

Owner authorized local package preparation, a scoped local commit, Nginx admission
drain documentation and a lightweight local SQLite backup. Drafts now exist in
ops/livekit-release/{contract,launch,freeze,backup,check}.mjs and
 tests/livekit-release-package.test.mjs. No frozen artifact/manifest has been
produced. Drain/rollback documentation and review remain unfinished. Do not call
these drafts verified or deployment-ready.

New focused guarded test launch and explicit escalated retry both failed BEFORE
Node: `sandbox-exec: sandbox_apply: Operation not permitted`, exit 71. Zero new
behavioral tests ran. Syntax checks passed for launch.mjs and backup.mjs only.
The owner did not supply test results; their reply changed task priority.
Earlier build/owner-run 298 passes apply to the earlier recovery implementation,
not to these new package drafts. Preserve OS and both JavaScript network guards.

## Active task

Build supply-side teacher, translator/agency and transport onboarding locally:
new schema, owner forms/dashboard, protected admin review, pending payout storage,
private credential uploads and synthetic tests. Payments, demand-side additions,
production access/deployment and credential access remain forbidden.

## Resume prompt for the paused package

Marocora — LiveKit Release Package Verification. Read AGENTS.md, this handoff,
HANDOFF-LIVEKIT-RELEASE-PACKAGE-20261120.md and the current supply-side handoff.
Inspect the five package drafts and ten new synthetic tests. Finish drain and
rollback documentation; obtain guarded behavioral verification; review before any
scoped source commit/freeze. Preserve newer supply-side and unrelated owner work.
Local commit authorization was for the LiveKit package, not arbitrary changes.
No push, deployment, production commands, secrets or feature activation.

## Later OFF-health fix and local source snapshot

The later owner-run suite reached the OFF-health check and reported
RELEASE_HTTP_CHECK_FAILED. Owner explicitly requested its repair and a local
commit. See HANDOFF-LIVEKIT-OFF-HEALTH-FIX-20261120.md. That commit now tracks the
five existing helper drafts plus their test file so imports are self-contained;
the earlier uncommitted/no-test-evidence wording above is historical. No complete
passing suite, frozen release artifact, deployment or activation is established.
