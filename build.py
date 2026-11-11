#!/usr/bin/env python3
"""Generates the Swify site pages from shared header/footer.
Edit the content below, then run:  python3 build.py
"""
import os, json

ROOT = os.path.dirname(os.path.abspath(__file__))
BOOK_URL = "https://swify.bookingkoala.com/booknow"
EMAIL = "admin@swifycleaning.com"
IG = "https://www.instagram.com/swifycleaning/"

NAV = [("Home", ""), ("Add-ons", "add-ons/"), ("For Professionals", "for-professionals/"), ("About", "about/")]

ADDONS = [
    ("oven", "Inside the oven", "Racks, glass and interior degreased and wiped down."),
    ("fridge", "Inside the fridge", "Shelves and drawers emptied, wiped and neatly restocked."),
    ("dishes", "Dishes", "Hand-washed, dried and put away — or loaded and run."),
    ("laundry", "Laundry", "Washed, dried and folded, ready for the drawer."),
    ("linens", "Fresh linens", "Beds stripped and remade with crisp, fresh sheets."),
    ("window", "Interior windows", "Glass, frames and sills, left streak-free."),
    ("blinds", "Blinds", "Every slat dusted and wiped, top to bottom."),
    ("cabinet", "Cabinets & drawers", "Emptied, wiped inside and thoughtfully returned."),
    ("walls", "Wall wipe-down", "Scuffs and marks lifted from walls, doors and switches."),
    ("baseboards", "Baseboards", "Hand-wiped, corner to corner, room by room."),
    ("organizing", "Organizing", "Closets, pantries and drawers — edited and arranged."),
]


def page(path, title, desc, body, current="", dark_hero=False, body_class="", extra_js=""):
    depth = path.count("/") + 1 if path else 0
    up = "../" * depth
    def href(p):
        return up + p if p else (up or "./")
    links = "\n".join(
        f'        <li><a href="{href(p)}"{" aria-current=\"page\"" if p == current else ""}>{n}</a></li>' for n, p in NAV
    )
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>{title}</title>
  <meta name="description" content="{desc}">
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{desc}">
  <meta property="og:image" content="{up}assets/img/hero.webp">
  <meta name="theme-color" content="#f5f1ea">
  <link rel="preload" href="{up}assets/fonts/cormorant-garamond-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="{up}assets/css/style.css">
</head>
<body class="{body_class}">
  <a class="skip" href="#main">Skip to content</a>
  <header class="site-header{' on-dark' if dark_hero else ''}">
    <nav class="nav" aria-label="Main">
      <a class="brand" href="{href('')}">Swify<span>.</span></a>
      <button class="menu-toggle" aria-label="Menu" aria-expanded="false"><span></span><span></span></button>
      <ul class="nav-links">
{links}
        <li><a class="btn btn-ink" href="{href('book/')}">Book a cleaning</a></li>
      </ul>
    </nav>
  </header>
  <main id="main">
{body.replace('{UP}', up)}
  </main>
"""
    if body_class != "canvas-page":
        html += f"""  <footer class="site-footer">
    <div class="wrap">
      <div class="foot-top">
        <div>
          <a class="brand" href="{href('')}">Swify<span>.</span></a>
          <p>A home-care concierge connecting Los Angeles homes with vetted, independent cleaning professionals.</p>
        </div>
        <div>
          <h4>Explore</h4>
          <ul>
            <li><a href="{href('book/')}">Book a cleaning</a></li>
            <li><a href="{href('add-ons/')}">Add-ons</a></li>
            <li><a href="{href('for-professionals/')}">For professionals</a></li>
            <li><a href="{href('about/')}">About &amp; FAQs</a></li>
          </ul>
        </div>
        <div>
          <h4>Contact</h4>
          <ul>
            <li><a href="mailto:{EMAIL}">{EMAIL}</a></li>
            <li><a href="{IG}" target="_blank" rel="noopener">Instagram</a></li>
            <li>Los Angeles, California</li>
          </ul>
        </div>
      </div>
      <div class="foot-bottom">
        <span>© 2026 Swify. All rights reserved.</span>
        <span>Swify is a referral service. Cleaning services are performed by independent, separately owned businesses.</span>
      </div>
    </div>
  </footer>
