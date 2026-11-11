// Pricing for the Swify referral model.
//
//  * Each provider sets its OWN rate card. Swify never edits it.
//  * The provider's price for a job is paid to the provider in full (no deduction).
//  * Swify's booking fee is a separate amount charged to the client.
//
// All amounts are integer cents.

export const DEFAULT_FORM = {
  version: 1,
  currency: 'usd',
  // Swify's fee to the client for using the referral service (shown as its own line)
  bookingFee: { flat: 500, percent: 5 },
  leadTimeDays: 1,           // earliest bookable date = today + leadTimeDays
  maxDaysAhead: 60,
  serviceZips: [],           // empty = any ZIP a provider serves
  services: [
    { id: 'standard', name: 'Standard clean', desc: 'Regular upkeep for a lived-in home.' },
    { id: 'deep', name: 'Deep clean', desc: 'Top-to-bottom detail work, ideal for a first visit.' },
    { id: 'move', name: 'Move-in / move-out', desc: 'Empty home, inside cabinets and appliances.' }
  ],
  sizes: [
    { id: 'studio', label: 'Studio' },
    { id: '1bd', label: '1 bedroom' },
    { id: '2bd', label: '2 bedrooms' },
    { id: '3bd', label: '3 bedrooms' },
    { id: '4bd', label: '4+ bedrooms' }
  ],
  bathrooms: { min: 1, max: 5 },
  frequencies: [
    { id: 'once', label: 'One time' },
    { id: 'weekly', label: 'Weekly' },
    { id: 'biweekly', label: 'Every 2 weeks' },
    { id: 'monthly', label: 'Monthly' }
  ],
  addons: [
    { id: 'oven', name: 'Inside the oven' },
    { id: 'fridge', name: 'Inside the fridge' },
    { id: 'dishes', name: 'Dishes' },
    { id: 'laundry', name: 'Laundry' },
    { id: 'linens', name: 'Fresh linens' },
    { id: 'window', name: 'Interior windows' },
    { id: 'blinds', name: 'Blinds' },
    { id: 'cabinet', name: 'Cabinets & drawers' },
    { id: 'walls', name: 'Wall wipe-down' },
    { id: 'baseboards', name: 'Baseboards' },
    { id: 'organizing', name: 'Organizing' }
  ],
  timeWindows: [
    { id: 'morning', label: 'Morning (8–11am)' },
    { id: 'midday', label: 'Midday (11am–2pm)' },
    { id: 'afternoon', label: 'Afternoon (2–5pm)' }
  ],
  // extra questions added in the admin form builder
  questions: [
    { id: 'pets', label: 'Any pets at home?', type: 'select', required: false, options: ['No pets', 'Dog', 'Cat', 'Other'] },
    { id: 'entry', label: 'How will the pro get in?', type: 'select', required: true, options: ['Someone will be home', 'Doorman / front desk', 'Lockbox / key code'] }
  ]
};

const ID = /^[a-z0-9][a-z0-9_-]{0,39}$/;
const isInt = (n) => Number.isInteger(n) && n >= 0 && n <= 10_000_000;

