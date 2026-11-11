# Swify booking backend

A Cloudflare Worker with a D1 database (both on Cloudflare's free plan) and Stripe Connect.

## How money moves (referral model)

- Each independent cleaning business **sets its own prices** in its private portal (`/pro/`). Swify can't edit them.
- The client sees each business's price, plus a separate **Swify booking fee** line.
- One Stripe Checkout payment. Using a Stripe *destination charge*, the business's **full price goes to its own Stripe account**, and Swify keeps only the booking fee (`application_fee_amount`).
- The business accepts or declines each paid booking. If it declines, the admin page refunds the client in full: the transfer is reversed and the booking fee is returned.

> Have a California employment lawyer review this setup and your contract with the businesses (Labor Code §2777) before going live.

## Pages

| Page | Who | What |
|---|---|---|
| `/book/new/` (or `/book/` once live) | Clients | Booking form → compare pros → Stripe Checkout |
| `/book/success/` | Clients | Confirmation |
| `/pro/#<private link>` | Each cleaning business | Set own rates, ZIPs and availability; connect Stripe; accept or decline |
| `/admin/` | Swify | Bookings and refunds, add or pause businesses, visual form builder, booking fee |

## One-time setup

1. **Stripe:** in the Dashboard, turn on **Connect** (choose *Platform / marketplace*, Express accounts). Use **Test mode** first.
2. **Cloudflare (free):**
   1. Create a D1 database named `swify` (Storage & Databases → D1). Copy its **Database ID** into `database_id` in `wrangler.toml`.
   2. Workers & Pages → Create → **Import a repository** → `franchescabudiman/swify`, root directory `worker`.
      - Deploy command: `npx wrangler d1 migrations apply swify --remote && npx wrangler deploy`
   3. Under the worker's Settings → Variables and Secrets, add these as **Secrets**:
      - `STRIPE_SECRET_KEY`: `sk_test_…` (later `sk_live_…`)
      - `ADMIN_PASSWORD`: at least 12 characters
      - `STRIPE_WEBHOOK_SECRET`: from step 3. If you add two endpoints, paste both secrets separated by a comma.
3. **Stripe webhooks** (Developers → Webhooks → Add endpoint), URL `https://<your-worker>.workers.dev/api/stripe/webhook`:
   - Endpoint 1, *your account* events: `checkout.session.completed`, `checkout.session.expired`
   - Endpoint 2 (optional), *connected accounts* events: `account.updated`. The portal also checks Stripe directly, so this one is a convenience.
4. Put the worker URL into `API_BASE` in `/build.py`, run `python3 build.py`, and push.

## Changing secrets (important)

Editing a secret or variable in the Cloudflare dashboard creates a new Worker **version** that is *not* deployed on its own: the old values keep running. After any change, go to Workers & Pages → swify-api → Deployments, open the newest version's **⋯ → Promote version**, and deploy it to 100%. (Or push any commit, which redeploys.)

## Going live

1. Run test bookings at `/book/new/` with Stripe test cards.
2. Switch Stripe to live keys and live webhook secrets.
3. Set `NEW_BOOKING_LIVE = True` in `build.py` and `BOOK_PATH = "/book/"` in `wrangler.toml`. Rebuild and push.

## Local development and tests

```bash
cd worker && npm install
cp .dev.vars.example .dev.vars              # local-only secrets, never committed
npx wrangler d1 migrations apply swify --local
WORKER_URL=http://127.0.0.1:8787 node test/mock-stripe.mjs &   # fake Stripe on :12111
npx wrangler dev --port 8787 --ip 127.0.0.1 &
(cd .. && python3 -m http.server 8768 &)
npm test                    # pricing unit tests
python3 test/e2e.py         # 30 end-to-end checks (Playwright)
```
