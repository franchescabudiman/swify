# Changelog

This log is **append-only**. Entries are never edited or deleted.
If something changes later, a new entry is added at the bottom describing the change, and it may reference an earlier entry by its number (e.g. "updates #3").

Timestamps are in UTC.

| # | Timestamp (UTC) | Change |
|---|-----------------|--------|
| 1 | 2026-11-11 03:31 | Cloned empty repo `franchescabudiman/swify` to host a static replacement for the Squarespace site at swifycleaning.com. |
| 2 | 2026-11-11 03:34 | Captured content from the live site: Home, About Us and Pricing pages. Found that booking/pricing runs on an embedded BookingKoala form (`https://swify.bookingkoala.com/booknow?embed=true`), which the new site keeps using as is. |
| 3 | 2026-11-11 03:37 | Added `index.html` (Home): header with logo, Home / About Us / Pricing / Instagram / Book Now; hero "House Cleaning in Los Angeles — starting at $59" with Get Clean! button; How we work (Booking → Cleaning → Review); Our Services (One-time, Subscription); Residential Cleaning checklists (general, Kitchen, Bathroom, Add-ons); footer with admin@swifycleaning.com. All text copied word-for-word from the live site. |
| 4 | 2026-11-11 03:37 | Added `assets/css/style.css` (layout, colors, buttons, responsive/mobile styles) and `assets/js/main.js` (mobile menu toggle). |
| 5 | 2026-11-11 03:38 | Added `about-us/index.html` (About, Our Mission, 5 FAQs as open/close accordions) and `pricing/index.html` (House Cleaning Prices + embedded BookingKoala booking form, with an "open in a new tab" fallback link). Folder URLs match the old site (`/about-us`, `/pricing`). |
| 6 | 2026-11-11 03:41 | Added 17 images to `assets/img/` (logo, hero, step illustrations, service icons, room photos, footer logo, social share image), downloaded from the Squarespace CDN so the site no longer depends on Squarespace. |
| 7 | 2026-11-11 03:42 | Self-hosted the Poppins and Urbanist fonts in `assets/fonts/` (SIL Open Font License) and removed the Google Fonts links from all pages (changes the font loading set up in #3 and #5). Added `.nojekyll` for GitHub Pages. |
| 8 | 2026-11-11 03:43 | Tested all 3 pages at desktop (1440px) and mobile (390px): every image loads, every internal link returns 200, fonts load, no sideways scrolling, mobile menu opens and navigates, FAQ accordion opens. |
| 9 | 2026-11-11 03:44 | Fixed mobile order of the Residential Cleaning section on Home (from #3): the Kitchen list was showing below Bathroom. Each photo is now grouped with its own checklist so the order is right on phones. Re-ran the tests from #8; all passed. |
| 10 | 2026-11-11 03:45 | Added `README.md` with how to go live on GitHub Pages and point swifycleaning.com at it. |
| 11 | 2026-11-11 04:16 | Changed the GitHub repo from private to public (approved by owner) so it can use free GitHub Pages hosting. |
| 12 | 2026-11-11 04:18 | Turned on GitHub Pages (source: `main` branch, `/ (root)` folder). First deploy succeeded; site is live at https://franchescabudiman.github.io/swify/ . The custom domain swifycleaning.com is not connected yet (see README "Going live" steps 2–4). |
| 13 | 2026-11-11 04:21 | Tested the live site: all images and fonts load, the mobile menu works, and the BookingKoala form on Pricing loads and displays correctly ("Get Pricing & Book In 60 Seconds" → Home Cleaning). This confirms the booking embed from #5, which couldn't be tested in #8. |
| 14 | 2026-11-11 04:25 | Set the GitHub Pages custom domain to `www.swifycleaning.com` (README step 2). GitHub added a `CNAME` file to the repo. The DNS check is pending: the domain still points to Squarespace until its DNS records are changed (README step 3), so the site keeps showing the Squarespace version until then. Enforce HTTPS can only be turned on after DNS is switched. |
