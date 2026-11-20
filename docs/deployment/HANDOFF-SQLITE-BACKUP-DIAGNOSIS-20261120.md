# Marocora — SQLite Backup Failure Diagnosis

20 November 2026, Africa/Casablanca. Current task: identify the owner-run SQLite
backup subprocess failure without weakening safeguards or exposing raw output.
NOT VERIFIED. The underlying backup failure is still unresolved.

## Read first and source identity

Read AGENTS.md, this handoff, HANDOFF-LIVEKIT-OFF-HEALTH-FIX-20261120.md,
HANDOFF-SUPPLY-ONBOARDING-20261120.md and newest execution-runbook notes.
Repo: /Users/tareqnaser/Documents/ChatGPT/Marocora Site building/output/marocora-quote-workflow-local.
Branch main. Previous commit 1115237 preserved explicit Host in OFF checks and
snapshotted the five local package helpers/test dependencies. The commit containing
this handoff adds diagnostic categories and tests, not a confirmed backup fix.
Local commits authorized; no push, production access, provider request or gate change.

## Owner evidence and limits

Owner first supplied only stack tail at the backup(f) call (then line 65), then
placeholders, then BACKUP_SQLITE_FAILED with stack frames pointing to healthCheck
line 7/test line 77. Those latter frames are inconsistent with current source:
check.mjs line 7 is a comment, healthCheck never calls backup, and the online-backup
fixture is a separate test. Do not assume these excerpts identify a coherent
current run, or infer that the earlier OFF fix failed from them. Nevertheless the
generic backup helper error was too coarse to diagnose a real SQLite failure.
No exact complete run summary has been supplied. Supply tests only “seem” to pass
according to the owner; do not convert that tentative report into verified totals.

## Diagnostic change

ops/livekit-release/backup.mjs now classifies failed subprocess results into
fixed codes BACKUP_SQLITE_FAILED_{BACKUP|INTEGRITY}_{CATEGORY}. Categories cover
spawn/timeout/termination, unsupported CLI, authorization, read-only/open/permission,
corruption, busy, disk/I/O, WAL/locking and unclassified failures. No child stderr,
argv, paths, database bytes or input are attached to errors or printed. Standalone
CLI prints only these allowlisted codes. All failures still throw; no fallback,
retry, guard removal, source-write permission or copied state bypass was added.

The backup command, readonly source opening, consistent .backup operation,
private-path/ownership/mode checks, integrity check and finalization are unchanged.
The test file adds synthetic diagnostic classification/secrecy coverage; existing
live-WAL backup and corruption/permission checks remain. Twelve package test
declarations now exist. No SQLite database was opened in the agent channel here.

## Observed verification

- Read-only /usr/bin/sqlite3 -version and -help: version 3.51.0 Apple build;
  -init, -batch, -bail and -readonly are listed as supported. This does not prove
  online backup or WAL compatibility. No raw database or real credential read.
- Changed helper/test syntax PASS; scoped whitespace PASS.
- Guarded focused test launch again failed BEFORE Node with
  sandbox-exec: sandbox_apply: Operation not permitted, exit 71.
  Zero assertions executed in this agent channel; no unguarded alternative.
- Prior frontend production build remains applicable; no build inputs changed.

## Next action / starter

Owner should run pnpm test from the repository, then paste the new fixed backup
error code and final totals/all failure blocks. The new code distinguishes backup
from integrity and may identify the cause without raw SQLite stderr. Do not ask
for credentials, production databases, process environments or unrestricted logs.
If no diagnostic appears, confirm the run used the local commit containing this
file before drawing conclusions. Preserve all unrelated working-tree work.

Marocora — SQLite Backup Failure Diagnosis. Read AGENTS.md and this handoff.
Review current owner-run diagnostic and suite totals. The underlying failure is
not yet fixed; agent sandbox still exits 71 before Node. Inspect the fixed phase/
category, implement the narrow cause-based correction locally, preserve readonly/
privacy/integrity/OS/JS/package-manager guards, and obtain guarded verification.
No production, secrets, provider calls, deployment, activation, demand-side work
or push. The larger LiveKit release package remains unfinished.

## Owner-run full summary and snapshot-journal correction — CURRENT

Owner supplied the complete summary: tests 327, pass 326, fail 1, cancelled 0,
skipped 0, todo 0, duration_ms 12605.252083. The only listed failing test is the
online WAL backup test, with BACKUP_SQLITE_FAILED_INTEGRITY_OPEN_FAILED. The shown
mail/worker output includes both network guards reporting zero external attempts.
This supersedes the missing/mixed-error evidence above. It proves the backup
command and private output validation completed, then the read-only integrity
subprocess could not open the new snapshot. Source-based diagnosis: opening the
new WAL-mode copy can require journal/shared-memory initialization. This is not
proof of a corrupt backup, and raw SQLite stderr was not requested or disclosed.

