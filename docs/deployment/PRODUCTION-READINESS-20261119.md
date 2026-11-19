# Marocora — Production Readiness Corrections, 19 November 2026

This records the initial local preparation, before its later commit and push.
No production SQL, deployment, provider request or credential rotation was
performed. Use [the final execution runbook](EXECUTION-RUNBOOK-20261119.md) for
the complete human-run console checklist and embedded SQL.

## 1. CI artifact ordering

The `test` job in `.github/workflows/pages.yml` now runs
`pnpm run build:production` after dependency installation and before `pnpm test`.
This builds both `.pages-dist` and the browser learning-room adapter in the same
job/filesystem used by the HTTP tests. A build in the later `deploy` job cannot
supply those files to the earlier job. The existing HTTP 200 assertions and all
network/authentication/scanning/payment protections are unchanged.

Publish the reviewed commit to GitHub `main` through the normal review process
to activate this CI correction. A Droplet command cannot deploy a GitHub Actions
workflow. The repository is:
`https://github.com/jeninmediahouse/marocora.github.io.git`.

Once the reviewed change is on `main`, the owner can retrieve the files on the
Droplet as root with:

```bash
runuser -l marocora -s /bin/bash -c 'cd /srv/marocora/app && git pull --ff-only origin main'
```

Stop if this reports a dirty checkout, divergence or permissions problem; do not
reset local work. This updates the retained Git checkout. The previously deployed
PM2 working directory is a separate release under `/srv/marocora/releases/`.
Retrieving these scripts does not switch that release. No application rebuild or
restart is needed for the workflow-only correction or for retrieving SQL files.
Do not point PM2 back at the old checkout. The rotation helper discovers the
actual active PM2 release and preserves its entrypoint and working directory.

## 2. Human-reviewed learning catalogue correction

`PGRST202` establishes that PostgREST cannot resolve the requested RPC. It does
not alone establish whether the database function is absent, its signature is
different, the caller uses another project, `public` is unexposed, or the API's
schema cache is stale.

In the Supabase SQL Editor for the project used by both the browser and server:

1. Run the **complete contents** of `supabase/diagnose_learning_catalog.sql`.
   It uses a read-only transaction and rolls back. It reports function signatures,
   privileges, RLS flags, column types, policy metadata and available exposed-schema
   settings, without selecting applicant records or printing credentials.
   PostgreSQL metadata does not directly reveal PostgREST's in-memory cache.
2. Confirm that the API exposes `public`, that the client uses this same project,
   and review the prerequisite findings before running any correction.
3. Only if those findings support this targeted fix, run the **complete contents**
   of `supabase/migrations/202611190001_fix_learning_catalog.sql` as the trusted
   migration owner. Do not run isolated statements from inside its transaction.
   If a guard raises an exception, roll back/clear that failed transaction and
   stop for review; do not remove the guard or bulk-apply other migrations.

The correction creates/replaces only the reviewed zero-argument
`public.learning_public_catalog()` returning `jsonb`, grants schema usage and
RPC execution to `anon`/`authenticated`, revokes implicit PUBLIC execution, and
notifies PostgREST to reload its schema cache on commit. Existing canonical
definitions may be reapplied safely; different definitions or overloads stop for
review. There are **no table or RLS policy updates**, data modifications, seeds,
direct table grants, payment activation or migration-004 changes.

Required existing tables have RLS enabled:

- `learning_publications`
- `learning_instructor_drafts`
- `learning_application_reviews`
- `learning_review_exclusions`
- `learning_launch_subjects`
- `learning_launch_specialties`
- `learning_country_codes`

The historical prerequisite sources are `learning_instructor_drafts.sql`,
`learning_staff_review.sql`, and `learning_launch.sql`.
`learning_email_verification.sql` adds the separate verified-email guard.
These names identify dependencies, **not** instructions to reapply these files.
If prerequisites are missing, prepare a separate reviewed plan against the actual
database state. This patch intentionally does not install the entire learning stack
or repair unrelated RPCs such as `learning_public_slots`.

