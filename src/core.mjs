// Backend for the Laredo Roleplay website. Everything that needs a secret or a permission check lives here.
// functions/api/[[path]].js connects this to Cloudflare. The tests in /tests run it with fake Discord, Roblox and storage.

import { FORMS, FORM_IDS, publicForms, validateAnswers } from './forms.mjs';

const GUILD_DEFAULT = '1554210300377563226';
const STAFF_ROLE_DEFAULT = '1558228597402243153'; // Staff Team: can open the staff panel
const ADMIN_ROLES_DEFAULT = [
  '1559256083292495962', // Head of Staff
  '1558209179276017735', // Executive
  '1558209177778913330', // Leadership
  '1558209180723060808'  // Discord Developer
]; // these can also change website settings

const THEMES = ['normal', 'light', 'halloween', 'christmas']; // normal means dark

export const THEME_KEYS = ['dark', 'light', 'halloween', 'christmas'];

export const DEPT_IDS = ['lpd', 'wcso', 'dps', 'lfd', 'fbi', 'bp', 'swat', 'dot'];

// The teams shown on the staff page. Colours and wording live in public/site.js.
export const TEAM_IDS = [
  'ownership', 'executive', 'community', 'discord_dev', 'server_dev',
  'internal_affairs', 'management', 'supervisory', 'administrator', 'moderator'
];

// Things a member can collect. `earned` items are given automatically, the rest are handed out by staff.
export const INVENTORY = [
  { id: 'resident', name: 'Laredo Resident', kind: 'earned', rarity: 'common', hint: 'Sign in with Discord' },
  { id: 'verified', name: 'Verified', kind: 'earned', rarity: 'uncommon', hint: 'Link your Roblox account' },
  { id: 'applicant', name: 'Applicant', kind: 'earned', rarity: 'uncommon', hint: 'Send your first application' },
  { id: 'streak3', name: 'Regular', kind: 'earned', rarity: 'rare', hint: 'Check in three days in a row' },
  { id: 'streak7', name: 'Local', kind: 'earned', rarity: 'rare', hint: 'Check in seven days in a row' },
  { id: 'streak14', name: 'Border Veteran', kind: 'earned', rarity: 'epic', hint: 'Check in fourteen days in a row' },
  { id: 'team', name: 'Staff Team', kind: 'earned', rarity: 'epic', hint: 'Join the staff team' },
  { id: 'winter', name: 'Snowed In', kind: 'grant', rarity: 'rare', hint: 'A winter event award' },
  { id: 'gold_star', name: 'Gold Star', kind: 'grant', rarity: 'rare', hint: 'Handed out by staff for good work' },
  { id: 'neon', name: 'Neon Nameplate', kind: 'grant', rarity: 'epic', hint: 'A staff award' },
  { id: 'founder', name: 'Founder', kind: 'grant', rarity: 'legendary', hint: 'For the people who built Laredo' },
  // passes are worn in the dashboard and open the collectable looks in the look menu
  { id: 'pass_neon', name: 'Neon Pass', kind: 'grant', rarity: 'epic', hint: 'Unlocks the Neon Night look' },
  { id: 'pass_dusk', name: 'Dusk Pass', kind: 'grant', rarity: 'epic', hint: 'Unlocks the Desert Dusk look' },
  { id: 'pass_emerald', name: 'Emerald Pass', kind: 'grant', rarity: 'epic', hint: 'Unlocks the Emerald look' },
  { id: 'pass_vapor', name: 'Vapor Pass', kind: 'grant', rarity: 'epic', hint: 'Unlocks the Vapor look' },
  // auras change the weather across the site while worn
  { id: 'aurora', name: 'Aurora Aura', kind: 'grant', rarity: 'legendary', hint: 'An animated ring around your avatar' },
  { id: 'ember', name: 'Ember Aura', kind: 'grant', rarity: 'rare', hint: 'Embers drift with whatever look you use' }
];

const INVENTORY_IDS = INVENTORY.map((i) => i.id);

