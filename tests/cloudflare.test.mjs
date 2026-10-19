// Runs the Cloudflare entry point (functions/api/[[path]].js) with a pretend KV namespace and pretend Discord.
import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/api/[[path]].js';
import { SITE, GUILD_MEMBERS, DISCORD_USERS } from './helpers.mjs';

class FakeKV {
  constructor() { this.m = new Map(); this.pageSize = 2; }
  async get(key, type) { if (!this.m.has(key)) return null; const v = this.m.get(key); return type === 'json' ? JSON.parse(v) : v; }
  async put(key, value) { assert.equal(typeof value, 'string'); this.m.set(key, value); }
  async delete(key) { this.m.delete(key); }
  async list({ prefix = '', cursor, limit = 1000 } = {}) {   // small pages on purpose, like real pagination
    const all = [...this.m.keys()].filter((k) => k.startsWith(prefix)).sort();
    const start = cursor ? Number(cursor) : 0;
    const slice = all.slice(start, start + Math.min(limit, this.pageSize));
    const done = start + slice.length >= all.length;
    return { keys: slice.map((name) => ({ name })), list_complete: done, cursor: done ? undefined : String(start + slice.length) };
  }
}

const env = (kv) => ({
  LAREDO: kv, SESSION_SECRET: 'y'.repeat(40), DISCORD_CLIENT_ID: 'cid', DISCORD_CLIENT_SECRET: 'cs', DISCORD_BOT_TOKEN: 'BOT'
});

function fakeDiscord() {
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    const ok = (d, s = 200) => new Response(JSON.stringify(d), { status: s });
    if (u === 'https://discord.com/api/oauth2/token') return ok({ access_token: 'tok:' + new URLSearchParams(String(init.body)).get('code') });
    if (u === 'https://discord.com/api/v10/users/@me') return ok(DISCORD_USERS[String(init.headers.Authorization).replace('Bearer tok:', '')]);
    const m = u.match(/members\/(\d+)$/);
    if (m) return GUILD_MEMBERS[m[1]] ? ok({ roles: GUILD_MEMBERS[m[1]] }) : ok({}, 404);
    throw new Error('unexpected ' + u);
  };
}

function client(kv) {
  const jar = {};
  const call = async (method, path, body, headers = {}) => {
    const h = new Headers(headers);
    const cookie = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
    if (cookie) h.set('cookie', cookie);
    if (body !== undefined) h.set('content-type', 'application/json');
    const res = await onRequest({ request: new Request(SITE + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' }), env: env(kv) });
    for (const c of res.headers.getSetCookie()) { const [pair] = c.split(';'); const i = pair.indexOf('='); if (/Max-Age=0/.test(c)) delete jar[pair.slice(0, i)]; else jar[pair.slice(0, i)] = pair.slice(i + 1); }
    return res;
  };
  return { call, jar, async login(code) {
    const start = await call('GET', '/api/auth/discord/login');
    return call('GET', `/api/auth/discord/callback?code=${code}&state=${new URL(start.headers.get('location')).searchParams.get('state')}`);
  } };
}

test('without the KV binding the API explains what is missing', async () => {
  const res = await onRequest({ request: new Request(SITE + '/api/settings'), env: {} });
  assert.equal(res.status, 500);
  assert.match((await res.json()).error, /KV binding named LAREDO/);
});

test('health, settings and unknown paths work through the Cloudflare entry', async () => {
  const kv = new FakeKV(); const c = client(kv);
  assert.equal((await (await c.call('GET', '/api/health')).json()).ok, true);
  assert.equal((await (await c.call('GET', '/api/settings')).json()).prices.diamond_month, 500);
  assert.equal((await c.call('GET', '/api/nope')).status, 404);
});

test('full flow on Cloudflare: login, apply, review, settings, paged KV listing', async () => {
  fakeDiscord();
  const kv = new FakeKV();
  const member = client(kv), staff = client(kv), head = client(kv);
  await member.login('code-member'); await staff.login('code-staff'); await head.login('code-head');
  assert.ok(member.jar.lr_session);

  const answers = { roblox: 'RobloxMember', age: 17, timezone: 'CST', hours: '10 to 20 hours', experience: 'x', why: 'y', scenario_rdm: 'z', scenario_conflict: 'w', rules: true };
  // several applications so the staff list has to read more than one KV page
  for (const code of ['code-member', 'code-member2']) {
    const c = code === 'code-member' ? member : client(kv);
    if (code === 'code-member2') await c.login(code);
    assert.equal((await c.call('POST', '/api/applications', { type: 'staff', answers })).status, 201);
  }
  assert.equal((await member.call('POST', '/api/applications', { type: 'staff', answers })).status, 409);

  const list = await (await staff.call('GET', '/api/staff/applications?status=pending')).json();
  assert.equal(list.applications.length, 2);
  const id = list.applications[0].id;
  assert.equal((await staff.call('POST', `/api/staff/applications/${id}/review`, { decision: 'accepted', note: 'ok' })).status, 200);
  assert.equal((await member.call('GET', '/api/me').then((r) => r.json())).isStaff, false);

  assert.equal((await staff.call('PUT', '/api/admin/settings', { defaultTheme: 'halloween' })).status, 403);
  assert.equal((await head.call('PUT', '/api/admin/settings', { prices: { shoutout: 900 } })).status, 200);
  assert.equal((await (await member.call('GET', '/api/settings')).json()).prices.shoutout, 900);
  assert.equal((await member.call('POST', '/api/auth/logout', {})).status, 200);
  assert.equal(member.jar.lr_session, undefined);
});
