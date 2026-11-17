# Marocora — Managed Cloud Verification

Recorded 15 November 2026. Read this and the report before repeating any work.

- Checkout: `/Users/tareqnaser/Documents/ChatGPT/Marocora Site building/output/marocora-quote-workflow-local`.
- Branch: `codex/marocora-quote-workflow-local`; HEAD unchanged:
  `127cba9a6b6a429f4913b9cb70b154fc234dbe41`. No commit/push/deploy in this task.
  Preexisting uncommitted changes remain; do not attribute the whole git diff to
  this task or reset it.
- Completed: mock-cloud failure tests, role spoof/allowlist checks, real disposable
  SQL RLS/ACL/scan/gating/seed/migration resilience, JavaScript guards plus macOS
  kernel internet denial. Final `npm test`: **188/188**, zero failed/skipped.
  Original 173 checks and all 33 prior test/fixture files preserved byte-for-byte.
- Primary artifacts: `docs/quote/AUTONOMOUS-TEST-REPORT.md`, its
  `autonomous-evidence/` directory, and `docs/quote/STAGING-SETUP.md` →
  **Managed Cloud Verification (Owner Action Required)**.
- SQL identities: `supabase/migrations/202611140001_translation_workflow.sql` and
  `202611140002_translation_seed.sql`. Do not regenerate/reapply unrelated SQL.
  The owner must configure seed Auth UUIDs in their SQL Editor copy, not Git.
- Managed cloud has not been contacted. Actual schema/accounts/settings/OFF state
  are unknown. Credentials must stay private; do not read credential files or
  request passwords, JWTs or keys in chat.
- Next task: owner follows the ten numbered manual setup/verification steps in
  STAGING-SETUP, then provides only sanitized results/errors. No need to repeat
  local investigation or tests unless source changes or a managed error warrants it.
- Open decisions: intended staging project, synthetic Auth UUIDs, whether to run
  the optional synthetic upload walkthrough. No production/public launch decision
  is implied. File bytes remain local; scanner/mail remain mocks.
- Runner is macOS-specific and fails closed without its OS policy. Standalone
  SQL command and exact evidence are in the guide/report.

Ready-to-use starter prompt:

> Continue **Marocora — Managed Cloud Verification**. Read
> `docs/quote/MAROCORA-MANAGED-CLOUD-HANDOFF.md`,
> `docs/quote/AUTONOMOUS-TEST-REPORT.md`, and the Managed Cloud Verification section
> of `docs/quote/STAGING-SETUP.md` in the checkout above. Local preparation is done
> (188/188); do not repeat it. Help interpret my sanitized owner-run staging
> outcomes and fix only evidenced issues. Keep credentials private, do not read
> credential files, and do not connect to production or enable public access.
