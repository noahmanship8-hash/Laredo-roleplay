// All the "pretty" panels live here. They use Discord's Components V2 (containers,
// banner images, text blocks, dividers, buttons, dropdowns) - the same style as your screenshots.
//
// Every outgoing message is built by toPayload() at the bottom of the helpers section.
// Nothing outside this file should touch `flags` or spread a builder: the V2 flag has to be
// OR'd with Ephemeral, never replaced by it, and a builder has no enumerable keys to spread.
const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  AttachmentBuilder,
  MessageFlags,
} = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const config = require('../config');
const content = require('../content');
const shop = require('../shop');

// fallback keeps this working on discord.js versions without the constant
const V2 = MessageFlags.IsComponentsV2 ?? 1 << 15;
const EPHEMERAL = MessageFlags.Ephemeral;

const MAX_TOP = 10;      // top-level components Discord accepts in one V2 message
const MAX_TEXT = 3968;   // text display limit, a little short of 4000 to be safe

// ---------- tiny helpers ----------
const text = (s) => new TextDisplayBuilder().setContent(String(s ?? '').slice(0, MAX_TEXT));
const divider = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

// Banners can be either:
//   - a file name in the /assets folder, e.g. 'rules.png'  (the bot uploads it itself - recommended)
//   - a full https:// image link
const ASSET_DIR = path.join(__dirname, '..', 'assets');
const isUrl = (s) => /^https?:\/\//i.test(s);

function gallery(ref) {
  if (!ref) return null;
  let url = ref;
  if (!isUrl(ref)) {
    if (!fs.existsSync(path.join(ASSET_DIR, ref))) {
      console.warn(`[banner] "${ref}" was not found in the /assets folder, skipping it.`);
      return null;
    }
    url = `attachment://${ref}`;
  }
  const g = new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(url));
  g.assetRef = isUrl(ref) ? null : ref; // remembered so we know which files to upload with the message
  return g;
}
const quote = (s) => String(s).split('\n').map((l) => `> ${l}`).join('\n');
// Turns "🎫" or a custom emoji like "<:name:123456>" into the shape Discord menus/buttons need
function emojiObj(e) {
  const m = /^<(a?):(\w+):(\d+)>$/.exec(e);
  return m ? { animated: m[1] === 'a', name: m[2], id: m[3] } : { name: e };
}
const code = (v) => `\`${v ?? '-'}\``;
const row = (...components) => new ActionRowBuilder().addComponents(...components);

// Builds one container out of a list of parts (nulls and empty text are skipped).
function container(parts, accent = config.accentColor) {
  const c = new ContainerBuilder();
  if (accent !== null && accent !== undefined) c.setAccentColor(accent);
  const refs = new Set();
  for (const p of parts) {
    if (!p) continue;
    if (p instanceof TextDisplayBuilder) {
      // Discord rejects an empty text display, so drop it here instead of at the API
      const data = typeof p.toJSON === 'function' ? p.toJSON() : p;
      if (!data || !String(data.content || '').trim()) continue;
      c.addTextDisplayComponents(p);
    } else if (p instanceof SeparatorBuilder) {
      c.addSeparatorComponents(p);
    } else if (p instanceof MediaGalleryBuilder) {
      c.addMediaGalleryComponents(p);
      if (p.assetRef) refs.add(p.assetRef);
    } else if (p instanceof ActionRowBuilder) {
      c.addActionRowComponents(p);
    }
  }
  c.assetRefs = [...refs];
  return c;
}

const listOf = (c) => (Array.isArray(c) ? c : [c]).filter(Boolean);
const filesOf = (c) => {
  const refs = new Set(listOf(c).flatMap((x) => x.assetRefs || []));
  return [...refs].map((ref) => new AttachmentBuilder(path.join(ASSET_DIR, ref), { name: ref }));
};

// ---------------------------------------------------------------------------
// The payload layer. Every message leaves through here.
// ---------------------------------------------------------------------------
const isUnit = (x) =>
  x instanceof ContainerBuilder || x instanceof TextDisplayBuilder || x instanceof SeparatorBuilder ||
  x instanceof MediaGalleryBuilder || x instanceof ActionRowBuilder;

// A container, or a stray row/text/separator, or a payload, all become a list of top-level units.
function unitsOf(input) {
  const base = input == null ? [] : Array.isArray(input) ? input : [input];
  const out = [];
  for (const item of base) {
    if (!item) continue;
    if (item instanceof ContainerBuilder) out.push(item);
    else if (item instanceof ActionRowBuilder) out.push(item);
    else if (item instanceof TextDisplayBuilder || item instanceof SeparatorBuilder || item instanceof MediaGalleryBuilder) {
      out.push(container([item])); // these only make sense inside a container
    }
  }
  return out;
}

