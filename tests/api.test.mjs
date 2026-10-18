import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS } from '../functions/_lib/core.mjs';
import { SITE, STAFF, HEAD, GUILD_MEMBERS, setup, Browser } from './helpers.mjs';

const goodStaffApp = {
  roblox: 'RobloxMember', age: 17, timezone: 'CST, evenings', hours: '10 to 20 hours',
  experience: 'Two years moderating a roleplay server.', why: 'I like helping people.',
  scenario_rdm: 'Warn, explain the rule, log it.', scenario_conflict: 'Move it to a ticket and calm both sides.', rules: true
};

test('public settings come back with defaults and no private data', async () => {
  const { handle } = setup();
  const res = await new Browser(handle).req('GET', '/api/settings');
  const s = await res.json();
  assert.equal(res.status, 200);
  assert.equal(s.prices.diamond_month, 500);
  assert.equal(s.applications.staff.open, true);
  assert.equal(s.meta, undefined);
});

test('discord login: redirect, callback, session cookie, roles checked live', async () => {
  const { handle, log } = setup();
  const b = new Browser(handle);
  const start = await b.req('GET', '/api/auth/discord/login?next=apply/staff');
  assert.equal(start.status, 302);
  const loc = new URL(start.headers.get('location'));
  assert.equal(loc.origin + loc.pathname, 'https://discord.com/oauth2/authorize');
  assert.equal(loc.searchParams.get('client_id'), 'cid');
  assert.equal(loc.searchParams.get('scope'), 'identify');
  assert.equal(loc.searchParams.get('redirect_uri'), SITE + '/api/auth/discord/callback');
  const done = await b.req('GET', `/api/auth/discord/callback?code=code-staff&state=${loc.searchParams.get('state')}`);
  assert.equal(done.status, 302);
  assert.equal(done.headers.get('location'), SITE + '/#apply/staff');
  const cookieHeader = done.headers.getSetCookie().find((c) => c.startsWith('lr_session='));
  assert.match(cookieHeader, /HttpOnly/); assert.match(cookieHeader, /Secure/); assert.match(cookieHeader, /SameSite=Lax/);
  const me = await b.me();
  assert.equal(me.loggedIn, true);
  assert.equal(me.user.name, 'Staff One');
  assert.equal(me.inGuild, true); assert.equal(me.isStaff, true); assert.equal(me.isAdmin, false);
  assert.ok(log.some((l) => l.url.includes('/members/200')));
});

test('roles: member, staff, head of staff and someone outside the server', async () => {
  const { handle } = setup();
  const flags = {};
  for (const code of ['code-member', 'code-staff', 'code-head', 'code-outsider']) {
    const b = new Browser(handle); await b.login(code);
    const me = await b.me(); flags[code] = [me.inGuild, me.isStaff, me.isAdmin];
  }
  assert.deepEqual(flags['code-member'], [true, false, false]);
  assert.deepEqual(flags['code-staff'], [true, true, false]);
  assert.deepEqual(flags['code-head'], [true, true, true]);
  assert.deepEqual(flags['code-outsider'], [false, false, false]);
});

test('role removal takes effect within a minute (no stale staff access)', async () => {
  const { handle, advance } = setup();
  const b = new Browser(handle); await b.login('code-staff');
  assert.equal((await b.me()).isStaff, true);
  GUILD_MEMBERS[200] = [];
  advance(60_000);
  assert.equal((await b.me()).isStaff, false);
  assert.equal((await b.req('GET', '/api/staff/applications')).status, 403);
  GUILD_MEMBERS[200] = [STAFF];
});

test('login rejects a bad state and a tampered or expired session', async () => {
  const { handle, advance } = setup();
  const b = new Browser(handle);
  await b.req('GET', '/api/auth/discord/login');
  const bad = await b.req('GET', '/api/auth/discord/callback?code=code-member&state=nope');
  assert.match(bad.headers.get('location'), /auth_error=state/);
  await b.login('code-member');
  assert.equal((await b.me()).loggedIn, true);
  const original = b.jar.lr_session;
  b.jar.lr_session = original.slice(0, -3) + 'AAA';
  assert.equal((await b.me()).loggedIn, false);
  b.jar.lr_session = original;
  advance(8 * 86400 * 1000);
  assert.equal((await b.me()).loggedIn, false);
});

