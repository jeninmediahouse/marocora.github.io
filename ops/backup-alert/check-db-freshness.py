#!/usr/bin/env python3
"""Report whether the newest encrypted database snapshot is fresh enough.

Reads the existing root-only Spaces credentials, finds the most recent
db/<stamp>/manifest.json, and compares its age with a fixed budget. When a
monitor URL is configured it is pinged on success and sent to /fail when the
snapshot is stale, so that a broken key raises an alert and a dead server is
noticed by the absence of a ping.

Only fixed codes reach stdout/stderr. URLs, credentials and provider messages
are never printed.
"""

import json
import os
import re
import stat
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone

BACKUP_ENV = "/etc/marocora-translation-worker/backup.env"
MONITOR_ENV = "/etc/marocora-backup-alert/monitor.env"
BUCKET = "marocora-translation-backups-ams3"
ENDPOINT = "https://ams3.digitaloceanspaces.com"
PREFIX = "db/"
STAMP_FORMAT = "%Y-%m-%dT%H%M%SZ"
DEFAULT_MAX_AGE_HOURS = 30
HTTP_TIMEOUT = 10


class CheckError(Exception):
    """Carries a fixed code; never a provider or transport message."""


def parse_stamp(value):
    try:
        return datetime.strptime(value, STAMP_FORMAT).replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        raise CheckError("DB_FRESHNESS_BAD_STAMP")


def age_hours(now, newest):
    return (now - newest).total_seconds() / 3600.0


def evaluate(now, stamps, max_age_hours=DEFAULT_MAX_AGE_HOURS):
    """Return (status, newest_stamp, age) for a list of snapshot stamps."""
    parsed = sorted(parse_stamp(stamp) for stamp in stamps)
    if not parsed:
        return ("empty", None, None)
    newest = parsed[-1]
    hours = age_hours(now, newest)
    status = "ok" if hours <= max_age_hours else "stale"
    return (status, newest.strftime(STAMP_FORMAT), round(hours, 2))


def ping_url(base, failed):
    clean = base.rstrip("/")
    return clean + "/fail" if failed else clean


def read_private_file(path):
    try:
        metadata = os.stat(path)
    except OSError:
        raise CheckError("DB_FRESHNESS_CONFIG_FAILED")
    if not stat.S_ISREG(metadata.st_mode):
        raise CheckError("DB_FRESHNESS_CONFIG_FAILED")
    if metadata.st_uid != 0 or metadata.st_mode & 0o077:
        raise CheckError("DB_FRESHNESS_CONFIG_FAILED")
    try:
        return open(path, "r", encoding="utf-8").read()
    except OSError:
        raise CheckError("DB_FRESHNESS_CONFIG_FAILED")


def spaces_credentials():
    values = dict(
        line.split("=", 1) for line in read_private_file(BACKUP_ENV).splitlines() if "=" in line
    )
    expected = {"DO_SPACES_ACCESS_KEY_ID", "DO_SPACES_SECRET_ACCESS_KEY"}
    if set(values) != expected or not all(values.values()):
        raise CheckError("DB_FRESHNESS_CONFIG_FAILED")
    return values


def monitor_target():
    try:
        text = read_private_file(MONITOR_ENV)
    except CheckError:
        return None
    values = dict(line.split("=", 1) for line in text.splitlines() if "=" in line)
    url = values.get("MONITOR_URL", "").strip()
    if not url:
        return None
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != "https" or not parsed.netloc or parsed.username or parsed.password:
        raise CheckError("DB_FRESHNESS_CONFIG_FAILED")
    return url


def ping(url, failed):
    if not url:
        return False
    try:
        with urllib.request.urlopen(ping_url(url, failed), timeout=HTTP_TIMEOUT) as response:
            return 200 <= response.status < 400
    except Exception:
        return False


def newest_stamps(client):
    stamps = set()
    token = None
    while True:
        kwargs = {"Bucket": BUCKET, "Prefix": PREFIX, "MaxKeys": 1000}
        if token:
            kwargs["ContinuationToken"] = token
        page = client.list_objects_v2(**kwargs)
        for item in page.get("Contents", []):
            key = item.get("Key", "")
            match = re.fullmatch(r"db/([0-9TZ:-]+)/manifest\.json", key)
            if match:
                stamps.add(match.group(1))
        if not page.get("IsTruncated"):
            break
        token = page.get("NextContinuationToken")
        if not token:
            break
    return sorted(stamps)


