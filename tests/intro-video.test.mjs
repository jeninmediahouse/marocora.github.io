import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {readFileSync, existsSync} from 'node:fs';
import {introPage} from '../server/supply/public-intro.mjs';
import {sniff, withinLimits, durationAllowed, parseRange, createIntroService, sweepIntroSources, MAX_DURATION_SECONDS} from '../server/supply/intro.mjs';

const APP = '0b0e1c9d-61e2-49f0-9bb5-d1b6e6fb3cbc';
const VIDEO = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

function mp4(bytes = 2048) {
  const buffer = Buffer.alloc(bytes, 0x20);
  buffer.writeUInt32BE(24, 0);
  buffer.write('ftypisom', 4, 'latin1');
  return buffer;
}
function webm(bytes = 2048) {
  const buffer = Buffer.alloc(bytes, 0x20);
  Buffer.from([0x1a, 0x45, 0xdf, 0xa3]).copy(buffer, 0);
  return buffer;
}

function fakeStore(calls) {
  return {
    newId: () => VIDEO,
    async putStream(key, file, size, type) { calls.put.push({key, size, type}); },
    async remove(key) { calls.remove.push(key); },
    async head() { return null; },
    async openRange() { throw Error('not used'); },
  };
}

function service({bytes = mp4(), probe = {duration: 30, hasAudio: true}, begin = {videoId: VIDEO, previousVideoId: null}, calls, transcode}) {
  const rpcCalls = {user: [], service: []};
  const instance = createIntroService({
    env: {FFMPEG_PATH: '/bin/true', FFPROBE_PATH: '/bin/true'},
    store: fakeStore(calls),
    rpc: async (session, name, args) => { rpcCalls.user.push({name, args}); if (name === 'supply_intro_begin') return begin; return null; },
    serviceRpc: async (name, args) => { rpcCalls.service.push({name, args}); return {}; },
    logger: {warn() {}},
    probeFile: async () => probe,
    transcodeFile: transcode || (async (source, dir) => {
      const playback = join(dir, 'playback.mp4');
      const poster = join(dir, 'poster.jpg');
      await writeFile(playback, Buffer.alloc(1024));
      await writeFile(poster, Buffer.alloc(256));
      return {playback, poster};
    }),
  });
  const req = Readable.from([bytes]);
  req.headers = {'content-length': String(bytes.length), 'content-type': 'video/mp4'};
  return {instance, req, rpcCalls};
}

test('format sniffing trusts magic bytes, not headers', () => {
  assert.equal(sniff(mp4()), 'mp4');
  assert.equal(sniff(webm()), 'webm');
  assert.equal(sniff(Buffer.from('GIF89a......', 'latin1')), null);
  assert.equal(sniff(Buffer.alloc(4)), null);
  const odd = mp4(); odd.write('zzzz', 8, 'latin1');
  assert.equal(sniff(odd), null);
});

test('size and duration limits reject the edges', () => {
  assert.equal(withinLimits(1), true);
  assert.equal(withinLimits(120 * 1024 * 1024), true);
  assert.equal(withinLimits(120 * 1024 * 1024 + 1), false);
  assert.equal(withinLimits(0), false);
  assert.equal(durationAllowed(0.5), true);
  assert.equal(durationAllowed(MAX_DURATION_SECONDS), true);
  assert.equal(durationAllowed(MAX_DURATION_SECONDS + 0.1), false);
  assert.equal(durationAllowed(NaN), false);
});