test('applications: submit, validation, duplicates, outsiders and closed forms', async () => {
  const { handle, store } = setup();
  const member = new Browser(handle); await member.login('code-member');
  const outsider = new Browser(handle); await outsider.login('code-outsider');
  const anon = new Browser(handle);

  assert.equal((await anon.req('POST', '/api/applications', { body: { type: 'staff', answers: goodStaffApp } })).status, 401);
  assert.equal((await outsider.req('POST', '/api/applications', { body: { type: 'staff', answers: goodStaffApp } })).status, 403);
  assert.equal((await member.req('POST', '/api/applications', { body: { type: 'nope', answers: {} } })).status, 400);

  const missing = await member.req('POST', '/api/applications', { body: { type: 'staff', answers: { ...goodStaffApp, why: '' } } });
  assert.equal(missing.status, 400); assert.match((await missing.json()).error, /Why do you want/);
  const unticked = await member.req('POST', '/api/applications', { body: { type: 'staff', answers: { ...goodStaffApp, rules: false } } });
  assert.equal(unticked.status, 400);
  const badAge = await member.req('POST', '/api/applications', { body: { type: 'staff', answers: { ...goodStaffApp, age: 5 } } });
  assert.equal(badAge.status, 400);
  const badOpt = await member.req('POST', '/api/applications', { body: { type: 'staff', answers: { ...goodStaffApp, hours: 'a lot' } } });
  assert.equal(badOpt.status, 400);

  const ok = await member.req('POST', '/api/applications', { body: { type: 'staff', answers: goodStaffApp } });
  assert.equal(ok.status, 201);
  const dup = await member.req('POST', '/api/applications', { body: { type: 'staff', answers: goodStaffApp } });
  assert.equal(dup.status, 409);

  const closed = await member.req('POST', '/api/applications', { body: { type: 'discord_dev', answers: {} } });
  assert.equal(closed.status, 403); // closed by default
  assert.equal([...store.data.keys()].filter((k) => k.startsWith('apps/')).length, 1);
  const mine = await (await member.req('GET', '/api/applications/mine')).json();
  assert.equal(mine.applications.length, 1); assert.equal(mine.applications[0].status, 'pending');
});

test('staff panel: only staff can list and review, decisions are final, applicant sees result, webhook fires', async () => {
  const { handle, log } = setup();
  const member = new Browser(handle); await member.login('code-member');
  const staff = new Browser(handle); await staff.login('code-staff');
  const created = await (await member.req('POST', '/api/applications', { body: { type: 'staff', answers: goodStaffApp } })).json();

  assert.equal((await member.req('GET', '/api/staff/applications')).status, 403);
  assert.equal((await member.req('POST', `/api/staff/applications/${created.id}/review`, { body: { decision: 'accepted' } })).status, 403);

  const list = await (await staff.req('GET', '/api/staff/applications?status=pending')).json();
  assert.equal(list.applications.length, 1);
  assert.equal(list.applications[0].applicant.name, 'Member One');
  const detail = await (await staff.req('GET', `/api/staff/applications/${created.id}`)).json();
  assert.equal(detail.application.answers.find((a) => a.id === 'why').value, 'I like helping people.');
  assert.equal((await staff.req('GET', '/api/staff/applications/not-an-id')).status, 404);

  assert.equal((await staff.req('POST', `/api/staff/applications/${created.id}/review`, { body: { decision: 'maybe' } })).status, 400);
  const rev = await staff.req('POST', `/api/staff/applications/${created.id}/review`, { body: { decision: 'accepted', note: 'Welcome aboard.' } });
  assert.equal(rev.status, 200);
  assert.equal((await staff.req('POST', `/api/staff/applications/${created.id}/review`, { body: { decision: 'denied' } })).status, 409);

  const mine = await (await member.req('GET', '/api/applications/mine')).json();
  assert.equal(mine.applications[0].status, 'accepted');
  assert.equal(mine.applications[0].decision.note, 'Welcome aboard.');
  assert.equal((await member.req('POST', '/api/applications', { body: { type: 'staff', answers: goodStaffApp } })).status, 201); // can reapply after a decision
  assert.ok(log.filter((l) => l.url === 'https://hooks.test/webhook').length >= 2);
});

