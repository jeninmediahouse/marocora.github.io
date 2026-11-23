#!/usr/bin/python3
"""Owner macOS DNS-only check. No HTTP/provider API, credentials, mail or writes.

Presence/policy checks, not proof of provider verification or inbox delivery.
Public DKIM and Return-Path names come from the owner's provider screen, not guesses.
"""
import argparse
import re
import subprocess
import sys

APEX = 'marocora.com'
AUTH = 'auth.marocora.com'


def public_name(value, dkim=False):
    value = value.strip().lower().rstrip('.')
    if len(value) > 253 or not re.fullmatch(r'[a-z0-9_][a-z0-9_.-]*', value):
        raise ValueError('Invalid public DNS name')
    if any(not part or len(part) > 63 for part in value.split('.')):
        raise ValueError('Invalid public DNS labels')
    if dkim:
        if not value.endswith('._domainkey.' + AUTH):
            raise ValueError('DKIM name must be a selector under _domainkey.auth.marocora.com')
    elif value != AUTH and not value.endswith('.' + AUTH):
        raise ValueError('Return-Path name must be auth.marocora.com or its subdomain')
    return value


def parse_answer(text, name):
    status = re.search(r'\bstatus: ([A-Z]+)', text)
    if not status or status.group(1) not in ('NOERROR', 'NXDOMAIN'):
        return {'ok': False, 'records': [], 'raw': [], 'reason': 'DNS status unavailable or error'}
    records, raw = [], []
    for line in text.splitlines():
        if not line or line.startswith(';'):
            continue
        fields = line.split(None, 4)
        if len(fields) != 5 or fields[2] != 'IN' or fields[3] not in ('TXT', 'MX', 'CNAME'):
            continue
        # Keep public answer records only, never resolver/config/diagnostic output.
        raw.append(''.join(c if 32 <= ord(c) < 127 else '\\u%04x' % ord(c) for c in line))
        if fields[0].lower().rstrip('.') == name:
            records.append((fields[3], fields[4]))
    return {'ok': True, 'records': records, 'raw': raw, 'reason': status.group(1)}


def lookup(name, kind):
    # Fixed executable and args; never shell, @resolver, config files or external programs.
    try:
        result = subprocess.run(['/usr/bin/dig', '+time=3', '+tries=1', '+noall',
                                 '+comments', '+answer', name, kind],
                                stdin=subprocess.DEVNULL, capture_output=True,
                                text=True, timeout=6, env={'PATH': '/usr/bin:/bin', 'HOME': '/nonexistent'})
        if result.returncode or len(result.stdout) > 65536:
            return {'ok': False, 'records': [], 'raw': [], 'reason': 'DNS lookup failed or oversized'}
        return parse_answer(result.stdout, name)
    except (OSError, subprocess.TimeoutExpired, UnicodeError):
        return {'ok': False, 'records': [], 'raw': [], 'reason': 'DNS lookup unavailable or timed out'}


def txt(result):
    # dig prints one TXT RR as adjacent quoted character strings. Join only that RR.
    values = []
    for kind, data in result['records']:
        if kind == 'TXT':
            parts = re.findall(r'"((?:[^"\\]|\\.)*)"', data)
            values.append(''.join(parts))
    return values


