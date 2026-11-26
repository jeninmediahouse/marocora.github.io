# Teacher introduction video — step 1 design (26 November 2026)

Status: **steps 1–6 live on 26 November 2026**, release
`supabase-9639494.video-consent-20261126-r1`, source `9639494`, PM2
`marocora-supply-9639494`. Migrations `202611260002`–`202611260005` applied.

Verified in production with a real applicant: an 8.4 MB phone video uploaded,
converted, and streamed back to its owner through the authenticated range
endpoint; the reviewer saw and played the same converted video; approval
succeeded and the approval email was delivered. Test application and its stored
objects were then deleted.
Scope of step 1: private storage, validation, transcode. No applicant UI, no
public player, no approval rule in this step.

Owner inputs received: bucket `marocora-intro-videos` (AMS3, private), a
bucket-scoped key stored as `INTRO_VIDEO_BUCKET`/`INTRO_VIDEO_KEY`/
`INTRO_VIDEO_SECRET`, `ffmpeg`/`ffprobe` 6.1.1 installed, and caps confirmed
(120 MB, 3 minutes, 3 uploads per hour).

## 1. Decisions already made by the owner

| Decision | Value |
| --- | --- |
| Hosting | Self-hosted on DigitalOcean Spaces, no YouTube/Vimeo |
| Capture paths | Upload first, in-browser recording second |
| Length | Soft cap 3 minutes; hard file cap 120 MB |
| Public presentation | "Watch introduction" button opening a player page on `marocora.com/intro/<id>` |
| Enforcement | Mandatory for every teacher application; no grandfathering |
| Build order | storage → capture UI → mandatory rule → review player → public player → privacy/consent |

## 2. Storage layout

New private bucket, separate from credentials and from database backups:

```text
marocora-intro-videos            (private, AMS3)
  intro-source/<applicationId>/<videoId>/source.<ext>  temporary, deleted after transcode
  intro/<applicationId>/<videoId>/playback.mp4     720p H.264 + AAC, faststart
  intro/<applicationId>/<videoId>/poster.jpg       640px frame at 1s
  intro/<applicationId>/<videoId>/meta.json        duration, bytes, sha256, created
```

`<videoId>` is a server-generated UUID, so replacing a video never overwrites an
old object and public URLs cannot be guessed from an application id.

The source lives under its own `intro-source/` prefix because the console offers
no lifecycle rules: keeping sources separate means any future cleanup rule or
sweeper can target them without touching playable videos.

Why a separate bucket: per-bucket lifecycle rules (delete `source.*` after a day),
per-bucket CDN and CORS settings, and no chance of a video path colliding with a
private credential key.

### Existing storage module is not reused as-is

`server/storage/spaces.mjs` buffers whole objects in memory (16 MB cap) and has a
fixed `translation/v1/` prefix. Video needs streaming and range reads, so step 1
adds `server/storage/video.mjs` with the same configuration discipline:

- `putStream(key, readStream, size, contentType)` — no buffer in memory
- `head(key)` — size, contentType, ETag
- `openRange(key, start, end)` — 206 streaming for playback
- `remove(key)`
- configuration from `INTRO_VIDEO_BUCKET` / `INTRO_VIDEO_KEY` / `INTRO_VIDEO_SECRET`
  (falling back to the existing Spaces key pair only if the owner prefers)

## 3. Upload endpoint (private)

```text
POST /api/supply/applications/:id/intro
```

Auth: verified session owning the application, `vendor_type = 'teacher'`.
Transport: raw body streamed to a temp file (`/tmp`, 0600), not assembled in
memory. Required headers: `content-type`, `content-length`, `x-file-name`.

| Rule | Value | Rejection code |
| --- | --- | --- |
| Size | ≤ 120 MB | `SUPPLY_INTRO_TOO_LARGE` (413) |
| Content types | `video/mp4`, `video/webm`, `video/quicktime` | `SUPPLY_INTRO_TYPE_INVALID` (415) |
| Magic bytes | `ftyp` (MP4/MOV) or EBML `1A45DFA3` (WebM) | `SUPPLY_INTRO_FORMAT_INVALID` (422) |
| Duration | ≤ 180 s when `ffprobe` can read it | `SUPPLY_INTRO_TOO_LONG` (422) |
| Rate | 3 uploads per hour per account | `SUPPLY_INTRO_RATE_LIMIT` (429) |
| Concurrency | one processing video per application | `SUPPLY_INTRO_BUSY` (409) |

Response: `202 {"status":"processing","videoId":"<uuid>"}` — the request returns
after the source is safely stored, not after transcoding.

