// Local preview server. NOT part of the deployed site.
// It serves public/ and the real API from src/core.mjs, with a pretend Discord server,
// a pretend ER:LC server and storage that lives in memory, so you can click through the
// dashboard and the staff panel without any keys.
//
//   node scripts/preview-server.mjs        then open http://localhost:4173
//   /api/dev-login?as=member   /api/dev-login?as=staff   /api/dev-login?as=admin
//
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createApi } from '../src/core.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT || 4173);
const SECRET = process.env.SESSION_SECRET || 'preview-secret-preview-secret-preview-1';
const GUILD = '1554210300377563226';
const STAFF_ROLE = '1558228597402243153';
const HEAD_ROLE = '1559256083292495962';

const PEOPLE = {
  member: { id: '100000000000000001', name: 'Member One', avatar: null, roles: [] },
  staff: { id: '100000000000000002', name: 'Staff One', avatar: null, roles: [STAFF_ROLE] },
  admin: { id: '100000000000000003', name: 'Head One', avatar: null, roles: [STAFF_ROLE, HEAD_ROLE] }
};
const BY_ID = new Map(Object.values(PEOPLE).map((p) => [p.id, p]));

const ROLES = [
  { id: HEAD_ROLE, name: 'Head of Staff', color: 0xFFB020, position: 9 },
  { id: STAFF_ROLE, name: 'Staff Team', color: 0x2B3DC4, position: 5 },
  { id: '1558209179276017735', name: 'Executive', color: 0xFF2E9A, position: 12 },
  { id: '1558209177778913330', name: 'Leadership', color: 0x1FF2B4, position: 11 }
];

// in-memory KV, same shape as src/kv.mjs
const data = new Map();
const store = {
  async get(key) { return data.has(key) ? JSON.parse(data.get(key)) : null; },
  async setJSON(key, value) { data.set(key, JSON.stringify(value)); },
  async delete(key) { data.delete(key); },
  async list({ prefix = '' } = {}) {
    return { blobs: [...data.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) };
  }
};

const avatar = (name) => `https://cdn.discordapp.com/embed/avatars/${name.charCodeAt(0) % 6}.png`;

const realFetch = globalThis.fetch;
const fakeFetch = async (url, init = {}) => {
  const u = String(url);
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  let m = u.match(new RegExp(`guilds/${GUILD}/members/(\\d+)$`));
  if (m) {
    const person = BY_ID.get(m[1]);
    return person ? json({ roles: person.roles }) : json({ message: 'Unknown Member' }, 404);
  }
  if (u.match(new RegExp(`guilds/${GUILD}/roles$`))) return json(ROLES);
  if (u.includes('/server/players')) {
    return json([
      { Player: 'Avery_TX:123', Team: 'Police', Callsign: 'LPD-4', Permission: 'Normal' },
      { Player: 'roberts:456', Team: 'Sheriff', Callsign: 'WCSO-1', Permission: 'Normal' },
      { Player: 'KingLaredo:789', Team: 'Fire', Callsign: 'LFD-2', Permission: 'Normal' },
      { Player: 'maddie:321', Team: 'DOT', Callsign: 'DOT-7', Permission: 'Normal' }
    ]);
  }
  if (u.includes('/server')) {
    return json({ Name: 'Laredo Roleplay | Border City RP', CurrentPlayers: 14, MaxPlayers: 40, JoinKey: 'LAREDO1' });
  }
  return realFetch(url, init);
};

const api = createApi({ store, env: { SESSION_SECRET: SECRET, ERLC_API_KEY: 'preview-key', DISCORD_BOT_TOKEN: 'preview-bot-token' }, fetch: fakeFetch });

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return body + '.' + mac;
}

// a little seed data so the staff page and the queue are not empty
await store.setJSON('team', {
  members: [
    { id: 'm-owner', name: 'Noah', title: 'Owner', team: 'ownership', color: '#2F3BFF', discord: '', avatar: '', bio: 'Started the community. Still in the lane at 2am.' },
    { id: 'm-exec', name: 'Riley', title: 'Executive Director', team: 'executive', color: '#FF2E9A', discord: '', avatar: '', bio: 'Events, partnerships and the awkward conversations.' },
    { id: 'm-mod', name: 'Casey', title: 'Head Moderator', team: 'moderator', color: '#FF2638', discord: '', avatar: '', bio: 'Reads every report twice.' }
  ],
  updatedAt: new Date().toISOString()
});

const seedApp = {
  id: '1800000000000-aaaaaaaa',
  type: 'staff',
  typeLabel: 'Staff application',
  status: 'pending',
  createdAt: new Date(Date.now() - 7200000).toISOString(),
  applicant: { id: PEOPLE.member.id, name: PEOPLE.member.name, avatar: avatar('M') },
  roblox: { id: '555', name: 'RobloxMember' },
  answers: [
    { id: 'roblox', label: 'Roblox username', value: 'RobloxMember' },
    { id: 'age', label: 'Age', value: '17' },
    { id: 'why', label: 'Why do you want to join?', value: 'I play most evenings and I would like to help keep the lanes clean.' }
  ],
  review: null
};
await store.setJSON('apps/' + seedApp.id, seedApp);
await store.setJSON('user-apps/' + seedApp.applicant.id + '/' + seedApp.id, { type: 'staff' });

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2'
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));

  if (url.pathname === '/api/dev-login') {
    const who = PEOPLE[url.searchParams.get('as')] || PEOPLE.member;
    const token = sign({ uid: who.id, name: who.name, av: null, exp: Math.floor(Date.now() / 1000) + 7 * 86400 });
    res.writeHead(302, {
      Location: '/#dashboard',
      'Set-Cookie': `lr_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 86400}`
    });
    res.end();
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    try {
      const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await new Promise((resolve) => {
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => resolve(Buffer.concat(chunks)));
      });
      // The browser's Origin is the preview address, which is not this server's own origin,
      // so it is dropped here. Production keeps the real check in src/core.mjs.
      const sendHeaders = { ...req.headers };
      delete sendHeaders.origin;
      const request = new Request(url.toString(), {
        method: req.method,
        headers: sendHeaders,
        body
      });
      const response = await api(request);
      const headers = Object.fromEntries(response.headers.entries());
      const cookies = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
      if (cookies.length) headers['set-cookie'] = cookies;
      res.writeHead(response.status, headers);
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (err) {
      console.error(err);
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'preview server error' }));
    }
    return;
  }

  let file = decodeURIComponent(url.pathname);
  if (file.endsWith('/')) file += 'index.html';
  const full = path.join(PUBLIC, file);
  if (!full.startsWith(PUBLIC)) { res.writeHead(403).end('no'); return; }
  try {
    const body = await fs.readFile(full);
    res.writeHead(200, { 'content-type': TYPES[path.extname(full).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(body);
  } catch {
    try {
      const body = await fs.readFile(path.join(PUBLIC, 'index.html'));
      res.writeHead(200, { 'content-type': TYPES['.html'], 'cache-control': 'no-cache' });
      res.end(body);
    } catch {
      res.writeHead(404).end('Not found');
    }
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('Laredo preview on http://localhost:' + PORT);
  console.log('Sign in as member: /api/dev-login?as=member   staff: ?as=staff   admin: ?as=admin');
});
