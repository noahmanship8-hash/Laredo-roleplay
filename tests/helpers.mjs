import assert from 'node:assert/strict';
import { createApi, DEFAULT_SETTINGS } from '../functions/_lib/core.mjs';

export const SITE = 'https://laredo.test';
export const STAFF = '1558228597402243153';
export const HEAD = '1559256083292495962';

export class FakeStore {
  constructor() { this.data = new Map(); }
  async get(key) { return this.data.has(key) ? JSON.parse(this.data.get(key)) : null; }
  async setJSON(key, value) { this.data.set(key, JSON.stringify(value)); }
  async delete(key) { this.data.delete(key); }
  async list({ prefix = '' } = {}) {
    return { blobs: [...this.data.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) };
  }
}

// Fake Discord and Roblox
export const DISCORD_USERS = {
  'code-member': { id: '100', username: 'member1', global_name: 'Member One', avatar: 'abc' },
  'code-staff': { id: '200', username: 'staff1', global_name: 'Staff One', avatar: null },
  'code-head': { id: '300', username: 'head1', global_name: 'Head One', avatar: null },
  'code-outsider': { id: '400', username: 'outsider', global_name: null, avatar: null },
  'code-member2': { id: '101', username: 'member2', global_name: 'Member Two', avatar: null }
};
export const GUILD_MEMBERS = { 100: [], 101: [], 200: [STAFF], 300: [HEAD] }; // 400 is not in the server
const ROBLOX_CODES = { 'rb-1': { sub: '555', preferred_username: 'RobloxMember', name: 'Roblox Member' }, 'rb-2': { sub: '555', preferred_username: 'RobloxMember', name: 'Roblox Member' } };

function makeFetch(log) {
  return async (url, init = {}) => {
    const u = String(url);
    log.push({ url: u, init });
    const ok = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
    if (u === 'https://discord.com/api/oauth2/token') {
      const code = new URLSearchParams(String(init.body)).get('code');
      return DISCORD_USERS[code] ? ok({ access_token: 'tok:' + code }) : ok({ error: 'invalid_grant' }, 400);
    }
    if (u === 'https://discord.com/api/v10/users/@me') {
      const code = String(init.headers.Authorization).replace('Bearer tok:', '');
      return ok(DISCORD_USERS[code]);
    }
    let m = u.match(/guilds\/1554210300377563226\/members\/(\d+)$/);
    if (m) {
      assert.equal(init.headers.Authorization, 'Bot BOT');
      return GUILD_MEMBERS[m[1]] ? ok({ roles: GUILD_MEMBERS[m[1]] }) : ok({ message: 'Unknown Member' }, 404);
    }
    if (u === 'https://apis.roblox.com/oauth/v1/token') {
      const p = new URLSearchParams(String(init.body));
      assert.ok(p.get('code_verifier'), 'PKCE verifier is sent');
      return ROBLOX_CODES[p.get('code')] ? ok({ access_token: 'rbtok:' + p.get('code') }) : ok({}, 400);
    }
    if (u === 'https://apis.roblox.com/oauth/v1/userinfo') {
      return ok(ROBLOX_CODES[String(init.headers.Authorization).replace('Bearer rbtok:', '')]);
    }
    if (u === 'https://hooks.test/webhook') return new Response(null, { status: 204 });
    throw new Error('unexpected fetch ' + u);
  };
}

export function setup(extraEnv = {}) {
  const store = new FakeStore();
  const log = [];
  const env = {
    SESSION_SECRET: 'x'.repeat(40), DISCORD_CLIENT_ID: 'cid', DISCORD_CLIENT_SECRET: 'csecret', DISCORD_BOT_TOKEN: 'BOT',
    ROBLOX_CLIENT_ID: 'rid', ROBLOX_CLIENT_SECRET: 'rsecret', APPLICATIONS_WEBHOOK_URL: 'https://hooks.test/webhook', ...extraEnv
  };
  let clock = 1_800_000_000_000;
  const handle = createApi({ store, env, fetch: makeFetch(log), now: () => clock });
  const advance = (ms) => { clock += ms; };
  return { store, log, handle, advance };
}

export class Browser {
  constructor(handle) { this.handle = handle; this.jar = {}; }
  absorb(res) {
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';');
      const i = pair.indexOf('=');
      const name = pair.slice(0, i); const value = pair.slice(i + 1);
      if (/Max-Age=0/.test(c)) delete this.jar[name]; else this.jar[name] = value;
    }
  }
  async req(method, path, { body, headers = {}, json = true } = {}) {
    const h = new Headers(headers);
    const cookie = Object.entries(this.jar).map(([k, v]) => `${k}=${v}`).join('; ');
    if (cookie) h.set('cookie', cookie);
    if (body !== undefined && json) h.set('content-type', 'application/json');
    const res = await this.handle(new Request(SITE + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' }));
    this.absorb(res);
    return res;
  }
  async login(code) {
    const start = await this.req('GET', '/api/auth/discord/login?next=dashboard');
    const state = new URL(start.headers.get('location')).searchParams.get('state');
    return this.req('GET', `/api/auth/discord/callback?code=${code}&state=${state}`);
  }
  async me() { return (await this.req('GET', '/api/me')).json(); }
}