def collect(dkim_name=None, return_path=None, query=lookup):
    if dkim_name:
        dkim_name = public_name(dkim_name, dkim=True)
    if return_path:
        return_path = public_name(return_path)
    results = {}
    def get(name, kind):
        key = (name, kind)
        if key not in results:
            results[key] = query(name, kind)
        return results[key]
    apex = get(APEX, 'TXT'); dmarc = get('_dmarc.' + APEX, 'TXT')
    get(AUTH, 'TXT'); mx = get(APEX, 'MX')
    spf = [v for v in txt(apex) if v.lower().startswith('v=spf1')]
    policies = [v for v in txt(dmarc) if v.lower().startswith('v=dmarc1')]
    google_ok = apex['ok'] and spf == ['v=spf1 include:_spf.google.com ~all']
    dmarc_ok = dmarc['ok'] and len(policies) == 1 and bool(re.search(r'(?:^|;)\s*p=none\s*(?:;|$)', policies[0], re.I)) and bool(re.search(r'(?:^|;)\s*rua=mailto:[^\s;,<>@]+@[^\s;,<>@]+', policies[0], re.I))
    auth_ok = False
    if return_path:
        result = get(return_path, 'TXT'); auth_spf = [v for v in txt(result) if v.lower().startswith('v=spf1')]
        auth_ok = result['ok'] and len(auth_spf) == 1 and len(auth_spf[0].split()) > 1
        get(return_path, 'MX')
    dkim_ok = False
    if dkim_name:
        records = get(dkim_name, 'TXT'); aliases = get(dkim_name, 'CNAME')
        keys = [v for v in txt(records) if re.search(r'(?:^|;)\s*p=[A-Za-z0-9+/]+={0,2}\s*(?:;|$)', v)]
        cnames = [v for kind, v in aliases['records'] if kind == 'CNAME']
        dkim_ok = records['ok'] and aliases['ok'] and (len(keys) == 1 and not cnames or len(cnames) == 1 and not keys)
    mx_ok = mx['ok'] and any(kind == 'MX' and re.fullmatch(r'\d+\s+(?:[a-z0-9.-]+\.)?google(?:mail)?\.com\.', value, re.I) for kind, value in mx['records'])
    rows = [
        ('Apex Google SPF', bool(google_ok), 'One Google-only SPF required; review other legitimate senders before edits'),
        ('Apex DMARC monitor/report', bool(dmarc_ok), 'One p=none policy and reporting mailbox; external-report authorization not checked'),
        ('Auth SPF at provider Return-Path', bool(auth_ok), return_path or 'UNKNOWN: supply exact public Return-Path DNS name from provider'),
        ('Auth DKIM presence', bool(dkim_ok), dkim_name or 'UNKNOWN: supply exact public selector DNS name from provider'),
        ('Apex Google MX', bool(mx_ok), 'Presence only; existing MX must remain unchanged')]
    if return_path:
        rp_mx = get(return_path, 'MX')
        rows.append(('Provider Return-Path MX presence', bool(rp_mx['ok'] and any(k == 'MX' for k, _ in rp_mx['records'])), return_path))
    return rows, results


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dkim-name', help='Public full selector name copied from provider')
    parser.add_argument('--return-path-name', help='Public full SPF/MX owner name copied from provider')
    args = parser.parse_args()
    if sys.platform != 'darwin':
        raise SystemExit('STOP: owner macOS script; no DNS lookup attempted')
    if sys.stdin.isatty():
        if args.dkim_name is None:
            args.dkim_name = input('Public DKIM DNS name from provider (blank = UNKNOWN): ').strip() or None
        if args.return_path_name is None:
            args.return_path_name = input('Public Return-Path SPF/MX DNS name from provider (blank = UNKNOWN): ').strip() or None
    try:
        rows, results = collect(args.dkim_name, args.return_path_name)
    except ValueError as error:
        raise SystemExit('STOP: ' + str(error))
    print('CHECK | RESULT | NOTE')
    for name, ok, note in rows:
        print(name + ' | ' + ('PASS' if ok else 'FAIL') + ' | ' + note)
    for (name, kind), result in results.items():
        print('\nPUBLIC DNS ANSWER: ' + name + ' ' + kind + ' (' + result['reason'] + ')')
        for line in result['raw']:
            print(line)
        if not result['raw']:
            print('(no answer records)')
    print('\nPresence checks only. No provider verification, full SPF evaluation, DKIM signature, DMARC alignment, delivery or inbox placement proved.')
    return 0 if all(ok for _, ok, _ in rows) else 1


if __name__ == '__main__':
    sys.exit(main())
