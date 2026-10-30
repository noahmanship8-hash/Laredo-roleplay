// ============================================================================
//  TICKET SYSTEM  (utils/tickets.js)
//
//  - Creates private ticket channels with a numbered control card
//  - Claim / Unclaim, Close (with an optional reason), Transcript buttons
//  - Saves a full HTML transcript to your logs channel and DMs a copy to the opener
//  - Optional auto-close for inactive tickets
//
//  Button presses are answered by editing the ticket card or with private (ephemeral)
//  messages. The bot never replies publicly to a button press.
// ============================================================================
const fs = require('node:fs');
const path = require('node:path');
const {
  ChannelType,
  PermissionFlagsBits: P,
  AttachmentBuilder,
  EmbedBuilder,
  Events,
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const config = require('../config');
const db = require('./db');
const { isStaff } = require('./perms');

const V2 = MessageFlags.IsComponentsV2;
const EPHEMERAL = MessageFlags.Ephemeral;
const NO_MENTIONS = { parse: [] };
const ASSET_DIR = path.join(__dirname, '..', 'assets');

// Optional settings. Add a `tickets: { ... }` block to config.js to change them.
const settings = () => ({
  autoCloseHours: 0, // 0 = never auto-close. e.g. 48 = close after 48 hours with no messages
  dmTranscript: true, // DM the ticket opener a copy of the transcript when it closes
  ...(config.tickets || {}),
});

const num = (n) => (n ? String(n).padStart(4, '0') : '----');
const getTicket = (channelId) => db.data.tickets[channelId];
const closing = new Set(); // channels currently being closed (stops double-clicks)

function typeFor(ticket) {
  return (
    config.ticketTypes.find((t) => t.id === ticket.type) ||
    (config.shopTicket && config.shopTicket.id === ticket.type ? config.shopTicket : null) || {
      id: ticket.type,
      label: String(ticket.type || 'Ticket'),
      emoji: '🎫',
    }
  );
}

// A private message to the person who clicked
const replyPrivate = (interaction, content) =>
  interaction.reply({ content, flags: EPHEMERAL, allowedMentions: NO_MENTIONS });

// A normal message in the channel. Never throws.
async function say(channel, content, allowedMentions = NO_MENTIONS) {
  try {
    return await channel.send({ content, allowedMentions });
  } catch (err) {
    console.error('[tickets] could not send a message in the ticket channel:', err.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
//  The ticket card (the message with the buttons)
// ---------------------------------------------------------------------------
function footerParts() {
  const ref = config.banners && config.banners.footer;
  if (!ref) return { gallery: null, files: [] };
  if (/^https?:\/\//i.test(ref)) {
    return { gallery: new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(ref)), files: [] };
  }
  const file = path.join(ASSET_DIR, ref);
  if (!fs.existsSync(file)) return { gallery: null, files: [] };
  return {
    gallery: new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(`attachment://${ref}`)),
    files: [new AttachmentBuilder(file, { name: ref })],
  };
}

function cardPayload(ticket) {
  const type = typeFor(ticket);
  const claimed = ticket.claimedBy;
  const status = claimed ? `🟢 Claimed by <@${claimed}>` : '🟡 Waiting for staff';

  const info =
    `**Opened by:** <@${ticket.userId}>\n` +
    `**Opened:** <t:${Math.floor(ticket.createdAt / 1000)}:R>\n` +
    `**Status:** ${status}`;
  const welcome =
    (type.welcome || 'Please explain your issue in as much detail as you can.') +
    '\n\nA staff member will be with you shortly. **Please do not ping staff**, they have already been notified.';

  const claimButton = claimed
    ? new ButtonBuilder().setCustomId('ticket:unclaim').setLabel('Unclaim').setStyle(ButtonStyle.Secondary)
    : new ButtonBuilder().setCustomId('ticket:claim').setLabel('Claim').setStyle(ButtonStyle.Primary);
  const transcriptButton = new ButtonBuilder()
    .setCustomId('ticket:transcript')
    .setLabel('Transcript')
    .setStyle(ButtonStyle.Secondary);
  const closeButton = new ButtonBuilder().setCustomId('ticket:close').setLabel('Close').setStyle(ButtonStyle.Danger);

  const container = new ContainerBuilder();
  if (config.accentColor !== null && config.accentColor !== undefined) container.setAccentColor(config.accentColor);
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `## ${type.emoji ? type.emoji + ' ' : ''}${type.label} • Ticket #${num(ticket.number)}`,
    ),
  );
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(info));
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(welcome));
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
  container.addActionRowComponents(new ActionRowBuilder().addComponents(claimButton, transcriptButton, closeButton));

  const footer = footerParts();
  if (footer.gallery) {
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    container.addMediaGalleryComponents(footer.gallery);
  }
  return { components: [container], flags: V2, files: footer.files, allowedMentions: NO_MENTIONS };
}