// ---------- form config validation (admin form builder) ----------
export function validateForm(f) {
  const err = (m) => { throw new Error('Form: ' + m); };
  if (!f || typeof f !== 'object') err('missing');
  const out = {
    version: 1,
    currency: String(f.currency || 'usd').toLowerCase(),
    bookingFee: { flat: Number(f.bookingFee?.flat ?? 0), percent: Number(f.bookingFee?.percent ?? 0) },
    leadTimeDays: Number(f.leadTimeDays ?? 1),
    maxDaysAhead: Number(f.maxDaysAhead ?? 60),
    serviceZips: Array.isArray(f.serviceZips) ? f.serviceZips.map(String) : [],
    bathrooms: { min: Number(f.bathrooms?.min ?? 1), max: Number(f.bathrooms?.max ?? 5) }
  };
  if (!/^[a-z]{3}$/.test(out.currency)) err('currency');
  if (!isInt(out.bookingFee.flat)) err('booking fee (flat) must be whole cents');
  if (!(out.bookingFee.percent >= 0 && out.bookingFee.percent <= 50)) err('booking fee percent 0–50');
  if (!(out.leadTimeDays >= 0 && out.leadTimeDays <= 30)) err('lead time');
  if (!(out.maxDaysAhead >= 1 && out.maxDaysAhead <= 365)) err('max days ahead');
  if (!out.serviceZips.every((z) => /^\d{5}$/.test(z))) err('service ZIPs must be 5 digits');
  if (!(isInt(out.bathrooms.min) && out.bathrooms.min >= 1 && out.bathrooms.max >= out.bathrooms.min && out.bathrooms.max <= 20)) err('bathrooms range');

  const list = (key, fields, min = 1) => {
    const arr = f[key];
    if (!Array.isArray(arr) || arr.length < min || arr.length > 60) err(`${key}: need ${min}–60 items`);
    const seen = new Set();
    return arr.map((x) => {
      if (!x || !ID.test(x.id || '')) err(`${key}: invalid id "${x && x.id}" (lowercase letters, numbers, - and _)`);
      if (seen.has(x.id)) err(`${key}: duplicate id "${x.id}"`);
      seen.add(x.id);
      const o = { id: x.id };
      for (const k of fields) {
        const v = String(x[k] ?? '').trim();
        if ((k === 'name' || k === 'label') && !v) err(`${key}: "${x.id}" needs a ${k}`);
        if (v.length > 200) err(`${key}: "${x.id}" ${k} too long`);
        o[k] = v;
      }
      return o;
    });
  };
  out.services = list('services', ['name', 'desc']);
  out.sizes = list('sizes', ['label']);
  out.frequencies = list('frequencies', ['label']);
  out.addons = list('addons', ['name'], 0);
  out.timeWindows = list('timeWindows', ['label']);

  const qs = Array.isArray(f.questions) ? f.questions : [];
  if (qs.length > 30) err('too many questions');
  const qseen = new Set();
  out.questions = qs.map((q) => {
    if (!q || !ID.test(q.id || '')) err(`question id "${q && q.id}" invalid`);
    if (qseen.has(q.id)) err(`duplicate question id "${q.id}"`);
    qseen.add(q.id);
    const type = ['text', 'textarea', 'select', 'checkbox'].includes(q.type) ? q.type : err(`question "${q.id}" type`);
    const label = String(q.label || '').trim();
    if (!label || label.length > 200) err(`question "${q.id}" label`);
    const o = { id: q.id, label, type, required: !!q.required };
    if (type === 'select') {
      const opts = (q.options || []).map((s) => String(s).trim()).filter(Boolean);
      if (opts.length < 2 || opts.length > 30) err(`question "${q.id}" needs 2–30 options`);
      o.options = opts;
    }
    return o;
  });
  return out;
}

// ---------- provider rate card validation (provider portal) ----------
// rates = {
//   accepting: true,
//   base: { [serviceId]: { [sizeId]: cents } },   // missing = service/size not offered
//   extraBathroom: cents,                          // per bathroom beyond the first
//   addons: { [addonId]: cents },                  // missing = add-on not offered
//   frequencyDiscount: { [frequencyId]: percent }, // provider's own recurring discount
//   minimum: cents
// }
export function validateRates(r, form) {
  const err = (m) => { throw new Error('Rates: ' + m); };
  if (!r || typeof r !== 'object') err('missing');
  const out = { accepting: !!r.accepting, base: {}, extraBathroom: 0, addons: {}, frequencyDiscount: {}, minimum: 0 };
  const cents = (v, what) => { const n = Number(v); if (!isInt(n)) err(`${what} must be a whole number of cents`); return n; };
  for (const s of form.services) {
    const row = r.base?.[s.id];
    if (!row) continue;
    for (const z of form.sizes) {
      if (row[z.id] === undefined || row[z.id] === null || row[z.id] === '') continue;
      (out.base[s.id] ||= {})[z.id] = cents(row[z.id], `${s.name} / ${z.label}`);
    }
  }
  out.extraBathroom = cents(r.extraBathroom ?? 0, 'extra bathroom');
  for (const a of form.addons) {
    const v = r.addons?.[a.id];
    if (v === undefined || v === null || v === '') continue;
    out.addons[a.id] = cents(v, a.name);
  }
  for (const fq of form.frequencies) {
    const v = Number(r.frequencyDiscount?.[fq.id] ?? 0);
    if (!(v >= 0 && v <= 50)) err(`${fq.label} discount must be 0–50%`);
    if (v) out.frequencyDiscount[fq.id] = v;
  }
  out.minimum = cents(r.minimum ?? 0, 'minimum');
  return out;
}

