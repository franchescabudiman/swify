// Swify booking backend — Cloudflare Worker + D1 + Stripe Connect.
//
// Public:   GET  /api/form            form config for the booking page
//           POST /api/quote           eligible providers + each one's own price
//           POST /api/checkout        create booking + Stripe Checkout (destination charge)
//           GET  /api/booking?session_id=   status for the success page
//           POST /api/stripe/webhook  Stripe events (signature verified)
// Provider: (Authorization: Bearer <portal token>)
//           GET  /api/pro/me | PUT /api/pro/rates | GET /api/pro/bookings
//           POST /api/pro/bookings/:id/accept | /decline | POST /api/pro/stripe-link
// Admin:    (Authorization: Bearer <ADMIN_PASSWORD>)
//           GET|PUT /api/admin/form | GET|POST /api/admin/providers
//           PATCH /api/admin/providers/:id | POST /api/admin/providers/:id/portal-link
//           POST /api/admin/providers/:id/stripe-link | GET /api/admin/bookings
//           POST /api/admin/bookings/:id/refund

import { DEFAULT_FORM, validateForm, validateRates, validateAnswers, validateContact, quoteFor, fromPrice } from './pricing.js';

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const now = () => new Date().toISOString();
const rid = (p) => p + '_' + [...crypto.getRandomValues(new Uint8Array(10))].map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, 16);
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const enc = new TextEncoder();
async function sha256(s) { return b64url(await crypto.subtle.digest('SHA-256', enc.encode(s))); }
async function hmacHex(key, msg) {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(msg)))].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function safeEqual(a, b) { // constant-time via HMAC of both
  const k = crypto.getRandomValues(new Uint8Array(16)).join(',');
  return (await hmacHex(k, String(a))) === (await hmacHex(k, String(b)));
}

// ---------- HTTP helpers ----------
function cors(req, env) {
  const origin = req.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const ok = allowed.includes(origin) || (env.ALLOW_LOCALHOST === 'true' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));
  return ok ? { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, OPTIONS', 'Access-Control-Max-Age': '86400' } : {};
}
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers } });
async function body(req, max = 50_000) {
  const t = await req.text();
  if (t.length > max) throw new HttpError(413, 'Request too large');
  try { return JSON.parse(t || '{}'); } catch { throw new HttpError(400, 'Invalid JSON'); }
}

// ---------- data access ----------
async function getForm(env) {
  const row = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind('form').first();
  return row ? JSON.parse(row.value) : DEFAULT_FORM;
}
function rowToProvider(r) {
  return r && { ...r, zips: JSON.parse(r.zips || '[]'), rates: JSON.parse(r.rates || '{}'), active: !!r.active, charges_enabled: !!r.charges_enabled };
}
function publicProvider(p) { // what admin sees (no token hash)
  const { token_hash, ...rest } = p; return { ...rest, has_portal_link: !!token_hash };
}
async function listProviders(env, where = '1=1', args = []) {
  const { results } = await env.DB.prepare(`SELECT * FROM providers WHERE ${where} ORDER BY business_name`).bind(...args).all();
  return results.map(rowToProvider);
}
async function getProvider(env, id) { return rowToProvider(await env.DB.prepare('SELECT * FROM providers WHERE id = ?').bind(id).first()); }
function rowToBooking(r) { return r && { ...r, answers: JSON.parse(r.answers), contact: JSON.parse(r.contact), summary: JSON.parse(r.summary) }; }
async function setBooking(env, id, fields) {
  const keys = Object.keys(fields);
  await env.DB.prepare(`UPDATE bookings SET ${keys.map((k) => k + ' = ?').join(', ')}, updated_at = ? WHERE id = ?`).bind(...keys.map((k) => fields[k]), now(), id).run();
}

