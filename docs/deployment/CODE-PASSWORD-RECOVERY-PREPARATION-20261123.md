# Marocora — Code Password Recovery Preparation

23 November 2026, Africa/Casablanca. LOCAL PREPARATION ONLY. No build/test run,
provider call, real email, template edit, SQL/migration/grant/policy, push/deploy,
restart/save, credentials, DNS or production smoke. No further redirect diagnosis.
Owner authorizes code recovery and the exact ambiguous-error amendment below.

## Current owner facts supersede older deployment preparation

Owner reports production is now
/srv/marocora/releases/supabase-1dc890c.final-precampaign-20261123-r1,
source1dc890c, PM2marocora-supply-1dc890c online127.0.0.1:4195, save performed.
marocora-supply-f48c343 is stopped. Every stopped registration and both failed
folders must remain. This is owner evidence, not an agent recheck. Custom SMTP
already works via Resend/auth.marocora.com; no provider/DNS/SMTP setup needed.
Old shared-sender/prior-livef48 statements in earlier plans are historical.

Owner reports Supabase accepted recovery links but the page rejected the redirect
payload; no attempt is made to diagnose/reproduce that path. The new flow depends
on an emailed code, never /verify callbacks, query/fragment values or a browser
Supabase session. Original approval/publication exclusion remains: the owner's
excluded QA account may test recovery but must never be approved/published.
Public discovery testing requires another genuinely eligible, non-excluded
consenting account. No synthetic production vendor or demonstration-only approval.

## Implemented local scope

Existing public files only: reset-password.html/.mjs, production-login.mjs and
supply-copy.mjs. Server reset helper and HTTP/Supabase delegation changed; existing
password-reset test file adapted to replace the intentionally retired link flow.
No new public filename or rename, existing116-name digest unchanged subject to
committed-tree recheck. No dependency/lock/B/worker/mail/migration changes.
Only two forward-source fingerprints refreshed in rollback manifest; seven
historical overlay payload files remain unchanged.

Normal page URL is simply https://marocora.com/reset-password.html. It immediately
shows a neutral code form: email, code, password, confirmation, no expired default.
Client does not read/scrub the URL at all. Shared locale code may preserve/update
language query normally; recovery does not inspect or depend on it. No credential
is copied into attributes, status text, storage, logs, links or navigation. Native
form input values necessarily hold what the user types; those are not echoed or
persisted. Code/password/confirmation clear after each network completion; email
clears on success and otherwise remains only in its input for retry/resend.

Client validates email, ASCII six digits,12–128length and matching confirmation
before fetch. Verifying/loading disables both actions and blocks duplicates.
After a failed verification, Send a new code reuses /api/auth/request-reset, email
only, with the same server request limits as initial request. It does not reset
verification counters. Request acceptance is deliberately generic for known and
unknown addresses and provider rejection; acceptance does not prove mail delivery.
Login requests recovery by existing endpoint, then opens the plain code page,
with no email/code in the destination URL or storage.

POST /api/auth/complete-reset-code accepts exactly email/code/password. Validates
before Auth, consumes attempt counters, then fresh isolated server Auth client
using existing public server key only: verifyOtp({email,token:code,type:'recovery'})
→updateUser({password})→signOut({scope:'local'}). SDK memory session exists only
inside that request's server client; no application cookie or tokens returned.
Old /api/auth/complete-reset returns410 RESET_CODE_REQUIRED, never calls Auth.
No fragment fallback retained; it would add unsupported complexity.

Supabase recovery requests use resetPasswordForEmail(email) without redirectTo.
The eventual template supplies Token. No privileged service-key/browser exposure.
Private transport logging disabled/sanitized; raw provider errors are not returned.

## Honest error contract

