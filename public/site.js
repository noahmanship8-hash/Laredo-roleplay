/* Laredo Roleplay website. Pages, appearance, accounts, applications, staff panel and the announcements feed. */
(function () {
  'use strict';

  var CONFIG = window.LAREDO_CONFIG || {};
  var FEED_URL = CONFIG.announcementsUrl || 'announcements.json';
  var root = document.getElementById('root');

  function $(sel, el) { return (el || document).querySelector(sel); }
  function $$(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }

  var PAGES = ['home', 'departments', 'applications', 'apply', 'announcements', 'shop', 'rules', 'staff', 'dashboard', 'panel', 'settings', 'privacy'];
  var TITLES = {
    home: 'Laredo Roleplay', departments: 'Departments', applications: 'Applications', apply: 'Apply',
    announcements: 'Announcements', shop: 'Shop', rules: 'Rules', staff: 'Staff', dashboard: 'Dashboard',
    panel: 'Staff panel', settings: 'Settings', privacy: 'Privacy'
  };
  var DEPTS = [
    ['lpd', 'Laredo Police Department'], ['wcso', "Webb County Sheriff's Office"], ['dps', 'Texas DPS / Highway Patrol'],
    ['lfd', 'Laredo Fire Department'], ['fbi', 'Federal Bureau of Investigation'], ['bp', 'Border Patrol'],
    ['swat', 'SWAT'], ['dot', 'Department of Transportation']
  ];
  var TEAM_INFO = {
    ownership: { name: 'Ownership', color: '#2F3BFF', blurb: 'Sets the direction and pays the bills.' },
    executive: { name: 'Executive team', color: '#FF2E9A', blurb: 'Runs the community day to day.' },
    community: { name: 'Community management', color: '#FFB020', blurb: 'Events, partnerships and the Discord.' },
    discord_dev: { name: 'Discord developer', color: '#7A869F', blurb: 'Bots, channels and automation.' },
    server_dev: { name: 'Server developer', color: '#2B3DC4', blurb: 'Builds and fixes what you see in game.' },
    internal_affairs: { name: 'Internal affairs', color: '#FFF21A', blurb: 'Keeps the staff team honest.' },
    management: { name: 'Management team', color: '#F2701D', blurb: 'Supervises the day-to-day staff.' },
    supervisory: { name: 'Supervisory team', color: '#1FF2B4', blurb: 'First point of call for the team.' },
    administrator: { name: 'Administrator team', color: '#B01FFF', blurb: 'Handles the serious reports.' },
    moderator: { name: 'Moderator team', color: '#FF2638', blurb: 'On the front line in game and in Discord.' }
  };
  var TEAM_ORDER = Object.keys(TEAM_INFO);
  var RARITY_ORDER = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
  var APP_TYPES = { staff: 'Staff application', discord_dev: 'Discord developer application', server_dev: 'Server developer application' };
  var PRICE_FIELDS = [
    ['silver_month', 'Laredo Silver, 1 month'], ['silver_perm', 'Laredo Silver, permanent'],
    ['gold_month', 'Laredo Gold, 1 month'], ['gold_perm', 'Laredo Gold, permanent'],
    ['diamond_month', 'Laredo Diamond, 1 month'], ['diamond_perm', 'Laredo Diamond, permanent'],
    ['elite_month', 'Laredo Elite, 1 month'], ['elite_perm', 'Laredo Elite, permanent'],
    ['mod_day', '1 Day Mod'], ['livery_week', 'Own Livery, 1 week'], ['livery_perm', 'Own Livery, permanent'],
    ['partner_none', 'Partnership, no ping'], ['partner_here', 'Partnership, here ping'], ['partner_everyone', 'Partnership, everyone ping'],
    ['vc_office', 'Own VC Office'], ['shoutout', 'Own Shoutout']
  ];
  var AUTH_ERRORS = {
    config: 'Sign in is not set up on this site yet.',
    denied: 'You cancelled the sign in.',
    state: 'That sign in expired. Please try again.',
    token: 'Discord did not accept the sign in. Please try again.',
    user: 'Could not read your Discord profile. Please try again.',
    network: 'Could not reach Discord. Please try again.',
    signin: 'Sign in with Discord first, then link Roblox.',
    roblox_config: 'Roblox linking is not set up yet.',
    roblox_denied: 'You cancelled the Roblox sign in.',
    roblox_token: 'Roblox did not accept the sign in. Please try again.',
    roblox_user: 'Could not read your Roblox profile. Please try again.',
    roblox_taken: 'That Roblox account is already linked to a different Discord account.'
  };

  var state = { me: null, settings: null, forms: null, page: null, arg: '', panelTab: 'applications', authError: '' };

  /* MD-START */
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function inline(text) {
    var t = esc(text);
    t = t.replace(/&lt;(a?):(\w+):(\d+)&gt;/g, function (m, animated, name, id) {
      return '<img class="emoji" alt=":' + name + ':" src="https://cdn.discordapp.com/emojis/' + id + '.' +
        (animated ? 'gif' : 'webp') + '?size=44">';
    });
    t = t.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    t = t.replace(/\*\*\*([^*\n]+)\*\*\*/g, '<strong><em>$1</em></strong>');
    t = t.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/__([^_\n]+)__/g, '<u>$1</u>');
    t = t.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
    t = t.replace(/(^|[^_\w])_([^_\n]+)_(?![_\w])/g, '$1<em>$2</em>');
    t = t.replace(/~~([^~\n]+)~~/g, '<s>$1</s>');
    t = t.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    t = t.replace(/(^|\s)(https?:\/\/[^\s<]+)/g, function (m, pre, url) {
      return pre + '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + url + '</a>';
    });
    return t;
  }

  function renderMarkdown(text) {
    var lines = String(text || '').replace(/\r/g, '').split('\n');
    var out = [];
    var para = [];
    var inList = false;
    function flushPara() {
      if (para.length) { out.push('<p>' + para.join('<br>') + '</p>'); para = []; }
    }
    function closeList() {
      if (inList) { out.push('</ul>'); inList = false; }
    }
    lines.forEach(function (line) {
      var m;
      if ((m = line.match(/^#{1,3}\s+(.*)$/))) {
        flushPara(); closeList();
        out.push('<p class="msg-h">' + inline(m[1]) + '</p>');
      } else if ((m = line.match(/^>\s?(.*)$/))) {
        flushPara(); closeList();
        out.push('<blockquote>' + inline(m[1]) + '</blockquote>');
      } else if ((m = line.match(/^\s*[-*]\s+(.*)$/))) {
        flushPara();
        if (!inList) { out.push('<ul>'); inList = true; }
        out.push('<li>' + inline(m[1]) + '</li>');
      } else if (!line.trim()) {
        flushPara(); closeList();
      } else {
        closeList();
        para.push(inline(line));
      }
    });
    flushPara(); closeList();
    return out.join('');
  }
  /* MD-END */

  /* ------------------------------------------------------ announcements feed */
  var lastSignature = null;
  var feedState = 'idle';

  function feedBox() { return document.getElementById('feed'); }

  function setFeedMessage(text) {
    var box = feedBox();
    if (!box) return;
    box.innerHTML = '<div class="card" style="padding:28px;color:var(--sub);font-size:19px">' + esc(text) + '</div>';
  }

  function renderComponent(component) {
    if (!component) return '';
    var children = (component.components || []).map(renderComponent).join('');
    if (component.type === 10) return '<div class="v2-text">' + renderMarkdown(component.content || '') + '</div>';
    if (component.type === 9) return '<div class="v2-section">' + children + renderComponent(component.accessory) + '</div>';
    if (component.type === 17) {
      var color = Number(component.accentColor);
      var style = Number.isFinite(color) && color >= 0 && color <= 0xFFFFFF
        ? ' style="--component-accent:#' + color.toString(16).padStart(6, '0') + '"' : '';
      return '<div class="v2-container"' + style + '>' + children + '</div>';
    }
    if (component.type === 14) return component.divider
      ? '<hr class="v2-divider">' : '<div class="v2-spacer"></div>';
    if (component.type === 11) return safeDiscordImage(component.url)
      ? '<img class="v2-thumbnail" alt="' + esc(component.description || '') + '" loading="lazy" src="' + esc(component.url) + '">' : '';
    if (component.type === 12) {
      return '<div class="v2-gallery">' + (component.items || []).map(function (item) {
        return safeDiscordImage(item.url) ? '<img alt="' + esc(item.description || '') + '" loading="lazy" src="' + esc(item.url) + '">' : '';
      }).join('') + '</div>';
    }
    if (component.type === 2) return component.url && safeHttpUrl(component.url)
      ? '<a class="v2-button" href="' + esc(component.url) + '" target="_blank" rel="noopener noreferrer">' + inline(component.label || 'Open link') + '</a>'
      : (component.label ? '<span class="v2-button">' + inline(component.label) + '</span>' : '');
    if (component.type === 13) return component.url && safeHttpUrl(component.url)
      ? '<a class="v2-file" href="' + esc(component.url) + '" target="_blank" rel="noopener noreferrer">' + inline(component.name || 'Open file') + '</a>' : '';
    if (component.type === 1) return '<div class="v2-actions">' + children + '</div>';
    return children;
  }

  function renderPost(post) {
    var date = '';
    try {
      date = new Date(post.timestamp).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    } catch (e) { /* ignore */ }
    var author = post.author || {};
    var avatar = /^https:\/\/cdn\.discordapp\.com\//.test(author.avatar || '')
      ? '<img class="avatar" alt="" src="' + esc(author.avatar) + '">' : '';
    var html = '<article class="card" style="padding:28px;display:flex;flex-direction:column;gap:16px">';
    html += '<div style="display:flex;align-items:center;gap:14px">' + avatar +
      '<div style="display:flex;flex-direction:column"><strong style="color:var(--title);font-size:19px">' +
      esc(author.name || 'Staff') + '</strong><span style="color:var(--muted);font-size:15px">' + esc(date) +
      (post.edited ? ' (edited)' : '') + '</span></div></div>';
    if (post.content) html += '<div class="msg">' + renderMarkdown(post.content) + '</div>';
    if (post.components && post.components.length) {
      html += '<div class="msg msg-components">' + post.components.map(renderComponent).join('') + '</div>';
    }
    (post.embeds || []).forEach(function (embed) {
      var inner = '';
      var color = Number(embed.color);
      var style = Number.isFinite(color) && color >= 0 && color <= 0xFFFFFF
        ? ' style="--embed-color:#' + color.toString(16).padStart(6, '0') + '"' : '';
      if (embed.author && embed.author.name) {
        inner += '<div class="embed-author">' +
          (safeDiscordImage(embed.author.iconUrl) ? '<img alt="" src="' + esc(embed.author.iconUrl) + '">' : '') +
          (embed.author.url && safeHttpUrl(embed.author.url) ? '<a href="' + esc(embed.author.url) + '" target="_blank" rel="noopener noreferrer">' + inline(embed.author.name) + '</a>' : inline(embed.author.name)) +
          '</div>';
      }
      if (embed.title) {
        inner += '<p class="msg-h">' + (embed.url && safeHttpUrl(embed.url)
          ? '<a href="' + esc(embed.url) + '" target="_blank" rel="noopener noreferrer">' + inline(embed.title) + '</a>'
          : inline(embed.title)) + '</p>';
      }
      if (embed.description) inner += renderMarkdown(embed.description);
      if (embed.fields && embed.fields.length) {
        inner += '<div class="embed-fields">';
        embed.fields.forEach(function (f) {
          inner += '<div class="embed-field' + (f.inline ? ' is-inline' : '') + '"><strong>' + inline(f.name) + '</strong><div>' + renderMarkdown(f.value) + '</div></div>';
        });
        inner += '</div>';
      }
      if (safeDiscordImage(embed.image)) inner += '<img class="embed-image" alt="" loading="lazy" src="' + esc(embed.image) + '">';
      if (safeDiscordImage(embed.thumbnail)) inner += '<img class="embed-thumbnail" alt="" loading="lazy" src="' + esc(embed.thumbnail) + '">';
      if (embed.footer && embed.footer.text) {
        inner += '<div class="embed-footer">' +
          (safeDiscordImage(embed.footer.iconUrl) ? '<img alt="" src="' + esc(embed.footer.iconUrl) + '">' : '') +
          '<span>' + inline(embed.footer.text) + '</span>' +
          (embed.timestamp ? '<time>' + esc(formatDate(embed.timestamp)) + '</time>' : '') + '</div>';
      }
      if (inner) html += '<div class="msg msg-embed"' + style + '>' + inner + '</div>';
    });
    if (post.attachments) {
      html += '<p class="msg-note">This post includes ' + post.attachments + ' attachment' +
        (post.attachments === 1 ? '' : 's') + '. View ' + (post.attachments === 1 ? 'it' : 'them') + ' in Discord.</p>';
    }
    if (/^https:\/\/discord\.com\//.test(post.url || '')) {
      html += '<div><a class="btn-line" href="' + esc(post.url) +
        '" target="_blank" rel="noopener noreferrer">View in Discord</a></div>';
    }
    return html + '</article>';
  }

  function safeHttpUrl(value) { return /^https:\/\//i.test(value || ''); }
  function safeDiscordImage(value) { return /^https:\/\/(cdn\.discordapp\.com|media\.discordapp\.net)\//i.test(value || ''); }
  function formatDate(value) {
    try { return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }
    catch (e) { return ''; }
  }

  function loadFeed() {
    var box = feedBox();
    if (!box) return;
    if (feedState === 'idle') setFeedMessage('Loading announcements...');
    feedState = 'loading';
    var url = FEED_URL + (FEED_URL.indexOf('?') === -1 ? '?' : '&') + 't=' + Math.floor(Date.now() / 60000);
    fetch(url, { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        var posts = (data && data.announcements) || [];
        var signature = JSON.stringify(posts);
        feedState = 'ready';
        var badge = document.getElementById('feed-badge');
        if (badge) badge.hidden = false;
        if (signature === lastSignature) return;
        lastSignature = signature;
        if (!posts.length) {
          setFeedMessage('No announcements yet. Check back soon, or open our Discord.');
          return;
        }
        box.innerHTML = posts.map(renderPost).join('');
      })
      .catch(function () {
        feedState = 'error';
        lastSignature = null;
        var badge = document.getElementById('feed-badge');
        if (badge) badge.hidden = true;
        setFeedMessage('Announcements could not be loaded right now. You can read them in our Discord instead.');
      });
  }


  /* ------------------------------------------------------------------ helpers */
  function api(method, path, body) {
    var opts = { method: method, headers: {}, credentials: 'same-origin' };
    if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    return fetch('/api' + path, opts).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (data) {
        if (!res.ok) {
          var err = new Error((data && data.error) || 'Request failed (' + res.status + ').');
          err.status = res.status;
          throw err;
        }
        return data;
      });
    }, function () { throw new Error('Could not reach the server.'); });
  }

  function fmtDate(iso) {
    try { return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return ''; }
  }

  function tag(status) {
    var cls = status === 'accepted' ? 'tag-ok' : status === 'denied' ? 'tag-no' : 'tag-wait';
    var text = status === 'pending' ? 'Pending' : status === 'accepted' ? 'Accepted' : status === 'denied' ? 'Denied' : status;
    return '<span class="tag ' + cls + '">' + esc(text) + '</span>';
  }

  function alertBox(text, kind) {
    return '<p class="alert' + (kind ? ' alert-' + kind : '') + '" role="' + (kind === 'ok' ? 'status' : 'alert') + '">' + esc(text) + '</p>';
  }

  function signInUrl(next) { return '/api/auth/discord/login?next=' + encodeURIComponent(next || 'dashboard'); }

  /* -------------------------------------------------------------------- pages */
  function parseHash() {
    var h = (location.hash || '').replace(/^#\/?/, '');
    var parts = h.split('/');
    var page = parts[0] || 'home';
    if (PAGES.indexOf(page) === -1) return { page: 'home', arg: '' };
    return { page: page, arg: parts[1] || '' };
  }

  function showPage() {
    var r = parseHash();
    var changed = r.page !== state.page || r.arg !== state.arg;
    state.page = r.page;
    state.arg = r.arg;
    $$('.pg').forEach(function (el) { el.classList.toggle('active', el.getAttribute('data-page') === r.page); });
    var navKey = r.page === 'apply' ? 'applications' : r.page;
    $$('[data-nav]').forEach(function (a) {
      var on = a.getAttribute('data-nav') === navKey;
      a.classList.toggle('on', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    document.title = (r.page === 'home' ? '' : TITLES[r.page] + ' | ') + 'Laredo Roleplay';
    if (changed) window.scrollTo(0, 0);
    if (changed && (r.page === 'dashboard' || r.page === 'panel')) {
      dashPainted = false;
      showBoot(r.page === 'panel' ? 'Checking your staff access' : 'Opening your dashboard');
    }
    if (r.page === 'announcements') loadFeed();
    if (r.page === 'home') { loadHomeLatest(); loadServer(); }
    if (r.page === 'dashboard') renderDashboard();
    if (r.page === 'staff') renderStaffPage();
    if (r.page === 'apply') renderApply(r.arg);
    if (r.page === 'panel') renderPanel();
  }

  /* --------------------------------------------------------------- preferences */
  var PREF_KEY = 'laredo-prefs';
  var DEFAULT_PREFS = {
    mode: 'auto', halloween: false, christmas: false, look: '', accent: 'sunset', glass: 'on', ambient: 'on',
    text: 'md', font: 'brand', contrast: 'normal', motion: 'auto', ticker: 'on', carousel: 'on', cursor: 'on'
  };
  /* Every look the site knows. `needs` is the inventory badge that unlocks it, so a theme is
     something you collect: the pass badges are handed out by staff or won in events. */
  var THEMES = [
    { key: 'dark', name: 'Dark', note: 'Navy and sunset' },
    { key: 'light', name: 'Light', note: 'Paper and ink' },
    { key: 'halloween', name: 'Halloween', note: 'Orange and purple' },
    { key: 'christmas', name: 'Christmas', note: 'Ice, pine and brass' },
    { key: 'neon', name: 'Neon Night', note: 'Magenta and cyan', needs: 'pass_neon', locked: 'Neon Pass' },
    { key: 'dusk', name: 'Desert Dusk', note: 'Plum and ember', needs: 'pass_dusk', locked: 'Dusk Pass' },
    { key: 'emerald', name: 'Emerald', note: 'Deep pine and mint', needs: 'pass_emerald', locked: 'Emerald Pass' },
    { key: 'vapor', name: 'Vapor', note: 'Violet and teal', needs: 'pass_vapor', locked: 'Vapor Pass' }
  ];
  var THEME_KEYS = THEMES.map(function (t) { return t.key; });
  var THEME_NAMES = {};
  THEMES.forEach(function (t) { THEME_NAMES[t.key] = t.name; });
  var LOOK_SWATCHES = { neon: '#FF2BD1', dusk: '#E2714B', emerald: '#2FD79B', vapor: '#8B7BFF' };
  var THEME_BY_KEY = {};
  THEMES.forEach(function (t) { THEME_BY_KEY[t.key] = t; });
  var lightQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
  var motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  state.hasSavedPrefs = false;
  state.prefs = {};

  function loadPrefs() {
    var saved = {};
    try {
      var raw = localStorage.getItem(PREF_KEY);
      if (raw) {
        saved = JSON.parse(raw) || {};
        state.hasSavedPrefs = true;
      } else {
        var old = localStorage.getItem('laredo-theme');
        if (old) { saved = { halloween: old === 'halloween' }; state.hasSavedPrefs = true; }
      }
    } catch (e) { saved = {}; }
    var prefs = {};
    Object.keys(DEFAULT_PREFS).forEach(function (k) { prefs[k] = saved[k] !== undefined ? saved[k] : DEFAULT_PREFS[k]; });
    return prefs;
  }

  function savePrefs() {
    try { localStorage.setItem(PREF_KEY, JSON.stringify(state.prefs)); state.hasSavedPrefs = true; } catch (e) { /* ignore */ }
  }

  function motionReduced() {
    return state.prefs.motion === 'reduce' || (state.prefs.motion === 'auto' && Boolean(motionQuery && motionQuery.matches));
  }

  // Staff can switch a look off for everybody. A saved look that is off falls back politely.
  function ownedBadgeIds() {
    var me = state.me;
    if (!me || !me.inventory || !me.inventory.owned) return [];
    return me.inventory.owned.map(function (i) { return i.id; });
  }

  function themeUnlocked(key) {
    var t = THEME_BY_KEY[key];
    if (!t || !t.needs) return true;
    return ownedBadgeIds().indexOf(t.needs) !== -1;
  }

  /* switched on by staff, and (for the unlockable looks) owned by the visitor */
  function themeAvailable(key) {
    var t = state.settings && state.settings.themes;
    if (t && t[key] === false) return false;
    return themeUnlocked(key);
  }

  function resolveTheme() {
    var p = state.prefs;
    if (p.look && themeAvailable(p.look)) return p.look;
    if (p.christmas && themeAvailable('christmas')) return 'christmas';
    if (p.halloween && themeAvailable('halloween')) return 'halloween';
    var light = p.mode === 'light' || (p.mode === 'auto' && Boolean(lightQuery && lightQuery.matches));
    if (light) return themeAvailable('light') ? 'light' : 'dark';
    return themeAvailable('dark') ? 'dark' : 'light';
  }

  function syncControls() {
    $$('[data-pref]').forEach(function (el) {
      var key = el.getAttribute('data-pref');
      if (el.getAttribute('role') === 'switch') {
        var on = Boolean(state.prefs[key]);
        el.setAttribute('aria-checked', on ? 'true' : 'false');
        el.classList.toggle('on', on);
      } else {
        $$('[data-value]', el).forEach(function (btn) {
          var active = String(state.prefs[key]) === btn.getAttribute('data-value');
          btn.setAttribute('aria-checked', active ? 'true' : 'false');
          btn.classList.toggle('on', active);
        });
      }
    });
    syncLookMenu();
  }

  function syncLookMenu() {
    var theme = resolveTheme();
    var name = $('#look-name');
    if (name) name.textContent = THEME_NAMES[theme] || 'Dark';
    $$('[data-look]').forEach(function (btn) {
      var key = btn.getAttribute('data-look');
      var on = key === theme;
      btn.setAttribute('aria-checked', on ? 'true' : 'false');
      var off = state.settings && state.settings.themes && state.settings.themes[key] === false;
      if (off) btn.setAttribute('data-off', '1'); else btn.removeAttribute('data-off');
      var locked = !themeUnlocked(key);
      btn.setAttribute('data-locked', locked ? '1' : '0');
      btn.setAttribute('aria-disabled', locked ? 'true' : 'false');
      var t = THEME_BY_KEY[key];
      if (t && t.locked) btn.setAttribute('title', locked ? 'Unlock the ' + t.locked + ' in your inventory' : t.name);
      btn.classList.toggle('on', on);
    });
    var note = $('#settings-theme-note');
    if (note) {
      var hidden = [];
      ['dark', 'light', 'halloween', 'christmas'].forEach(function (k) { if (!themeAvailable(k)) hidden.push(THEME_NAMES[k]); });
      if (hidden.length) {
        note.hidden = false;
        note.textContent = 'Switched off by staff right now: ' + hidden.join(', ') + '.';
      } else {
        note.hidden = true;
        note.textContent = '';
      }
    }
  }

  function applyPrefs() {
    var p = state.prefs;
    var theme = resolveTheme();
    root.classList.remove.apply(root.classList, THEME_KEYS.map(function (k) { return 't-' + k; }));
    root.classList.add('t-' + theme);
    ['accent', 'glass', 'ambient', 'text', 'font', 'contrast', 'ticker', 'motion', 'cursor'].forEach(function (k) { root.setAttribute('data-' + k, p[k]); });
    root.setAttribute('data-badge', (state.me && state.me.inventory && state.me.inventory.equipped) || '');
    root.setAttribute('data-badge-rarity', (function () {
      var inv = (state.me && state.me.inventory) || {};
      var worn = (inv.owned || []).filter(function (i) { return i.id === inv.equipped; })[0];
      return (worn && worn.rarity) || '';
    })());
    root.setAttribute('data-carousel', p.carousel);
    THEME_KEYS.forEach(function (k) { root.setAttribute('data-theme-' + k, themeAvailable(k) ? 'on' : 'off'); });
    var meta = $('meta[name="theme-color"]');
    var CHROME = { light: '#F4EFE4', halloween: '#0F0A1C', christmas: '#07131A', neon: '#07060E', dusk: '#170D14', emerald: '#05130F', vapor: '#0B0A1C' };
    if (meta) meta.setAttribute('content', CHROME[theme] || '#0A1020');
    syncControls();
    restartCarousel();
    var key = theme + '|' + (motionReduced() ? 'reduce' : 'full') + '|' + state.prefs.ambient +
      '|' + ((state.me && state.me.inventory && state.me.inventory.equipped) || '');
    if (key !== fxKey) { fxKey = key; buildFx(theme); }
  }

  function setPref(key, value) {
    state.prefs[key] = value;
    savePrefs();
    applyPrefs();
  }

  function setTheme(key) {
    var p = state.prefs;
    if (!themeAvailable(key)) return false;
    p.look = key;
    // the old switches still drive the two seasonal looks, so keep them in step
    p.mode = key === 'light' ? 'light' : 'dark';
    p.halloween = key === 'halloween';
    p.christmas = key === 'christmas';
    savePrefs();
    applyPrefs();
    return true;
  }

  // the look an admin picked for people who have not chosen one themselves
  function applyDefaultLook(value) {
    if (state.hasSavedPrefs) { syncLookMenu(); return; }
    if (THEME_BY_KEY[value] && themeUnlocked(value)) { setTheme(value); return; }
    state.prefs.mode = value === 'light' ? 'light' : 'dark';
    state.prefs.halloween = value === 'halloween';
    state.prefs.christmas = value === 'christmas';
    applyPrefs();
  }

  function initPrefs() {
    state.prefs = loadPrefs();
    applyPrefs();
    $$('[data-pref]').forEach(function (el) {
      var key = el.getAttribute('data-pref');
      if (el.getAttribute('role') === 'switch') {
        el.addEventListener('click', function () {
          var next = !state.prefs[key];
          if (next && key === 'christmas') state.prefs.halloween = false;
          if (next && key === 'halloween') state.prefs.christmas = false;
          setPref(key, next);
        });
      } else {
        $$('[data-value]', el).forEach(function (btn) {
          btn.addEventListener('click', function () { setPref(key, btn.getAttribute('data-value')); });
        });
      }
    });
    $$('[data-look]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-look');
        if (!themeUnlocked(key)) {
          // locked looks explain themselves instead of silently doing nothing
          var t = THEME_BY_KEY[key] || {};
          lookNote('Unlock the ' + (t.locked || 'pass') + ' in your inventory, then wear it to open this look.');
          return;
        }
        if (!themeAvailable(key)) { lookNote('Staff have switched that look off for now.'); return; }
        setTheme(key);
        closeLookMenu();
      });
    });
    var reset = $('#prefs-reset');
    if (reset) {
      reset.addEventListener('click', function () {
        state.prefs = {};
        Object.keys(DEFAULT_PREFS).forEach(function (k) { state.prefs[k] = DEFAULT_PREFS[k]; });
        try { localStorage.removeItem(PREF_KEY); } catch (e) { /* ignore */ }
        state.hasSavedPrefs = false;
        if (state.settings) applyDefaultLook(state.settings.defaultTheme);
        applyPrefs();
      });
    }
    if (lightQuery && lightQuery.addEventListener) {
      lightQuery.addEventListener('change', function () { if (state.prefs.mode === 'auto') applyPrefs(); });
    }
  }

  /* ----------------------------------------------------------- site settings */
  function applySettings(s) {
    state.settings = s;
    var notice = $('#notice');
    if (s.notice && s.notice.enabled && s.notice.text) {
      $('#notice-text').textContent = s.notice.text;
      var link = $('#notice-link');
      if (/^https:\/\//.test(s.notice.link || '')) { link.href = s.notice.link; link.hidden = false; } else { link.hidden = true; }
      notice.hidden = false;
    } else {
      notice.hidden = true;
    }

    DEPTS.forEach(function (d) {
      var row = $('[data-dept="' + d[0] + '"]');
      var cfg = s.departments && s.departments[d[0]];
      if (!row || !cfg) return;
      var open = Boolean(cfg.open && cfg.invite);
      row.classList.toggle('is-open', open);
      $('[data-status-text]', row).textContent = open ? 'Open' : 'Coming soon';
      var a = $('a[data-invite]', row);
      var b = $('button[data-closed]', row);
      if (open) { a.href = cfg.invite; a.hidden = false; b.hidden = true; } else { a.hidden = true; b.hidden = false; }
    });

    Object.keys(APP_TYPES).forEach(function (id) {
      var row = $('[data-app="' + id + '"]');
      var cfg = s.applications && s.applications[id];
      if (!row || !cfg) return;
      row.classList.toggle('is-open', Boolean(cfg.open));
      $('[data-status-text]', row).textContent = cfg.open ? 'Open' : 'Closed';
      $('a[data-apply]', row).hidden = !cfg.open;
      $('button[data-closed]', row).hidden = Boolean(cfg.open);
    });

    $$('[data-price]').forEach(function (el) {
      var v = s.prices && s.prices[el.getAttribute('data-price')];
      if (v !== undefined && v !== null) el.textContent = Number(v).toLocaleString('en-US');
    });

    var openCount = DEPTS.filter(function (d) { var c = s.departments && s.departments[d[0]]; return Boolean(c && c.open && c.invite); }).length;
    $$('[data-open-count]').forEach(function (el) { el.setAttribute('data-target', String(openCount)); el.textContent = String(openCount); });
    var openApps = Object.keys(APP_TYPES).filter(function (id) { return Boolean(s.applications && s.applications[id] && s.applications[id].open); });
    $$('[data-apps-status]').forEach(function (el) {
      el.textContent = openApps.length === 0 ? 'Closed for now' : openApps.length === 1 ? APP_TYPES[openApps[0]] + ' is open' : openApps.length + ' applications are open';
    });
    var closed = $('#shop-closed');
    if (closed) closed.hidden = s.shopOpen !== false;

    applyDefaultLook(s.defaultTheme);
    applyPrefs();
    checkMaintenance();
  }

  function checkMaintenance() {
    var s = state.settings;
    var me = state.me;
    if (!s || !me) return;
    var on = Boolean(s.maintenance && s.maintenance.enabled);
    var staff = Boolean(me.isStaff);
    $('#maint').hidden = !(on && !staff);
    $('#maint-msg').textContent = (s.maintenance && s.maintenance.message) || '';
    $('#maint-staff').hidden = !(on && staff);
    root.classList.toggle('is-maintenance', on && !staff);
  }

  function loadSettings() {
    if (!settingsP) settingsP = api('GET', '/settings').then(applySettings, function () { /* the static defaults in the page are used */ });
    return settingsP;
  }

  /* --------------------------------------------------------------- accounts */
  function renderAccount() {
    var box = $('#account');
    var me = state.me;
    if (!me || me.offline) { box.innerHTML = ''; return; }
    if (!me.loggedIn) {
      box.innerHTML = '<a class="btn btn-small" href="' + signInUrl('dashboard') + '">Sign in with Discord</a>';
      return;
    }
    var worn = wornBadge(me);
    box.innerHTML = '<a class="account' + (worn ? ' has-badge' : '') + '" href="#dashboard" title="' +
      esc(worn ? 'Wearing ' + worn.name : me.user.name) + '"><img alt="" src="' + esc(me.user.avatar) +
      '"><span>' + esc(me.user.name) + '</span>' +
      (worn ? '<i class="account-badge rarity-' + esc(worn.rarity || 'common') + '">' + esc(initials(worn.name)) + '</i>' : '') +
      '</a>';
  }

  var meP = null, settingsP = null, formsP = null;

  function loadMe(force) {
    if (!meP || force) {
      state.apiError = '';
      meP = api('GET', '/me').then(function (me) { state.me = me; }, function (err) {
        state.me = { loggedIn: false, offline: true };
        state.apiError = (err && err.message) || '';
      })
        .then(function () { renderAccount(); applyPrefs(); checkMaintenance(); });
    }
    return meP;
  }

  function loadForms() {
    if (!formsP) formsP = api('GET', '/forms').then(function (d) { state.forms = d.forms; }, function () { state.forms = null; });
    return formsP;
  }

  var serverP = null, teamP = null, catalogueP = null;

  function applyServer(srv) {
    state.server = srv;
    var n = $('#live-players'), of = $('#live-players-of');
    var cell = $('#fact-players');
    if (!n) return;
    var set = function (value, note, off) {
      n.textContent = value;
      of.textContent = note;
      if (cell) {
        cell.classList.toggle('is-off', Boolean(off));
        cell.classList.toggle('is-live', !off);
      }
    };
    if (srv && srv.live) {
      set(String(srv.players), srv.maxPlayers ? 'of ' + srv.maxPlayers + ' in the city' : 'in the city now', false);
    } else if (srv && srv.error) {
      set('Offline', 'count unavailable', true);
    } else if (srv && srv.configured) {
      set('0', 'the server is quiet', false);
    } else {
      set('\u2014', 'not switched on yet', true);
    }
  }

  function loadServer(force) {
    if (!serverP || force) {
      serverP = api('GET', '/server').then(applyServer, function () { applyServer({ configured: true, live: false, error: 'unreachable' }); });
    }
    return serverP;
  }

  function loadTeam(force) {
    if (!teamP || force) {
      teamP = api('GET', '/team').then(function (d) { state.team = d; }, function () { state.team = null; });
    }
    return teamP;
  }

  function loadCatalogue() {
    if (!catalogueP) {
      catalogueP = api('GET', '/inventory').then(function (d) { state.catalogue = d.catalogue || []; }, function () { state.catalogue = []; });
    }
    return catalogueP;
  }

  function ensureData() {
    return Promise.all([loadMe(), loadSettings(), loadForms(), loadServer(), loadTeam(), loadCatalogue()]);
  }

  /* -------------------------------------------------------------- dashboard */
  var dashPainted = false;
  state.dashTab = 'overview';

  function initials(name) {
    return String(name || '?').trim().split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0); }).join('').toUpperCase() || '?';
  }
  function fmtNum(n) { return Number(n || 0).toLocaleString('en-US'); }
  function fmtDay(iso) { try { return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' }); } catch (e) { return ''; } }

  function serverPillHtml() {
    var srv = state.server;
    if (!srv || !srv.live) return '';
    return '<span class="dash-pill"><span class="dotm"></span><b>' + fmtNum(srv.players) + '</b> in the city</span>';
  }

  function dashHead(me) {
    var d = (state.settings && state.settings.dashboard) || {};
    var who = me && me.loggedIn ? ', ' + esc(String(me.user.name).split(' ')[0]) : '';
    return '<div class="dash-head"><div>' +
      '<p class="dash-kicker"><span class="live"></span>' + esc(d.kicker || 'Your Laredo') + '</p>' +
      '<h1 class="dash-title">' + esc(d.welcome || 'Welcome back') + who + '</h1>' +
      (d.tagline ? '<p class="dash-sub">' + esc(d.tagline) + '</p>' : '') +
      '</div><div class="dash-actions">' + serverPillHtml() + '</div></div>';
  }

  function dashNav(me) {
    var tabs = [['overview', 'Overview'], ['inventory', 'Inventory'], ['applications', 'Applications'], ['server', 'Server']];
    return '<nav class="dash-nav" aria-label="Dashboard sections">' + tabs.map(function (t) {
      return '<a href="#dashboard" data-dash-tab="' + t[0] + '"' + (state.dashTab === t[0] ? ' class="on"' : '') + '>' + t[1] + '</a>';
    }).join('') + (me.isStaff ? '<a href="#panel">Staff panel</a>' : '') + '</nav>';
  }

  /* Discord roles, as small tags. These used to be "pill-2 role", which collided with the
     big .role banners on the rules page: every tag inherited min-height:150px. Keep the
     class name to itself. */
  var RARITY = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' };

  function wornBadge(me) {
    var inv = (me && me.inventory) || {};
    return (inv.owned || []).filter(function (i) { return i.id === inv.equipped; })[0] || null;
  }

  /* The badge you wear is not just a label: it sets the accent of your member area,
     rings your avatar, sits next to your name here and in the site header. */
  function badgeTag(badge, extra) {
    if (!badge) return '';
    return '<span class="badge-tag rarity-' + esc(badge.rarity || 'common') + (extra ? ' ' + extra : '') + '"' +
      ' title="' + esc((badge.name || 'Badge') + ' - ' + (RARITY[badge.rarity] || 'Badge')) + '">' +
      '<i aria-hidden="true">' + esc(initials(badge.name)) + '</i>' + esc(badge.name) + '</span>';
  }

  function rolePills(me) {
    var out = '';
    (me.roles || []).forEach(function (r) {
      var colour = r.color ? '#' + ('000000' + r.color.toString(16)).slice(-6) : '';
      out += '<span class="role-tag"' + (colour ? ' style="--rc:' + colour + '"' : '') + '>' +
        '<i aria-hidden="true"></i>' + esc(r.name) + '</span>';
    });
    return out;
  }

  function idBar(me) {
    var worn = wornBadge(me);
    var tags = '';
    if (me.isAdmin) tags += '<span class="pill-2 ok">Staff admin</span>';
    else if (me.isStaff) tags += '<span class="pill-2 warn">Staff team</span>';
    if (me.roblox) tags += '<span class="pill-2 ok">Roblox linked</span>';
    tags += me.inGuild ? '<span class="pill-2">In the Discord</span>' : '<span class="pill-2 warn">Not in the Discord</span>';
    var roles = rolePills(me);
    var note = me.inGuild
      ? 'Member of the Laredo Roleplay Discord'
      : 'Not in our Discord yet. <a href="' + esc(CONFIG.discordInvite || '#') + '" target="_blank" rel="noopener noreferrer">Join here</a> so staff can check your roles.';
    return '<section class="idbar"' + (worn ? ' data-badge="' + esc(worn.id) + '"' : '') + '>' +
      '<span class="idbar-av rarity-' + esc((worn && worn.rarity) || 'common') + (worn ? ' is-worn' : '') + '">' +
        '<img alt="" src="' + esc(me.user.avatar) + '"></span>' +
      '<div class="idbar-main">' +
        '<p class="idbar-k">Signed in as</p>' +
        '<h2 class="idbar-name">' + esc(me.user.name) + (worn ? badgeTag(worn, 'name-tag') : '') + '</h2>' +
        '<p class="idbar-sub">' + note + '</p>' +
        '<div class="idbar-tags">' + tags + '</div>' +
        (roles ? '<div class="idbar-roles"><span class="idbar-roles-k">Discord roles</span>' + roles + '</div>' : '') +
      '</div>' +
      '<div class="idbar-side">' +
        (worn
          ? '<span class="idbar-worn rarity-' + esc(worn.rarity || 'common') + '"><i>' + esc(initials(worn.name)) + '</i>' +
            '<span>Wearing<strong>' + esc(worn.name) + '</strong></span></span>'
          : '<span class="idbar-worn is-empty"><span>No badge on<strong>Pick one below</strong></span></span>') +
        '<button class="btn-quiet" id="signout" type="button">Sign out</button>' +
      '</div>' +
      '</section>';
  }

  function statStrip(me, apps) {
    var srv = state.server || {};
    var inv = me.inventory || {};
    var owned = (inv.owned || []).length;
    var total = (state.catalogue || []).length || owned;
    var streak = Number((me.checkin || {}).streak) || 0;
    var live = Boolean(srv && srv.live);
    var tiles = [
      { k: 'In the city', v: live ? fmtNum(srv.players) : '&mdash;', s: live && srv.maxPlayers ? 'of ' + fmtNum(srv.maxPlayers) + ' seats' : 'live count', tone: live ? 'on' : '' },
      { k: 'Badges', v: owned + '<em>/' + total + '</em>', s: 'collected', tone: '' },
      { k: 'Streak', v: streak, s: streak === 1 ? 'day in a row' : 'days in a row', tone: '' },
      { k: 'Applications', v: apps.length, s: apps.length === 1 ? 'sent' : 'sent', tone: '' }
    ];
    return '<div class="dstats">' + tiles.map(function (t) {
      return '<div class="dstat' + (t.tone ? ' is-' + t.tone : '') + '"><span class="dstat-k">' + t.k + '</span>' +
        '<span class="dstat-v">' + t.v + '</span><span class="dstat-s">' + t.s + '</span></div>';
    }).join('') + '</div>';
  }

  function checkinCard(me) {
    var ci = me.checkin || {};
    var streak = Number(ci.streak) || 0;
    var pct = Math.min(100, Math.round((streak / 7) * 100));
    var next = streak === 0 ? 'Check in today to start a streak.' : streak >= 7 ? 'Seven in a row. Keep it going.' : (7 - streak) + ' more day' + (7 - streak === 1 ? '' : 's') + ' for a full week.';
    return '<section class="dcard"><div class="dcard-h"><h2>Shift check-in</h2><span class="dcard-k">Daily</span></div>' +
      '<div class="checkin"><div class="checkin-ring" style="--fill:' + pct + '"><span><b>' + streak + '</b><small>day' + (streak === 1 ? '' : 's') + '</small></span></div>' +
      '<div class="checkin-copy"><p><strong>' + esc(next) + '</strong></p><p class="muted">' + (ci.total || 0) + ' check-in' + (ci.total === 1 ? '' : 's') + ' in total. Three in a row earns the Regular badge, seven the Local badge.</p>' +
      '<p><button class="btn btn-small btn-primary" id="checkin-btn" type="button"' + (ci.canCheckIn === false ? ' disabled' : '') + '>' + (ci.canCheckIn === false ? 'Checked in today' : 'Check in') + '</button></p></div></div></section>';
  }

  function serverCard(full) {
    var srv = state.server;
    if (!srv) {
      return '<section class="dcard"><div class="dcard-h"><h2>The city</h2><span class="dcard-k">Live</span></div><p class="muted">Checking the server&hellip;</p></section>';
    }
    if (srv.error && !srv.live) {
      return '<section class="dcard"><div class="dcard-h"><h2>The city</h2><span class="dcard-k">Live</span></div>' +
        '<div class="server-num"><b>&mdash;</b><span>players right now</span></div>' +
        '<p class="muted">The count could not be read just now. It usually comes back within a minute.</p></section>';
    }
    if (!srv.configured) {
      return '<section class="dcard"><div class="dcard-h"><h2>The city</h2><span class="dcard-k">Live</span></div>' +
        '<p class="muted">The live player count is not switched on yet. Staff can add an ER:LC server key in the staff panel, and the count appears here for everyone.</p></section>';
    }
    if (!srv.live) {
      return '<section class="dcard"><div class="dcard-h"><h2>The city</h2><span class="dcard-k">Live</span></div>' +
        '<div class="server-num"><b>0</b><span>players right now</span></div>' +
        '<p class="muted">The server is not answering at the moment. It is probably closed, restarting, or the key needs checking.</p></section>';
    }
    var pct = srv.maxPlayers ? Math.round((srv.players / srv.maxPlayers) * 100) : 0;
    var html = '<section class="dcard"><div class="dcard-h"><h2>The city</h2><span class="dcard-k"><span class="dotm" style="display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--ok);margin-right:5px"></span>Live</span></div>' +
      '<div class="server-num"><b>' + fmtNum(srv.players) + '</b><span>' + (srv.maxPlayers ? 'of ' + fmtNum(srv.maxPlayers) + ' players' : 'players right now') + '</span></div>';
    if (srv.maxPlayers) html += '<div class="server-bar"><i style="width:' + Math.max(2, pct) + '%"></i></div>';
    html += '<div class="server-meta">' +
      (srv.joinCode ? '<span>Join code <b>' + esc(srv.joinCode) + '</b></span>' : '') +
      (srv.updatedAt ? '<span>Updated <b>' + esc(fmtDate(srv.updatedAt)) + '</b></span>' : '') + '</div>';
    if (full && srv.roster && srv.roster.length) {
      html += '<div><p class="dcard-k" style="margin-bottom:6px">On duty</p><ul class="roster">' + srv.roster.slice(0, 40).map(function (p) {
        return '<li><span class="r-dot"></span><span class="r-name">' + esc(p.name) + '</span>' +
          (p.callsign ? '<span class="r-team">' + esc(p.callsign) + '</span>' : p.team ? '<span class="r-team">' + esc(p.team) + '</span>' : '') + '</li>';
      }).join('') + '</ul></div>';
    } else if (full) {
      html += '<p class="muted">The key works, but the player list is not being shared for this server.</p>';
    }
    return html + '</section>';
  }

  function applicationsCard(apps) {
    var html = '<section class="dcard"><div class="dcard-h"><h2>Your applications</h2><span class="dcard-k">' + apps.length + ' sent</span></div>';
    if (!apps.length) {
      html += '<p class="muted">You have not applied for anything yet. When you do, the decision shows up here.</p>';
    } else {
      html += '<ul class="app-list">' + apps.map(function (a) {
        return '<li class="app-row"><span class="a-main"><strong>' + esc(a.typeLabel) + '</strong>' +
          '<span class="a-date">Sent ' + esc(fmtDate(a.createdAt)) + '</span></span>' + tag(a.status) + '</li>' +
          (a.decision && a.decision.note ? '<li class="app-row"><span class="a-main"><span class="a-date">Staff note: ' + esc(a.decision.note) + '</span></span></li>' : '');
      }).join('') + '</ul>';
    }
    return html + '<div class="quick-grid"><a class="quick-link" href="#applications"><b>What is open</b><span>Departments and staff roles</span></a>' +
      '<a class="quick-link" href="#rules"><b>The rules</b><span>Read before you apply</span></a></div></section>';
  }

  function robloxCard(me) {
    var html = '<section class="dcard"><div class="dcard-h"><h2>Roblox</h2><span class="dcard-k">Account</span></div>';
    if (me.roblox) {
      html += '<p>Linked as <strong>' + esc(me.roblox.name) + '</strong> <span class="muted">(ID ' + esc(me.roblox.id) + ')</span></p>' +
        '<p><button class="btn btn-small" id="unlink" type="button">Unlink</button></p>';
    } else if (!me.robloxConfigured) {
      html += '<p class="muted">Roblox linking is not switched on for this site yet. Once it is, you can link here and staff can see the account on your applications.</p>';
    } else {
      html += '<p>Link your Roblox account with Roblox&rsquo;s own sign in. We only receive your username and ID, never your password.</p>' +
        '<p><a class="btn btn-primary btn-small" href="/api/auth/roblox/login">Link Roblox account</a></p>';
    }
    return html + '</section>';
  }

  function inventoryItemHtml(item, inv, canEquip) {
    var owned = (inv.owned || []).some(function (x) { return x.id === item.id; });
    var on = inv.equipped === item.id;
    var rarity = item.rarity || 'common';
    return '<div class="inv-item rarity-' + esc(rarity) + (owned ? ' owned' : ' locked') + (on ? ' is-on' : '') + '"' +
      (owned && canEquip ? ' data-equip="' + esc(item.id) + '" tabindex="0" role="button" aria-pressed="' + (on ? 'true' : 'false') + '"' : '') +
      ' title="' + esc((item.name || '') + (owned ? ' - ' + (on ? 'worn, press to put it away' : 'press to wear it') : ' - ' + (item.hint || 'locked'))) + '">' +
      '<span class="inv-badge">' + esc(initials(item.name)) + '</span>' +
      '<span class="inv-name">' + esc(item.name) + '</span></div>';
  }

  function inventoryCard(me, full) {
    var inv = me.inventory || { owned: [] };
    var catalogue = state.catalogue || inv.owned || [];
    var ownedIds = (inv.owned || []).map(function (i) { return i.id; });
    var html = '<section class="dcard"><div class="dcard-h"><h2>Inventory</h2><span class="dcard-k">' + ownedIds.length + ' of ' + (catalogue.length || ownedIds.length) + '</span></div>';
    if (!ownedIds.length) {
      html += '<p class="muted">Nothing here yet. Your Resident badge appears as soon as you sign in.</p>';
    } else {
      html += '<div class="inv-grid">' + (catalogue.length ? catalogue : inv.owned).map(function (item) {
        return inventoryItemHtml(item, inv, true);
      }).join('') + '</div>';
      html += '<p class="inv-empty-note">' + (inv.equipped ? 'Tap the worn badge to put it away.' : 'Tap a badge to wear it next to your name.') + '</p>';
    }
    if (full) {
      html += '<p class="inv-empty-note">Grey badges are still locked. They show what you can earn, or what staff can hand out during events. Nothing here is bought: it is all earned or given.</p>';
    }
    return html + '</section>';
  }

  function quickLinks(me) {
    var html = '<section class="dcard"><div class="dcard-h"><h2>Shortcuts</h2><span class="dcard-k">Jump to</span></div><div class="quick-grid">' +
      '<a class="quick-link" href="#departments"><b>Departments</b><span>Eight ways to play</span></a>' +
      '<a class="quick-link" href="#announcements"><b>Announcements</b><span>From the Discord</span></a>' +
      '<a class="quick-link" href="#shop"><b>Shop</b><span>Perks and extras</span></a>' +
      '<a class="quick-link" href="#staff"><b>The team</b><span>Who runs the city</span></a>' +
      '<a class="quick-link" href="#settings"><b>Settings</b><span>Look and display</span></a>';
    if (me.isStaff) html += '<a class="quick-link" href="#panel"><b>Staff panel</b><span>Applications and settings</span></a>';
    return html + '</div></section>';
  }

  function teamCard() {
    var list = (state.team && state.team.members) || [];
    var html = '<section class="dcard"><div class="dcard-h"><h2>The team</h2><span class="dcard-k">' + list.length + ' people</span></div>';
    if (!list.length) {
      html += '<p class="muted">The staff list is being put together. Say hello in the Discord ticket channel if you need anything.</p>';
    } else {
      html += '<div class="team-preview">' + list.slice(0, 8).map(function (m) {
        var colour = m.color || (TEAM_INFO[m.team] || {}).color || '#F2701D';
        return '<div class="pv" style="--mc:' + esc(colour) + '"><i>' + esc(initials(m.name)) + '</i><span>' + esc(m.name) + '</span></div>';
      }).join('') + '</div>';
    }
    return html + '<p><a class="link-arrow" href="#staff">See the whole team</a></p></section>';
  }

  function dashboardBody(me, apps) {
    var d = (state.settings && state.settings.dashboard) || {};
    var showServer = d.showServer !== false, showTeam = d.showTeam !== false;
    var showInv = d.showInventory !== false;
    var top = idBar(me) + statStrip(me, apps) + dashNav(me);
    if (state.dashTab === 'inventory') {
      return top + '<div class="dash-grid"><div class="dash-col">' + inventoryCard(me, true) + checkinCard(me) + '</div>' +
        '<div class="dash-col">' + robloxCard(me) + (showServer ? serverCard(false) : '') + '</div></div>';
    }
    if (state.dashTab === 'applications') {
      return top + '<div class="dash-grid"><div class="dash-col">' + applicationsCard(apps) + '</div>' +
        '<div class="dash-col">' + '<section class="dcard"><div class="dcard-h"><h2>Before you apply</h2></div>' +
        '<p class="muted">Read the rules, be honest, and answer in your own words. Staff read every application, and the decision lands on this page.</p>' +
        '<div class="quick-grid"><a class="quick-link" href="#rules"><b>The rules</b><span>Two minutes, worth it</span></a>' +
        '<a class="quick-link" href="#announcements"><b>Openings</b><span>Check the latest posts</span></a></div></section>' +
        robloxCard(me) + '</div></div>';
    }
    if (state.dashTab === 'server') {
      return top + '<div class="dash-grid"><div class="dash-col">' + serverCard(true) + '</div><div class="dash-col">' +
        '<section class="dcard"><div class="dcard-h"><h2>How to join</h2></div>' +
        '<p class="muted">Open Emergency Response: Liberty County on Roblox, then use the join code above when the server is up. If the count shows 0, nobody is on shift right now.</p>' +
        '<p><a class="btn btn-small" href="https://www.roblox.com/games/2534724415/Emergency-Response-Liberty-County" target="_blank" rel="noopener noreferrer">Open the game</a></p></section>' +
        (showServer ? checkinCard(me) : '') + '</div></div>';
    }
    return top + '<div class="dash-grid"><div class="dash-col">' +
      (showInv ? inventoryCard(me, false) : '') + applicationsCard(apps) + '</div>' +
      '<div class="dash-col">' + (showServer ? serverCard(false) : '') + checkinCard(me) + robloxCard(me) + quickLinks(me) +
      (showTeam ? teamCard() : '') + '</div></div>';
  }

  function dashToast(text) {
    var host = $('#dash-root');
    if (!host) return;
    var old = $('.dash-toast');
    if (old) old.remove();
    var note = document.createElement('p');
    note.className = 'dash-toast';
    note.setAttribute('role', 'status');
    note.textContent = text;
    host.appendChild(note);
    setTimeout(function () { if (note.parentNode) note.remove(); }, 2600);
  }

  function wireDashboard(el, me) {
    var signout = $('#signout');
    if (signout) signout.addEventListener('click', function () {
      api('POST', '/auth/logout', {}).then(function () {
        state.me = { loggedIn: false, robloxConfigured: me.robloxConfigured };
        renderAccount(); checkMaintenance();
        location.hash = 'home';
      });
    });
    var unlink = $('#unlink');
    if (unlink) unlink.addEventListener('click', function () {
      unlink.disabled = true;
      api('POST', '/roblox/unlink', {}).then(function () { return loadMe(true); }).then(renderDashboard);
    });
    var checkin = $('#checkin-btn');
    if (checkin) checkin.addEventListener('click', function () {
      checkin.disabled = true;
      api('POST', '/me/checkin', {}).then(function () { return loadMe(true); }).then(function () {
        renderDashboard();
        setTimeout(function () { dashToast('Checked in for today.'); }, 80);
      }, function (err) {
        checkin.disabled = false;
        var box = $('#dash-root');
        if (box) box.insertAdjacentHTML('afterbegin', alertBox(err.message));
      });
    });
    $$('[data-dash-tab]', el).forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        state.dashTab = a.getAttribute('data-dash-tab');
        renderDashboard();
      });
    });
    $$('[data-equip]', el).forEach(function (b) {
      var go = function () {
        var id = b.getAttribute('data-equip');
        var label = (b.querySelector('.inv-name') || {}).textContent || 'Badge';
        var next = (state.me && state.me.inventory && state.me.inventory.equipped === id) ? '' : id;
        b.setAttribute('aria-pressed', next ? 'true' : 'false');
        api('POST', '/me/inventory/equip', { item: next }).then(function () { return loadMe(true); }).then(function () {
          renderDashboard();
          // the dashboard repaints itself from a promise, so wait for that before announcing
          setTimeout(function () { dashToast(next ? 'Wearing ' + label + '.' : 'Badge put away.'); }, 80);
        }, function (err) {
          b.setAttribute('aria-pressed', next ? 'false' : 'true');
          dashToast(err.message);
        });
      };
      b.addEventListener('click', go);
      b.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
  }

  function renderDashboard() {
    var el = $('#dash-root');
    if (!el) return;
    if (!dashPainted) { el.innerHTML = '<p class="muted">Loading your account&hellip;</p>'; }
    ensureData().then(function () {
      var me = state.me;
      var err = state.authError ? alertBox(AUTH_ERRORS[state.authError] || 'Sign in failed. Please try again.') : '';
      state.authError = '';
      if (me.offline) {
        el.innerHTML = '<div class="dash-head"><div><p class="dash-kicker">Your Laredo</p>' +
          '<h1 class="dash-title">Dashboard</h1></div></div>' +
          '<section class="dcard dash-signin dash-offline"><h2>Accounts are not switched on yet</h2>' +
          '<p>This copy of the site is not connected to its account storage, so signing in, applications and the member area are unavailable here.</p>' +
          (state.apiError ? '<p class="muted">' + esc(state.apiError) + '</p>' : '') +
          '<a class="btn" href="https://discord.gg/dqpUcfUvrt" target="_blank" rel="noopener noreferrer">Ask in the Discord</a>' +
          '</section>';
        dashPainted = false; hideBoot(); return;
      }
      if (!me.loggedIn) {
        el.innerHTML = dashHead(null) + '<section class="dcard dash-signin"><h2>Sign in</h2>' + err +
          '<p>Sign in with Discord to see your profile, your applications, your badges and the live count for the city. We only read your Discord name, avatar and the roles you have in our server.</p>' +
          '<a class="btn btn-primary" href="' + signInUrl('dashboard') + '">Sign in with Discord</a>' +
          '<p class="muted">No account is created and no password is stored.</p></section>';
        dashPainted = false; hideBoot(); return;
      }
      api('GET', '/applications/mine').then(function (d) { return d.applications; }, function () { return []; }).then(function (apps) {
        var html = dashHead(me) + (err || '') + (me.warning ? alertBox(me.warning) : '') + dashboardBody(me, apps);
        el.innerHTML = html;
        dashPainted = true;
        wireDashboard(el, me);
        hideBoot();
      });
    });
  }

  /* -------------------------------------------------------------- staff page */
  state.staffFilter = 'all';

  function staffCard(m) {
    var info = TEAM_INFO[m.team] || TEAM_INFO.moderator;
    var colour = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(m.color || '') ? m.color : info.color;
    var avatar = /^https:\/\//i.test(m.avatar || '')
      ? '<img alt="" src="' + esc(m.avatar) + '" loading="lazy">'
      : esc(initials(m.name));
    return '<article class="member" style="--mc:' + esc(colour) + '"><span class="member-glow" aria-hidden="true"></span>' +
      '<div class="member-top"><span class="member-av">' + avatar + '</span><div>' +
      '<p class="member-name">' + esc(m.name) + '</p>' +
      '<p class="member-title">' + esc(m.title || info.name) + '</p></div></div>' +
      (m.bio ? '<p class="member-bio">' + esc(m.bio) + '</p>' : '') +
      '<span class="member-team">' + esc(info.name) + '</span>' +
      '<div class="member-foot"><span><span class="dotm"></span>' + esc(m.status || 'Active') + '</span>' +
      (m.discord ? '<span>Discord ID ' + esc(m.discord) + '</span>' : '<span>' + esc(info.blurb || '') + '</span>') + '</div>' +
      '</article>';
  }

  function drawStaff() {
    var grid = $('#staff-team');
    if (!grid) return;
    var all = (state.team && state.team.members) || [];
    var chips = $('#staff-chips');
    var count = $('#staff-count');
    var teams = TEAM_ORDER.filter(function (t) { return all.some(function (m) { return m.team === t; }); });
    if (chips) {
      chips.innerHTML = '<button type="button" class="chip' + (state.staffFilter === 'all' ? ' on' : '') + '" data-staff-filter="all">Everyone <span class="chip-n">' + all.length + '</span></button>' +
        teams.map(function (t) {
          var n = all.filter(function (m) { return m.team === t; }).length;
          return '<button type="button" class="chip' + (state.staffFilter === t ? ' on' : '') + '" data-staff-filter="' + t + '">' + esc(TEAM_INFO[t].name) + ' <span class="chip-n">' + n + '</span></button>';
        }).join('');
      $$('[data-staff-filter]', chips).forEach(function (b) {
        b.addEventListener('click', function () { state.staffFilter = b.getAttribute('data-staff-filter'); drawStaff(); });
      });
    }
    var list = state.staffFilter === 'all' ? all : all.filter(function (m) { return m.team === state.staffFilter; });
    if (count) count.textContent = list.length + (list.length === 1 ? ' person' : ' people');
    if (!list.length) {
      grid.innerHTML = '<div class="staff-empty"><strong>The team is being written up</strong>' +
        '<p>Names are added in the staff panel. Once they are in, everyone shows here with their role and colour.</p>' +
        '<a class="btn btn-small" href="' + esc(CONFIG.discordInvite || '#') + '" target="_blank" rel="noopener noreferrer">Ask in Discord</a></div>';
      return;
    }
    var html = '';
    if (state.staffFilter === 'all') {
      teams.forEach(function (t) {
        var group = all.filter(function (m) { return m.team === t; });
        if (!group.length) return;
        html += '<div class="team-heading"><h2>' + esc(TEAM_INFO[t].name) + '</h2><span>' + group.length + '</span></div>' + group.map(staffCard).join('');
      });
    } else {
      html = list.map(staffCard).join('');
    }
    grid.innerHTML = html;
  }

  function renderStaffPage() {
    var hint = $('#staff-admin-hint');
    if (hint) hint.hidden = !(state.me && state.me.isAdmin);
    loadTeam().then(drawStaff, drawStaff);
  }

  /* ------------------------------------------------------------ application form */
  function fieldHtml(f, value) {
    var id = 'f-' + f.id;
    var req = f.required ? ' required' : '';
    if (f.type === 'checkbox') {
      return '<label class="check"><input type="checkbox" id="' + id + '" name="' + f.id + '"' + req + '> <span>' + esc(f.label) + '</span></label>';
    }
    var control;
    if (f.type === 'textarea') {
      control = '<textarea id="' + id + '" name="' + f.id + '" rows="5" maxlength="' + (f.max || 2000) + '"' + req + '>' + esc(value || '') + '</textarea>' +
        '<span class="count" data-count-for="' + id + '" data-max="' + (f.max || 2000) + '"></span>';
    } else if (f.type === 'select') {
      control = '<select id="' + id + '" name="' + f.id + '"' + req + '><option value="">Choose one</option>' +
        f.options.map(function (o) { return '<option>' + esc(o) + '</option>'; }).join('') + '</select>';
    } else if (f.type === 'number') {
      control = '<input type="number" inputmode="numeric" id="' + id + '" name="' + f.id + '" min="' + (f.min || 0) + '" max="' + (f.max || 999) + '"' + req + ' value="' + esc(value || '') + '">';
    } else {
      control = '<input type="text" id="' + id + '" name="' + f.id + '" maxlength="' + (f.max || 200) + '"' + req + ' value="' + esc(value || '') + '">';
    }
    return '<div class="field"><label for="' + id + '">' + esc(f.label) + (f.required ? '' : ' <span class="muted">(optional)</span>') + '</label>' + control + '</div>';
  }

  function renderApply(type) {
    var el = $('#apply-root');
    if (!APP_TYPES[type]) {
      el.innerHTML = '<p>That application does not exist. <a href="#applications">See all applications</a>.</p>';
      return;
    }
    el.innerHTML = '<p class="muted">Loading...</p>';
    ensureData().then(function () {
      var me = state.me;
      var form = state.forms && state.forms[type];
      var open = state.settings && state.settings.applications && state.settings.applications[type] && state.settings.applications[type].open;
      var head = '<p class="kicker">Application</p><h1 class="h1">' + esc(APP_TYPES[type]) + '</h1>';
      if (me.offline || !form) { el.innerHTML = head + alertBox('Applications are not switched on for this copy of the site.'); return; }
      head += '<p class="lede">' + esc(form.intro) + '</p>';
      if (!me.loggedIn) {
        el.innerHTML = head + '<div class="panel panel-wide"><h2 class="h2">Sign in first</h2><p>Sign in with Discord so staff know who you are.</p>' +
          '<p><a class="btn btn-primary" href="' + signInUrl('apply/' + type) + '">Sign in with Discord</a></p></div>';
        return;
      }
      if (!me.inGuild) {
        el.innerHTML = head + '<div class="panel panel-wide"><h2 class="h2">Join the Discord first</h2><p>You need to be in the Laredo Roleplay Discord to apply.</p>' +
          '<p><a class="btn btn-primary" target="_blank" rel="noopener noreferrer" href="' + esc(CONFIG.discordInvite || '') + '">Join the Discord</a></p></div>';
        return;
      }
      if (!open) {
        el.innerHTML = head + alertBox('This application is closed right now. Check the announcements for when it reopens.') + '<p><a class="btn" href="#applications">Back to applications</a></p>';
        return;
      }
      var html = head + '<p class="muted">Applying as <strong>' + esc(me.user.name) + '</strong>' +
        (me.roblox ? ' (Roblox: ' + esc(me.roblox.name) + ')' : '') + '</p>';
      if (!me.roblox && me.robloxConfigured) html += '<p class="muted">Tip: <a href="#dashboard">link your Roblox account</a> first and staff can see it on your application.</p>';
      html += '<form id="apply-form" class="form" novalidate>' + form.fields.map(function (f) {
        return fieldHtml(f, f.id === 'roblox' && me.roblox ? me.roblox.name : '');
      }).join('') + '<div id="apply-msg"></div><div><button class="btn btn-primary" type="submit">Send application</button></div></form>';
      el.innerHTML = html;

      $$('[data-count-for]', el).forEach(function (c) {
        var input = document.getElementById(c.getAttribute('data-count-for'));
        var update = function () { c.textContent = input.value.length + ' / ' + c.getAttribute('data-max'); };
        input.addEventListener('input', update); update();
      });
      $('#apply-form').addEventListener('submit', function (e) {
        e.preventDefault();
        var msg = $('#apply-msg');
        var answers = {};
        form.fields.forEach(function (f) {
          var input = document.getElementById('f-' + f.id);
          answers[f.id] = f.type === 'checkbox' ? input.checked : input.value;
        });
        var btn = $('button[type="submit"]', e.target);
        btn.disabled = true;
        msg.innerHTML = '';
        api('POST', '/applications', { type: type, answers: answers }).then(function () {
          el.innerHTML = '<p class="kicker">Application</p><h1 class="h1">Sent</h1><div class="panel panel-wide"><p>Thanks. Staff will review your application. You can see the result on your dashboard.</p>' +
            '<p><a class="btn btn-primary" href="#dashboard">Go to dashboard</a></p></div>';
          window.scrollTo(0, 0);
        }, function (err) {
          btn.disabled = false;
          msg.innerHTML = alertBox(err.message);
        });
      });
    });
  }

  /* -------------------------------------------------------------- staff panel */
  function renderPanel() {
    var el = $('#panel-root');
    if (!el) return;
    ensureData().then(function () {
      var me = state.me;
      if (me.offline) {
        el.innerHTML = alertBox('The staff panel is not switched on for this copy of the site.');
        hideBoot(); return;
      }
      if (!me.loggedIn) {
        el.innerHTML = '<div class="dash-head"><div><p class="dash-kicker"><span class="live"></span>Staff only</p>' +
          '<h1 class="dash-title">Staff panel</h1></div></div>' +
          '<section class="dcard dash-signin"><h2>Staff sign in</h2><p>Sign in with Discord. Access is checked against your roles in our server, every time you open something private.</p>' +
          '<a class="btn btn-primary" href="' + signInUrl('panel') + '">Sign in with Discord</a></section>';
        hideBoot(); return;
      }
      if (!me.isStaff) {
        el.innerHTML = '<div class="dash-head"><div><p class="dash-kicker"><span class="live"></span>Staff only</p><h1 class="dash-title">Staff panel</h1></div></div>' +
          alertBox('This area is for the staff team only.') + '<p><a class="btn" href="#dashboard">Back to dashboard</a></p>';
        hideBoot(); return;
      }
      var tabs = [['applications', 'Applications']];
      if (me.isAdmin) tabs.push(['settings', 'Site settings'], ['team', 'Staff page'], ['members', 'Members']);
      if (tabs.map(function (t) { return t[0]; }).indexOf(state.panelTab) === -1) state.panelTab = 'applications';

      var html = '<div class="dash-head"><div><p class="dash-kicker"><span class="live"></span>Staff only</p>' +
        '<h1 class="dash-title">Staff panel</h1><p class="dash-sub">' +
        (me.isAdmin ? 'Applications, the public staff page, awards and how the site looks.' : 'Review applications from the queue. Settings are for leadership.') +
        '</p></div><div class="dash-actions"><a class="dash-pill" href="#dashboard">Back to dashboard</a></div></div>' +
        '<div class="tabs" role="tablist">' + tabs.map(function (t) {
          return '<button class="tab' + (state.panelTab === t[0] ? ' on' : '') + '" data-tab="' + t[0] + '" role="tab">' + t[1] + '</button>';
        }).join('') + '</div><div id="panel-body"></div>';
      el.innerHTML = html;
      $$('.tab', el).forEach(function (t) {
        t.addEventListener('click', function () { state.panelTab = t.getAttribute('data-tab'); renderPanel(); });
      });
      var body = $('#panel-body');
      if (state.panelTab === 'settings' && me.isAdmin) panelSettings(body);
      else if (state.panelTab === 'team' && me.isAdmin) panelTeam(body);
      else if (state.panelTab === 'members' && me.isAdmin) panelMembers(body);
      else panelApplications(body, { status: 'pending', type: '' });
      hideBoot();
    });
  }

  function panelApplications(body, filter) {
    body.innerHTML = '<div class="filters"><label>Status <select id="f-status"><option value="pending">Pending</option><option value="accepted">Accepted</option><option value="denied">Denied</option><option value="">All</option></select></label>' +
      '<label>Type <select id="f-type"><option value="">All</option>' +
      Object.keys(APP_TYPES).map(function (k) { return '<option value="' + k + '">' + esc(APP_TYPES[k]) + '</option>'; }).join('') +
      '</select></label></div><div id="app-list"><p class="muted">Loading...</p></div>';
    $('#f-status').value = filter.status;
    $('#f-type').value = filter.type;
    var reload = function () { panelApplications(body, { status: $('#f-status').value, type: $('#f-type').value }); };
    $('#f-status').addEventListener('change', reload);
    $('#f-type').addEventListener('change', reload);

    var q = '?status=' + encodeURIComponent(filter.status) + '&type=' + encodeURIComponent(filter.type);
    api('GET', '/staff/applications' + q).then(function (d) {
      var list = $('#app-list');
      if (!d.applications.length) { list.innerHTML = '<p class="muted">Nothing here.</p>'; return; }
      list.innerHTML = '<ul class="queue">' + d.applications.map(function (a) {
        return '<li><button class="queue-row" data-id="' + esc(a.id) + '"><span class="queue-who"><img alt="" src="' + esc(a.applicant.avatar) + '"><strong>' + esc(a.applicant.name) + '</strong></span>' +
          '<span>' + esc(a.typeLabel) + '</span><span class="muted">' + esc(fmtDate(a.createdAt)) + '</span>' + tag(a.status) + '</button></li>';
      }).join('') + '</ul>';
      $$('.queue-row', list).forEach(function (b) {
        b.addEventListener('click', function () { panelDetail(body, b.getAttribute('data-id'), filter); });
      });
    }, function (err) { $('#app-list').innerHTML = alertBox(err.message); });
  }

  function panelDetail(body, id, filter) {
    body.innerHTML = '<p><button class="btn btn-small" id="back">Back to the list</button></p><div id="detail"><p class="muted">Loading...</p></div>';
    $('#back').addEventListener('click', function () { panelApplications(body, filter); });
    api('GET', '/staff/applications/' + encodeURIComponent(id)).then(function (d) {
      var a = d.application;
      var html = '<div class="panel"><div class="split"><h2 class="h2">' + esc(a.typeLabel) + '</h2>' + tag(a.status) + '</div>' +
        '<p class="profile"><img class="profile-sm" alt="" src="' + esc(a.applicant.avatar) + '"><span><strong>' + esc(a.applicant.name) + '</strong> <span class="muted">Discord ID ' + esc(a.applicant.id) + '</span></span></p>' +
        '<p class="muted">Sent ' + esc(fmtDate(a.createdAt)) + (a.roblox ? ' | Roblox (verified): <strong>' + esc(a.roblox.name) + '</strong> (ID ' + esc(a.roblox.id) + ')' : ' | Roblox not linked') + '</p>' +
        '<dl class="answers">' + a.answers.map(function (x) {
          return '<dt>' + esc(x.label) + '</dt><dd>' + esc(x.value).replace(/\n/g, '<br>') + '</dd>';
        }).join('') + '</dl>';
      if (a.status === 'pending') {
        html += '<div class="field"><label for="note">Note for the applicant (optional)</label><textarea id="note" rows="3" maxlength="500"></textarea></div>' +
          '<div id="review-msg"></div><div class="btn-row"><button class="btn btn-primary" data-decision="accepted">Accept</button><button class="btn" data-decision="denied">Deny</button></div>';
      } else if (a.review) {
        html += '<p class="note">' + (a.status === 'accepted' ? 'Accepted' : 'Denied') + ' by <strong>' + esc(a.review.by.name) + '</strong> on ' + esc(fmtDate(a.review.at)) +
          (a.review.note ? '. Note: ' + esc(a.review.note) : '.') + '</p>';
      }
      html += '</div>';
      $('#detail').innerHTML = html;
      $$('[data-decision]').forEach(function (b) {
        b.addEventListener('click', function () {
          var decision = b.getAttribute('data-decision');
          $$('[data-decision]').forEach(function (x) { x.disabled = true; });
          api('POST', '/staff/applications/' + encodeURIComponent(id) + '/review', { decision: decision, note: $('#note').value }).then(function () {
            panelDetail(body, id, filter);
          }, function (err) {
            $$('[data-decision]').forEach(function (x) { x.disabled = false; });
            $('#review-msg').innerHTML = alertBox(err.message);
          });
        });
      });
    }, function (err) { $('#detail').innerHTML = alertBox(err.message); });
  }

  function panelSettings(body) {
    var s = state.settings;
    if (!s) { body.innerHTML = alertBox('Settings could not be loaded.'); return; }
    function checkbox(id, label, on) {
      return '<label class="check"><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + '> <span>' + esc(label) + '</span></label>';
    }
    function themeRow(key, title, blurb, colour) {
      return '<div class="theme-row"><div class="th-main"><span class="sw" style="background:' + colour + '"></span>' +
        '<span><strong>' + esc(title) + '</strong><small>' + esc(blurb) + '</small></span></div>' +
        '<label class="check"><input type="checkbox" id="s-theme-' + key + '"' + (s.themes[key] !== false ? ' checked' : '') + '> <span>Allow</span></label></div>';
    }
    var html = '<form id="settings-form" class="form" novalidate><input type="hidden" id="s-extra" value="1">';

    html += '<section class="panel"><h2 class="h2">Site notice</h2><p class="muted">A strip across the top of every page.</p>' + checkbox('s-notice-on', 'Show the notice', s.notice.enabled) +
      '<div class="field"><label for="s-notice-text">Text</label><input type="text" id="s-notice-text" maxlength="200" value="' + esc(s.notice.text) + '"></div>' +
      '<div class="field"><label for="s-notice-link">Link (optional, https://)</label><input type="text" id="s-notice-link" maxlength="300" value="' + esc(s.notice.link) + '"></div></section>';

    html += '<section class="panel"><h2 class="h2">Maintenance mode</h2><p class="muted">Visitors see a "back soon" screen. Staff can still use the site.</p>' +
      checkbox('s-maint-on', 'Maintenance mode is on', s.maintenance.enabled) +
      '<div class="field"><label for="s-maint-msg">Message</label><input type="text" id="s-maint-msg" maxlength="300" value="' + esc(s.maintenance.message) + '"></div></section>';

    html += '<section class="panel"><h2 class="h2">Looks</h2><p class="muted">Switch a look off and nobody can use it; anyone who had it saved falls back to the default. Leave at least one on.</p>' +
      themeRow('dark', 'Dark', 'Navy and sunset. The house look.', '#0A1020') +
      themeRow('light', 'Light', 'Paper and ink for daylight.', '#F4EFE4') +
      themeRow('halloween', 'Halloween', 'Orange and purple, bats and a pumpkin.', '#8B5CF6') +
      themeRow('christmas', 'Christmas', 'Ice blue, pine and brass, with snow.', '#E9B44C') +
      '<div class="field" style="margin-top:14px"><label for="s-theme">Default look for new visitors</label><select id="s-theme"><option value="normal">Dark</option><option value="light">Light</option><option value="halloween">Halloween</option><option value="christmas">Christmas</option></select></div>' +
      '<div class="look-key"><p class="dcard-k">Collectable looks</p><p class="muted">These are not on the switch list: a member opens one by earning the pass and wearing it. Hand a pass out from the Members tab.</p>' +
      THEMES.filter(function (t) { return t.needs; }).map(function (t) {
        return '<div class="look-key-row"><span class="look-key-sw" style="--sw:' + (LOOK_SWATCHES[t.key] || '#888') + '"></span>' +
          '<strong>' + esc(t.name) + '</strong><span class="muted">' + esc(t.locked) + '</span></div>';
      }).join('') + '</div></section>';

    html += '<section class="panel"><h2 class="h2">Dashboard wording</h2><p class="muted">What every signed-in member sees at the top of their dashboard.</p>' +
      '<div class="field"><label for="s-dash-kicker">Small line above the title</label><input type="text" id="s-dash-kicker" maxlength="30" value="' + esc(s.dashboard.kicker) + '"></div>' +
      '<div class="field"><label for="s-dash-welcome">Title</label><input type="text" id="s-dash-welcome" maxlength="40" value="' + esc(s.dashboard.welcome) + '"></div>' +
      '<div class="field"><label for="s-dash-tagline">Tagline</label><input type="text" id="s-dash-tagline" maxlength="160" value="' + esc(s.dashboard.tagline) + '"></div>' +
      '<div class="theme-row"><div class="th-main"><span><strong>Live server card</strong><small>Player count, join code and who is on duty.</small></span></div>' + checkbox('s-show-server', 'Show', s.dashboard.showServer !== false) + '</div>' +
      '<div class="theme-row"><div class="th-main"><span><strong>Inventory and badges</strong><small>What each member has earned or been given.</small></span></div>' + checkbox('s-show-inv', 'Show', s.dashboard.showInventory !== false) + '</div>' +
      '<div class="theme-row"><div class="th-main"><span><strong>Team strip</strong><small>A short list of staff, linking to the staff page.</small></span></div>' + checkbox('s-show-team', 'Show', s.dashboard.showTeam !== false) + '</div></section>';

    html += '<section class="panel"><h2 class="h2">Applications</h2><p class="muted">Closed applications cannot be submitted. Opening one for an hour is a good way to catch up quietly.</p>' +
      Object.keys(APP_TYPES).map(function (k) { return checkbox('s-app-' + k, APP_TYPES[k] + ' is open', s.applications[k].open); }).join('') + '</section>';

    html += '<section class="panel"><h2 class="h2">Departments</h2><p class="muted">A department shows as open once it is ticked and has an invite.</p>' +
      DEPTS.map(function (d) {
        var c = s.departments[d[0]];
        return '<div class="dept-edit"><strong>' + esc(d[1]) + '</strong>' + checkbox('s-dept-' + d[0], 'Open', c.open) +
          '<div class="field"><label for="s-inv-' + d[0] + '">Discord invite</label><input type="text" id="s-inv-' + d[0] + '" maxlength="80" placeholder="https://discord.gg/..." value="' + esc(c.invite) + '"></div></div>';
      }).join('') + '</section>';

    html += '<section class="panel"><h2 class="h2">Shop prices (Robux)</h2><p class="muted">Leave the shop as it is, or close it while you change prices.</p>' +
      checkbox('s-shop-open', 'The shop is open', s.shopOpen !== false) + '<div class="price-grid">' +
      PRICE_FIELDS.map(function (p) {
        return '<div class="field"><label for="s-price-' + p[0] + '">' + esc(p[1]) + '</label><input type="number" min="0" max="1000000" id="s-price-' + p[0] + '" value="' + esc(s.prices[p[0]]) + '"></div>';
      }).join('') + '</div></section>';

    html += '<div id="settings-msg"></div><div><button class="btn btn-primary" type="submit">Save settings</button></div></form>';

    html += '<section class="panel" style="margin-top:22px"><h2 class="h2">ER:LC server key</h2>' +
      '<p class="muted">Paste the server key from <a href="https://api.policeroleplay.community" target="_blank" rel="noopener noreferrer">the ER:LC API</a> and the live player count appears on the home page and every dashboard. It is stored in your KV store and never sent back to a browser.</p>' +
      '<form id="erlc-form" class="form" novalidate><div class="field"><label for="s-erlc">Server key</label>' +
      '<input type="text" id="s-erlc" maxlength="120" autocomplete="off" placeholder="' + (s.erlcConfigured ? 'A key is set. Paste a new one to replace it.' : 'Paste the server key') + '"></div>' +
      '<div id="erlc-msg"></div><div class="btn-row"><button class="btn btn-primary" type="submit">Save key</button>' +
      '<button class="btn" type="button" id="erlc-clear">Remove key</button></div></form></section>';

    body.innerHTML = html;
    $('#s-theme').value = s.defaultTheme;

    function readExtra() {
      var has = $('#s-extra') && $('#s-extra').value === '1';
      var extra = {};
      if (!has) return extra;
      extra.themes = {};
      ['dark', 'light', 'halloween', 'christmas'].forEach(function (k) { extra.themes[k] = $('#s-theme-' + k).checked; });
      extra.dashboard = {
        kicker: $('#s-dash-kicker').value,
        welcome: $('#s-dash-welcome').value,
        tagline: $('#s-dash-tagline').value,
        showServer: $('#s-show-server').checked,
        showInventory: $('#s-show-inv').checked,
        showTeam: $('#s-show-team').checked
      };
      extra.shopOpen = $('#s-shop-open').checked;
      return extra;
    }

    $('#settings-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var data = {
        notice: { enabled: $('#s-notice-on').checked, text: $('#s-notice-text').value, link: $('#s-notice-link').value },
        maintenance: { enabled: $('#s-maint-on').checked, message: $('#s-maint-msg').value },
        defaultTheme: $('#s-theme').value,
        applications: {}, departments: {}, prices: {}
      };
      var extra = readExtra();
      if (extra.themes && Object.keys(extra.themes).some(function (k) { return extra.themes[k]; })) data.themes = extra.themes;
      if (extra.dashboard) data.dashboard = extra.dashboard;
      if (extra.shopOpen !== undefined) data.shopOpen = extra.shopOpen;
      Object.keys(APP_TYPES).forEach(function (k) { data.applications[k] = { open: $('#s-app-' + k).checked }; });
      DEPTS.forEach(function (d) { data.departments[d[0]] = { open: $('#s-dept-' + d[0]).checked, invite: $('#s-inv-' + d[0]).value }; });
      PRICE_FIELDS.forEach(function (p) { data.prices[p[0]] = $('#s-price-' + p[0]).value; });
      for (var i = 0; i < PRICE_FIELDS.length; i++) {
        if (String(data.prices[PRICE_FIELDS[i][0]]).trim() === '') {
          $('#settings-msg').innerHTML = alertBox('Fill in every price (use 0 if something is free).');
          return;
        }
      }
      var btn = $('button[type="submit"]', e.target);
      btn.disabled = true;
      api('PUT', '/admin/settings', data).then(function (res) {
        btn.disabled = false;
        applySettings(res.settings);
        $('#settings-msg').innerHTML = alertBox('Saved. The changes are live now.', 'ok');
      }, function (err) {
        btn.disabled = false;
        $('#settings-msg').innerHTML = alertBox(err.message);
      });
    });

    function saveKey(value) {
      api('PUT', '/admin/erlc-key', { key: value }).then(function () {
        $('#erlc-msg').innerHTML = alertBox(value ? 'Key saved. The count updates within a few seconds.' : 'Key removed.', 'ok');
        $('#s-erlc').value = '';
        return loadServer(true);
      }, function (err) { $('#erlc-msg').innerHTML = alertBox(err.message); });
    }
    $('#erlc-form').addEventListener('submit', function (e) {
      e.preventDefault();
      saveKey($('#s-erlc').value.trim());
    });
    $('#erlc-clear').addEventListener('click', function () { saveKey(''); });
  }

  /* --------------------------------------------------- staff page editor */
  var BLANK_MEMBER = { id: '', name: '', title: '', team: 'moderator', color: '', discord: '', avatar: '', bio: '' };

  function readTeamRows() {
    var rows = $$('[data-team-row]');
    if (!rows.length) return state.editTeam || [];
    return rows.map(function (row) {
      var get = function (name) {
        var input = $('[data-tm="' + name + '"]', row);
        return input ? input.value : '';
      };
      return {
        id: row.getAttribute('data-team-row') || '',
        name: get('name'), title: get('title'), team: get('team'), color: get('color'),
        discord: get('discord'), avatar: get('avatar'), bio: get('bio')
      };
    });
  }

  function panelTeam(body) {
    body.innerHTML = '<p class="muted">Loading the staff page&hellip;</p>';
    api('GET', '/admin/team').then(function (d) {
      state.editTeam = (d.members || []).map(function (m) { return Object.assign({}, BLANK_MEMBER, m); });
      drawTeamEditor(body);
    }, function (err) { body.innerHTML = alertBox(err.message); });
  }

  function drawTeamEditor(body, message) {
    var list = state.editTeam || [];
    var html = '<section class="panel"><div class="split"><div><h2 class="h2">Staff page</h2>' +
      '<p class="muted">These people appear on <a href="#staff">the staff page</a>. Leave a name empty to drop the row. Order here is the order on the page.</p></div>' +
      '<div class="panel-tools"><button class="btn btn-small" type="button" id="team-add">Add person</button>' +
      '<button class="btn btn-small btn-primary" type="button" id="team-save">Save the page</button></div></div><div id="team-msg">' +
      (message || '') + '</div><div class="edit-list" id="team-rows">';

    if (!list.length) {
      html += '<p class="muted">Nobody is on the page yet. Add the first person, or paste a whole team in below.</p>';
    }
    list.forEach(function (m, i) {
      html += '<div class="edit-row" data-team-row="' + esc(m.id || '') + '">' +
        '<span class="drag" aria-hidden="true">' + (i + 1) + '</span>' +
        '<div class="col"><input type="text" data-tm="name" maxlength="40" placeholder="Name" value="' + esc(m.name) + '">' +
        '<input type="text" data-tm="title" maxlength="48" placeholder="Role, e.g. Head of Staff" value="' + esc(m.title) + '"></div>' +
        '<div class="col"><input type="text" data-tm="discord" maxlength="25" placeholder="Discord ID (optional)" value="' + esc(m.discord) + '">' +
        '<input type="text" data-tm="avatar" maxlength="300" placeholder="Avatar image link (optional, https://)" value="' + esc(m.avatar) + '"></div>' +
        '<div class="col"><select data-tm="team">' + TEAM_ORDER.map(function (t) {
          return '<option value="' + t + '"' + (m.team === t ? ' selected' : '') + '>' + esc(TEAM_INFO[t].name) + '</option>';
        }).join('') + '</select><input class="swatch-in" type="color" data-tm="color" value="' + esc(m.color || (TEAM_INFO[m.team] || TEAM_INFO.moderator).color) + '" aria-label="Name colour"></div>' +
        '<div class="btn-row rm"><button class="btn btn-small" type="button" data-team-up="' + i + '" aria-label="Move up">&uarr;</button>' +
        '<button class="btn btn-small" type="button" data-team-down="' + i + '" aria-label="Move down">&darr;</button>' +
        '<button class="btn btn-small" type="button" data-team-rm="' + i + '">Remove</button></div>' +
        '<textarea data-tm="bio" maxlength="300" rows="2" placeholder="One line about them (optional)">' + esc(m.bio) + '</textarea>' +
        '</div>';
    });
    html += '</div><div class="split" style="margin-top:16px"><p class="muted small">Changes are live on the staff page the moment you save.</p>' +
      '<button class="btn btn-small btn-primary" type="button" id="team-save-2">Save the page</button></div></section>';
    body.innerHTML = html;

    $('#team-add').addEventListener('click', function () {
      state.editTeam = readTeamRows().concat([Object.assign({}, BLANK_MEMBER, { id: '' })]);
      drawTeamEditor(body, '');
    });
    $$('[data-team-rm]', body).forEach(function (b) {
      b.addEventListener('click', function () {
        var rows = readTeamRows();
        rows.splice(Number(b.getAttribute('data-team-rm')), 1);
        state.editTeam = rows;
        drawTeamEditor(body, '');
      });
    });
    $$('[data-team-up]', body).forEach(function (b) {
      b.addEventListener('click', function () {
        var i = Number(b.getAttribute('data-team-up'));
        var rows = readTeamRows();
        if (i > 0) { var t = rows[i - 1]; rows[i - 1] = rows[i]; rows[i] = t; }
        state.editTeam = rows; drawTeamEditor(body, '');
      });
    });
    $$('[data-team-down]', body).forEach(function (b) {
      b.addEventListener('click', function () {
        var i = Number(b.getAttribute('data-team-down'));
        var rows = readTeamRows();
        if (i < rows.length - 1) { var t = rows[i + 1]; rows[i + 1] = rows[i]; rows[i] = t; }
        state.editTeam = rows; drawTeamEditor(body, '');
      });
    });
    var save = function () {
      var members = readTeamRows().filter(function (m) { return String(m.name || '').trim(); });
      api('PUT', '/admin/team', { members: members }).then(function (res) {
        teamP = null;
        state.editTeam = (res.team.members || []).map(function (m) { return Object.assign({}, BLANK_MEMBER, m); });
        drawTeamEditor(body, alertBox('Saved. ' + members.length + ' ' + (members.length === 1 ? 'person is' : 'people are') + ' on the staff page.', 'ok'));
      }, function (err) { $('#team-msg').innerHTML = alertBox(err.message); });
    };
    $('#team-save').addEventListener('click', save);
    $('#team-save-2').addEventListener('click', save);
  }

  /* --------------------------------------------------- member awards */
  function panelMembers(body) {
    var grants = (state.catalogue || []).filter(function (i) { return i.kind === 'grant'; });
    body.innerHTML = '<section class="panel"><h2 class="h2">Give a badge</h2>' +
      '<p class="muted">Look someone up by Discord ID and tick what they should have. Badges show on their dashboard and in their inventory. Nothing is ever taken away by accident: untick to remove.</p>' +
      '<div class="panel-tools"><input type="text" id="m-id" maxlength="25" inputmode="numeric" placeholder="Discord ID, e.g. 123456789012345678">' +
      '<button class="btn btn-small btn-primary" type="button" id="m-lookup">Look up</button></div>' +
      '<div id="m-result" style="margin-top:14px"></div></section>' +
      '<section class="panel" style="margin-top:18px"><h2 class="h2">What can be given</h2><div class="inv-grid">' +
      (grants.length ? grants.map(function (i) {
        return '<div class="inv-item rarity-' + esc(i.rarity) + '"><span class="inv-badge">' + esc(initials(i.name)) + '</span><span class="inv-name">' + esc(i.name) + '</span></div>';
      }).join('') : '<p class="muted">The badge list could not be loaded.</p>') + '</div></section>';

    $('#m-lookup').addEventListener('click', function () {
      var id = $('#m-id').value.trim();
      var out = $('#m-result');
      out.innerHTML = '<p class="muted">Looking up&hellip;</p>';
      api('GET', '/admin/member?id=' + encodeURIComponent(id)).then(function (d) {
        out.innerHTML = '<p>Badges for <strong>' + esc(id) + '</strong></p><div id="m-items">' + grants.map(function (i) {
          var on = (d.extra || []).indexOf(i.id) !== -1;
          return '<label class="check" style="margin:6px 0"><input type="checkbox" data-grant="' + esc(i.id) + '"' + (on ? ' checked' : '') + '> <span>' + esc(i.name) + ' <span class="muted">(' + esc(i.rarity) + ')</span></span></label>';
        }).join('') + '</div><div id="m-msg"></div><p><button class="btn btn-small btn-primary" type="button" id="m-save">Save badges</button></p>';
        $('#m-save').addEventListener('click', function () {
          var items = $$('[data-grant]', $('#m-items')).filter(function (c) { return c.checked; }).map(function (c) { return c.getAttribute('data-grant'); });
          api('PUT', '/admin/member/items', { userId: id, items: items }).then(function () {
            $('#m-msg').innerHTML = alertBox('Saved.', 'ok');
          }, function (err) { $('#m-msg').innerHTML = alertBox(err.message); });
        });
      }, function (err) { out.innerHTML = alertBox(err.message); });
    });
  }

  /* ---------------------------------------------------- latest post on the home page */
  function plainExcerpt(post) {
    var text = post.content || '';
    if (!text && post.embeds && post.embeds.length) text = (post.embeds[0].title ? post.embeds[0].title + '. ' : '') + (post.embeds[0].description || '');
    if (!text && post.components) {
      (function walk(list) {
        (list || []).forEach(function (c) { if (c && c.type === 10 && c.content && !text) text = c.content; walk(c && c.components); });
      })(post.components);
    }
    text = String(text).replace(/<a?:\w+:\d+>/g, '').replace(/[*_~`>#]+/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ').trim();
    return text.length > 240 ? text.slice(0, 237).replace(/\s+\S*$/, '') + '...' : text;
  }

  function loadHomeLatest() {
    var box = $('#home-latest');
    if (!box) return;
    fetch(FEED_URL + '?t=' + Math.floor(Date.now() / 60000), { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('feed');
      return r.json();
    }).then(function (data) {
      var post = data && data.announcements && data.announcements[0];
      if (!post) { box.innerHTML = '<p class="muted">No announcements yet.</p>'; return; }
      var excerpt = plainExcerpt(post);
      box.innerHTML = '<p class="muted">' + esc((post.author && post.author.name) || 'Staff') + ' | ' + esc(fmtDate(post.timestamp)) + '</p>' +
        (excerpt ? '<p class="excerpt">' + esc(excerpt) + '</p>' : '') + '<p><a class="link-arrow" href="#announcements">Read all announcements</a></p>';
    }).catch(function () {
      box.innerHTML = '<p class="muted">The latest announcements are in our Discord.</p>';
    });
  }

  /* -------------------------------------------------- seasonal particles */
  var fxKey = '';
  var FX_BY_THEME = {
    christmas: { kind: 'round', count: 34, size: [2, 5], speed: [9, 20] },
    halloween: { kind: 'warm', count: 26, size: [2, 5], speed: [14, 26] },
    neon: { kind: 'streak', count: 22, size: [6, 16], speed: [7, 16] },
    dusk: { kind: 'warm', count: 30, size: [2, 5], speed: [16, 30] },
    emerald: { kind: 'leaf', count: 22, size: [5, 10], speed: [14, 26] },
    vapor: { kind: 'firefly', count: 18, size: [3, 6], speed: [10, 20] },
    light: { kind: 'cool', count: 20, size: [2, 4], speed: [18, 30] },
    dark: { kind: 'cool', count: 24, size: [2, 4], speed: [18, 32] }
  };
  /* a worn badge can add its own weather on top of the look */
  var BADGE_FX = { winter: 'snow', gold_star: 'spark', founder: 'spark', ember: 'warm',
    aurora: 'spark', pass_emerald: 'leaf', pass_vapor: 'firefly' };

  function fxSpec(theme) {
    var spec = FX_BY_THEME[theme] || FX_BY_THEME.dark;
    var worn = state.me && state.me.inventory && state.me.inventory.equipped;
    var extra = BADGE_FX[worn];
    if (extra === 'snow') return { kind: 'round', count: 40, size: [2, 5], speed: [9, 18] };
    if (extra === 'spark') return { kind: 'spark', count: 22, size: [3, 7], speed: [8, 16] };
    if (extra === 'leaf') return { kind: 'leaf', count: 18, size: [5, 10], speed: [14, 24] };
    if (extra === 'firefly') return { kind: 'firefly', count: 16, size: [3, 6], speed: [10, 20] };
    return spec;
  }

  function buildFx(theme) {
    var box = document.getElementById('fx');
    if (!box) return;
    if (state.prefs.ambient === 'off' || motionReduced()) { box.innerHTML = ''; return; }
    var wide = (window.innerWidth || 1200) > 720;
    var spec = fxSpec(theme);
    var count = wide ? spec.count : Math.round(spec.count * 0.6);
    var html = '';
    for (var i = 0; i < count; i++) {
      var x = (Math.random() * 100).toFixed(2);
      var size = (Math.random() * (spec.size[1] - spec.size[0]) + spec.size[0]).toFixed(1);
      var dur = (Math.random() * (spec.speed[1] - spec.speed[0]) + spec.speed[0]).toFixed(1);
      var delay = (-Math.random() * 26).toFixed(1);
      var dx = Math.round(Math.random() * 170 - 85);
      var op = (Math.random() * 0.4 + 0.24).toFixed(2);
      html += '<i class="' + spec.kind + '" style="--x:' + x + '%;--s:' + size + 'px;--d:' + dur + 's;--delay:' + delay +
        's;--dx:' + dx + 'px;--o:' + op + '"></i>';
    }
    box.innerHTML = html;
  }

  /* ------------------------------------------------------------ boot screen */
  var bootAt = 0, bootSeq = 0, bootTimer = 0;
  function showBoot(text) {
    var b = document.getElementById('boot');
    if (!b) return;
    var t = document.getElementById('boot-text');
    if (t && text) t.textContent = text;
    b.hidden = false;
    b.classList.remove('closing');
    bootSeq += 1;
    bootAt = Date.now();
    /* never leave a visitor on the loader if the account request stalls */
    clearTimeout(bootTimer);
    bootTimer = setTimeout(function () { hideBoot(); }, 8000);
  }
  function hideBoot() {
    var b = document.getElementById('boot');
    if (!b || b.hidden) return;
    var mine = bootSeq;
    var wait = Math.max(0, 900 - (Date.now() - bootAt));
    setTimeout(function () {
      if (mine !== bootSeq) return;
      b.classList.add('closing');
      setTimeout(function () { if (mine === bootSeq) b.hidden = true; }, 420);
    }, wait);
  }

  /* --------------------------------------------------------------- carousel */
  var crsIndex = 0, crsTimer = 0, crsPaused = false;
  function goSlide(i) {
    var slides = $$('.hero-slide');
    if (!slides.length) return;
    crsIndex = ((i % slides.length) + slides.length) % slides.length;
    slides.forEach(function (sl, n) {
      var on = n === crsIndex;
      sl.classList.toggle('is-on', on);
      if (on) sl.removeAttribute('aria-hidden'); else sl.setAttribute('aria-hidden', 'true');
    });
    $$('[data-crs-dot]').forEach(function (d, n) {
      d.classList.toggle('is-on', n === crsIndex);
      d.setAttribute('aria-pressed', n === crsIndex ? 'true' : 'false');
    });
    var count = document.getElementById('crs-count');
    if (count) count.textContent = ('0' + (crsIndex + 1)).slice(-2) + ' / ' + ('0' + slides.length).slice(-2);
    var bar = document.getElementById('crs-bar');
    if (bar) { bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = ''; }
  }
  function restartCarousel() {
    if (crsTimer) { clearInterval(crsTimer); crsTimer = 0; }
    var stage = document.getElementById('hero-slides');
    var wrap = document.getElementById('hero-media');
    if (!stage) return;
    var auto = state.prefs.carousel === 'on' && !motionReduced() && !crsPaused;
    if (wrap && wrap.setAttribute) wrap.setAttribute('data-auto', auto ? 'on' : 'off');
    var pause = document.getElementById('crs-pause');
    if (pause) {
      pause.setAttribute('aria-pressed', crsPaused ? 'true' : 'false');
      pause.textContent = crsPaused ? 'Play' : 'Pause';
      pause.setAttribute('aria-label', crsPaused ? 'Resume automatic slide rotation' : 'Pause automatic slide rotation');
    }
    if (!auto) return;
    crsTimer = setInterval(function () { goSlide(crsIndex + 1); }, 7000);
  }

  /* ----------------------------------------------------------- look menu */
  function lookNote(text) {
    var pop = $('#look-pop');
    if (!pop) return;
    var note = $('#look-note');
    if (!note) {
      note = document.createElement('p');
      note.id = 'look-note';
      note.className = 'look-note';
      note.setAttribute('role', 'status');
      pop.appendChild(note);
    }
    note.textContent = text;
    setTimeout(function () { if (note.parentNode) note.remove(); }, 5000);
  }

  function closeLookMenu() {
    var pop = $('#look-pop'), btn = $('#look-btn');
    if (pop) pop.hidden = true;
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }
  function wireLookMenu() {
    var btn = $('#look-btn'), pop = $('#look-pop');
    if (!btn || !pop) return;
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = pop.hidden;
      pop.hidden = !open;
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    if (document.addEventListener) {
      document.addEventListener('click', function (e) {
        if (pop.hidden) return;
        if (pop.contains && pop.contains(e.target)) return;
        if (btn.contains && btn.contains(e.target)) return;
        closeLookMenu();
      });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeLookMenu(); });
    }
  }

  /* ------------------------------------------------------------ small touches */
  var GHOST_SVG = '<svg viewBox="0 0 60 70" width="54" height="63" aria-hidden="true"><path d="M8 66V28C8 12 18 4 30 4C42 4 52 12 52 28V66L45 60L38 66L30 60L22 66L15 60Z" fill="#EFE9F8"></path><circle cx="23" cy="28" r="4" fill="#0F0A1C"></circle><circle cx="37" cy="28" r="4" fill="#0F0A1C"></circle><ellipse cx="30" cy="40" rx="4" ry="5" fill="#0F0A1C"></ellipse></svg>';
  var clockFormat = null;

  function updateClock() {
    var h = $('#clk-h');
    var m = $('#clk-m');
    var z = $('#clk-s');
    if (!h || !m || !z) return;
    try {
      clockFormat = clockFormat || new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
      var parts = clockFormat.formatToParts(new Date());
      var get = function (type) {
        for (var i = 0; i < parts.length; i++) if (parts[i].type === type) return parts[i].value;
        return '';
      };
      h.textContent = get('hour');
      m.textContent = get('minute');
      z.textContent = (get('dayPeriod') + ' ' + get('timeZoneName')).trim();
    } catch (e) { /* the clock simply stays empty */ }
  }

  function countUp(scope) {
    var el = scope && scope.querySelector ? scope.querySelector('[data-open-count]') : null;
    if (!el || el.getAttribute('data-counted')) return;
    el.setAttribute('data-counted', '1');
    if (motionReduced() || typeof requestAnimationFrame !== 'function') return;
    var begin = null;
    function step(ts) {
      if (begin === null) begin = ts;
      var target = parseInt(el.getAttribute('data-target') || el.textContent, 10) || 0;
      var t = Math.min(1, (ts - begin) / 700);
      el.textContent = String(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* Opening screen: shown once per browser session, and skipped for reduced motion or a
     direct link into a page other than the home page. */
  function wireIntro() {
    var intro = document.getElementById('site-intro');
    if (!intro) return;
    var seen = false;
    try { seen = sessionStorage.getItem('laredo-intro') === '1'; } catch (e) { /* private mode */ }
    var skip = seen || motionReduced();
    if (skip) { intro.remove(); return; }
    var finish = function () {
      if (intro.classList.contains('is-done')) return;
      intro.classList.add('is-done');
      try { sessionStorage.setItem('laredo-intro', '1'); } catch (e) { /* ignore */ }
      setTimeout(function () { if (intro.parentNode) intro.remove(); }, 600);
    };
    var status = document.getElementById('intro-status');
    if (status) status.textContent = 'Opening the gates';
    setTimeout(finish, 1350);
    if (document.addEventListener) document.addEventListener('laredo:ready', finish);
  }

  /* A soft light that follows the pointer. Off with the pref, off for reduced motion. */
  function wireCursorGlow() {
    var glow = document.getElementById('cursor-glow');
    if (!glow || !document.addEventListener) return;
    var pending = false, mx = 50, my = 30;
    document.addEventListener('pointermove', function (e) {
      if (state.prefs.cursor !== 'on' || motionReduced()) return;
      mx = (e.clientX / (window.innerWidth || 1)) * 100;
      my = (e.clientY / (window.innerHeight || 1)) * 100;
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () {
        pending = false;
        glow.style.setProperty('--mx', mx.toFixed(2) + '%');
        glow.style.setProperty('--my', my.toFixed(2) + '%');
        glow.classList.add('is-live');
      });
    }, { passive: true });
    document.addEventListener('pointerleave', function () { glow.classList.remove('is-live'); });
  }

  function initUi() {
    root.classList.add('js');
    wireLookMenu();
    wireIntro();
    wireCursorGlow();

    $$('[data-crs]').forEach(function (b) {
      b.addEventListener('click', function () {
        goSlide(crsIndex + (b.getAttribute('data-crs') === 'next' ? 1 : -1));
        restartCarousel();
      });
    });
    $$('[data-crs-dot]').forEach(function (d, n) {
      d.addEventListener('click', function () { goSlide(n); restartCarousel(); });
    });
    var pause = document.getElementById('crs-pause');
    if (pause) {
      pause.addEventListener('click', function () {
        crsPaused = !crsPaused;
        restartCarousel();
      });
    }
    var stage = document.getElementById('hero-slides');
    if (stage) {
      stage.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight') { goSlide(crsIndex + 1); restartCarousel(); }
        if (e.key === 'ArrowLeft') { goSlide(crsIndex - 1); restartCarousel(); }
      });
    }
    goSlide(0);
    restartCarousel();

    var menuBtn = $('#menu-btn');
    var nav = $('#nav');
    if (menuBtn && nav) {
      menuBtn.addEventListener('click', function () {
        var open = !nav.classList.contains('open');
        nav.classList.toggle('open', open);
        menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      $$('a', nav).forEach(function (a) {
        a.addEventListener('click', function () { nav.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); });
      });
    }

    var items = $$('[data-reveal]');
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add('in'); countUp(en.target); io.unobserve(en.target); }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -4% 0px' });
      items.forEach(function (el) { io.observe(el); });
    } else {
      items.forEach(function (el) { el.classList.add('in'); });
    }

    var media = $('#hero-media');
    if (media && window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      var frame = 0;
      media.addEventListener('pointermove', function (e) {
        if (motionReduced() || frame) return;
        var r = media.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width * 2 - 1;
        var y = (e.clientY - r.top) / r.height * 2 - 1;
        frame = requestAnimationFrame(function () {
          frame = 0;
          media.style.setProperty('--px', x.toFixed(3));
          media.style.setProperty('--py', y.toFixed(3));
        });
      });
      media.addEventListener('pointerleave', function () {
        media.style.setProperty('--px', '0');
        media.style.setProperty('--py', '0');
      });
    }

    var pumpkin = $('#pumpkin');
    var slot = $('#ghost-slot');
    if (pumpkin && slot) {
      pumpkin.addEventListener('click', function () {
        var ghost = document.createElement('span');
        ghost.className = 'ghost-pop';
        ghost.innerHTML = GHOST_SVG;
        slot.appendChild(ghost);
        setTimeout(function () { if (ghost.parentNode) ghost.parentNode.removeChild(ghost); }, 2700);
      });
    }

    if (CONFIG.serverCode) {
      var codeBox = $('#fact-code');
      if (codeBox) { $('#fact-code-value').textContent = CONFIG.serverCode; codeBox.hidden = false; }
    }

    updateClock();
    setInterval(updateClock, 20000);
  }

  /* ----------------------------------------------------------------- start up */
  var params = new URLSearchParams(location.search);
  if (params.get('auth_error')) {
    state.authError = params.get('auth_error');
    history.replaceState(null, '', location.pathname + (location.hash || '#dashboard'));
  }

  initPrefs();

  initUi();
  window.addEventListener('hashchange', showPage);
  showPage();
  loadMe();
  loadSettings();

  setInterval(function () {
    if (state.page === 'announcements' && !document.hidden) loadFeed();
  }, 120000);
})();