test('settings: only admins can change them and bad values are refused', async () => {
  const { handle } = setup();
  const staff = new Browser(handle); await staff.login('code-staff');
  const head = new Browser(handle); await head.login('code-head');
  const member = new Browser(handle); await member.login('code-member');

  const change = { departments: { wcso: { open: true, invite: 'https://discord.gg/abc123' } }, prices: { diamond_month: 555 },
    applications: { discord_dev: { open: true } }, notice: { enabled: true, text: 'Event tonight', link: 'https://example.com' },
    maintenance: { enabled: false, message: 'Back soon' }, defaultTheme: 'halloween' };

  assert.equal((await member.req('PUT', '/api/admin/settings', { body: change })).status, 403);
  assert.equal((await staff.req('PUT', '/api/admin/settings', { body: change })).status, 403);
  assert.equal((await head.req('PUT', '/api/admin/settings', { body: { departments: { wcso: { open: true, invite: 'http://evil.test' } } } })).status, 400);
  assert.equal((await head.req('PUT', '/api/admin/settings', { body: { prices: { diamond_month: -5 } } })).status, 400);
  assert.equal((await head.req('PUT', '/api/admin/settings', { body: { notice: { enabled: true, text: 'x', link: 'javascript:alert(1)' } } })).status, 400);
  assert.equal((await head.req('PUT', '/api/admin/settings', { body: { defaultTheme: 'purple' } })).status, 400);

  const ok = await head.req('PUT', '/api/admin/settings', { body: change });
  assert.equal(ok.status, 200);
  const pub = await (await new Browser(handle).req('GET', '/api/settings')).json();
  assert.equal(pub.departments.wcso.open, true);
  assert.equal(pub.departments.wcso.invite, 'https://discord.gg/abc123');
  assert.equal(pub.departments.lpd.invite, DEFAULT_SETTINGS.departments.lpd.invite); // untouched values stay
  assert.equal(pub.prices.diamond_month, 555); assert.equal(pub.prices.silver_month, 230);
  assert.equal(pub.defaultTheme, 'halloween'); assert.equal(pub.notice.text, 'Event tonight');
  assert.equal(pub.meta, undefined);

  // a newly opened application can now be used
  const sub = await member.req('POST', '/api/applications', { body: { type: 'discord_dev', answers: { roblox: 'RobloxMember', age: 20, tools: 'discord.js', years: '1 to 2 years', project: 'A ticket bot', why: 'Help out', availability: '5h', rules: true } } });
  assert.equal(sub.status, 201);
});

test('writes from another site or without JSON are refused', async () => {
  const { handle } = setup();
  const head = new Browser(handle); await head.login('code-head');
  const cross = await head.req('PUT', '/api/admin/settings', { body: { defaultTheme: 'normal' }, headers: { origin: 'https://evil.test' } });
  assert.equal(cross.status, 403);
  const form = await head.req('PUT', '/api/admin/settings', { body: undefined });
  assert.equal(form.status, 415);
  const same = await head.req('PUT', '/api/admin/settings', { body: { defaultTheme: 'normal' }, headers: { origin: SITE } });
  assert.equal(same.status, 200);
});

test('roblox: official login with PKCE, one account per Roblox user, unlink', async () => {
  const { handle } = setup();
  const a = new Browser(handle); await a.login('code-member');
  const b = new Browser(handle); await b.login('code-member2');

  const anon = await new Browser(handle).req('GET', '/api/auth/roblox/login');
  assert.match(anon.headers.get('location'), /auth_error=signin/);

  const start = await a.req('GET', '/api/auth/roblox/login');
  const loc = new URL(start.headers.get('location'));
  assert.equal(loc.origin + loc.pathname, 'https://apis.roblox.com/oauth/v1/authorize');
  assert.equal(loc.searchParams.get('scope'), 'openid profile');
  assert.equal(loc.searchParams.get('code_challenge_method'), 'S256');
  assert.ok(loc.searchParams.get('code_challenge'));
  const done = await a.req('GET', `/api/auth/roblox/callback?code=rb-1&state=${loc.searchParams.get('state')}`);
  assert.equal(done.headers.get('location'), SITE + '/#dashboard');
  const me = await a.me();
  assert.equal(me.roblox.id, '555'); assert.equal(me.roblox.name, 'RobloxMember');

  const start2 = await b.req('GET', '/api/auth/roblox/login');
  const loc2 = new URL(start2.headers.get('location'));
  const taken = await b.req('GET', `/api/auth/roblox/callback?code=rb-2&state=${loc2.searchParams.get('state')}`);
  assert.match(taken.headers.get('location'), /auth_error=roblox_taken/);
  assert.equal((await b.me()).roblox, null);

  const appRes = await a.req('POST', '/api/applications', { body: { type: 'staff', answers: goodStaffApp } });
  const staff = new Browser(handle); await staff.login('code-staff');
  const id = (await appRes.json()).id;
  const detail = await (await staff.req('GET', `/api/staff/applications/${id}`)).json();
  assert.equal(detail.application.roblox.name, 'RobloxMember');

  assert.equal((await a.req('POST', '/api/roblox/unlink', { body: {} })).status, 200);
  assert.equal((await a.me()).roblox, null);
  const again = await a.req('GET', '/api/auth/roblox/login');
  const loc3 = new URL(again.headers.get('location'));
  await b.req('GET', '/api/auth/roblox/login'); // b starts a new flow after the unlink
  assert.ok(loc3.searchParams.get('state'));
});

test('missing configuration fails politely instead of crashing', async () => {
  const { handle } = setup({ DISCORD_CLIENT_ID: '', SESSION_SECRET: '' });
  const res = await new Browser(handle).req('GET', '/api/auth/discord/login');
  assert.match(res.headers.get('location'), /auth_error=config/);
  const me = await (await new Browser(handle).req('GET', '/api/me')).json();
  assert.equal(me.loggedIn, false);
  const unknown = await new Browser(handle).req('GET', '/api/nothing-here');
  assert.equal(unknown.status, 404);
});
