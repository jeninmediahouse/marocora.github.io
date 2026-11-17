# Marocora — Block 1.6 Cloudmersive scanner

## Completion status — owner test performed, result: clean

Block 1.6 is complete for its authorized local scope. On 13 November 2026,
the owner reported a successful real scan of
`tests/fixtures/block15/synthetic.pdf`, with the API key entered privately in
the owner's zsh environment. The retained local scan event independently records
`2026-11-13T21:19:03.456308+00:00`, status `clean`, engine `Cloudmersive`, reason
`API_CLEAN`. No key, document bytes or provider response body was read or saved
by Codex during closeout, and Codex did not run another scan.

The owner confirmed purchase of **Basic, $19.99/month**, with a **1 GB** maximum
file size shown at checkout. These subscription facts are owner-reported;
Codex did not access the account. The application limit remains **10 MB**.
The owner reported that authorized download, quote issuance and acceptance
became available. This does not claim that a new quote was issued or accepted.

Closeout explicitly set `capture_enabled`, `commands_enabled` and
`notifications_enabled` **OFF** in the retained local database, then stopped
PostgreSQL. No local web listener remained on port 4197. The queue contained
13 pending notifications and zero transported notifications. Production
deployment and customer activation remain unauthorized.

## Owner signup and subscription

The instructions below are retained for reference; owner signup and purchase
have now been reported complete.

1. Go to [cloudmersive.com](https://cloudmersive.com).
2. Create your account using your email and a private password. Codex does not
   create this account, accept its agreement or make a payment for you.
3. Navigate to the **Virus Scan API** product and its paid plans.
4. The owner confirmed purchase of the paid **Basic, $19.99/month** plan on
   13 November 2026. The [small-business pricing reference](https://cloudmersive.com/pricing-small-business)
   was checked at the implementation stage. This is the owner's recorded plan,
   not authorization for Codex to purchase or change a subscription.
5. Copy the API key from your dashboard. Keep the key private; do not paste it in
   chat, a public page, source code or a Git commit.
6. The owner confirmed a **1 GB** paid-plan file entitlement at checkout.
   The application still enforces **10 MB (10,000,000 bytes)** per file.
   The free tier was recorded as 600 calls/month and **3.5 MB** per file at the
   implementation stage; that free-tier cap is below the application's limit.

Public prices/limits above were read on 13 November 2026. The owner's subsequent
purchase confirmation is recorded in the completion status above. Only the
owner signs up and pays. No real API request was made during implementation or
automated tests; the successful real scan was performed separately by the owner.

## Local key and explicit test activation

The server reads **CLOUDMERSIVE_API_KEY** from its process environment. It is never
hardcoded, written to a file or printed. `.env` and `.env.cloudmersive` are ignored
by Git. This launcher does not automatically load `.env` files.

With no key, the launcher exits before starting either local service and prints:

```text
Set CLOUDMERSIVE_API_KEY in your environment before launching.
Scanner: Cloudmersive (available: false)
```

To enter the key privately in macOS zsh without including it in a shell command
or history:

```sh
read -r -s "CLOUDMERSIVE_API_KEY?Cloudmersive API key: "
export CLOUDMERSIVE_API_KEY
```

The delivered workflow switches are OFF. A key alone does not activate intake,
commands or notification creation. For your explicit local synthetic PDF test,
from the checkout run:

```sh
node server/block1/start.mjs --enable-local-test
```

This explicit flag enables capture/commands/queued-notifications only in the
guarded local database, for that local test. The launcher prints:

```text
Scanner: Cloudmersive (available: true)
```

Availability means a non-empty key is configured; it does not prove subscription
validity, successful scanning or a real clean result. Open the printed one-use
customer/staff/provider links in separate browser profiles. Use a harmless PDF,
submit it, and check the recorded scan status. Only a strict successful clean
result unlocks authorized staff-owner/assigned-translator downloads and document
quoting/acceptance. Ctrl-C shuts down both local services and restores the three
workflow switches OFF. Starting without `--enable-local-test` keeps them OFF.
After testing, remove the key from your shell:

```sh
unset CLOUDMERSIVE_API_KEY
```

The first real scan was performed by the owner, result: **clean**. **A real scan uploads file bytes
and a generic filename retaining the extension to Cloudmersive over HTTPS and consumes account API
quota.** Codex has not submitted a scan request; the owner used this adapter for
the real test. Do not
mistake local storage for local antivirus processing once this adapter is active.

## SDK and security configuration

Installed package: `cloudmersive-virus-api-client` (official Cloudmersive SDK).
The correct SDK method for configurable restrictions is **scanFileAdvanced** at
`POST https://api.cloudmersive.com/virus/scan/file/advanced`. Plain `scanFile` has
no options argument; using it would not apply the requested restrictions.
[SDK reference](https://github.com/Cloudmersive/Cloudmersive.APIClient.NodeJS.Virus/blob/master/client/docs/ScanApi.md)

Requested options:

```js
allowExecutables: false
allowInvalidFiles: false
allowScripts: false
allowMacros: false
allowPasswordProtectedFiles: false
allowUnsafeArchives: false
allowOleEmbeddedObject: false
restrictFileTypes: '.txt,.pdf,.docx,.jpg,.jpeg,.png'
```

Other supported unsafe-content allowances are explicitly false. A generic
`document.pdf`-style name is supplied as `fileName`, because storage uses an opaque UUID; the original customer's filename is not sent. The
adapter sends the already-hash-verified byte buffer rather than asking the SDK to
reopen a mutable path. It uses a separate SDK client and a 30-second deadline.
Only Boolean `CleanResult: true` yields clean; Boolean false yields infected.
Missing/malformed results, HTTP/auth/quota errors, exceptions, timeouts or changed
file hashes yield error and quarantine. Errors are never clean and never logged
with provider response content or credentials. No automatic scan retry spends
additional quota; staff's explicit retry remains the existing local action.

Original append-only scan events, clean-only download/quote/acceptance SQL gates,
size/format validation, private storage and ownership/assignment rules are
preserved. `localScanner()` remains available in source but the normal launcher
uses Cloudmersive. There is no manual clean override, email transport, payment,
production migration or deployment in Block 1.6.

Customer quarantine message:

> Your file is being scanned for security. This usually takes a few seconds. If
> the scan does not complete, your file will remain in quarantine and staff will
> review it manually.

Manual review means the existing metadata/status review, not permission to mark
an unscanned file clean. Automated tests use an injected SDK transport and
synthetic keys, with outbound network blocked. Mock results are separate from
the successful owner real-PDF test recorded above.
