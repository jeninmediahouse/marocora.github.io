# Marocora — Final Pre-Campaign Launch Gates

23 November 2026, Africa/Casablanca. PREPARATION ONLY. No push, deploy, SQL
application, restart/save, DNS edit, signup, credentials, real email or production
smoke. This document prepares owner actions; it does not authorize execution.
The final frozen SHA, artifact pins and exact owner commands are recorded in the
new final-candidate handoff and ops/final-precampaign-stage/README.md after commit.
Do not verify803648b or reuse a dirty-tree/superseded-source result as release proof.

## Directory promise and limits

Prepared promise: customers can view a single published-partner section on
professionals.html and follow each card to an unauthenticated supply-profile page.
Cards contain public display name, provider type, biography and profile link.
Existing service-category navigation remains. No search, city browsing, ratings,
ranking, map, booking or new filtering is promised or implemented.

GET /api/supply/profiles is the sole eligibility authority. The client preserves
API order, does not reconstruct approval/revision/verification/exclusion rules,
and never uses private metadata as eligibility. It first validates the complete
public payload and builds an allowlisted card projection. A publicationConsent
field is not part of the public response contract (the RPC strips it); if that
field is present, including false, the whole batch fails closed before any card
renders. This is defensive contract rejection, not a second consent gate that
could make a private profile public. Extra private fields are never copied to
text, HTML, attributes, storage, logs or links. Vendor text is textContent only.
Malformed/duplicate IDs or unknown types likewise show a generic unavailable
state without partial results. No provider error/body is shown or logged.

Known limit: existing API returns at most100 public profiles ordered by ID.
There is no pagination in this batch. Directory shows the returned set only;
profiles beyond that server cap are not discoverable through this section.
Document/review this limit before approaching100eligible profiles. No client-side
sorting or silent truncation, new SQL/RPC or grant change is introduced.

The new public supply-directory.mjs filename increases the set115→116. Recompute
its full sorted newline-terminated filename-set SHA256 from the final Git tree;
computed expected filename-set digest:
76cb1e372b588ea800140eb7bb8522516c6e74e41f667256a3c4b38dd7fd14de
This is not a fresh built-content hash. Wrapper gates exact116 plus the supplied
name-set digest. Build manifests/archive hashes must come from a fresh build.

## Evidence record — keep these lines exactly

- the corrected optional-video file's 4 tests pass (owner-run)
- a 410-test dirty-tree suite passed, as debugging evidence only
- the frozen candidate's expected total, stated as expected-not-run
- isolated build, guarded suite and CI for the frozen candidate: unconfirmed

Concrete expected total: **401, expected-not-run** =393previous candidate +8new
Node test declarations. No tests deleted. Optional cloudflared absence may mean
400pass/1namedskip; no other skip accepted. Six existing Python fixture cases
remain inside their one existing Node wrapper declaration. No new agent test run,
build, guard summary, CI or source-frozen pass is claimed.

## Owner order and freeze

1. Review/freeze the final commit and wrapper hashes/file list. B exclusions,
   dependencies/lock and unrelated work remain untouched. No candidate source,
   expected names/count or helper bytes change after review/verification. Any
   later commit voids prior verification: new source, isolated build and canary
   required. Never relabel old evidence. Changes require a new reviewed freeze.
2. Owner runs the final wrapper --verify-only on Mac only when authorized/ready:
   new detached source, offline frozen install, build:production then guarded
   suite. Preserve QUOTE_PG_BIN or check the approved PostgreSQL17 default.
   Expect401 and exact116names, source/lock unchanged, both guards0. Stop on failure;
   no online install, guard bypass, node_modules reuse or old-output archive.
3. Separately authorize candidate-branch test-only CI against that same SHA;
   no main/Pages dispatch. Record build before test, actual totals and named skips.
4. Owner confirms target Marocora/zonojgzczpzmcfaekuml, current backup/recovery and
   trusted function owner privately. Separately authorize/run only
   supabase/preflight_supply_optional_intro_video.sql, entire read-only file.
   Require PROCEED; errors/drift STOP. Do not rerun historic schema setup.
5. Separately authorize/apply only202611230001_supply_optional_intro_video.sql
   whole transaction, then read-only preflight PROCEED/ALREADY_UPDATED. This SQL
   **precedes deployment** because new UI accepts blank video and old validator
   rejects it. No SQL changes in the directory batch, no mail migration/preflight,
   grant, policy, historical reapplication or managed-database agent access.
6. Owner-authorized staging/4196canary of that same frozen source: new root only,
   offline Linux install, blind existing env handling owner-only, canary stored
   clean launcher start/restart/delete proof, live f48/4195unchanged. Verify directory,
   module and reset assets by hash; no real Auth/profile calls. No pm2save.
