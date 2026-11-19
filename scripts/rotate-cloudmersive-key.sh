#!/usr/bin/env bash
# HUMAN-RUN ONLY on the Droplet after Cloudmersive supplies a replacement.
# Does not rebuild, apply SQL, enable gates or revoke the old provider key.
set +x
set -Eeuo pipefail
umask 077

[[ $(id -u) == 0 ]] || { echo 'ERROR: Run as root on the Droplet.' >&2; exit 1; }
for tool in runuser python3 flock; do
  command -v "$tool" >/dev/null || { echo "ERROR: Missing $tool." >&2; exit 1; }
done
id marocora >/dev/null
[[ -f /srv/marocora/app/.env && ! -L /srv/marocora/app/.env ]] || {
  echo 'ERROR: Expected a regular /srv/marocora/app/.env file.' >&2
  exit 1
}

# Serialize this rotation workflow. Do not edit .env concurrently in an editor.
exec 9>/run/lock/marocora-cloudmersive-rotation.lock
flock -n 9 || { echo 'ERROR: Another rotation is running.' >&2; exit 1; }
runner="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/rotate-cloudmersive-key.mjs"
[[ -f "$runner" ]] || { echo 'ERROR: Companion rotation module is missing.' >&2; exit 1; }

# Python getpass uses /dev/tty and refuses an echoing fallback. The key travels
# only over the child's stdin, never in command arguments or an environment var.
python3 - "$runner" <<'PY'
import getpass
import shlex
import subprocess
import sys
import warnings

warnings.simplefilter('error', getpass.GetPassWarning)
try:
    key = getpass.getpass('NEW Cloudmersive replacement key (hidden): ')
except (getpass.GetPassWarning, EOFError, KeyboardInterrupt):
    raise SystemExit('ERROR: Hidden terminal input unavailable or cancelled; nothing changed.')

command = 'exec node ' + shlex.quote(sys.argv[1])
try:
    result = subprocess.run(
        ['runuser', '-l', 'marocora', '-s', '/bin/bash', '-c', command],
        input=key, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    )
except Exception:
    raise SystemExit('ERROR: Could not start rotation as marocora; inspect privately.')
finally:
    key = None

# Never relay arbitrary SDK/PM2 stderr, stack traces or provider responses.
prefixes = ('PASS:', 'SUCCESS:', 'FAIL:', 'BACKUP:', 'ROLLBACK:')
printed = False
for line in (result.stdout + '\n' + result.stderr).splitlines():
    if line.startswith(prefixes):
        print(line)
        printed = True
if result.returncode and not printed:
    print('FAIL: Rotation could not start; check Node 24+, PM2 and module access as marocora.')
raise SystemExit(result.returncode)
PY
