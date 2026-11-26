#!/usr/bin/env python3
"""Uptime check for the public site, reported through an external monitor.

Requests the public health endpoint, requires HTTP 200 and the expected status
body, then pings the monitor on success or its /fail endpoint on failure. If the
server itself is down, no ping arrives and the external service alerts on its own
schedule.

Prints fixed codes only; no response bodies, URLs or error text.
"""

import os
import sys
import urllib.error
import urllib.parse
import urllib.request

TARGET = "https://marocora.com/health"
MONITOR_ENV = "/etc/marocora-uptime/monitor.env"
EXPECTED = '"status":"ok"'
TIMEOUT = 15


def ping_url(base, failed):
    clean = base.rstrip("/")
    return clean + "/fail" if failed else clean


def healthy(status, body):
    return status == 200 and EXPECTED in body


def read_url():
    try:
        with open(MONITOR_ENV, "r", encoding="utf-8") as handle:
            values = dict(line.split("=", 1) for line in handle.read().splitlines() if "=" in line)
    except OSError:
        return None
    url = values.get("MONITOR_URL", "").strip()
    if not url:
        return None
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != "https" or not parsed.netloc or parsed.username or parsed.password:
        raise ValueError("SITE_CHECK_CONFIG_FAILED")
    return url


def ping(url, failed):
    if not url:
        return False
    try:
        with urllib.request.urlopen(ping_url(url, failed), timeout=TIMEOUT) as response:
            return 200 <= response.status < 400
    except Exception:
        return False


def check(url=TARGET):
    try:
        with urllib.request.urlopen(url, timeout=TIMEOUT) as response:
            body = response.read(4096).decode("utf-8", "replace")
            return healthy(response.status, body)
    except urllib.error.HTTPError as error:
        return healthy(error.code, "")
    except Exception:
        return False


def run():
    target = read_url()
    ok = check()
    ping(target, not ok)
    if ok:
        print("SITE_OK")
        return 0
    print("SITE_UNHEALTHY", file=sys.stderr)
    return 1


def self_test():
    assert healthy(200, '{"status":"ok"}')
    assert not healthy(200, '{"status":"degraded"}')
    assert not healthy(503, '{"status":"ok"}')
    assert not healthy(200, '')
    assert ping_url("https://hc.example/uuid", False) == "https://hc.example/uuid"
    assert ping_url("https://hc.example/uuid/", True) == "https://hc.example/uuid/fail"
    print("SELF_TEST_OK")


if __name__ == "__main__":
    if sys.argv[1:] == ["--self-test"]:
        self_test()
        sys.exit(0)
    if sys.argv[1:]:
        print("SITE_CHECK_BAD_ARGUMENT", file=sys.stderr)
        sys.exit(2)
    try:
        sys.exit(run())
    except ValueError:
        print("SITE_CHECK_CONFIG_FAILED", file=sys.stderr)
        sys.exit(1)
