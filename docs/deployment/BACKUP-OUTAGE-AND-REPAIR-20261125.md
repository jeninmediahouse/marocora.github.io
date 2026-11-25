# Backup outage and repair — 25 November 2026

Status: **repaired and verified by a fresh snapshot and a successful prune.**
Scope: the two scheduled jobs `translation-db-backup` and `translation-db-prune`
on the production server. No website, database, payment, booking, merchant,
video or mail change was made.

## What broke

Both jobs exited 1 and reported only their catch-all codes, `DB_BACKUP_FAILED`
and `DB_PRUNE_FAILED`. Nothing in the live site was affected and no database
write failed. The damage was confined to recovery: no new off-site database
snapshot was written for six nights.

## Measured window

| Event | Timestamp (UTC) |
| --- | --- |
| Last successful automatic snapshot | **2026-11-18 03:10:13** (`db/2026-11-18T031013Z`) |
| First missed nightly run | 2026-11-19 03:10 |
| Diagnosis and repair | 2026-11-25, from 19:30 |
| First successful manual snapshot | **2026-11-25 20:05:12** (`db/2026-11-25T200512Z`) |

Six scheduled runs were missed. Snapshots from 19 October onward had been
written daily until 18 November; the 30-day retention then deleted the eight
expired prefixes (19–26 October) during the repair, leaving 24 snapshots from
27 October to 25 November.

## Root cause

The DigitalOcean Spaces access key stored in
`/etc/marocora-translation-worker/backup.env` no longer existed. A read-only
probe that builds the same S3 client and lists the bucket reported:

```text
SPACES_LIST ClientError InvalidAccessKeyId
DB_SELECT OK 1
```

`InvalidAccessKeyId` means the provider has no record of that key ID at all —
it had been deleted or replaced, most likely on 18–19 November when provider
credentials were being rotated. The job's own error handling masked this:
`translation-db-backup-once.py` prints `DB_BACKUP_FAILED` for any exception
that is not a `ValueError` carrying one of four fixed codes, and botocore
raises `ClientError`, so the journal carried no actionable detail.

A second attempt used a saved replacement pair that was created with
**Limited Access**; DigitalOcean then answered `AccessDenied` for every
operation (`ListBuckets`, `HeadBucket`, both prefixes), because that key's
allowed-bucket list did not cover `marocora-translation-backups-ams3`. A key
that authenticates but is authorised for nothing produces the same catch-all
code as a deleted key.

## Eliminated hypotheses (each checked, not assumed)

All of the following were verified healthy and are not involved:

- Python 3.12.3 with `boto3` 1.34.46 and `psycopg` 3.1.17 importable
- `/usr/lib/postgresql/17/bin/pg_dump`, `pg_dumpall` and `/usr/bin/age` present
- `database.json` and `backup.env` owned `root:root`, mode `600`, as
  `checked_file()` requires
- `/var/lib/marocora-db-backup-status` present, `root:root 755`
- Spaces endpoint reachable over HTTPS
- Database authentication and a `select 1` round trip both successful
- The units' `ProtectSystem=strict` without `ReadWritePaths=` is not the cause:
  the script writes only to a private `/tmp` and to the systemd-provided state
  directory, both writable

## Repair performed

1. A replacement Spaces key was created in the DigitalOcean console with
   **Full Access** on the account that owns the bucket.
2. The key was installed into `backup.env` through silent prompts (`read -rs`),
   so neither value entered shell history or terminal scrollback; the file was
   written under `umask 077` and set to `root:root 600`.
3. Read-only probes confirmed `LIST_BUCKETS OK`, `HEAD_BUCKET OK` and successful
   prefix listings.
4. `systemctl start translation-db-backup.service` returned `Result=success`,
   `ExecMainStatus=0`, `DB_BACKUP_UPLOADED`; the new snapshot contains all four
   artifacts (`full.pgcustom.age`, `roles.sql.age`, `validation.json.age`,
   `manifest.json`).
5. A read-only preview of each manifest's `expires_utc` showed exactly eight
   expired prefixes before any deletion.
6. `systemctl start translation-db-prune.service` returned `Result=success`,
   `ExecMainStatus=0`, `DB_PRUNE_OK`; snapshot count went 32 → 24 and object
   count 128 → 96, matching the preview exactly.

No unit file, script, database object, or site file was changed. The two units
were already correct; only the stored credential was wrong.

## Why nobody was told

This is the more important defect:

- `translation-db-backup.timer` and `translation-db-prune.timer` are enabled,
  so they kept running and failing nightly.
- The only unit that could have noticed is `translation-health`, and it is
  **disabled**. Its `ExecStart` is the worker's
  `server/translation/monitored-runner.mjs health`, so it monitors the
  translation worker — which is intentionally stopped pending an RPC-based
  rebuild — and would fail for that reason regardless of backups.
- No external monitor URL is configured (`MONITOR_URL` does not appear in
  `monitor.env`).

There is therefore **no backup-specific alerting at all**, and six nights of
failure produced no notification of any kind.

## Open items

- **Restore drill:** performed on 25 November 2026 against snapshot
  `db/2026-11-25T200512Z` in an isolated local PostgreSQL 17 cluster: PASS.
  Every recorded object came back (0 missing across tables, functions,
  constraints, triggers, policies), with `auth.users` 591 and the approved
  supply application present. Only `supabase_vault` was unavailable. See
  `RESTORE-DRILL-RESULT-20261125.md`.
- **Backup alerting:** installed 25 November 2026. `marocora-db-freshness.timer`
  runs daily at 05:15 UTC (+10 min jitter), pings the external check on success
  and its `/fail` endpoint when the newest snapshot is older than 30 hours. The
  down→up path was verified by email.
- **Worker-dependent jobs:** `translation-health` and
  `translation-document-backup` remain disabled and should stay disabled until
  the translation worker is rebuilt against the RPC-only grants of
  `202611140001_translation_workflow.sql`.
- **Key hygiene:** the deleted key and the limited-scope key should be removed
  from the DigitalOcean console and from the owner's private notes, leaving one
  working full-access pair.
- **Retention policy:** 30 days, enforced by `expires_utc` in each manifest and
  re-validated by the prune script. Changing it is a policy decision; the
  bucket currently holds 96 objects.

## Evidence

Local read-only probes and the reviewed copy of the backup script are kept in
`ops/backup-diagnosis-20261125/` (untracked). Server-side probe files were
removed from `/tmp`. No credential value appears in this note or in that
folder.
