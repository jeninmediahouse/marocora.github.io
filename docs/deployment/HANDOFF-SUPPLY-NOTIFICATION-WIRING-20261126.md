# Supply applicant notifications — wiring (26 November 2026)

Status: **live and verified end-to-end on 26 November 2026.**

Release `supabase-751926a.supply-mail-fix-20261126-r1`, source `751926a`, PM2
`marocora-supply-751926a`. `SUPPLY_RESEND_API_KEY` present in the environment
(sending access, scoped to `auth.marocora.com`); migration
`202611260001_supply_application_email.sql` applied.

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

## Verification performed

- Isolated build: 438/438 with the release gate; 455/455 in the working tree.
- **Submission email:** delivered to the owner's account from
  `no-reply@auth.marocora.com`, reference `8a2a3b91…`, revision 2.
- **Rejection email:** delivered after a real decision by the reviewer account,
  reference `8a2a3b91…`, revision 3.
- **Cleanup:** the test application deleted; `supply_applications` back to 1.
- Approval shares the same code path and copy table, and is expected to behave
  identically; it will be proven by the next genuine approval.

### Two defects found during the live test

1. The production wiring constructs supply routes without a `fetcher`, and the
   Resend adapter requires one, so the notifier silently fell back to
   `disabled`. Fixed by defaulting to global `fetch` (`05f23a1`).
2. `supplyRpc` enforces an RPC allowlist; `supply_application_email` was absent,
   so the decision lookup threw `SUPPLY_RPC_DENIED` and an empty `catch` hid it.
   Fixed by admitting the RPC, logging
   `SUPPLY_DECISION_EMAIL_LOOKUP_FAILED`, and adding a source-level guard test
   (`751926a`).

Both were caught only because the tests were live, not synthetic.
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
