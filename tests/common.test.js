const test = require('node:test');
const assert = require('node:assert');
const FL = require('../src/lib/common.js');

test('normalizeSite', () => {
  assert.equal(FL.normalizeSite('https://www.Reddit.com/r/x'), 'reddit.com');
  assert.equal(FL.normalizeSite('*.reddit.com'), 'reddit.com');
  assert.equal(FL.normalizeSite('  news.ycombinator.com '), 'news.ycombinator.com');
  assert.equal(FL.normalizeSite('not a site!'), '');
  assert.equal(FL.normalizeSite(''), '');
});

test('findSite matches subdomains, not lookalikes', () => {
  const sites = ['reddit.com', 'old.reddit.com'];
  assert.equal(FL.findSite('https://www.reddit.com/', sites), 'reddit.com');
  assert.equal(FL.findSite('https://old.reddit.com/', sites), 'old.reddit.com');
  assert.equal(FL.findSite('https://notreddit.com/', sites), null);
  assert.equal(FL.findSite('https://reddit.com.evil.org/', sites), null);
  assert.equal(FL.findSite('about:blank', sites), null);
});

test('computeSeconds', () => {
  const s = FL.sanitizeSettings({});
  assert.equal(s.baseSeconds, 15);
  assert.equal(s.incrementSeconds, 3);
  assert.equal(FL.computeSeconds(s, 5), 15);            // escalation off
  const e = { ...s, escalate: true };
  assert.equal(FL.computeSeconds(e, 0), 15);
  assert.equal(FL.computeSeconds(e, 1), 18);
  assert.equal(FL.computeSeconds(e, 4), 27);
  assert.equal(FL.computeSeconds({ ...e, maxSeconds: 20 }, 10), 20);
  assert.equal(FL.computeSeconds({ ...e, maxSeconds: 5 }, 10), 15); // cap never below base
});

test('sanitizeSettings clamps junk', () => {
  const s = FL.sanitizeSettings({ baseSeconds: 'abc', incrementSeconds: -4, sites: ['Reddit.com', '', '!!'] });
  assert.equal(s.baseSeconds, 15);
  assert.equal(s.incrementSeconds, 0);
  assert.deepEqual(s.sites, ['reddit.com']);
});

test('isActive follows the default 9-12 / 13-17 schedule', () => {
  const s = FL.sanitizeSettings({});
  const at = (h, m = 0) => FL.isActive(s, new Date(2026, 0, 5, h, m));
  assert.equal(at(8, 59), false);
  assert.equal(at(9), true);
  assert.equal(at(11, 59), true);
  assert.equal(at(12), false);
  assert.equal(at(12, 59), false);
  assert.equal(at(13), true);
  assert.equal(at(16, 59), true);
  assert.equal(at(17), false);
  assert.equal(FL.isActive({ ...s, scheduleEnabled: false }, new Date(2026, 0, 5, 3)), true);
});

test('isActive supports ranges past midnight and empty ranges', () => {
  const s = { ...FL.sanitizeSettings({}), hours: [{ start: 22 * 60, end: 2 * 60 }] };
  assert.equal(FL.isActive(s, new Date(2026, 0, 5, 23)), true);
  assert.equal(FL.isActive(s, new Date(2026, 0, 5, 1)), true);
  assert.equal(FL.isActive(s, new Date(2026, 0, 5, 12)), false);
  assert.equal(FL.isActive({ ...s, hours: [] }, new Date(2026, 0, 5, 12)), false);
});

test('time helpers and hours sanitising', () => {
  assert.equal(FL.minutesToTime(13 * 60 + 5), '13:05');
  assert.equal(FL.timeToMinutes('09:30'), 570);
  assert.equal(FL.timeToMinutes(''), -1);
  assert.deepEqual(FL.sanitizeSettings({ hours: [{ start: 60, end: 60 }, { start: 'x' }, { start: 60, end: 120 }] }).hours, [{ start: 60, end: 120 }]);
});
