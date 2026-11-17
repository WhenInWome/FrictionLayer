/* global browser */
const $ = (id) => document.getElementById(id);
const CIRCUMFERENCE = 2 * Math.PI * 54;

const target = new URLSearchParams(location.search).get('target');
let targetUrl = null;
try {
  const u = new URL(target);
  if (u.protocol === 'http:' || u.protocol === 'https:') targetUrl = u.href;
} catch (e) { /* invalid */ }

$('back').addEventListener('click', async () => {
  if (history.length > 1) history.back();
  else browser.tabs.remove((await browser.tabs.getCurrent()).id);
});

async function main() {
  if (!targetUrl) {
    $('site').textContent = 'Invalid address';
    $('count').textContent = '–';
    return;
  }
  const info = await browser.runtime.sendMessage({ type: 'start', target: targetUrl });
  $('site').textContent = info.site || new URL(targetUrl).hostname;

  if (info.site) {
    const s = info.settings;
    const n = info.opensToday + 1;
    $('note').textContent = s.escalate
      ? `Open #${n} today. Each open adds ${s.incrementSeconds}s to the wait.`
      : `Open #${n} today.`;
  }

  const total = info.seconds * 1000;
  let remaining = total;
  let last = performance.now();
  let finished = false;

  async function finish() {
    if (finished) return;
    finished = true;
    await browser.runtime.sendMessage({ type: 'complete', target: targetUrl });
    location.replace(targetUrl);
  }

  function render() {
    const secs = Math.max(0, Math.ceil(remaining / 1000));
    $('count').textContent = secs;
    document.title = `${secs}s · ${$('site').textContent}`;
    $('bar').style.strokeDashoffset = total ? CIRCUMFERENCE * (1 - remaining / total) : CIRCUMFERENCE;
  }

  render();
  if (remaining <= 0) return finish();

  // The clock only advances while this tab is visible, so a background tab can't wait it out.
  setInterval(() => {
    const now = performance.now();
    if (document.visibilityState === 'visible') remaining -= now - last;
    last = now;
    render();
    if (remaining <= 0) finish();
  }, 100);
}

main();