// how the dashboard draws a server that has no ER:LC key yet
export const SERVER_FALLBACK = {
  configured: false, live: false, name: 'Laredo Roleplay', players: null, maxPlayers: null,
  players5m: null, joinCode: '', updatedAt: null, roster: []
};

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
  prices: { ...PRICE_DEFAULTS },
  // Staff can turn a look off for everybody. A visitor who had it saved falls back to the default look.
  themes: { dark: true, light: true, halloween: true, christmas: true },
  dashboard: {
    kicker: 'Your Laredo',
    welcome: 'Welcome back',
    tagline: 'Your applications, your badges, and what is happening in the city tonight.',
    showServer: true,
    showTeam: true,
    showInventory: true,
    showRoster: true
  },
  shopOpen: true
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
  if (THEMES.includes(saved.defaultTheme)) out.defaultTheme = saved.defaultTheme;
  for (const id of FORM_IDS) if (saved.applications && saved.applications[id]) Object.assign(out.applications[id], saved.applications[id]);
  for (const id of DEPT_IDS) if (saved.departments && saved.departments[id]) Object.assign(out.departments[id], saved.departments[id]);
  for (const key of Object.keys(PRICE_DEFAULTS)) {
    if (saved.prices && Number.isFinite(saved.prices[key])) out.prices[key] = saved.prices[key];
  }
  if (saved.themes) for (const key of THEME_KEYS) if (saved.themes[key] !== undefined) out.themes[key] = Boolean(saved.themes[key]);
  if (saved.dashboard) {
    const d = saved.dashboard;
    for (const key of ['kicker', 'welcome', 'tagline']) {
      if (typeof d[key] === 'string') out.dashboard[key] = d[key];
    }
    for (const key of ['showServer', 'showTeam', 'showInventory', 'showRoster']) {
      if (d[key] !== undefined) out.dashboard[key] = Boolean(d[key]);
    }
  }
  if (saved.shopOpen !== undefined) out.shopOpen = Boolean(saved.shopOpen);
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
    if (!THEMES.includes(input.defaultTheme)) throw new HttpError(400, 'Default look must be dark, light, halloween or christmas.');
    next.defaultTheme = input.defaultTheme;
  }
  if (input.themes !== undefined) {
    const t = input.themes || {};
    for (const key of THEME_KEYS) if (t[key] !== undefined) next.themes[key] = Boolean(t[key]);
    if (!Object.values(next.themes).some(Boolean)) throw new HttpError(400, 'Leave at least one theme switched on.');
    const offKey = next.defaultTheme === 'normal' ? 'dark' : next.defaultTheme;
    if (!next.themes[offKey]) throw new HttpError(400, 'The default look is switched off. Pick another default or turn that one back on.');
  }
  if (input.dashboard !== undefined) {
    const d = input.dashboard || {};
    if (d.kicker !== undefined) {
      const v = String(d.kicker || '').trim();
      if (v.length > 30) throw new HttpError(400, 'The dashboard kicker is too long (30 characters at most).');
      next.dashboard.kicker = v || DEFAULT_SETTINGS.dashboard.kicker;
    }
    if (d.welcome !== undefined) {
      const v = String(d.welcome || '').trim();
      if (v.length > 40) throw new HttpError(400, 'The dashboard welcome line is too long (40 characters at most).');
      next.dashboard.welcome = v || DEFAULT_SETTINGS.dashboard.welcome;
    }
    if (d.tagline !== undefined) {
      const v = String(d.tagline || '').trim();
      if (v.length > 160) throw new HttpError(400, 'The dashboard tagline is too long (160 characters at most).');
      next.dashboard.tagline = v;
    }
    for (const key of ['showServer', 'showTeam', 'showInventory', 'showRoster']) {
      if (d[key] !== undefined) next.dashboard[key] = Boolean(d[key]);
    }
  }
  if (input.shopOpen !== undefined) next.shopOpen = Boolean(input.shopOpen);
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