7. Separately authorize live switch to new immutable release/unique PM2 name,
   preserve f48registration stopped and older346registration untouched, both
   failed directories retained. Record health/auth/routing and real downtime.
   Recovery uses retained f48registration after stopping new; no DB restore or
   validator tightening. Two live registrations cannot bind4195 together.
8. Owner SMTP proof/cutover gates below and legitimate publication checks below
   must be satisfied before campaign claims. DNS/provider preparation and proof1
   may occur in parallel with source verification, never under agent credentials.
   Existing legitimate-account smoke only after its separate authorization.

No production operation is authorized by local verification. No edits or new
commits after verification, including documentation commits in the release branch;
keep external operational evidence separate from frozen candidate inputs.
Runtime onboarding/auth/public eligibility behavior remains subject to real gates.

## Auth email — campaign prerequisite, two distinct owner proofs

Owner confirms shared sender is the only current Auth channel. It is not an
adequate production fallback; a verified custom path and post-switch receipt are
campaign requirements. SMTP settings success is not evidence of delivery.
Supabase documents its shared sender's production limitations and recommends
custom SMTP: [official guidance](https://supabase.com/docs/guides/auth/auth-smtp).

All future actions below are owner-only, separately authorized. Credentials are
entered privately **only in Supabase dashboard SMTP settings**. Never place them
in code, files, documents, chat, terminal commands or agent tools. Provider account
and credential creation/management are private owner tasks; no agent handles a
value. Sender stays Marocora <no-reply@auth.marocora.com>; no MAIL_FROM, mail
worker, outbox preflight/application or application-email enablement.

| Order | Owner preparation/execution after authorization | Evidence / stop condition |
| --- | --- | --- |
| M1 | Privately review provider data handling/DPA/subprocessors/region and actual sending volume/quota. Sign up/sign in to Resend; Domains → Add domain → auth.marocora.com. Choose manual DNS, not automatic account integration. | Public domain and region decision; no credential values supplied to agent. |
| M2 | Recheck GoDaddy Domain Portfolio → marocora.com → DNS / Manage DNS → DNS Records. Preserve apexA207.154.219.205, nameservers and existing Google MX. Inventory existing SPF/DKIM/DMARC before edits. | Public Type/Name/Value/TTL only; stop on unexpected existing records. No blind overwrite. |
| M3 | If Google Workspace is the only apex sender and there is no SPF, add one TXT at @: v=spf1 include:_spf.google.com ~all. If one exists, review/merge legitimate senders in that single RR; never add a second SPF at the same name. TTL owner-selected/default, record it. | One apex SPF, existing mail routing unchanged. [GoDaddy SPF](https://www.godaddy.com/help/add-an-spf-record-19218). |
| M4 | Google Admin console → Apps → Google Workspace → Gmail → Authenticate email; select marocora.com. Check existing DKIM. If absent, prepare Google's generated public record and publish it only under separate owner DNS authorization; start authentication after propagation. No change if already correctly active. | Google DKIM status and public selector/record, no private key. No guessed Google selector, key or policy. [Google DKIM guidance](https://knowledge.workspace.google.com/admin/security/troubleshoot-dkim-issues). |
| M5 | Choose an existing monitored reporting mailbox. Add/review one TXT at _dmarc with v=DMARC1; p=none; rua=mailto:<owner-confirmed-mailbox>. Bracketed choice is never a literal value. Preserve existing stronger policy pending review; external reporting requires its own authorization check. | Working reporting mailbox responsibility, one policy. No invented address, reject/quarantine or automatic escalation. |
| M6 | Copy each exact Resend-displayed Type/Name/Value/TTL into GoDaddy manually, including DKIM and Return-Path SPF/MX only at provider's actual subdomain. Verify auth.marocora.com in Resend after propagation. Do not duplicate zone suffix or replace apex Google MX. | Domain Verified; exact public records. No invented selector/target/value. [Resend domains](https://resend.com/docs/dashboard/domains/introduction). |
| M7 | Run existing DNS-only checker with public provider selector and Return-Path names. No HTTP/provider API/credentials; record PASS/FAIL and public raw answers. | Presence is not SMTP, cryptographic DKIM, alignment or inbox proof. No agent DNS execution in preparation. |
| P1 | **Pre-switch SMTP proof:** use a suitable owner-controlled NON-production Supabase project, isolated from production. Enter approved SMTP configuration privately in that project's Supabase dashboard, Authentication → Email → SMTP Settings. Same intended sender/domain, host smtp.resend.com, port465/TLS, username resend; secret value only in dashboard. Use a legitimate controlled recipient and one authorized non-production Auth email to exercise actual SMTP transport. Do not change production SMTP yet. | Record SMTP receipt + INBOX/SPAM/NOT_RECEIVED, delay/timezone and sanitized SPF/DKIM/DMARC results. Domain verification/provider API test alone is not this proof. If no suitable isolated project/legitimate test path exists, P1 stays OPEN; request separate owner setup authorization. Do not fall back to a credential-bearing CLI/file or a production fake account. |
| M8 | Privately document prior production SMTP state and recovery responsibility; retain any previously verified custom configuration privately. Choose a quiet supervised cutover window and controlled-pause procedure. Check intended quotas and auth-link tracking off. | Recoverable custom path or explicit pause-and-correct plan agreed BEFORE switch. No secret settings/backup copied into repo or chat. |
| M9 | **Production switch is authorized only after accepted P1 proof**, DNS/provider verification and explicit owner configuration authorization. Owner enters same approved configuration privately in production Supabase dashboard. Sender no-reply@auth.marocora.com / Marocora. Keep redirects/templates/auth rules unchanged. | Settings saved does not close P2. [Official Resend/Supabase setup](https://resend.com/docs/send-with-supabase-smtp). |
| P2 | **Post-switch Auth proof:** after reset-capable frozen release is live, use an existing legitimate production account and one separately authorized real Auth message. Owner checks receipt and opens its link privately. For recovery, authorize password change separately if full completion is required; confirm no automatic app sign-in and normal login afterward. | Record actual INBOX/SPAM, correct sender, sanitized authentication results and working intended link/page. A direct SMTP receipt at P1 cannot substitute for P2. A recovery message does not prove signup confirmation's different template/redirect: keep confirmation proof separately OPEN unless actually verified. |

Proof records, kept privately by owner (sanitized summary only comes back):
proof number, actual time/timezone, environment/project identity, intended sender,
controlled legitimate recipient privately recorded, observed INBOX/SPAM/NOT_RECEIVED/
REJECTED/UNKNOWN, observation window/delay, SPF/DKIM/DMARC pass/fail/unknown and
sanitized failure category. P2 also records frozen release identity and link outcome.
No addresses, raw headers/body, tokens, recovery URLs, SMTP credentials or screenshots
containing private information pasted. Provider acceptance is not inbox delivery.
SPAM remains the initial result even if owner later marks it Not spam. No guaranteed
zero-spam claim; no automatic resend or campaign-volume test. Each real send needs
its own approval; this plan prepares two separate proofs, not an authorization.

Recovery: restore a previously verified custom configuration if one exists and
owner authorizes restoration, then prove receipt again. Otherwise enter a controlled
pause: suspend campaign acquisition and communicate the temporary limitation;
owner corrects the verified SMTP/DNS path and repeats only a specifically authorized
proof. Never disable confirmation/auth rules or pretend the shared sender is a
vendor-delivery fallback. No technical intake toggle/config change is invented or
executed here; any such mechanism needs separate scope. Existing-account access
and manual replies can continue as appropriate, without claiming new signups work.

## Genuine publication and discovery proof

Owner/reviewer ordinary duties only, no production fixture generation:

1. Identify a real eligible vendor who genuinely wants publication. Owner records
   their consent privately. Submission and latest revision must be ordinary real
   work, not a fabricated smoke fixture. No synthetic production vendor.
2. Independent authorized reviewer assesses the current revision normally. Do not
   approve merely to demonstrate publication; eligibility/verification/exclusion
   and any credential rules remain enforced. No publication without consent.
3. After legitimate approval, owner checks three distinct surfaces:
   - unauthenticated public API includes that profile;
   - supply-profile.html?id=<real-id> renders unauthenticated;
   - professionals.html published-partner section shows the same profile and its
     correct working link, without private fields.
4. Record pass/open/fail, time, actual frozen live release and sanitized result
   privately. No applicant details pasted. Failed behavior returns for separate
   review; no SQL/status/consent change or bypass to make the check pass.

If no genuinely eligible approved vendor exists, **live publication verification
= OPEN**. Disposable synthetic coverage remains valid local testing but is not a
substitute for a live claim. If the eligible vendor is outside the API's100-profile
returned set, record the cap limitation, not an invented discovery pass. No synthetic
account or special approval to populate the page. Directory product launch claims
remain conditional on this gate; no campaign claiming completed public discovery
until evidence actually exists.

## Still-open launch gates

- Frozen-source isolated build/guarded401suite and matching CI: UNCONFIRMED.
- Owner target/backup/recovery/preflight/new optional-video SQL: NOT PERFORMED here.
- Same-frozen-source staging/canary and live switch: NOT PERFORMED.
- Provider/DNS/Google DKIM/DMARC, pre-switch SMTP proof P1: OPEN.
- Owner authorized production SMTP cutover and Auth proof P2: OPEN.
- Real confirmation-template proof if only recovery tested: OPEN.
- Genuine vendor API/profile/directory publication proof: OPEN.
- Directory beyond100returned public profiles: KNOWN LIMIT, not implemented.

Existing B exclusions, all dirty work, both failed directories and old PM2
registrations remain preserved. No payment/video/booking/worker enablement. No
credentials, provider account access, SQL execution or production calls occurred.
