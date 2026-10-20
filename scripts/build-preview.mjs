/* Builds preview/index.html: the real site, inlined into one file, with mock API data.
 *
 *   node scripts/build-preview.mjs      (or: npm run preview:build)
 *
 * The mock JSON in preview/mock/ was captured from the local preview server while signed in
 * as staff, so every page renders as if a staff admin were looking at it. Nothing here talks
 * to Discord, Roblox or ER:LC, and nothing in this file is used by the deployed site.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = path.join(root, 'public');
const preview = path.join(root, 'preview');
const read = (p) => fs.readFileSync(p, 'utf8');
const mock = (name) => JSON.parse(read(path.join(preview, 'mock', name)));

let html = read(path.join(pub, 'index.html'));
const css = read(path.join(pub, 'styles.css'));
const site = read(path.join(pub, 'site.js'));
const config = read(path.join(pub, 'config.js'));
const logo = fs.readFileSync(path.join(preview, 'logo.png')).toString('base64');

/* ------------------------------------------------------------------ mock data */
const data = {
  settings: mock('settings.json'),
  me: mock('me.json'),
  forms: mock('forms.json'),
  server: mock('server.json'),
  team: mock('team.json'),
  inventory: mock('inventory.json'),
  staffApplications: mock('staff_applications.json'),
  adminTeam: mock('admin_team.json'),
  announcements: mock('announcements.json'),
  member: { extra: ['resident'] },
};

const catalogue = Object.fromEntries((data.inventory.catalogue || []).map((i) => [i.id, i]));
const owned = ['resident', 'verified', 'applicant', 'regular', 'local', 'team', 'snowed'].filter((id) => catalogue[id]);
data.me.inventory.owned = owned.map((id) => catalogue[id]);
data.me.inventory.equipped = catalogue.team ? 'team' : '';
data.me.inventory.streak = 3;
data.me.inventory.total = 12;
data.me.inventory.lastCheckIn = '2026-10-19T20:10:00.000Z';
data.me.inventory.canCheckIn = true;
data.me.checkin = { streak: 3, total: 12, last: '2026-10-19T20:10:00.000Z', canCheckIn: true };
data.applicationsMine = {
  applications: [
    {
      id: '1800000000001-bbbbbbbb', type: 'staff', typeLabel: 'Staff application', status: 'accepted',
      createdAt: '2026-09-02T18:20:00.000Z',
      review: { by: { name: 'Head One' }, at: '2026-09-04T11:05:00.000Z', note: 'Welcome aboard.' },
    },
    {
      id: '1800000000002-cccccccc', type: 'discord_dev', typeLabel: 'Discord developer application', status: 'pending',
      createdAt: '2026-10-18T21:40:00.000Z', review: null,
    },
  ],
};

const first = data.staffApplications.applications && data.staffApplications.applications[0];
data.staffDetail = first ? {
  application: {
    ...first,
    answers: [
      { label: 'Why do you want to join the team?', value: 'I play most evenings and I like helping new players settle in.\nI know the rules well.' },
      { label: 'How old are you?', value: '17' },
      { label: 'Timezone', value: 'Europe/London' },
      { label: 'Anything else we should know?', value: 'I have previous staff experience on two smaller servers.' },
    ],
  },
} : { application: {} };

/* Discord avatars are swapped for inline initials so the file works offline. */
const palette = ['#F2701D', '#2BB7DC', '#F7C948', '#FF5C8A', '#5FCB8B'];
const initials = (n, i) => 'data:image/svg+xml;charset=utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="32" fill="${palette[i % palette.length]}"/><text x="32" y="41" font-family="Barlow,Arial" font-size="26" font-weight="700" text-anchor="middle" fill="#0A1020">${n}</text></svg>`);
const seen = {};
const avatarFor = (url) => {
  if (!seen[url]) seen[url] = initials(['LR', 'M1', 'ST', 'H1', 'AD'][Object.keys(seen).length % 5], Object.keys(seen).length);
  return seen[url];
};
const swapAvatars = (value) => JSON.parse(JSON.stringify(value, (k, v) => (
  typeof v === 'string' && /^https:\/\/cdn\.discordapp\.com\/(embed\/avatars|avatars)\//.test(v) ? avatarFor(v) : v
)));