def max_age_hours():
    value = os.environ.get("FRESHNESS_MAX_HOURS", "").strip()
    if not value:
        return DEFAULT_MAX_AGE_HOURS
    try:
        hours = int(value)
    except ValueError:
        raise CheckError("DB_FRESHNESS_CONFIG_FAILED")
    if not 1 <= hours <= 168:
        raise CheckError("DB_FRESHNESS_CONFIG_FAILED")
    return hours


def run():
    budget = max_age_hours()
    target = monitor_target()
    try:
        import boto3
        from botocore.config import Config
    except Exception:
        raise CheckError("DB_FRESHNESS_CONFIG_FAILED")
    values = spaces_credentials()
    try:
        client = boto3.client(
            "s3",
            endpoint_url=ENDPOINT,
            region_name="ams3",
            aws_access_key_id=values["DO_SPACES_ACCESS_KEY_ID"],
            aws_secret_access_key=values["DO_SPACES_SECRET_ACCESS_KEY"],
            config=Config(connect_timeout=HTTP_TIMEOUT, read_timeout=HTTP_TIMEOUT, retries={"max_attempts": 2}),
        )
        stamps = newest_stamps(client)
    except CheckError:
        raise
    except Exception:
        raise CheckError("DB_FRESHNESS_REMOTE_FAILED")

    status, newest, hours = evaluate(datetime.now(timezone.utc), stamps, budget)
    if status == "empty":
        ping(target, True)
        raise CheckError("DB_FRESHNESS_NO_SNAPSHOTS")
    if status == "ok":
        ping(target, False)
        print(f"DB_FRESHNESS_OK newest={newest} age_hours={hours} budget_hours={budget}")
        return 0
    ping(target, True)
    print(f"DB_FRESHNESS_STALE newest={newest} age_hours={hours} budget_hours={budget}", file=sys.stderr)
    return 1


def self_test():
    now = datetime(2026, 11, 25, 12, 0, 0, tzinfo=timezone.utc)
    assert parse_stamp("2026-11-25T030000Z") == datetime(2026, 11, 25, 3, 0, 0, tzinfo=timezone.utc)
    assert age_hours(now, parse_stamp("2026-11-25T030000Z")) == 9.0
    assert evaluate(now, ["2026-11-24T030000Z", "2026-11-25T030000Z"])[0] == "ok"
    assert evaluate(now, ["2026-11-24T030000Z", "2026-11-25T030000Z"])[1] == "2026-11-25T030000Z"
    assert evaluate(now, ["2026-11-20T030000Z"])[0] == "stale"
    assert evaluate(now, []) == ("empty", None, None)
    assert evaluate(now, ["2026-11-25T030000Z"], max_age_hours=8)[0] == "stale"
    assert evaluate(now, ["2026-11-25T030000Z"], max_age_hours=9)[0] == "ok"
    assert ping_url("https://hc.example/uuid", False) == "https://hc.example/uuid"
    assert ping_url("https://hc.example/uuid/", True) == "https://hc.example/uuid/fail"
    try:
        parse_stamp("nonsense")
    except CheckError as error:
        assert str(error) == "DB_FRESHNESS_BAD_STAMP"
    else:
        raise AssertionError("bad stamp accepted")
    os.environ["FRESHNESS_MAX_HOURS"] = "0"
    try:
        max_age_hours()
    except CheckError:
        pass
    else:
        raise AssertionError("zero budget accepted")
    finally:
        os.environ.pop("FRESHNESS_MAX_HOURS", None)
    print("SELF_TEST_OK")


if __name__ == "__main__":
    if sys.argv[1:] == ["--self-test"]:
        self_test()
        sys.exit(0)
    if sys.argv[1:]:
        print("DB_FRESHNESS_BAD_ARGUMENT", file=sys.stderr)
        sys.exit(2)
    try:
        sys.exit(run())
    except CheckError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
