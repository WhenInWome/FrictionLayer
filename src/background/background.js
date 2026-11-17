/* global FL, browser */
const INTERSTITIAL = browser.runtime.getURL('interstitial/interstitial.html');

async function getSettings() {
  const { settings } = await browser.storage.local.get('settings');
  return FL.sanitizeSettings(settings);
}

/** Per-site open counts for today; a new day starts from zero. */
async function getCounts() {
  const { counts } = await browser.storage.local.get('counts');
  const today = FL.dayKey();
  return counts && counts.date === today ? counts : { date: today, sites: {} };
}

// Passes ("you already waited") live in storage.session so they survive event-page suspension.
async function getPasses() {
  const { passes } = await browser.storage.session.get('passes');
  const now = Date.now();
  return Object.fromEntries(Object.entries(passes || {}).filter(([, expires]) => expires > now));
}

const passKey = (tabId, site) => `${tabId}|${site}`;

browser.webRequest.onBeforeRequest.addListener(
  async (details) => {
    if (details.tabId < 0) return {};
    const settings = await getSettings();
    const site = FL.findSite(details.url, settings.sites);
    if (!site) return {};
    const passes = await getPasses();
    if (passes[passKey(details.tabId, site)]) return {};
    return { redirectUrl: `${INTERSTITIAL}?target=${encodeURIComponent(details.url)}` };
  },
  { urls: ['http://*/*', 'https://*/*'], types: ['main_frame'] },
  ['blocking']
);

browser.runtime.onMessage.addListener(async (msg, sender) => {
  if (!msg || !sender.tab) return;
  const settings = await getSettings();
  const site = FL.findSite(msg.target, settings.sites);

  if (msg.type === 'start') {
    if (!site) return { site: null, seconds: 0, opensToday: 0 };
    const counts = await getCounts();
    const opensToday = counts.sites[site] || 0;
    return { site, seconds: FL.computeSeconds(settings, opensToday), opensToday, settings };
  }

  if (msg.type === 'complete') {
    if (site) {
      const counts = await getCounts();
      counts.sites[site] = (counts.sites[site] || 0) + 1;
      await browser.storage.local.set({ counts });
      if (settings.graceMinutes > 0) {
        const passes = await getPasses();
        passes[passKey(sender.tab.id, site)] = Date.now() + settings.graceMinutes * 60000;
        await browser.storage.session.set({ passes });
      }
    }
    return { ok: true };
  }
});

browser.action.onClicked.addListener(() => browser.runtime.openOptionsPage());
