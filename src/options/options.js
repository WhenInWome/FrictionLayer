/* global browser, FL */
const $ = (id) => document.getElementById(id);
const NUM_FIELDS = ['baseSeconds', 'graceMinutes', 'incrementSeconds', 'maxSeconds'];
let settings = FL.sanitizeSettings();

async function load() {
  const stored = await browser.storage.local.get('settings');
  settings = FL.sanitizeSettings(stored.settings);
  render();
  renderHours();
  renderToday();
}

async function save() {
  settings = FL.sanitizeSettings(settings);
  await browser.storage.local.set({ settings });
  render();
  renderToday();
}

function render() {
  const list = $('sites');
  list.replaceChildren(...settings.sites.map((site) => {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = site;
    const rm = document.createElement('button');
    rm.type = 'button';
    rm.textContent = 'Remove';
    rm.setAttribute('aria-label', `Remove ${site}`);
    rm.onclick = () => { settings.sites = settings.sites.filter((s) => s !== site); save(); };
    li.append(name, rm);
    return li;
  }));
  if (!settings.sites.length) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = 'No sites yet.';
    list.append(li);
  }
  for (const f of NUM_FIELDS) if (document.activeElement !== $(f)) $(f).value = settings[f];
  $('escalate').checked = settings.escalate;
  $('reblockOpen').checked = settings.reblockOpen;
  $('scheduleEnabled').checked = settings.scheduleEnabled;
  $('hoursBox').classList.toggle('off', !settings.scheduleEnabled);
  $('hoursStatus').textContent = settings.scheduleEnabled
    ? (settings.hours.length ? '' : 'No time ranges: FrictionLayer is never active.') +
      (FL.isActive(settings) ? ' Active right now.' : ' Not active right now.')
    : 'Active all day.';
  $('escOpts').classList.toggle('off', !settings.escalate);
}

function renderHours() {
  const list = $('hours');
  list.replaceChildren(...settings.hours.map((range, i) => {
    const li = document.createElement('li');
    const span = document.createElement('span');
    const mk = (key, label) => {
      const input = document.createElement('input');
      input.type = 'time';
      input.value = FL.minutesToTime(range[key]);
      input.setAttribute('aria-label', label);
      input.onchange = () => {
        const m = FL.timeToMinutes(input.value);
        if (m < 0) { input.value = FL.minutesToTime(range[key]); return; }
        settings.hours[i][key] = m;
        save();
      };
      return input;
    };
    span.append(mk('start', 'Start time'), ' to ', mk('end', 'End time'));
    const rm = document.createElement('button');
    rm.type = 'button';
    rm.textContent = 'Remove';
    rm.onclick = () => { settings.hours.splice(i, 1); save(); renderHours(); };
    li.append(span, rm);
    return li;
  }));
}

async function renderToday() {
  const { counts } = await browser.storage.local.get('counts');
  const today = counts && counts.date === FL.dayKey() ? counts.sites : {};
  const table = $('today');
  table.replaceChildren();
  const head = table.insertRow();
  for (const label of ['Site', 'Opens', 'Next countdown']) {
    const th = document.createElement('th');
    th.textContent = label;
    head.append(th);
  }
  if (!settings.sites.length) return;
  for (const site of settings.sites) {
    const opens = today[site] || 0;
    const tr = table.insertRow();
    tr.insertCell().textContent = site;
    tr.insertCell().textContent = opens;
    tr.insertCell().textContent = `${FL.computeSeconds(settings, opens)}s`;
  }
}

$('add').addEventListener('submit', (e) => {
  e.preventDefault();
  const site = FL.normalizeSite($('site').value);
  const err = $('err');
  if (!site) {
    err.textContent = 'That doesn\'t look like a valid website address.';
    err.hidden = false;
    return;
  }
  err.hidden = true;
  if (!settings.sites.includes(site)) settings.sites.push(site);
  $('site').value = '';
  save();
});

for (const f of NUM_FIELDS) {
  $(f).addEventListener('change', () => { settings[f] = $(f).value; save(); });
}
$('reblockOpen').addEventListener('change', () => { settings.reblockOpen = $('reblockOpen').checked; save(); });
$('scheduleEnabled').addEventListener('change', () => { settings.scheduleEnabled = $('scheduleEnabled').checked; save(); });
$('addHours').addEventListener('click', () => {
  settings.hours.push({ start: 9 * 60, end: 17 * 60 });
  save();
  renderHours();
});
$('escalate').addEventListener('change', () => { settings.escalate = $('escalate').checked; save(); });

$('reset').addEventListener('click', async () => {
  await browser.storage.local.remove('counts');
  renderToday();
});

async function checkPermission() {
  const ok = await browser.permissions.contains({ origins: ['<all_urls>'] });
  $('perm').hidden = ok;
}
$('grant').addEventListener('click', async () => {
  if (browser.permissions && browser.permissions.request) {
    await browser.permissions.request({ origins: ['<all_urls>'] });
  }
  checkPermission();
});

browser.storage.onChanged.addListener((changes) => { if (changes.counts) renderToday(); });

load();
checkPermission();
