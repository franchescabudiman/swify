// Swify booking: home → add-ons → when & where → choose a pro → details & pay
(function () {
  var S = window.Swify, esc = S.esc, money = S.money;
  var root = document.getElementById('booking');
  if (!root) return;
  var UP = root.dataset.up || '';
  var STEPS = ['Your home', 'Add-ons', 'When & where', 'Choose your pro', 'Your details'];
  var form, step = 0, quotes = [], chosen = null, busy = false, error = '';
  var params = new URLSearchParams(location.search);
  var preview = params.has('preview');
  var st = load() || { service: '', size: '', bathrooms: 1, frequency: '', addons: [], zip: '', date: '', window: '', custom: {}, contact: {} };

  function save() { try { sessionStorage.setItem('swify_booking', JSON.stringify(st)); } catch (e) {} }
  function load() { try { return JSON.parse(sessionStorage.getItem('swify_booking')); } catch (e) { return null; } }
  function addDays(n) { var d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
  function byId(list, id) { return (list || []).find(function (x) { return x.id === id; }); }

  async function init() {
    root.innerHTML = '<div class="panel"><p class="muted">Loading…</p></div>';
    try {
      var draft = preview && sessionStorage.getItem('swify_form_preview');
      if (draft) form = JSON.parse(draft);
      else form = (await S.api('/api/form')).form;
    } catch (e) { root.innerHTML = '<div class="err">' + esc(e.message) + '</div>'; return; }
    // defaults
    if (!byId(form.services, st.service)) st.service = form.services[0].id;
    if (!byId(form.frequencies, st.frequency)) st.frequency = form.frequencies[0].id;
    st.bathrooms = Math.min(Math.max(st.bathrooms || 1, form.bathrooms.min), form.bathrooms.max);
    st.addons = (st.addons || []).filter(function (id) { return byId(form.addons, id); });
    var pre = params.get('addon');
    if (pre && byId(form.addons, pre) && st.addons.indexOf(pre) < 0) st.addons.push(pre);
    if (params.get('cancelled')) error = 'Payment was cancelled — your details are saved, so you can pick up where you left off.';
    render();
  }

  // ---------- validation per step ----------
  function check(n) {
    if (n === 0) { if (!st.service) return 'Choose a service'; if (!st.size) return 'Choose your home size'; if (!st.frequency) return 'Choose how often'; }
    if (n === 2) {
      if (!/^\d{5}$/.test(st.zip)) return 'Enter a 5-digit ZIP code';
      if (form.serviceZips.length && form.serviceZips.indexOf(st.zip) < 0) return "Sorry — we don't serve that ZIP code yet.";
      if (!st.date) return 'Choose a date';
      if (st.date < addDays(form.leadTimeDays) || st.date > addDays(form.maxDaysAhead)) return 'Choose a date between ' + S.fmtDate(addDays(form.leadTimeDays)) + ' and ' + S.fmtDate(addDays(form.maxDaysAhead));
      if (!st.window) return 'Choose a time window';
      for (var i = 0; i < form.questions.length; i++) { var q = form.questions[i], v = st.custom[q.id]; if (q.required && (v === undefined || v === '' || v === false)) return 'Please answer: ' + q.label; }
    }
    if (n === 3 && !chosen) return 'Choose a cleaning professional';
    return '';
  }
  function answers() { return { service: st.service, size: st.size, bathrooms: st.bathrooms, frequency: st.frequency, addons: st.addons, zip: st.zip, date: st.date, window: st.window, custom: st.custom }; }

  async function go(n) {
    if (n > step) { var e = check(step); if (e) { error = e; render(); return; } }
    error = '';
    if (n === 3) {
      busy = true; step = 3; render();
      try { quotes = (await S.api('/api/quote', { method: 'POST', body: { answers: answers() } })).quotes; }
      catch (e) { busy = false; step = e.status === 400 ? 2 : 3; error = e.message; quotes = []; render(); return; }
      busy = false;
      if (chosen) chosen = quotes.find(function (q) { return q.provider.id === chosen.provider.id; }) || null;
      if (!chosen && quotes.length === 1) chosen = quotes[0];
    }
    step = n; save(); render();
    var top = document.querySelector('.app'); if (top) window.scrollTo({ top: top.offsetTop - 20, behavior: 'smooth' });
  }

  async function pay() {
    if (preview) { error = 'This is a preview of your draft form — checkout is disabled.'; render(); return; }
    var c = st.contact;
    var f = root.querySelector('form.details');
    if (!f.reportValidity()) return;
    if (!document.getElementById('agree').checked) { error = 'Please confirm you understand how Swify bookings work.'; render(); return; }
    busy = true; error = ''; render();
    try {
      var r = await S.api('/api/checkout', { method: 'POST', body: { answers: answers(), contact: c, providerId: chosen.provider.id, expectedTotal: chosen.total, agree: true, website: (document.getElementById('website') || {}).value || '' } });
      save();
      location.href = r.url;
    } catch (e) {
      busy = false; error = e.message;
      if (e.status === 409) { step = 3; await go(3); return; }
      render();
    }
  }

  // ---------- rendering ----------
  function radio(name, val, cur, inner) {
    return '<label class="choice"><input type="radio" name="' + name + '" value="' + esc(val) + '"' + (val === cur ? ' checked' : '') + '><span class="c">' + inner + '</span></label>';
  }
  function stepHome() {
    var h = '<h2>Tell us about your home</h2><p class="sub">Prices are set by each independent cleaning business — you\'ll compare them in step 4.</p>';
    h += '<div class="fgroup"><span class="lbl">Service</span><div class="choices">' + form.services.map(function (s) { return radio('service', s.id, st.service, '<b>' + esc(s.name) + '</b>' + (s.desc ? '<small>' + esc(s.desc) + '</small>' : '')); }).join('') + '</div></div>';
    h += '<div class="fgroup"><span class="lbl">Home size</span><div class="choices pills">' + form.sizes.map(function (s) { return radio('size', s.id, st.size, esc(s.label)); }).join('') + '</div></div>';
    h += '<div class="fgroup"><span class="lbl">Bathrooms</span><div class="stepper"><button type="button" data-bath="-1" aria-label="Fewer bathrooms">−</button><output id="baths">' + st.bathrooms + '</output><button type="button" data-bath="1" aria-label="More bathrooms">+</button></div></div>';
    h += '<div class="fgroup"><span class="lbl">How often</span><div class="choices pills">' + form.frequencies.map(function (s) { return radio('frequency', s.id, st.frequency, esc(s.label)); }).join('') + '</div></div>';
    return h;
  }
  function stepAddons() {
    var h = '<h2>Any finishing touches?</h2><p class="sub">Optional. Pick as many as you like — only professionals who offer them will be shown.</p>';
    if (!form.addons.length) return h + '<p class="muted">No add-ons available.</p>';
    h += '<div class="addon-grid">' + form.addons.map(function (a) {
      return '<label class="choice"><input type="checkbox" name="addon" value="' + esc(a.id) + '"' + (st.addons.indexOf(a.id) > -1 ? ' checked' : '') + '><span class="c"><img src="' + UP + 'assets/img/addons/' + esc(a.id) + '.webp" alt="" onerror="this.style.visibility=\'hidden\'"><b>' + esc(a.name) + '</b></span></label>';
    }).join('') + '</div>';
    return h;
  }
  function stepWhen() {
    var h = '<h2>When &amp; where</h2><p class="sub">Choose a preferred day and time window.</p>';
    h += '<div class="row2"><div class="fgroup"><label for="zip">ZIP code</label><input type="text" id="zip" inputmode="numeric" maxlength="5" autocomplete="postal-code" value="' + esc(st.zip) + '"></div>';
    h += '<div class="fgroup"><label for="date">Date</label><input type="date" id="date" min="' + addDays(form.leadTimeDays) + '" max="' + addDays(form.maxDaysAhead) + '" value="' + esc(st.date) + '"></div></div>';
    h += '<div class="fgroup"><span class="lbl">Time window</span><div class="choices pills">' + form.timeWindows.map(function (w) { return radio('window', w.id, st.window, esc(w.label)); }).join('') + '</div></div>';
    form.questions.forEach(function (q) {
      var v = st.custom[q.id], id = 'q_' + q.id, req = q.required ? ' <span aria-hidden="true">*</span>' : '';
      if (q.type === 'checkbox') h += '<div class="fgroup"><label class="check"><input type="checkbox" data-q="' + esc(q.id) + '"' + (v ? ' checked' : '') + '><span>' + esc(q.label) + req + '</span></label></div>';
      else if (q.type === 'select') h += '<div class="fgroup"><label for="' + id + '">' + esc(q.label) + req + '</label><select id="' + id + '" data-q="' + esc(q.id) + '"><option value="">Select…</option>' + q.options.map(function (o) { return '<option' + (o === v ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select></div>';
      else if (q.type === 'textarea') h += '<div class="fgroup"><label for="' + id + '">' + esc(q.label) + req + '</label><textarea id="' + id + '" data-q="' + esc(q.id) + '">' + esc(v || '') + '</textarea></div>';
      else h += '<div class="fgroup"><label for="' + id + '">' + esc(q.label) + req + '</label><input type="text" id="' + id + '" data-q="' + esc(q.id) + '" value="' + esc(v || '') + '"></div>';
    });
    return h;
  }
  function stepPros() {
    var h = '<h2>Choose your professional</h2><p class="sub">Each is an independently owned, insured cleaning business. Prices are their own; Swify\'s booking fee is shown separately.</p>';
    if (busy) return h + '<p class="muted">Finding available professionals…</p>';
    if (!quotes.length) return h + '<div class="err">No professionals are available for those details yet. Try a different date or ZIP code, remove an add-on, or email us at <a href="mailto:admin@swifycleaning.com">admin@swifycleaning.com</a> and we\'ll help.</div>';
    h += '<div class="pros">' + quotes.map(function (q) {
      var inner = '<div class="top"><b>' + esc(q.provider.name) + '</b><span>' + money(q.total, q.currency) + '</span></div><ul class="lines">' +
        q.lines.map(function (l) { return '<li><span>' + esc(l.label) + '</span><span>' + money(l.amount, q.currency) + '</span></li>'; }).join('') +
        '<li class="fee"><span>Swify booking fee</span><span>' + money(q.fee, q.currency) + '</span></li></ul>';
      return '<label class="choice pro-card"><input type="radio" name="pro" value="' + esc(q.provider.id) + '"' + (chosen && chosen.provider.id === q.provider.id ? ' checked' : '') + '><span class="c">' + inner + '</span></label>';
    }).join('') + '</div>';
    return h;
  }
  function stepDetails() {
    var c = st.contact || {};
    var h = '<h2>Your details</h2><p class="sub">Your professional receives these once they accept your booking.</p><form class="details" novalidate onsubmit="return false">';
    h += '<div class="row2"><div class="fgroup"><label for="c_name">Full name</label><input type="text" id="c_name" data-c="name" autocomplete="name" required minlength="2" value="' + esc(c.name || '') + '"></div>';
    h += '<div class="fgroup"><label for="c_phone">Phone</label><input type="tel" id="c_phone" data-c="phone" autocomplete="tel" required minlength="10" value="' + esc(c.phone || '') + '"></div></div>';
    h += '<div class="fgroup"><label for="c_email">Email</label><input type="email" id="c_email" data-c="email" autocomplete="email" required value="' + esc(c.email || '') + '"></div>';
    h += '<div class="row3"><div class="fgroup"><label for="c_address">Street address</label><input type="text" id="c_address" data-c="address" autocomplete="street-address" required minlength="5" value="' + esc(c.address || '') + '"></div>';
    h += '<div class="fgroup"><label for="c_unit">Apt / unit</label><input type="text" id="c_unit" data-c="unit" value="' + esc(c.unit || '') + '"></div>';
    h += '<div class="fgroup"><label>ZIP</label><input type="text" value="' + esc(st.zip) + '" disabled></div></div>';
    h += '<div class="fgroup"><label for="c_notes">Notes for your professional</label><textarea id="c_notes" data-c="notes" placeholder="Parking, access, areas to focus on…">' + esc(c.notes || '') + '</textarea></div>';
    h += '<input class="hp" id="website" tabindex="-1" autocomplete="off" aria-hidden="true">';
    h += '<div class="fgroup"><label class="check"><input type="checkbox" id="agree"><span>I understand Swify is a referral service. My cleaning will be performed by <b>' + esc(chosen ? chosen.provider.name : 'the professional I chose') + '</b>, an independently owned business that sets its own prices. The Swify booking fee is a separate charge for the referral. If my professional can\'t accept, I\'ll receive a full refund.</span></label></div>';
    h += '</form>';
    return h;
  }
  function summary() {
    var svc = byId(form.services, st.service), size = byId(form.sizes, st.size), fq = byId(form.frequencies, st.frequency), w = byId(form.timeWindows, st.window);
    var rows = [['Service', svc && svc.name], ['Home', size ? size.label + ' · ' + st.bathrooms + ' bath' : ''], ['How often', fq && fq.label],
      ['Add-ons', st.addons.map(function (id) { var a = byId(form.addons, id); return a ? a.name : ''; }).join(', ') || 'None'],
      ['When', st.date ? S.fmtDate(st.date) + (w ? '<br>' + esc(w.label) : '') : ''], ['Professional', chosen ? esc(chosen.provider.name) : '']];
    var h = '<div class="panel summary"><h3>Your booking</h3><dl>' + rows.filter(function (r) { return r[1]; }).map(function (r) { return '<div><dt>' + r[0] + '</dt><dd>' + (r[0] === 'When' || r[0] === 'Professional' ? r[1] : esc(r[1])) + '</dd></div>'; }).join('') + '</dl>';
    if (chosen) {
      h += '<dl><div><dt>' + esc(chosen.provider.name) + '</dt><dd>' + money(chosen.providerAmount, chosen.currency) + '</dd></div><div><dt>Swify booking fee</dt><dd>' + money(chosen.fee, chosen.currency) + '</dd></div></dl>';
      h += '<div class="total"><span>Total</span><span>' + money(chosen.total, chosen.currency) + '</span></div><p class="note">Charged in full when you book. ' + esc(chosen.provider.name) + ' receives their full price; Swify\'s booking fee is separate. Full refund if your professional can\'t accept.</p>';
    } else h += '<p class="note">Prices are set by each independent professional. You\'ll compare them before paying.</p>';
    return h + '</div>';
  }
  function render() {
    var body = [stepHome, stepAddons, stepWhen, stepPros, stepDetails][step]();
    var nav = '<ol class="steps-nav">' + STEPS.map(function (s, i) { return '<li class="' + (i === step ? 'on' : i < step ? 'done' : '') + '">' + (i + 1) + '. ' + s + '</li>'; }).join('') + '</ol>';
    var actions = '<div class="actions">' + (step ? '<button type="button" class="btn btn-line" data-go="' + (step - 1) + '">← Back</button>' : '<span></span>') +
      (step < 4 ? '<button type="button" class="btn btn-ink" data-go="' + (step + 1) + '"' + (busy || (step === 3 && !quotes.length) ? ' disabled' : '') + '>Continue <span class="arr">→</span></button>'
                : '<button type="button" class="btn btn-ink" id="pay"' + (busy ? ' disabled' : '') + '>' + (busy ? 'Redirecting to secure checkout…' : 'Pay ' + money(chosen.total, chosen.currency) + ' securely <span class="arr">→</span>') + '</button>') + '</div>';
    root.innerHTML = (preview ? '<div class="ok-msg">Preview of your draft form (not saved, checkout disabled).</div>' : '') +
      nav + '<div class="bk"><div class="panel">' + (error ? '<div class="err" role="alert">' + esc(error) + '</div>' : '') + body + actions + '</div>' + summary() + '</div>';
  }

  // ---------- events ----------
  root.addEventListener('change', function (e) {
    var t = e.target;
    if (t.name === 'service' || t.name === 'size' || t.name === 'frequency' || t.name === 'window') { st[t.name] = t.value; chosen = null; }
    else if (t.name === 'addon') { st.addons = [].slice.call(root.querySelectorAll('input[name=addon]:checked')).map(function (x) { return x.value; }); chosen = null; }
    else if (t.name === 'pro') { chosen = quotes.find(function (q) { return q.provider.id === t.value; }); }
    else if (t.id === 'date') { st.date = t.value; chosen = null; }
    else if (t.dataset.q) {
      st.custom[t.dataset.q] = t.type === 'checkbox' ? t.checked : t.value;
      // text answers: don't redraw on blur, or the click that caused the blur (e.g. Continue) is lost
      if (t.tagName !== 'SELECT' && t.type !== 'checkbox') { save(); return; }
    }
    else if (t.id === 'agree') { return; }
    else return;
    error = ''; save(); render();
  });
  root.addEventListener('input', function (e) {
    var t = e.target;
    if (t.id === 'zip') { st.zip = t.value.replace(/\D/g, '').slice(0, 5); if (t.value !== st.zip) t.value = st.zip; chosen = null; }
    else if (t.dataset.c) { (st.contact = st.contact || {})[t.dataset.c] = t.value; }
    else if (t.dataset.q && t.type !== 'checkbox' && t.tagName !== 'SELECT') { st.custom[t.dataset.q] = t.value; }
    save();
  });
  root.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.bath) { st.bathrooms = Math.min(form.bathrooms.max, Math.max(form.bathrooms.min, st.bathrooms + Number(b.dataset.bath))); chosen = null; save(); render(); }
    else if (b.dataset.go !== undefined) go(Number(b.dataset.go));
    else if (b.id === 'pay') pay();
  });
  init();
})();