The patch verifies the canonical internal `learning_publication_visible` and
`learning_build_publication` definitions, their ownership/search paths and lack
of client execution grants. Public rows come from the sanitized publication
projection. Visibility still requires an active publication, current revision and
latest staff review, profile and selected-subject approval, current publication
consent, and no applicable exclusion. Private drafts, emails, review feedback and
auth IDs are not returned. Authenticated owners retain existing draft RLS access;
anonymous users receive no private table access.

After the full correction commits, the owner can run this exact read-only check:

```sql
BEGIN READ ONLY;
SET LOCAL ROLE anon;
SELECT public.learning_public_catalog();
ROLLBACK;
```

Then reload `/learn/` and confirm the zero-argument RPC request uses `{}` and
succeeds through the public API. An empty valid catalogue means no publications
currently pass the approval/consent rules; never create approvals to make the
page look populated. A SQL success with an API `PGRST202` still requires checking
the project, exposed schema and schema-cache refresh.

## 3. Cloudmersive replacement, once support supplies a distinct key

Keep both `scripts/rotate-cloudmersive-key.sh` and its companion
`scripts/rotate-cloudmersive-key.mjs` together. The script requires root to invoke
it, but all application file changes, scanner calls and PM2 commands run as
`marocora`. It requires Node 24+, installed application dependencies, a regular
shared `/srv/marocora/app/.env` owned by `marocora`, and one online `marocora` PM2
fork process using `server/start-production.mjs` under `/srv/marocora/`.

After retrieving the reviewed files, run **only when the replacement is ready**:

```bash
bash /srv/marocora/app/scripts/rotate-cloudmersive-key.sh
```

Enter the replacement at the hidden terminal prompt. Do not paste it into chat,
a shell command, a screenshot, source control or a build variable. Do not edit
the shared environment or change PM2 releases concurrently with rotation.

This command includes the synthetic PDF scan canary: it creates a valid PDF in
memory and calls the actual active release's
`cloudmersiveScanner(...).scanBytes(...)` from `server/block1/uploads.mjs`, with
the unchanged production scanner restrictions and a 30-second timeout. A clean
Cloudmersive result is required **before** any environment write or PM2 restart.
This consumes a provider scan request. There is no standalone bypass/test-success
flag and no live provider canary was run during local preparation.

After that check, it creates a private backup under
`/home/marocora/.marocora-env-backups/` (directory 0700/file 0600), atomically
updates only the Cloudmersive setting in the shared environment (0600), and
repairs duplicate/dropped-prefix/numeric-suffix Cloudmersive key names. Unrelated
dotenv values must remain unchanged. Unsupported multiline key definitions fail
for review. It preserves the active PM2 release and explicitly supplies the new
key in the child environment of `pm2 restart <id> --update-env`. That explicit
injection is essential: `--update-env` alone does not reread `.env`, and an old
process variable can override Node's environment-file value.

It verifies PM2's stored value privately, polls local `/health` using both allowed
Host headers, and saves the process list only after success. Failures after the
write trigger restoration of the previous environment bytes **and previous
runtime key**, restart, health verification and PM2 save. Concurrent edits are
not overwritten; incomplete recovery prints a fixed warning and retains the
backup for private inspection. Raw SDK/PM2 output and key values are suppressed.

On `SUCCESS`, revoke the exposed old key in Cloudmersive and verify a real upload
through the normal protected workflow. Revocation is a separate provider action;
the script does not revoke keys or change the subscription. No frontend rebuild
is necessary for a server-only API key rotation.

## Local verification

- Production page and learning-room builds passed.
- Full existing network-isolated suite plus new regression coverage:
  **273 passed, 0 failed, 0 skipped**; outbound network guards retained.
- Disposable local PostgreSQL tests cover anonymous catalogue output, denied
  private access, consent/exclusion/unpublication, repeatability and refusal of
  missing/drifted prerequisites, overloads and direct-table grants.
- Synthetic rotation-engine tests cover scan-before-write, private backups,
  explicit restart callback, health/save rollback and concurrent edits. The human
  rotation CLI was syntax-checked, not executed against a real environment.

Next owner actions: review/publish the commit, inspect Supabase diagnostics,
apply only the warranted correction, and rotate/revoke Cloudmersive once support
provides a distinct tested replacement. Merchant onboarding and payment gates
remain separate launch requirements.
