// Backend for the Laredo Roleplay website. Everything that needs a secret or a permission check lives here.
// Cloudflare Pages connects this to D1 through functions/_lib/entry.mjs.

import crypto from 'node:crypto';
import { FORMS, FORM_IDS, publicForms, validateAnswers } from './forms.mjs';

const GUILD_DEFAULT = '1554210300377563226';
const STAFF_ROLE_DEFAULT = '1558228597402243153'; // Staff Team: can open the staff panel
const ADMIN_ROLES_DEFAULT = [
  '1559256083292495962', // Head of Staff
  '1558209179276017735', // Executive
  '1558209177778913330', // Leadership
  '1558209180723060808'  // Discord Developer
]; // these can change the rest of the website settings; staff can manage theme availability

export const DEPT_IDS = ['lpd', 'wcso', 'dps', 'lfd', 'fbi', 'bp', 'swat', 'dot'];

export const PRICE_DEFAULTS = {
  silver_month: 230, silver_perm: 360,
  gold_month: 340, gold_perm: 410,
  diamond_month: 500, diamond_perm: 650,
  elite_month: 780, elite_perm: 1500,
  mod_day: 4000,
  livery_week: 2350, livery_perm: 2500,
  partner_none: 150, partner_here: 230, partner_everyone: 777,
  vc_office: 80, shoutout: 874
};

export const DEFAULT_SETTINGS = {
  notice: { enabled: false, text: '', link: '' },
  maintenance: { enabled: false, message: 'The site is being updated. Please check back soon.' },
  defaultTheme: 'normal',
  themes: { dark: true, light: true, halloween: true, christmas: true },
  applications: {
    staff: { open: true },
    discord_dev: { open: false },
    server_dev: { open: false }
  },
  departments: {
    lpd: { open: true, invite: 'https://discord.gg/R65Y2cfGTH' },
    wcso: { open: false, invite: '' },
    dps: { open: true, invite: 'https://discord.gg/KbFmgQndKk' },
    lfd: { open: false, invite: '' },
    fbi: { open: false, invite: '' },
    bp: { open: false, invite: '' },
    swat: { open: false, invite: '' },
    dot: { open: false, invite: '' }
  },
  prices: { ...PRICE_DEFAULTS }
};

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const INVITE_RE = /^https:\/\/(discord\.gg|discord\.com\/invite)\/[A-Za-z0-9-]{2,40}$/;
const APP_ID_RE = /^\d{13}-[a-f0-9]{8}$/;

function isHttps(value) {
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}

export function mergeSettings(saved) {
  const out = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  if (!saved || typeof saved !== 'object') return out;
  if (saved.notice) Object.assign(out.notice, saved.notice);
  if (saved.maintenance) Object.assign(out.maintenance, saved.maintenance);
  if (saved.defaultTheme === 'halloween' || saved.defaultTheme === 'normal') out.defaultTheme = saved.defaultTheme;
  if (saved.themes && typeof saved.themes === 'object' && !Array.isArray(saved.themes)) {
    for (const theme of Object.keys(out.themes)) if (typeof saved.themes[theme] === 'boolean') out.themes[theme] = saved.themes[theme];
  }
  for (const id of FORM_IDS) if (saved.applications && saved.applications[id]) Object.assign(out.applications[id], saved.applications[id]);
  for (const id of DEPT_IDS) if (saved.departments && saved.departments[id]) Object.assign(out.departments[id], saved.departments[id]);
  for (const key of Object.keys(PRICE_DEFAULTS)) {
    if (saved.prices && Number.isFinite(saved.prices[key])) out.prices[key] = saved.prices[key];
  }
  if (saved.meta) out.meta = saved.meta;
  return out;
}

