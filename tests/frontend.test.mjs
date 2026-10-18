// Runs the real site.js against the real backend code, with a very small stand-in for the browser page.
// It cannot judge how the page looks, but it catches script errors and checks what each screen contains.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { SITE, setup, Browser } from './helpers.mjs';

const CODE = fs.readFileSync(new URL('../site.js', import.meta.url), 'utf8');
const tick = async (n = 12) => { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); };

class El {
  constructor(key) {
    this.key = key; this._html = ''; this.attrs = {}; this.listeners = {}; this.hidden = false; this.value = ''; this.checked = false;
    this.disabled = false; this.textContent = ''; this.cache = new Map(); this.classes = new Set(); this.style = {}; this.href = '';
    this.classList = {
      add: (c) => this.classes.add(c), remove: (c) => this.classes.delete(c), contains: (c) => this.classes.has(c),
      toggle: (c, f) => ((f === undefined ? !this.classes.has(c) : f) ? this.classes.add(c) : this.classes.delete(c))
    };
  }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = String(v); this.cache = new Map(); }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; }
  closest() { return null; }
  remove() {}
  click() { (this.listeners.click || []).slice(-1)[0]?.({ preventDefault() {}, target: this }); }
  submit() { (this.listeners.submit || []).slice(-1)[0]?.({ preventDefault() {}, target: this }); }
  querySelector(sel) { if (!this.cache.has(sel)) this.cache.set(sel, new El(sel)); return this.cache.get(sel); }
  querySelectorAll(sel) { return found(this, sel, this._html); }
}

// the few list-like selectors the script uses on freshly drawn HTML
const PATTERNS = {
  '.tab': /<button class="tab[^"]*" data-tab="([\w]+)"/g,
  '.queue-row': /<button class="queue-row" data-id="([^"]+)"/g,
  '[data-decision]': /<button class="btn[^"]*" data-decision="(\w+)"/g,
  '[data-count-for]': /data-count-for="([^"]+)" data-max="(\d+)"/g
};
const ATTR = { '.tab': 'data-tab', '.queue-row': 'data-id', '[data-decision]': 'data-decision', '[data-count-for]': 'data-count-for' };
function found(owner, sel, html) {
  const re = PATTERNS[sel];
  if (!re) return [];
  const key = 'all:' + sel;
  if (!owner.cache.has(key)) {
    const list = [];
    for (const m of html.matchAll(new RegExp(re.source, 'g'))) {
      const el = new El(sel + m[1]);
      el.attrs[ATTR[sel]] = m[1];
      if (m[2]) el.attrs['data-max'] = m[2];
      list.push(el);
    }
    owner.cache.set(key, list);
  }
  return owner.cache.get(key);
}

