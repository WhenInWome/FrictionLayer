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

  // The clock only advances while this tab is the visible tab of the focused Firefox window,
  // so a background tab or an unfocused browser can't wait it out.
  let myWindowId = null;
  let windowFocused = false;
  try {
    const win = await browser.windows.getCurrent();
    myWindowId = win.id;
    windowFocused = win.focused;
  } catch (e) {
    windowFocused = true; // windows API unavailable: fall back to visibility only
  }
  browser.windows.onFocusChanged.addListener((id) => {
    windowFocused = id !== browser.windows.WINDOW_ID_NONE && id === myWindowId;
  });

  const baseNote = $('note').textContent;
  let wasRunning = null;
  last = performance.now();
  setInterval(() => {
    const now = performance.now();
    const running = document.visibilityState === 'visible' && windowFocused;
    if (running) remaining -= now - last;
    last = now;
    if (running !== wasRunning) {
      wasRunning = running;
      $('note').textContent = running ? baseNote : 'Paused. The countdown runs while this window is in focus.';
    }
    render();
    if (remaining <= 0) finish();
  }, 100);
}

main();
