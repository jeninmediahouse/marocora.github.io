# Marocora — Pre-Campaign Owner Checklist

23 November 2026, Africa/Casablanca. PREPARATION ONLY. Nothing in this checklist
is an execution authorization. No production/DNS/provider/settings action has
been performed by the agent. Owner-only steps need separate owner authorization
before execution. Do not give any account password, API key, SMTP password,
recovery link, connection string or private log to an agent.

A is the campaign blocker. A+B+C are one application commit:
72cf84bc9561d048e429fe311d79a6fb7fd20bc4, on top of password reset d6982d6.
F/G/H are a separate tooling/documentation commit. They do not have to delay A.
Neither commit is verified shippable until its isolated build/guarded tests pass.
115 public filenames/digest remain unchanged; file contents/hashes change.

D (worker) and E (mail-outbox preflight) are deferred entirely. This batch has no
worker design, new RPC/grant, outbox preflight or outbox enablement step. Do not
apply or edit 202611200002_supply_mail_outbox.sql. The existing supply adapter and
its exact sender Marocora <no-reply@auth.marocora.com> remain unchanged. There is
no MAIL_FROM setting in this batch. Provider work here is Supabase Auth SMTP
only; it does not wire transactional application/review emails.

## Application path — do this independently of the optional mail setup path

| Order | Who / expected active time | Action after separate authorization | Expected result / evidence to keep |
| --- | --- | --- | --- |
| 1 | Owner + agent review,15–30min | Review the exact application commit and new source-pinned wrapper. Preserve B and all dirty work. | Source SHA, exact commit list; no B/credential/generated files. |
| 2 | Owner Mac,5–15min plus offline-store availability | New detached source, offline frozen install, production build, guarded suite through reviewed --verify-only command. | Build PASS; expected392 tests at A+B+C,393 if F/G/H included; exact totals and both guard summaries0. No pass is claimed now. |
| 3 | Owner + agent review,5–15min plus runner time | Separately authorize candidate-branch push/test-only CI, never main/Pages dispatch. | Matching full SHA, build before tests, zero failures; optional cloudflared skip explicitly named. |
| 4 | Owner private Supabase console,5–10min | Confirm Marocora / zonojgzczpzmcfaekuml, current backup/recovery and trusted function owner. Read/run only supabase/preflight_supply_optional_intro_video.sql, entire file, after authorization. | One JSON verdict PROCEED, read_only on, original or already-updated body hash, failed_check null. SQL error, drift or wrong target => STOP. No private data copied. |
| 5 | Owner private SQL Editor,2–5min | If authorized and preflight passes, apply only supabase/migrations/202611230001_supply_optional_intro_video.sql in full transaction. | Success. Re-run read-only preflight: PROCEED / ALREADY_UPDATED, replacement body MD5 189e21de2a3d96555a5fec719aab63cf. Record source/file hash, target and actual time privately. No historical onboarding/bootstrap or mail migration. |
| 6 | Owner Mac/server,10–25min plus offline install | Separately authorize transfer/staging/4196 canary using new source-bound wrapper. | New release only; old f48 cwd/name/4195 unchanged; canary start/restart/probes/delete pass;4196closed; no save. |
| 7 | Owner root console,5–10min plus measured outage | Separately authorize reviewed live switch to distinct new name/root; retain f48 registration stopped, older346 registration and both failed directories untouched. | Health/auth/routing/assets pass; record downtime. No two registrations bind4195 together; no save without separate approval. |
| 8 | Owner legitimate account,5–10min | Separately authorized smoke: empty teacher-video submission, HTTPS video edit, one header/language switch in EN/FR/AR/ES, signup confirmation wording. No approval/publication/production fixtures required. | Empty video accepted, unsafe non-empty URL refused, remaining validation enforced. No applicant data pasted. |

**SQL step5 must precede deployment:** the new UI accepts an empty video string;
the old database validator rejects it. The new migration only relaxes this one
predicate. The same function OID/signature, STABLE volatility, language,
search_path, ACLs, dependencies, schema-version expectations and existing data
are preserved. The client always includes introVideo as an empty string when
blank; omitting the JSON key still fails the unchanged exact-key validator.
No other validation is relaxed, and no video playback/live-learning gate changes.

The preflight checks catalog body/attributes/owner/ACL/DDL privileges and helper
presence, not project identity, backups, arbitrary SQL semantics or concurrent
future drift. Static reviewed SQL and future disposable tests establish its
one-function scope. ALREADY_UPDATED permits a safe repeat; an error is STOP.
Do not remove guards or edit an applied migration to get PROCEED.

Application rollback remains separately authorized: preserve/restart existing
marocora-supply-f48c343 after stopping only the new release. Retain the relaxed
validator and records; no database restore or validator tightening as first
rollback. Old UI may again require video when editing; record that limitation.
Schema rollback would require separate review of empty-video data. No SQL/grant,
config, DNS or provider rollback is implicitly authorized by application rollback.

