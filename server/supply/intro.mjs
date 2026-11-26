// Teacher introduction videos: private upload, validation and transcode.
// Step 1 exposes only the private endpoint and status; no public playback yet.

import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createWriteStream} from 'node:fs';
import {mkdtemp, rm, stat, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pipeline} from 'node:stream/promises';
import {MAX_VIDEO_BYTES} from '../storage/video.mjs';

export const MAX_DURATION_SECONDS = 180;
export const MAX_UPLOADS_PER_HOUR = 3;
const SOURCE_PREFIX = 'intro-source/';
const VIDEO_PREFIX = 'intro/';
const RATE_WINDOW_MS = 60 * 60 * 1000;
export const SOURCE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const fail = (code, status = 400) => { throw Object.assign(Error(code), {status}); };

const MP4_BRANDS = new Set(['isom', 'iso2', 'mp41', 'mp42', 'avc1', 'M4V ', 'qt  ', 'dash']);
const WEBM_MAGIC = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);

export function sniff(bytes) {
  if (!bytes || bytes.length < 12) return null;
  if (bytes.subarray(4, 8).toString('latin1') === 'ftyp') {
    const brand = bytes.subarray(8, 12).toString('latin1');
    return MP4_BRANDS.has(brand) ? 'mp4' : null;
  }
  if (bytes.subarray(0, 4).equals(WEBM_MAGIC)) return 'webm';
  return null;
}

export function extensionFor(format, contentType) {
  if (format === 'mp4') return contentType === 'video/quicktime' ? 'mov' : 'mp4';
  if (format === 'webm') return 'webm';
  return null;
}

export function withinLimits(bytes) {
  return Number.isSafeInteger(bytes) && bytes > 0 && bytes <= MAX_VIDEO_BYTES;
}

export function parseRange(header, total) {
  if (typeof header !== 'string' || !header.trim()) return {status: 200, start: 0, end: total - 1};
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (match[1] === '' && match[2] === '')) return null;
  let start;
  let end = total - 1;
  if (match[1] === '') {
    const suffix = Number(match[2]);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    start = Math.max(0, total - suffix);
  } else {
    start = Number(match[1]);
    if (match[2] !== '') end = Math.min(Number(match[2]), total - 1);
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= total) return null;
  return {status: 206, start, end};
}

export function durationAllowed(seconds) {
  return Number.isFinite(seconds) && seconds > 0 && seconds <= MAX_DURATION_SECONDS;
}

function run(command, args, timeout) {
  return new Promise(resolve => {
    const child = spawn(command, args, {stdio: ['ignore', 'pipe', 'pipe']});
    const out = [];
    let settled = false;
    const timer = setTimeout(() => { if (!settled) { settled = true; child.kill('SIGKILL'); resolve({ok: false, stdout: '', code: 'timeout'}); } }, timeout);
    child.stdout.on('data', chunk => out.push(chunk));
    child.stderr.on('data', () => {});
    child.on('error', () => { if (!settled) { settled = true; clearTimeout(timer); resolve({ok: false, stdout: '', code: 'spawn'}); } });
    child.on('close', code => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      resolve({ok: code === 0, stdout: Buffer.concat(out).toString('utf8'), code});
    });
  });
}