"""
    html += f"""  <script src="{up}assets/js/main.js"></script>
{extra_js.replace('{UP}', up)}</body>
</html>
"""
    out = os.path.join(ROOT, path, "index.html") if path else os.path.join(ROOT, "index.html")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, "w").write(html)


# ---------------- HOME ----------------
marquee_imgs = "".join(f'<img src="{{UP}}assets/img/addons/{k}.webp" alt="">' for k, _, _ in ADDONS)
home = f"""
    <section class="hero" style="padding:0">
      <img class="bg" src="{{UP}}assets/img/hero.webp" alt="" fetchpriority="high">
      <div class="inner">
        <p class="eyebrow">Los Angeles · Home-care concierge</p>
        <h1>A spotless home,<br><em>quietly</em> arranged.</h1>
        <p>Swify matches you with vetted, independent cleaning professionals across Los Angeles — so all you have to do is come home.</p>
        <a class="btn btn-glass" href="{{UP}}book/">Book a cleaning <span class="arr">→</span></a>
      </div>
      <span class="scroll-cue">Scroll</span>
    </section>

    <section class="statement">
      <div class="wrap reveal">
        <p class="eyebrow">The Swify standard</p>
        <h2>We don’t send just anyone. We <em>hand-select</em> the finest independent cleaning businesses in Los Angeles — and match the right one to your home.</h2>
      </div>
    </section>

    <section style="padding-top:0">
      <div class="wrap">
        <div class="reveal"><p class="eyebrow">How it works</p><h2>Three steps.<br><em>Zero</em> effort.</h2></div>
        <div class="steps">
          <div class="step reveal"><span class="num">i.</span><h3>Tell us about your home</h3><p>Share your space, your schedule and any add-ons in a two-minute request.</p></div>
          <div class="step reveal"><span class="num">ii.</span><h3>We make the match</h3><p>We pair you with a vetted, insured cleaning professional suited to your home and your standards.</p></div>
          <div class="step reveal"><span class="num">iii.</span><h3>Come home to clean</h3><p>Your pro arrives fully equipped. Afterward, tell us how it went — we’re your single point of contact.</p></div>
        </div>
      </div>
    </section>

    <section style="padding-top:0">
      <div class="wrap split">
        <div class="media reveal"><img src="{{UP}}assets/img/bedroom.webp" alt="A freshly made bed in a bright, quiet bedroom" loading="lazy"></div>
        <div class="reveal">
          <p class="eyebrow">Curated, not crowdsourced</p>
          <h2>Only the <em>best</em> make the list.</h2>
          <p class="lead">Every professional in the Swify network is an independently owned, licensed business. We review their insurance, references and work before they ever receive a request — and we keep listening after every visit.</p>
          <p style="margin-top:34px"><a class="btn btn-line" href="{{UP}}about/">How we vet <span class="arr">→</span></a></p>
        </div>
      </div>
    </section>

    <section class="dark">
      <div class="wrap">
        <div class="reveal"><p class="eyebrow">Our promise</p><h2>Care you can <em>count on.</em></h2></div>
        <div class="promises">
          <div class="promise reveal"><h3>Vetted &amp; insured</h3><p>Licensed, insured businesses with verified references.</p></div>
          <div class="promise reveal"><h3>One point of contact</h3><p>Questions, changes or feedback — just reach out to Swify.</p></div>
          <div class="promise reveal"><h3>Made right</h3><p>Something missed? Tell us within 24 hours and we’ll make it right.</p></div>
          <div class="promise reveal"><h3>Flexible</h3><p>Reschedule or cancel up to 24 hours ahead at no charge.</p></div>
        </div>
      </div>
    </section>

    <section class="teaser">
      <div class="wrap reveal" style="display:flex;justify-content:space-between;align-items:end;gap:30px;flex-wrap:wrap">
        <div><p class="eyebrow">Add-ons</p><h2>The <em>finishing</em> touches.</h2></div>
        <a class="btn btn-line" href="{{UP}}add-ons/">Explore add-ons <span class="arr">→</span></a>
      </div>
      <div class="marquee" aria-hidden="true">{marquee_imgs}{marquee_imgs}</div>
    </section>

    <section style="padding-top:40px">
      <div class="wrap split">
        <div class="reveal" style="order:1">
          <p class="eyebrow">For cleaning professionals</p>
          <h2>Run your business.<br>We’ll bring <em>the clients.</em></h2>
          <p class="lead">Own a licensed cleaning business in Los Angeles? Join the Swify network to receive quality referrals while keeping your independence, your brand and your own way of working.</p>
          <p style="margin-top:34px"><a class="btn btn-ink" href="{{UP}}for-professionals/">Join the network <span class="arr">→</span></a></p>
        </div>
        <div class="media reveal" style="order:2"><img src="{{UP}}assets/img/about-sponge.webp" alt="Sponge and cleaning solution" loading="lazy"></div>
      </div>
    </section>

    <section class="cta-band">
      <div class="wrap reveal">
        <h2>Come home to <em>clean.</em></h2>
        <div class="cta-row"><a class="btn btn-ink" href="{{UP}}book/">Book a cleaning <span class="arr">→</span></a><a class="btn btn-line" href="{{UP}}add-ons/">Explore add-ons</a></div>
      </div>
    </section>
