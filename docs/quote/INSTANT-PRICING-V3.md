# Marocora — Instant Pricing V3

Recorded 16 November 2026 (Africa/Casablanca). Implemented and verified locally.

**Latest closeout:** owner reports migration 003 applied to staging. V3 cleanup
is complete: pnpm-only commands and automatic image-only PDF bypass are verified
with 210/210 tests. See [V3-CLEANUP-CLOSEOUT.md](V3-CLEANUP-CLOSEOUT.md). The earlier
activation checklist and 208-test results below are retained as stage history;
do not reapply migration 003.
**No production/public deployment, real payment, email, managed SQL change or
live exchange-rate fetch was performed in this stage.** Existing staging Auth
configuration was not read or changed during this pricing work.

## Implemented behavior

- Uploaded TXT, DOCX and text PDFs are counted with
  `@transkripid/document-ocr/count` (pinned 0.14.0), after format inspection and a
  clean scan result. Work runs in a memory-limited worker with a 10-second deadline.
  Uploaded bytes stay local. This parser extracts text; it does not perform image
  OCR. Image-only, unreadable, explicitly scanned documents and sworn documents
  without a reliable PDF page count go to staff manual review, not a zero-word
  instant price. The owner-provided one-hour review message is displayed; human
  review and that operational response time are not automated or guaranteed by
  the test suite.
- Normal 0.70, technical 0.95, legal 1.10, medical 1.05 MAD per word;
  sworn 150 MAD per verified page. PDF page counts come from the document, not
  customer form inputs. Staff enters reviewed word/page quantities for manual cases.
- The owner-confirmed grace is `floor(countedWords * 0.98)`. Sworn pricing uses
  pages, without a word grace deduction. First paid order receives the advertised
  10% promotion before the minimum. The subtotal is floored at 150 MAD, then 20%
  VAT is added and the final total rounded to two decimal places.
- Money uses integer centimes. Deposit gets the extra centime if a total cannot
  split exactly; balance is the exact residual. Both always sum to the total.
  First-order eligibility is determined in the database. Two unpaid discounted
  quotes cannot both consume the first-order promotion after one deposit succeeds.
- Database-backed, tenant-authorized mock payment flow:
  `quoted` → `in_progress_deposit_paid` → `awaiting_balance` → `paid_in_full`.
  There is also `manual_review`. Payments and events are append-only; repeated
  mock payment commands cannot double-charge or repeat a state transition.
- Exact withdrawal consent is mandatory for deposit. Wording, version, actor and
  timestamp are stored. A provider separately records actual commencement of
  work; deposit/checkbox alone does not pretend that work has started.
- Staff assigns an eligible provider. Provider marks completion with a clean
  translated PDF. A bounded worker generates a separate watermarked PDF from
  every page. The customer can view that draft before paying the balance, while
  the final-file route refuses customer access until `paid_in_full`.
- Sworn jobs retain approved-credential checks and require staff confirmation that
  originals were brought to the office before translation starts. The exact
  office-stamping warning is displayed.
- All nine specified languages in both directions; same-language pairs refused.
  Free 250-word sample requests are stored and visible to the team. This is a
  request for human sample work, not automatic translation generation.
- Exact requested Q&A answers and “What we translate” list are on the new UI.
  Quotes include a weekday delivery-date estimate based on 2,000 words/day.
  This is an estimate, not a provider capacity/calendar integration.
- Interpretation removed from customer/provider service choices, public service
  cards, profile offerings and active new intake. The original pure/SQL historical
  scope decoders remain for existing-record compatibility and the required 197
  unchanged regression checks. They do not make interpretation orderable in the
  active intake or Instant V3 API. Historical migrations/tests are not erased.
- `@allratestoday/bank-al-maghrib-exchange-rate` (pinned 1.3.31) supplies latest
  reference tables through AllRatesToday. A terminated worker bounds network
  time to five seconds, one table is cached for an hour, source dates/rates are
  validated, and old/invalid/unavailable rates produce an unavailable message.
  EUR/USD estimates divide MAD by the MAD-per-foreign-unit reference value.
  They never change the MAD amount or the payment currency.

The UI states exactly: “Final payment is processed in MAD. Currency conversion
is for estimation only.” It also clearly labels scanning/payments as mocks.

## Concrete pricing examples

| Case | Pre-VAT subtotal | VAT | Total TTC | Deposit / balance |
| --- | ---: | ---: | ---: | ---: |
| 1,000 normal words → 980 billable, no first-order promotion | 686.00 MAD | 137.20 MAD | 823.20 MAD | 411.60 / 411.60 MAD |
| Same document, first order | 617.40 MAD | 123.48 MAD | 740.88 MAD | 370.44 / 370.44 MAD |
| A document below the minimum | 150.00 MAD | 30.00 MAD | 180.00 MAD | 90.00 / 90.00 MAD |
| Three sworn pages, no first-order promotion | 450.00 MAD | 90.00 MAD | 540.00 MAD | 270.00 / 270.00 MAD |

The isolated VAT helper verifies the requested `100 MAD → 120 MAD` example.
A complete quote with only a 100 MAD calculated base is instead raised to the
150 MAD minimum before VAT. The minimum also limits the first-order promotion;
that interaction is disclosed in the UI.

