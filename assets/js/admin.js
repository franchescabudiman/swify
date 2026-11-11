// Swify admin: bookings, provider network, and the visual booking-form builder.
// Note: admins manage the FORM and provider details — never a provider's prices (providers set those).
(function () {
  var S = window.Swify, esc = S.esc, money = S.money;
  var root = document.getElementById('admin');
  if (!root) return;
  var UP = root.dataset.up || '';
  var pw = sessionStorage.getItem('swify_admin') || '';
  var tab = 'bookings', msg = '', err = '', data = { bookings: [], providers: [], form: null, defaults: null }, draft = null, newLink = null, dirty = false;
  var STATUS = { pending_payment: ['Awaiting payment', ''], paid: ['Paid · awaiting pro', 'warn'], accepted: ['Accepted', 'good'], declined: ['Declined — refund', 'bad'], refunded: ['Refunded', ''], expired: ['Checkout expired', ''], cancelled: ['Cancelled', ''] };
  var call = function (path, opts) { opts = opts || {}; opts.token = pw; return S.api(path, opts); };
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };

  function login(e) {
    root.innerHTML = '<div class="panel" style="max-width:440px"><h2>Admin sign in</h2><p class="sub">Swify team only.</p>' + (e ? '<div class="err">' + esc(e) + '</div>' : '') +
      '<form id="loginForm"><div class="fgroup"><label for="pw">Password</label><input type="password" id="pw" autocomplete="current-password" required></div><button class="btn btn-ink">Sign in <span class="arr">→</span></button></form></div>';
    document.getElementById('loginForm').onsubmit = async function (ev) {
      ev.preventDefault(); pw = document.getElementById('pw').value;
      try { await loadAll(); sessionStorage.setItem('swify_admin', pw); render(); } catch (x) { pw = ''; login(x.message); }
    };
  }
  async function loadAll() {
    var r = await Promise.all([call('/api/admin/bookings'), call('/api/admin/providers'), call('/api/admin/form')]);
    data.bookings = r[0].bookings; data.providers = r[1].providers; data.form = r[2].form; data.defaults = r[2].defaults;
    if (!dirty) draft = clone(data.form);
  }

  // ---------- bookings ----------
  function bookingsTab() {
    var b = data.bookings;
    var paid = b.filter(function (x) { return ['paid', 'accepted'].indexOf(x.status) > -1; });
    var fees = paid.reduce(function (s, x) { return s + x.fee_amount; }, 0);
    var h = '<p class="muted">' + b.length + ' bookings · ' + paid.length + ' paid · ' + money(fees, 'usd') + ' in Swify booking fees</p>';
    if (!b.length) return h + '<p class="muted">No bookings yet.</p>';
    return h + '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Client</th><th>Professional</th><th>Job</th><th>Pro price</th><th>Swify fee</th><th>Status</th><th></th></tr></thead><tbody>' + b.map(function (x) {
      var f = data.form, a = x.answers, s = STATUS[x.status] || [x.status, ''];
      var svc = (f.services.find(function (q) { return q.id === a.service; }) || {}).name || a.service;
      return '<tr><td><b>' + esc(S.fmtDate(a.date)) + '</b><br><span class="muted">booked ' + esc(x.created_at.slice(0, 10)) + '</span></td><td>' + esc(x.contact.name) + '<br><span class="muted">' + esc(x.contact.email) + '<br>' + esc(x.contact.phone) + '</span></td>' +
        '<td>' + esc(x.business_name || x.provider_id) + (x.provider_note ? '<br><span class="muted">“' + esc(x.provider_note) + '”</span>' : '') + '</td><td>' + esc(svc) + '<br><span class="muted">' + esc(a.zip) + ' · ' + a.addons.length + ' add-ons</span></td>' +
        '<td>' + money(x.provider_amount, x.currency) + '</td><td>' + money(x.fee_amount, x.currency) + '</td><td><span class="tag-s ' + s[1] + '">' + s[0] + '</span></td>' +
        '<td>' + (['paid', 'declined', 'accepted'].indexOf(x.status) > -1 ? '<button class="btn btn-line btn-sm" data-refund="' + esc(x.id) + '">Refund</button>' : '') + '</td></tr>';
    }).join('') + '</tbody></table></div>';
  }

  // ---------- providers ----------
  function providersTab() {
    var h = '';
    if (newLink) h += '<div class="ok-msg"><b>Private portal link for ' + esc(newLink.name) + '</b> — send this to them (it\'s shown only once). They use it to set their own rates, connect Stripe and accept bookings.<div class="linkbox"><input readonly value="' + esc(newLink.url) + '" id="linkOut"><button class="btn btn-ink btn-sm" data-copy="linkOut">Copy</button></div></div>';
    h += '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Business</th><th>Contact</th><th>License · Insurance</th><th>Stripe</th><th>Rates</th><th>Referrals</th><th></th></tr></thead><tbody>' + (data.providers.length ? data.providers.map(function (p) {
      var n = Object.values(p.rates.base || {}).reduce(function (s, r) { return s + Object.keys(r).length; }, 0);
      var ins = p.insurance_expires ? (p.insurance_expires < new Date().toISOString().slice(0, 10) ? '<span class="tag-s bad">expired ' + esc(p.insurance_expires) + '</span>' : 'until ' + esc(p.insurance_expires)) : '<span class="tag-s warn">missing</span>';
      return '<tr><td><b>' + esc(p.business_name) + '</b><br><span class="muted">' + esc(p.legal_name || '') + '</span></td><td>' + esc(p.email) + '<br><span class="muted">' + esc(p.phone || '') + '</span></td>' +
        '<td>' + (p.license_no ? esc(p.license_no) : '<span class="tag-s warn">no license #</span>') + '<br>' + ins + '</td>' +
        '<td>' + (p.charges_enabled ? '<span class="tag-s good">Ready</span>' : p.stripe_account ? '<span class="tag-s warn">Incomplete</span>' : '<span class="tag-s bad">Not connected</span>') + '</td>' +
        '<td>' + (n ? n + ' prices · ' + (p.zips || []).length + ' ZIPs' : '<span class="muted">not set</span>') + '<br>' + (p.rates.accepting ? '<span class="tag-s good">Accepting</span>' : '<span class="tag-s">Not accepting</span>') + '</td>' +
        '<td>' + (p.active ? '<span class="tag-s good">Active</span>' : '<span class="tag-s bad">Paused</span>') + '</td>' +
        '<td style="white-space:nowrap"><button class="btn btn-line btn-sm" data-portal="' + p.id + '">New portal link</button> <button class="btn btn-line btn-sm" data-toggle="' + p.id + '">' + (p.active ? 'Pause' : 'Resume') + '</button></td></tr>';
    }).join('') : '<tr><td colspan="7" class="muted">No professionals yet — add your first one below.</td></tr>') + '</tbody></table></div>';
    h += '<div class="section-h"><h3>Add a cleaning business</h3></div><form id="addPro" class="panel"><div class="row2">' +
      fld('business_name', 'Business name (shown to clients)', 'text', true) + fld('legal_name', 'Legal entity (LLC) name', 'text') + fld('email', 'Email', 'email', true) + fld('phone', 'Phone', 'tel') +
      fld('license_no', 'Business license / tax registration #', 'text') + fld('insurance_expires', 'Liability insurance expires', 'date') + '</div>' +
      '<div class="fgroup"><label for="np_zips">ZIP codes (they can change these later)</label><input type="text" id="np_zips" placeholder="90012, 90026"></div>' +
      '<button class="btn btn-ink">Add &amp; create portal link</button></form>';
    return h;
  }
  function fld(id, label, type, req) { return '<div class="fgroup"><label for="np_' + id + '">' + label + '</label><input type="' + type + '" id="np_' + id + '"' + (req ? ' required' : '') + '></div>'; }

  // ---------- form builder ----------
  var LISTS = [
    ['services', 'Services', [['name', 'Name'], ['desc', 'Short description']]],
    ['sizes', 'Home sizes', [['label', 'Label']]],
    ['frequencies', 'How often', [['label', 'Label']]],
    ['addons', 'Add-ons', [['name', 'Name']]],
    ['timeWindows', 'Time windows', [['label', 'Label']]]
  ];
  function listEditor(key, title, fields) {
    var items = draft[key];
    return '<div class="section-h"><h3>' + title + '</h3><button class="btn btn-line btn-sm" data-add="' + key + '">+ Add</button></div><div class="builder-list">' + items.map(function (it, i) {
      return '<div class="builder-row"><input aria-label="ID" data-k="' + key + '" data-i="' + i + '" data-f="id" value="' + esc(it.id) + '" title="ID (lowercase, used internally — avoid changing once providers have priced it)">' +
        fields.map(function (f) { return '<input aria-label="' + f[1] + '" placeholder="' + f[1] + '" data-k="' + key + '" data-i="' + i + '" data-f="' + f[0] + '" value="' + esc(it[f[0]] || '') + '">'; }).join('') + (fields.length < 2 ? '<span></span>' : '') +
        '<div class="ctrls"><button class="icon-btn" data-mv="' + key + '|' + i + '|-1" aria-label="Move up">↑</button><button class="icon-btn" data-mv="' + key + '|' + i + '|1" aria-label="Move down">↓</button><button class="icon-btn" data-del="' + key + '|' + i + '" aria-label="Remove">✕</button></div></div>';
    }).join('') + '</div>';
  }
  function questionsEditor() {
    return '<div class="section-h"><h3>Extra questions</h3><button class="btn btn-line btn-sm" data-add="questions">+ Add question</button></div><div class="builder-list">' + draft.questions.map(function (q, i) {
      return '<div class="builder-row" style="grid-template-columns:140px 1fr 130px auto"><input data-k="questions" data-i="' + i + '" data-f="id" value="' + esc(q.id) + '" aria-label="ID">' +
        '<input data-k="questions" data-i="' + i + '" data-f="label" value="' + esc(q.label) + '" placeholder="Question" aria-label="Question">' +
        '<select data-k="questions" data-i="' + i + '" data-f="type" aria-label="Type">' + ['text', 'textarea', 'select', 'checkbox'].map(function (t) { return '<option' + (q.type === t ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select>' +
        '<div class="ctrls"><label class="check" style="font-size:12px;align-items:center"><input type="checkbox" data-k="questions" data-i="' + i + '" data-f="required"' + (q.required ? ' checked' : '') + '>Req.</label><button class="icon-btn" data-mv="questions|' + i + '|-1" aria-label="Move up">↑</button><button class="icon-btn" data-mv="questions|' + i + '|1" aria-label="Move down">↓</button><button class="icon-btn" data-del="questions|' + i + '" aria-label="Remove">✕</button></div>' +
        (q.type === 'select' ? '<textarea style="grid-column:1/-1" rows="2" data-k="questions" data-i="' + i + '" data-f="options" placeholder="One option per line">' + esc((q.options || []).join('\n')) + '</textarea>' : '') + '</div>';
    }).join('') + '</div>';
  }
  function builderTab() {
    var d = draft;
    var h = '<p class="muted" style="max-width:760px">Design the booking form clients see. Prices aren\'t set here — each professional sets their own in their portal. Changing an ID after professionals have priced it will hide their price for that item.</p>';
    h += '<div class="section-h"><h3>Booking settings</h3></div><div class="row3">' +
      '<div class="fgroup"><label>Swify booking fee (flat)</label><span class="money"><input class="input" id="f_flat" inputmode="decimal" value="' + (d.bookingFee.flat / 100) + '"></span></div>' +
      '<div class="fgroup"><label>+ % of pro price</label><input class="input" type="number" min="0" max="50" step="0.5" id="f_pct" value="' + d.bookingFee.percent + '"></div>' +
      '<div class="fgroup"><label>Bathrooms (min–max)</label><div class="row2"><input class="input" type="number" min="1" id="f_bmin" value="' + d.bathrooms.min + '"><input class="input" type="number" id="f_bmax" value="' + d.bathrooms.max + '"></div></div></div>' +
      '<div class="row3"><div class="fgroup"><label>Service ZIPs (empty = wherever pros serve)</label><input class="input" id="f_zips" value="' + esc(d.serviceZips.join(', ')) + '"></div>' +
      '<div class="fgroup"><label>Earliest booking (days ahead)</label><input class="input" type="number" min="0" id="f_lead" value="' + d.leadTimeDays + '"></div>' +
      '<div class="fgroup"><label>Latest booking (days ahead)</label><input class="input" type="number" min="1" id="f_max" value="' + d.maxDaysAhead + '"></div></div>';
    LISTS.forEach(function (l) { h += listEditor(l[0], l[1], l[2]); });
    h += questionsEditor();
    h += '<div class="sticky-save">' + (dirty ? '<span class="muted">Unsaved changes</span>' : '') + '<button class="btn btn-line" id="resetForm">Discard changes</button><button class="btn btn-line" id="previewForm">Preview ↗</button><button class="btn btn-ink" id="saveForm">Publish form</button></div>';
    return h;
  }
  function readSettings() {
    var g = function (id) { return document.getElementById(id); };
    if (!g('f_flat')) return;
    draft.bookingFee = { flat: Math.round(parseFloat(g('f_flat').value || 0) * 100), percent: Number(g('f_pct').value || 0) };
    draft.bathrooms = { min: Number(g('f_bmin').value || 1), max: Number(g('f_bmax').value || 1) };
    draft.serviceZips = g('f_zips').value.split(/[\s,;]+/).filter(Boolean);
    draft.leadTimeDays = Number(g('f_lead').value || 0); draft.maxDaysAhead = Number(g('f_max').value || 60);
  }

  function render() {
    var tabs = [['bookings', 'Bookings'], ['providers', 'Professionals'], ['builder', 'Form builder']];
    root.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:end;gap:20px;flex-wrap:wrap"><div><p class="eyebrow">Swify admin</p><h1>Dashboard</h1></div><button class="btn btn-line btn-sm" id="logout">Sign out</button></div>' +
      '<div class="tabs" role="tablist">' + tabs.map(function (t) { return '<button role="tab" data-tab="' + t[0] + '" aria-selected="' + (tab === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div>' +
      (msg ? '<div class="ok-msg">' + esc(msg) + '</div>' : '') + (err ? '<div class="err" role="alert">' + esc(err) + '</div>' : '') +
      (tab === 'bookings' ? bookingsTab() : tab === 'providers' ? providersTab() : builderTab());
  }
  function flash(m, isErr) { msg = isErr ? '' : m; err = isErr ? m : ''; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }

  root.addEventListener('input', function (e) {
    var t = e.target; if (!t.dataset.k) { if (/^f_/.test(t.id)) { readSettings(); dirty = true; } return; }
    var it = draft[t.dataset.k][Number(t.dataset.i)];
    if (t.dataset.f === 'options') it.options = t.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    else if (t.dataset.f === 'required') it.required = t.checked;
    else it[t.dataset.f] = t.value;
    dirty = true;
  });
  root.addEventListener('change', function (e) { var t = e.target; if (t.dataset.f === 'type' || t.dataset.f === 'required') { var it = draft.questions[Number(t.dataset.i)]; if (t.dataset.f === 'type') { it.type = t.value; if (t.value === 'select' && !it.options) it.options = ['Option 1', 'Option 2']; } else it.required = t.checked; dirty = true; render(); } });
  root.addEventListener('submit', async function (e) {
    if (e.target.id !== 'addPro') return; e.preventDefault();
    var v = function (k) { return document.getElementById('np_' + k).value; };
    try {
      var r = await call('/api/admin/providers', { method: 'POST', body: { business_name: v('business_name'), legal_name: v('legal_name'), email: v('email'), phone: v('phone'), license_no: v('license_no'), insurance_expires: v('insurance_expires'), zips: document.getElementById('np_zips').value.split(/[\s,;]+/).filter(Boolean) } });
      newLink = { name: r.provider.business_name, url: r.portalUrl }; await loadAll(); flash('Added ' + r.provider.business_name + '.');
    } catch (x) { flash(x.message, true); }
  });
  root.addEventListener('click', async function (e) {
    var b = e.target.closest('button'); if (!b) return;
    try {
      if (b.dataset.tab) { readSettings(); tab = b.dataset.tab; msg = err = ''; render(); }
      else if (b.id === 'logout') { sessionStorage.removeItem('swify_admin'); pw = ''; login(); }
      else if (b.dataset.copy) { var i = document.getElementById(b.dataset.copy); i.select(); try { await navigator.clipboard.writeText(i.value); b.textContent = 'Copied'; } catch (x) { document.execCommand('copy'); } }
      else if (b.dataset.portal) { var r = await call('/api/admin/providers/' + b.dataset.portal + '/portal-link', { method: 'POST' }); var p = data.providers.find(function (x) { return x.id === b.dataset.portal; }); newLink = { name: p.business_name, url: r.url }; flash('New link created — the old link no longer works.'); }
      else if (b.dataset.toggle) { var pr = data.providers.find(function (x) { return x.id === b.dataset.toggle; }); await call('/api/admin/providers/' + pr.id, { method: 'PATCH', body: { active: !pr.active } }); await loadAll(); flash((pr.active ? 'Paused ' : 'Resumed ') + pr.business_name + '.'); }
      else if (b.dataset.refund) {
        if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = 'Confirm full refund'; b.classList.add('btn-ink'); return; }
        b.disabled = true; await call('/api/admin/bookings/' + b.dataset.refund + '/refund', { method: 'POST' }); await loadAll(); flash('Refunded in full (pro transfer reversed, booking fee returned).');
      }
      else if (b.dataset.add) { var k = b.dataset.add, n = draft[k].length + 1; draft[k].push(k === 'questions' ? { id: 'question' + n, label: 'New question', type: 'text', required: false } : k === 'services' ? { id: 'service' + n, name: 'New service', desc: '' } : k === 'addons' ? { id: 'addon' + n, name: 'New add-on' } : { id: k.slice(0, 4) + n, label: 'New option' }); dirty = true; render(); }
      else if (b.dataset.del) { var d = b.dataset.del.split('|'); draft[d[0]].splice(Number(d[1]), 1); dirty = true; render(); }
      else if (b.dataset.mv) { var m = b.dataset.mv.split('|'), arr = draft[m[0]], i2 = Number(m[1]), j = i2 + Number(m[2]); if (j >= 0 && j < arr.length) { var t = arr[i2]; arr[i2] = arr[j]; arr[j] = t; dirty = true; render(); } }
      else if (b.id === 'resetForm') { draft = clone(data.form); dirty = false; flash('Changes discarded.'); }
      else if (b.id === 'previewForm') { readSettings(); sessionStorage.setItem('swify_form_preview', JSON.stringify(draft)); window.open(UP + 'book/?preview=1', '_blank'); }
      else if (b.id === 'saveForm') { readSettings(); var res = await call('/api/admin/form', { method: 'PUT', body: { form: draft } }); data.form = res.form; draft = clone(res.form); dirty = false; flash('Published — the booking form is updated.'); }
    } catch (x) { if (x.status === 401) { pw = ''; sessionStorage.removeItem('swify_admin'); login(x.message); } else flash(x.message, true); }
  });
  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  if (pw) loadAll().then(render).catch(function (x) { pw = ''; login(x.status === 401 ? '' : x.message); }); else login();
})();
