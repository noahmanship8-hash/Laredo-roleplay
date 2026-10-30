require('dotenv').config();
require('./utils/restFix').install();

const fs = require('node:fs');
const path = require('node:path');
const {
  Client,
  Collection,
  GatewayIntentBits,
  Events,
  AuditLogEvent,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

const db = require('./utils/db');
const onInteraction = require('./handlers/interactions');
const { startAutoRefresh } = require('./utils/session');
const tickets = require('./utils/tickets');
const config = require('./config');

if (!process.env.DISCORD_TOKEN) {
  console.error(
    'Missing DISCORD_TOKEN. Copy .env.example to .env and fill it in (see README.md).'
  );
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers, // Required for member join events & counts
  ],
  partials: [Partials.Channel, Partials.Message],
});

// Load every file in /commands.
client.commands = new Collection();

const commandsDir = path.join(__dirname, 'commands');

for (const file of fs.readdirSync(commandsDir).filter((f) => f.endsWith('.js'))) {
  const command = require(path.join(commandsDir, file));
  client.commands.set(command.data.name, command);
}

client.once(Events.ClientReady, (c) => {
  console.log(
    `Logged in as ${c.user.tag}. Loaded ${client.commands.size} commands.`
  );

  require('./utils/channel-locks').start(client);
  startAutoRefresh(client);
  tickets.init(client);
});

require('./utils/server-logs').install(client);
client.on(Events.InteractionCreate, onInteraction);

// DM ban appeals: !appeal <case number> <reason>
client.on(Events.MessageCreate, async (message) => {
  if (
    message.author.bot ||
    message.guild ||
    !message.content.toLowerCase().startsWith('!appeal ')
  ) {
    return;
  }

  const match = message.content.match(
    /^!appeal\s+(\d+)\s+([\s\S]{3,1000})$/i
  );

  if (!match) {
    await message.reply(
      'Use `!appeal <case number> <reason>`.'
    ).catch(() => {});
    return;
  }

  const caseId = Number(match[1]);
  const reason = match[2].trim();

  const record = db.data.cases.find(
    (c) =>
      c.guildId === process.env.GUILD_ID &&
      c.id === caseId &&
      c.userId === message.author.id &&
      c.type === 'ban'
  );

  if (!record || record.removed) {
    await message.reply(
      'I could not find an active ban case with that number for you.'
    ).catch(() => {});
    return;
  }

  if (db.data.appeals[String(caseId)]?.status === 'pending') {
    await message.reply(
      'An appeal for that case is already pending.'
    ).catch(() => {});
    return;
  }

  const guild = await client.guilds
    .fetch(process.env.GUILD_ID)
    .catch(() => null);

  const channelId = guild
    ? db.data.appealChannels[guild.id] || config.channels.modLogs
    : null;

  const channel =
    guild && channelId
      ? await guild.channels.fetch(channelId).catch(() => null)
      : null;

  if (!channel?.isTextBased()) {
    await message.reply(
      'Appeals are not configured right now.'
    ).catch(() => {});
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`Appeal · Case #${caseId}`)
    .setColor(0xF0B232)
    .addFields(
      {
        name: 'Member',
        value: `${message.author.tag} (${message.author.id})`,
      },
      {
        name: 'Case',
        value: `Ban · ${record.reason}`,
      },
      {
        name: 'Appeal reason',
        value: reason,
      }
    );

  const posted = await channel.send({
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`appeal:approve:${caseId}`)
          .setLabel('Approve')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`appeal:deny:${caseId}`)
          .setLabel('Deny')
          .setStyle(ButtonStyle.Danger)
      ),
    ],
    allowedMentions: { parse: [] },
  }).catch((err) => {
    console.error('[appeal post]', err);
    return null;
  });

  if (!posted) {
    await message.reply(
      'I could not send your appeal. Please contact staff.'
    ).catch(() => {});
    return;
  }

  db.data.appeals[String(caseId)] = {
    guildId: guild.id,
    userId: message.author.id,
    status: 'pending',
    reason,
    messageId: posted.id,
    channelId: channel.id,
  };

  db.save();

  await message.reply(
    'Your appeal has been sent to staff for review.'
  ).catch(() => {});
});