const mockScript = `
(function () {
  var DATA = ${JSON.stringify(swapAvatars(data))};
  function ok(data, status) {
    status = status || 200;
    return Promise.resolve({
      ok: status < 400, status: status,
      json: function () { return Promise.resolve(data); },
      text: function () { return Promise.resolve(JSON.stringify(data)); },
      headers: { get: function () { return 'application/json'; } }
    });
  }
  function byPath(p) {
    p = (p || '').split('?')[0];
    if (p === '/settings') return DATA.settings;
    if (p === '/me') return DATA.me;
    if (p === '/forms') return DATA.forms;
    if (p === '/server') return DATA.server;
    if (p === '/team') return DATA.team;
    if (p === '/inventory') return DATA.inventory;
    if (p === '/applications/mine') return DATA.applicationsMine;
    if (p === '/staff/applications') return DATA.staffApplications;
    if (p.indexOf('/staff/applications/') === 0) return DATA.staffDetail;
    if (p === '/admin/team') return DATA.adminTeam;
    if (p === '/admin/member') return DATA.member;
    return null;
  }
  function afterPost(p) {
    if (p === '/me/checkin') return { ok: true, already: false, streak: 4, total: 13 };
    if (p === '/me/inventory/equip') return { ok: true, equipped: '' };
    if (p === '/admin/settings') return { ok: true, settings: DATA.settings };
    if (p === '/applications') return { ok: true, id: 'demo' };
    return { ok: true };
  }
  var original = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function (url, opts) {
    var href = String(url && url.url ? url.url : url);
    var method = ((opts && opts.method) || (url && url.method) || 'GET').toUpperCase();
    var p = href.replace(/^https?:\\/\\/[^/]+/, '');
    if (p.indexOf('/api') === 0) {
      var key = p.slice(4);
      if (method === 'GET') {
        var found = byPath(key);
        if (found === null) return ok({ error: 'Not available in this offline preview.' }, 404);
        return ok(found);
      }
      return ok(afterPost(key.split('?')[0]));
    }
    if (/announcements\\.json/.test(p)) return ok(DATA.announcements);
    if (original) return original(url, opts);
    return Promise.reject(new Error('offline'));
  };
  // there is no server behind this file, so explain instead of failing silently
  window.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[href^="/api/"]') : null;
    if (!a) return;
    e.preventDefault();
    var box = document.querySelector('.notice-slot') || document.body;
    var note = document.createElement('p');
    note.className = 'alert';
    note.textContent = 'This is a design preview, so sign-in and Roblox links are turned off.';
    box.appendChild(note);
    setTimeout(function () { note.remove(); }, 4000);
  }, true);
})();
`;

/* ------------------------------------------------------------------ inlining */
// Function replacers, because "$$" in CSS/JS collapses to "$" in a string replacement.
const put = (src, needle, value) => {
  if (!src.includes(needle)) throw new Error('build-preview: anchor missing: ' + needle.slice(0, 48));
  return src.replace(needle, () => value);
};

const logoUrl = `data:image/png;base64,${logo}`;
html = put(html, '<link rel="stylesheet" href="styles.css">', '<style>\n' + css + '\n</style>');
html = put(html, '<link rel="icon" href="assets/logo.png">', `<link rel="icon" href="${logoUrl}">`);
html = html.split('src="assets/logo.png"').join(`src="${logoUrl}"`);
html = html.split('href="assets/logo.png"').join(`href="${logoUrl}"`);
html = put(html, '<script src="config.js"></script>', '<script>\n' + config + '\n</script>');
html = put(html, '<script src="site.js"></script>', '<script>\n' + mockScript + '\n</script>\n<script>\n' + site + '\n</script>');
html = put(html, '<title>Laredo Roleplay</title>', '<title>Laredo Roleplay — design preview (single file)</title>');

/* ------------------------------------------------------------------ preview chip */
const chipCss = `
.pv-chip{position:fixed;left:16px;bottom:16px;z-index:120;display:flex;align-items:center;gap:10px;
  padding:9px 10px 9px 13px;border-radius:999px;border:1px solid var(--glass-line);
  background:linear-gradient(145deg,var(--glass-a),var(--glass-b));backdrop-filter:blur(var(--blur));
  -webkit-backdrop-filter:blur(var(--blur));box-shadow:0 14px 34px var(--shadow);
  font:600 13px 'Barlow',system-ui,sans-serif;color:var(--sub);letter-spacing:.01em}
.pv-chip b{color:var(--title);font-weight:700}
.pv-chip .pv-dot{width:8px;height:8px;border-radius:50%;background:var(--accent);flex:none;
  box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 22%,transparent)}
.pv-chip button{border:0;background:none;color:var(--muted);font:700 16px/1 'Barlow',sans-serif;
  padding:2px 4px;cursor:pointer;border-radius:6px}
.pv-chip button:hover{color:var(--title)}
@media (max-width:520px){.pv-chip{left:10px;right:10px;bottom:10px;font-size:12px}}
`;
const chipHtml = `<div class="pv-chip" id="pv-chip" role="note"><span class="pv-dot" aria-hidden="true"></span>
  <span><b>Design preview</b> &middot; sample data, no sign-in</span>
  <button type="button" aria-label="Hide this note" id="pv-chip-x">&times;</button></div>
<script>
  (function () {
    var chip = document.getElementById('pv-chip');
    var x = document.getElementById('pv-chip-x');
    if (x) x.addEventListener('click', function () { if (chip) chip.remove(); });
  })();
</script>`;
html = put(html, '</head>', '<style>' + chipCss + '</style>\n</head>');
html = put(html, '</body>', chipHtml + '\n</body>');

const out = path.join(preview, 'index.html');
fs.writeFileSync(out, html);
console.log('wrote ' + path.relative(root, out) + ' (' + Math.round(fs.statSync(out).size / 1024) + ' KB)');
