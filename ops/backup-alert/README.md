# Database backup freshness alert

Turns a silent backup failure into a notification. Two failures are covered:

- **Broken credentials or uploads** — the newest snapshot ages past 30 hours, the
  check reports `DB_FRESHNESS_STALE`, pings `<MONITOR_URL>/fail`, and the external
  service emails you.
- **Server down** — no ping arrives at all, so the external service alerts on its
  own schedule (period 1 day, grace 6 hours).

The check itself writes nothing, changes no database object and does not run a
backup. It reads the newest `db/<stamp>/manifest.json` name and compares its age.

## What it prints

| Code | Meaning |
| --- | --- |
| `DB_FRESHNESS_OK newest=… age_hours=…` | snapshot within budget; success ping sent |
| `DB_FRESHNESS_STALE newest=… age_hours=…` | older than 30 hours; `/fail` ping sent; exit 1 |
| `DB_FRESHNESS_NO_SNAPSHOTS` | bucket has no `db/*/manifest.json`; exit 1 |
| `DB_FRESHNESS_REMOTE_FAILED` | Spaces listing failed (key, network or permissions) |
| `DB_FRESHNESS_CONFIG_FAILED` | env file missing, wrong owner/mode, or bad `MONITOR_URL` |
| `DB_FRESHNESS_BAD_STAMP` / `DB_FRESHNESS_BAD_ARGUMENT` | malformed input |

Never printed: the URL, the key, the secret, or any provider message.

## Owner setup

### 1. Create the check at an external monitor

Any Healthchecks-style service works (Healthchecks.io free tier is sufficient):

1. Create an account and a project named `Marocora`.
2. Add a check named `Marocora database snapshot`.
3. Set **Period: 1 day**, **Grace: 6 hours**.
4. Copy the ping URL — it looks like `https://hc-ping.com/<uuid>`.
5. Set the notification channel to the mailbox you actually read.

Do not paste that URL into chat or commit it.

### 2. Install on the server (owner-run)

```sh
install -d -o root -g root -m 0755 /opt/marocora-backup-alert
install -o root -g root -m 0755 check-db-freshness.py /opt/marocora-backup-alert/check-db-freshness.py
install -o root -g root -m 0644 marocora-db-freshness.service /etc/systemd/system/marocora-db-freshness.service
install -o root -g root -m 0644 marocora-db-freshness.timer /etc/systemd/system/marocora-db-freshness.timer
install -d -o root -g root -m 0700 /etc/marocora-backup-alert
```

Then write the monitor file through a silent prompt so the URL never reaches
shell history:

```sh
umask 077; printf 'Monitor URL: '; read -rs URL; echo; printf 'MONITOR_URL=%s\n' "$URL" > /etc/marocora-backup-alert/monitor.env; chmod 600 /etc/marocora-backup-alert/monitor.env; chown root:root /etc/marocora-backup-alert/monitor.env; stat -c '%U %G %a %s' /etc/marocora-backup-alert/monitor.env
```

### 3. Verify before scheduling

```sh
systemd-analyze verify /etc/systemd/system/marocora-db-freshness.service /etc/systemd/system/marocora-db-freshness.timer
systemctl start marocora-db-freshness.service; systemctl show marocora-db-freshness.service -p Result -p ExecMainStatus
journalctl -u marocora-db-freshness.service --since=-5min --no-pager -q | grep -oE 'DB_FRESHNESS_[A-Z_]+' | sort | uniq -c
```

Expect `Result=success`, `ExecMainStatus=0`, and one `DB_FRESHNESS_OK` with an
age of a few hours. Confirm the external check flips to "up" within a minute.

A deliberate failure test that touches nothing: temporarily set
`FRESHNESS_MAX_HOURS=1` in a one-off run (`systemctl set-environment` is not
needed; run the script directly with the variable) and confirm the service exits
1 and the external check reports "down". Remove the variable afterwards.

### 4. Enable the timer

```sh
systemctl daemon-reload
systemctl enable --now marocora-db-freshness.timer
systemctl list-timers marocora-db-freshness.timer --no-pager
```

## Rollback

```sh
systemctl disable --now marocora-db-freshness.timer
systemctl reset-failed marocora-db-freshness.service 2>/dev/null || true
rm -f /etc/systemd/system/marocora-db-freshness.service /etc/systemd/system/marocora-db-freshness.timer
systemctl daemon-reload
```

Removing `/opt/marocora-backup-alert/` and `/etc/marocora-backup-alert/` is
optional; keeping them is harmless once the timer is disabled.

## Notes

- Budget is 30 hours, deliberately more than the 24-hour cadence so a slightly
  late run does not cry wolf. Override with `FRESHNESS_MAX_HOURS` (1–168).
- The service keeps the same hardening as the backup units: `ProtectSystem=strict`
  with no writable paths, because it never needs to write.
- This does not replace a restore drill. It proves snapshots keep arriving, not
  that they can be restored.
