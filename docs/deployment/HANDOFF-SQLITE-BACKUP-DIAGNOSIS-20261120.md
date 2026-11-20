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
