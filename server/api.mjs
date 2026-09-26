import { DomainError } from './marketplace.mjs';

const json = (response, status, value) => {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  response.end(JSON.stringify(value));
};

async function readBody(request, limit = 65536) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new DomainError('REQUEST_TOO_LARGE', 413);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export function createApiHandler({ marketplace, authenticate, verifyPaymentWebhook, origin }) {
  if (!marketplace || typeof authenticate !== 'function' || !origin) throw new Error('API_CONFIGURATION_REQUIRED');
  const expectedOrigin = new URL(origin).origin;
  const actor = async request => {
    const id = await authenticate(request);
    if (!id) throw new DomainError('AUTH_REQUIRED', 401);
    marketplace.account(id);
    return id;
  };
  return async (request, response) => {
    try {
      const url = new URL(request.url, expectedOrigin);
      const method = request.method;
      const webhook = url.pathname === '/webhooks/payment';
      if (method !== 'GET' && request.headers.origin !== expectedOrigin && !webhook)
        throw new DomainError('ORIGIN_REQUIRED', 403);
      if (webhook) {
        if (method !== 'POST') throw new DomainError('METHOD_NOT_ALLOWED', 405);
        if (typeof verifyPaymentWebhook !== 'function') throw new DomainError('PAYMENT_NOT_CONFIGURED', 503);
        const event = await verifyPaymentWebhook(await readBody(request), request.headers);
        if (!event) throw new DomainError('INVALID_WEBHOOK_SIGNATURE', 401);
        return json(response, 200, marketplace.applyVerifiedPayment(event));
      }
      if (method === 'GET' && url.pathname === '/catalog')
        return json(response, 200, marketplace.publicCatalog());
      if (method === 'GET' && url.pathname === '/slots')
        return json(response, 200, marketplace.slots(url.searchParams.get('instructor') || ''));
      if (method === 'GET' && url.pathname === '/instructor/draft')
        return json(response, 200, { draft: marketplace.instructorDraft(await actor(request)) });
      if (method === 'GET' && url.pathname.startsWith('/bookings/'))
        return json(response, 200, marketplace.booking(await actor(request), decodeURIComponent(url.pathname.slice(10))));
      if (method !== 'POST') throw new DomainError('NOT_FOUND', 404);
      if (!['/quote', '/checkout', '/reviews', '/review-replies', '/instructor/draft', '/instructor/submit'].includes(url.pathname))
        throw new DomainError('NOT_FOUND', 404);
      if (!request.headers['content-type']?.startsWith('application/json'))
        throw new DomainError('JSON_REQUIRED', 415);
      let body;
      try { body = JSON.parse((await readBody(request)).toString('utf8')); }
      catch (error) {
        if (error instanceof DomainError) throw error;
        throw new DomainError('INVALID_JSON', 400);
      }
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new DomainError('INVALID_JSON', 400);
      if (url.pathname === '/quote') return json(response, 200, marketplace.quote(body));
      const id = await actor(request);
      if (url.pathname === '/instructor/draft') return json(response, 200, { draft: marketplace.saveInstructorDraft(id,body) });
      if (url.pathname === '/instructor/submit') return json(response, 200, { draft: marketplace.submitInstructorDraft(id) });
      if (url.pathname === '/checkout') return json(response, 200, await marketplace.checkout(id, body));
      if (url.pathname === '/reviews') return json(response, 201, marketplace.review(id, body));
      return json(response, 201, marketplace.reply(id, body));
    } catch (error) {
      if (error instanceof DomainError) return json(response, error.status, { error: error.message });
      console.error('Marocora API request failed', error);
      return json(response, 500, { error: 'INTERNAL_ERROR' });
    }
  };
}