// ---------- Stripe (REST, no SDK) ----------
function form(obj, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') form(v, key, out); else out.append(key, String(v));
  }
  return out;
}
async function stripe(env, method, path, params, idem) {
  if (!env.STRIPE_SECRET_KEY) throw new HttpError(500, 'Stripe is not configured');
  const headers = { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Stripe-Version': '2024-06-20' };
  let url = (env.STRIPE_API_BASE || 'https://api.stripe.com') + path, b;
  if (method === 'GET') { if (params) url += '?' + form(params); } else { headers['Content-Type'] = 'application/x-www-form-urlencoded'; b = form(params || {}); }
  if (idem) headers['Idempotency-Key'] = idem;
  const res = await fetch(url, { method, headers, body: b });
  const data = await res.json();
  if (!res.ok) { console.error('stripe error', path, data?.error?.message); throw new HttpError(502, 'Payment provider error: ' + (data?.error?.message || res.status)); }
  return data;
}
async function verifyStripeSignature(env, payload, header) {
  if (!env.STRIPE_WEBHOOK_SECRET || !header) return false;
  const parts = Object.fromEntries(header.split(',').map((kv) => kv.split('=')).filter((x) => x.length === 2).map(([k, v]) => [k.trim(), v]));
  const sigs = header.split(',').filter((s) => s.trim().startsWith('v1=')).map((s) => s.trim().slice(3));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > 300) return false;
  // STRIPE_WEBHOOK_SECRET may hold several comma-separated secrets (platform endpoint + Connect endpoint)
  for (const secret of env.STRIPE_WEBHOOK_SECRET.split(',').map((x) => x.trim()).filter(Boolean)) {
    const expected = await hmacHex(secret, `${t}.${payload}`);
    for (const s of sigs) if (await safeEqual(s, expected)) return true;
  }
  return false;
}

// ---------- auth ----------
async function requireAdmin(req, env) {
  const tok = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!env.ADMIN_PASSWORD || env.ADMIN_PASSWORD.length < 12) throw new HttpError(500, 'Admin password not configured (min 12 characters)');
  if (!tok || !(await safeEqual(tok, env.ADMIN_PASSWORD))) { await new Promise((r) => setTimeout(r, 400)); throw new HttpError(401, 'Wrong password'); }
}
async function requireProvider(req, env) {
  const tok = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (tok.length < 30) throw new HttpError(401, 'Invalid link');
  const p = rowToProvider(await env.DB.prepare('SELECT * FROM providers WHERE token_hash = ?').bind(await sha256(tok)).first());
  if (!p) { await new Promise((r) => setTimeout(r, 400)); throw new HttpError(401, 'This link is no longer valid — ask Swify for a new one'); }
  return p;
}
async function newPortalToken(env, providerId) {
  const token = b64url(crypto.getRandomValues(new Uint8Array(32)));
  await env.DB.prepare('UPDATE providers SET token_hash = ?, updated_at = ? WHERE id = ?').bind(await sha256(token), now(), providerId).run();
  return { token, url: `${env.SITE_URL}/pro/#${token}` };
}
async function stripeLink(env, p) {
  let acct = p.stripe_account;
  if (!acct) {
    const a = await stripe(env, 'POST', '/v1/accounts', {
      type: 'express', email: p.email, business_type: 'company',
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      business_profile: { name: p.business_name, product_description: 'Residential cleaning services' },
      metadata: { swify_provider_id: p.id }
    }, 'acct-' + p.id);
    acct = a.id;
    await env.DB.prepare('UPDATE providers SET stripe_account = ?, updated_at = ? WHERE id = ?').bind(acct, now(), p.id).run();
  }
  if (p.charges_enabled) {
    const l = await stripe(env, 'POST', `/v1/accounts/${acct}/login_links`, {});
    return { url: l.url, kind: 'dashboard' };
  }
  const l = await stripe(env, 'POST', '/v1/account_links', { account: acct, type: 'account_onboarding', refresh_url: `${env.SITE_URL}/pro/?stripe=refresh`, return_url: `${env.SITE_URL}/pro/?stripe=done` });
  return { url: l.url, kind: 'onboarding' };
}
async function syncStripeAccount(env, p) {
  if (!p.stripe_account) return p;
  const a = await stripe(env, 'GET', `/v1/accounts/${p.stripe_account}`);
  const ok = a.charges_enabled && a.payouts_enabled ? 1 : 0;
  if (ok !== (p.charges_enabled ? 1 : 0)) await env.DB.prepare('UPDATE providers SET charges_enabled = ?, updated_at = ? WHERE id = ?').bind(ok, now(), p.id).run();
  return { ...p, charges_enabled: !!ok };
}

// ---------- quote ----------
async function eligibleQuotes(env, form, answers) {
  const providers = await listProviders(env, 'active = 1 AND charges_enabled = 1');
  const out = [];
  for (const p of providers) {
    const q = quoteFor(p, p.rates, answers, form);
    if (q) out.push({ provider: { id: p.id, name: p.business_name }, ...q });
  }
  return out.sort((a, b) => a.total - b.total);
}

