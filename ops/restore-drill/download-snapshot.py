#!/usr/bin/env python3
"""Read-only snapshot downloader for the restore drill.

Copies the four objects of one snapshot out of Spaces into a private local
directory, verifying size and sha256 against the snapshot's own manifest.
Writes nothing to Spaces and prints no credentials.

Usage: download-snapshot.py --stamp 2026-11-25T200512Z --dest /tmp/marocora-drill
"""

import argparse
import hashlib
import json
import os
import re
import pathlib
import sys

BACKUP_ENV = pathlib.Path("/etc/marocora-translation-worker/backup.env")
BUCKET = "marocora-translation-backups-ams3"
ENDPOINT = "https://ams3.digitaloceanspaces.com"
EXPECTED_NAMES = {"full.pgcustom.age", "roles.sql.age", "validation.json.age"}


def die(code):
    print(code, file=sys.stderr)
    raise SystemExit(1)


def credentials():
    text = BACKUP_ENV.read_text()
    metadata = BACKUP_ENV.stat()
    if metadata.st_uid != 0 or metadata.st_mode & 0o077:
        die("DRILL_ENV_PERMISSIONS_INVALID")
    values = dict(line.split("=", 1) for line in text.splitlines() if "=" in line)
    if set(values) != {"DO_SPACES_ACCESS_KEY_ID", "DO_SPACES_SECRET_ACCESS_KEY"}:
        die("DRILL_ENV_KEYS_INVALID")
    return values


def sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--stamp", required=True)
    parser.add_argument("--dest", required=True)
    args = parser.parse_args()

    if os.geteuid() != 0:
        die("DRILL_REQUIRES_ROOT")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{6}Z", args.stamp):
        die("DRILL_STAMP_INVALID")

    import boto3

    values = credentials()
    client = boto3.client(
        "s3",
        endpoint_url=ENDPOINT,
        region_name="ams3",
        aws_access_key_id=values["DO_SPACES_ACCESS_KEY_ID"],
        aws_secret_access_key=values["DO_SPACES_SECRET_ACCESS_KEY"],
    )

    prefix = f"db/{args.stamp}"
    manifest_key = f"{prefix}/manifest.json"
    try:
        manifest_body = client.get_object(Bucket=BUCKET, Key=manifest_key)["Body"].read()
        manifest = json.loads(manifest_body)
    except Exception:
        die("DRILL_MANIFEST_UNAVAILABLE")

    artifacts = {item["key"].split("/")[-1]: item for item in manifest.get("artifacts", [])}
    if set(artifacts) != EXPECTED_NAMES:
        die("DRILL_MANIFEST_UNEXPECTED_ARTIFACTS")

    destination = pathlib.Path(args.dest)
    destination.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(destination, 0o700)

    (destination / "manifest.json").write_bytes(manifest_body)
    print(f"MANIFEST_OK stamp={manifest.get('created_utc')} expires={manifest.get('expires_utc')}")

    for name, record in sorted(artifacts.items()):
        target = destination / name
        try:
            body = client.get_object(Bucket=BUCKET, Key=record["key"])["Body"].read()
        except Exception:
            die("DRILL_OBJECT_UNAVAILABLE_" + name.replace(".", "_").upper())
        target.write_bytes(body)
        os.chmod(target, 0o600)
        if len(body) != record["bytes"] or hashlib.sha256(body).hexdigest() != record["sha256"]:
            die("DRILL_HASH_MISMATCH_" + name.replace(".", "_").upper())
        print(f"OBJECT_OK {name} bytes={len(body)} sha256={record['sha256']}")

    print(f"DRILL_DOWNLOAD_COMPLETE dest={destination} files={len(artifacts) + 1}")


if __name__ == "__main__":
    main()