"""
page("", "Swify — Home Cleaning Concierge in Los Angeles", "Swify connects Los Angeles homes with vetted, independent cleaning professionals. Book in minutes.", home, current="", dark_hero=True)

# ---------------- ADD-ONS (explorable canvas) ----------------
addons_json = json.dumps([{"k": k, "name": n, "desc": d} for k, n, d in ADDONS])
list_items = "".join(
    f'<li><img src="{{UP}}assets/img/addons/{k}.webp" alt=""><div><strong>{n}</strong><span>{d}</span></div></li>' for k, n, d in ADDONS
)
addons = f"""
    <h1 class="sr-only">Add-ons</h1>
    <div class="canvas" id="canvas" aria-label="Explore add-ons. Drag to move around." tabindex="0"></div>
    <div class="canvas-intro">
      <p class="eyebrow">Add-ons</p>
      <p class="title">The <em>finishing</em> touches.</p>
      <p class="hint">Drag to explore · tap an item for details</p>
    </div>
    <aside class="addon-card" id="card" aria-live="polite" hidden>
      <button class="close" aria-label="Close">×</button>
      <img alt="">
      <h2></h2>
      <p></p>
      <a class="btn btn-ink" href="{{UP}}book/">Add when booking <span class="arr">→</span></a>
    </aside>
    <div class="canvas-bar">
      <button class="pill" id="listBtn" aria-pressed="false"><span class="ico">☰</span> List view</button>
      <span class="pill hint-pill">✛ Drag to explore</span>
      <button class="pill round" id="zoomOut" aria-label="Zoom out">−</button>
      <button class="pill round" id="zoomIn" aria-label="Zoom in">+</button>
    </div>
    <div class="list-view" id="list" hidden>
      <div class="wrap">
        <p class="eyebrow">Add-ons</p>
        <h2 style="margin-bottom:40px">The <em>finishing</em> touches.</h2>
        <ul>{list_items}</ul>
        <p style="margin-top:40px"><a class="btn btn-ink" href="{{UP}}book/">Book with add-ons <span class="arr">→</span></a></p>
      </div>
    </div>
