// Streaming object storage for teacher introduction videos.
// Separate bucket and credentials from credentials/backups. Never buffers a
// whole video in memory: uploads stream from disk, playback streams ranges.

import {S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command} from '@aws-sdk/client-s3';
import {createReadStream} from 'node:fs';
import {randomUUID} from 'node:crypto';

export const MAX_VIDEO_BYTES = 120 * 1024 * 1024;
const fail = code => { throw Object.assign(Error(code), {status: 503}); };

export function videoConfiguration(env) {
  const region = env.INTRO_VIDEO_REGION || 'ams3';
  const bucket = env.INTRO_VIDEO_BUCKET;
  const key = env.INTRO_VIDEO_KEY;
  const secret = env.INTRO_VIDEO_SECRET;
  if (!/^[a-z]{3}[0-9]$/.test(region)) fail('INVALID_VIDEO_CONFIGURATION');
  if (typeof bucket !== 'string' || !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket)) fail('INVALID_VIDEO_CONFIGURATION');
  if ([key, secret].some(v => typeof v !== 'string' || !v || v !== v.trim())) fail('VIDEO_CREDENTIALS_REQUIRED');
  return {bucket, endpoint: `https://${region}.digitaloceanspaces.com`, region: 'us-east-1', credentials: {accessKeyId: key, secretAccessKey: secret}};
}

export function createVideoStore(env, {client} = {}) {
  const config = videoConfiguration(env);
  const s3 = client || new S3Client({...config, maxAttempts: 2, requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED'});
  const send = command => s3.send(command, {abortSignal: AbortSignal.timeout(120000)});

  return {
    bucket: config.bucket,
    newId: () => randomUUID(),

    async putStream(key, filePath, size, contentType) {
      if (!Number.isSafeInteger(size) || size < 1 || size > MAX_VIDEO_BYTES) fail('VIDEO_SIZE_INVALID');
      try {
        await send(new PutObjectCommand({Bucket: config.bucket, Key: key, Body: createReadStream(filePath), ContentLength: size, ContentType: contentType, ACL: 'private'}));
      } catch { fail('VIDEO_WRITE_FAILED'); }
    },

    async head(key) {
      try {
        const r = await send(new HeadObjectCommand({Bucket: config.bucket, Key: key}));
        return {bytes: Number(r.ContentLength), contentType: r.ContentType, etag: r.ETag};
      } catch { return null; }
    },

    async openRange(key, start, end) {
      const range = Number.isSafeInteger(start) && Number.isSafeInteger(end) ? `bytes=${start}-${end}` : undefined;
      try {
        const r = await send(new GetObjectCommand({Bucket: config.bucket, Key: key, Range: range}));
        return {body: r.Body, bytes: Number(r.ContentLength), contentType: r.ContentType, contentRange: r.ContentRange, status: range ? 206 : 200};
      } catch { fail('VIDEO_READ_FAILED'); }
    },

    async list(prefix) {
      const out = [];
      let token;
      do {
        let page;
        try {
          page = await send(new ListObjectsV2Command({Bucket: config.bucket, Prefix: prefix, ContinuationToken: token, MaxKeys: 1000}));
        } catch { fail('VIDEO_LIST_FAILED'); }
        for (const item of page.Contents || []) out.push({key: item.Key, bytes: Number(item.Size), lastModified: item.LastModified});
        token = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (token);
      return out;
    },

    async remove(key) {
      if (!key) return;
      try { await send(new DeleteObjectCommand({Bucket: config.bucket, Key: key})); } catch { fail('VIDEO_DELETE_FAILED'); }
    },

    close() { s3.destroy?.(); },
  };
}
