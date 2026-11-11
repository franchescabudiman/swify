// Swify add-ons: an endless, draggable canvas of objects (inspired by an explorable product field)
(function () {
  var data = window.SWIFY_ADDONS || [];
  var UP = window.SWIFY_UP || '';
  var canvas = document.getElementById('canvas');
  var card = document.getElementById('card');
  var list = document.getElementById('list');
  var listBtn = document.getElementById('listBtn');
  if (!canvas) return;

  // seeded random so the layout is the same every visit
  var seed = 7;
  function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

  var vw, vh, W, H, nodes = [];
  var pan = { x: 0, y: 0 }, vel = { x: 0, y: 0 }, zoom = 1, targetZoom = 1;
  var mobile = window.matchMedia('(max-width: 700px)').matches;

  function build() {
    canvas.innerHTML = '';
    nodes = [];
    vw = window.innerWidth; vh = window.innerHeight;
    mobile = vw < 700;
    var cell = mobile ? 165 : 300;
    W = Math.max(mobile ? 1100 : 2100, Math.ceil(vw * 1.6 / cell) * cell);
    H = Math.max(mobile ? 1300 : 1500, Math.ceil(vh * 1.6 / cell) * cell);
    var cols = Math.round(W / cell), rows = Math.round(H / cell);
    var i = 0;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        if (rnd() < (mobile ? 0.22 : 0.42)) continue; // breathing room
        var item = data[(c * 5 + r * 3) % data.length]; i++;
        var size = (mobile ? 100 : 150) * (0.85 + rnd() * 0.3) * ({ fridge: 1.45, oven: 1.25, walls: 1.2, blinds: 1.15, window: 1.1, cabinet: 1.15 }[item.k] || 1);
        var el = document.createElement('button');
        el.className = 'obj';
        el.type = 'button';
        el.setAttribute('aria-label', item.name);
        el.innerHTML = '<img src="' + UP + 'assets/img/addons/' + item.k + '.webp" alt="" draggable="false"><span class="tag">+ ' + item.name + '</span>';
        el.style.width = size + 'px'; el.style.height = size + 'px';
        el.dataset.k = item.k;
        canvas.appendChild(el);
        nodes.push({
          el: el, item: item, size: size,
          x: c * cell + (cell - size) / 2 + (rnd() - 0.5) * cell * 0.3,
          y: r * cell + (cell - size) / 2 + (rnd() - 0.5) * cell * 0.3,
          depth: 0.8 + rnd() * 0.4,           // parallax: nearer objects move faster
          rot: ['dishes', 'linens', 'baseboards', 'organizing', 'laundry'].indexOf(item.k) > -1 ? (rnd() - 0.5) * 12 : 0,
          bob: rnd() * Math.PI * 2
        });
      }
    }
  }

  function mod(a, n) { return ((a % n) + n) % n; }

  var t0 = performance.now(), dragging = false, idle = true;
  function frame(t) {
    var dt = Math.min(48, t - t0); t0 = t;
    if (!dragging) {
      pan.x += vel.x; pan.y += vel.y;
      vel.x *= 0.94; vel.y *= 0.94;
      if (idle) { pan.x -= 0.18 * dt / 16; pan.y -= 0.08 * dt / 16; } // slow ambient drift
    }
    zoom += (targetZoom - zoom) * 0.12;
    var Wz = W * zoom, Hz = H * zoom, padX = 220 * zoom, padY = 220 * zoom;
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var sx = mod(n.x * zoom + pan.x * n.depth + padX, Wz) - padX;
      var sy = mod(n.y * zoom + pan.y * n.depth + padY, Hz) - padY;
      var bob = Math.sin(t / 1600 + n.bob) * 5;
      n.el.style.transform = 'translate3d(' + sx.toFixed(1) + 'px,' + (sy + bob).toFixed(1) + 'px,0) scale(' + zoom.toFixed(3) + ') rotate(' + n.rot + 'deg)';
    }
    requestAnimationFrame(frame);
  }

  // drag / swipe
  var last = null, moved = 0;
  canvas.addEventListener('pointerdown', function (e) {
    dragging = true; idle = false; moved = 0; last = { x: e.clientX, y: e.clientY };
    vel.x = vel.y = 0;
    canvas.classList.add('grabbing');
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    var dx = e.clientX - last.x, dy = e.clientY - last.y;
    pan.x += dx; pan.y += dy; vel.x = dx; vel.y = dy;
    moved += Math.abs(dx) + Math.abs(dy);
    last = { x: e.clientX, y: e.clientY };
  });
  function end(e) {
    if (!dragging) return;
    dragging = false; canvas.classList.remove('grabbing');
    if (moved < 6) {
      var hit = document.elementsFromPoint(e.clientX, e.clientY).find(function (x) { return x.classList && x.classList.contains('obj'); });
      if (hit) open(hit.dataset.k);
    }
  }
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  // scroll / trackpad moves the field too
  canvas.addEventListener('wheel', function (e) {
    e.preventDefault(); idle = false;
    if (e.ctrlKey) { setZoom(targetZoom * (e.deltaY > 0 ? 0.95 : 1.05)); return; }
    vel.x = -e.deltaX * 0.35; vel.y = -e.deltaY * 0.35;
  }, { passive: false });

  // keyboard
  canvas.addEventListener('keydown', function (e) {
    var k = { ArrowLeft: [40, 0], ArrowRight: [-40, 0], ArrowUp: [0, 40], ArrowDown: [0, -40] }[e.key];
    if (k) { e.preventDefault(); idle = false; vel.x = k[0] / 3; vel.y = k[1] / 3; }
  });
  canvas.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && document.activeElement.classList.contains('obj')) open(document.activeElement.dataset.k);
  });

  function setZoom(z) { targetZoom = Math.max(0.65, Math.min(1.5, z)); }
  document.getElementById('zoomIn').addEventListener('click', function () { setZoom(targetZoom + 0.15); });
  document.getElementById('zoomOut').addEventListener('click', function () { setZoom(targetZoom - 0.15); });

  // detail card
  function open(k) {
    var it = data.find(function (d) { return d.k === k; });
    if (!it) return;
    card.querySelector('img').src = UP + 'assets/img/addons/' + k + '.webp';
    card.querySelector('h2').textContent = it.name;
    card.querySelector('p').textContent = it.desc;
    card.hidden = false;
    requestAnimationFrame(function () { card.classList.add('show'); });
  }
  function close() { card.classList.remove('show'); setTimeout(function () { card.hidden = true; }, 350); }
  card.querySelector('.close').addEventListener('click', close);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

  // list view toggle (also the accessible alternative)
  listBtn.addEventListener('click', function () {
    var on = list.hidden; if (on) close();
    list.hidden = !on;
    document.body.classList.toggle('list-on', on);
    listBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    listBtn.innerHTML = on ? '<span class="ico">✛</span> Explore view' : '<span class="ico">☰</span> List view';
  });

  build();
  var rt;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(build, 200); });
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) idle = false;
  requestAnimationFrame(frame);
})();
