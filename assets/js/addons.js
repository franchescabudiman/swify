// Swify add-ons: a draggable field where every add-on appears exactly once.
// Layout follows a staggered grid: equal cells, alternate columns shifted by
// half a cell, every object centred in its own cell with generous space
// around it, and each object sized relative to its real-life scale.
(function () {
  var data = window.SWIFY_ADDONS || [];
  var UP = window.SWIFY_UP || '';
  var canvas = document.getElementById('canvas');
  var card = document.getElementById('card');
  var list = document.getElementById('list');
  var listBtn = document.getElementById('listBtn');
  if (!canvas) return;

  // relative real-world scale (1 = fills the object box)
  var SCALE = { fridge: 1, oven: .86, cabinet: .8, window: .74, blinds: .74, laundry: .7,
    organizing: .62, dishes: .56, linens: .58, walls: .62, baseboards: .56 };
  // display order: spreads similar items apart; every add-on is placed exactly once
  var ORDER = ['fridge', 'dishes', 'window', 'laundry', 'oven', 'linens', 'blinds', 'walls', 'cabinet', 'baseboards', 'organizing'];

  var vw, vh, cols, rows, S, box, gridW, gridH, nodes = [];
  var pan = { x: 0, y: 0 }, vel = { x: 0, y: 0 }, zoom = 1, targetZoom = 1;

  // keep-clear zone: wherever the page title and hint sit on screen
  function titleZone() {
    var a = document.querySelector('.canvas-intro .title'), b = document.querySelector('.canvas-intro .hint');
    if (!a || !b) return null;
    var r1 = a.getBoundingClientRect(), r2 = b.getBoundingClientRect(), m = 24;
    return { l: Math.min(r1.left, r2.left) - m, t: r1.top - m, r: Math.max(r1.right, r2.right) + m, b: r2.bottom + m };
  }

  function layout(extraRows) {
    vw = window.innerWidth; vh = window.innerHeight;
    var mobile = vw < 700;
    cols = mobile ? 3 : 4;
    rows = Math.ceil(data.length / cols) + extraRows;
    S = mobile ? Math.max(150, Math.min(210, vw / 2.1))
               : Math.max(260, Math.min(440, vw / 3.6, (vh - 40) / (rows + 0.5) * 1.25));
    box = S * 0.72;                                          // object box; the rest of each cell stays empty
    gridW = cols * S;
    gridH = rows * S + S / 2;                                // + half-cell stagger
    // start: centred across (or left-aligned if wider than the screen); bottom row meets the screen bottom
    pan.x = gridW > vw ? 0 : (vw - gridW) / 2;
    pan.y = Math.min(70, vh - rows * S);
  }

  function cellCentre(c, r) { return { x: c * S + S / 2, y: r * S + S / 2 + (c % 2 ? S / 2 : 0) }; } // odd columns drop half a cell

  function build() {
    canvas.innerHTML = '';
    nodes = [];
    var zone = titleZone(), slots, extra = 0;
    do {
      layout(extra);
      slots = [];
      for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
        var p = cellCentre(c, r), x = pan.x + p.x, y = pan.y + p.y, h = box / 2;
        // leave a cell empty if its object would sit under the title at the starting view
        if (zone && x + h > zone.l && x - h < zone.r && y + h > zone.t && y - h < zone.b) continue;
        slots.push({ c: c, r: r });
      }
      extra++;
    } while (slots.length < data.length && extra < 4);

    var items = ORDER.map(function (k) { return data.find(function (d) { return d.k === k; }); }).filter(Boolean);
    data.forEach(function (d) { if (items.indexOf(d) < 0) items.push(d); });

    items.forEach(function (item, i) {
      var s = slots[i]; if (!s) return;
      var el = document.createElement('button');
      el.className = 'obj'; el.type = 'button';
      el.setAttribute('aria-label', item.name);
      el.dataset.k = item.k;
      el.innerHTML = '<img src="' + UP + 'assets/img/addons/' + item.k + '.webp" alt="" draggable="false"><span class="tag">+ ' + item.name + '</span>';
      var size = box * (SCALE[item.k] || .7);
      el.style.width = el.style.height = size + 'px';
      canvas.appendChild(el);
      var p = cellCentre(s.c, s.r);
      nodes.push({ el: el, item: item, size: size, cx: p.x, cy: p.y, phase: i * 0.9 });
    });
  }

  // the field can be dragged until its edge meets the screen edge (+ margin), then springs back
  function bounds() {
    var m = 60, W = gridW * zoom, H = gridH * zoom;
    return {
      minX: Math.min(vw - W - m, (vw - W) / 2), maxX: Math.max(m, (vw - W) / 2),
      minY: Math.min(vh - H - m, (vh - H) / 2), maxY: Math.max(m + 70, (vh - H) / 2)
    };
  }
  function rubber(v, lo, hi) { return v < lo ? lo - (lo - v) * 0.35 : v > hi ? hi + (v - hi) * 0.35 : v; }

  var dragging = false, last = null, moved = 0;
  function frame(t) {
    var b = bounds();
    if (!dragging) {
      pan.x += vel.x; pan.y += vel.y; vel.x *= 0.93; vel.y *= 0.93;
      if (pan.x < b.minX) pan.x += (b.minX - pan.x) * 0.15;
      if (pan.x > b.maxX) pan.x += (b.maxX - pan.x) * 0.15;
      if (pan.y < b.minY) pan.y += (b.minY - pan.y) * 0.15;
      if (pan.y > b.maxY) pan.y += (b.maxY - pan.y) * 0.15;
    }
    var prevZoom = zoom;
    zoom += (targetZoom - zoom) * 0.12;
    if (Math.abs(zoom - prevZoom) > 1e-4) {                  // zoom around the screen centre
      pan.x = vw / 2 - (vw / 2 - pan.x) * (zoom / prevZoom);
      pan.y = vh / 2 - (vh / 2 - pan.y) * (zoom / prevZoom);
    }
    // the whole field sways slowly as one, so spacing between objects never changes
    var sw = dragging ? 0 : 1;
    var sx = Math.sin(t / 5200) * 10 * sw, sy = Math.cos(t / 6100) * 8 * sw;
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var x = pan.x + sx + n.cx * zoom - n.size / 2;
      var y = pan.y + sy + n.cy * zoom - n.size / 2 + Math.sin(t / 1800 + n.phase) * 3;
      n.el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) scale(' + zoom.toFixed(3) + ')';
    }
    requestAnimationFrame(frame);
  }

  canvas.addEventListener('pointerdown', function (e) {
    dragging = true; moved = 0; last = { x: e.clientX, y: e.clientY }; vel.x = vel.y = 0;
    canvas.classList.add('grabbing'); canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    var b = bounds(), dx = e.clientX - last.x, dy = e.clientY - last.y;
    pan.x = rubber(pan.x + dx, b.minX, b.maxX); pan.y = rubber(pan.y + dy, b.minY, b.maxY);
    vel.x = dx; vel.y = dy; moved += Math.abs(dx) + Math.abs(dy);
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

  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    if (e.ctrlKey) { setZoom(targetZoom * (e.deltaY > 0 ? 0.95 : 1.05)); return; }
    vel.x = -e.deltaX * 0.3; vel.y = -e.deltaY * 0.3;
  }, { passive: false });

  canvas.addEventListener('keydown', function (e) {
    var k = { ArrowLeft: [14, 0], ArrowRight: [-14, 0], ArrowUp: [0, 14], ArrowDown: [0, -14] }[e.key];
    if (k) { e.preventDefault(); vel.x = k[0]; vel.y = k[1]; }
    if (e.key === 'Enter' && document.activeElement.classList.contains('obj')) open(document.activeElement.dataset.k);
  });

  function setZoom(z) { targetZoom = Math.max(0.6, Math.min(1.4, z)); }
  document.getElementById('zoomIn').addEventListener('click', function () { setZoom(targetZoom + 0.15); });
  document.getElementById('zoomOut').addEventListener('click', function () { setZoom(targetZoom - 0.15); });

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
  requestAnimationFrame(frame);
})();