// Re-draws the card in the channel (used by slash commands, buttons use interaction.update)
async function refreshCard(channel, ticket) {
  if (!ticket.controlMessageId) return false;
  try {
    const message = await channel.messages.fetch(ticket.controlMessageId);
    await message.edit(cardPayload(ticket));
    return true;
  } catch (err) {
    console.error('[tickets] could not refresh the ticket card:', err.message);
    return false;
  }
}

// ---------------------------------------------------------------------------
//  Opening a ticket
// ---------------------------------------------------------------------------
function describeCreateError(err) {
  if (err && err.code === 50013) {
    return 'I am missing permissions. Staff: give my role **Manage Channels** and **Manage Roles** (Administrator is easiest).';
  }
  if (err && err.code === 50035) {
    return 'Discord rejected the ticket settings. Staff: check `ticketCategory` and `roles.staff` in config.js, and that the ticket category is not full (50 channels max).';
  }
  return 'Something went wrong creating your ticket. Please let staff know.';
}

// typeOrId = an id from config.ticketTypes, or a full type object (the shop ticket uses this).
// Returns the text to show the person.
async function createTicket(interaction, typeOrId) {
  const type = typeof typeOrId === 'string' ? config.ticketTypes.find((t) => t.id === typeOrId) : typeOrId;
  if (!type) return 'That ticket type does not exist any more.';
  const { guild, user, client } = interaction;

  const open = Object.entries(db.data.tickets).filter(
    ([id, t]) => t.userId === user.id && guild.channels.cache.has(id),
  );
  if (open.length >= config.maxOpenTicketsPerUser) {
    return `You already have an open ticket: <#${open[0][0]}>`;
  }

  const staffRoles = [config.roles.staff, ...(type.extraRoles || [])].filter(Boolean);
  const allow = [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AttachFiles, P.EmbedLinks];
  const overwrites = [
    { id: guild.roles.everyone.id, deny: [P.ViewChannel] },
    { id: user.id, allow },
    { id: client.user.id, allow: [...allow, P.ManageChannels, P.ManageMessages] },
    ...staffRoles.map((id) => ({ id, allow })),
  ];

  const number = (db.data.ticketCounter || 0) + 1;
  const name = `${String(type.id).toLowerCase().replace(/[^a-z0-9-]/g, '') || 'ticket'}-${num(number)}`;

  let channel;
  try {
    channel = await guild.channels.create({
      name,
      type: ChannelType.GuildText,
      parent: config.channels.ticketCategory || null,
      topic: `${type.label} ticket #${num(number)} for ${user.username} (${user.id})`,
      permissionOverwrites: overwrites,
    });
  } catch (err) {
    console.error('[tickets] could not create the ticket channel:', err);
    return describeCreateError(err);
  }

  db.data.ticketCounter = number;
  const ticket = {
    number,
    userId: user.id,
    type: type.id,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    claimedBy: null,
    controlMessageId: null,
    reminded: false,
  };
  db.data.tickets[channel.id] = ticket;
  db.save();

  // Messages made of panels cannot carry normal text, so the ping is its own message.
  if (type.pingStaff !== false) {
    await say(
      channel,
      [`${user}`, ...staffRoles.map((id) => `<@&${id}>`)].join(' '),
      { users: [user.id], roles: staffRoles },
    );
  } else {
    await say(channel, `${user}`, { users: [user.id] });
  }

  try {
    const card = await channel.send(cardPayload(ticket));
    ticket.controlMessageId = card.id;
    db.save();
  } catch (err) {
    console.error('[tickets] could not post the ticket card:', err);
    await say(channel, '⚠️ I could not post the ticket buttons. Staff can still help you here, and can use `/ticket close` to close it.');
  }

  return `Your ticket has been created: ${channel}`;
}