// Checks what an admin sent and returns the new settings. Throws HttpError(400) with a readable message.
export function sanitizeSettings(input, current) {
  if (!input || typeof input !== 'object') throw new HttpError(400, 'Missing settings.');
  const next = JSON.parse(JSON.stringify(current));
  delete next.meta;

  if (input.notice !== undefined) {
    const n = input.notice || {};
    const text = String(n.text || '').trim();
    const link = String(n.link || '').trim();
    if (text.length > 200) throw new HttpError(400, 'The notice text is too long (200 characters at most).');
    if (link && (link.length > 300 || !isHttps(link))) throw new HttpError(400, 'The notice link must start with https://');
    next.notice = { enabled: Boolean(n.enabled), text, link };
  }
  if (input.maintenance !== undefined) {
    const m = input.maintenance || {};
    const message = String(m.message || '').trim() || DEFAULT_SETTINGS.maintenance.message;
    if (message.length > 300) throw new HttpError(400, 'The maintenance message is too long (300 characters at most).');
    next.maintenance = { enabled: Boolean(m.enabled), message };
  }
  if (input.defaultTheme !== undefined) {
    if (input.defaultTheme !== 'normal' && input.defaultTheme !== 'halloween') throw new HttpError(400, 'Default mode must be normal or halloween.');
    next.defaultTheme = input.defaultTheme;
  }
  if (input.themes !== undefined) {
    if (!input.themes || typeof input.themes !== 'object' || Array.isArray(input.themes)) throw new HttpError(400, 'Theme availability must be an object.');
    for (const key of Object.keys(input.themes)) {
      if (!Object.hasOwn(next.themes, key)) throw new HttpError(400, 'Unknown theme: ' + key + '.');
      if (typeof input.themes[key] !== 'boolean') throw new HttpError(400, 'Theme availability values must be on or off.');
      next.themes[key] = input.themes[key];
    }
    if (!Object.values(next.themes).some(Boolean)) throw new HttpError(400, 'At least one theme must stay enabled.');
  }
  if (input.applications !== undefined) {
    for (const id of FORM_IDS) {
      const a = input.applications && input.applications[id];
      if (a !== undefined) next.applications[id] = { open: Boolean(a.open) };
    }
  }
  if (input.departments !== undefined) {
    for (const id of DEPT_IDS) {
      const d = input.departments && input.departments[id];
      if (d === undefined) continue;
      const invite = String(d.invite || '').trim();
      if (invite && !INVITE_RE.test(invite)) throw new HttpError(400, 'The invite for "' + id + '" must look like https://discord.gg/yourcode');
      next.departments[id] = { open: Boolean(d.open), invite };
    }
  }
  if (input.prices !== undefined) {
    for (const key of Object.keys(PRICE_DEFAULTS)) {
      if (!input.prices || input.prices[key] === undefined) continue;
      const n = Number(input.prices[key]);
      if (!Number.isInteger(n) || n < 0 || n > 1000000) throw new HttpError(400, 'Prices must be whole numbers from 0 to 1,000,000 (' + key + ').');
      next.prices[key] = n;
    }
  }
  return next;
}

