(function () {
  var header = document.querySelector('.site-header');
  var toggle = document.querySelector('.menu-toggle');
  var links = document.querySelector('.nav-links');

  function onScroll() {
    if (header) header.classList.toggle('scrolled', window.scrollY > 40);
    // gentle parallax on hero + split images
    var y = window.scrollY;
    var hero = document.querySelector('.hero .bg');
    if (hero && y < window.innerHeight * 1.2) hero.style.transform = 'translate3d(0,' + (y * 0.22) + 'px,0) scale(1.02)';
    document.querySelectorAll('.split .media img').forEach(function (img) {
      var r = img.parentElement.getBoundingClientRect();
      var p = (r.top + r.height / 2 - window.innerHeight / 2) / window.innerHeight;
      img.style.transform = 'translate3d(0,' + (p * -40 - 20) + 'px,0)';
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if (toggle) toggle.addEventListener('click', function () {
    var open = links.classList.toggle('open');
    header.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.body.style.overflow = open ? 'hidden' : '';
  });

  var io = 'IntersectionObserver' in window && new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(function (el) { io ? io.observe(el) : el.classList.add('in'); });
})();
