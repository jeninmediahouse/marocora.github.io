# Marocora — Block 1.5 local uploads

**Historical Block 1.5 scanner/startup notes:** Block 1.6 now selects Cloudmersive,
requires a private environment key, and delivers workflow switches OFF. Read
`BLOCK16-CLOUDMERSIVE.md` for current owner setup/testing instructions. Existing
format, quarantine, access and immutable SQL gates below remain applicable.

Run `node server/block1/start.mjs` as before. No production URL, database,
credentials, mail, deployment, Block 2 or Block 3 integration is introduced.

Supported uploads: UTF-8 TXT, PDF, DOCX, JPG/JPEG and PNG. The limit is exactly
10,000,000 bytes (10 MB) per file, five files per request (50 MB maximum aggregate).
The request form selects one file; the authenticated API supports up to five.
Names, extension, claimed MIME and file signatures are checked server-side.
The server determines canonical MIME. A browser's generic octet-stream MIME is
accepted only after content inspection. Unsupported/spoofed/malformed files fail
before storage. This is bounded format inspection, not full document validation.

DOCX inspection does not extract files to disk or render XML. It verifies the ZIP
directory/local headers, the required package parts and their XML CRCs, rejects
encryption, traversal/duplicate names, macro/embedded-object paths, unsupported
compression and ZIP64, and bounds entry count (1,024), individual expanded size
(20 MB), total declared expanded size (50 MB), compression ratio (100:1) and
required XML expansion (2 MB each). These intentionally conservative limits can
reject unusually large/complex otherwise-valid DOCX packages.

## Antivirus and quarantine

The application looks for local `clamscan` in standard locations and PATH. No
package is installed and no signature/update download is attempted. If present,
ClamAV runs without a shell, with a 20-second timeout. Exit 0 records clean;
exit 1 records infected; other errors/timeouts remain quarantined as error.
The content hash is checked before/after scanning and again before download.
ClamAV needs usable signatures; merely finding its binary does not make a scan
successful. No claim is made that an antivirus scan proves a document safe.

On this execution host, no `clamscan` or `clamdscan` was found. The actual default
flow therefore records `quarantined / SCANNER_NOT_INSTALLED`, HTTP 202. Staff
can review file metadata/status and retry a scan; nobody can download or preview
unclean files, and staff cannot manually mark them clean. There is no release
bypass. Staff quoting and customer acceptance are blocked while any request
document lacks a clean scan. No scanner means those operations remain blocked
for document-bearing requests. This is the explicitly authorized fallback.

Only a clean file can be downloaded by its current staff owner or eligible,
accepted assigned translator. Customers and other staff remain denied. Only TXT
has an escaped text preview; binary formats are attachment downloads with
canonical MIME and nosniff. No PDF/DOCX/image browser rendering is added.

## Local upgrade and evidence

`block15.sql` is an additive local-only migration, run after the unchanged Block 1
base. It adds MIME metadata, a 10 MB constraint and append-only hash-bound scan
events with no direct application-role privileges. Its local database/user guard
rejects other targets. `local-state.json` records the extension hash so restart
does not reapply it. No original request, quote, acceptance or file bytes are
rewritten. Old files without scan evidence now read as quarantined, including
files covered by a previously accepted synthetic quote; accepted history remains.
Once a quote has been issued, uploads still lock; immutable offer document hashes
remain bound to exact customer acceptance. Later scan failure blocks bytes and
new acceptance without deleting historical agreement evidence.

Tests use actual synthetic PDF/DOCX/JPG/PNG fixtures with native PostgreSQL, real
local HTTP and private disk storage. Actual missing-scanner tests verify that
uploads stay quarantined. Separately injected TEST ONLY scanner adapters exercise
clean/infected/error and exact quote/acceptance/download boundaries. Those tests
are not evidence of real ClamAV detection. `tests/block1.test.mjs` now explicitly
injects its clean adapter for its authorization regression. No HTTP flag, customer
field or environment option can select that test adapter in the normal launcher.

Run `node --test tests/block15.test.mjs tests/block1.test.mjs`. Fixtures can be
regenerated locally with `python3 tests/fixtures/block15/generate.py` (macOS sips
creates the harmless JPEG). The launcher remains synthetic local authentication,
not managed Supabase JWT verification. Workspaces remain English. All three
local workflow switches remain ON; notifications are pending DB rows only.
Production defaults and P1–P4 wording/fixture treatment remain unchanged.
