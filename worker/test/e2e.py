"""End-to-end test: admin -> provider onboarding & own rates -> client booking -> mock Stripe -> webhook -> accept/decline -> refund.
Run with the site on :8768, the worker on :8787 (wrangler dev) and mock Stripe on :12111."""
import asyncio, json, re, datetime, urllib.request
from playwright.async_api import async_playwright, expect

SITE, API, MOCK = 'http://localhost:8768', 'http://127.0.0.1:8787', 'http://localhost:12111'
PW = 'local-admin-password-123'
SHOTS = '/home/claude/shots3'
results = []
def ok(name, cond, detail=''):
    results.append((name, bool(cond), detail)); print(('PASS ' if cond else 'FAIL ') + name + (' — ' + str(detail) if detail and not cond else ''))
def http(method, path, body=None, headers=None, base=API):
    req = urllib.request.Request(base + path, method=method, data=json.dumps(body).encode() if body is not None else None, headers={'Content-Type': 'application/json', **(headers or {})})
    try:
        with urllib.request.urlopen(req) as r: return r.status, json.loads(r.read() or b'{}'), dict(r.headers)
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b'{}'), dict(e.headers)

async def main():
    import os; os.makedirs(SHOTS, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome')
        ctx = await b.new_context(viewport={'width': 1440, 'height': 1000})
        pg = await ctx.new_page()
        errors = []
        pg.on('pageerror', lambda e: errors.append(str(e)))

        # ---------- 1. admin: sign in, add two independent businesses ----------
        await pg.goto(f'{SITE}/admin/?api={API}')
        await pg.fill('#pw', 'wrong-password-xyz'); await pg.click('#loginForm button')
        await expect(pg.locator('.err')).to_contain_text('Wrong password'); ok('admin rejects wrong password', True)
        await pg.fill('#pw', PW); await pg.click('#loginForm button')
        await expect(pg.locator('h1')).to_have_text('Dashboard'); ok('admin signs in', True)
        await pg.click('button[data-tab=providers]')
        links = {}
        for name, legal, email, zips in [('Golden Hour Cleaning', 'Golden Hour Cleaning LLC', 'hello@goldenhour.test', '90012, 90026'), ('Silver Lake Home Care', 'SLHC LLC', 'team@slhc.test', '90012')]:
            await pg.fill('#np_business_name', name); await pg.fill('#np_legal_name', legal); await pg.fill('#np_email', email)
            await pg.fill('#np_phone', '2135550100'); await pg.fill('#np_license_no', 'BTRC-' + email[:4]); await pg.fill('#np_insurance_expires', '2027-06-30'); await pg.fill('#np_zips', zips)
            await pg.click('#addPro button'); await expect(pg.locator('.ok-msg b')).to_contain_text(name)
            links[name] = await pg.input_value('#linkOut')
        ok('admin creates providers + one-time portal links', all('/pro/#' in v for v in links.values()), links)
        await pg.screenshot(path=f'{SHOTS}/admin-providers.png', full_page=True)

        # ---------- 2. each provider sets ITS OWN rates and connects Stripe ----------
        rate_cards = {
            'Golden Hour Cleaning': {'base': {('standard', '2bd'): '140', ('deep', '2bd'): '240'}, 'bath': '25', 'min': '100', 'addons': {'oven': '35', 'fridge': '30', 'laundry': '25'}, 'weekly': '15'},
            'Silver Lake Home Care': {'base': {('standard', '2bd'): '120'}, 'bath': '20', 'min': '0', 'addons': {'oven': '40'}, 'weekly': '10'},
        }
        for name, rc in rate_cards.items():
            await pg.goto(links[name].replace('/pro/#', f'/pro/?api={API}#'))
            await expect(pg.locator('h1')).to_have_text(name)
            await pg.click('button[data-tab=rates]')
            await pg.check('#r_accepting')
            for (svc, size), v in rc['base'].items(): await pg.fill(f'[data-base="{svc}|{size}"]', v)
            await pg.fill('#r_bath', rc['bath']); await pg.fill('#r_min', rc['min'])
            for a, v in rc['addons'].items(): await pg.fill(f'[data-addon="{a}"]', v)
            await pg.fill('[data-freq="weekly"]', rc['weekly'])
            await pg.click('#saveRates'); await expect(pg.locator('.ok-msg')).to_contain_text('Saved')
            if name == 'Golden Hour Cleaning': await pg.screenshot(path=f'{SHOTS}/pro-rates.png', full_page=True)
            await pg.click('button[data-tab=payouts]'); await pg.click('#stripeBtn')
            await pg.wait_for_url(re.compile(r'/pro/\?stripe=done')); await expect(pg.locator('.ok-msg')).to_contain_text('Stripe is connected')
        ok('providers set own rates + complete Stripe Connect onboarding', True)
        st, prov, _ = http('GET', '/api/admin/providers', headers={'Authorization': 'Bearer ' + PW})
        accts = {x['business_name']: x['stripe_account'] for x in prov['providers']}
        ok('providers marked ready (charges_enabled via account.updated webhook)', all(x['charges_enabled'] for x in prov['providers']))

        # ---------- 3. admin edits the form in the visual builder ----------
        await pg.goto(f'{SITE}/admin/?api={API}'); await pg.click('button[data-tab=builder]')
        await pg.click('button[data-add=questions]')
        rows = pg.locator('.builder-row:has([data-k=questions])'); last = rows.last
        await last.locator('[data-f=id]').fill('parking'); await last.locator('[data-f=label]').fill('Where should the pro park?')
        await pg.fill('#f_flat', '6'); await pg.fill('#f_pct', '5')
        await pg.click('#saveForm'); await expect(pg.locator('.ok-msg')).to_contain_text('Published')
        await pg.screenshot(path=f'{SHOTS}/admin-builder.png', full_page=True)
        st, f, _ = http('GET', '/api/form')
        ok('form builder publishes new question + fee', any(q['id'] == 'parking' for q in f['form']['questions']) and f['form']['bookingFee']['flat'] == 600)

        # ---------- 4. client books (oven add-on preselected from add-ons page) ----------
        date = (datetime.date.today() + datetime.timedelta(days=3)).isoformat()
        await pg.goto(f'{SITE}/book/new/?addon=oven&api={API}')
        await expect(pg.locator('.steps-nav li.on')).to_contain_text('Your home')
        await pg.click('text=Continue'); await expect(pg.locator('.err')).to_contain_text('home size'); ok('step validation blocks missing size', True)
        await pg.click('label.choice:has-text("2 bedrooms")'); await pg.click('[data-bath="1"]')
        await pg.screenshot(path=f'{SHOTS}/book-1-home.png', full_page=True)
        await pg.click('text=Continue')
        ok('oven add-on preselected', await pg.is_checked('input[name=addon][value=oven]'))
        await pg.screenshot(path=f'{SHOTS}/book-2-addons.png', full_page=True)
        await pg.click('text=Continue')
        await pg.fill('#zip', '90012'); await pg.fill('#date', date); await pg.locator('#date').dispatch_event('change')
        await pg.click('label.choice:has-text("Morning")'); await pg.select_option('#q_entry', 'Lockbox / key code')
        await pg.fill('#q_parking', 'Street parking on Main')
        await pg.screenshot(path=f'{SHOTS}/book-3-when.png', full_page=True)
        await pg.click('text=Continue')
        await pg.wait_for_timeout(1200)
        if await pg.locator('.pro-card').count() != 2: print('DEBUG panel:', await pg.inner_text('.bk .panel'))
        await expect(pg.locator('.pro-card')).to_have_count(2)
        cards = await pg.locator('.pro-card .top').all_inner_texts()
        # Silver Lake: 120 + 20 (bath) + 40 oven = 180 ; fee 6 + 9 = 15 -> 195
        # Golden Hour: 140 + 25 + 35 = 200 ; fee 6 + 10 = 16 -> 216
        ok('quotes use each provider\'s own prices + separate Swify fee, cheapest first', 'Silver Lake' in cards[0] and '$195' in cards[0] and '$216' in cards[1], cards)
        await pg.screenshot(path=f'{SHOTS}/book-4-pros.png', full_page=True)
        await pg.click('label.pro-card:has-text("Golden Hour")')
        await pg.click('text=Continue')
        await pg.fill('#c_name', 'Ana Ruiz'); await pg.fill('#c_phone', '(213) 555-0199'); await pg.fill('#c_email', 'ana@example.test'); await pg.fill('#c_address', '100 N Main St'); await pg.fill('#c_unit', '4B')
        await pg.click('#pay'); await expect(pg.locator('.err')).to_contain_text('confirm'); ok('terms checkbox required', True)
        await pg.check('#agree'); await pg.screenshot(path=f'{SHOTS}/book-5-details.png', full_page=True)
        await pg.click('#pay')
        await pg.wait_for_url(re.compile(r'localhost:12111/pay/'))
        ok('redirected to (mock) Stripe Checkout', True)
        await pg.click('#pay')
        await pg.wait_for_url(re.compile(r'/book/success/\?session_id='))
        await expect(pg.locator('#result h1')).to_contain_text("you're booked")
        await pg.screenshot(path=f'{SHOTS}/book-6-success.png', full_page=True)
        ok('success page confirms paid booking', 'Golden Hour' in await pg.inner_text('#result'))

        # ---------- 5. what was sent to Stripe ----------
        log = json.loads(urllib.request.urlopen(MOCK + '/__log').read())
        cs = [x for x in log['log'] if x.get('path') == '/v1/checkout/sessions'][-1]['params']
        pi = cs['payment_intent_data']
        ok('Stripe: provider line = provider\'s full price ($200)', cs['line_items']['0']['price_data']['unit_amount'] == '20000', cs['line_items'])
        ok('Stripe: Swify fee is its own line ($16) paid by client', cs['line_items']['1']['price_data']['unit_amount'] == '1600' and 'Swify booking fee' in cs['line_items']['1']['price_data']['product_data']['name'])
        ok('Stripe: destination charge to provider account, Swify keeps only the fee', pi['transfer_data']['destination'] == accts['Golden Hour Cleaning'] and pi['application_fee_amount'] == '1600' and pi['on_behalf_of'] == accts['Golden Hour Cleaning'], pi)
        ok('Stripe: webhook accepted', any(x.get('webhook') == 'checkout.session.completed' and x['status'] == 200 for x in log['log']))

        # ---------- 6. provider accepts; client details revealed only after accepting ----------
        await pg.goto(links['Golden Hour Cleaning'].replace('/pro/#', f'/pro/?api={API}#'))
        await expect(pg.locator('.tag-s:has-text("New request")')).to_have_count(1)
        before = await pg.inner_text('table')
        ok('client address hidden before accepting', '100 N Main St' not in before and 'shown after you accept' in before)
        await pg.click('button[data-act=accept]'); await expect(pg.locator('.ok-msg')).to_contain_text('Accepted')
        after = await pg.inner_text('table')
        ok('client details shown after accepting', '100 N Main St' in after and 'ana@example.test' in after and 'Street parking on Main' in after)
        await pg.screenshot(path=f'{SHOTS}/pro-bookings.png', full_page=True)

        # ---------- 7. second booking: provider declines -> admin refunds in full ----------
        st, q, _ = http('POST', '/api/quote', {'answers': {'service': 'standard', 'size': '2bd', 'bathrooms': 1, 'frequency': 'weekly', 'addons': [], 'zip': '90012', 'date': date, 'window': 'midday', 'custom': {'entry': 'Someone will be home'}}})
        sl = [x for x in q['quotes'] if x['provider']['name'] == 'Silver Lake Home Care'][0]
        ok('provider\'s own weekly discount applied (120 -10% = 108)', sl['providerAmount'] == 10800, sl)
        body = {'answers': q['answers'], 'contact': {'name': 'Ben Ko', 'email': 'ben@example.test', 'phone': '2135550111', 'address': '200 Spring St'}, 'providerId': sl['provider']['id'], 'expectedTotal': sl['total'], 'agree': True}
        st, tam, _ = http('POST', '/api/checkout', {**body, 'expectedTotal': 100}); ok('tampered price rejected (409)', st == 409, (st, tam))
        st, co, _ = http('POST', '/api/checkout', body); ok('checkout via API', st == 200, co)
        sid = co['url'].split('/pay/')[1]
        urllib.request.urlopen(urllib.request.Request(MOCK + '/pay/' + sid, method='POST', data=b''))
        await pg.goto(links['Silver Lake Home Care'].replace('/pro/#', f'/pro/?api={API}#'))
        await pg.click('button[data-act=decline]'); await pg.click('button[data-act=decline]')
        await expect(pg.locator('.ok-msg')).to_contain_text('Declined')
        await pg.goto(f'{SITE}/admin/?api={API}')
        await expect(pg.locator('.tag-s:has-text("Declined")')).to_have_count(1)
        await pg.screenshot(path=f'{SHOTS}/admin-bookings.png', full_page=True)
        await pg.click('button[data-refund]'); await pg.click('button[data-refund]')
        await expect(pg.locator('.ok-msg')).to_contain_text('Refunded')
        log = json.loads(urllib.request.urlopen(MOCK + '/__log').read())
        rf = [x for x in log['log'] if x.get('path') == '/v1/refunds'][-1]['params']
        ok('refund reverses provider transfer + returns Swify fee', rf.get('reverse_transfer') == 'true' and rf.get('refund_application_fee') == 'true', rf)

        # ---------- 8. security ----------
        import hmac, hashlib, time
        payload = json.dumps({'type': 'checkout.session.completed', 'data': {'object': {'payment_status': 'paid', 'metadata': {'booking_id': 'x'}}}})
        st, _, _ = http('POST', '/api/stripe/webhook', None, {'Stripe-Signature': 't=%d,v1=deadbeef' % time.time()}); ok('webhook with bad signature rejected', st == 400)
        st, _, _ = http('GET', '/api/admin/bookings', headers={'Authorization': 'Bearer nope-nope-nope'}); ok('admin API rejects wrong password', st == 401)
        st, _, _ = http('GET', '/api/pro/me', headers={'Authorization': 'Bearer ' + 'x' * 43}); ok('provider API rejects invalid link', st == 401)
        gh_tok = links['Golden Hour Cleaning'].split('#')[1]
        st, bk, _ = http('GET', '/api/admin/bookings', headers={'Authorization': 'Bearer ' + PW})
        other = [x for x in bk['bookings'] if x['contact']['name'] == 'Ben Ko'][0]['id']
        st, _, _ = http('POST', f'/api/pro/bookings/{other}/accept', {}, {'Authorization': 'Bearer ' + gh_tok}); ok("provider can't act on another provider's booking", st == 404)
        st, _, h = http('GET', '/api/form', headers={'Origin': 'https://evil.example'}); ok('CORS blocks unknown origins', 'Access-Control-Allow-Origin' not in h)
        st, _, _ = http('PUT', '/api/pro/rates', {'rates': {'base': {'standard': {'2bd': -5}}}}, {'Authorization': 'Bearer ' + gh_tok}); ok('negative prices rejected', st == 400)
        ok('no JavaScript errors on any page', not errors, errors)

        # ---------- 9. mobile ----------
        m = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
        mp = await m.new_page()
        await mp.goto(f'{SITE}/book/new/?api={API}'); await mp.wait_for_selector('.choice')
        await mp.screenshot(path=f'{SHOTS}/mobile-book.png', full_page=True)
        ok('mobile: no sideways scroll on booking page', not await mp.evaluate('document.documentElement.scrollWidth > innerWidth + 1'))
        await b.close()
    fails = [r for r in results if not r[1]]
    print(f'\n{len(results) - len(fails)}/{len(results)} checks passed')
asyncio.run(main())