| Server/local outcome | Visitor message, EN; FR/AR/ES in existing copy module |
| --- | --- |
| Malformed code, client and server | Enter the 6-digit code. |
| Ambiguous verifyOtp rejection | The code is incorrect or has expired. Request a new code. |
| Own limiter/provider throttling | Too many attempts. Try again later. |
| Password length | Password must be 12 to 128 characters. |
| Confirmation mismatch, client only | The passwords do not match. |
| Bad email shape | Enter a valid email address. |
| Network/service unavailable before update | Service temporarily unavailable. Please try again later. |
| Provider refuses weak/same password | Choose a different password that meets the security requirements. |
| Update acknowledgement or cleanup uncertain | The password may have changed, but confirmation failed. Try signing in or request a new code. |
| Confirmed update and local signout | Password changed. Sign in with your new password. |

Owner explicitly accepts combining incorrect/expired/unknown-account verification
rejections. No fabricated distinction or account enumeration. Extra password-policy
and completion-uncertainty reasons prevent mislabeling those failures as a bad code.
The provider's update/signout are separate operations, not atomic; if acknowledgement
is lost, password may already be changed. No automatic retry of password update.
At most one best-effort signout cleanup after error, no unbounded retry.

References: [Supabase Auth verification source](https://github.com/supabase/auth/blob/master/internal/api/verify.go),
[template variables](https://supabase.com/docs/guides/auth/auth-email-templates).
The latter documents Token as a six-digit OTP. Hosted settings/template values are
not inspected here. Owner must confirm rendered six digits during later smoke;
if actual project code length differs, STOP for separately authorized review,
not a silent auth-rule/configuration change.

## Attempt limits and operational assumptions

One15-minute fixed window aligned to epoch boundaries. Completion:5attempts per
normalized email and20per IP; every eligible attempt, including success, counts.
Request/resend:3per email and10per IP per15minutes. Existing HTTP10/IP/minute
shape also remains; no callback or resend resets counters. Known and unknown
addresses identical. HMAC-SHA256 keys with random process-only secret, no raw email,
IP/code/password retained.5000entries maximum, prune expired only, fail closed on
capacity; never evict an active target's counter. Increment synchronously before
await so same-process races cannot bypass the budget. Shutdown clears counters.

Limits are process-local; current owner topology has one online app process.
Restarts reset counters, and multiple workers would multiply limits. Do not claim
cluster-wide protection. Before activation owner confirms single-process topology
and existing trusted-proxy policy. Without trusted client-IP forwarding the shared
proxy address conservatively shares the IP budget; do not weaken trust checks or
read/change private configuration here. A distributed/persistent rate store or
proxy policy change requires separate scope; no dependency/SQL/config added.
Provider Auth limits are additional protection, not a substitute for this budget.

## Synthetic coverage and expected result

Existing password-reset test file now24top-level declarations, replacing15old
link-flow declarations with code-flow equivalents and extending coverage. Other
tests untouched. Expected full suite **412, expected-not-run** =403−15+24.
Optional missing cloudflared may mean411pass/1namedskip. No suite/build result is
claimed. Source syntax/copy/fingerprint inspection is not a guarded suite.

Coverage includes public allowlists/no cookie/old endpoint retired; no redirect
request; correct verify→update→local signout/reuse; wrong/expired/unknown combined;
malformed/length/mismatch before Auth; password/provider/uncertainty reasons;
blank URL/no URL scrubbing; loading/duplicate lock; safe attributes/log/storage;
resend same endpoint and limits; per-email and per-IP/fixed-window/capacity expiry;
known/unknown request privacy; four languages. All fixtures synthetic and provider
fetch mocked. HTTP fixtures loopback only; no real network/provider/managed DB.

## Exact later owner order — deploy FIRST, template SECOND

1. Freeze/review final new source and operational-helper hashes. Isolated offline
   frozen install, production build then guarded412suite; matching test-only CI
   after separately authorized candidate-only push. Do not reuse1dc890c's403pass
   as release evidence for changed code. No new commit after verification without
   a new freeze/build/CI/canary. B stays excluded, no dirty source/dependency reuse.
2. Separately authorize staging/4196canary at a fresh immutable path. Baseline is
   currently live1dc890c/name marocora-supply-1dc890c, not stoppedf48. Offline Linux
   install only, clean stored launcher, verify start/restart/delete and unchanged
   live4195/registrations. No real recovery requests as canary. No new SQL in this
   batch; do not reapply prior migration or touch mail outbox SQL.
3. Separately authorize live switch to the NEW code-capable release, retain every
   stopped registration and old release. Confirm public code form loads with an
   empty URL and assets/health/routing match. No real email yet. Production save
   needs its own owner authorization, not this draft.
4. **Only after the new release is live**, separately authorize owner dashboard
   edit: Supabase project Marocora/zonojgzczpzmcfaekuml → Authentication → Email
   Templates → Reset password. Privately retain prior template for recovery,
   paste the exact HTML body below. Do not edit confirmation templates, Auth
   policies/redirects, SMTP/domain settings or expiry configuration. No CLI/API
   credential handling. During the coordinated interval, old link-only messages
   cannot complete the new code flow; keep campaign/recovery claims paused until
   template and smoke are confirmed. No claim of zero-downtime recovery cutover.
5. Separately authorize ONE real code-recovery smoke using an existing legitimate
   account. The excluded owner QA account is allowed for recovery only. Check
   received six digits, inbox/spam, neutral form, incorrect-code reason, corrected
   code success, no automatic sign-in, normal sign-in and safe replay rejection.
   Each failed attempt counts; no unbounded resend loop. Record only sanitized
   outcomes/source/time, no email/code/password/token/headers or recovery URL.
   A second real send/retry needs separate authorization.
6. Publication smoke is separate and uses an eligible non-excluded consenting
   vendor through ordinary review. Never approve/publish the excluded QA account
   or create a synthetic production vendor. If none eligible, publication=OPEN.

Rollback: the saved old1dc890c application supports link recovery only, already
reported broken. A code-only template with old app is incompatible. If rolling
back application under separate authorization, coordinate owner-only template
restoration or recovery pause/fix-forward; neither restoring the old template nor
shared SMTP proves a working recovery fallback. Never silently restore settings,
restart a registration, reapply SQL or claim recovery is available. Sign-in and
unrelated onboarding must remain independently checked.

## Exact owner template body — PREPARED, NOT APPLIED

Suggested subject: Marocora — Password recovery code

Code appears once; there is no ConfirmationURL, TokenHash, RedirectTo or token in
any URL. The public page address is static plain text, not a verification link.
Open it directly or via the login request flow; scanning it cannot redeem a code.
No expiry duration is invented. This template is authored guidance, never a real
credential or actual received code.

```html
<h2>Marocora — Password recovery</h2>
<p>Recovery code / Code de récupération / رمز الاستعادة / Código de recuperación</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
<p><strong>English:</strong> Open https://marocora.com/reset-password.html and enter your email address, this code and your new password. Never share this code. If you did not request a password reset, ignore this email.</p>
<p><strong>Français :</strong> Ouvrez https://marocora.com/reset-password.html et saisissez votre adresse e-mail, ce code et votre nouveau mot de passe. Ne partagez jamais ce code. Si vous n’avez pas demandé de réinitialisation, ignorez cet e-mail.</p>
<p dir="rtl"><strong>العربية:</strong> افتح https://marocora.com/reset-password.html وأدخل بريدك الإلكتروني وهذا الرمز وكلمة المرور الجديدة. لا تشارك هذا الرمز مع أي شخص. إذا لم تطلب إعادة تعيين كلمة المرور، فتجاهل هذه الرسالة.</p>
<p><strong>Español:</strong> Abre https://marocora.com/reset-password.html e introduce tu correo electrónico, este código y tu nueva contraseña. Nunca compartas este código. Si no solicitaste restablecer tu contraseña, ignora este correo.</p>
```

No production action has been executed. Current owner-reported1dc890c/live SMTP
facts are recorded, not independently rechecked. Exact final commit, file list,
public filename identity, wrapper paths/hashes and evidence limits are in the
code-recovery handoff. Real-send/template/switch permissions remain separate.
