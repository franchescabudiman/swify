// Minimal local stand-in for the Stripe API + hosted pages, for end-to-end tests only.
// Records every request so tests can assert exactly what would be sent to Stripe.
import http from 'node:http';
import crypto from 'node:crypto';

const PORT = Number(process.env.MOCK_PORT || 12111);
const WORKER = process.env.WORKER_URL || 'http://localhost:8787';
const WHSEC = process.env.WHSEC || 'whsec_test_local';
const ME = `http://localhost:${PORT}`;
const log = [], accounts = {}, sessions = {};
let n = 0;
const id = (p) => `${p}_${(++n).toString().padStart(6, '0')}`;

function parseForm(s) { // a[b][c]=v -> nested object
  const out = {};
  for (const [k, v] of new URLSearchParams(s)) {
    const keys = k.replace(/\]/g, '').split('[');
    let o = out;
    keys.forEach((kk, i) => { if (i === keys.length - 1) o[kk] = v; else o = o[kk] ||= {}; });
  }
  return out;
}
async function webhook(type, object) {
  const payload = JSON.stringify({ id: id('evt'), type, data: { object } });
  const t = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac('sha256', WHSEC).update(`${t}.${payload}`).digest('hex');
  const r = await fetch(`${WORKER}/api/stripe/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': `t=${t},v1=${sig}` }, body: payload });
  log.push({ webhook: type, status: r.status });
  return r.status;
}
const send = (res, code, obj, type = 'application/json') => { res.writeHead(code, { 'Content-Type': type }); res.end(type === 'application/json' ? JSON.stringify(obj) : obj); };

http.createServer(async (req, res) => {
  const url = new URL(req.url, ME);
  let body = ''; for await (const c of req) body += c;
  const params = parseForm(body);
  const p = url.pathname;
  if (p.startsWith('/v1/')) {
    log.push({ method: req.method, path: p, params, auth: req.headers.authorization, idem: req.headers['idempotency-key'] });
    if (req.headers.authorization !== 'Bearer sk_test_mock') return send(res, 401, { error: { message: 'Invalid API key' } });
  }
  if (req.method === 'POST' && p === '/v1/accounts') { const a = { id: id('acct'), charges_enabled: false, payouts_enabled: false, email: params.email }; accounts[a.id] = a; return send(res, 200, a); }
  if (req.method === 'POST' && p === '/v1/account_links') return send(res, 200, { url: `${ME}/onboard?acct=${params.account}&return=${encodeURIComponent(params.return_url)}` });
  let m;
  if ((m = p.match(/^\/v1\/accounts\/(acct_\w+)$/)) && req.method === 'GET') return accounts[m[1]] ? send(res, 200, accounts[m[1]]) : send(res, 404, { error: { message: 'No such account' } });
  if ((m = p.match(/^\/v1\/accounts\/(acct_\w+)\/login_links$/))) return send(res, 200, { url: `${ME}/express-dashboard/${m[1]}` });
  if (req.method === 'POST' && p === '/v1/checkout/sessions') {
    const s = { id: id('cs_test'), url: '', ...params, payment_status: 'unpaid' };
    s.url = `${ME}/pay/${s.id}`; sessions[s.id] = s; return send(res, 200, { id: s.id, url: s.url });
  }
  if (req.method === 'POST' && p === '/v1/refunds') return send(res, 200, { id: id('re'), status: 'succeeded' });

  // ---- hosted pages ----
  if (p === '/onboard') { // simulate finishing Stripe Connect onboarding
    const a = accounts[url.searchParams.get('acct')]; a.charges_enabled = a.payouts_enabled = true;
    await webhook('account.updated', a);
    res.writeHead(302, { Location: url.searchParams.get('return') }); return res.end();
  }
  if ((m = p.match(/^\/pay\/(cs_test_\w+)$/))) {
    const s = sessions[m[1]];
    if (req.method === 'GET') {
      const li = Object.values(s.line_items).map((l) => `<li>${l.price_data.product_data.name}: $${(l.price_data.unit_amount / 100).toFixed(2)}</li>`).join('');
      return send(res, 200, `<!doctype html><title>Mock Stripe Checkout</title><h1>Mock Stripe Checkout</h1><ul>${li}</ul><form method=post><button id=pay>Pay</button></form><a id=cancel href="${s.cancel_url}">Cancel</a>`, 'text/html');
    }
    s.payment_status = 'paid'; s.payment_intent = id('pi');
    await webhook('checkout.session.completed', { id: s.id, object: 'checkout.session', payment_status: 'paid', payment_intent: s.payment_intent, client_reference_id: s.client_reference_id, metadata: s.metadata });
    res.writeHead(303, { Location: s.success_url.replace('{CHECKOUT_SESSION_ID}', s.id) }); return res.end();
  }
  if (p === '/__log') return send(res, 200, { log, sessions });
  if (p === '/__webhook' && req.method === 'POST') { const j = JSON.parse(body); return send(res, 200, { status: await webhook(j.type, j.object, j.secret) }); }
  send(res, 404, { error: { message: 'mock: not found ' + p } });
}).listen(PORT, () => console.log('mock stripe on', PORT));