// ---------------------------------------------------------------------------
//  Claiming
// ---------------------------------------------------------------------------
// These return null on success, or a sentence explaining why not.
function claim(ticket, member) {
  if (!isStaff(member)) return 'Only staff can claim tickets.';
  if (ticket.claimedBy === member.id) return 'You have already claimed this ticket.';
  if (ticket.claimedBy) return `This ticket was already claimed by <@${ticket.claimedBy}>.`;
  ticket.claimedBy = member.id;
  db.save();
  return null;
}

function unclaim(ticket, member) {
  if (!isStaff(member)) return 'Only staff can unclaim tickets.';
  if (!ticket.claimedBy) return 'This ticket is not claimed.';
  if (ticket.claimedBy !== member.id && !member.permissions.has(P.Administrator)) {
    return `Only <@${ticket.claimedBy}> (or an admin) can unclaim this ticket.`;
  }
  ticket.claimedBy = null;
  db.save();
  return null;
}

// ---------------------------------------------------------------------------
//  Transcripts
// ---------------------------------------------------------------------------
async function fetchMessages(channel, max = 1000) {
  const all = [];
  let before;
  while (all.length < max) {
    const batch = await channel.messages.fetch({ limit: 100, before });
    if (!batch.size) break;
    all.push(...batch.values());
    before = batch.last().id;
    if (batch.size < 100) break;
  }
  return all.reverse(); // oldest first
}

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// very light markdown on text that is already escaped
const fmt = (s) =>
  s
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');

function messageHtml(m) {
  const files = m.attachments ? [...m.attachments.values()] : [];
  const embeds = m.embeds || [];
  const text = m.cleanContent || m.content || '';
  if (!text && !files.length && !embeds.length) return ''; // skip panels / empty messages

  const when = new Date(m.createdTimestamp).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const name = esc((m.member && m.member.displayName) || m.author.globalName || m.author.username);
  const avatar = esc(m.author.displayAvatarURL({ extension: 'png', size: 64 }));
  const bot = m.author.bot ? ' <span class="bot">BOT</span>' : '';
  const edited = m.editedTimestamp ? ' <span class="edited">(edited)</span>' : '';

  const embedHtml = embeds
    .map((e) => {
      const color = esc(e.hexColor || '#5865F2');
      const fields = (e.fields || [])
        .map((f) => `<div class="field"><b>${esc(f.name)}</b><br>${fmt(esc(f.value))}</div>`)
        .join('');
      return (
        `<div class="embed" style="border-left-color:${color}">` +
        (e.title ? `<div class="etitle">${esc(e.title)}</div>` : '') +
        (e.description ? `<div class="edesc">${fmt(esc(e.description))}</div>` : '') +
        fields +
        `</div>`
      );
    })
    .join('');

  const fileHtml = files
    .map((a) => {
      const url = esc(a.url);
      return a.contentType && a.contentType.startsWith('image/')
        ? `<div class="file"><a href="${url}"><img src="${url}" alt="${esc(a.name)}"></a></div>`
        : `<div class="file">📎 <a href="${url}">${esc(a.name)}</a></div>`;
    })
    .join('');

  return (
    `<div class="msg"><img class="avatar" src="${avatar}" alt="">` +
    `<div class="body"><div class="head"><span class="author">${name}</span>${bot}` +
    `<span class="time">${when}</span>${edited}</div>` +
    (text ? `<div class="text">${fmt(esc(text))}</div>` : '') +
    embedHtml +
    fileHtml +
    `</div></div>`
  );
}

