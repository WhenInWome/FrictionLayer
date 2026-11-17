/* Shared logic (background, options, interstitial, tests). Plain script, no modules. */
const FL = (() => {
  const DEFAULTS = {
    sites: [],            // normalized hostnames, e.g. "reddit.com" (matches subdomains too)
    baseSeconds: 15,      // countdown for the first open of the day
    escalate: false,      // add incrementSeconds for every open already made today
    incrementSeconds: 3,
    maxSeconds: 0,        // 0 = no cap on escalated countdown
    graceMinutes: 5       // free browsing in that tab after a countdown; 0 = every navigation
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
      graceMinutes: int(s.graceMinutes, DEFAULTS.graceMinutes, 0, 1440)
    };
  }

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

  return { DEFAULTS, sanitizeSettings, normalizeSite, findSite, computeSeconds, dayKey };
})();

if (typeof module !== 'undefined') module.exports = FL;
