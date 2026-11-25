#!/usr/bin/env python3
"""Compare a restored drill cluster with the structure recorded at backup time.

Compares object *names*, not just counts, so a scope difference (Supabase
internal schemas that the backup's checks exclude) does not look like data loss.

Usage: compare-restore.py --validation validation.json [--port 5433] [--host /tmp]
"""

import argparse
import json
import pathlib
import subprocess

DEPTH = {"tables": 2, "functions": 2, "constraints": 3, "triggers": 3, "policies": 3, "extensions": 1}

QUERIES = {
    "tables": """
        select n.nspname || '.' || c.relname
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where c.relkind in ('r','p')
          and n.nspname not in ('pg_catalog','information_schema')
          and n.nspname not like 'pg_toast%' and n.nspname not like 'pg_temp%'
        order by 1""",
    "functions": """
        select n.nspname || '.' || p.proname
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname not in ('pg_catalog','information_schema')
        order by 1""",
    "constraints": """
        select n.nspname || '.' || c.relname || '.' || con.conname
        from pg_constraint con
        join pg_class c on c.oid = con.conrelid
        join pg_namespace n on n.oid = c.relnamespace
        order by 1""",
    "triggers": """
        select n.nspname || '.' || c.relname || '.' || t.tgname
        from pg_trigger t
        join pg_class c on c.oid = t.tgrelid
        join pg_namespace n on n.oid = c.relnamespace
        where not t.tgisinternal
        order by 1""",
    "policies": "select schemaname || '.' || tablename || '.' || policyname from pg_policies order by 1",
    "extensions": "select extname from pg_extension order by 1",
}

PROBES = ["auth.users", "public.supply_applications", "public.supply_translation_profiles"]


def psql(host, port, statement):
    result = subprocess.run(
        ["psql", "-h", host, "-p", str(port), "-U", "postgres", "-d", "marocora_drill",
         "-At", "-F", "|", "-c", statement],
        capture_output=True, text=True,
        env={"PATH": "/opt/homebrew/opt/postgresql@17/bin:/usr/bin:/bin", "PAGER": "cat", "LANG": "C"},
    )
    if result.returncode:
        raise SystemExit("PSQL_FAILED: " + result.stderr.strip()[:200])
    return [line for line in result.stdout.splitlines() if line]


def recorded_keys(entries, depth):
    keys = set()
    for entry in entries:
        if isinstance(entry, list):
            strings = [item for item in entry if isinstance(item, str)]
            keys.add(".".join(strings[:depth]))
        elif isinstance(entry, str):
            if depth == 1:
                keys.add(entry)
            else:
                keys.add(entry)
    return keys


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--validation", default="validation.json")
    parser.add_argument("--port", default="5433")
    parser.add_argument("--host", default="/tmp")
    args = parser.parse_args()

    recorded = json.loads(pathlib.Path(args.validation).read_text())
    print("RECORDED_FORMAT", recorded.get("format"))

    for name, statement in QUERIES.items():
        restored = set(psql(args.host, args.port, statement))
        expected = recorded_keys(recorded.get(name, []), DEPTH[name])
        missing = sorted(expected - restored)
        print(f"{name.upper()} recorded={len(expected)} restored={len(restored)} "
              f"missing={len(missing)} extra={len(restored - expected)}")
        for item in missing[:8]:
            print("  MISSING", item)

    tables = psql(args.host, args.port, QUERIES["tables"])
    schemas = {}
    for table in tables:
        schema = table.split(".", 1)[0]
        schemas[schema] = schemas.get(schema, 0) + 1
    print("TABLES_BY_SCHEMA", dict(sorted(schemas.items(), key=lambda item: -item[1])))

    for probe in PROBES:
        if probe not in tables:
            print("ROWCOUNT", probe, "TABLE_ABSENT")
            continue
        print("ROWCOUNT", probe, psql(args.host, args.port, f"select count(*) from {probe}")[0])


if __name__ == "__main__":
    main()