export function createIntroService({env, store, rpc, serviceRpc, logger = console, workRoot = tmpdir(), probeFile = probe, transcodeFile = transcode}) {
  const ffmpeg = env.FFMPEG_PATH || '/usr/bin/ffmpeg';
  const ffprobe = env.FFPROBE_PATH || '/usr/bin/ffprobe';
  const rate = new Map();

  const allowed = actor => {
    const now = Date.now();
    const entry = rate.get(actor);
    if (!entry || now - entry.start > RATE_WINDOW_MS) { rate.set(actor, {start: now, count: 1}); return true; }
    if (entry.count >= MAX_UPLOADS_PER_HOUR) return false;
    entry.count += 1; return true;
  };

  async function probe(durationPath) {
    const result = await run(ffprobe, ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type', '-of', 'default=nw=1', durationPath], 20000);
    if (!result.ok) return {duration: null, hasAudio: null};
    const durationMatch = /duration=([0-9.]+)/.exec(result.stdout);
    const duration = durationMatch ? Number(durationMatch[1]) : null;
    const hasAudio = /codec_type=audio/.test(result.stdout);
    return {duration, hasAudio};
  }

  async function transcode(source, dir) {
    const playback = join(dir, 'playback.mp4');
    const poster = join(dir, 'poster.jpg');
    const converted = await run(ffmpeg, [
      '-y', '-i', source,
      '-vf', "scale='min(1280,iw)':-2", '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
      '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', playback,
    ], 180000);
    if (!converted.ok) throw Object.assign(Error('SUPPLY_INTRO_TRANSCODE_FAILED'), {status: 422});
    const frame = await run(ffmpeg, ['-y', '-ss', '1', '-i', playback, '-frames:v', '1', '-vf', 'scale=640:-2', poster], 30000);
    if (!frame.ok) throw Object.assign(Error('SUPPLY_INTRO_POSTER_FAILED'), {status: 422});
    return {playback, poster};
  }

  async function receive(req) {
    const declared = Number(req.headers['content-length']);
    if (!withinLimits(declared)) fail('SUPPLY_INTRO_TOO_LARGE', 413);
    const dir = await mkdtemp(join(workRoot, 'marocora-intro-'));
    const source = join(dir, 'source');
    const hash = createHash('sha256');
    try {
      await pipeline(req, async function* (stream) {
        let seen = 0;
        for await (const chunk of stream) {
          seen += chunk.length;
          if (!withinLimits(seen)) fail('SUPPLY_INTRO_TOO_LARGE', 413);
          hash.update(chunk);
          yield chunk;
        }
      }, createWriteStream(source, {mode: 0o600}));
    } catch (error) {
      await rm(dir, {recursive: true, force: true});
      throw error;
    }
    return {dir, source, sha256: hash.digest('hex')};
  }

  return {
    async upload({req, session, applicationId}) {
      if (!allowed(session.actor)) fail('SUPPLY_INTRO_RATE_LIMIT', 429);
      const {dir, source, sha256} = await receive(req);
      try {
        const size = (await stat(source)).size;
        if (!withinLimits(size)) fail('SUPPLY_INTRO_TOO_LARGE', 413);
        const head = (await readFile(source)).subarray(0, 12);
        const format = sniff(head);
        if (!format) fail('SUPPLY_INTRO_FORMAT_INVALID', 422);
        const contentType = format === 'mp4' ? 'video/mp4' : 'video/webm';
        const {duration, hasAudio} = await probeFile(source);
        if (duration !== null && !durationAllowed(duration)) fail('SUPPLY_INTRO_TOO_LONG', 422);
        if (duration === null) fail('SUPPLY_INTRO_UNREADABLE', 422);

        const begun = await rpc(session, 'supply_intro_begin', {p_id: applicationId, p_video: store.newId()});
        if (!begun || !begun.videoId) fail('SUPPLY_INTRO_STATE_INVALID', 409);
        const videoId = begun.videoId;
        const sourceKey = `${SOURCE_PREFIX}${applicationId}/${videoId}/source.${extensionFor(format, contentType)}`;
        await store.putStream(sourceKey, source, size, contentType);

        const job = transcodeFile(source, dir)
          .then(async ({playback, poster}) => {
            const playbackKey = `${VIDEO_PREFIX}${applicationId}/${videoId}/playback.mp4`;
            const posterKey = `${VIDEO_PREFIX}${applicationId}/${videoId}/poster.jpg`;
            const playbackSize = (await stat(playback)).size;
            await store.putStream(playbackKey, playback, playbackSize, 'video/mp4');
            await store.putStream(posterKey, poster, (await stat(poster)).size, 'image/jpeg');
            await serviceRpc('supply_intro_ready', {p_id: applicationId, p_video: videoId, p_duration: duration, p_bytes: playbackSize, p_audio: hasAudio === true});
            await store.remove(sourceKey).catch(() => {});
            if (begun.previousVideoId && begun.previousVideoId !== videoId) {
              for (const suffix of ['playback.mp4', 'poster.jpg']) {
                await store.remove(`${VIDEO_PREFIX}${applicationId}/${begun.previousVideoId}/${suffix}`).catch(() => {});
              }
            }
          })
          .catch(async error => {
            logger.warn('SUPPLY_INTRO_' + (error?.message || 'TRANSCODE_FAILED'));
            await serviceRpc('supply_intro_failed', {p_id: applicationId, p_video: videoId, p_code: 'TRANSCODE_FAILED'}).catch(() => {});
            await store.remove(sourceKey).catch(() => {});
          })
          .finally(() => rm(dir, {recursive: true, force: true}).catch(() => {}));
        // Keep the event loop free; failures are handled inside the promise.
        job.catch(() => {});

        return {status: 'processing', videoId, sha256, bytes: size, duration};
      } catch (error) {
        await rm(dir, {recursive: true, force: true}).catch(() => {});
        throw error;
      }
    },

    async status({session, applicationId}) {
      const row = await rpc(session, 'supply_intro_get', {p_id: applicationId});
      if (!row) return {status: 'none'};
      return row;
    },
  };
}

export async function sweepIntroSources({store, serviceRpc, now = Date.now(), maxAge = SOURCE_MAX_AGE_MS, logger = console}) {
  const stale = (await store.list(SOURCE_PREFIX)).filter(item => {
    const at = item?.lastModified ? new Date(item.lastModified).getTime() : NaN;
    return Number.isFinite(at) ? now - at >= maxAge : true;
  });
  let removed = 0;
  const failed = new Set();
  for (const item of stale) {
    try {
      await store.remove(item.key);
      removed += 1;
      const [, applicationId, videoId] = item.key.split('/');
      if (applicationId && videoId && !failed.has(applicationId) && typeof serviceRpc === 'function') {
        failed.add(applicationId);
        try { await serviceRpc('supply_intro_failed', {p_id: applicationId, p_video: videoId, p_code: 'STALE_UPLOAD'}); } catch {}
      }
    } catch {
      logger.warn('SUPPLY_INTRO_SWEEP_FAILED');
    }
  }
  return {removed, candidates: stale.length};
}