## Auth mail setup path — future owner-only work, no agent credentials

Owner-provided DNS facts: GoDaddy ns75/ns76.domaincontrol.com, apex A207.154.219.205,
MX smtp.google.com, no SPF/DKIM/DMARC observed. Exact checked-at time unavailable;
recheck existing records privately before edits. No DNS query was run by the agent.
Do not replace A, nameservers, existing Google MX or website routing.

| Step | Who / expected active time | Future action | Expected result / evidence |
| --- | --- | --- | --- |
| M1 | Owner only,10–20min | Confirm existing everyday Google mailbox and every legitimate apex sender; select an existing monitored DMARC reporting mailbox, preferably same-domain. Review provider data handling/DPA/subprocessors/region and actual anticipated volume/quota before signup/payment. | Owner decision, mailbox responsibility and current quota facts privately recorded; do not invent a reporting address or publish a non-working one. |
| M2 | Owner only,5–10min | GoDaddy Domain Portfolio → marocora.com → DNS / Manage DNS → DNS Records → Add New Record → TXT. Add the apex Google SPF below only if none exists and Google is the only apex sender; otherwise stop for a merged single-SPF review. | Exactly one apex SPF. Record public Type/Name/Value/TTL and actual time. [GoDaddy SPF guide](https://www.godaddy.com/help/add-an-spf-record-19218), [Google SPF guidance](https://knowledge.workspace.google.com/admin/security/set-up-spf). |
| M3 | Owner only,5–10min | Same DNS Records screen → Add New Record → TXT, Name _dmarc. Start p=none with rua pointing to the monitored address from M1. Do not weaken/duplicate an existing stronger policy without review. | One DMARC record, monitoring only. Record the public RR and time; confirm the owner receives reports later. [GoDaddy authentication guidance](https://www.godaddy.com/en-ca/help/set-up-spf-dkim-or-dmarc-records-for-my-hosting-email-40810). |
| M4 | Owner only,10–20min | Create/sign into Resend privately; Domains → Add domain → auth.marocora.com, choose approved region; use the manual DNS path. Record every displayed sending-domain record, without inventing selectors, MX targets or SPF values. Do not choose receiving-domain setup or connect an automation that edits DNS/settings. | Auth domain entry and public record list; no API key copied to agent/source/server. [Resend domains](https://resend.com/docs/dashboard/domains/introduction). |
| M5 | Owner only,10–20min plus propagation | In GoDaddy DNS Records add each exact provider Type/Name/Value/TTL for auth.marocora.com. Google apex SPF stays separate. Avoid domain suffix duplication in GoDaddy Name; verify the resulting full name. Preserve apex MX; provider Return-Path MX belongs only at the displayed subdomain. | Exact provider records present. No guessed root/auth SPF or extra MX. Never add two SPF records at one owner name. Record public names/values/TTL. |
| M6 | Owner only,5–10min plus DNS propagation | Resend Domains → auth.marocora.com → Verify DNS records; run the DNS-only script below with exact public DKIM/Return-Path names from the screen. | Provider Verified plus DNS PASS/FAIL table. PASS presence is not inbox proof. Propagation may exceed active work time; wait, do not keep adding duplicates. |
| M7 | Owner only,10–15min | After separate settings authorization, Supabase project → Authentication → Email (Notifications) → SMTP Settings. Configure custom SMTP privately using provider credentials. Sender name Marocora; sender email no-reply@auth.marocora.com; host smtp.resend.com, port465/TLS, username resend. Owner puts provider SMTP password directly into Supabase; it is never supplied to the agent or a file. Leave redirect URLs/auth rules unchanged. | Custom SMTP saved for Auth confirmation/recovery mail; owner confirms sanitized settings status, no credential value. Keep tracking off for auth links; review current provider/Auth quotas, don't increase limits silently. [Resend Supabase steps](https://resend.com/docs/send-with-supabase-smtp), [SMTP transport](https://resend.com/docs/send-with-smtp), [Supabase SMTP guidance](https://supabase.com/docs/guides/auth/auth-smtp). |
| M8 | Owner only,5–15min plus delivery | After the reset-capable release is live and a separate real-send authorization is given, request exactly one password-reset message for the owner's existing legitimate account. No fake vendor, bulk send, campaign send or second test request. | Use the evidence card below. Password change itself only if explicitly included in smoke authorization. SMTP setting success/provider acceptance does not prove inbox delivery. Confirmation delivery remains untested by this one recovery message. |
| M9 | Owner only,2–5min per manual reply, chosen by owner | Use the English/French acknowledgement template from the same everyday mailbox. Reply directly to the correspondent, check recipient, and invite a reply to that mailbox. | Owner records whether sent; no automated routine, outbox or timing promise. Reply only within the correspondence, no contact-list export. |

GoDaddy and Resend steps are owner-only because they require private account
credentials which must never be given to an agent. Supabase SMTP is likewise
owner-only. No owner-only action above has been executed or newly authorized.
Resend SMTP credentials do not belong in runtime .env or MAIL_FROM; this batch
leaves the server mail adapter and transactional outbox unwired. SMTP quotas,
credential validity, custom email template redirects and inbox placement remain
private evidence, not source-code guarantees.

Exact planned apex values (public, not secrets):

- Type TXT, Name @, Value `v=spf1 include:_spf.google.com ~all`, TTL owner-selected
  GoDaddy default (record it), only after M1/M2 confirms single legitimate sender.
- Type TXT, Name _dmarc, Value `v=DMARC1; p=none; rua=mailto:<owner-confirmed-reporting-mailbox>`.
  The bracketed part is an unresolved choice, never a literal DNS value. Stop
  until owner fills it privately. Existing policy/inheritance/external reporting
  authorization must be reviewed; do not choose reject/quarantine in this batch.
- Provider records: copy exactly from auth.marocora.com entry; no provider-specific
  target, selector, Return-Path or TTL is guessed in this plan.

Blank worksheet: fill one row per actual record. Keep values public-only; no
SMTP/API credentials here. Add a row if provider shows more records.

| Record purpose | Type | Name | Value | TTL |
| --- | --- | --- | --- | --- |
| Apex Google SPF | | | | |
| Apex DMARC/reporting | | | | |
| Provider DKIM | | | | |
| Provider Return-Path SPF | | | | |
| Provider Return-Path MX | | | | |
| Additional provider verification record, only if displayed | | | | |

## DNS-only owner command — not run by the agent

```sh
python3 -I -S -B '/Users/tareqnaser/Documents/ChatGPT/Marocora Site building/output/marocora-quote-workflow-local/ops/precampaign/dns-self-check.py'
```

At the two prompts enter only full public DNS names copied from the provider's
DKIM and Return-Path SPF/MX rows. No key/password prompt exists. Blank answers
remain UNKNOWN and yield FAIL for the missing evidence; no selector guessing.
The script uses /usr/bin/dig only: apex TXT, _dmarc TXT, auth TXT, apex MX, and
explicit provider-host TXT/MX plus selector TXT/CNAME. No API, HTTP, mail, private
config, provider login or file write. Pass means expected policy/record presence;
not full SPF include evaluation, DKIM cryptographic validation, DMARC alignment,
DNSSEC or delivery. Auth SPF is checked at the provider's actual Return-Path host;
auth.marocora.com itself need not have SPF when the provider specifies a child.
It prints public raw answer records and a PASS/FAIL table, exits1 if any check
fails. Query failure is not proof of an absent record. DNS names entered are
restricted to auth.marocora.com and its subdomains. No mail.marocora.com checks.

## One real Auth test-send evidence card — future, private owner record

- Authorized by/date, source release SHA and actual time/timezone:
- Existing legitimate account used: owner records privately; never paste address:
- Intended sender observed: Marocora / no-reply@auth.marocora.com:
- Result: INBOX / SPAM / NOT_RECEIVED / REJECTED / UNKNOWN:
- INBOX means found in the recipient inbox (including a normal inbox category),
  not merely accepted or marked delivered by provider. SPAM means actually found
  in Junk/Spam; record that initial result before marking it Not spam. Moving it
  does not rewrite the original outcome. No receipt by agreed observation time
  means NOT_RECEIVED, not delivered. No unbounded retries or second test send.
- Observed delay, client/mailbox category, sanitized SPF/DKIM/DMARC pass/fail only:
- Link reached reset page after owner opened privately: yes/no/unknown. Never
  paste URL/fragment/token, full headers/body, screenshot with address or secrets.
- If password change separately authorized: success/no auto-login/normal sign-in,
  otherwise record delivery-only and completion untested:
- Record any bounce/failure category only; no raw provider response or logs.

One delivered test does not establish campaign-scale deliverability or an SLA.
If it fails, stop and bring back the sanitized result for a separately scoped
review; no automatic resend, provider/config change or worker activation.

## Manual acknowledgement templates (H)

English — Subject: Your Marocora message

Hello,

Thank you for contacting Marocora. I have received your message. If you would
like to add any information, please reply directly to this email.

Kind regards,
Marocora

French — Objet : Votre message à Marocora

Bonjour,

Merci d’avoir contacté Marocora. J’ai bien reçu votre message. Si vous souhaitez
ajouter des informations, répondez directement à cet e-mail.

Cordialement,
Marocora

These are manual replies from the owner's everyday mailbox, not automated
application receipts or approval decisions. Add a response timeframe only if
chosen and supportable by the owner; no default promise is included.