export function createApi({ store, fetch: fetchImpl = globalThis.fetch, env = process.env, now = () => Date.now() }) {
  const secret = env.SESSION_SECRET || '';
  const guildId = env.DISCORD_GUILD_ID || GUILD_DEFAULT;
  const staffRole = env.STAFF_ROLE_ID || STAFF_ROLE_DEFAULT;
  const adminRoles = env.ADMIN_ROLE_IDS
    ? env.ADMIN_ROLE_IDS.split(',').map((s) => s.trim()).filter(Boolean)
    : ADMIN_ROLES_DEFAULT;
  const memberCache = new Map();

  // ------------------------------------------------------------ small helpers
  const nowSec = () => Math.floor(now() / 1000);
  const randomHex = (bytes) => crypto.randomBytes(bytes).toString('hex');

  function json(data, status = 200, extraHeaders) {
    const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    if (extraHeaders) for (const [k, v] of extraHeaders) headers.append(k, v);
    return new Response(JSON.stringify(data), { status, headers });
  }

  function redirect(location, cookies = []) {
    const headers = new Headers({ Location: location, 'Cache-Control': 'no-store' });
    for (const c of cookies) headers.append('Set-Cookie', c);
    return new Response(null, { status: 302, headers });
  }

  function sign(payload) {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const mac = crypto.createHmac('sha256', secret).update(body).digest('base64url');
    return body + '.' + mac;
  }

  function verify(token) {
    if (!token || !secret) return null;
    const [body, mac] = String(token).split('.');
    if (!body || !mac) return null;
    const expected = crypto.createHmac('sha256', secret).update(body).digest();
    let given;
    try { given = Buffer.from(mac, 'base64url'); } catch { return null; }
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
    try {
      const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
      if (!payload.exp || payload.exp < nowSec()) return null;
      return payload;
    } catch { return null; }
  }

  function parseCookies(header) {
    const out = {};
    String(header || '').split(';').forEach((part) => {
      const i = part.indexOf('=');
      if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
    });
    return out;
  }

  function cookie(name, value, { maxAge, path = '/' } = {}) {
    return `${name}=${value}; Path=${path}; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
  }

  const clearCookie = (name, path = '/') => cookie(name, '', { maxAge: 0, path });

  function siteOrigin(req) {
    return env.SITE_URL ? new URL(env.SITE_URL).origin : new URL(req.url).origin;
  }

  function checkWrite(req) {
    const origin = req.headers.get('origin');
    if (origin && origin !== siteOrigin(req)) throw new HttpError(403, 'Blocked: request came from another site.');
    if (!(req.headers.get('content-type') || '').includes('application/json')) throw new HttpError(415, 'Send JSON.');
  }

  async function readBody(req) {
    const text = await req.text();
    if (text.length > 60000) throw new HttpError(413, 'That is too large.');
    try { return JSON.parse(text || '{}'); } catch { throw new HttpError(400, 'Invalid JSON.'); }
  }

  const avatarUrl = (id, hash) => hash
    ? `https://cdn.discordapp.com/avatars/${id}/${hash}.png?size=96`
    : `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(id) >> 22n) % 6n)}.png`;

  // ------------------------------------------------------------ discord roles (checked live)
async function getMember(uid) {
  const hit = memberCache.get(uid);
  if (hit && now() - hit.at < 45000) return hit.value;
  if (!env.DISCORD_BOT_TOKEN) {
    throw new HttpError(500, 'The bot token is not set up on the server.');
  }

  const res = await fetchImpl(`https://discord.com/api/v10/guilds/${guildId}/members/${uid}`, {
    headers: { Authorization: 'Bot ' + env.DISCORD_BOT_TOKEN }
  });

  let value = null;
  if (res.status === 404) {
    const detail = await res.json().catch(() => ({}));
    if (detail.code === 10004) {
      throw new HttpError(502, 'Discord could not find the configured server. Check DISCORD_GUILD_ID and make sure this bot is in that server.');
    }
  } else if (!res.ok) {
    if (res.status === 401) {
      throw new HttpError(502, 'Discord rejected DISCORD_BOT_TOKEN. Check that it is the current Bot Token, then redeploy.');
    }
    if (res.status === 403) {
      throw new HttpError(502, 'Discord denied this bot access to the server. Make sure the bot is installed in the server set by DISCORD_GUILD_ID.');
    }
    if (res.status === 429) {
      throw new HttpError(502, 'Discord is temporarily rate-limiting the role check. Wait a minute and try again.');
    }
    throw new HttpError(502, `Discord role check failed (HTTP ${res.status}). Check DISCORD_BOT_TOKEN and DISCORD_GUILD_ID.`);
  } else {
    const m = await res.json();
    value = { roles: Array.isArray(m.roles) ? m.roles : [] };
  }

  memberCache.set(uid, { at: now(), value });
  return value;
}

  function sessionFrom(req) {
    return verify(parseCookies(req.headers.get('cookie')).lr_session);
  }

  function requireSession(req) {
    const session = sessionFrom(req);
    if (!session) throw new HttpError(401, 'Please sign in with Discord.');
    return session;
  }

  async function whoIs(req, { needMember = false, needStaff = false, needAdmin = false } = {}) {
    const session = requireSession(req);
    const member = await getMember(session.uid);
    const roles = member ? member.roles : [];
    const isAdmin = roles.some((r) => adminRoles.includes(r));
    const isStaff = isAdmin || roles.includes(staffRole);
    if (needMember && !member) throw new HttpError(403, 'Join the Laredo Roleplay Discord first.');
    if (needStaff && !isStaff) throw new HttpError(403, 'Staff only.');
    if (needAdmin && !isAdmin) throw new HttpError(403, 'Only Head of Staff, Executive, Leadership and Discord Developers can change settings.');
    return {
      session, member, isStaff, isAdmin,
      user: { id: session.uid, name: session.name, avatar: avatarUrl(session.uid, session.av) }
    };
  }

  async function loadSettings() {
    return mergeSettings(await store.get('settings', { type: 'json' }));
  }

  function publicSettings(settings) {
    const copy = JSON.parse(JSON.stringify(settings));
    delete copy.meta;
    return copy;
  }

  // ------------------------------------------------------------ routes
  async function discordLogin(req, url) {
    if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET || !secret) return redirect(siteOrigin(req) + '/?auth_error=config#dashboard');
    const next = /^[a-z0-9/_-]{1,40}$/.test(url.searchParams.get('next') || '') ? url.searchParams.get('next') : 'dashboard';
    const state = randomHex(16);
    const params = new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      response_type: 'code',
      redirect_uri: siteOrigin(req) + '/api/auth/discord/callback',
      scope: 'identify',
      state,
      prompt: 'none'
    });
    return redirect('https://discord.com/oauth2/authorize?' + params, [
      cookie('lr_oauth_d', sign({ s: state, next, exp: nowSec() + 600 }), { maxAge: 600, path: '/api/auth' })
    ]);
  }

  async function discordCallback(req, url) {
    const origin = siteOrigin(req);
    const clear = clearCookie('lr_oauth_d', '/api/auth');
    const fail = (code) => redirect(`${origin}/?auth_error=${code}#dashboard`, [clear]);
    const saved = verify(parseCookies(req.headers.get('cookie')).lr_oauth_d);
    const code = url.searchParams.get('code');
    if (url.searchParams.get('error')) return fail('denied');
    if (!saved || !code || saved.s !== url.searchParams.get('state')) return fail('state');
    try {
      const tokenRes = await fetchImpl('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: env.DISCORD_CLIENT_ID, client_secret: env.DISCORD_CLIENT_SECRET,
          grant_type: 'authorization_code', code, redirect_uri: origin + '/api/auth/discord/callback'
        })
      });
      if (!tokenRes.ok) return fail('token');
      const token = await tokenRes.json();
      const userRes = await fetchImpl('https://discord.com/api/v10/users/@me', {
        headers: { Authorization: 'Bearer ' + token.access_token }
      });
      if (!userRes.ok) return fail('user');
      const u = await userRes.json();
      const session = sign({ uid: String(u.id), name: u.global_name || u.username, av: u.avatar || null, exp: nowSec() + 7 * 86400 });
      return redirect(`${origin}/#${saved.next || 'dashboard'}`, [
        cookie('lr_session', session, { maxAge: 7 * 86400 }), clear
      ]);
    } catch {
      return fail('network');
    }
  }

  async function me(req) {
    const session = sessionFrom(req);
    const base = { robloxConfigured: Boolean(env.ROBLOX_CLIENT_ID && env.ROBLOX_CLIENT_SECRET) };
    if (!session) return json({ loggedIn: false, ...base });
    let inGuild = null, isStaff = false, isAdmin = false, warning = null;
    try {
      const w = await whoIs(req);
      inGuild = Boolean(w.member); isStaff = w.isStaff; isAdmin = w.isAdmin;
    } catch (e) {
      if (!(e instanceof HttpError)) throw e;
      warning = e.message;
    }
    const roblox = await store.get('roblox/' + session.uid, { type: 'json' });
    return json({
      loggedIn: true, ...base,
      user: { id: session.uid, name: session.name, avatar: avatarUrl(session.uid, session.av) },
      inGuild, isStaff, isAdmin, roblox: roblox || null, warning
    });
  }

  async function robloxLogin(req) {
    const origin = siteOrigin(req);
    const session = sessionFrom(req);
    if (!session) return redirect(origin + '/?auth_error=signin#dashboard');
    if (!env.ROBLOX_CLIENT_ID || !env.ROBLOX_CLIENT_SECRET) return redirect(origin + '/?auth_error=roblox_config#dashboard');
    const state = randomHex(16);
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    const params = new URLSearchParams({
      client_id: env.ROBLOX_CLIENT_ID,
      redirect_uri: origin + '/api/auth/roblox/callback',
      scope: 'openid profile',
      response_type: 'code',
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256'
    });
    return redirect('https://apis.roblox.com/oauth/v1/authorize?' + params, [
      cookie('lr_oauth_r', sign({ s: state, v: verifier, uid: session.uid, exp: nowSec() + 600 }), { maxAge: 600, path: '/api/auth' })
    ]);
  }

  async function robloxCallback(req, url) {
    const origin = siteOrigin(req);
    const clear = clearCookie('lr_oauth_r', '/api/auth');
    const fail = (code) => redirect(`${origin}/?auth_error=${code}#dashboard`, [clear]);
    const session = sessionFrom(req);
    const saved = verify(parseCookies(req.headers.get('cookie')).lr_oauth_r);
    const code = url.searchParams.get('code');
    if (url.searchParams.get('error')) return fail('roblox_denied');
    if (!session || !saved || saved.uid !== session.uid || !code || saved.s !== url.searchParams.get('state')) return fail('state');
    try {
      const tokenRes = await fetchImpl('https://apis.roblox.com/oauth/v1/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: env.ROBLOX_CLIENT_ID, client_secret: env.ROBLOX_CLIENT_SECRET,
          grant_type: 'authorization_code', code, code_verifier: saved.v,
          redirect_uri: origin + '/api/auth/roblox/callback'
        })
      });
      if (!tokenRes.ok) return fail('roblox_token');
      const token = await tokenRes.json();
      const infoRes = await fetchImpl('https://apis.roblox.com/oauth/v1/userinfo', {
        headers: { Authorization: 'Bearer ' + token.access_token }
      });
      if (!infoRes.ok) return fail('roblox_user');
      const info = await infoRes.json();
      const robloxId = String(info.sub || '');
      if (!/^\d{1,20}$/.test(robloxId)) return fail('roblox_user');

      const owner = await store.get('roblox-owner/' + robloxId, { type: 'json' });
      if (owner && owner.uid !== session.uid) return fail('roblox_taken');
      const previous = await store.get('roblox/' + session.uid, { type: 'json' });
      if (previous && previous.id !== robloxId) await store.delete('roblox-owner/' + previous.id);
      const link = {
        id: robloxId,
        name: String(info.preferred_username || info.name || robloxId).slice(0, 60),
        displayName: String(info.name || info.nickname || '').slice(0, 60),
        linkedAt: new Date(now()).toISOString()
      };
      await store.setJSON('roblox/' + session.uid, link);
      await store.setJSON('roblox-owner/' + robloxId, { uid: session.uid });
      return redirect(origin + '/#dashboard', [clear]);
    } catch {
      return fail('network');
    }
  }

  async function robloxUnlink(req) {
    checkWrite(req);
    const session = requireSession(req);
    const link = await store.get('roblox/' + session.uid, { type: 'json' });
    if (link) {
      await store.delete('roblox-owner/' + link.id);
      await store.delete('roblox/' + session.uid);
    }
    return json({ ok: true });
  }

  async function notify(text) {
    if (!env.APPLICATIONS_WEBHOOK_URL) return;
    try {
      await fetchImpl(env.APPLICATIONS_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text.slice(0, 1800), allowed_mentions: { parse: [] } })
      });
    } catch { /* a failed notification must never fail the request */ }
  }

  async function userApps(uid) {
    const listed = await store.list({ prefix: `user-apps/${uid}/` });
    const ids = (listed.blobs || []).map((b) => b.key.split('/').pop());
    const apps = await Promise.all(ids.map((id) => store.get('apps/' + id, { type: 'json' })));
    return apps.filter(Boolean).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  const summary = (a) => ({
    id: a.id, type: a.type, typeLabel: a.typeLabel, status: a.status, createdAt: a.createdAt,
    applicant: { id: a.applicant.id, name: a.applicant.name, avatar: a.applicant.avatar },
    roblox: a.roblox || null,
    review: a.review ? { by: a.review.by, at: a.review.at, decision: a.review.decision } : null
  });

  async function submitApplication(req) {
    checkWrite(req);
    const w = await whoIs(req, { needMember: true });
    const { type, answers } = await readBody(req);
    if (!FORMS[type]) throw new HttpError(400, 'Unknown application.');
    const settings = await loadSettings();
    if (!settings.applications[type].open) throw new HttpError(403, 'This application is closed right now.');
    let cleaned;
    try { cleaned = validateAnswers(type, answers); } catch (e) { throw new HttpError(400, e.message); }
    const mine = await userApps(w.user.id);
    if (mine.some((a) => a.type === type && a.status === 'pending')) {
      throw new HttpError(409, 'You already have a pending ' + FORMS[type].label.toLowerCase() + '. Wait for a decision first.');
    }
    const roblox = await store.get('roblox/' + w.user.id, { type: 'json' });
    const id = `${String(now()).padStart(13, '0')}-${randomHex(4)}`;
    const app = {
      id, type, typeLabel: FORMS[type].label, status: 'pending', createdAt: new Date(now()).toISOString(),
      applicant: { id: w.user.id, name: w.user.name, avatar: w.user.avatar },
      roblox: roblox ? { id: roblox.id, name: roblox.name } : null,
      answers: cleaned, review: null
    };
    await store.setJSON('apps/' + id, app);
    await store.setJSON(`user-apps/${w.user.id}/${id}`, { type });
    await notify(`New ${FORMS[type].label.toLowerCase()} from ${w.user.name}. Review it in the staff panel on the website.`);
    return json({ ok: true, id }, 201);
  }

  async function myApplications(req) {
    const session = requireSession(req);
    const apps = await userApps(session.uid);
    return json({
      applications: apps.map((a) => ({
        id: a.id, type: a.type, typeLabel: a.typeLabel, status: a.status, createdAt: a.createdAt,
        decision: a.review ? { decision: a.review.decision, note: a.review.note, at: a.review.at } : null
      }))
    });
  }

  async function staffList(req, url) {
    await whoIs(req, { needStaff: true });
    const listed = await store.list({ prefix: 'apps/' });
    const keys = (listed.blobs || []).map((b) => b.key).sort().reverse().slice(0, 150);
    let apps = (await Promise.all(keys.map((k) => store.get(k, { type: 'json' })))).filter(Boolean);
    const status = url.searchParams.get('status');
    const type = url.searchParams.get('type');
    if (status) apps = apps.filter((a) => a.status === status);
    if (type) apps = apps.filter((a) => a.type === type);
    return json({ applications: apps.map(summary) });
  }

  async function staffDetail(req, id) {
    await whoIs(req, { needStaff: true });
    if (!APP_ID_RE.test(id)) throw new HttpError(404, 'Not found.');
    const app = await store.get('apps/' + id, { type: 'json' });
    if (!app) throw new HttpError(404, 'Not found.');
    return json({ application: app });
  }

  async function staffReview(req, id) {
    checkWrite(req);
    const w = await whoIs(req, { needStaff: true });
    if (!APP_ID_RE.test(id)) throw new HttpError(404, 'Not found.');
    const { decision, note } = await readBody(req);
    if (decision !== 'accepted' && decision !== 'denied') throw new HttpError(400, 'Choose accept or deny.');
    const cleanNote = String(note || '').trim();
    if (cleanNote.length > 500) throw new HttpError(400, 'The note is too long (500 characters at most).');
    const app = await store.get('apps/' + id, { type: 'json' });
    if (!app) throw new HttpError(404, 'Not found.');
    if (app.status !== 'pending') throw new HttpError(409, 'This application has already been reviewed.');
    app.status = decision;
    app.review = { by: { id: w.user.id, name: w.user.name }, at: new Date(now()).toISOString(), decision, note: cleanNote };
    await store.setJSON('apps/' + id, app);
    await notify(`${app.typeLabel} from ${app.applicant.name} was ${decision} by ${w.user.name}.`);
    return json({ ok: true, application: summary(app) });
  }

  async function putSettings(req) {
    checkWrite(req);
    const input = await readBody(req);
    const themeOnly = input && typeof input === 'object' && !Array.isArray(input) && Object.keys(input).length === 1 && Object.hasOwn(input, 'themes');
    const w = await whoIs(req, themeOnly ? { needStaff: true } : { needAdmin: true });
    const current = await loadSettings();
    const next = sanitizeSettings(input, current);
    next.meta = { updatedAt: new Date(now()).toISOString(), updatedBy: { id: w.user.id, name: w.user.name } };
    await store.setJSON('settings', next);
    return json({ ok: true, settings: next });
  }

  async function route(req) {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/api/, '').replace(/\/+$/, '') || '/';
    const method = req.method.toUpperCase();
    const is = (m, p) => method === m && path === p;

    if (is('GET', '/') || is('GET', '/health')) return json({ ok: true });
    if (is('GET', '/settings')) return json(publicSettings(await loadSettings()), 200, [['Cache-Control', 'no-store']]);
    if (is('GET', '/forms')) return json({ forms: publicForms() });
    if (is('GET', '/me')) return me(req);
    if (is('GET', '/auth/discord/login')) return discordLogin(req, url);
    if (is('GET', '/auth/discord/callback')) return discordCallback(req, url);
    if (is('POST', '/auth/logout')) {
      checkWrite(req);
      return json({ ok: true }, 200, [['Set-Cookie', clearCookie('lr_session')]]);
    }
    if (is('GET', '/auth/roblox/login')) return robloxLogin(req);
    if (is('GET', '/auth/roblox/callback')) return robloxCallback(req, url);
    if (is('POST', '/roblox/unlink')) return robloxUnlink(req);
    if (is('POST', '/applications')) return submitApplication(req);
    if (is('GET', '/applications/mine')) return myApplications(req);
    if (is('GET', '/staff/applications')) return staffList(req, url);
    let m;
    if (method === 'GET' && (m = path.match(/^\/staff\/applications\/([^/]+)$/))) return staffDetail(req, m[1]);
    if (method === 'POST' && (m = path.match(/^\/staff\/applications\/([^/]+)\/review$/))) return staffReview(req, m[1]);
    if (is('PUT', '/admin/settings')) return putSettings(req);
    throw new HttpError(404, 'Not found.');
  }

  return async function handle(req) {
    try {
      return await route(req);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: 'Something went wrong on the server.' }, 500);
    }
  };
}