### Why 202 and not 200

Transcoding a 3-minute clip can take tens of seconds. Holding the HTTP request
open invites timeouts on mobile networks and duplicates on retry. The dashboard
polls status instead.

## 4. Transcode pipeline

Requires `ffmpeg` and `ffprobe` on the server (to be confirmed; if absent,
`apt-get install -y ffmpeg` is an owner-run step before enabling uploads).

```text
ffprobe  → duration, streams, audio presence
ffmpeg   → -i source -vf scale='min(1280,iw)':-2 -c:v libx264 -preset veryfast \
           -crf 23 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart playback.mp4
ffmpeg   → -ss 1 -frames:v 1 -vf scale=640:-2 poster.jpg
```

- Output is normalised to MP4 so Safari, Chrome and Android all play it.
- If the source has no audio track, the job still succeeds but the review queue
  flags `no_audio` — a face-only "introduction" defeats the purpose.
- On success: delete `source.*`, write `meta.json`, mark the row `ready`.
- On failure: keep nothing public, mark `failed` with a fixed code, delete the
  source after 24 hours, allow immediate re-upload.
- Concurrency is capped at one ffmpeg process per upload, two overall, so a burst
  cannot starve the web server.

### Crash safety

Status lives in the database (`processing` → `ready`|`failed`) and the object
prefix is written last. A restart during transcode leaves a `processing` row
older than 10 minutes, which the next upload or a small reconciler marks
`failed`, so no application is stuck forever.

## 5. Playback endpoints

| Endpoint | Who | Behaviour |
| --- | --- | --- |
| `GET /api/supply/applications/:id/intro` | owner, staff | JSON metadata: status, duration, bytes, poster URL |
| `GET /api/supply/applications/:id/intro/video` | owner, staff | 206 stream for the review player; works while pending |
| `GET /intro/:id` | public | Player page, only if the application is approved, published, teacher, and has a `ready` video |
| `GET /api/intro/:id/video` | public | 206 stream, same preconditions |

Response headers on both streams: `Content-Type: video/mp4`,
`X-Content-Type-Options: nosniff`, `Content-Disposition: inline`,
`Cache-Control: private, max-age=300` for staff and `public, max-age=3600` for
approved public video, `Accept-Ranges: bytes`. Range requests are honoured with
correct `206` and `Content-Range`.

Nothing is served publicly from the bucket directly: the bucket stays private and
the server proxies. That keeps the "approved and published" check authoritative
and lets the video be withdrawn instantly.

## 6. Database changes (one migration, owner-run)

```text
public.supply_intro_videos
  application_id uuid primary key references supply_applications(id) on delete cascade
  video_id uuid not null
  status text not null check (status in ('processing','ready','failed'))
  duration_seconds numeric(6,2)
  bytes bigint
  has_audio boolean
  failure_code text
  created_at, updated_at timestamptz
```

RPCs, all `SECURITY DEFINER` with RLS-style revokes as the existing supply
functions:

- `supply_intro_begin(p_id)` — owner-only, teacher-only, enforces one-at-a-time
- `supply_intro_ready(p_id, p_video, p_duration, p_bytes, p_audio)` — service role
- `supply_intro_failed(p_id, p_code)` — service role
- `supply_intro_get(p_id)` — owner or staff
- approval gate: `supply_review_application` raises `SUPPLY_INTRO_VIDEO_REQUIRED`
  when `vendor_type='teacher'` and no `ready` row exists

The approval gate is the authoritative rule. The client will also block submit,
but a direct API call cannot bypass the database.

## 7. Security and abuse

- Upload requires a verified, signed-in owner of that application; no anonymous
  writes.
- Extension, declared MIME and magic bytes must agree; mismatch is rejected
  before storage.
- Only `ffmpeg` output is ever served; the original source is never public.
- Serving is proxied, never direct bucket access, so withdrawal is immediate.
- Rate limit 3/hour/account plus one concurrent job.
- No HTML/SVG is accepted, and `nosniff` prevents content sniffing.
- Logs record fixed codes only: no filenames, no applicant identity.

## 8. Lifecycle

| Event | Behaviour |
| --- | --- |
| Replacement | Old objects deleted after the new video reaches `ready` |
| Rejection | Video kept for re-review; deleted 12 months after the last rejection |
| Withdrawal / account deletion | Cascades from `supply_applications`; objects deleted by a reconciler |
| Orphaned source | Deleted after 24 hours by bucket lifecycle rule |
| Public visibility | Ends immediately when status leaves `approved` |

