# Swify website

Website for Swify, a Los Angeles home-cleaning referral service. It's plain HTML/CSS/JS hosted free on GitHub Pages, with no Squarespace.

```
index.html                Home
add-ons/                  Add-ons: drag-to-explore canvas + list view
for-professionals/        Recruiting page for independent cleaning businesses
about/                    About, how we vet, FAQs
book/                     Booking (embedded BookingKoala form)
pricing/, about-us/       Redirects from the old Squarespace URLs
assets/css/style.css      All styles
assets/js/main.js         Header, mobile menu, scroll effects
assets/js/addons.js       Add-ons canvas
assets/img/addons/        Cut-out photos of each add-on
assets/fonts/             Cormorant Garamond + Manrope (self-hosted)
build.py                  Generates every page above
CHANGELOG.md              Append-only log of every change
```

## Editing

All page text lives in `build.py`. Change it there, run `python3 build.py`, and commit. Don't hand-edit the generated `index.html` files, because the next build overwrites them.

- **Add or change an add-on:** edit the `ADDONS` list in `build.py`. Add a cut-out image (transparent background, `.webp`) with the same key to `assets/img/addons/`.
- **Booking link:** `BOOK_URL` in `build.py`.
- Add a line to `CHANGELOG.md` for every change. Never edit old lines.

## Image credits

The add-on photos are from [Unsplash](https://unsplash.com) and are free to use under the Unsplash License. Backgrounds were removed for the site. The room photos come from the original Swify site.

## Going live on swifycleaning.com

GitHub Pages is on and the custom domain is set (`CNAME`). The remaining step is DNS, wherever the domain is registered:

- `A` records for `@` → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
- `CNAME` for `www` → `franchescabudiman.github.io`
- Remove the old Squarespace A/CNAME records.

Once GitHub's DNS check passes, tick **Enforce HTTPS** under Settings → Pages. Keep the domain renewing when you cancel the Squarespace website plan.