// ==========================================
// UNIFIED GUILD MEMBER ADD EVENT HANDLER
// ==========================================
function getOrdinalSuffix(n) {
  const remainder100 = n % 100;
  if (remainder100 >= 11 && remainder100 <= 13) return `${n}th`;
  const remainder10 = n % 10;
  switch (remainder10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

client.on(Events.GuildMemberAdd, async (member) => {
  // 1. Handle Unverified Role & Verification Database/Kick Timeout logic
  const verification = db.data.verification[member.guild.id];

  if (verification?.enabled && verification.unverifiedRoleId) {
    try {
      await member.roles.add(verification.unverifiedRoleId, 'Verification gate');

      db.data.pendingVerification[`${member.guild.id}:${member.id}`] = Date.now();
      db.save();
    } catch (err) {
      console.error('[verification join role error]', err);
    }
  }

  // 2. Send the Welcome Message & Green Button to your Welcome Channel
  try {
    const WELCOME_CHANNEL_ID = '1564763886882922537';
    const VERIFY_CHANNEL_ID = '1554214429757935729';

    const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID)
                 || await member.guild.channels.fetch(WELCOME_CHANNEL_ID).catch(() => null);

    if (channel) {
      const memberCount = member.guild.memberCount;
      const countFormatted = getOrdinalSuffix(memberCount);
      const verifyUrl = `https://discord.com/channels/${member.guild.id}/${VERIFY_CHANNEL_ID}`;

      const verifyButton = new ButtonBuilder()
        .setLabel('Verify Here')
        .setStyle(ButtonStyle.Link)
        .setURL(verifyUrl);

      const row = new ActionRowBuilder().addComponents(verifyButton);

      const msgContent = `Welcome <@${member.id}> to **Laredo Roleplay** you are our ${countFormatted} member!\n` +
                         `> Please Verify in https://discord.com/channels/${member.guild.id}/${VERIFY_CHANNEL_ID}, to gain full access to our sever.`;

      const welcomeEmbed = new EmbedBuilder()
        .setTitle('👋 Welcome to Laredo Roleplay!')
        .setDescription(msgContent)
        .setColor('#57F287')
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: `User ID: ${member.id}` });

      await channel.send({
        content: `Welcome <@${member.id}>!`,
        embeds: [welcomeEmbed],
        components: [row]
      });
    }
  } catch (error) {
    console.error('[welcome message error]', error);
  }
});

// Expire pending verifications after the configured timeout.
setInterval(async () => {
  for (const [key, joinedAt] of Object.entries(
    db.data.pendingVerification
  )) {
    const [guildId, userId] = key.split(':');
    const verification = db.data.verification[guildId];

    if (
      !verification?.enabled ||
      !verification.timeoutMinutes ||
      Date.now() - joinedAt <
        verification.timeoutMinutes * 60_000
    ) {
      continue;
    }

    const guild = await client.guilds
      .fetch(guildId)
      .catch(() => null);

    const member = guild
      ? await guild.members.fetch(userId).catch(() => null)
      : null;

    if (member) {
      await member.kick(
        'Did not complete verification'
      ).catch(() => null);
    }

    delete db.data.pendingVerification[key];
    db.save();
  }
}, 60_000);

// Anti-nuke monitoring for destructive audit-log actions.
const destructiveActions = new Set([
  AuditLogEvent.ChannelDelete,
  AuditLogEvent.RoleDelete,
  AuditLogEvent.MemberBanAdd,
  AuditLogEvent.MemberKick,
  AuditLogEvent.WebhookCreate,
  AuditLogEvent.MemberPrune,
]);

const recentActions = new Map();

client.on(
  Events.GuildAuditLogEntryCreate,
  async (entry, guild) => {
    const settings = db.data.antinuke[guild.id];

    if (
      !settings?.enabled ||
      !destructiveActions.has(entry.action) ||
      !entry.executorId
    ) {
      return;
    }

    const actor = entry.executorId;

    if (
      actor === guild.ownerId ||
      actor === client.user.id ||
      settings.whitelist.includes(actor)
    ) {
      return;
    }

    const now = Date.now();
    const key = `${guild.id}:${actor}`;

    const list = (
      recentActions.get(key) || []
    ).filter(
      (timestamp) =>
        now - timestamp < settings.windowSeconds * 1000
    );

    list.push(now);
    recentActions.set(key, list);

    if (list.length < settings.threshold) return;

    recentActions.delete(key);

    const member = await guild.members
      .fetch(actor)
      .catch(() => null);

    let outcome = 'Member could not be found';

    if (member) {
      try {
        if (settings.punishment === 'ban') {
          await member.ban({
            reason: 'Anti-nuke protection triggered',
          });
          outcome = 'Banned';
        } else if (settings.punishment === 'kick') {
          await member.kick(
            'Anti-nuke protection triggered'
          );
          outcome = 'Kicked';
        } else {
          await member.timeout(
            28 * 24 * 60 * 60 * 1000,
            'Anti-nuke protection triggered'
          );
          outcome = 'Timed out for 28 days';
        }
      } catch (err) {
        outcome = `Could not punish member: ${err.message}`;
      }
    }

    const channel = settings.logChannelId
      ? await guild.channels
          .fetch(settings.logChannelId)
          .catch(() => null)
      : null;

    if (channel?.isTextBased()) {
      await channel.send({
        content:
          `🚨 Anti-nuke triggered for <@${actor}> ` +
          `(${list.length} destructive actions in ` +
          `${settings.windowSeconds}s). ${outcome}.`,
        allowedMentions: { parse: [] },
      }).catch(console.error);
    }
  }
);

// If someone deletes a ticket channel manually, forget it
// so the user can open a new one.
client.on(Events.ChannelDelete, (channel) => {
  if (db.data.tickets[channel.id]) {
    delete db.data.tickets[channel.id];
    db.save();
  }
});

process.on('unhandledRejection', (err) => {
  console.error('[unhandled rejection]', err);
});

client.login(process.env.DISCORD_TOKEN);
