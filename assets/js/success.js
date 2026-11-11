(function () {
  var S = window.Swify, esc = S.esc;
  var el = document.getElementById('result');
  var sid = new URLSearchParams(location.search).get('session_id');
  if (!el) return;
  if (!sid) { el.innerHTML = '<div class="err">Missing booking reference.</div>'; return; }
  var tries = 0;
  async function poll() {
    try {
      var b = await S.api('/api/booking?session_id=' + encodeURIComponent(sid));
      if (b.status === 'pending_payment' && tries++ < 15) { el.innerHTML = '<p class="muted">Confirming your payment…</p>'; setTimeout(poll, 2000); return; }
      try { sessionStorage.removeItem('swify_booking'); } catch (e) {}
      var paid = b.status !== 'pending_payment' && b.status !== 'expired';
      el.innerHTML = (paid ? '<p class="eyebrow">Booking received</p><h1>Thank you — <em>you\'re booked.</em></h1>' : '<p class="eyebrow">Almost there</p><h1>We\'re confirming your payment.</h1>') +
        '<p class="lead">' + (paid ? 'Your payment went through. <b>' + esc(b.provider) + '</b> will confirm your cleaning shortly, and a receipt is on its way to ' + esc(b.email) + '.' : 'This can take a minute. You\'ll get an email receipt from Stripe once it completes.') + '</p>' +
        '<div class="panel" style="max-width:560px"><dl class="summary-dl">' +
        '<div><dt>Reference</dt><dd>' + esc(b.id) + '</dd></div><div><dt>Professional</dt><dd>' + esc(b.provider) + '</dd></div><div><dt>When</dt><dd>' + esc(S.fmtDate(b.date)) + ' · ' + esc(b.window || '') + '</dd></div>' +
        '<div><dt>Paid</dt><dd>' + S.money(b.summary.total, b.summary.currency) + '</dd></div></dl>' +
        '<p class="muted" style="font-size:13px;margin:16px 0 0">Questions or changes? Email <a href="mailto:admin@swifycleaning.com">admin@swifycleaning.com</a> with your reference.</p></div>';
    } catch (e) { el.innerHTML = '<div class="err">' + esc(e.message) + '</div>'; }
  }
  poll();
})();
