// Marocora commission engine.
// Pure arithmetic shared by the dashboard and (later) the booking server, so the
// published promise, the calculator and any future payout cannot disagree.

export const TEACHING_TIERS = Object.freeze([
  {fromHours: 0, rate: 0.30},
  {fromHours: 20, rate: 0.28},
  {fromHours: 50, rate: 0.25},
  {fromHours: 200, rate: 0.23},
  {fromHours: 400, rate: 0.20},
]);

export const TRANSLATION_RATE = 0.30;
export const MIN_TEACHING_RATE = 0.20;

export function teachingRate(completedPaidMinutes) {
  const hours = Math.max(0, Number(completedPaidMinutes) || 0) / 60;
  let rate = TEACHING_TIERS[0].rate;
  for (const tier of TEACHING_TIERS) {
    if (hours >= tier.fromHours) rate = tier.rate;
  }
  return rate;
}

export function commissionRate(kind, completedPaidMinutes = 0) {
  return kind === 'teacher' ? teachingRate(completedPaidMinutes) : TRANSLATION_RATE;
}

/** Customer price for a provider who wants to receive `netMinor`. */
export function priceFromNet(netMinor, rate) {
  const net = Math.max(0, Math.round(netMinor));
  if (!(rate >= 0 && rate < 1)) throw new Error('INVALID_COMMISSION_RATE');
  const gross = Math.round(net / (1 - rate));
  return {grossMinor: gross, commissionMinor: gross - net, netMinor: net, rate};
}

/** Provider earnings from a published customer price, at a frozen rate. */
export function splitGross(grossMinor, rate) {
  const gross = Math.max(0, Math.round(grossMinor));
  if (!(rate >= 0 && rate < 1)) throw new Error('INVALID_COMMISSION_RATE');
  const commission = Math.round(gross * rate);
  return {grossMinor: gross, commissionMinor: commission, netMinor: gross - commission, rate};
}

/** Next tier the provider can reach, and what remains. */
export function nextTier(completedPaidMinutes) {
  const hours = Math.max(0, Number(completedPaidMinutes) || 0) / 60;
  const next = TEACHING_TIERS.find(tier => tier.fromHours > hours);
  if (!next) return null;
  return {fromHours: next.fromHours, rate: next.rate, hoursRemaining: Math.ceil((next.fromHours - hours) * 10) / 10};
}

export function formatMinor(minor, currency) {
  return new Intl.NumberFormat('en', {style: 'currency', currency}).format(minor / 100);
}