## Files and architecture

- `server/quote/instant-pricing.mjs`: rate configuration, grace, integer money/VAT/split.
- `server/quote/document-count*.mjs`: isolated package word counter and PDF page count.
- `server/quote/exchange-*.mjs`: keyed rate worker, validation, cache and estimates.
- `server/quote/pdf-draft*.mjs`: bounded PDF watermark worker.
- `server/block1/instant-http.mjs`: private file storage, scanner gating, routes and access checks.
- `server/block1/ui/instant-quote.{html,mjs,css}`: quote/customer/staff/provider interface.
- `supabase/migrations/202611150003_instant_pricing.sql`: three RLS-protected tables,
  restricted definer RPCs, mock-payment audit, stored pricing and consent state.
  It depends on the existing translation migration/seed; it is not a replacement.
- `server/block1/start-instant.mjs`: explicit local preview with synthetic identities.
- Staging launcher/HTTP adapter/database adapter extended to serve Instant V3.
  Historical preview launchers default to their previous flow.
- Public form/service/profile/copy files updated, including all four existing
  public-interface translation dictionaries for changed visitor text.
- Dependencies and canonical `pnpm-lock.yaml` updated. The package manager added
  its explicit release-age exception for the pinned requested rate client;
  dependency lifecycle scripts were disabled during installation. Existing
  Supabase/scanner/esbuild versions were preserved. The older npm lockfile was
  not rewritten; use the declared pnpm package manager for installs.

## Verification

**Final `npm test`: 208 passed, 0 failed, 0 skipped/cancelled.** The 197 existing
checks are included. All **36 preexisting test/fixture files** match the starting
SHA-256 snapshot; none was deleted, weakened or rewritten. Eleven added checks
cover pricing, parser formats, currencies, tenant roles, consent, payment retries,
first-order reuse refusal, final download locking, scan/manual review, sworn
eligibility, OFF gates and the exported managed-schema shape.

Both local legacy and exported Supabase-role schema variants were exercised with
native disposable PostgreSQL, TCP disabled. The exported shape has 35 RLS tables
(32 existing plus three Instant V3 tables). These are local compatibility checks,
not a live cloud validation. Every ordinary regression worker reported zero
outbound attempts under the existing OS/JS network guards.

The first full run found a missing localization entry for newly changed visitor
text. All new public strings received English/French/Arabic/Spanish entries, and
localization plus the full suite passed. The first PDF rendering had a watermark
at the page edge; placement was corrected and the final rendering inspected.
Poppler produced fontconfig environment warnings but completed rendering; the
final page is legible and all watermarks are inside its bounds. An initial
metadata-file race during removal of this task's stopped synthetic preview
cluster was resolved with bounded removal retries. No retained application or
managed database was reset.

Browser verification used a real local customer session: TXT upload, 1,000-word
count, 980-word billable quote, 740.88 MAD TTC, consent-gated mock deposit and
`in_progress_deposit_paid`. Final responsive UI inspection found no horizontal
page overflow at its native viewport (`clientWidth=scrollWidth=1265`). Final
screenshots and the synthetic watermarked PDF are retained for QA. The local
preview was stopped afterward, with its workflow switches forced OFF.

The final static Pages build and `git diff --check` passed. The static build does
not contain private backend/UI files, SQL, test data, environment files or blobs;
Instant V3 is served by the private Node bridge, not deployed as a static-only app.

Evidence directory: `docs/quote/instant-v3-evidence/`:

- `npm-test-final.txt`: final 208/208 output.
- `npm-test-first-full.txt`: initial localization failure, retained.
- `first-tests.txt`, `localization-tests.txt`, `build.txt`.
- `before-test-hashes.json`, `test-preservation.json`.
- `browser-final.jpg`: final full-page UI screenshot.
- `browser-desktop.png`, `browser-mobile.png`: earlier viewport-override captures;
  the browser bridge clipped their right edge, so use `browser-final.jpg` as the
  final visual evidence. Those earlier two files contain JPEG bytes despite the
  capture filenames; they are not final deliverables.
- `draft-watermarked.pdf` / `.png`, `synthetic-final.pdf`: harmless synthetic QA files.

## Run locally, without cloud credentials

From this checkout:

```sh
pnpm install --frozen-lockfile
node server/block1/start-instant.mjs --enable-local-test
```

Use the newly printed one-use customer/staff/provider links in separate browser
profiles, then open `http://127.0.0.1:4197/instant-quote.html`. This preview always
uses local PostgreSQL, synthetic actors, mock scanning/payment, and disables live
rate fetching. No `.env` is loaded. The flag explicitly enables only these local
workflow gates. Ctrl-C stops the owned server/database and forces local gates OFF.
Retained synthetic preview state is under `tmp/instant-v3-private`; it is ignored
and is separate from the older local/private directories.

## Owner-managed staging activation

1. Use the existing intended staging project. Keep real customers and production
   closed. Confirm the existing translation schema/owner seed are installed.
   Read `AUTH-NETWORK-DEBUG-REPORT.md` for the prior schema-USAGE failure; its live
   E2E repair was not verified against cloud during this pricing stage.