// ------------------------------------------------------------------ staff page
const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const DISCORD_ID_RE = /^\d{1,25}$/;

// Checks a team list sent by a staff admin. Empty names are dropped rather than refused.
export function sanitizeTeam(input) {
  const list = input && Array.isArray(input.members) ? input.members : null;
  if (!list) throw new HttpError(400, 'Missing the member list.');
  if (list.length > 120) throw new HttpError(400, 'That is a lot of people. Keep the list to 120 members or fewer.');
  const members = [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const name = String(raw.name || '').trim().slice(0, 40);
    if (!name) continue;
    const title = String(raw.title || '').trim().slice(0, 48);
    const bio = String(raw.bio || '').trim();
    if (bio.length > 300) throw new HttpError(400, 'Keep each bio to 300 characters or fewer.');
    const team = TEAM_IDS.includes(raw.team) ? raw.team : 'moderator';
    const wanted = String(raw.color || '').trim();
    if (wanted && !HEX_RE.test(wanted)) throw new HttpError(400, 'A name colour must look like #F2701D.');
    const colour = wanted;
    const discord = String(raw.discord || '').trim();
    if (discord && !DISCORD_ID_RE.test(discord)) throw new HttpError(400, 'A Discord ID is numbers only (or leave it blank).');
    const avatar = String(raw.avatar || '').trim();
    if (avatar && !isHttps(avatar)) throw new HttpError(400, 'A custom avatar link must start with https://');
    members.push({
      id: /^[a-z0-9-]{6,40}$/.test(String(raw.id || '')) ? String(raw.id) : 'm-' + members.length + '-' + Math.random().toString(36).slice(2, 8),
      name,
      title,
      team,
      color: colour,
      discord,
      avatar: avatar.slice(0, 300),
      bio
    });
  }
  return { members };
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toB64u(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64u(text) {
  let b = String(text).replace(/-/g, '+').replace(/_/g, '/');
  while (b.length % 4) b += '=';
  const bin = atob(b);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n));
const toHex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

export function createApi({ store, fetch: fetchImpl = globalThis.fetch, env = {}, now = () => Date.now(), memberCache = new Map() }) {
  const secret = env.SESSION_SECRET || '';
  const guildId = env.DISCORD_GUILD_ID || GUILD_DEFAULT;
  const staffRole = env.STAFF_ROLE_ID || STAFF_ROLE_DEFAULT;
  const adminRoles = env.ADMIN_ROLE_IDS
    ? env.ADMIN_ROLE_IDS.split(',').map((s) => s.trim()).filter(Boolean)
    : ADMIN_ROLES_DEFAULT;

  // ------------------------------------------------------------ small helpers
  const nowSec = () => Math.floor(now() / 1000);
  const randomHex = (n) => toHex(randomBytes(n));

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

  let keyPromise = null;
  const getKey = () => (keyPromise ||= crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']));

  async function sign(payload) {
    const body = toB64u(encoder.encode(JSON.stringify(payload)));
    const mac = new Uint8Array(await crypto.subtle.sign('HMAC', await getKey(), encoder.encode(body)));
    return body + '.' + toB64u(mac);
  }

  async function verify(token) {
    if (!token || !secret) return null;
    const [body, mac] = String(token).split('.');
    if (!body || !mac) return null;
    try {
      const good = await crypto.subtle.verify('HMAC', await getKey(), fromB64u(mac), encoder.encode(body));
      if (!good) return null;
      const payload = JSON.parse(decoder.decode(fromB64u(body)));
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

  // The origin that sign-in bounces back to. Discord only accepts a redirect_uri that is
  // registered on the app word for word, so when SITE_URL is set it wins over whatever
  // hostname the visitor happens to be on (a preview deployment, a custom domain, www).
  function siteOrigin(req) {
    if (env.SITE_URL) {
      try {
        const site = new URL(String(env.SITE_URL).trim());
        if (site.protocol === 'https:' || site.protocol === 'http:') return site.origin;
      } catch { /* a typo in SITE_URL falls back to the request origin */ }
    }
    return new URL(req.url).origin;
  }

  // Everything a person needs to compare our settings with the Discord developer portal.
  // Nothing secret is in here: the client id already travels in the browser's URL.
  function authDiagnostic(req) {
    const origin = siteOrigin(req);
    const reqOrigin = new URL(req.url).origin;
    return json({
      siteUrl: env.SITE_URL || '',
      requestOrigin: reqOrigin,
      origin,
      // if these two differ, the visitor is on a hostname Discord does not know about
      matchesRequest: origin === reqOrigin,
      clientId: env.DISCORD_CLIENT_ID || '',
      discordRedirectUri: origin + '/api/auth/discord/callback',
      robloxRedirectUri: origin + '/api/auth/roblox/callback',
      guildId,
      // what the dashboard needs before it can read roles: a bot token, and the bot
      // itself must be in the server above
      botToken: Boolean(env.DISCORD_BOT_TOKEN),
      env: {
        SESSION_SECRET: Boolean(env.SESSION_SECRET && String(env.SESSION_SECRET).length >= 32),
        DISCORD_CLIENT_ID: Boolean(env.DISCORD_CLIENT_ID),
        DISCORD_CLIENT_SECRET: Boolean(env.DISCORD_CLIENT_SECRET),
        DISCORD_BOT_TOKEN: Boolean(env.DISCORD_BOT_TOKEN),
        DISCORD_GUILD_ID: Boolean(env.DISCORD_GUILD_ID)
      }
    }, 200, [['Cache-Control', 'no-store']]);
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
    // Roles live behind the bot. Without its token the site can still sign people in,
    // it just cannot say who is staff, so say that in plain words instead of failing.
    if (!env.DISCORD_BOT_TOKEN) {
      throw new HttpError(503, 'Your Discord roles could not be read because the site’s Discord bot token has not been set up yet. You are signed in, but staff access and role badges stay off until it is.');
    }
    const res = await fetchImpl(`https://discord.com/api/v10/guilds/${guildId}/members/${uid}`, {
      headers: { Authorization: 'Bot ' + env.DISCORD_BOT_TOKEN }
    });
    let value = null;
    if (res.status === 404) value = null;
    else if (!res.ok) throw new HttpError(502, 'Could not check your Discord roles right now. Try again in a minute.');
    else {
      const m = await res.json();
      value = { roles: Array.isArray(m.roles) ? m.roles : [] };
    }
    memberCache.set(uid, { at: now(), value });
    return value;
  }

  // Role names and colours, so the dashboard can show real Discord roles (not just IDs).
  let rolesCache = { at: 0, value: null };
  async function getGuildRoles() {
    if (rolesCache.value && now() - rolesCache.at < 10 * 60 * 1000) return rolesCache.value;
    if (!env.DISCORD_BOT_TOKEN) return null;
    try {
      const res = await fetchImpl(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
        headers: { Authorization: 'Bot ' + env.DISCORD_BOT_TOKEN }
      });
      if (!res.ok) return rolesCache.value;
      const roles = await res.json();
      const list = (Array.isArray(roles) ? roles : []).filter((r) => r && r.id && r.name !== '@everyone');
      rolesCache = { at: now(), value: list };
      return list;
    } catch { return rolesCache.value; }
  }

  async function sessionFrom(req) {
    return verify(parseCookies(req.headers.get('cookie')).lr_session);
  }

  async function requireSession(req) {
    const session = await sessionFrom(req);
    if (!session) throw new HttpError(401, 'Please sign in with Discord.');
    return session;
  }

  async function whoIs(req, { needMember = false, needStaff = false, needAdmin = false } = {}) {
    const session = await requireSession(req);
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
    copy.erlcConfigured = Boolean(env.ERLC_API_KEY);
    return copy;
  }

  // ------------------------------------------------------------------ members
  const dayNumber = (ms) => Math.floor(ms / 86400000);

  async function getProfile(uid) {
    const saved = await store.get('profile/' + uid, { type: 'json' });
    return {
      equipped: saved && INVENTORY_IDS.includes(saved.equipped) ? saved.equipped : '',
      extra: saved && Array.isArray(saved.extra) ? saved.extra.filter((id) => INVENTORY_IDS.includes(id)) : [],
      checkin: saved && saved.checkin && typeof saved.checkin === 'object'
        ? { last: String(saved.checkin.last || ''), streak: Number(saved.checkin.streak) || 0, total: Number(saved.checkin.total) || 0 }
        : { last: '', streak: 0, total: 0 }
    };
  }

  async function saveProfile(uid, profile) {
    await store.setJSON('profile/' + uid, profile);
  }

  function inventoryFor(profile, facts) {
    const earned = [];
    if (facts.loggedIn) earned.push('resident');
    if (facts.roblox) earned.push('verified');
    if (facts.applications > 0) earned.push('applicant');
    if (facts.streak >= 3) earned.push('streak3');
    if (facts.streak >= 7) earned.push('streak7');
    if (facts.streak >= 14) earned.push('streak14');
    if (facts.isStaff) earned.push('team');
    const owned = new Set(earned.concat(profile.extra));
    const equipped = owned.has(profile.equipped) ? profile.equipped : '';
    return {
      owned: INVENTORY.filter((i) => owned.has(i.id)),
      equipped,
      streak: profile.checkin.streak,
      total: profile.checkin.total,
      canCheckIn: profile.checkin.last !== String(dayNumber(now())),
      lastCheckIn: profile.checkin.last || ''
    };
  }

  // ------------------------------------------------------------------ ER:LC
  // The ER:LC private server API. Its address moved from policeroleplay.community to erlc.gg,
  // so both are tried. ERLC_API_BASE can point somewhere else (or at a mock) if needed.
  let erlcCache = { at: 0, value: null };
  const erlcBases = () => {
    const list = [env.ERLC_API_BASE, 'https://api.erlc.gg/v1', 'https://api.policeroleplay.community/v1']
      .filter(Boolean).map((b) => String(b).replace(/\/+$/, ''));
    return [...new Set(list)];
  };

  const pick = (obj, keys, fallback) => {
    if (!obj || typeof obj !== 'object') return fallback;
    for (const key of keys) if (obj[key] !== undefined && obj[key] !== null) return obj[key];
    return fallback;
  };

  // The player field looks like "Name:12345" in the players endpoint.
  const cleanPlayerName = (value) => String(value || '').split(':')[0].trim();

  async function readErlcKey() {
    if (env.ERLC_API_KEY) return env.ERLC_API_KEY;
    const saved = await store.get('erlc-key');
    return typeof saved === 'string' ? saved : '';
  }

  async function erlcGet(base, path, key) {
    const res = await fetchImpl(base + path, {
      headers: { 'Server-Key': key, 'server-key': key, Accept: 'application/json' },
      signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(6000) : undefined
    });
    if (!res.ok) throw new Error('ER:LC said ' + res.status);
    return res.json();
  }

  async function serverStatus() {
    if (erlcCache.value && now() - erlcCache.at < 20000) return erlcCache.value;
    const key = await readErlcKey();
    if (!key) {
      erlcCache = { at: now(), value: { ...SERVER_FALLBACK } };
      return erlcCache.value;
    }
    let info = null;
    for (const base of erlcBases()) {
      try { info = await erlcGet(base, '/server', key); break; } catch { /* try the next address */ }
    }
    if (!info) {
      const value = { ...SERVER_FALLBACK, configured: true, live: false, error: 'unreachable', updatedAt: new Date(now()).toISOString() };
      erlcCache = { at: now(), value };
      return value;
    }

    let rows = Array.isArray(info.Players) ? info.Players : null;
    if (!rows) {
      for (const base of erlcBases()) {
        try {
          const list = await erlcGet(base, '/server/players', key);
          rows = Array.isArray(list) ? list : (list && (list.Players || list.players)) || [];
          break;
        } catch { /* the roster is a bonus; the count still works */ }
      }
    }
    const players = Number(pick(info, ['CurrentPlayers', 'PlayerCount', 'playerCount', 'players'], rows ? rows.length : 0)) || 0;
    const maxPlayers = Number(pick(info, ['MaxPlayers', 'maxPlayers', 'max_players'], 0)) || null;
    const value = {
      configured: true, live: true,
      name: String(pick(info, ['Name', 'name'], 'Laredo Roleplay')).slice(0, 60),
      players, maxPlayers,
      joinCode: String(pick(info, ['JoinKey', 'JoinCode', 'joinCode'], '')).slice(0, 12),
      updatedAt: new Date(now()).toISOString(),
      roster: (rows || []).slice(0, 40).map((p) => ({
        name: (cleanPlayerName(pick(p, ['Username', 'username', 'Player', 'Name', 'name'], 'Player')) || 'Player').slice(0, 40),
        team: String(pick(p, ['Team', 'team'], '')).slice(0, 30),
        callsign: String(pick(p, ['Callsign', 'callsign'], '')).slice(0, 30),
        permission: String(pick(p, ['Permission', 'permission'], '')).slice(0, 24)
      }))
    };
    erlcCache = { at: now(), value };
    return value;
  }

  async function saveErlcKey(req) {
    checkWrite(req);
    const w = await whoIs(req, { needAdmin: true });
    const body = await readBody(req);
    const key = String(body.key || '').trim();
    if (key && !/^[A-Za-z0-9_-]{8,120}$/.test(key)) throw new HttpError(400, 'That does not look like an ER:LC server key.');
    if (key) await store.setJSON('erlc-key', key); else await store.delete('erlc-key');
    erlcCache = { at: 0, value: null };
    return json({ ok: true, configured: Boolean(key || env.ERLC_API_KEY), by: w.user.name });
  }

  // ------------------------------------------------------------- staff page
  async function teamList() {
    const saved = await store.get('team', { type: 'json' });
    const members = saved && Array.isArray(saved.members) ? saved.members : [];
    return { members, updatedAt: saved && saved.updatedAt ? saved.updatedAt : null };
  }

  async function putTeam(req) {
    checkWrite(req);
    const w = await whoIs(req, { needAdmin: true });
    const body = await readBody(req);
    const clean = sanitizeTeam(body);
    const saved = { ...clean, updatedAt: new Date(now()).toISOString(), updatedBy: w.user.name };
    await store.setJSON('team', saved);
    return json({ ok: true, team: saved });
  }

  // ------------------------------------------------------------------ my page
  async function myInventory(req) {
    const session = await requireSession(req);
    const profile = await getProfile(session.uid);
    const roblox = await store.get('roblox/' + session.uid, { type: 'json' });
    let isStaff = false;
    try { const w = await whoIs(req); isStaff = w.isStaff; } catch { /* stay offline-friendly */ }
    const apps = await userApps(session.uid);
    return json({ inventory: inventoryFor(profile, { loggedIn: true, roblox: Boolean(roblox), applications: apps.length, isStaff }) });
  }

  async function equipItem(req) {
    checkWrite(req);
    const session = await requireSession(req);
    const { item } = await readBody(req);
    const profile = await getProfile(session.uid);
    const roblox = await store.get('roblox/' + session.uid, { type: 'json' });
    let isStaff = false;
    try { const w = await whoIs(req); isStaff = w.isStaff; } catch { /* ignore */ }
    const apps = await userApps(session.uid);
    const owned = inventoryFor(profile, { loggedIn: true, roblox: Boolean(roblox), applications: apps.length, isStaff }).owned.map((i) => i.id);
    const wanted = String(item || '');
    if (wanted && !owned.includes(wanted)) throw new HttpError(403, 'You do not own that yet.');
    profile.equipped = wanted && wanted !== profile.equipped ? wanted : '';
    await saveProfile(session.uid, profile);
    return json({ ok: true, equipped: profile.equipped });
  }

  async function checkIn(req) {
    checkWrite(req);
    const session = await requireSession(req);
    const profile = await getProfile(session.uid);
    const today = dayNumber(now());
    if (profile.checkin.last === String(today)) {
      return json({ ok: true, already: true, streak: profile.checkin.streak, total: profile.checkin.total });
    }
    const yesterday = String(today - 1);
    profile.checkin.streak = profile.checkin.last === yesterday ? profile.checkin.streak + 1 : 1;
    profile.checkin.total += 1;
    profile.checkin.last = String(today);
    await saveProfile(session.uid, profile);
    return json({ ok: true, already: false, streak: profile.checkin.streak, total: profile.checkin.total });
  }

  // ---------------------------------------------------- staff awards (admin)
  async function adminMember(req, url) {
    await whoIs(req, { needAdmin: true });
    const uid = String(url.searchParams.get('id') || '');
    if (!DISCORD_ID_RE.test(uid)) throw new HttpError(400, 'Enter the member’s Discord ID (numbers).');
    const profile = await getProfile(uid);
    return json({ id: uid, extra: profile.extra, equipped: profile.equipped, checkin: profile.checkin });
  }

  async function awardItems(req) {
    checkWrite(req);
    await whoIs(req, { needAdmin: true });
    const body = await readBody(req);
    const uid = String(body.userId || '').trim();
    if (!DISCORD_ID_RE.test(uid)) throw new HttpError(400, 'Enter the member’s Discord ID (numbers).');
    const items = Array.isArray(body.items) ? body.items.map(String) : [];
    if (items.length > INVENTORY_IDS.length) throw new HttpError(400, 'Unknown item.');
    for (const id of items) if (!INVENTORY_IDS.includes(id)) throw new HttpError(400, 'Unknown item: ' + id);
    const profile = await getProfile(uid);
    profile.extra = [...new Set(items)].filter((id) => INVENTORY.find((i) => i.id === id).kind === 'grant');
    await saveProfile(uid, profile);
    return json({ ok: true, items: profile.extra });
  }

  // ------------------------------------------------------------------ routes
  async function discordLogin(req, url) {
    // Starting from a hostname Discord does not know about (a preview deployment, www, a
    // custom domain) would fail the redirect check and would leave the state cookie on the
    // wrong host. Send the whole flow to the one canonical origin instead.
    const canonical = siteOrigin(req);
    if (env.SITE_URL && canonical !== new URL(req.url).origin) return redirect(canonical + url.pathname + url.search);
    if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET || !secret) return redirect(siteOrigin(req) + '/?auth_error=config#dashboard');
    const next = /^[a-z0-9/_-]{1,40}$/.test(url.searchParams.get('next') || '') ? url.searchParams.get('next') : 'dashboard';
    const state = randomHex(16);
    const params = new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      response_type: 'code',
      redirect_uri: siteOrigin(req) + '/api/auth/discord/callback',
      scope: 'identify',
      state
    });
    return redirect('https://discord.com/oauth2/authorize?' + params, [
      cookie('lr_oauth_d', await sign({ s: state, next, exp: nowSec() + 600 }), { maxAge: 600, path: '/api/auth' })
    ]);
  }

  async function discordCallback(req, url) {
    const origin = siteOrigin(req);
    const clear = clearCookie('lr_oauth_d', '/api/auth');
    const fail = (code) => redirect(`${origin}/?auth_error=${code}#dashboard`, [clear]);
    const saved = await verify(parseCookies(req.headers.get('cookie')).lr_oauth_d);
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
      const session = await sign({ uid: String(u.id), name: u.global_name || u.username, av: u.avatar || null, exp: nowSec() + 7 * 86400 });
      return redirect(`${origin}/#${saved.next || 'dashboard'}`, [
        cookie('lr_session', session, { maxAge: 7 * 86400 }), clear
      ]);
    } catch {
      return fail('network');
    }
  }

  async function me(req) {
    const session = await sessionFrom(req);
    const base = { robloxConfigured: Boolean(env.ROBLOX_CLIENT_ID && env.ROBLOX_CLIENT_SECRET) };
    if (!session) return json({ loggedIn: false, ...base });
    let inGuild = null, isStaff = false, isAdmin = false, warning = null, member = null;
    try {
      const w = await whoIs(req);
      inGuild = Boolean(w.member); isStaff = w.isStaff; isAdmin = w.isAdmin; member = w.member;
    } catch (e) {
      if (!(e instanceof HttpError)) throw e;
      warning = e.message;
    }
    const roblox = await store.get('roblox/' + session.uid, { type: 'json' });
    const profile = await getProfile(session.uid);
    const apps = await userApps(session.uid);

    // Real Discord roles, with their names and colours.
    let roles = [];
    if (member && member.roles && member.roles.length) {
      const all = await getGuildRoles();
      if (all) {
        const byId = new Map(all.map((r) => [String(r.id), r]));
        roles = member.roles.map((id) => byId.get(String(id))).filter(Boolean)
          .sort((a, b) => (b.position || 0) - (a.position || 0))
          .map((r) => ({ id: String(r.id), name: String(r.name).slice(0, 40), color: Number(r.color) || 0 }))
          .slice(0, 8);
      }
    }

    return json({
      loggedIn: true, ...base,
      user: { id: session.uid, name: session.name, avatar: avatarUrl(session.uid, session.av) },
      inGuild, isStaff, isAdmin, roblox: roblox || null, warning, roles,
      inventory: inventoryFor(profile, { loggedIn: true, roblox: Boolean(roblox), applications: apps.length, isStaff }),
      checkin: { streak: profile.checkin.streak, total: profile.checkin.total, last: profile.checkin.last || '', canCheckIn: profile.checkin.last !== String(dayNumber(now())) }
    });
  }

  async function robloxLogin(req) {
    const origin = siteOrigin(req);
    const session = await sessionFrom(req);
    if (!session) return redirect(origin + '/?auth_error=signin#dashboard');
    if (!env.ROBLOX_CLIENT_ID || !env.ROBLOX_CLIENT_SECRET) return redirect(origin + '/?auth_error=roblox_config#dashboard');
    const state = randomHex(16);
    const verifier = toB64u(randomBytes(32));
    const challenge = toB64u(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(verifier))));
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
      cookie('lr_oauth_r', await sign({ s: state, v: verifier, uid: session.uid, exp: nowSec() + 600 }), { maxAge: 600, path: '/api/auth' })
    ]);
  }

  async function robloxCallback(req, url) {
    const origin = siteOrigin(req);
    const clear = clearCookie('lr_oauth_r', '/api/auth');
    const fail = (code) => redirect(`${origin}/?auth_error=${code}#dashboard`, [clear]);
    const session = await sessionFrom(req);
    const saved = await verify(parseCookies(req.headers.get('cookie')).lr_oauth_r);
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
    const session = await requireSession(req);
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
    const session = await requireSession(req);
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
    const w = await whoIs(req, { needAdmin: true });
    const input = await readBody(req);
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
    if (is('GET', '/server')) return json(await serverStatus());
    if (is('GET', '/team')) return json(await teamList());
    if (is('GET', '/inventory')) return json({ catalogue: INVENTORY });
    if (is('GET', '/me/inventory')) return myInventory(req);
    if (is('POST', '/me/inventory/equip')) return equipItem(req);
    if (is('POST', '/me/checkin')) return checkIn(req);
    if (is('GET', '/auth/discord/diagnostic')) return authDiagnostic(req);
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
    if (is('GET', '/admin/team')) {
      await whoIs(req, { needAdmin: true });
      return json(await teamList());
    }
    if (is('PUT', '/admin/team')) return putTeam(req);
    if (is('GET', '/admin/member')) return adminMember(req, url);
    if (is('PUT', '/admin/member/items')) return awardItems(req);
    if (is('PUT', '/admin/erlc-key')) return saveErlcKey(req);
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