// Builds one legal Components V2 payload from anything the panels return.
function toPayload(input, { ephemeral = false, flags } = {}) {
  let body = {};
  if (typeof input === 'string') body = { components: [container([text(input)])] };
  else if (input && !Array.isArray(input) && !isUnit(input)) body = { ...input }; // already a payload
  else body = { components: unitsOf(input) };

  // V2 messages may not also carry content, embeds, stickers or a poll
  delete body.content;
  delete body.embeds;
  delete body.stickers;
  delete body.poll;

  const units = unitsOf(body.components);
  if (units.length > MAX_TOP) {
    console.warn(`[ui] ${units.length} top-level components given; Discord allows ${MAX_TOP}. Extra ones dropped.`);
    units.length = MAX_TOP;
  }

  let f = flags ?? V2;
  if (ephemeral) f |= EPHEMERAL; // OR, never assign: this is what produced 50035 before
  body.components = units;
  body.flags = f;
  if (units.length === 0) delete body.components;

  const files = filesOf(units);
  if (files.length) body.files = files;
  else delete body.files;

  return body;
}

// For interaction.update(): same components, no flags (an edit keeps the message's own flags)
function toUpdate(input) {
  const { components, files } = toPayload(input);
  const body = { components };
  if (files) body.files = files;
  return body;
}

// Splits a long list of containers into several payloads (Discord allows 10 per message)
function toPages(input, { ephemeral = false } = {}) {
  const units = unitsOf(input);
  if (units.length <= MAX_TOP) return [toPayload(input, { ephemeral })];
  const pages = [];
  for (let i = 0; i < units.length; i += MAX_TOP) {
    pages.push(toPayload(units.slice(i, i + MAX_TOP), { ephemeral }));
  }
  return pages;
}

const asMessage = (c) => toPayload(c);
const asEphemeral = (c) => toPayload(c, { ephemeral: true });
const ephemeralPages = (c) => toPages(c, { ephemeral: true });
const asUpdate = (c) => toUpdate(c);

const footer = () => gallery(config.banners.footer);

// ---------- REGULATIONS ----------
function regulationsPanel() {
  const serverMenu = new StringSelectMenuBuilder()
    .setCustomId('reg:server')
    .setPlaceholder('Server Regulations')
    .addOptions(
      Object.entries(content.regulations).map(([key, v]) => ({
        label: v.label,
        value: key,
        description: v.description,
      })),
    );

  const bannedMenu = new StringSelectMenuBuilder()
    .setCustomId('reg:banned')
    .setPlaceholder('Banned Items')
    .addOptions(
      Object.entries(content.banned).map(([key, v]) => ({
        label: v.label,
        value: key,
        description: v.description,
      })),
    );

  return container([
    gallery(config.banners.regulations),
    divider(),
    text(
      quote(
        'Whilst engaging with anyone on our server or playing our in-game server, you\'re required to follow a ' +
          'strictly moderated set of regulations that **must not be broken**.',
      ),
    ),
    text(
      quote(
        `The maximum amount of moderations that you can receive is ${code(config.maxModerations)}, in the event ` +
          'you reach this amount you will be banned from our community.',
      ),
    ),
    divider(),
    row(serverMenu),
    divider(),
    row(bannedMenu),
    divider(),
    footer(),
  ]);
}

function ruleView(entry) {
  const body = entry.rules.map((r, i) => `**${i + 1}.** ${r}`).join('\n') || 'Nothing listed yet.';
  return container([text(`## ${entry.label}`), divider(), text(body)]);
}

function bannedView(entry) {
  const body = entry.items.map((i) => `- ${i}`).join('\n') || 'Nothing listed yet.';
  return container([text(`## ${entry.label}`), divider(), text(body)]);
}