// ---------- routes ----------
async function route(req, env, url) {
  const p = url.pathname.replace(/\/+$/, '');
  const m = req.method;

  // ----- public -----
  if (p === '/api/form' && m === 'GET') {
    const form = await getForm(env);
    const providers = await listProviders(env, 'active = 1 AND charges_enabled = 1');
    return json({ form, fromPrice: fromPrice(providers.filter((x) => x.rates.accepting), form), providerCount: providers.length });
  }
  if (p === '/api/quote' && m === 'POST') {
    const form = await getForm(env);
    const { answers } = await body(req);
    let a; try { a = validateAnswers(answers, form); } catch (e) { throw new HttpError(400, e.message); }
    return json({ answers: a, quotes: await eligibleQuotes(env, form, a) });
  }
  if (p === '/api/checkout' && m === 'POST') {
    const form = await getForm(env);
    const b = await body(req);
    if (b.website) throw new HttpError(400, 'Rejected'); // honeypot
    if (!b.agree) throw new HttpError(400, 'Please accept the booking terms');
    let a, c; try { a = validateAnswers(b.answers, form); c = validateContact(b.contact); } catch (e) { throw new HttpError(400, e.message); }
    const prov = await getProvider(env, String(b.providerId || ''));
    if (!prov || !prov.active || !prov.charges_enabled) throw new HttpError(409, 'That cleaning professional is no longer available — please choose another');
    const q = quoteFor(prov, prov.rates, a, form);
    if (!q) throw new HttpError(409, 'That cleaning professional no longer offers this booking — please choose another');
    if (b.expectedTotal !== undefined && Number(b.expectedTotal) !== q.total) throw new HttpError(409, 'Prices changed since you started — please review the updated price');
    const id = rid('bk'); const ts = now();
    await env.DB.prepare(`INSERT INTO bookings (id, created_at, updated_at, status, provider_id, answers, contact, summary, provider_amount, fee_amount, total_amount, currency)
      VALUES (?, ?, ?, 'pending_payment', ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, ts, ts, prov.id, JSON.stringify(a), JSON.stringify(c), JSON.stringify(q), q.providerAmount, q.fee, q.total, q.currency).run();
    const svc = form.services.find((s) => s.id === a.service).name;
    const desc = q.lines.map((l) => `${l.label}: ${(l.amount / 100).toFixed(2)}`).join(' · ').slice(0, 480);
    const session = await stripe(env, 'POST', '/v1/checkout/sessions', {
      mode: 'payment',
      customer_email: c.email,
      client_reference_id: id,
      line_items: {
        0: { quantity: 1, price_data: { currency: q.currency, unit_amount: q.providerAmount, product_data: { name: `${svc} by ${prov.business_name}`, description: `${a.date} · ${desc}` } } },
        1: { quantity: 1, price_data: { currency: q.currency, unit_amount: q.fee, product_data: { name: 'Swify booking fee', description: 'Referral service fee, paid to Swify' } } }
      },
      payment_intent_data: {
        // destination charge: the provider's full rate is transferred to the provider; Swify keeps only the booking fee
        application_fee_amount: q.fee,
        transfer_data: { destination: prov.stripe_account },
        on_behalf_of: prov.stripe_account,
        description: `Swify booking ${id}`,
        metadata: { booking_id: id, provider_id: prov.id }
      },
      metadata: { booking_id: id, provider_id: prov.id },
      success_url: `${env.SITE_URL}/book/success/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.SITE_URL}${env.BOOK_PATH || '/book/'}?cancelled=1`,
      expires_at: Math.floor(Date.now() / 1000) + 32 * 60
    }, 'cs-' + id);
    await setBooking(env, id, { stripe_session: session.id });
    return json({ url: session.url, bookingId: id });
  }
  if (p === '/api/booking' && m === 'GET') {
    const sid = url.searchParams.get('session_id') || '';
    const r = rowToBooking(await env.DB.prepare('SELECT * FROM bookings WHERE stripe_session = ?').bind(sid).first());
    if (!r) throw new HttpError(404, 'Booking not found');
    const prov = await getProvider(env, r.provider_id);
    const form = await getForm(env);
    return json({ id: r.id, status: r.status, provider: prov?.business_name, date: r.answers.date, window: form.timeWindows.find((w) => w.id === r.answers.window)?.label, summary: r.summary, email: r.contact.email });
  }
  if (p === '/api/stripe/webhook' && m === 'POST') {
    const payload = await req.text();
    if (!(await verifyStripeSignature(env, payload, req.headers.get('Stripe-Signature')))) return json({ error: 'bad signature' }, 400);
    const ev = JSON.parse(payload);
    const o = ev.data?.object || {};
    if (ev.type === 'checkout.session.completed' && o.payment_status === 'paid') {
      const id = o.metadata?.booking_id || o.client_reference_id;
      if (id) await env.DB.prepare(`UPDATE bookings SET status = 'paid', payment_intent = ?, updated_at = ? WHERE id = ? AND status = 'pending_payment'`).bind(o.payment_intent || null, now(), id).run();
    } else if (ev.type === 'checkout.session.expired') {
      const id = o.metadata?.booking_id || o.client_reference_id;
      if (id) await env.DB.prepare(`UPDATE bookings SET status = 'expired', updated_at = ? WHERE id = ? AND status = 'pending_payment'`).bind(now(), id).run();
    } else if (ev.type === 'account.updated') {
      await env.DB.prepare('UPDATE providers SET charges_enabled = ?, updated_at = ? WHERE stripe_account = ?').bind(o.charges_enabled && o.payouts_enabled ? 1 : 0, now(), o.id).run();
    }
    return json({ received: true });
  }

  // ----- provider portal -----
  if (p.startsWith('/api/pro/')) {
    let prov = await requireProvider(req, env);
    const form = await getForm(env);
    if (p === '/api/pro/me' && m === 'GET') {
      try { prov = await syncStripeAccount(env, prov); } catch (e) { /* keep last known state */ }
      return json({ provider: { id: prov.id, business_name: prov.business_name, email: prov.email, zips: prov.zips, active: prov.active, stripe_connected: !!prov.stripe_account, charges_enabled: prov.charges_enabled }, rates: prov.rates, form });
    }
    if (p === '/api/pro/rates' && m === 'PUT') {
      const b = await body(req);
      let rates; try { rates = validateRates(b.rates, form); } catch (e) { throw new HttpError(400, e.message); }
      const zips = Array.isArray(b.zips) ? [...new Set(b.zips.map(String))] : prov.zips;
      if (!zips.every((z) => /^\d{5}$/.test(z)) || zips.length > 200) throw new HttpError(400, 'ZIP codes must be 5 digits');
      await env.DB.prepare('UPDATE providers SET rates = ?, zips = ?, updated_at = ? WHERE id = ?').bind(JSON.stringify(rates), JSON.stringify(zips), now(), prov.id).run();
      return json({ ok: true, rates, zips });
    }
    if (p === '/api/pro/bookings' && m === 'GET') {
      const { results } = await env.DB.prepare(`SELECT * FROM bookings WHERE provider_id = ? AND status != 'pending_payment' AND status != 'expired' ORDER BY json_extract(answers,'$.date') DESC LIMIT 200`).bind(prov.id).all();
      return json({ bookings: results.map(rowToBooking).map((r) => ({ id: r.id, status: r.status, created_at: r.created_at, answers: r.answers, contact: ['accepted'].includes(r.status) ? r.contact : { name: r.contact.name.split(' ')[0], address: '(shown after you accept)', zip: r.answers.zip }, provider_amount: r.provider_amount, currency: r.currency, summary: r.summary, provider_note: r.provider_note })) });
    }
    const act = p.match(/^\/api\/pro\/bookings\/([\w-]+)\/(accept|decline)$/);
    if (act && m === 'POST') {
      const b = await body(req);
      const r = await env.DB.prepare('SELECT status FROM bookings WHERE id = ? AND provider_id = ?').bind(act[1], prov.id).first();
      if (!r) throw new HttpError(404, 'Booking not found');
      if (r.status !== 'paid') throw new HttpError(409, `This booking is ${r.status}`);
      await setBooking(env, act[1], { status: act[2] === 'accept' ? 'accepted' : 'declined', provider_note: String(b.note || '').slice(0, 500) });
      return json({ ok: true });
    }
    if (p === '/api/pro/stripe-link' && m === 'POST') return json(await stripeLink(env, prov));
    throw new HttpError(404, 'Not found');
  }

  // ----- admin -----
  if (p.startsWith('/api/admin/')) {
    await requireAdmin(req, env);
    if (p === '/api/admin/form' && m === 'GET') return json({ form: await getForm(env), defaults: DEFAULT_FORM });
    if (p === '/api/admin/form' && m === 'PUT') {
      let f; try { f = validateForm((await body(req, 200_000)).form); } catch (e) { throw new HttpError(400, e.message); }
      await env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind('form', JSON.stringify(f)).run();
      return json({ ok: true, form: f });
    }
    if (p === '/api/admin/providers' && m === 'GET') return json({ providers: (await listProviders(env)).map(publicProvider) });
    if (p === '/api/admin/providers' && m === 'POST') {
      const b = await body(req);
      const s = (v, n) => String(v ?? '').trim().slice(0, n);
      const prov = { id: rid('pr'), business_name: s(b.business_name, 120), legal_name: s(b.legal_name, 160), email: s(b.email, 200).toLowerCase(), phone: s(b.phone, 30), license_no: s(b.license_no, 80), insurance_expires: s(b.insurance_expires, 10) };
      if (prov.business_name.length < 2) throw new HttpError(400, 'Business name required');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(prov.email)) throw new HttpError(400, 'Valid email required');
      const zips = Array.isArray(b.zips) ? b.zips.map(String).filter((z) => /^\d{5}$/.test(z)) : [];
      const ts = now();
      await env.DB.prepare(`INSERT INTO providers (id, business_name, legal_name, email, phone, license_no, insurance_expires, zips, active, rates, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`)
        .bind(prov.id, prov.business_name, prov.legal_name, prov.email, prov.phone, prov.license_no, prov.insurance_expires, JSON.stringify(zips), JSON.stringify({ accepting: false }), ts, ts).run();
      const link = await newPortalToken(env, prov.id);
      return json({ provider: publicProvider(await getProvider(env, prov.id)), portalUrl: link.url });
    }
    const pm = p.match(/^\/api\/admin\/providers\/([\w-]+)(?:\/(portal-link|stripe-link))?$/);
    if (pm) {
      const prov = await getProvider(env, pm[1]);
      if (!prov) throw new HttpError(404, 'Provider not found');
      if (!pm[2] && m === 'PATCH') { // admin may edit business details & pause referrals — never the provider's rates
        const b = await body(req);
        const s = (v, n) => String(v ?? '').trim().slice(0, n);
        const f = {};
        for (const [k, n] of [['business_name', 120], ['legal_name', 160], ['email', 200], ['phone', 30], ['license_no', 80], ['insurance_expires', 10]]) if (b[k] !== undefined) f[k] = s(b[k], n);
        if (b.active !== undefined) f.active = b.active ? 1 : 0;
        const keys = Object.keys(f);
        if (keys.length) await env.DB.prepare(`UPDATE providers SET ${keys.map((k) => k + ' = ?').join(', ')}, updated_at = ? WHERE id = ?`).bind(...keys.map((k) => f[k]), now(), prov.id).run();
        return json({ provider: publicProvider(await getProvider(env, prov.id)) });
      }
      if (pm[2] === 'portal-link' && m === 'POST') return json(await newPortalToken(env, prov.id));
      if (pm[2] === 'stripe-link' && m === 'POST') return json(await stripeLink(env, prov));
    }
    if (p === '/api/admin/bookings' && m === 'GET') {
      const st = url.searchParams.get('status');
      const q = st ? env.DB.prepare('SELECT b.*, p.business_name FROM bookings b LEFT JOIN providers p ON p.id = b.provider_id WHERE b.status = ? ORDER BY b.created_at DESC LIMIT 300').bind(st)
                   : env.DB.prepare('SELECT b.*, p.business_name FROM bookings b LEFT JOIN providers p ON p.id = b.provider_id ORDER BY b.created_at DESC LIMIT 300');
      const { results } = await q.all();
      return json({ bookings: results.map(rowToBooking) });
    }
    const rf = p.match(/^\/api\/admin\/bookings\/([\w-]+)\/refund$/);
    if (rf && m === 'POST') {
      const r = await env.DB.prepare('SELECT * FROM bookings WHERE id = ?').bind(rf[1]).first();
      if (!r) throw new HttpError(404, 'Booking not found');
      if (!r.payment_intent || !['paid', 'declined', 'accepted', 'cancelled'].includes(r.status)) throw new HttpError(409, `Can't refund a booking that is ${r.status}`);
      // full refund: pull the transfer back from the provider and return Swify's fee
      await stripe(env, 'POST', '/v1/refunds', { payment_intent: r.payment_intent, reverse_transfer: true, refund_application_fee: true, metadata: { booking_id: r.id } }, 'rf-' + r.id);
      await setBooking(env, r.id, { status: 'refunded' });
      return json({ ok: true });
    }
  }
  throw new HttpError(404, 'Not found');
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const h = cors(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    try {
      const res = await route(req, env, url);
      for (const [k, v] of Object.entries(h)) res.headers.set(k, v);
      return res;
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      if (status === 500) console.error(e);
      return json({ error: status === 500 && !(e instanceof HttpError) ? 'Something went wrong' : e.message }, status, h);
    }
  }
};
