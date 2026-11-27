# Legal pages — decisions and facts (25 November 2026)

Status: **published 25 November 2026** in release
`supabase-5628ab3.legal-20261125-r1`, source `5628ab3`, PM2
`marocora-supply-5628ab3`. All four pages verified byte-identical to the frozen
build after the switch; `22da9ff` stopped and retained for rollback.

Published file count 121 (116 + `legal.html`, `privacy.html`, `terms.html`,
`imprint.html`, `legal.css`); guarded suite 431/431.

## Entity facts used in the documents

| Field | Value |
| --- | --- |
| Legal name | **Jenin Global Enterprises LLC** (superseded Jenin Realty LLC on 27 November 2026) |
| Jurisdiction | North Carolina, United States |
| Secretary of State ID | pending confirmation |
| Formed | 10 June 2025 (filing C202516101246) |
| Status | Active status to be confirmed for the new entity |
| Registered agent | Tareq Abushikha |
| Registered address | pending confirmation |
| Managers | Tanya Abushikha, Tareq Abushikha |
| Contact for legal and privacy | tareq@jeninmediahouse.com |

No other status is recorded in this repository.

## Decisions taken by the owner

1. **One entity only.** The operation is presented as a US LLC; no Moroccan
   company registration is claimed anywhere in the documents.
2. **Marocora is an introductions platform.** It publishes reviewed profiles,
   clients contract directly with professionals, and Marocora is not a party to
   that agreement, nor an employer or agent of the professionals.
3. **Governing law:** North Carolina, with an express carve-out preserving
   mandatory consumer-protection rights in the user's country of residence.
4. **Languages:** English and Arabic, with the English version governing.
5. **Address published** in the legal notice.
6. **Defaults accepted:** 18+ for accounts; 24-month retention after last
   activity for accounts; 12 months for rejected applications; 30-day rolling
   encrypted backups; no cookie banner because no analytics or advertising
   trackers exist.

## What was built

| File | Purpose |
| --- | --- |
| `legal.html` | Hub: links, venue statement, operator facts |
| `privacy.html` | Controller, data categories, lawful bases, processors, retention, rights, security, automated decisions, children |
| `terms.html` | Agreement, venue model, eligibility, applications, client conduct, payments unavailable, acceptable use, IP, disclaimers, liability, indemnity, termination, NC law, disputes |
| `imprint.html` | Company identification, responsible person, hosting, consumer information, copyright |
| `legal.css` | Shared styling for the four pages |
| `tests/legal-pages.test.mjs` | Entity facts, processor disclosure, governing law, placeholder guards, footer links |

Legal pages do not load `site-language.mjs` and mark their content
`data-user-content`, so the machine translator cannot rewrite fixed wording.
They are excluded from the four-language coverage test for that reason.

## Wiring and what was deliberately avoided

- Added to `publicPages` and `legal.css` to `browserAssets`, with a rebuilt
  pages artifact.
- Footer links added to `index.html`, `contact.html` and `learn/index.html`.
- **`professionals.html` and `supply-register.html` were left untouched.** Both
  are pinned in `preservesSourceSha256` of the rollback boundary manifest, and
  changing them without a deliberate fingerprint refresh would quietly weaken
  that boundary. Their legal links are a separate, explicit change.

## Open items

- **Legal review.** The text is engineering drafting, not advice. A lawyer should
  review the liability cap, the venue clause, the NC forum choice for Moroccan
  consumers, and the retention periods.
- **Arabic review.** The Arabic translation is a faithful courtesy version; a
  native legal reader should check at least the rights and liability sections.
- **Terms acceptance at sign-up.** No checkbox or notice exists yet on
  `supply-register.html`. Required before advertising, and it needs the boundary
  fingerprint refresh described above.
- **No cookie banner** is published. That remains correct only while no analytics
  or advertising tracker is added; adding one requires revisiting the privacy
  policy and consent handling.
- **Cross-border invoicing.** With a US entity and Moroccan professionals,
  invoicing, VAT and any future payouts need an accountant's view before payments
  launch.

## Superseding directive — 27 November 2026

The owner directed that **Jenin Global Enterprises LLC** is the sole contracting
entity for Marocora, superseding Jenin Realty LLC, Jenin Media House and any
Moroccan entity. Published legal pages were updated on 27 November 2026: the
entity name was replaced, and the old entity's SOSID, formation date, registered
address, agent and manager rows were removed rather than carried across, because
they belong to the former company. New registration details must be supplied
before the legal notice is complete.

North Carolina, United States remains the proposed governing jurisdiction.
