import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {sniff, withinLimits, durationAllowed, createIntroService, MAX_DURATION_SECONDS} from '../server/supply/intro.mjs';

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