// ---------- INFORMATION ----------
function informationPanel() {
  const links = [
    ['Whitelisted Group', config.links.whitelistedGroup],
    ['Roblox Group', config.links.robloxGroup],
    ['Website', config.links.website],
    ['ER:LC Game', config.links.erlcGame],
  ]
    .filter(([, url]) => url)
    .map(([label, url]) => new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(label).setURL(url));

  const topics = Object.entries(content.infoTopics || {});
  const menu = topics.length
    ? new StringSelectMenuBuilder()
        .setCustomId('info:topic')
        .setPlaceholder('More Information')
        .addOptions(
          topics.map(([key, t]) => {
            const opt = { label: t.label, value: key, description: t.description };
            if (t.emoji) opt.emoji = emojiObj(t.emoji);
            return opt;
          }),
        )
    : null;

  return container([
    gallery(config.banners.information),
    divider(),
    text(quote(config.information)),
    text(`> ⚠️ **Default kick timer:** ${code(config.kickTimer)}`),
    divider(),
    links.length ? row(...links) : null,
    links.length ? divider() : null,
    menu ? row(menu) : null,
    menu ? divider() : null,
    footer(),
  ]);
}

// What a member sees (privately) after picking a topic from the Information dropdown
function infoTopicView(t) {
  return container([
    text(`## ${t.title || t.label}`),
    t.quote && t.quote.length ? text(quote(t.quote.join('\n'))) : null,
    t.body ? text(t.body) : null,
    t.image ? gallery(t.image) : null,
  ]);
}

// ---------- DEPARTMENTS ----------
function departmentsPanel() {
  const lines = config.departments.map((d) => {
    const link = d.invite ? `[Click here](${d.invite})` : '*Link coming soon*';
    return `${d.emoji ? d.emoji + ' ' : ''}**${d.name}** — ${link}`;
  });
  if (config.departmentHub) lines.push(`🏛️ **Department Hub** — [Click here](${config.departmentHub})`);

  const menu = new StringSelectMenuBuilder()
    .setCustomId('dept:select')
    .setPlaceholder('Select a department...')
    .addOptions(
      config.departments.map((d) => {
        const opt = { label: d.name.slice(0, 100), value: d.id, description: (d.description || '').slice(0, 100) || undefined };
        if (d.emoji) opt.emoji = emojiObj(d.emoji);
        return opt;
      }),
    );

  return container([
    gallery(config.banners.departments),
    divider(),
    text(
      quote(
        'We have countless departments here at **Laredo Roleplay**, from law enforcement to fighting fire, we have it all. ' +
          'Find the invite link for each department below, or pick one from the menu for more info.',
      ),
    ),
    text(lines.join('\n')),
    config.departmentHub
      ? text(
          quote(
            'Whitelisted members are required to join our **Department Hub** to stay up to date with everything going on about our departments.',
          ),
        )
      : null,
    divider(),
    row(menu),
    divider(),
    footer(),
  ]);
}