// ---------- answers validation (client booking) ----------
export function validateAnswers(a, form, today = new Date()) {
  const err = (m) => { throw new Error(m); };
  if (!a || typeof a !== 'object') err('Missing booking details');
  const has = (list, id) => list.some((x) => x.id === id);
  if (!has(form.services, a.service)) err('Choose a service');
  if (!has(form.sizes, a.size)) err('Choose a home size');
  if (!has(form.frequencies, a.frequency)) err('Choose how often');
  const baths = Number(a.bathrooms);
  if (!Number.isInteger(baths) || baths < form.bathrooms.min || baths > form.bathrooms.max) err('Choose the number of bathrooms');
  const addons = Array.isArray(a.addons) ? [...new Set(a.addons)] : [];
  if (!addons.every((id) => has(form.addons, id))) err('Unknown add-on');
  if (!/^\d{5}$/.test(a.zip || '')) err('Enter a 5-digit ZIP code');
  if (form.serviceZips.length && !form.serviceZips.includes(a.zip)) err("Sorry, we don't serve that ZIP code yet");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date || '')) err('Choose a date');
  const d = new Date(a.date + 'T12:00:00Z');
  const t0 = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 12));
  const days = Math.round((d - t0) / 86400000);
  if (isNaN(days) || days < form.leadTimeDays || days > form.maxDaysAhead) err(`Choose a date between ${form.leadTimeDays} and ${form.maxDaysAhead} days from today`);
  if (!has(form.timeWindows, a.window)) err('Choose a time window');
  const custom = {};
  for (const q of form.questions) {
    let v = a.custom?.[q.id];
    if (q.type === 'checkbox') v = !!v;
    else v = String(v ?? '').trim().slice(0, q.type === 'textarea' ? 1000 : 200);
    if (q.required && (v === '' || v === false)) err(`Please answer: ${q.label}`);
    if (q.type === 'select' && v && !q.options.includes(v)) err(`Invalid answer: ${q.label}`);
    custom[q.id] = v;
  }
  return { service: a.service, size: a.size, bathrooms: baths, frequency: a.frequency, addons, zip: a.zip, date: a.date, window: a.window, custom };
}

export function validateContact(c) {
  const err = (m) => { throw new Error(m); };
  if (!c || typeof c !== 'object') err('Missing contact details');
  const s = (v, max) => String(v ?? '').trim().slice(0, max);
  const out = { name: s(c.name, 100), email: s(c.email, 200).toLowerCase(), phone: s(c.phone, 30), address: s(c.address, 200), unit: s(c.unit, 50), notes: s(c.notes, 1000) };
  if (out.name.length < 2) err('Enter your name');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(out.email)) err('Enter a valid email');
  if (out.phone.replace(/\D/g, '').length < 10) err('Enter a valid phone number');
  if (out.address.length < 5) err('Enter the street address');
  return out;
}

// ---------- quote ----------
// Returns null if the provider doesn't offer this job; otherwise the price breakdown.
export function quoteFor(provider, rates, answers, form) {
  if (!rates || !rates.accepting) return null;
  if (!Array.isArray(provider.zips) || !provider.zips.includes(answers.zip)) return null;
  const base = rates.base?.[answers.service]?.[answers.size];
  if (!Number.isInteger(base)) return null;
  const lines = [];
  const svc = form.services.find((s) => s.id === answers.service);
  const size = form.sizes.find((s) => s.id === answers.size);
  lines.push({ label: `${svc.name} · ${size.label}`, amount: base });
  const extraBaths = answers.bathrooms - 1;
  if (extraBaths > 0 && rates.extraBathroom) lines.push({ label: `${extraBaths} extra bathroom${extraBaths > 1 ? 's' : ''}`, amount: extraBaths * rates.extraBathroom });
  for (const id of answers.addons) {
    const p = rates.addons?.[id];
    if (!Number.isInteger(p)) return null; // provider doesn't offer this add-on
    lines.push({ label: form.addons.find((x) => x.id === id).name, amount: p });
  }
  let subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const pct = rates.frequencyDiscount?.[answers.frequency] || 0;
  if (pct) {
    const d = Math.round(subtotal * pct / 100);
    lines.push({ label: `${form.frequencies.find((f) => f.id === answers.frequency).label} discount (${pct}%)`, amount: -d });
    subtotal -= d;
  }
  if (rates.minimum && subtotal < rates.minimum) {
    lines.push({ label: 'Minimum visit charge', amount: rates.minimum - subtotal });
    subtotal = rates.minimum;
  }
  const providerAmount = subtotal;
  const fee = Math.round(form.bookingFee.flat + providerAmount * form.bookingFee.percent / 100);
  return { lines, providerAmount, fee, total: providerAmount + fee, currency: form.currency };
}

// "from $X" for the public site: the lowest standard price across active providers
export function fromPrice(providers, form) {
  let min = Infinity;
  for (const p of providers) for (const row of Object.values(p.rates?.base || {})) for (const v of Object.values(row)) if (v < min) min = v;
  return min === Infinity ? null : min;
}
