/* Shared logic (background, options, interstitial, tests). Plain script, no modules. */
const FL = (() => {
  const DEFAULTS = {
    sites: [],            // normalized hostnames, e.g. "reddit.com" (matches subdomains too)
    baseSeconds: 15,      // countdown for the first open of the day
    escalate: false,      // add incrementSeconds for every open already made today
    incrementSeconds: 3,
    maxSeconds: 0,        // 0 = no cap on escalated countdown
    graceMinutes: 5,      // free browsing for the site after a countdown; 0 = every navigation
    reblockOpen: true,    // when the grace period ends, send already-open tabs back to the countdown
    scheduleEnabled: true,  // only apply during the hour ranges below
    hours: [              // minutes since local midnight; end < start wraps past midnight
      { start: 9 * 60, end: 12 * 60 },
      { start: 13 * 60, end: 17 * 60 }
    ]
  };

  function int(value, fallback, min = 0, max = 86400) {
    const n = Math.round(Number(value));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  }

  function sanitizeSettings(raw) {
    const s = { ...DEFAULTS, ...(raw || {}) };
    return {
      sites: Array.isArray(s.sites) ? s.sites.map(normalizeSite).filter(Boolean) : [],
      baseSeconds: int(s.baseSeconds, DEFAULTS.baseSeconds),
      escalate: Boolean(s.escalate),
      incrementSeconds: int(s.incrementSeconds, DEFAULTS.incrementSeconds),
      maxSeconds: int(s.maxSeconds, DEFAULTS.maxSeconds),
      graceMinutes: int(s.graceMinutes, DEFAULTS.graceMinutes, 0, 1440),
      reblockOpen: Boolean(s.reblockOpen),
      scheduleEnabled: Boolean(s.scheduleEnabled),
      hours: sanitizeHours(s.hours)
    };
  }

  function sanitizeHours(raw) {
    if (!Array.isArray(raw)) return DEFAULTS.hours.map((r) => ({ ...r }));
    return raw
      .map((r) => ({ start: int(r && r.start, -1, -1, 1439), end: int(r && r.end, -1, -1, 1439) }))
      .filter((r) => r.start >= 0 && r.end >= 0 && r.start !== r.end);
  }

  /** Is the friction layer on at this moment? (always, unless a schedule is enabled) */
  function isActive(settings, date = new Date()) {
    if (!settings.scheduleEnabled) return true;
    const m = date.getHours() * 60 + date.getMinutes();
    return settings.hours.some((r) => (r.start < r.end ? m >= r.start && m < r.end : m >= r.start || m < r.end));
  }

  const timeToMinutes = (t) => {
    const m = /^(\d{1,2}):(\d{2})/.exec(t || '');
    return m ? Math.min(1439, Number(m[1]) * 60 + Number(m[2])) : -1;
  };
  const minutesToTime = (n) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;

  /** "https://www.Reddit.com/r/x", "*.reddit.com", "reddit.com" -> "reddit.com"; "" if invalid. */
  function normalizeSite(input) {
    let s = String(input || '').trim().toLowerCase().replace(/^\*\./, '');
    if (!s) return '';
    try {
      s = new URL(/^[a-z][a-z0-9+.-]*:\/\//.test(s) ? s : 'http://' + s).hostname;
    } catch (e) {
      return '';
    }
    s = s.replace(/^www\./, '').replace(/\.$/, '');
    return /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(s) ? s : '';
  }

  /** Returns the configured site matching the URL (longest match wins), or null. */
  function findSite(url, sites) {
    let host;
    try {
      const u = new URL(url);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
      host = u.hostname.toLowerCase().replace(/\.$/, '');
    } catch (e) {
      return null;
    }
    let best = null;
    for (const site of sites) {
      if ((host === site || host.endsWith('.' + site)) && (!best || site.length > best.length)) best = site;
    }
    return best;
  }

  /** Countdown length given how many times the site was already opened today. */
  function computeSeconds(settings, opensToday) {
    let total = settings.baseSeconds;
    if (settings.escalate) total += settings.incrementSeconds * Math.max(0, opensToday);
    if (settings.maxSeconds > 0) total = Math.min(total, Math.max(settings.maxSeconds, settings.baseSeconds));
    return total;
  }

  /** Local calendar day, so "per day" resets at local midnight. */
  function dayKey(date = new Date()) {
    const p = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
  }

  return { DEFAULTS, sanitizeSettings, normalizeSite, findSite, computeSeconds, dayKey, isActive, timeToMinutes, minutesToTime };
})();

if (typeof module !== 'undefined') module.exports = FL;