## 9. Cost at launch

Same arithmetic as the earlier estimate: 50 teachers × 25 MB ≈ 1.25 GB, inside
the $5/month Spaces tier (250 GB storage, 1 TB transfer). Bandwidth becomes the
variable cost with success: ~40,000–65,000 one-minute views inside the included
terabyte, then roughly $0.01/GB.

## 10. Test plan

- Unit: magic-byte detection, size/type/duration validation, failure codes.
- Integration with a fake S3 and a stubbed `ffmpeg`: accepted file reaches
  `ready`, corrupt file reaches `failed`, oversized file rejected before storage.
- Range handler: full request, open-ended range, suffix range, invalid range.
- Authorisation: other applicant cannot read or write; anonymous cannot read a
  pending video; public cannot read after status leaves `approved`.
- Approval gate: teacher without a ready video cannot be approved; translator
  unaffected.

## 11. Implementation notes

Files: `server/storage/video.mjs` (streaming store), `server/supply/intro.mjs`
(validation, probe, transcode, rate limit), routes in `server/supply/http.mjs`,
RPC allowlists in `server/production/supabase.mjs`, and migration
`202611260002_supply_intro_videos.sql` (table + four functions).

Tests: `tests/intro-video.test.mjs` covers magic-byte format detection, size and
duration edges, accepted upload (source → playback → poster → prune), rejected
format, over-long video, unreadable video, the fourth upload in an hour, and a
transcode failure marking the row failed. Suite 472/472.

Known limits carried into step 2:

- No automatic sweeper yet for a source left behind by a crash mid-transcode.
  The transcode path deletes it on success and on handled failure; the sweep is
  part of step 2.
- Nothing is playable yet: staff playback is step 4, public playback step 5.
- The migration has not been applied; it should be applied before step 2 ships,
  because the upload endpoint needs those functions.

## 12. Step 2 — implemented 26 November 2026 (not deployed)

Added to the teacher dashboard: a capture block with file upload first and
camera recording second, a live timer capped at 180 seconds, a local playback
preview before uploading, an upload progress bar, and status polling through
`processing` → `ready`/`failed`. Recorded clips are sent as WebM or MP4 depending
on what the browser supports.

Also added: authenticated owner/staff playback with correct range responses, so
a teacher can review their own video after conversion, and a six-hourly sweep
that deletes stray `intro-source/` objects older than a day and marks their rows
failed.

Tests: 475/475, including range parsing (full, open, suffix, invalid), sweeper
selection and the capture wiring.

Known limits at this point:

- Dashboard status messages are English only; the static labels are translated.
- Nothing is public yet: no profile button, no player page.
- The approval rule is not in place until step 3, so a teacher could still be
  approved without a video if step 2 shipped alone. Ship steps 2 and 3 together.

## 13. Step 3 — implemented 26 November 2026 (not deployed)

The database now refuses to approve a teacher application unless a video row is
`ready` (`SUPPLY_INTRO_VIDEO_REQUIRED`); translators and transport are unaffected.
The review card fetches the video status, plays the converted video inline, and
disables **Approve** for teachers until it is ready. The dashboard marks the
video as required before approval. Client error messages were added for every
intro failure code.

Tests: 477/477, including a SQL guard that the approval check exists and a UI
guard that the player and the approval block are wired.

## 14. Steps 5 and 6 — live 26 November 2026

Step 5 adds the public `/intro/<id>` page and `/api/intro/<id>/video` range
stream, both gated by `supply_public_intro` (approved at the current revision,
verified owner, not excluded, publication consent, processed video). Public
profiles expose `hasVideo`, so the profile shows a Watch introduction button
only when one exists. No third-party embed, no cookies.

Step 6 adds an explicit consent checkbox at capture (enforced server-side via an
`X-Video-Consent` header and recorded as `consent_at`), an owner **Withdraw
application** action that deletes the application and its stored playback and
poster immediately, a six-hourly orphan sweep that deletes any intro object
whose row is gone (covering crashes and account closure), and privacy-policy
text in English and Arabic describing video as personal data with its storage,
retention and deletion.

Verified live: `/intro/ba79531c…` 200 with the converted video and the correct
"Language teacher" label, stream 200 with range support, unapproved or
non-consented profiles 404, privacy page carries both language sections.

## 15. What remains from the owner before step 2

Nothing for storage; the bucket, key and binaries are in place. The migration
`202611260002_supply_intro_videos.sql` must be applied in the SQL editor before
the release that enables uploads.