function departmentView(d) {
  const parts = [text(`## ${d.emoji ? d.emoji + ' ' : ''}${d.name}`)];
  if (d.description) parts.push(text(d.description));
  parts.push(divider());
  if (d.invite) {
    parts.push(row(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Join Department').setURL(d.invite)));
  } else {
    parts.push(text('*The invite link for this department is coming soon.*'));
  }
  return container(parts);
}

// ---------- NOTIFICATIONS (roles) ----------
function notificationsPanel() {
  const list = config.notificationRoles.slice(0, 5);
  const buttons = list.map((n) =>
    new ButtonBuilder().setCustomId(`notif:${n.key}`).setStyle(ButtonStyle.Secondary).setEmoji(emojiObj(n.emoji)),
  );
  return container([
    gallery(config.banners.roles),
    divider(),
    text(
      quote(
        'Select a role below to get notified whenever something happens on our Discord. You can manage the pings ' +
          'you receive for sessions, announcements and more at any time.',
      ),
    ),
    text(quote(list.map((n) => `${n.emoji} **${n.label}**`).join('\n'))),
    divider(),
    row(...buttons),
    divider(),
    footer(),
  ]);
}

// ---------- APPLICATIONS ----------
function applicationsPanel() {
  const list = config.applications
    .map((a) => `${a.emoji ? a.emoji + ' ' : ''}**${a.label}** — ${a.open ? '🟢 Open' : '🔴 Closed'}`)
    .join('\n');
  const menu = new StringSelectMenuBuilder()
    .setCustomId('app:select')
    .setPlaceholder('Select an application...')
    .addOptions(
      config.applications.map((a) => {
        const opt = { label: a.label, value: a.id, description: a.description };
        if (a.emoji) opt.emoji = emojiObj(a.emoji);
        return opt;
      }),
    );
  return container([
    config.banners.applications ? gallery(config.banners.applications) : text('## 📋 Applications'),
    divider(),
    text(
      quote(
        'Applications are now available! Pick the application you are interested in from the menu below to read ' +
          'the details and apply.',
      ),
    ),
    text(quote(list)),
    divider(),
    row(menu),
    divider(),
    footer(),
  ]);
}

function applicationView(a) {
  const parts = [text(`## ${a.emoji ? a.emoji + ' ' : ''}${a.label}`)];
  if (a.info) parts.push(text(a.info));
  parts.push(divider());
  if (a.open && a.url) {
    parts.push(row(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Open Application').setURL(a.url)));
  } else {
    parts.push(text('🔴 **Applications for this role are currently closed.** Check back later!'));
  }
  return container(parts);
}

// ---------- SUGGESTIONS ----------
function suggestionCard(s) {
  const up = new ButtonBuilder().setCustomId('sug:up').setLabel(`👍 ${s.up.length}`).setStyle(ButtonStyle.Success);
  const down = new ButtonBuilder().setCustomId('sug:down').setLabel(`👎 ${s.down.length}`).setStyle(ButtonStyle.Danger);
  const accept = new ButtonBuilder().setCustomId('sug:accept').setLabel('Accept').setStyle(ButtonStyle.Secondary);
  const deny = new ButtonBuilder().setCustomId('sug:deny').setLabel('Deny').setStyle(ButtonStyle.Secondary);

  const lines = [`-# Suggested by <@${s.userId}>`];
  if (s.status === 'accepted') lines.push(`-# Accepted by <@${s.by}>`);
  if (s.status === 'denied') lines.push(`-# Denied by <@${s.by}>`);
  const accent = s.status === 'accepted' ? 0x2ecc71 : s.status === 'denied' ? 0xe74c3c : config.accentColor;

  return container(
    [text(`## New Suggestion\n${s.text}`), text(lines.join('\n')), divider(), row(up, down, accept, deny), divider(), footer()],
    accent,
  );
}

// ---------- STAFF REVIEW ----------
function staffReviewCard({ staffId, rating, reason, reviewerId }) {
  return container([
    text('## Staff Review'),
    text(
      `**Staff Member:** <@${staffId}>\n**Rating:** ${rating}/10\n**Reason:** ${reason}\n-# Reviewed by <@${reviewerId}>`,
    ),
    divider(),
    footer(),
  ]);
}

// ---------- ANNOUNCEMENT ----------
function announcementCard({ title, body, userId }) {
  const ts = Math.floor(Date.now() / 1000);
  return container([
    text(`## 📢 ${title}`),
    divider(),
    text(body),
    divider(),
    text(`-# Announced by <@${userId}> • <t:${ts}:F>`),
    divider(),
    footer(),
  ]);
}

// ---------- ASSISTANCE (tickets) ----------
function assistancePanel() {
  const menu = new StringSelectMenuBuilder()
    .setCustomId('ticket:create')
    .setPlaceholder('Select a ticket type...')
    .addOptions(
      config.ticketTypes.map((t) => {
        const opt = { label: t.label, value: t.id, description: t.description };
        if (t.emoji) opt.emoji = emojiObj(t.emoji);
        return opt;
      }),
    );

  return container([
    gallery(config.banners.assistance),
    divider(),
    text(
      quote(
        'Our assistance dashboard is here to easily contact our support team through various ticket options. ' +
          "Pick the one that you think best supports your issue(s) and we'll be there to assist as soon as " +
          'possible. Avoid pining staff inside of your tickets as they are already notified when you open the ticket.',
      ),
    ),
    text(`> **Average Response Time:** ${code(config.responseTime)}.`),
    divider(),
    row(menu),
    footer(),
  ]);
}

// What the user sees inside their new ticket channel
function ticketWelcome(type, user) {
  const claim = new ButtonBuilder().setCustomId('ticket:claim').setLabel('Claim').setStyle(ButtonStyle.Primary);
  const close = new ButtonBuilder().setCustomId('ticket:close').setLabel('Close Ticket').setStyle(ButtonStyle.Danger);
  return container([
    text(`## ${type.emoji ? type.emoji + ' ' : ''}${type.label}`),
    text(
      `Opened by ${user}\n\n` +
        (type.welcome || 'Please explain your issue in as much detail as you can.') +
        ' A staff member will be with you shortly. **Please do not ping staff**, they have already been notified.',
    ),
    divider(),
    row(claim, close),
  ]);
}

// ---------- SESSION INFO ----------
function sessionPanel(s) {
  const online = s.status === 'online';
  const d = config.session;
  const ts = Math.floor((s.updatedAt || Date.now()) / 1000);
  const max = s.maxPlayers ?? d.maxPlayers;

  const notify = new ButtonBuilder()
    .setCustomId('session:notify')
    .setLabel('Session Notification')
    .setStyle(ButtonStyle.Secondary);
  const status = new ButtonBuilder()
    .setCustomId('session:status')
    .setLabel(online ? 'Session Online' : 'Session Offline')
    .setStyle(online ? ButtonStyle.Success : ButtonStyle.Danger)
    .setDisabled(true);

  return container([
    gallery(config.banners.session),
    divider(),
    text(
      quote(
        'Our sessions are managed by our **Session Managers**. We do not have an available schedule for sessions, ' +
          'meaning they will commence when our team is available.\n' +
          `**Last Updated:** <t:${ts}:R>`,
      ),
    ),
    divider(),
    text(
      quote(
        `**Server Name:** ${code(s.serverName || d.serverName)}\n` +
          `**Server Owner:** ${code(s.owner || d.owner)}\n` +
          `**Server Code:** ${code(s.code || d.code)}`,
      ),
    ),
    text(
      quote(
        `**In-game Players:** ${code(`${online ? s.players : 0}/${max}`)}\n` +
          `**Currently Moderating:** ${code(online ? s.moderating : 0)}\n` +
          `**In-Queue Players:** ${code(online ? s.queue : 0)}`,
      ),
    ),
    divider(),
    row(notify, status),
    divider(),
    footer(),
  ]);
}

// ---------- MARKETPLACE / SHOP ----------
function marketplacePanel() {
  const view = new ButtonBuilder().setCustomId('shop:view').setLabel('🛒 View Shop').setStyle(ButtonStyle.Secondary);
  const ticket = new ButtonBuilder().setCustomId('shop:ticket').setLabel('🎟️ Open Shop Ticket').setStyle(ButtonStyle.Success);
  return container([
    gallery(config.banners.marketplace),
    divider(),
    text(quote(shop.panelText)),
    divider(),
    row(view, ticket),
    divider(),
    footer(),
  ]);
}

// The full price list: one box per entry in shop.js. The last box also has a "Open Shop Ticket" button.
// This returns an ARRAY of containers - pass it to asEphemeralPages(), never spread it.
function shopView() {
  const ticket = new ButtonBuilder().setCustomId('shop:ticket').setLabel('🎟️ Open Shop Ticket').setStyle(ButtonStyle.Success);
  return shop.cards.map((lines, i) => {
    const parts = [text(lines.join('\n'))];
    if (i === shop.cards.length - 1) parts.push(divider(), row(ticket));
    return container(parts, shop.accentColor);
  });
}

// ---------- STAFF INFO PANEL (Components V2) ----------
function staffInfoPanel() {
  const panelConfig = config.staffInfo;

  const menu = new StringSelectMenuBuilder()
    .setCustomId('select_staff_info')
    .setPlaceholder('Select staff information...')
    .addOptions(
      panelConfig.options.map((opt) => {
        const optionBuilder = { label: opt.label, value: opt.id, description: opt.description };
        if (opt.emoji) optionBuilder.emoji = emojiObj(opt.emoji);
        return optionBuilder;
      }),
    );

  const parts = [gallery(config.banners.staffInfo), divider(), text(quote(panelConfig.description)), divider(), row(menu)];

  if (panelConfig.dashboardUrl) {
    const dashButton = new ButtonBuilder()
      .setLabel('Staff Dashboard')
      .setStyle(ButtonStyle.Link)
      .setURL(panelConfig.dashboardUrl);
    parts.push(divider(), row(dashButton));
  }

  parts.push(divider(), footer());
  return container(parts);
}

// ---------- LOGS ----------
function logCard(title, lines) {
  return container([text(`## ${title}`), divider(), text(lines.join('\n')), divider(), text(`-# ${config.name} • Community utilities • <t:${Math.floor(Date.now() / 1000)}:t>`)], 0x5865F2);
}

module.exports = {
  V2,
  EPHEMERAL,
  toPayload,        // container | array of containers | payload | string  -> legal V2 message
  toUpdate,         // same, for interaction.update() (no flags)
  toPages,          // splits long lists into several messages of 10
  asMessage,
  asEphemeral,
  ephemeralPages,
  asUpdate,
  regulationsPanel,
  ruleView,
  bannedView,
  informationPanel,
  assistancePanel,
  ticketWelcome,
  emojiObj,
  infoTopicView,
  departmentsPanel,
  departmentView,
  notificationsPanel,
  applicationsPanel,
  applicationView,
  suggestionCard,
  staffReviewCard,
  announcementCard,
  sessionPanel,
  marketplacePanel,
  shopView,
  staffInfoPanel,
  logCard,
};
