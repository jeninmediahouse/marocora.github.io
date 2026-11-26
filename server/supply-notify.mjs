// Supply applicant notifications.
// Fail-soft: a mail problem must never block or fail an application or decision.
// Deterministic event ids make retries idempotent at the provider.

import {createHash} from 'node:crypto';
import {supplyEmailBatch} from './vendor-mail.mjs';
import {createSupplyResendAdapter} from './supply-resend.mjs';

// Fixed namespace for name-based (v5) event ids. Changing it would re-send.
const NAMESPACE = 'c2f4b8a1-5d7e-4b1a-9e63-7a0d2c5f8b11';
const KINDS = new Set(['submitted', 'approved', 'rejected']);
const DEFAULT_REVIEWER = 'admin@marocora.com';
const EMAIL = /^[^\s<>@,;]+@[^\s<>@,;]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function eventId(applicationId, kind, revision) {
  const hash = createHash('sha1')
    .update(Buffer.from(NAMESPACE.replace(/-/g, ''), 'hex'))
    .update(`${applicationId}:${kind}:${revision}`)
    .digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function createSupplyNotifier({env = process.env, fetcher = fetch, logger = console} = {}) {
  const apiKey = typeof env.SUPPLY_RESEND_API_KEY === 'string' ? env.SUPPLY_RESEND_API_KEY.trim() : '';
  let send = null;
  if (apiKey) {
    try {
      send = createSupplyResendAdapter({apiKey, fetcher});
    } catch {
      send = null;
    }
  }

  return async function notify({kind, application, revision}) {
    try {
      if (!send) {
        logger.warn('SUPPLY_NOTIFY_DISABLED');
        return {state: 'disabled'};
      }
      if (!KINDS.has(kind) || !application || !UUID.test(application.id || '')
        || typeof application.email !== 'string' || !Number.isSafeInteger(revision) || revision < 1) {
        logger.warn('SUPPLY_NOTIFY_INVALID_EVENT');
        return {state: 'invalid'};
      }
      const id = eventId(application.id, kind, revision);
      const messages = supplyEmailBatch({application, event: {id, kind, revision}});
      const result = await send(messages, {idempotencyKey: `marocora-supply/${id}`});
      if (result.state !== 'sent') logger.warn('SUPPLY_NOTIFY_' + String(result.state).toUpperCase());
      return result;
    } catch {
      logger.warn('SUPPLY_NOTIFY_FAILED');
      return {state: 'failed'};
    }
  };
}

export function createSupplyReviewerNotifier({env = process.env, fetcher = fetch, logger = console} = {}) {
  const apiKey = typeof env.SUPPLY_RESEND_API_KEY === 'string' ? env.SUPPLY_RESEND_API_KEY.trim() : '';
  const recipient = typeof env.SUPPLY_REVIEW_EMAIL === 'string' && env.SUPPLY_REVIEW_EMAIL.trim()
    ? env.SUPPLY_REVIEW_EMAIL.trim()
    : DEFAULT_REVIEWER;
  let send = null;
  if (apiKey) {
    try {
      send = createSupplyResendAdapter({apiKey, fetcher});
    } catch {
      send = null;
    }
  }

  return async function notifyReviewer({applicationId, displayName, type, revision}) {
    try {
      if (!send) {
        logger.warn('SUPPLY_REVIEW_NOTIFY_DISABLED');
        return {state: 'disabled'};
      }
      if (!UUID.test(applicationId || '') || !EMAIL.test(recipient)
        || typeof displayName !== 'string' || displayName.length > 120
        || typeof type !== 'string' || !/^[a-z]+$/.test(type)
        || !Number.isSafeInteger(revision) || revision < 1) {
        logger.warn('SUPPLY_REVIEW_NOTIFY_INVALID_EVENT');
        return {state: 'invalid'};
      }
      const id = eventId(applicationId, 'reviewer', revision);
      const url = `https://marocora.com/supply-review.html#application-${applicationId}`;
      const subject = `New Marocora application: ${displayName}`;
      const text = `A partner application is waiting for review.\n\nName: ${displayName}\nType: ${type}\nReference: ${applicationId} · revision ${revision}\n\nOpen the review queue: ${url}\n\nSign in with your reviewer account.`;
      const html = `<div style="font-family:Arial,sans-serif;color:#153b31;line-height:1.6;max-width:620px;margin:24px auto;padding:28px;border:1px solid #d8e2db;border-radius:12px"><p style="font-size:26px;font-weight:bold;color:#12644f">Marocora</p><h1 style="font-size:24px">New partner application</h1><p><strong>${displayName.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</strong><br>${type}</p><p><a href="${url}" style="display:inline-block;background:#12644f;color:white;padding:12px 20px;border-radius:7px;text-decoration:none;font-weight:bold">Open the review queue</a></p><p>Sign in with your reviewer account.</p><p style="font-size:13px;color:#64756e">Reference: ${applicationId} · revision ${revision}</p></div>`;
      const result = await send([{from: 'Marocora <no-reply@auth.marocora.com>', to: [recipient], subject, text, html}],
        {idempotencyKey: `marocora-supply/${id}`});
      if (result.state !== 'sent') logger.warn('SUPPLY_REVIEW_NOTIFY_' + String(result.state).toUpperCase());
      return result;
    } catch {
      logger.warn('SUPPLY_REVIEW_NOTIFY_FAILED');
      return {state: 'failed'};
    }
  };
}