function buildTranscriptHtml({ guildName, channelName, ticket, typeLabel, messages, closedBy, reason }) {
  const opener = messages.find((m) => m.author.id === ticket.userId);
  const openerName = opener ? opener.author.username : 'unknown';
  const body = messages.map(messageHtml).join('') || '<p class="empty">No messages were sent in this ticket.</p>';
  const opened = new Date(ticket.createdAt).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const closed = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ticket #${num(ticket.number)} - ${esc(channelName)}</title>
<style>
  body { background:#313338; color:#dbdee1; font-family:"Helvetica Neue",Arial,sans-serif; margin:0; padding:24px; }
  .wrap { max-width:900px; margin:0 auto; }
  .header { border-bottom:1px solid #3f4147; padding-bottom:16px; margin-bottom:16px; }
  .header h1 { margin:0 0 8px; font-size:22px; color:#f2f3f5; }
  .header p { margin:3px 0; color:#b5bac1; font-size:13px; }
  .msg { display:flex; padding:8px 0; }
  .avatar { width:40px; height:40px; border-radius:50%; margin-right:12px; flex-shrink:0; background:#1e1f22; }
  .body { flex:1; min-width:0; }
  .author { font-weight:600; color:#f2f3f5; margin-right:8px; }
  .bot { background:#5865f2; color:#fff; font-size:10px; border-radius:3px; padding:1px 4px; margin-right:8px; }
  .time, .edited { font-size:11px; color:#949ba4; }
  .text { white-space:pre-wrap; word-wrap:break-word; line-height:1.4; margin-top:2px; }
  .text a, .file a, .edesc a { color:#00a8fc; }
  code { background:#1e1f22; padding:1px 4px; border-radius:3px; }
  .embed { border-left:4px solid #5865f2; background:#2b2d31; border-radius:4px; padding:10px 12px; margin-top:6px; max-width:520px; }
  .etitle { font-weight:600; margin-bottom:4px; color:#f2f3f5; }
  .edesc, .field { font-size:14px; white-space:pre-wrap; margin-top:4px; }
  .file { margin-top:6px; font-size:13px; }
  .file img { max-width:400px; max-height:300px; border-radius:8px; }
  .empty { color:#949ba4; }
  .footer { border-top:1px solid #3f4147; margin-top:20px; padding-top:12px; color:#949ba4; font-size:12px; }
</style>
</head>
<body><div class="wrap">
  <div class="header">
    <h1>🎫 ${esc(typeLabel)} • Ticket #${num(ticket.number)}</h1>
    <p><b>Server:</b> ${esc(guildName)} &nbsp; <b>Channel:</b> #${esc(channelName)}</p>
    <p><b>Opened by:</b> ${esc(openerName)} (${esc(ticket.userId)}) &nbsp; <b>Opened:</b> ${opened}</p>
    <p><b>Claimed by:</b> ${ticket.claimedBy ? esc(ticket.claimedBy) : 'nobody'} &nbsp; <b>Closed:</b> ${closed}</p>
    <p><b>Closed by:</b> ${esc(closedBy)}${reason ? ` &nbsp; <b>Reason:</b> ${esc(reason)}` : ''}</p>
  </div>
  ${body}
  <div class="footer">Transcript generated automatically by the ${esc(config.name || 'server')} bot.</div>
</div></body>
</html>`;
}

// Builds a transcript file of the ticket as it is right now
async function transcriptFile(channel, ticket, extra = {}) {
  const messages = await fetchMessages(channel);
  const html = buildTranscriptHtml({
    guildName: channel.guild.name,
    channelName: channel.name,
    ticket,
    typeLabel: typeFor(ticket).label,
    messages,
    closedBy: extra.closedBy || 'still open',
    reason: extra.reason || '',
  });
  return { messages, bytes: Buffer.from(html, 'utf8'), name: `transcript-${num(ticket.number)}.html` };
}

// ---------------------------------------------------------------------------
//  Closing
// ---------------------------------------------------------------------------
// closer = a Discord user. Returns { ok: true } or { ok: false, error: '...' }
async function closeTicket(channel, closer, reason = '') {
  const ticket = getTicket(channel.id);
  if (!ticket) return { ok: false, error: 'This is not an active ticket.' };
  if (closing.has(channel.id)) return { ok: false, error: 'This ticket is already being closed.' };
  closing.add(channel.id);

  try {
    await say(
      channel,
      `🔒 Ticket closed by ${closer}${reason ? `: ${reason}` : ''}\nSaving the transcript. This channel will be deleted in a few seconds...`,
    );

    let file;
    try {
      file = await transcriptFile(channel, ticket, { closedBy: closer.username || String(closer.id), reason });
    } catch (err) {
      console.error('[tickets] could not build the transcript:', err);
      await say(channel, '⚠️ I could not build the transcript, so I am **not** deleting this channel. Check that I can read message history here, then close the ticket again.');
      return { ok: false, error: 'I could not build the transcript, so the ticket was kept open.' };
    }
    const makeAttachment = () => new AttachmentBuilder(file.bytes, { name: file.name });

    // 1) Save to the staff logs channel. If that fails, keep the ticket so nothing is lost.
    if (config.channels.ticketLogs) {
      let saved = false;
      try {
        const logChannel = await channel.client.channels.fetch(config.channels.ticketLogs);
        const type = typeFor(ticket);
        const embed = new EmbedBuilder()
          .setTitle(`🎫 Ticket #${num(ticket.number)} closed`)
          .setColor(0xf28c28)
          .addFields(
            { name: 'Type', value: String(type.label).slice(0, 1024), inline: true },
            { name: 'Opened by', value: `<@${ticket.userId}>`, inline: true },
            { name: 'Claimed by', value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : 'Nobody', inline: true },
            { name: 'Closed by', value: `<@${closer.id}>`, inline: true },
            { name: 'Opened', value: `<t:${Math.floor(ticket.createdAt / 1000)}:R>`, inline: true },
            { name: 'Messages', value: String(file.messages.length), inline: true },
          )
          .setTimestamp();
        if (reason) embed.addFields({ name: 'Reason', value: String(reason).slice(0, 1024) });
        await logChannel.send({ embeds: [embed], files: [makeAttachment()], allowedMentions: NO_MENTIONS });
        saved = true;
      } catch (err) {
        console.error('[tickets] could not post the transcript to the logs channel:', err);
      }
      if (!saved) {
        await say(
          channel,
          '⚠️ I could not save the transcript to the ticket logs channel, so I am **not** deleting this channel. ' +
            'Check my permissions there and `channels.ticketLogs` in config.js, then close the ticket again.',
        );
        return { ok: false, error: 'I could not post the transcript to the logs channel, so the ticket was kept open.' };
      }
    }

    // 2) DM the person who opened it
    if (settings().dmTranscript) {
      const opener = await channel.client.users.fetch(ticket.userId).catch(() => null);
      if (opener) {
        await opener
          .send({
            content: `Your ticket **#${num(ticket.number)}** in **${channel.guild.name}** was closed. A transcript is attached (open it in your browser).`,
            files: [makeAttachment()],
          })
          .catch(() => {}); // their DMs may be closed
      }
    }

    // 3) Forget it and delete the channel
    delete db.data.tickets[channel.id];
    db.save();
    setTimeout(async () => {
      try {
        await channel.delete(`Ticket #${num(ticket.number)} closed`);
      } catch (err) {
        console.error('[tickets] could not delete the ticket channel:', err.message);
        await say(channel, '⚠️ The ticket is closed and saved, but I could not delete this channel. I need the **Manage Channels** permission. Staff can delete it by hand.');
      }
    }, 5000);

    return { ok: true };
  } finally {
    closing.delete(channel.id);
  }
}

// ---------------------------------------------------------------------------
//  Button and form handlers (called from handlers/interactions.js)
// ---------------------------------------------------------------------------
function closeModal() {
  return new ModalBuilder()
    .setCustomId('ticketclose')
    .setTitle('Close this ticket')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('reason')
          .setLabel('Reason (optional)')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setMaxLength(300),
      ),
    );
}

async function handleButton(interaction) {
  const ticket = getTicket(interaction.channelId);
  if (!ticket) return replyPrivate(interaction, 'This ticket is no longer active.');
  const staff = isStaff(interaction.member);

  switch (interaction.customId) {
    case 'ticket:claim': {
      const problem = claim(ticket, interaction.member);
      if (problem) return replyPrivate(interaction, problem);
      try {
        await interaction.update(cardPayload(ticket));
      } catch (err) {
        ticket.claimedBy = null; // undo, so the button works again
        db.save();
        throw err;
      }
      await say(interaction.channel, `✅ ${interaction.user} has claimed this ticket.`);
      return;
    }

    case 'ticket:unclaim': {
      const previous = ticket.claimedBy;
      const problem = unclaim(ticket, interaction.member);
      if (problem) return replyPrivate(interaction, problem);
      try {
        await interaction.update(cardPayload(ticket));
      } catch (err) {
        ticket.claimedBy = previous;
        db.save();
        throw err;
      }
      await say(interaction.channel, `↩️ ${interaction.user} has unclaimed this ticket.`);
      return;
    }

    case 'ticket:close': {
      if (!staff && interaction.user.id !== ticket.userId) {
        return replyPrivate(interaction, 'Only staff or the ticket owner can close this ticket.');
      }
      return interaction.showModal(closeModal());
    }

    case 'ticket:transcript': {
      if (!staff) return replyPrivate(interaction, 'Only staff can get the transcript.');
      await interaction.deferReply({ flags: EPHEMERAL });
      const file = await transcriptFile(interaction.channel, ticket);
      return interaction.editReply({
        content: 'Here is the transcript so far. Open the file in your browser.',
        files: [new AttachmentBuilder(file.bytes, { name: file.name })],
      });
    }
  }
}

async function handleCloseModal(interaction) {
  const ticket = getTicket(interaction.channelId);
  if (!ticket) return replyPrivate(interaction, 'This ticket is no longer active.');
  if (!isStaff(interaction.member) && interaction.user.id !== ticket.userId) {
    return replyPrivate(interaction, 'Only staff or the ticket owner can close this ticket.');
  }
  const reason = interaction.fields.getTextInputValue('reason').trim();
  await interaction.reply({ content: '🔒 Closing this ticket...', flags: EPHEMERAL });
  const result = await closeTicket(interaction.channel, interaction.user, reason);
  if (!result.ok) await interaction.followUp({ content: result.error, flags: EPHEMERAL }).catch(() => {});
}

// ---------------------------------------------------------------------------
//  Background jobs: remember activity, auto-close idle tickets
// ---------------------------------------------------------------------------
async function sweep(client) {
  const hours = Number(settings().autoCloseHours) || 0;
  if (!hours) return;
  const limit = hours * 3600 * 1000;
  const now = Date.now();

  for (const [channelId, ticket] of Object.entries(db.data.tickets)) {
    const channel = client.channels.cache.get(channelId);
    if (!channel) continue;
    const idle = now - (ticket.lastActivity || ticket.createdAt);

    if (idle >= limit) {
      await closeTicket(channel, client.user, `No activity for ${hours} hour(s)`);
    } else if (!ticket.reminded && idle >= limit / 2) {
      ticket.reminded = true;
      db.save();
      await say(
        channel,
        `<@${ticket.userId}> this ticket will close automatically in about ${Math.max(1, Math.round(hours / 2))} hour(s) unless someone replies.`,
        { users: [ticket.userId] },
      );
    }
  }
}

function init(client) {
  client.on(Events.MessageCreate, (message) => {
    if (message.author.bot) return;
    const ticket = db.data.tickets[message.channelId];
    if (ticket) {
      ticket.lastActivity = Date.now();
      ticket.reminded = false;
    }
  });
  setInterval(() => sweep(client).catch((err) => console.error('[tickets] auto-close check failed:', err)), 10 * 60 * 1000);
}

module.exports = {
  init,
  createTicket,
  handleButton,
  handleCloseModal,
  closeTicket,
  claim,
  unclaim,
  refreshCard,
  say,
  transcriptFile,
  buildTranscriptHtml,
};
