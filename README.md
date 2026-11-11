# Swify Cleaning website

Static rebuild of swifycleaning.com: plain HTML/CSS with no build step, so it can be hosted for free on GitHub Pages instead of Squarespace.

```
index.html            Home
about-us/index.html   About Us + FAQs
pricing/index.html    Pricing / booking (embedded BookingKoala form)
assets/css/style.css  All styles
assets/js/main.js     Mobile menu
assets/img/           Images
assets/fonts/         Poppins + Urbanist (self-hosted)
CHANGELOG.md          Append-only log of every change
```

To edit text, open the page's `index.html` on GitHub, click the pencil icon, change the words and commit. Add a line to `CHANGELOG.md` describing the change.

## Going live

1. **Turn on GitHub Pages:** go to Settings → Pages, set Source to "Deploy from a branch", choose `main` / `(root)` and save. The site appears at `https://franchescabudiman.github.io/swify/` within a minute or two. On a free GitHub plan the repo has to be public for this.
2. **Connect the domain:** in Settings → Pages → Custom domain, enter `www.swifycleaning.com` and save. GitHub adds a `CNAME` file to the repo.
3. **Update DNS** wherever swifycleaning.com is registered (Squarespace Domains, if the domain was bought there):
   - `A` records for `@` → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `CNAME` for `www` → `franchescabudiman.github.io`
   - Remove the old Squarespace A/CNAME records.
4. Once the domain shows as verified, tick **Enforce HTTPS**.
5. **Before cancelling Squarespace:** if the domain itself is registered through Squarespace, cancelling the *website* plan is separate from the *domain*. Keep the domain renewing (or transfer it to another registrar) so swifycleaning.com doesn't lapse.

Booking, payments and customer accounts all live in BookingKoala, so nothing about bookings changes.