"""
addons_js = f"""  <script>window.SWIFY_ADDONS = {addons_json}; window.SWIFY_UP = "{{UP}}";</script>
  <script src="{{UP}}assets/js/addons.js"></script>
"""
page("add-ons", "Add-ons — Swify", "Oven, fridge, dishes, laundry, linens, windows and more — the finishing touches for your Swify cleaning.", addons, current="add-ons/", body_class="canvas-page", extra_js=addons_js)

# ---------------- FOR PROFESSIONALS ----------------
pros = f"""
    <section class="page-hero">
      <div class="wrap reveal">
        <p class="eyebrow">For cleaning professionals</p>
        <h1>Your business, <em>beautifully</em> booked.</h1>
        <p class="lead">Swify is a referral network for independent cleaning businesses in Los Angeles. We find and screen the clients; you keep your independence.</p>
        <p style="margin-top:36px"><a class="btn btn-ink" href="mailto:{EMAIL}?subject=Joining%20the%20Swify%20network">Apply to join <span class="arr">→</span></a></p>
      </div>
    </section>
    <section style="padding-top:0">
      <div class="wrap split">
        <div class="reveal">
          <p class="eyebrow">Why join</p>
          <ul class="list-clean">
            <li><b>01</b><div><strong>Quality referrals</strong><span>Discerning clients across the Los Angeles area, sent your way.</span></div></li>
            <li><b>02</b><div><strong>Your choice, always</strong><span>Accept the requests that suit you and decline the ones that don’t.</span></div></li>
            <li><b>03</b><div><strong>Keep your brand</strong><span>You remain your own business — your name, your tools, your methods.</span></div></li>
            <li><b>04</b><div><strong>Less admin</strong><span>We handle discovery and client communication so you can focus on the work.</span></div></li>
          </ul>
        </div>
        <div class="media reveal"><img src="{{UP}}assets/img/about-shower.webp" alt="Squeegee on shower glass" loading="lazy"></div>
      </div>
    </section>
    <section class="dark">
      <div class="wrap">
        <div class="reveal"><p class="eyebrow">Requirements</p><h2>What we look for.</h2></div>
        <div class="promises">
          <div class="promise reveal"><h3>A registered business</h3><p>An LLC or other registered business entity, with a business license where required.</p></div>
          <div class="promise reveal"><h3>Insurance</h3><p>Current general liability insurance.</p></div>
          <div class="promise reveal"><h3>Your own equipment</h3><p>You bring your own supplies and tools.</p></div>
          <div class="promise reveal"><h3>A great record</h3><p>References or reviews that speak to your standards.</p></div>
        </div>
      </div>
    </section>
    <section class="cta-band">
      <div class="wrap reveal">
        <h2>Ready to <em>grow?</em></h2>
        <p class="lead" style="margin:0 auto 36px">Email us your business name, service area, license and insurance details, and we’ll be in touch.</p>
        <div class="cta-row"><a class="btn btn-ink" href="mailto:{EMAIL}?subject=Joining%20the%20Swify%20network">Apply to join <span class="arr">→</span></a></div>
      </div>
    </section>
