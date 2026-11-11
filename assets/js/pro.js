// Provider portal: each independent business sets its own rates, ZIPs and availability,
// accepts or declines booking requests, and connects Stripe to get paid directly.
(function () {
  var S = window.Swify, esc = S.esc, money = S.money;
  var root = document.getElementById('portal');
  if (!root) return;
  var token = (location.hash || '').slice(1) || sessionStorage.getItem('swify_pro');
  if (location.hash) { sessionStorage.setItem('swify_pro', token); history.replaceState(null, '', location.pathname + location.search); }
  // opening a different portal link in the same tab must switch to that business
  window.addEventListener('hashchange', function () { if (location.hash.length > 30) location.reload(); });
  var me, rates, form, bookings = [], tab = 'requests', msg = '', err = '';
  var STATUS = { paid: ['New request', 'warn'], accepted: ['Accepted', 'good'], declined: ['Declined', 'bad'], refunded: ['Refunded', ''], cancelled: ['Cancelled', ''] };

  if (!token) { root.innerHTML = '<div class="err">Open this page using the private link Swify sent you.</div>'; return; }
  var dollars = function (c) { return c === undefined || c === null ? '' : (c / 100).toFixed(c % 100 ? 2 : 0); };
  var cents = function (v) { v = String(v).trim(); if (v === '') return undefined; var n = Math.round(parseFloat(v) * 100); return isNaN(n) ? NaN : n; };

  async function load() {
    try {
      var r = await S.api('/api/pro/me', { token: token });
      me = r.provider; rates = r.rates || {}; form = r.form;
      bookings = (await S.api('/api/pro/bookings', { token: token })).bookings;
    } catch (e) { root.innerHTML = '<div class="err">' + esc(e.message) + '</div>'; return; }
    var q = new URLSearchParams(location.search).get('stripe');
    if (q === 'done') { msg = me.charges_enabled ? 'Stripe is connected — you can receive payments.' : 'Thanks! Stripe is still reviewing your details; this usually takes a few minutes.'; tab = 'payouts'; }
    render();
  }

  function requests() {
    if (!bookings.length) return '<p class="muted">No bookings yet. Make sure your rates are set and "Accepting new bookings" is on.</p>';
    return '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Job</th><th>Client</th><th>Your price</th><th>Status</th><th></th></tr></thead><tbody>' + bookings.map(function (b) {
      var a = b.answers, svc = (form.services.find(function (s) { return s.id === a.service; }) || {}).name, size = (form.sizes.find(function (s) { return s.id === a.size; }) || {}).label;
      var win = (form.timeWindows.find(function (w) { return w.id === a.window; }) || {}).label;
      var add = a.addons.map(function (id) { return (form.addons.find(function (x) { return x.id === id; }) || {}).name; }).join(', ');
      var cust = Object.keys(a.custom || {}).map(function (k) { var q = form.questions.find(function (x) { return x.id === k; }); return q && a.custom[k] !== '' && a.custom[k] !== false ? esc(q.label) + ': ' + esc(a.custom[k] === true ? 'Yes' : a.custom[k]) : ''; }).filter(Boolean).join('<br>');
      var c = b.contact, s = STATUS[b.status] || [b.status, ''];
      return '<tr><td><b>' + esc(S.fmtDate(a.date)) + '</b><br><span class="muted">' + esc(win || '') + '</span></td>' +
        '<td>' + esc(svc) + ' · ' + esc(size) + ' · ' + a.bathrooms + ' bath<br><span class="muted">' + esc(add || 'No add-ons') + '</span>' + (cust ? '<br><span class="muted">' + cust + '</span>' : '') + '</td>' +
        '<td>' + esc(c.name) + '<br><span class="muted">' + esc(c.address || '') + (c.unit ? ', ' + esc(c.unit) : '') + ' ' + esc(c.zip || a.zip) + (c.phone ? '<br>' + esc(c.phone) + '<br>' + esc(c.email) : '') + (c.notes ? '<br>“' + esc(c.notes) + '”' : '') + '</span></td>' +
        '<td>' + money(b.provider_amount, b.currency) + '</td><td><span class="tag-s ' + s[1] + '">' + s[0] + '</span></td>' +
        '<td>' + (b.status === 'paid' ? '<button class="btn btn-ink btn-sm" data-act="accept" data-id="' + esc(b.id) + '">Accept</button> <button class="btn btn-line btn-sm" data-act="decline" data-id="' + esc(b.id) + '">Decline</button>' : '') + '</td></tr>';
    }).join('') + '</tbody></table></div>';
  }

  function ratesTab() {
    var h = '<p class="muted" style="max-width:720px">These are <b>your</b> prices. Clients see them as your business\'s rates; Swify adds its booking fee separately and never deducts from your price. Leave a box empty for anything you don\'t offer.</p>';
    h += '<div class="fgroup" style="margin-top:20px"><label class="check"><input type="checkbox" id="r_accepting"' + (rates.accepting ? ' checked' : '') + '><span><b>Accepting new bookings</b> — turn off any time to pause new requests.</span></label></div>';
    h += '<div class="section-h"><h3>Base price per visit</h3></div><div class="tbl-wrap"><table class="tbl rate-grid"><thead><tr><th style="text-align:left">Service</th>' + form.sizes.map(function (z) { return '<th>' + esc(z.label) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      form.services.map(function (s) { return '<tr><td style="text-align:left"><b>' + esc(s.name) + '</b></td>' + form.sizes.map(function (z) { var v = rates.base && rates.base[s.id] && rates.base[s.id][z.id]; return '<td><span class="money"><input class="input" inputmode="decimal" data-base="' + s.id + '|' + z.id + '" value="' + dollars(v) + '" aria-label="' + esc(s.name + ' ' + z.label) + '"></span></td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
    h += '<div class="row2" style="margin-top:24px"><div class="fgroup"><label>Each extra bathroom (beyond the first)</label><span class="money"><input class="input" inputmode="decimal" id="r_bath" value="' + dollars(rates.extraBathroom || 0) + '"></span></div>';
    h += '<div class="fgroup"><label>Minimum per visit</label><span class="money"><input class="input" inputmode="decimal" id="r_min" value="' + dollars(rates.minimum || 0) + '"></span></div></div>';
    h += '<div class="section-h"><h3>Add-ons you offer</h3></div><div class="tbl-wrap"><table class="tbl"><tbody>' + form.addons.map(function (a) { var v = rates.addons && rates.addons[a.id]; return '<tr><td>' + esc(a.name) + '</td><td style="width:160px"><span class="money"><input class="input" inputmode="decimal" data-addon="' + a.id + '" value="' + dollars(v) + '" placeholder="not offered"></span></td></tr>'; }).join('') + '</tbody></table></div>';
    h += '<div class="section-h"><h3>Recurring discounts</h3></div><div class="row2">' + form.frequencies.map(function (f) { var v = rates.frequencyDiscount && rates.frequencyDiscount[f.id]; return '<div class="fgroup"><label>' + esc(f.label) + ' (% off)</label><input class="input" type="number" min="0" max="50" data-freq="' + f.id + '" value="' + (v || 0) + '"></div>'; }).join('') + '</div>';
    h += '<div class="section-h"><h3>ZIP codes you serve</h3></div><div class="fgroup"><textarea class="input" id="r_zips" rows="3" placeholder="90012, 90026, 90039">' + esc((me.zips || []).join(', ')) + '</textarea></div>';
    h += '<div class="sticky-save"><button class="btn btn-ink" id="saveRates">Save my rates</button></div>';
    return h;
  }

  function payouts() {
    var h = '<p class="muted" style="max-width:640px">Clients pay through Stripe, and <b>your full price is sent straight to your own Stripe account</b>. Swify only keeps its separate booking fee, which the client pays.</p>';
    h += '<p>Status: ' + (me.charges_enabled ? '<span class="tag-s good">Connected — ready to be paid</span>' : me.stripe_connected ? '<span class="tag-s warn">Setup incomplete</span>' : '<span class="tag-s bad">Not connected</span>') + '</p>';
    h += '<button class="btn btn-ink" id="stripeBtn">' + (me.charges_enabled ? 'Open my Stripe dashboard' : me.stripe_connected ? 'Continue Stripe setup' : 'Connect with Stripe') + ' <span class="arr">→</span></button>';
    if (!me.charges_enabled) h += '<p class="muted" style="font-size:13px;margin-top:14px">You won\'t appear to clients until Stripe setup is complete.</p>';
    return h;
  }

  function render() {
    var tabs = [['requests', 'Bookings'], ['rates', 'My rates'], ['payouts', 'Payouts']];
    root.innerHTML = '<p class="eyebrow">Professional portal</p><h1>' + esc(me.business_name) + '</h1>' +
      (!me.active ? '<div class="err">Referrals to your business are paused by Swify. Contact admin@swifycleaning.com.</div>' : '') +
      '<div class="tabs" role="tablist">' + tabs.map(function (t) { return '<button role="tab" data-tab="' + t[0] + '" aria-selected="' + (tab === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div>' +
      (msg ? '<div class="ok-msg">' + esc(msg) + '</div>' : '') + (err ? '<div class="err" role="alert">' + esc(err) + '</div>' : '') +
      (tab === 'requests' ? requests() : tab === 'rates' ? ratesTab() : payouts());
  }

  async function saveRates() {
    var r = { accepting: document.getElementById('r_accepting').checked, base: {}, addons: {}, frequencyDiscount: {}, extraBathroom: cents(document.getElementById('r_bath').value) || 0, minimum: cents(document.getElementById('r_min').value) || 0 };
    var bad = false;
    root.querySelectorAll('[data-base]').forEach(function (i) { var c = cents(i.value); if (c === undefined) return; if (isNaN(c)) bad = true; var k = i.dataset.base.split('|'); (r.base[k[0]] = r.base[k[0]] || {})[k[1]] = c; });
    root.querySelectorAll('[data-addon]').forEach(function (i) { var c = cents(i.value); if (c === undefined) return; if (isNaN(c)) bad = true; r.addons[i.dataset.addon] = c; });
    root.querySelectorAll('[data-freq]').forEach(function (i) { var v = Number(i.value || 0); if (v) r.frequencyDiscount[i.dataset.freq] = v; });
    var zips = document.getElementById('r_zips').value.split(/[\s,;]+/).filter(Boolean);
    msg = ''; err = '';
    if (bad || isNaN(r.extraBathroom) || isNaN(r.minimum)) { err = 'Please enter prices as numbers, e.g. 120 or 120.50'; render(); return; }
    try { var res = await S.api('/api/pro/rates', { method: 'PUT', token: token, body: { rates: r, zips: zips } }); rates = res.rates; me.zips = res.zips; msg = 'Saved. Clients now see these prices.'; }
    catch (e) { err = e.message; }
    render(); window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  root.addEventListener('click', async function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.tab) { tab = b.dataset.tab; msg = err = ''; render(); }
    else if (b.id === 'saveRates') saveRates();
    else if (b.id === 'stripeBtn') { b.disabled = true; try { location.href = (await S.api('/api/pro/stripe-link', { method: 'POST', token: token })).url; } catch (x) { err = x.message; render(); } }
    else if (b.dataset.act) {
      var note = '';
      if (b.dataset.act === 'decline' && !b.dataset.sure) { b.dataset.sure = '1'; b.textContent = 'Confirm decline (client is refunded)'; return; }
      b.disabled = true;
      try { await S.api('/api/pro/bookings/' + b.dataset.id + '/' + b.dataset.act, { method: 'POST', token: token, body: { note: note } }); msg = b.dataset.act === 'accept' ? 'Accepted — the client\'s full details are now shown.' : 'Declined. Swify will refund the client.'; bookings = (await S.api('/api/pro/bookings', { token: token })).bookings; }
      catch (x) { err = x.message; }
      render();
    }
  });
  load();
})();
