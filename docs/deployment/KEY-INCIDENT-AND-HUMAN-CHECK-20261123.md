# Marocora — Credential Incident Closure and Human Check

23 November 2026, Africa/Casablanca. Record of owner-run security actions and the
supply sign-up human check. No credential values are reproduced here.

## Recorded exposure

A 19 November tool-window disclosure showed an already-open `.env` containing a
Supabase service-role credential and a LiveKit secret. A Cloudmersive key was
separately recorded as exposed; its disclosure mechanism was not established.
The records do not show publication on GitHub or any public page. A 20 November
check found no elevated-secret literals among 64 allowlisted served text assets;
that was a limited check, not a clearance. A local history search found no real
secret in any committed or pushed tree.

## Remediation completed

- **LiveKit:** owner replaced the secret and deleted the old key (previous record).
- **Supabase legacy API keys:** `anon` and `service_role` disabled in
  Settings → API Keys on 23 November. The confirmation dialog states that this
  disables use in the `apikey` header only.
- **Supabase legacy signing secret:** the previous HS256 (Shared Secret) key was
  revoked in Project Settings → JWT Keys on 23 November. The current ECC (P-256)
  key remains. The stolen legacy JWT is no longer trusted anywhere.
- **Admin role:** `admin@marocora.com` (`6748d479-b3d6-46a5-aa3c-7516da0b07d2`)
  was missing from `public.learning_review_staff`; one row was restored. The
  account is confirmed, non-anonymous, and the real owner. No synthetic staff was
  created.
- **New sign-ups:** disabled in Authentication → Sign In / Providers → User
  Signups. The observed user count was 591 and did not increase after the brake.

The website, password sign-in, ECC-signed sessions, and admin supply review were
checked after retirement. The site serves; sign-in works; the private review page
loads after the staff row was restored.

## Still open

- **Cloudmersive key:** replacement not completed. It cannot reach the database,
  mail, or website; it can consume scan credits. Rotate when the provider allows.
- **591 sign-up records:** stop first, clean later. Delete only clearly fake,
  unconfirmed accounts; keep every known owner/test account.
- **Translation worker and document backup:** stopped because their direct table
  access is revoked by `202611140001_translation_workflow.sql`, which grants only
  two service-side RPCs. A read-only REST canary returned `403 / 42501` by design;
  the replacement secret key itself is valid (REST root returned 200). These
  helpers need a separate RPC-based rebuild before they can work.
- **Database backup and prune jobs:** repaired on 25 November 2026. The cause was
  a deleted DigitalOcean Spaces access key (`InvalidAccessKeyId`), not database
  access; a Full Access key restored both jobs and a verified snapshot was taken.
  See `BACKUP-OUTAGE-AND-REPAIR-20261125.md`. Backup alerting and a restore drill
  remain open.
- **Log audit:** review Auth/API provider logs for past misuse of the exposed key
  where the provider still retains them.

## Supply sign-up human check

The partner sign-up door is `/api/supply/register`. It now requires a Cloudflare
Turnstile token, verified server-side before any account is created:

- `server/production/turnstile.mjs` validates the token with the fixed verify
  endpoint, binds the expected action `supply-register`, uses a bounded timeout,
  and fails closed on transport, redirect, non-200, malformed JSON, false success,
  action mismatch, blank, whitespace, or oversized tokens.
- `server/production/http.mjs` exposes `GET /api/supply/register-config` (site key
  only) and requires a verified token for registration. Missing configuration
  disables registration with a fixed error.
- `supply-register.html` and `supply-register.mjs` render the widget and submit the
  token. If the widget or configuration is unavailable, the form refuses to submit.
- Login, password reset, the email-verification buttons, and admin pages are not
  changed.

Required server settings: `TURNSTILE_SITE_KEY` (public) and
`TURNSTILE_SECRET_KEY` (private). Both are owner-entered. Without them,
registration is intentionally disabled.

Sign-ups remain disabled until this release is live and the widget keys are
present. No recovery template, SMTP, or DNS change is part of this record.
