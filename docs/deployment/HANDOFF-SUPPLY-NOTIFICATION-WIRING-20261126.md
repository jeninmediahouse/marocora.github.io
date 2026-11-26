# Supply applicant notifications — wiring (26 November 2026)

Status: **implemented and tested locally; not deployed.** Requires one
environment value and one migration before it can send decision emails.

## What was missing

`server/vendor-mail.mjs` already rendered applicant messages and
`server/supply-resend.mjs` already implemented a hardened Resend adapter with
idempotency keys — but nothing imported either of them in the running server.
Applicants therefore received no email on submission, approval or rejection.

## What was added

| File | Change |
| --- | --- |
| `server/supply-notify.mjs` | Notifier factory: deterministic event ids, fail-soft send, fixed log codes |
| `server/supply/http.mjs` | Fires `submitted` after a successful save; fires `approved`/`rejected` after a successful decision |
| `supabase/migrations/202611260001_supply_application_email.sql` | Admin-only lookup of an applicant's verified email (needed for decision emails) |
| `tests/supply-notify.test.mjs` | Determinism, disabled mode, send shape, failure isolation, invalid input |

## Design decisions

- **Fail-soft.** Mail never blocks or fails a submission or a decision: the
  dashboard remains the authoritative status. A failure logs one fixed code and
  returns.
- **Idempotent.** The event id is a name-based (v5) UUID over
  `applicationId:kind:revision`, so a double click, a retry, or a repeated
  callback produces the same `Idempotency-Key` and the provider deduplicates.
  Changing the namespace constant would re-send everything — treat it as frozen.
- **Minimal content.** Messages carry the application reference, revision and a
  dashboard link. No profile content, no feedback text, no banking details.
- **No PII in logs.** Only `SUPPLY_NOTIFY_*` codes are written.
- **Recipient.** `submitted` uses the signed-in session's verified email.
  Decisions use `supply_application_email(id)`, admin-only, because the reviewer
  is acting on someone else's application.

## Required before it can send

1. **Environment value** `SUPPLY_RESEND_API_KEY` in the production environment,
   readable only by the service. Without it the notifier logs
   `SUPPLY_NOTIFY_DISABLED` and does nothing — this is deliberate, so a missing
   key cannot break onboarding.
2. **Migration** `202611260001_supply_application_email.sql` applied in the
   Supabase SQL editor (owner-run). Until it exists, decision emails are skipped
   silently (the call is wrapped), while submission emails work.

## Verification plan

- Local: suite 453/453 including 5 new notification tests; renderer and adapter
  suites unchanged.
- After deploy, with `SUPPLY_RESEND_API_KEY` present:
  1. submit an application from the owner's own account (an account excluded
     from publication) and confirm the "profile has been received" email;
  2. confirm the dashboard still shows `pending_review`;
  3. decision emails are proven with the next genuine applicant, because
     self-review is denied by the database and a synthetic third party is not
     permitted in production.

## Known follow-ups

- **Delivery visibility.** The admin screen does not show whether a notification
  was sent. A later change should surface `sent`/`failed` per application so a
  reviewer can resend manually.
- **Bilingual email.** Current messages are English only. The Arabic dashboard is
  linked; adding an Arabic body is a translation task, not a code task.
- **Retry queue.** There is no retry job. Idempotency makes retries safe, but
  nothing retries automatically yet; a bounce or an outage leaves the applicant
  with the dashboard as the only signal.
