/* Laredo Roleplay website. Pages, appearance, accounts, applications, staff panel and the announcements feed. */
(function () {
  'use strict';

  var CONFIG = window.LAREDO_CONFIG || {};
  var FEED_URL = CONFIG.announcementsUrl || 'announcements.json';
  var root = document.getElementById('root');

  function $(sel, el) { return (el || document).querySelector(sel); }
  function $$(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }

  var PAGES = ['home', 'departments', 'applications', 'apply', 'announcements', 'shop', 'rules', 'staff', 'dashboard', 'panel', 'privacy'];
  var TITLES = {
    home: 'Laredo Roleplay', departments: 'Departments', applications: 'Applications', apply: 'Apply',
    announcements: 'Announcements', shop: 'Shop', rules: 'Rules', staff: 'Staff', dashboard: 'Dashboard',
    panel: 'Staff panel', privacy: 'Privacy'
  };
  var DEPTS = [
    ['lpd', 'Laredo Police Department'], ['wcso', "Webb County Sheriff's Office"], ['dps', 'Texas DPS / Highway Patrol'],
    ['lfd', 'Laredo Fire Department'], ['fbi', 'Federal Bureau of Investigation'], ['bp', 'Border Patrol'],
    ['swat', 'SWAT'], ['dot', 'Department of Transportation']
  ];
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
    if (r.page === 'announcements') loadFeed();
    if (r.page === 'home') loadHomeLatest();
    if (r.page === 'dashboard') renderDashboard();
    if (r.page === 'apply') renderApply(r.arg);
    if (r.page === 'panel') renderPanel();
  }

  /* --------------------------------------------------------------- appearance */
  function savedTheme() {
    try { return localStorage.getItem('laredo-theme'); } catch (e) { return null; }
  }

  function setTheme(theme, save) {
    theme = theme === 'halloween' ? 'halloween' : 'normal';
    root.classList.remove('t-normal', 't-halloween');
    root.classList.add('t-' + theme);
    $$('[data-theme-btn]').forEach(function (btn) {
      var on = btn.getAttribute('data-theme-btn') === theme;
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'halloween' ? '#0E0A12' : '#0B0E14');
    if (save) { try { localStorage.setItem('laredo-theme', theme); } catch (e) { /* ignore */ } }
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

    if (!savedTheme()) setTheme(s.defaultTheme, false);
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
    box.innerHTML = '<a class="account" href="#dashboard"><img alt="" src="' + esc(me.user.avatar) + '"><span>' + esc(me.user.name) + '</span></a>';
  }

  var meP = null, settingsP = null, formsP = null;

  function loadMe(force) {
    if (!meP || force) {
      meP = api('GET', '/me').then(function (me) { state.me = me; }, function () { state.me = { loggedIn: false, offline: true }; })
        .then(function () { renderAccount(); checkMaintenance(); });
    }
    return meP;
  }

  function loadForms() {
    if (!formsP) formsP = api('GET', '/forms').then(function (d) { state.forms = d.forms; }, function () { state.forms = null; });
    return formsP;
  }

  function ensureData() {
    return Promise.all([loadMe(), loadSettings(), loadForms()]);
  }

  /* -------------------------------------------------------------- dashboard */
  function renderDashboard() {
    var el = $('#dash-root');
    el.innerHTML = '<p class="muted">Loading...</p>';
    ensureData().then(function () {
      var me = state.me;
      var err = state.authError ? alertBox(AUTH_ERRORS[state.authError] || 'Sign in failed. Please try again.') : '';
      state.authError = '';
      if (me.offline) { el.innerHTML = alertBox('Accounts are not switched on for this copy of the site.'); return; }
      if (!me.loggedIn) {
        el.innerHTML = err + '<div class="panel panel-wide"><h2 class="h2">Sign in</h2>' +
          '<p>Sign in with Discord to apply, track your applications and link your Roblox account. We only read your Discord name, avatar and the roles you have in our server.</p>' +
          '<p><a class="btn btn-primary" href="' + signInUrl('dashboard') + '">Sign in with Discord</a></p></div>';
        return;
      }
      api('GET', '/applications/mine').then(function (d) { return d.applications; }, function () { return []; }).then(function (apps) {
        var html = err;
        if (me.warning) html += alertBox(me.warning);
        html += '<div class="dash-grid"><div class="stack">';

        html += '<section class="panel"><div class="profile"><img class="profile-img" alt="" src="' + esc(me.user.avatar) + '"><div>' +
          '<h2 class="h2">' + esc(me.user.name) + '</h2>';
        html += me.inGuild
          ? '<p class="muted">Member of the Laredo Roleplay Discord</p>'
          : '<p class="muted">You are not in our Discord yet.</p><p><a class="btn btn-small" target="_blank" rel="noopener noreferrer" href="' + esc(CONFIG.discordInvite || '') + '">Join the Discord</a></p>';
        html += '<p>' + (me.isAdmin ? '<span class="tag tag-ok">Staff admin</span> ' : '') + (me.isStaff ? '<span class="tag tag-wait">Staff team</span>' : '') + '</p>';
        html += '</div></div><p><button class="btn btn-small" id="signout">Sign out</button></p></section>';

        html += '<section class="panel"><h2 class="h2">Roblox account</h2>';
        if (me.roblox) {
          html += '<p>Linked as <strong>' + esc(me.roblox.name) + '</strong> <span class="muted">(ID ' + esc(me.roblox.id) + ')</span></p>' +
            '<p><button class="btn btn-small" id="unlink">Unlink</button></p>';
        } else if (!me.robloxConfigured) {
          html += '<p class="muted">Roblox linking is not switched on yet.</p>';
        } else {
          html += '<p>Link your Roblox account with Roblox\'s own sign in. We only receive your username and ID, never your password.</p>' +
            '<p><a class="btn btn-primary btn-small" href="/api/auth/roblox/login">Link Roblox account</a></p>';
        }
        html += '</section></div><div class="stack">';

        if (me.isStaff) {
          html += '<section class="panel panel-accent"><h2 class="h2">Staff tools</h2><p>Review applications' + (me.isAdmin ? ' and change website settings.' : '.') + '</p>' +
            '<p><a class="btn btn-primary" href="#panel">Open staff panel</a></p></section>';
        }
        html += '<section class="panel"><h2 class="h2">Your applications</h2>';
        if (!apps.length) {
          html += '<p class="muted">You have not applied for anything yet.</p><p><a class="btn btn-small" href="#applications">See open applications</a></p>';
        } else {
          html += '<ul class="plain-list">' + apps.map(function (a) {
            return '<li><div class="split"><strong>' + esc(a.typeLabel) + '</strong>' + tag(a.status) + '</div>' +
              '<p class="muted">Sent ' + esc(fmtDate(a.createdAt)) + '</p>' +
              (a.decision && a.decision.note ? '<p class="note">Staff note: ' + esc(a.decision.note) + '</p>' : '') + '</li>';
          }).join('') + '</ul>';
        }
        html += '</section></div></div>';
        el.innerHTML = html;

        $('#signout').addEventListener('click', function () {
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
      });
    });
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
    el.innerHTML = '<p class="muted">Loading...</p>';
    ensureData().then(function () {
      var me = state.me;
      if (me.offline) { el.innerHTML = alertBox('The staff panel is not switched on for this copy of the site.'); return; }
      if (!me.loggedIn) {
        el.innerHTML = '<div class="panel panel-wide"><h2 class="h2">Staff sign in</h2><p>Sign in with Discord. Access is checked against your roles in our server.</p>' +
          '<p><a class="btn btn-primary" href="' + signInUrl('panel') + '">Sign in with Discord</a></p></div>';
        return;
      }
      if (!me.isStaff) {
        el.innerHTML = alertBox('This area is for the staff team only.') + '<p><a class="btn" href="#dashboard">Back to dashboard</a></p>';
        return;
      }
      var tabs = '<div class="tabs" role="tablist"><button class="tab' + (state.panelTab === 'applications' ? ' on' : '') + '" data-tab="applications" role="tab">Applications</button>' +
        (me.isAdmin ? '<button class="tab' + (state.panelTab === 'settings' ? ' on' : '') + '" data-tab="settings" role="tab">Settings</button>' : '') + '</div>';
      el.innerHTML = tabs + '<div id="panel-body"></div>';
      $$('.tab', el).forEach(function (t) {
        t.addEventListener('click', function () { state.panelTab = t.getAttribute('data-tab'); renderPanel(); });
      });
      if (state.panelTab === 'settings' && me.isAdmin) panelSettings($('#panel-body'));
      else panelApplications($('#panel-body'), { status: 'pending', type: '' });
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
    var html = '<form id="settings-form" class="form" novalidate>';

    html += '<section class="panel"><h2 class="h2">Site notice</h2><p class="muted">A strip across the top of every page.</p>' + checkbox('s-notice-on', 'Show the notice', s.notice.enabled) +
      '<div class="field"><label for="s-notice-text">Text</label><input type="text" id="s-notice-text" maxlength="200" value="' + esc(s.notice.text) + '"></div>' +
      '<div class="field"><label for="s-notice-link">Link (optional, https://)</label><input type="text" id="s-notice-link" maxlength="300" value="' + esc(s.notice.link) + '"></div></section>';

    html += '<section class="panel"><h2 class="h2">Maintenance mode</h2><p class="muted">Visitors see a "back soon" screen. Staff can still use the site.</p>' +
      checkbox('s-maint-on', 'Maintenance mode is on', s.maintenance.enabled) +
      '<div class="field"><label for="s-maint-msg">Message</label><input type="text" id="s-maint-msg" maxlength="300" value="' + esc(s.maintenance.message) + '"></div></section>';

    html += '<section class="panel"><h2 class="h2">Appearance</h2><div class="field"><label for="s-theme">Default mode for new visitors</label><select id="s-theme"><option value="normal">Normal</option><option value="halloween">Halloween</option></select></div></section>';

    html += '<section class="panel"><h2 class="h2">Applications</h2><p class="muted">Closed applications cannot be submitted.</p>' +
      Object.keys(APP_TYPES).map(function (k) { return checkbox('s-app-' + k, APP_TYPES[k] + ' is open', s.applications[k].open); }).join('') + '</section>';

    html += '<section class="panel"><h2 class="h2">Departments</h2><p class="muted">A department shows as open once it is ticked and has an invite.</p>' +
      DEPTS.map(function (d) {
        var c = s.departments[d[0]];
        return '<div class="dept-edit"><strong>' + esc(d[1]) + '</strong>' + checkbox('s-dept-' + d[0], 'Open', c.open) +
          '<div class="field"><label for="s-inv-' + d[0] + '">Discord invite</label><input type="text" id="s-inv-' + d[0] + '" maxlength="80" placeholder="https://discord.gg/..." value="' + esc(c.invite) + '"></div></div>';
      }).join('') + '</section>';

    html += '<section class="panel"><h2 class="h2">Shop prices (Robux)</h2><div class="price-grid">' +
      PRICE_FIELDS.map(function (p) {
        return '<div class="field"><label for="s-price-' + p[0] + '">' + esc(p[1]) + '</label><input type="number" min="0" max="1000000" id="s-price-' + p[0] + '" value="' + esc(s.prices[p[0]]) + '"></div>';
      }).join('') + '</div></section>';

    html += '<div id="settings-msg"></div><div><button class="btn btn-primary" type="submit">Save settings</button></div></form>';
    body.innerHTML = html;
    $('#s-theme').value = s.defaultTheme;

    $('#settings-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var data = {
        notice: { enabled: $('#s-notice-on').checked, text: $('#s-notice-text').value, link: $('#s-notice-link').value },
        maintenance: { enabled: $('#s-maint-on').checked, message: $('#s-maint-msg').value },
        defaultTheme: $('#s-theme').value,
        applications: {}, departments: {}, prices: {}
      };
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

  /* ----------------------------------------------------------------- start up */
  var params = new URLSearchParams(location.search);
  if (params.get('auth_error')) {
    state.authError = params.get('auth_error');
    history.replaceState(null, '', location.pathname + (location.hash || '#dashboard'));
  }

  setTheme(savedTheme() || 'normal', false);
  $$('[data-theme-btn]').forEach(function (btn) {
    btn.addEventListener('click', function () { setTheme(btn.getAttribute('data-theme-btn'), true); });
  });

  $$('img[data-optional]').forEach(function (img) {
    var ok = function () { var fig = img.closest('figure'); if (fig) fig.classList.add('has-photo'); };
    var bad = function () { img.remove(); };
    if (img.complete) { if (img.naturalWidth) ok(); else bad(); }
    else { img.addEventListener('load', ok); img.addEventListener('error', bad); }
  });

  window.addEventListener('hashchange', showPage);
  showPage();
  loadMe();
  loadSettings();

  setInterval(function () {
    if (state.page === 'announcements' && !document.hidden) loadFeed();
  }, 120000);
})();
