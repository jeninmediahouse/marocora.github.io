# Restore drill result — 25 November 2026

Status: **PASS**, first drill ever performed for this database.

Snapshot: `db/2026-11-25T200512Z` — the first snapshot produced after the Spaces
credential repair earlier the same evening.

Procedure: `RESTORE-DRILL-PROCEDURE-20261125.md`, followed as written apart from
the download step, which was performed on the server so that the Spaces key never
left it. Only encrypted objects travelled to the Mac.

## Environment

| Item | Value |
| --- | --- |
| Decryption | `age` (Homebrew), owner-held identity, 75-byte key file |
| Restore target | isolated PostgreSQL 17.11 (Homebrew, aarch64 macOS 25.6.0) |
| Cluster | temporary `initdb` instance on port 5433, `listen_addresses=''` (Unix socket only) |
| Restore mode | `pg_restore --no-owner --no-privileges` into an empty database |
| Network exposure | none; the cluster accepted local socket connections only |

## Object hashes at download

| Object | Bytes | SHA-256 |
| --- | --- | --- |
| `full.pgcustom.age` | 1 041 833 | `aad052096c0950a8a8bd111763396d191ce19b06c9da2dff9df78c94a98f1134` |
| `roles.sql.age` | 6 100 | `586f95b8ba1f68246875251550657828c498cd9edc187aa49ab6c649498d1cb4` |
| `validation.json.age` | 238 488 | `bebe8f09db9db75852965cb532a573706b5794b788f3620ad54671346529227c` |
| `manifest.json` | 950 | `946efe2a1275f5b334b6fa612fb96e950bad4d08570cd487147079e05b3960e2` |

All three object hashes matched the `artifacts[]` records in the manifest before
decryption. `file` identified the decrypted dump as
`PostgreSQL custom database dump - v1.16-0`.

## Restore outcome

`pg_restore` exit status 1 with **three** errors, all Supabase-vault related:

```text
could not execute query: ERROR:  extension "supabase_vault" is not available
could not execute query: ERROR:  extension "supabase_vault" does not exist
could not execute query: ERROR:  relation "vault.secrets" does not exist
```

The roles import produced two expected errors: the `supabase_admin` grantor lacks
`ADMIN OPTION` on `supabase_privileged_role` in a stock cluster. Both were
recorded and neither blocked the data restore.

No error named a `public.*` table, an `auth.*` object, or a data load.

## Structural comparison with the backup's own checks

`validation.json` (`format: marocora-restore-checks-v1`) records structure, not
row counts. Comparison is by object name, so schema-scope differences cannot
masquerade as loss:

| Group | Recorded | Restored | Missing |
| --- | --- | --- | --- |
| Tables | 95 | 98 | **0** |
| Functions | 147 | 208 | **0** |
| Constraints | 425 | 540 | **0** |
| Triggers | 41 | 42 | **0** |
| Policies | 48 | 48 | **0** |
| Extensions | 5 | 4 | 1 — `supabase_vault` |

Restored tables by schema: `public` 58, `auth` 27, `storage` 10, `realtime` 3.
The positive `extra` counts are catalog objects the plain cluster reports and the
backup's checks do not enumerate.

`supabase_vault` is supplied by Supabase and is not available in stock
PostgreSQL. The backup recorded `vault_secret_count: 0`, so no stored secret was
lost with it. It is the only missing extension and the only reason `pg_restore`
exited non-zero.

## Data present

| Table | Rows |
| --- | --- |
| `auth.users` | **591** |
| `public.supply_applications` | **1** |
| `public.supply_translation_profiles` | **1** |

The user count matches the known production figure recorded during the November
credential incident, and the approved translation partner's application is
present with its profile row.

## Limits of this drill

- It proves the **encrypted dump** is readable and restorable. It does not test
  the Supabase-managed restore path, which remains a separate, dashboard-driven
  recovery option.
- Ownership and privileges were intentionally not verified (`--no-owner
  --no-privileges`), so a real recovery would restore data and structure but
  require ownership/ACL review afterwards.
- Custom-role passwords are excluded from the dump by design; a real recovery
  would require resetting them.
- Supabase Storage objects are not in this dump and are not covered by any
  working backup pipeline; the document-backup job is disabled pending its
  RPC-based rebuild.
- This was a dump-level drill, not a full disaster-recovery rehearsal: DNS,
  application configuration and environment files were out of scope.

## Cleanup performed

- Drill cluster stopped; `pg_ctl` reported a clean shutdown.
- `~/marocora-restore-drill` (decrypted dump, roles SQL, validation copy,
  cluster data directory) deleted.
- Server-side `/tmp/marocora-drill-20261125T200512Z` and the downloader script
  removed.
- The temporary copy of the age identity was removed by the owner after
  confirming the key is stored in a password manager.

## Recommendation

Repeat quarterly while the schema is changing, and always after a migration that
alters tables or grants. The next drill should additionally restore ownership
(without `--no-owner`) into a cluster seeded with the full role set, to catch
privilege regressions that this pass deliberately ignored.