The helper now opens ONLY its newly created private snapshot writable for
PRAGMA journal_mode=DELETE, requires the response delete, then retains the
read-only integrity_check and 0600 ownership/type checks before finalizing it.
A path guard restricts this writable stage to the new target and excludes source.
Source .backup still opens with -readonly. No copying of live WAL files, source
journal change, source checkpoint, weakened guard or raw output exposure.
SNAPSHOT was added to safe diagnostic stages; BACKUP and INTEGRITY remain distinct.

Existing regression expanded to verify DELETE-mode standalone snapshot with no
WAL/shm/journal dependencies, integrity, unchanged source WAL mode/permissions and
later source writes not changing the snapshot. Twelve test declarations remain.
Syntax/whitespace PASS; guarded launch still failed BEFORE Node (sandbox_apply
exit 71); no post-fix runtime pass. No frontend/build inputs changed.

Official references consulted for the source-based correction:
- https://www.sqlite.org/wal.html#read_only_databases (read-only WAL requirements
  and recommendation to convert an image to DELETE mode before read-only use).
- https://www.sqlite.org/backup.html (online backup produces a logical snapshot).

The complete summary plus sole backup failure supports owner-run PASS for the
unchanged supply subset and prior OFF-check fix under the standard all-test runner;
this is an inference from full totals/failure list, not agent-run verification or
a list of individually supplied supply results. The overall suite remains FAILED
until an owner post-fix pnpm test summary has zero failures. No deployment/push.

Next prompt: Marocora — Final Backup Regression Verification. Read this latest
section and owner rerun output. Snapshot-only journal normalization is implemented
but not yet runtime verified. Preserve readonly source, private output, consistent
backup and integrity checks. Do not repeat the resolved source-level SQL/locale/
Host investigations without new evidence. Request exact final suite totals and
all failing blocks; no production, credentials, provider calls, payments or push.

## Standalone publication correction — CURRENT

Owner rerun: tests 327, pass 326, fail 1, cancelled/skipped/todo 0,
duration_ms 12806.316333. The sole failure advanced past backup/normalization/
read-only integrity checks to the test's “snapshot must be standalone” assertion.
No complete pass is claimed. The excerpt explicitly shows supply migration,
HTTP/auth checks passing and both network guards reporting zero attempts.

Read-only metadata inspection of the retained synthetic release fixture found
sessions.sqlite (8192 bytes, 0600) and sessions.sqlite-shm (32768 bytes, 0600),
no WAL or rollback journal. Only known synthetic fixture directories and fixed
SQLite basenames were inspected; no database bytes, credentials or real state read.
The previous helper renamed the entire staging folder, publishing leftover SHM.

Now final read-only verification requires both journal_mode=delete and
integrity_check=ok after reopening. Any remaining WAL or rollback-journal pathname
prevents publication with BACKUP_SNAPSHOT_JOURNAL_PRESENT. Only the verified
sessions.sqlite is moved into a new private .ready directory, then that directory
is atomically renamed to the public snapshot identity. Orphan SHM is retained in
private .pending staging; nothing is deleted or silently pruned. Do not restore
from .pending/.ready directories. Retention remains future owner-reviewed work.
Source opening remains readonly; source journal, ownership and modes unchanged.

The standalone assertion is preserved and names the offending suffix. Added one
regression using a synthetic wrapper around the real SQLite CLI: leaving SHM after
integrity must still publish only the validated main database; leaving a WAL or
rollback journal must fail closed without publishing. The wrapper touches only
synthetic snapshot paths, never the source. Thirteen package declarations now
exist; this adds one test to the next full run, not a claimed passing count.

Helper/test syntax and scoped whitespace PASS. Guarded focused launch still fails
before Node with sandbox_apply exit 71, so the new behavior awaits owner pnpm test.
No frontend/build inputs changed; prior production build remains current. No
push, production/provider action, credential read, feature activation or guard
weakening. Current local commit includes this narrow publication fix and evidence.

Next task: Marocora — Standalone Backup Regression Verification. Read this current
section and review owner full-suite totals/failures for the local fix. Keep all
standalone/source/journal/integrity/privacy guards and diagnose any new failure
from current evidence. Do not repeat earlier resolved SQL/locale/HTTP work.