test('an accepted upload stores the source, then playback and poster, then prunes', async () => {
  const calls = {put: [], remove: []};
  const {instance, req, rpcCalls} = service({calls});
  const result = await instance.upload({req, session: {actor: 'a'}, applicationId: APP});
  assert.equal(result.status, 'processing');
  assert.equal(result.videoId, VIDEO);
  await new Promise(r => setTimeout(r, 100));
  assert.equal(calls.put.length, 3);
  assert.match(calls.put[0].key, /^intro-source\//);
  assert.match(calls.put[1].key, /playback\.mp4$/);
  assert.match(calls.put[2].key, /poster\.jpg$/);
  await new Promise(r => setTimeout(r, 100));
  assert.ok(rpcCalls.service.some(c => c.name === 'supply_intro_ready'));
  assert.ok(calls.remove.some(k => k.startsWith('intro-source/')));
});

test('a rejected format never reaches storage', async () => {
  const calls = {put: [], remove: []};
  const {instance, req} = service({calls, bytes: Buffer.from('not a video at all', 'utf8')});
  await assert.rejects(instance.upload({req, session: {actor: 'b'}, applicationId: APP}), /SUPPLY_INTRO_FORMAT_INVALID/);
  assert.equal(calls.put.length, 0);
});

test('an over-long video is refused before storage', async () => {
  const calls = {put: [], remove: []};
  const {instance, req} = service({calls, probe: {duration: 181, hasAudio: true}});
  await assert.rejects(instance.upload({req, session: {actor: 'c'}, applicationId: APP}), /SUPPLY_INTRO_TOO_LONG/);
  assert.equal(calls.put.length, 0);
});

test('an unreadable video is refused', async () => {
  const calls = {put: [], remove: []};
  const {instance, req} = service({calls, probe: {duration: null, hasAudio: null}});
  await assert.rejects(instance.upload({req, session: {actor: 'd'}, applicationId: APP}), /SUPPLY_INTRO_UNREADABLE/);
});

test('the fourth upload within an hour is rate limited', async () => {
  const calls = {put: [], remove: []};
  const {instance, req} = service({calls});
  for (let i = 0; i < 3; i += 1) {
    const r = Readable.from([mp4()]);
    r.headers = {'content-length': String(mp4().length)};
    await instance.upload({req: r, session: {actor: 'heavy'}, applicationId: APP});
  }
  const blocked = Readable.from([mp4()]);
  blocked.headers = {'content-length': String(mp4().length)};
  await assert.rejects(instance.upload({req: blocked, session: {actor: 'heavy'}, applicationId: APP}), /SUPPLY_INTRO_RATE_LIMIT/);
});

test('a transcode failure marks the row failed and removes the source', async () => {
  const calls = {put: [], remove: []};
  const {instance, req, rpcCalls} = service({
    calls,
    transcode: async () => { throw Object.assign(Error('SUPPLY_INTRO_TRANSCODE_FAILED'), {status: 422}); },
  });
  await instance.upload({req, session: {actor: 'e'}, applicationId: APP});
  await new Promise(r => setTimeout(r, 50));
  assert.ok(rpcCalls.service.some(c => c.name === 'supply_intro_failed'));
  assert.ok(calls.remove.some(k => k.startsWith('intro-source/')));
});

test('the sweeper removes only expired sources and marks their rows failed', async () => {
  const now = Date.parse('2026-11-26T12:00:00Z');
  const listed = [
    {key: `intro-source/${APP}/old/source.mp4`, lastModified: new Date(now - 25 * 3600 * 1000)},
    {key: `intro-source/${APP}/new/source.mp4`, lastModified: new Date(now - 2 * 3600 * 1000)},
    {key: 'intro/other/keep/playback.mp4', lastModified: new Date(now - 99 * 3600 * 1000)},
  ];
  const removed = [];
  const failed = [];
  const store = {
    async list(prefix) { return listed.filter(item => item.key.startsWith(prefix)); },
    async remove(key) { removed.push(key); },
  };
  const result = await sweepIntroSources({
    store, now, logger: {warn() {}},
    serviceRpc: async (name, args) => { failed.push({name, args}); },
  });
  assert.deepEqual(removed, [`intro-source/${APP}/old/source.mp4`]);
  assert.equal(result.removed, 1);
  assert.equal(result.candidates, 1);
  assert.equal(failed.length, 1);
  assert.equal(failed[0].args.p_code, 'STALE_UPLOAD');
});

test('range parsing handles full, open, suffix and invalid requests', () => {
  assert.deepEqual(parseRange(undefined, 1000), {status: 200, start: 0, end: 999});
  assert.deepEqual(parseRange('bytes=0-99', 1000), {status: 206, start: 0, end: 99});
  assert.deepEqual(parseRange('bytes=500-', 1000), {status: 206, start: 500, end: 999});
  assert.deepEqual(parseRange('bytes=-100', 1000), {status: 206, start: 900, end: 999});
  assert.deepEqual(parseRange('bytes=-5000', 1000), {status: 206, start: 0, end: 999});
  assert.equal(parseRange('bytes=1000-', 1000), null);
  assert.equal(parseRange('bytes=9-5', 1000), null);
  assert.equal(parseRange('items=0-5', 1000), null);
  assert.equal(parseRange('bytes=-', 1000), null);
});

test('the dashboard capture UI and playback route are wired', () => {
  const html = readFileSync('supply-dashboard.html', 'utf8');
  const js = readFileSync('supply-dashboard.mjs', 'utf8');
  const server = readFileSync('server/supply/http.mjs', 'utf8');
  for (const token of ['intro-capture', 'intro-file', 'intro-record', 'intro-upload', 'intro-progress', 'intro-preview'])
    assert.ok(html.includes(token), `missing ${token}`);
  assert.match(html, /accept="video\/mp4,video\/webm,video\/quicktime"/);
  assert.match(html, /120 MB/);
  assert.match(js, /MediaRecorder/);
  assert.match(js, /getUserMedia/);
  assert.match(js, /XMLHttpRequest/);
  assert.match(js, /INTRO_MAX_SECONDS=180/);
  assert.match(js, /intro\/video/);
  assert.match(server, /intro\\\/video/);
  assert.match(server, /Content-Range/);
  assert.ok(existsSync('supabase/migrations/202611260002_supply_intro_videos.sql'));
  assert.ok(existsSync('supabase/migrations/202611260003_supply_intro_required.sql'));
});

test('teacher approval is gated on a ready video in the database', () => {
  const sql = readFileSync('supabase/migrations/202611260003_supply_intro_required.sql', 'utf8');
  assert.match(sql, /p_decision='approved' AND a\.vendor_type='teacher'/);
  assert.match(sql, /status='ready'/);
  assert.match(sql, /RAISE EXCEPTION 'SUPPLY_INTRO_VIDEO_REQUIRED'/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.supply_review_application/);
});

test('the review screen plays the video and blocks approval until it is ready', () => {
  const review = readFileSync('supply-review.mjs', 'utf8');
  assert.match(review, /\/intro\/video/);
  assert.match(review, /approveButtons/);
  assert.match(review, /cannot be approved without one/);
  assert.match(review, /player\.controls=true/);
  const client = readFileSync('supply-client.mjs', 'utf8');
  assert.match(client, /SUPPLY_INTRO_VIDEO_REQUIRED/);
});

test('the production constructor works without injected helpers', () => {
  const calls = {put: [], remove: []};
  const instance = createIntroService({
    env: {},
    store: fakeStore(calls),
    rpc: async () => null,
    serviceRpc: async () => ({}),
    logger: {warn() {}},
  });
  assert.equal(typeof instance.upload, 'function');
  assert.equal(typeof instance.status, 'function');
});

test('the public page escapes names and embeds only our own stream', () => {
  const html = introPage({id: APP, displayName: '<img src=x onerror=alert(1)>', type: 'teacher'});
  assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes('&lt;img src=x'));
  assert.ok(html.includes('/api/intro/' + APP + '/video'));
  assert.ok(html.includes('/supply-profile.html?id=' + APP));
  assert.ok(!/youtube|vimeo|iframe/i.test(html), 'no third-party embed');
});

test('public playback is gated on the public-intro function and range support', () => {
  const server = readFileSync('server/production/http.mjs', 'utf8');
  assert.match(server, /supplyPublicIntro/);
  assert.match(server, /\\\/api\\\/intro/);
  assert.match(server, /introPage/);
  const sql = readFileSync('supabase/migrations/202611260004_supply_public_intro.sql', 'utf8');
  for (const clause of ["status = 'approved'", "reviewed_revision = a.revision", "publicationConsent", "status = 'ready'", 'learning_review_exclusions'])
    assert.ok(sql.includes(clause), `missing ${clause}`);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.supply_public_intro\(uuid\) TO service_role/);
});

test('the public profile offers the watch button only when a video exists', () => {
  const source = readFileSync('supply-profile.mjs', 'utf8');
  assert.match(source, /row\.hasVideo/);
  assert.match(source, /Watch introduction video/);
  assert.match(source, /'\/intro\/'\+encodeURIComponent\(row\.id\)/);
});
