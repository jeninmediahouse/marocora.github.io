# Restore drill procedure — database snapshots (prepared 25 November 2026)

Status: **prepared, not performed.** Nothing in this document has been run
against production, and no snapshot has been decrypted or restored yet.

Purpose: prove that an encrypted snapshot in `marocora-translation-backups-ams3`
can actually be restored. Until this is done, "we have backups" is an assumption.

## Safety rules

- The drill runs against a **throwaway local cluster**, never production and
  never a Supabase project.
- The age **private identity is owner-held only**. It must not be copied into
  the repository, into chat, or to any machine the owner does not control.
- No database password from `database.json` is needed for a restore. If a step
  seems to need it, the step is wrong.
- The drill writes nothing to Spaces. Download only.
- Do not run the drill while a schema migration is pending; a restore point is
  most useful when the state is settled.

## Preconditions

| Item | Check |
| --- | --- |
| age identity file | owner has it locally, outside the repo |
| PostgreSQL 17 client and server | `/opt/homebrew/opt/postgresql@17/bin` on the Mac |
| Free disk | at least 3× the largest snapshot size |
| Snapshot to test | newest (`2026-11-25T200512Z`) plus one older kept snapshot |
| Approval | owner explicitly authorises the session |

## Step 1 — pick and download

Use a private working directory on the owner's Mac:

```sh
mkdir -p ~/marocora-restore-drill && chmod 700 ~/marocora-restore-drill
cd ~/marocora-restore-drill
SNAP=2026-11-25T200512Z
```

Download the four objects. Any S3 client configured with the working Spaces key
can do this; the request is read-only:

- `db/$SNAP/full.pgcustom.age`
- `db/$SNAP/roles.sql.age`
- `db/$SNAP/validation.json.age`
- `db/$SNAP/manifest.json`

## Step 2 — verify before decrypting

```sh
shasum -a 256 full.pgcustom.age roles.sql.age validation.json.age
```

Compare each value with the `artifacts[].sha256` entries inside `manifest.json`.
A mismatch stops the drill: it means the stored object is not the object that was
recorded at upload time.

## Step 3 — decrypt

```sh
age -d -i /path/to/identity.txt -o full.pgcustom  full.pgcustom.age
age -d -i /path/to/identity.txt -o roles.sql       roles.sql.age
age -d -i /path/to/identity.txt -o validation.json validation.json.age
```

The identity path is supplied interactively and never committed. If the identity
is lost, the snapshots are permanently unreadable — that risk deserves a check of
its own during this session.

## Step 4 — start an isolated cluster

```sh
export PATH=/opt/homebrew/opt/postgresql@17/bin:$PATH
initdb -D ./cluster -U postgres --auth=trust >/dev/null
pg_ctl -D ./cluster -o "-p 5433 -k /tmp -c listen_addresses=''" -l ./cluster.log start
createdb -h /tmp -p 5433 -U postgres marocora_drill
```

`listen_addresses=''` means the cluster is reachable only through the local Unix
socket, so nothing else on the network can touch it.

## Step 5 — restore roles, then data

```sh
psql -h /tmp -p 5433 -U postgres -d postgres -v ON_ERROR_STOP=0 -f roles.sql
pg_restore -h /tmp -p 5433 -U postgres -d marocora_drill --no-owner --no-privileges -v full.pgcustom
```

`ON_ERROR_STOP=0` for roles is deliberate: the dump contains roles without
passwords, and re-creating the `postgres` role itself will error harmlessly.
Record every error line; anything else is a finding.

`--no-owner --no-privileges` keeps the restore from failing on role ownership in
a cluster that does not match production exactly. It also means ownership is not
what the drill verifies.

## Step 6 — validate what came back

Read `validation.json` and re-run its queries. At minimum, record:

- number of tables in `public` that exist in the dump
- row count of the largest application tables
- `auth.users` count, and whether it is plausible against the owner's knowledge
- presence of the newest known rows (e.g. the most recent supply application)

Example shape, values to be taken from the snapshot itself:

```sh
psql -h /tmp -p 5433 -U postgres -d marocora_drill -c "select count(*) from auth.users;"
psql -h /tmp -p 5433 -U postgres -d marocora_drill -c "\dt public.*" | wc -l
```

A drill passes only if the numbers match expectation and the queries run without
schema errors. "pg_restore exited 0" alone is not a pass.

## Step 7 — tear down and record

```sh
pg_ctl -D ./cluster stop
cd ~ && rm -rf ~/marocora-restore-drill
```

Record in the deployment docs: snapshot stamp, manifest hash, restore duration,
validation numbers, every error observed, and the verdict. Then set the next
drill date — quarterly is reasonable while the schema is changing.

## Known limits of this procedure

- It validates the **database**, not Supabase Storage objects; file backups are a
  separate pipeline that is currently disabled.
- Custom-role passwords are excluded from the dump by design, so a real recovery
  would require resetting them.
- The drill does not prove the Supabase-managed restore path, only that the
  encrypted dump is readable and restorable into clean PostgreSQL 17.
