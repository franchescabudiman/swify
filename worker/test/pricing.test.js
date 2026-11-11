import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_FORM as F, validateForm, validateRates, validateAnswers, validateContact, quoteFor } from '../src/pricing.js';

const today = new Date('2026-11-11T10:00:00Z');
const answers = { service: 'standard', size: '2bd', bathrooms: 2, frequency: 'once', addons: ['oven'], zip: '90012', date: '2026-11-14', window: 'morning', custom: { entry: 'Someone will be home' } };
const rates = validateRates({ accepting: true, base: { standard: { '2bd': 12000 } }, extraBathroom: 2500, addons: { oven: 3500 }, frequencyDiscount: { weekly: 15 }, minimum: 9000 }, F);
const prov = { zips: ['90012'] };

test('provider price is paid in full; Swify fee is separate and charged to client', () => {
  const a = validateAnswers(answers, F, today);
  const q = quoteFor(prov, rates, a, F);
  assert.equal(q.providerAmount, 12000 + 2500 + 3500);            // provider's own rate, no deduction
  assert.equal(q.fee, Math.round(500 + 18000 * 0.05));             // $5 + 5%
  assert.equal(q.total, q.providerAmount + q.fee);
});

test('provider recurring discount applies to provider price only', () => {
  const a = validateAnswers({ ...answers, frequency: 'weekly', addons: [] }, F, today);
  const q = quoteFor(prov, rates, a, F);
  assert.equal(q.providerAmount, Math.round(14500 * 0.85));
});

test('provider minimum is enforced', () => {
  const r = validateRates({ accepting: true, base: { standard: { '2bd': 5000 } }, minimum: 9000 }, F);
  const a = validateAnswers({ ...answers, bathrooms: 1, addons: [] }, F, today);
  assert.equal(quoteFor(prov, r, a, F).providerAmount, 9000);
});

test('ineligible: add-on not offered, ZIP not served, not accepting, size not priced', () => {
  const a = validateAnswers({ ...answers, addons: ['laundry'] }, F, today);
  assert.equal(quoteFor(prov, rates, a, F), null);
  assert.equal(quoteFor({ zips: ['90210'] }, rates, validateAnswers(answers, F, today), F), null);
  assert.equal(quoteFor(prov, { ...rates, accepting: false }, validateAnswers(answers, F, today), F), null);
  assert.equal(quoteFor(prov, rates, validateAnswers({ ...answers, size: '3bd' }, F, today), F), null);
});

test('answers validation: dates, required questions, unknown values', () => {
  assert.throws(() => validateAnswers({ ...answers, date: '2026-11-11' }, F, today), /between/);
  assert.throws(() => validateAnswers({ ...answers, custom: {} }, F, today), /How will the pro get in/);
  assert.throws(() => validateAnswers({ ...answers, addons: ['spaceship'] }, F, today), /Unknown add-on/);
  assert.throws(() => validateAnswers({ ...answers, zip: '9001' }, F, today), /ZIP/);
});

test('rates & form validation reject bad input', () => {
  assert.throws(() => validateRates({ base: { standard: { '2bd': 12.5 } } }, F), /cents/);
  assert.throws(() => validateRates({ frequencyDiscount: { weekly: 80 } }, F), /0–50/);
  assert.throws(() => validateForm({ ...F, services: [{ id: 'Bad Id', name: 'x' }] }), /invalid id/);
  assert.throws(() => validateForm({ ...F, sizes: [{ id: 'a', label: 'A' }, { id: 'a', label: 'B' }] }), /duplicate/);
  assert.deepEqual(validateForm(F).services.length, 3);
});

test('contact validation', () => {
  assert.throws(() => validateContact({ name: 'A', email: 'x', phone: '1', address: '' }), /name/);
  const c = validateContact({ name: 'Ana Ruiz', email: 'ANA@Example.com', phone: '(213) 555-0100', address: '100 Main St' });
  assert.equal(c.email, 'ana@example.com');
});
