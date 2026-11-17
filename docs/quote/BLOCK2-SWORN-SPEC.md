# Block 2 — proposed sworn/certified translation specification

**Design status:** Draft for owner review, 14 November 2026.

**This is a design blueprint only. Production deployment, email transport, payments, customer activation, Block 2 implementation, and Block 3 implementation remain strictly unauthorized.**

## 1. Terminology and eligibility

- **Regular translation:** translation without a separately verified official certification requirement.
- **Certified translation:** translation accompanied by the particular declaration, signature or other certification required by its receiving authority.
- **Sworn translation:** translation performed by someone holding the relevant formal authorization where that designation applies.

These labels must not be treated as interchangeable or universally recognized. Official translator qualifications and certification arrangements differ between jurisdictions. The receiving authority’s documented requirements govern the proposed service. [European e-Justice overview](https://e-justice.europa.eu/topics/find-legal-professional/legal-translators-interpreters_en)

An apostille or legalization requirement must be recorded separately from translation certification. An apostille authenticates the origin of a public document; it does not certify its substantive content. The application must not claim that scanning, translation certification or an apostille guarantees acceptance. [HCCH Apostille Convention outline](https://assets.hcch.net/docs/80d0e86f-7da8-46f8-8164-df046285bcdd.pdf)

**Proposed eligibility rule:**

- Existing translation approval remains necessary but insufficient.
- The provider declares the relevant certification capability, jurisdiction, language directions, issuing body and registration/reference.
- An authorized staff reviewer verifies supporting information and records the source, review time, scope and any expiry.
- A provider cannot approve their own qualification. Being the staff owner does not confer translator qualification.
- Eligibility must match the individual request’s certification route and language direction.
- Suspended, revoked, expired, unverified or mismatched qualifications block assignment acceptance, quote issuance and customer acceptance.
- Recheck current eligibility at each consequential command and before provider document access.
- Preserve historical qualification references without treating an old approval as current permission.

The initial blueprint does not require a new credential-upload subsystem. Verification can reference an official register or documented evidence source; sensitive supporting records must not appear in customer projections.

## 2. Required customer information

Customers may save an incomplete inquiry. Missing or uncertain requirements prevent quotation rather than forcing them to guess.

| Information | Required before quotation |
|---|---|
| Source and target languages | Explicit language direction |
| Destination country and jurisdiction | Identified destination and any relevant subdivision |
| Receiving authority | Named organization, department or recipient |
| Intended use | Administrative purpose supplied by customer |
| Certification route | Staff-reviewed sworn/certified requirement |
| Document description | Type, source country and relevant issuing authority |
| Authority instructions | Uploaded instructions, official reference or recorded explanation of their absence |
| Apostille/legalization | Required, not required or unresolved; specify which document/signature it concerns |
| Original/copy requirement | Whether originals, certified copies or scans are required |
| Delivery format | Digital, physical or both |
| Copies and requested deadline | Explicit requested quantities and date |
| Requirements acknowledgement | Customer confirms the recorded destination and requirements |

Unresolved certification, legalization or delivery requirements block quotation.

A physical-delivery request records a requirement; it does not book a courier or promise shipping. Collect a full delivery address only when necessary for an authorized workflow, with customer contact information remaining restricted.

Official-reference URLs are stored as references. This blueprint does not authorize automatic retrieval of arbitrary URLs.

## 3. Workflow changes

1. **Customer selects “Certified / Sworn Translation.”** Display the additional fields and explain that eligibility and requirements need review.
2. **Customer submits the inquiry and documents.** Classify uploads as source documents or receiving-authority instructions. Both categories remain subject to the same security gates.
3. **Staff owner reviews requirements.** Record the certification route, authority evidence, delivery requirements and unresolved questions. A clean scan establishes only scanning status—not document authenticity, completeness or legal suitability.
4. **Staff invites a qualified provider.** Invitation visibility remains redacted. Only an eligible provider who accepts the assignment gains the existing authorized document access.
5. **Provider confirms suitability for this request.** Record confirmation of the exact requirements version, language direction and certification scope. This is separate from a general qualification record.
6. **Staff owner issues the quote.** Retain the current staff-issued quote model. Freeze the certification description, authority/destination, included and excluded legalization steps, delivery format, document manifest, requirements version, provider confirmation and existing commercial terms.
7. **Customer accepts the exact quote.** Show the complete certification and delivery summary alongside the existing terms. Acceptance binds the frozen evidence and stops at `accepted_pending_activation`; it does not charge, schedule work, issue a certificate or arrange physical delivery.

**Receiving-authority instructions:** an upload is required when the recorded instructions require documentary evidence. Otherwise, staff must record the evidence source and why no instruction file was supplied. “No instructions available” is not automatic approval.

**Changes after review or quotation:**

- A material requirements change creates a new requirements version.
- It invalidates the previous review and provider confirmation.
- Before acceptance, it withdraws an outstanding offer and requires fresh review and quotation.
- Existing quoted document-upload locks remain in force.
- If additional documents are needed after quotation, the initial design uses an explicitly linked replacement request rather than silently adding files to an immutable offer.
- After acceptance, do not overwrite the agreed scope. Any replacement agreement requires a separately approved operational path.

## 4. Data-model and SQL requirements — conceptual only

The current contracts already contain a minimal `certified` object with `receivingAuthority`, `jurisdiction` and `requirements`. That is insufficient for the proposed workflow. Local capture and quote issuance also explicitly reject sworn services; removing those guards alone would not implement Block 2.

**Reuse existing records:**

- `quote_requests`: retain request identity, ownership, revisions and lifecycle.
- `quote_request_versions`: hold the versioned typed certified scope.
- `quote_provider_readiness`: retain existing translation readiness and participation checks.
- `quote_assignments`: retain invitation and acceptance, linked to the relevant scope version.
- `quote_offers`: retain immutable content, document evidence and digests.
- `quote_acceptances`: retain exact offer/policy acceptance.
- Existing events, commands and notification outbox remain separate from fulfilment or payment.

**Proposed additions:**

| Conceptual record | Purpose and constraints |
|---|---|
| Certification qualification versions | Provider, certification type, issuing jurisdiction/body, reference, language directions, validity and reviewer evidence |
| Qualification status events | Append-only approval, suspension, revocation or replacement history |
| Certified requirements reviews | Request/scope version, normalized requirements digest, reviewer, evidence references and resolved/unresolved outcome |
| Assignment certification confirmations | Provider acceptance of the exact reviewed requirements digest and qualification version |
| File-purpose metadata | Immutable classification of source documents versus authority instructions, tied to the request and file |

**Required invariants:**

- No global `is_sworn=true` flag substitutes for scoped qualification.
- Missing certification records fail closed for sworn/certified requests.
- Regular requests do not inherit certification requirements accidentally.
- Review and confirmation must reference the current request scope version.
- Quote content includes the relevant immutable references and digest-covered certification summary.
- Customer acceptance rechecks both current eligibility and the frozen offer evidence.
- Revocation blocks further permission without deleting prior agreement evidence.
- All new writes require controlled commands, restricted privileges, explicit actor derivation and immutable audit history.
- No client may submit an authoritative reviewer, approval state or qualification outcome.
- Any future migration must be separately designed and authorized; no SQL is supplied or installed by this blueprint.

## 5. UI/UX changes

**Customer form**

- Reveal certified-specific fields only for the sworn/certified service.
- Provide explicit “unknown—requires review” choices.
- Separate requested delivery format from actual delivery status.
- Label instruction uploads clearly.
- Explain that eligibility and requirements review are pending.
- Explain that acceptance schedules no work and takes no payment.

**Staff workspace**

- Show requirements completeness, instruction evidence and qualification matches.
- Display unresolved questions and the exact blocking reason.
- Show the reviewed requirements version and provider confirmation.
- Disable quotation while any required review, confirmation, eligibility or clean-scan gate fails.
- Restrict credential evidence and customer contact information to authorized views.

**Provider workspace**

- Show relevant jurisdiction, certification route and requirements after the appropriate assignment/access checks.
- Require confirmation of the exact reviewed requirements.
- Explain expired, revoked or mismatched qualification holds without exposing unrelated private evidence.

**Customer quote view**

- Display certification route, receiving authority, destination, document list, delivery format and included/excluded steps.
- Require agreement to that exact summary and existing quote terms.
- Never display “certified,” “legalized,” “dispatched” or “completed” merely because a quote was accepted.

Proposed review indicators—such as “requirements incomplete,” “provider confirmation needed” or “qualification unavailable”—are derived holds. They do not replace the existing request lifecycle.

## 6. Security and scanning

- Source documents and authority instructions use the existing private upload boundary.
- Retain supported formats and the **10,000,000-byte per-file** limit.
- Retain the existing five-file request limit; instruction uploads count toward it.
- Preserve SHA-256 binding, immutable scan events and clean-only access.
- `infected`, `error`, timeout or missing scan evidence continues to block downloads, quote issuance and acceptance.
- No manual clean override, certification exception or “official document” bypass.
- Provider access remains limited to the currently eligible, accepted assigned provider; staff access remains restricted to the authorized owner.
- A qualification record does not independently grant document access.
- Certification details, filenames and uploaded instructions remain untrusted input.
- Proposed tests use synthetic documents and injected scanner responses. No additional real scan or paid quota use is authorized.

## 7. Proposed test matrix — not executed

These tests would be written and run only after a separate implementation directive.

| Area | Proposed cases | Required result |
|---|---|---|
| Regular-service regression | Existing regular request/quote/acceptance | Existing behavior preserved |
| Typed scope | Missing country/authority, unknown route, invalid delivery choice | Inquiry may remain incomplete; quotation blocked |
| Qualification matching | Correct jurisdiction/languages versus mismatch | Only exact eligible scope accepted |
| Qualification authority | Provider self-approval or client-forged reviewer | Rejected |
| Qualification lifecycle | Unverified, expired, suspended or revoked | Relevant commands/access blocked |
| Requirements evidence | Clean instruction upload, official reference, unresolved absence | Review cannot silently assume requirements |
| Provider confirmation | Missing, stale or wrong requirements digest | Quote blocked |
| Clean scanning mocks | Clean source and instruction files | Authorized flow available |
| Failure scanning mocks | Infected, error, malformed result or timeout in either file category | Quarantine gates preserved |
| Authorization | Customer, invited provider, accepted provider, unrelated staff/account | Existing visibility boundaries preserved |
| Immutable quote | Change certification route, jurisdiction, delivery or manifest after issue | Cannot alter issued evidence |
| Scope revision | Requirements change before acceptance | Review/confirmation invalidated; offer unavailable |
| Exact acceptance | Wrong offer, policy or requirements digest | Rejected |
| Concurrent changes | Qualification revoked while issue/acceptance competes | Atomic recheck prevents stale authorization |
| Command replay | Repeated command; changed payload; revoked access | Idempotency/conflict/access rules preserved |
| Upload boundaries | Spoofed format, oversized file, sixth file | Existing limits enforced |
| Post-quote uploads | New instruction/source file after quotation | Existing lock retained |
| HTTP boundary | Unsupported action, forged actor, missing CSRF, invalid origin | Rejected |
| Persistence | Reload/restart after review, quote and acceptance | Exact recorded evidence recoverable |
| UI behavior | Incomplete fields, blocked controls, escaped text, keyboard navigation | Clear and accessible status |
| Side effects | Accepted sworn quote | No email, payment, work start or physical dispatch |

A future implementation milestone requires the new tests and existing regressions to pass locally. It does not establish managed authentication, production readiness or receiving-authority acceptance.

## 8. Owner review required

Review these proposed product choices before implementation:

- Qualification verification and approval responsibility.
- Supported certification routes and jurisdictions.
- Acceptable evidence when authority instructions are unavailable.
- Physical-delivery requirements and exclusions.
- Replacement-request handling when new documents are needed after quotation.
- Customer-facing terminology and acknowledgements.

No jurisdiction, legal guarantee, pricing, delivery promise or commercial policy is approved by this draft.