2. Keep the three workflow settings OFF while preparing. In **Supabase Dashboard
   → SQL Editor → New query**, as `postgres`/database owner, paste and run the
   entire local `supabase/migrations/202611150003_instant_pricing.sql`.
   It includes schema USAGE and PostgREST cache notification; do not rerun migration
   001 or the seed to install this feature. Do not rerun 003 over existing Instant
   tables: its transaction safely refuses duplicate tables rather than migrating
   populated data. Stop and compare on an existing-schema error.
3. Check the three new tables exist and have RLS, and keep switches OFF:

   ```sql
   SELECT relname, relrowsecurity FROM pg_class
   WHERE relnamespace='public'::regnamespace
     AND relname IN ('instant_orders','instant_mock_payments','instant_order_events')
     AND relkind='r';
   SELECT capture_enabled,commands_enabled,notifications_enabled
   FROM public.quote_settings;
   ```

   Expect three RLS=true rows and three false switches. Table contents are reached
   through controlled RPCs, not through public direct-table grants.
4. If live EUR/USD estimates are desired, privately set `ALLRATESTODAY_API_KEY`
   in the owner's ignored `.env`. This separate provider key is required by the
   requested package; it is not a Supabase key. Do not send it to chat. Without it,
   MAD pricing/payment remain usable and the foreign estimate is unavailable.
5. Run the existing direct/E2E Auth scripts if verifying the prior access repair,
   then start `node --env-file=.env server/block1/start-staging.mjs`. After a
   synthetic sign-in, follow “Open translation workspace” to `/instant-quote.html`.
   `/translation-request.html` also serves Instant V3 in this staging mode.
6. Only for a deliberate synthetic walkthrough, enable the intended staging
   workflow gates in the owner SQL Editor. Upload harmless synthetic documents,
   review manual cases as staff, assign a provider, pay the mock deposit, record
   commencement, upload the provider's translated PDF, view the watermarked draft,
   then pay the mock balance and verify final download. For sworn jobs, review
   the provider credential through the existing credential UI and confirm original
   presentation as staff before starting work. These are recorded simulations,
   not money collection, Ministry verification or real delivery.
7. Force all three switches OFF afterward with the existing STAGING-SETUP shutdown
   SQL, then stop the app. The Node staging launcher does not switch cloud settings
   OFF automatically. Report only sanitized results; no keys, passwords or tokens.

No cloud migration or live rate-provider call was made by Codex in this stage.
Managed behavior and real provider data remain to be verified by the owner.
Private source/draft/final bytes stay on the Mac, with 0700 directories/0600 files
and hash checks. If a record RPC fails ambiguously after a possible commit, its
private bytes are retained rather than destroyed; reconciliation of such orphaned
files remains a staging storage limitation, not a managed backup facility.

## Source references and boundaries

[Package word-count API](https://www.npmjs.com/package/@transkripid/document-ocr)
accepts bytes and counts extracted text. The
[rate package](https://www.npmjs.com/package/@allratestoday/bank-al-maghrib-exchange-rate)
and [provider reference](https://allratestoday.com/central-bank-rates-api/bam/)
document the separate API key, reference date and MAD-per-unit rate orientation.

The exact owner-requested withdrawal wording is implemented. The
[Moroccan Ministry consumer guide](https://mcinet.gov.ma/sites/default/files/Guide%20du%20consommateur%20-%20FR.pdf)
explains the distance-service withdrawal exception tied to consumer consent and
actual commencement. This checkbox/audit record alone is not verification of all
Law 31-08 obligations, required notices or the owner's commercial/tax status.
No real payment provider or production legal/commercial launch is implemented.

## Handoff — Marocora — Instant Pricing V3 Managed Verification

Checkout: `/Users/tareqnaser/Documents/ChatGPT/Marocora Site building/output/marocora-quote-workflow-local`.
Branch: `codex/marocora-quote-workflow-local`. No commit/push/deployment in this stage;
preexisting uncommitted work remains. Completed local tests/build/visual QA need
not be repeated unless code changes or a new managed error warrants it.

Remaining setup: owner applies migration 003 to staging, privately configures a
rate-provider key if wanted, and runs the synthetic managed walkthrough. Open
policy choices, if the owner wishes to change them: promotion before minimum,
first-order promotion eligibility at first deposit, residual centime on balance,
weekday delivery estimates and seven-day maximum accepted rate age.

Ready-to-use next-chat prompt:

> Continue **Marocora — Instant Pricing V3 Managed Verification**. Read
> `docs/quote/INSTANT-PRICING-V3.md` and the latest Auth report. Local implementation
> is complete: 208/208 tests, original 197 unchanged, build and browser/PDF QA done.
> Do not repeat completed work. Help interpret sanitized results after I apply
> `202611150003_instant_pricing.sql` in staging and run the mock workflow. Preserve
> the OFF-by-default gates and credential privacy; no production deployment, real
> money, scanner or email. Live exchange estimates require a private AllRatesToday
> key; do not invent rates if unavailable.
