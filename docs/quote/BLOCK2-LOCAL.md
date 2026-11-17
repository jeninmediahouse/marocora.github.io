# Marocora — Block 2 local implementation

Recorded 14 November 2026. Local synthetic implementation only; no production
deployment, real customer, money, email transport, real scanner call or Block 3.
The earlier `BLOCK2-SWORN-SPEC.md` remains a design-stage record. The owner's
subsequent implementation directive narrows the service to Morocco and specifies
the guarantee, in-person original check and fulfillment choices implemented here.

## Mock-only preview

From the checkout, `node server/block1/start-block2.mjs` creates/opens the isolated
`tmp/block2-private` synthetic database with capture, commands and notifications
OFF. For an explicit local synthetic walkthrough use
`node server/block1/start-block2.mjs --enable-local-test`. This enables those
three local gates for the walkthrough. Ctrl-C restores OFF and stops services.
The server binds loopback port 4198. Use its customer/staff/provider one-use links
in separate browser profiles. Keep those links private.

This launcher imports the loopback network guard and injects the existing
Cloudmersive SDK mock transport. It does not read or require a real scanner key.
Block 2 app creation refuses a scanner without the trusted mock-only marker.
There is no HTTP option for selecting a scanner or asserting a clean result.
The preview assumes a clean mock result; tests also inject infected/error results.
None is proof of actual malware detection or Ministry qualification.

The historical Block 1.6 real-scanner launcher remains unchanged and is not the
launcher for this directive. Do not run it for Block 2. Historical Block 1/1.5
tests remain isolated from the opt-in Block 2 overlay. Public static pages do not
activate Block 2; its added UI is served only by the local mock preview.

## Moroccan provider onboarding and manual review

In the provider workspace follow the credential/review link. Submit only synthetic
Full Legal Name, Date of Birth, Ministry of Justice Credential Number and a
harmless JPEG/PNG fixture. The DOB must be the exact English-month form such as
`August 1 1960`; numeric, abbreviated, impossible, future or padded-day forms are
rejected in the shared browser/server validator and independently in SQL.

Images use existing bounded content/MIME validation and the injected SDK adapter.
The image is temporarily written to a private 0700/0600 quarantine path for the
file-path scanner interface. Only a clean result permits permanent private
retention and a pending review record. Failed images are removed; immutable scan
metadata remains. No staff approval can replace a clean result.

Only the synthetic provider and the designated staff owner can read credential
metadata or clean bytes. Customer, unrelated provider and unrelated staff cannot.
Staff records an explicit approve/reject/revoke decision with reason and revision.
Review history is append-only; a new credential submission requires fresh review.
Sworn provider eligibility is rechecked on invitation, assignment response, quote,
acceptance and provider document access. DOB and credential image are never
included in customer quote projections. No official register is contacted.

## Customer submission and sworn workflow

Choose **Sworn Translation (Morocco)**, with country/jurisdiction exactly Morocco.
Other country values and the old unscoped certified label are rejected. Upload
an initial PDF/JPEG/PNG scan of the original. A TXT alone cannot satisfy that
requirement. The customer can check **I don't have the receiving authority's
instructions.** This is stored as an explicit Boolean; instructions are not
silently fabricated. Staff can review the available requirements.

The UI displays the owner's exact in-person notice and guarantee. Staff issues
the quote for an approved assigned provider; both notices are frozen into the
offer's digest-covered content. Customer acceptance requires acknowledgements
of the original-document check and guarantee and fixes fulfillment to in person.
No digital/USB/shipping substitution is accepted for sworn requests.

Draft creation is an internal upload stage, not order submission. The form
creates a draft, attaches its initial file and calls `/submit`. Ordinary API
creation without `draft:true` immediately submits regular requests. Sworn
submission without an original scan fails. Quarantined uploaded scans may remain
recorded, but all clean-only download/quote/acceptance gates stay closed.
No draft can be quoted. Once submitted, no additional file can be attached—even
before quotation. HTTP rejects before reading/storing/scanning new upload bytes;
SQL rechecks under the existing command mutex. Post-quote/accepted locks remain.
**Missing a page? Start a new order.** opens a new request with a fresh identity.

## Regular translation fulfillment

At exact quote acceptance, select Email Delivery, Physical Shipping or USB Flash
Drive (Encrypted). Shipping requires acknowledgement that shipping charges are
extra. USB requires acknowledgement of extra shipping/drive cost and this exact
warning: **The flash drive will be encrypted for your security. The decryption
password will be sent to your email address. Do not lose the password.**

The immutable acceptance-linked fulfillment record contains the selection,
acknowledgements and server-derived exact terms. Staff sees the saved choice.
Command replays do not create another choice or mock email job.

Email/USB choices create local mock queue entries using the stored verified
synthetic email address. Email waits for a final translated file; USB password
email waits for encrypted-drive preparation. These rows explicitly record no
attachment, no generated password and no message sent. This block implements
selection and mock routing, not final translation preparation, physical shipping,
actual USB encryption or email dispatch. No source original is emailed as though
it were the final translation. No extra charge amount or payment is invented.
Acceptance still stops at `accepted_pending_activation`; no work/payment starts.

## Evidence and unchanged boundaries

The additive `block2.sql` overlay is guarded for the local database/user and
versioned separately from the unchanged original draft/Block 1/Block 1.5 SQL.
The existing retained `tmp/block1-private` state is not upgraded or opened.
The standalone Block 2 state and disposable test states default to all gates OFF.
The full test suite runs under the existing network guard, with scanner keys
removed from the test runner environment and SDK transport injected.

No live credential verification, customer activation, production migration,
deployment, payment, real email, real scanner call or interpretation is enabled.
