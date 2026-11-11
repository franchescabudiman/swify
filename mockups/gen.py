"""Generates home-page redesign mockups (temporary, not linked, noindex)."""
import os

U = "https://images.unsplash.com/"
def img(pid, w=2000, h=None):
    return f"{U}{pid}?w={w}{'&h='+str(h)+'&fit=crop' if h else ''}&q=80&auto=format"

P = {
    "stone": "photo-1791481708252-8bdee89a9ba3",     # stone sink, amber bottles
    "darkbed": "photo-1429117237875-aa29229d99f0",
    "sunbed": "photo-1779364867798-386fb7213a2c",
    "blush": "photo-1765371512612-86600e661f4d",
    "curtain": "photo-1753800558729-7929703f81de",
    "linen": "photo-1777506549593-c3c5ff0e581e",
    "copper": "photo-1781795035627-fa93f2863bba",
    "vase": "photo-1678121039070-fedd1e9c2cf4",
    "shadow": "photo-1781771760142-1b04201fa6d8",
    "stonebath": "photo-1763978485095-1cd13f4d3cb3",
    "bedwhite": "photo-1564019472231-4586c552dc27",
}
ADDONS = ["oven", "fridge", "dishes", "laundry", "linens", "window", "blinds", "cabinet", "walls", "baseboards", "organizing"]
marquee = "".join(f'<img src="../assets/img/addons/{k}.webp" alt="">' for k in ADDONS)

ADDON_SECTION = f"""
<section class="teaser" style="padding:120px 0 110px !important">
  <div class="wrap" style="display:flex;justify-content:space-between;align-items:end;gap:30px;flex-wrap:wrap">
    <div><p class="eyebrow">Add-ons</p><h2>The <em>finishing</em> touches.</h2></div>
    <a class="btn btn-line" href="#">Explore add-ons <span class="arr">→</span></a>
  </div>
  <div class="marquee" aria-hidden="true">{marquee}{marquee}</div>
</section>"""

BASE_CSS = """
main section, body > section{padding:0}
.m-nav{position:absolute;top:0;left:0;right:0;z-index:5;display:flex;align-items:center;justify-content:space-between;padding:30px 56px;}
.m-nav a{color:inherit;text-decoration:none}
.m-nav .links{display:flex;gap:40px;font-size:12px;letter-spacing:.2em;text-transform:uppercase}
.m-nav .brand{font-family:var(--serif);font-size:30px}
.m-foot{padding:46px 56px;display:flex;justify-content:space-between;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#8b8478;border-top:1px solid rgba(0,0,0,.08)}
"""

def nav(color):
    return f"""<nav class="m-nav" style="color:{color}"><a class="brand" href="#">Swify<span style="color:var(--gold)">.</span></a>
<div class="links"><a href="#">Add-ons</a><a href="#">Professionals</a><a href="#">About</a><a href="#">Book</a></div></nav>"""

FOOT = '<footer class="m-foot"><span>Swify · Los Angeles</span><span>Referral service · independent professionals</span></footer>'

def page(name, title, css, body):
    os.makedirs(name, exist_ok=True)
    open(f"{name}/index.html", "w").write(f"""<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>{title}</title><link rel="stylesheet" href="../../assets/css/style.css"><style>{BASE_CSS}{css}</style></head>
<body>{body.replace('../assets', '../../assets')}</body></html>""")

# ---------- A: Still life (cinematic full-bleed, almost no words) ----------
page("a", "Mockup A — Still life", """
.a-hero{position:relative;height:900px;color:#f5f1ea;overflow:hidden}
.a-hero img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:78% center}
.a-hero:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(20,16,12,.45),rgba(20,16,12,.05) 55%,rgba(20,16,12,.25))}
.a-hero .copy{position:absolute;left:56px;top:150px;z-index:2}
.a-hero h1{font-size:clamp(60px,7.4vw,116px);line-height:.92;font-weight:300}
.a-hero .row{display:flex;align-items:center;gap:34px;margin-top:38px;font-size:12px;letter-spacing:.22em;text-transform:uppercase}
.a-hero .btn{background:#f5f1ea;color:#1d1b19}
.a-tri{display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:18px;padding:18px}
.a-tri figure{margin:0;position:relative}.a-tri img{width:100%;height:640px;object-fit:cover;display:block}
.a-tri figcaption{position:absolute;left:24px;bottom:20px;color:#f5f1ea;font-family:var(--serif);font-size:38px;font-style:italic}
.a-cta{background:#1d1b19;color:#f5f1ea;text-align:center;padding:150px 20px}
.a-cta h2{font-size:clamp(54px,6vw,96px);font-weight:300}
""", nav("#f5f1ea") + f"""
<section class="a-hero"><img src="{img(P['stone'],2400)}" alt="">
  <div class="copy"><h1>Immaculate,<br><em>quietly.</em></h1>
  <div class="row"><a class="btn" href="#">Book a cleaning <span class="arr">→</span></a><span>Vetted independent professionals · Los Angeles</span></div></div></section>
<section class="a-tri">
  <figure><img src="{img(P['sunbed'],1200)}" alt=""><figcaption>Vetted.</figcaption></figure>
  <figure><img src="{img(P['copper'],900)}" alt=""><figcaption>Insured.</figcaption></figure>
  <figure><img src="{img(P['vase'],900)}" alt=""><figcaption>Effortless.</figcaption></figure>
</section>
{ADDON_SECTION}
<section class="a-cta"><h2>Come home to <em>clean.</em></h2><p style="margin-top:40px"><a class="btn" style="background:#f5f1ea;color:#1d1b19" href="#">Book a cleaning <span class="arr">→</span></a></p></section>
{FOOT}""")