"""
page("for-professionals", "For Cleaning Professionals — Swify", "Join the Swify referral network for independent cleaning businesses in Los Angeles.", pros, current="for-professionals/")

# ---------------- ABOUT + FAQ ----------------
faqs = [
    ("Who will clean my home?", "An independently owned, licensed and insured cleaning business from the Swify network, matched to your home and request."),
    ("What if I need to reschedule or cancel?", "Life happens. You can reschedule or cancel up to 24 hours in advance at no charge — just let us know."),
    ("How long does a cleaning usually take?", "It depends on the size and condition of your space, but most standard cleanings take between 1.5 and 3 hours."),
    ("What areas do you serve?", "We currently serve the Los Angeles metropolitan area. Enter your zip code when booking to check availability."),
    ("Do professionals bring their own supplies?", "Yes. Professionals arrive fully equipped. If you’d prefer they use your products, just let us know."),
    ("What if I’m not satisfied?", "Your satisfaction is our priority. If something wasn’t right, contact us within 24 hours and we’ll make it right."),
]
faq_html = "".join(f"<details><summary>{q}</summary><p>{a}</p></details>" for q, a in faqs)
about = f"""
    <section class="page-hero">
      <div class="wrap reveal">
        <p class="eyebrow">About Swify</p>
        <h1>Less time cleaning. <em>More</em> time living.</h1>
        <p class="lead">Swify began with recent college graduates who knew how hard it is to keep up with a home while juggling work, school and everything in between. Today we connect Los Angeles households with the city’s best independent cleaning professionals.</p>
      </div>
    </section>
    <section style="padding-top:0">
      <div class="wrap split">
        <div class="media reveal"><img src="{{UP}}assets/img/about-bedroom.webp" alt="A calm, tidy bedroom" loading="lazy"></div>
        <div class="reveal">
          <p class="eyebrow">Our mission</p>
          <h2>One less thing to <em>think about.</em></h2>
          <p class="lead">Our mission is to make high-quality home care accessible, efficient and reliable — so you can focus on what matters most.</p>
        </div>
      </div>
    </section>
    <section style="padding-top:0" id="vetting">
      <div class="wrap">
        <div class="reveal"><p class="eyebrow">How we vet</p><h2>Selected with <em>care.</em></h2></div>
        <ul class="list-clean reveal" style="margin-top:50px">
          <li><b>01</b><div><strong>Business verification</strong><span>Each professional operates a registered business with the licensing their work requires.</span></div></li>
          <li><b>02</b><div><strong>Insurance on file</strong><span>Proof of current liability insurance before any referral.</span></div></li>
          <li><b>03</b><div><strong>References &amp; reviews</strong><span>We look closely at their track record and the standard of their work.</span></div></li>
          <li><b>04</b><div><strong>Ongoing feedback</strong><span>Your feedback after every visit keeps the network at its best.</span></div></li>
        </ul>
      </div>
    </section>
    <section style="padding-top:0" id="faqs">
      <div class="wrap">
        <div class="reveal"><p class="eyebrow">FAQs</p><h2>Questions, <em>answered.</em></h2></div>
        <div class="faq reveal" style="margin-top:40px">{faq_html}</div>
      </div>
    </section>
"""
page("about", "About & FAQs — Swify", "About Swify, how we vet cleaning professionals, and answers to common questions.", about, current="about/")

# ---------------- BOOK ----------------
book = f"""
    <section class="page-hero" style="padding-bottom:40px">
      <div class="wrap reveal">
        <p class="eyebrow">Book a cleaning</p>
        <h1>Let’s get you <em>matched.</em></h1>
        <p class="lead">Tell us about your home and choose a time. We’ll confirm your cleaning professional shortly after.</p>
      </div>
    </section>
    <section style="padding-top:0">
      <div class="wrap">
        <div class="booking-shell"><iframe class="booking-frame" src="{BOOK_URL}?embed=true" title="Book a cleaning with Swify"></iframe></div>
        <p class="fine" style="text-align:center;margin-top:18px">Form not loading? <a href="{BOOK_URL}" target="_blank" rel="noopener">Open it in a new tab</a>.</p>
      </div>
    </section>
"""
page("book", "Book a Cleaning — Swify", "Request a home cleaning in Los Angeles through Swify.", book, current="book/")

# redirect old URLs
for old, new in [("pricing", "book/"), ("about-us", "about/")]:
    os.makedirs(os.path.join(ROOT, old), exist_ok=True)
    open(os.path.join(ROOT, old, "index.html"), "w").write(
        f'<!DOCTYPE html><html><head><meta charset="utf-8"><title>Redirecting…</title><meta http-equiv="refresh" content="0; url=../{new}"><link rel="canonical" href="../{new}"></head><body><a href="../{new}">Continue</a></body></html>\n'
    )
print("built")
