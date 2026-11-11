// Shared helpers for the booking page, provider portal and admin.
(function () {
  var base = window.SWIFY_API_BASE || '';
  // local testing: http://localhost:xxxx/book/?api=http://localhost:8787 (remembered on localhost only)
  try {
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
      var q = new URLSearchParams(location.search).get('api');
      if (q) localStorage.setItem('swify_api', q);
      base = localStorage.getItem('swify_api') || base;
    }
  } catch (e) {}

  async function api(path, opts) {
    opts = opts || {};
    var headers = { 'Content-Type': 'application/json' };
    if (opts.token) headers.Authorization = 'Bearer ' + opts.token;
    var res;
    try {
      res = await fetch(base + path, { method: opts.method || 'GET', headers: headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
    } catch (e) { throw new Error('Could not reach the booking service. Check your connection and try again.'); }
    var data = {};
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) { var err = new Error(data.error || ('Request failed (' + res.status + ')')); err.status = res.status; throw err; }
    return data;
  }
  function money(cents, cur) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: (cur || 'usd').toUpperCase(), minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmtDate(iso) { if (!iso) return ''; var d = new Date(iso + 'T12:00:00'); return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }); }
  window.Swify = { api: api, money: money, esc: esc, fmtDate: fmtDate, apiBase: function () { return base; } };
})();