# ---------- B: Editorial split (light, magazine) ----------
page("b", "Mockup B — Editorial", """
body{background:#f5f1ea}
.b-hero{display:grid;grid-template-columns:44% 56%;height:900px}
.b-hero .copy{display:flex;flex-direction:column;justify-content:flex-end;padding:0 56px 70px}
.b-hero h1{font-size:clamp(60px,6.6vw,112px);line-height:.95;font-weight:300}
.b-hero p.sub{margin:30px 0 40px;font-size:17px;color:#6f675c;max-width:30ch}
.b-hero .photo{position:relative}.b-hero .photo img{width:100%;height:100%;object-fit:cover;object-position:center 85%;display:block}
.b-hero .tag{position:absolute;right:28px;bottom:26px;color:#f5f1ea;font-size:11px;letter-spacing:.22em;text-transform:uppercase}
.b-full{position:relative;height:780px}
.b-full img{width:100%;height:100%;object-fit:cover;display:block}
.b-full h2{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);text-align:center;color:#f5f1ea;font-size:clamp(48px,5.6vw,92px);font-weight:300;text-shadow:0 2px 30px rgba(0,0,0,.25)}
.b-steps{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid rgba(0,0,0,.1);border-bottom:1px solid rgba(0,0,0,.1);margin:0 56px}
.b-steps div{padding:54px 34px;border-right:1px solid rgba(0,0,0,.1)}.b-steps div:last-child{border:0}
.b-steps b{display:block;font-family:var(--serif);font-weight:300;font-size:64px;color:#a8874f;line-height:1}
.b-steps span{display:block;margin-top:18px;font-family:var(--serif);font-size:30px}
.b-cta{display:grid;grid-template-columns:1fr 1fr;align-items:center;gap:0;margin-top:120px}
.b-cta img{width:100%;height:560px;object-fit:cover;display:block}
.b-cta div{padding:0 80px}.b-cta h2{font-size:clamp(48px,4.8vw,80px);font-weight:300;margin-bottom:36px}
""", nav("#1d1b19") + f"""
<section class="b-hero"><div class="copy"><p class="eyebrow">Home-care concierge · Los Angeles</p>
  <h1>The art of a<br><em>clean</em> home.</h1><p class="sub">Hand-selected, independent professionals — booked in minutes.</p>
  <p><a class="btn btn-ink" href="#">Book a cleaning <span class="arr">→</span></a></p></div>
  <div class="photo"><img src="{img(P['sunbed'],1800)}" alt=""><span class="tag">Silver Lake residence</span></div></section>
<section class="b-steps" style="margin-top:110px"><div><b>01</b><span>Tell us about your home</span></div><div><b>02</b><span>Choose your professional</span></div><div><b>03</b><span>Come home to clean</span></div></section>
{ADDON_SECTION}
<section class="b-full"><img src="{img(P['stonebath'],2400)}" alt=""><h2>Only the <em>finest</em> make the list.</h2></section>
<section class="b-cta"><img src="{img(P['linen'],1400)}" alt=""><div><h2>Come home<br>to <em>clean.</em></h2><a class="btn btn-ink" href="#">Book a cleaning <span class="arr">→</span></a></div></section>
<div style="height:110px"></div>{FOOT}""")

# ---------- C: Gallery (dark, framed, wordmark) ----------
page("c", "Mockup C — Gallery", """
body{background:#161412;color:#efe9df}
.c-hero{min-height:900px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:96px 56px 50px;text-align:center}
.c-hero .word{font-family:var(--serif);font-weight:300;font-size:clamp(80px,11vw,170px);letter-spacing:.14em;line-height:.85;margin-right:-.14em}
.c-hero .frame{margin:44px auto 0;width:min(1040px,80vw);aspect-ratio:16/6.4;overflow:hidden;outline:1px solid rgba(168,135,79,.6);outline-offset:14px}
.c-hero .frame img{width:100%;height:100%;object-fit:cover;display:block}
.c-hero .line{margin-top:44px;display:flex;gap:42px;align-items:center;font-size:12px;letter-spacing:.24em;text-transform:uppercase;color:#b9b0a2}
.c-hero .btn{background:#efe9df;color:#161412}
.c-gal{display:grid;grid-template-columns:2fr 1fr 1fr;grid-template-rows:330px 330px;gap:14px;padding:14px 56px 120px}
.c-gal img{width:100%;height:100%;object-fit:cover;display:block}
.c-gal .tall{grid-row:span 2}
.c-q{text-align:center;padding:40px 20px 130px}.c-q h2{font-size:clamp(46px,5vw,84px);font-weight:300}
.c-light{background:#f5f1ea;color:#1d1b19}
.m-foot{border-color:rgba(255,255,255,.1)}
""", nav("#efe9df") + f"""
<section class="c-hero"><div class="word">SWIFY</div>
  <div class="frame"><img src="{img(P['blush'],2000,1000)}" alt=""></div>
  <div class="line"><span>Home-care concierge</span><a class="btn" href="#">Book a cleaning <span class="arr">→</span></a><span>Los Angeles</span></div></section>
<section class="c-q"><h2>Hand-selected. <em>Never</em> crowdsourced.</h2></section>
<section class="c-gal"><img class="tall" src="{img(P['darkbed'],1600)}" alt=""><img src="{img(P['stone'],900)}" alt=""><img src="{img(P['curtain'],900)}" alt=""><img src="{img(P['copper'],900)}" alt=""><img src="{img(P['vase'],900)}" alt=""></section>
<div class="c-light">{ADDON_SECTION}</div>
<section class="c-q" style="padding-top:130px"><h2>Come home to <em>clean.</em></h2><p style="margin-top:40px"><a class="btn" style="background:#efe9df;color:#161412" href="#">Book a cleaning <span class="arr">→</span></a></p></section>
{FOOT}""")
print("ok")