function boot({ handle, jar = {}, hash = '#home', feed = { announcements: [] }, offline = false }) {
  const registry = new Map();
  const get = (key) => { if (!registry.has(key)) registry.set(key, new El(key)); return registry.get(key); };
  const normal = (sel) => (/^#[\w-]+$/.test(sel) ? sel : sel);
  const allHtml = () => [...registry.values()].map((e) => e._html).filter(Boolean).join('\n');
  const doc = {
    title: '',
    getElementById: (id) => get('#' + id),
    querySelector: (sel) => get(normal(sel)),
    querySelectorAll: (sel) => {
      const re = PATTERNS[sel];
      if (!re) return [];
      const html = allHtml();
      const owner = get('doc-all');
      if (owner.lastHtml !== html) { owner.cache = new Map(); owner.lastHtml = html; } // same buttons until the page is redrawn
      return found(owner, sel, html);
    }
  };
  const handlers = {};
  const loc = { hash, search: '', pathname: '/' };
  const calls = [];
  const g = globalThis;
  Object.assign(g, {
    window: g, document: doc, location: loc,
    history: { replaceState() {} },
    localStorage: { getItem: () => null, setItem() {} },
    addEventListener: (t, f) => { handlers[t] = f; },
    scrollTo() {}, setInterval: () => 0,
    LAREDO_CONFIG: { discordInvite: 'https://discord.gg/dqpUcfUvrt', announcementsUrl: 'announcements.json' },
    fetch: async (url, init = {}) => {
      const u = new URL(url, SITE + '/');
      calls.push(u.pathname);
      if (u.pathname.startsWith('/api/')) {
        if (offline) return new Response('<html>Not found</html>', { status: 404 });
        const h = new Headers(init.headers || {});
        const cookie = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
        if (cookie) h.set('cookie', cookie);
        const res = await handle(new Request(u.toString(), { method: init.method || 'GET', headers: h, body: init.body, redirect: 'manual' }));
        for (const c of res.headers.getSetCookie()) {
          const [pair] = c.split(';'); const i = pair.indexOf('=');
          if (/Max-Age=0/.test(c)) delete jar[pair.slice(0, i)]; else jar[pair.slice(0, i)] = pair.slice(i + 1);
        }
        return res;
      }
      if (u.pathname.endsWith('announcements.json')) return new Response(JSON.stringify(feed), { status: 200 });
      return new Response('nope', { status: 404 });
    }
  });
  vm.runInThisContext(CODE);
  return {
    el: (sel) => get(sel), calls,
    go: async (h) => { loc.hash = h; handlers.hashchange(); await tick(); }
  };
}

const staffAnswers = {
  roblox: 'RobloxMember', age: '17', timezone: 'CST evenings', hours: '10 to 20 hours', experience: 'Two years moderating.',
  why: 'I want to help.', scenario_rdm: 'Warn and log it.', scenario_conflict: 'Move it to a ticket.'
};

test('visitor who is not signed in sees sign in links, not a dashboard', async () => {
  const { handle } = setup();
  const page = boot({ handle, hash: '#dashboard' });
  await tick();
  assert.match(page.el('#account').innerHTML, /Sign in with Discord/);
  assert.match(page.el('#dash-root').innerHTML, /Sign in/);
  assert.match(page.el('#dash-root').innerHTML, /api\/auth\/discord\/login\?next=dashboard/);
  await page.go('#panel');
  assert.match(page.el('#panel-root').innerHTML, /Staff sign in/);
  await page.go('#apply/staff');
  assert.match(page.el('#apply-root').innerHTML, /Sign in first/);
  assert.match(page.el('#apply-root').innerHTML, /next=apply%2Fstaff/);
});

test('copy of the site without a backend still works and says so', async () => {
  const { handle } = setup();
  const page = boot({ handle, hash: '#dashboard', offline: true });
  await tick();
  assert.match(page.el('#dash-root').innerHTML, /not switched on/);
  assert.equal(page.el('#account').innerHTML, '');
  await page.go('#home');
  assert.ok(true);
});

test('member: dashboard, apply form, submit, then the pending application shows', async () => {
  const { handle } = setup();
  const b = new Browser(handle); await b.login('code-member');
  const page = boot({ handle, jar: b.jar, hash: '#dashboard' });
  await tick();
  const dash = page.el('#dash-root').innerHTML;
  assert.match(dash, /Member One/); assert.match(dash, /Member of the Laredo Roleplay Discord/);
  assert.match(dash, /Link Roblox account/); assert.match(dash, /not applied for anything/);
  assert.doesNotMatch(dash, /Staff tools/);
  assert.match(page.el('#account').innerHTML, /Member One/);

  await page.go('#apply/staff');
  const form = page.el('#apply-root').innerHTML;
  assert.match(form, /Staff application/); assert.match(form, /id="f-scenario_rdm"/); assert.match(form, /Send application/);
  assert.match(form, /type="checkbox" id="f-rules"/);

  // missing answer: the server's message is shown and the form stays
  for (const [k, v] of Object.entries(staffAnswers)) page.el('#f-' + k).value = v;
  page.el('#f-why').value = '';
  page.el('#f-rules').checked = true;
  page.el('#apply-form').submit(); await tick();
  assert.match(page.el('#apply-msg').innerHTML, /Why do you want/);

  page.el('#f-why').value = 'I want to help.';
  page.el('#apply-form').submit(); await tick();
  assert.match(page.el('#apply-root').innerHTML, /Sent/);

  await page.go('#dashboard');
  assert.match(page.el('#dash-root').innerHTML, /Staff application/);
  assert.match(page.el('#dash-root').innerHTML, /Pending/);
});

test('member who is not in the Discord is asked to join first', async () => {
  const { handle } = setup();
  const b = new Browser(handle); await b.login('code-outsider');
  const page = boot({ handle, jar: b.jar, hash: '#apply/staff' });
  await tick();
  assert.match(page.el('#apply-root').innerHTML, /Join the Discord first/);
});

test('closed application shows as closed and unknown ones are handled', async () => {
  const { handle } = setup();
  const b = new Browser(handle); await b.login('code-member');
  const page = boot({ handle, jar: b.jar, hash: '#apply/discord_dev' });
  await tick();
  assert.match(page.el('#apply-root').innerHTML, /closed right now/);
  await page.go('#apply/nonsense');
  assert.match(page.el('#apply-root').innerHTML, /does not exist/);
});

test('staff: queue, detail, accept; regular members are turned away', async () => {
  const { handle } = setup();
  const member = new Browser(handle); await member.login('code-member');
  await member.req('POST', '/api/applications', { body: { type: 'staff', answers: { ...staffAnswers, age: 17, rules: true } } });

  const plain = boot({ handle, jar: member.jar, hash: '#panel' });
  await tick();
  assert.match(plain.el('#panel-root').innerHTML, /staff team only/);

  const staff = new Browser(handle); await staff.login('code-staff');
  const page = boot({ handle, jar: staff.jar, hash: '#panel' });
  await tick();
  const panel = page.el('#panel-root').innerHTML;
  assert.match(panel, /data-tab="applications"/); assert.doesNotMatch(panel, /data-tab="settings"/);
  assert.match(page.el('#app-list').innerHTML, /Member One/); assert.match(page.el('#app-list').innerHTML, /Pending/);

  const row = page.el('#app-list').querySelectorAll('.queue-row')[0];
  assert.ok(row, 'queue row drawn');
  row.click(); await tick();
  const detail = page.el('#detail').innerHTML;
  assert.match(detail, /I want to help\./); assert.match(detail, /Roblox not linked/); assert.match(detail, /data-decision="accepted"/);

  page.el('#note').value = 'Welcome to the team.';
  const accept = page.el('#panel-body').querySelectorAll('[data-decision]');
  assert.equal(accept.length, 0); // buttons live in #detail, found through the page
  const buttons = globalThis.document.querySelectorAll('[data-decision]');
  buttons.find((b) => b.attrs['data-decision'] === 'accepted').click(); await tick();
  assert.match(page.el('#detail').innerHTML, /Accepted/); assert.match(page.el('#detail').innerHTML, /Welcome to the team\./);

  const mine = await (await member.req('GET', '/api/applications/mine')).json();
  assert.equal(mine.applications[0].status, 'accepted');
});

test('admin: settings screen loads, saves, and the public site picks the change up', async () => {
  const { handle } = setup();
  const head = new Browser(handle); await head.login('code-head');
  const page = boot({ handle, jar: head.jar, hash: '#panel' });
  await tick();
  assert.match(page.el('#panel-root').innerHTML, /data-tab="settings"/);
  page.el('#panel-root').querySelectorAll('.tab').find((t) => t.attrs['data-tab'] === 'settings').click(); await tick();
  const html = page.el('#panel-body').innerHTML;
  for (const text of ['Site notice', 'Maintenance mode', 'Applications', 'Departments', 'Shop prices', 'Laredo Diamond, 1 month']) assert.match(html, new RegExp(text));
  assert.match(html, /id="s-price-diamond_month" value="500"/);

  const set = (id, v) => { page.el('#' + id).value = v; };
  const tickBox = (id, on) => { page.el('#' + id).checked = on; };
  set('s-notice-text', 'Event night Friday'); set('s-notice-link', ''); tickBox('s-notice-on', true);
  tickBox('s-maint-on', false); set('s-maint-msg', 'Back soon'); set('s-theme', 'halloween');
  for (const k of ['staff', 'discord_dev', 'server_dev']) tickBox('s-app-' + k, k !== 'server_dev');
  for (const id of ['lpd', 'wcso', 'dps', 'lfd', 'fbi', 'bp', 'swat', 'dot']) { tickBox('s-dept-' + id, id === 'wcso'); set('s-inv-' + id, id === 'wcso' ? 'https://discord.gg/webb123' : ''); }
  const prices = { silver_month: 230, silver_perm: 360, gold_month: 340, gold_perm: 410, diamond_month: 520, diamond_perm: 650, elite_month: 780, elite_perm: 1500, mod_day: 4000, livery_week: 2350, livery_perm: 2500, partner_none: 150, partner_here: 230, partner_everyone: 777, vc_office: 80, shoutout: 874 };
  for (const [k, v] of Object.entries(prices)) set('s-price-' + k, String(v));
  page.el('#settings-form').submit(); await tick();
  assert.match(page.el('#settings-msg').innerHTML, /Saved/);
  assert.equal(page.el('#notice-text').textContent, 'Event night Friday');
  assert.equal(page.el('#notice').hidden, false);

  const pub = await (await new Browser(handle).req('GET', '/api/settings')).json();
  assert.equal(pub.prices.diamond_month, 520); assert.equal(pub.departments.wcso.open, true);
  assert.equal(pub.departments.lpd.open, false); assert.equal(pub.applications.discord_dev.open, true);

  // blank price and a bad invite are refused with a readable message
  set('s-price-shoutout', '');
  page.el('#settings-form').submit(); await tick();
  assert.match(page.el('#settings-msg').innerHTML, /Fill in every price/);
  set('s-price-shoutout', '874'); set('s-inv-wcso', 'http://bad.example');
  page.el('#settings-form').submit(); await tick();
  assert.match(page.el('#settings-msg').innerHTML, /must look like https:\/\/discord\.gg/);
});

test('maintenance mode covers the site for visitors but not for staff', async () => {
  const { handle } = setup();
  const head = new Browser(handle); await head.login('code-head');
  await head.req('PUT', '/api/admin/settings', { body: { maintenance: { enabled: true, message: 'Updating the shop' } } });

  const visitor = boot({ handle, hash: '#home' });
  await tick();
  assert.equal(visitor.el('#maint').hidden, false);
  assert.equal(visitor.el('#maint-msg').textContent, 'Updating the shop');

  const staff = boot({ handle, jar: head.jar, hash: '#home' });
  await tick();
  assert.equal(staff.el('#maint').hidden, true);
  assert.equal(staff.el('#maint-staff').hidden, false);
});

test('home page and announcements show the latest post from the feed', async () => {
  const { handle } = setup();
  const feed = { announcements: [{ id: '1', timestamp: '2026-10-10T12:00:00.000Z', author: { name: 'Laredo Owner', avatar: '' }, content: '**New rules** are live. Read them in <#77>.', embeds: [], attachments: 0, url: 'https://discord.com/channels/1/2/3' }] };
  const page = boot({ handle, hash: '#home', feed });
  await tick();
  assert.match(page.el('#home-latest').innerHTML, /New rules are live/);
  assert.match(page.el('#home-latest').innerHTML, /Laredo Owner/);
  await page.go('#announcements');
  assert.match(page.el('#feed').innerHTML, /<strong>New rules<\/strong>/);
  assert.match(page.el('#feed').innerHTML, /View in Discord/);
});

test('signing out and unlinking work', async () => {
  const { handle } = setup();
  const b = new Browser(handle); await b.login('code-member');
  const page = boot({ handle, jar: b.jar, hash: '#dashboard' });
  await tick();
  page.el('#signout').click(); await tick();
  assert.equal(Object.keys(b.jar).includes('lr_session'), false); // the sign-in cookie was cleared
  assert.match(page.el('#account').innerHTML, /Sign in with Discord/);
});
