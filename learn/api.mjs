import { config } from './config.mjs';
export async function request(path, body) {
  if (!config.apiBase) throw new Error('NOT_CONFIGURED');
  const response = await fetch(`${config.apiBase}${path}`, {
    method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error || 'REQUEST_FAILED'), { status: response.status });
  return data;
}
export const api = {
  catalog: () => request('/catalog'), slots: id => request(`/slots?instructor=${encodeURIComponent(id)}`),
  quote: body => request('/quote', body), checkout: body => request('/checkout', body),
  booking: id => request(`/bookings/${encodeURIComponent(id)}`),
  review: body => request('/reviews', body), reply: body => request('/review-replies', body)
};
