'use strict';

// Requires discord.js 14.19.0 or newer (Components V2 support).
// If your bot uses CommonJS, this can replace commands/session.js.
const fs = require('node:fs');
const path = require('node:path');
const {
  ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle,
  ComponentType, ContainerBuilder, MediaGalleryBuilder, MessageFlags,
  PermissionFlagsBits, SeparatorBuilder, SlashCommandBuilder, TextDisplayBuilder,
} = require('discord.js');
const db = require('../utils/db');
const { pullFromErlc, refreshPanel } = require('../utils/session');

const STAFF_PERMISSION = PermissionFlagsBits.ManageEvents;
const VOTE_PING_ROLE_ID = '';
const SESSION_PING_ROLE_ID = '1557829275015712829';
const SERVER_NAME = 'Laredo Roleplay | VC Only';
const SERVER_CODE = 'EATCX';
const JOIN_URL = `https://policeroleplay.community/join/${encodeURIComponent(SERVER_CODE)}`;
// Optional: enter channel IDs to display clickable channel mentions.
const RULES_CHANNEL_ID = '';
const GAME_INFO_CHANNEL_ID = '';
const DEFAULT_VOTE_MINUTES = 60;
const MAX_VOTE_MINUTES = 7 * 24 * 60;
const MAX_YES_VOTES = 1000;
const ANNOUNCEMENT_LIFETIME = 20 * 60 * 1000;
const VOTER_MENTIONS_PER_MESSAGE = 35;
const SESSION_INFO_PATH = path.join(__dirname, '..', 'assets', 'session_info.png');
const DIVIDER_BAR_PATH = path.join(__dirname, '..', 'assets', 'divider_bar.png');
const YES_BUTTON_ID = 'laredo_session_vote:yes';
const NO_BUTTON_ID = 'laredo_session_vote:no';
const activeVotes = new Map();
const text = (content) => new TextDisplayBuilder().setContent(content);

function yesAndNoVotes(vote) {
  let yes = 0;
  let no = 0;
  for (const choice of vote.choices.values()) {
    if (choice === 'yes') yes++;
    if (choice === 'no') no++;
  }
  return { yes, no };
}
function progressBar(yes, target) {
  const filled = Math.min(14, Math.round((yes / target) * 14));
  return `${'█'.repeat(filled)}${'░'.repeat(14 - filled)}`;
}
function addImage(container, filePath, name, files) {
  if (!fs.existsSync(filePath)) {
    console.warn(`[session] Image not found: ${filePath}`);
    return;
  }
  files.push(new AttachmentBuilder(filePath, { name }));
  container.addMediaGalleryComponents(
    new MediaGalleryBuilder().addItems((item) => item.setURL(`attachment://${name}`)),
  );
}
// Attachment references are retained when editing an existing vote message.
function sessionCard(body, { color = 0x393a41, includeFiles = true } = {}) {
  const files = [];
  const container = new ContainerBuilder().setAccentColor(color);
  addImage(container, SESSION_INFO_PATH, 'session_info.png', files);
  container.addSeparatorComponents(new SeparatorBuilder());
  container.addTextDisplayComponents(text(body));
  container.addSeparatorComponents(new SeparatorBuilder());
  addImage(container, DIVIDER_BAR_PATH, 'divider_bar.png', files);
  return { container, files: includeFiles ? files : [] };
}
function voteBody(vote, actor = null) {
  const { yes, no } = yesAndNoVotes(vote);
  let heading;
  let description;
  if (vote.status === 'active') {
    heading = 'Session Vote';
    description = 'Should we start a Laredo Roleplay session? Choose **Yes** or **No** below.\n' +
      `The session starts automatically at **${vote.target} Yes votes**. You can change your vote, but you only count once.\n\n` +
      `**Voting closes:** <t:${Math.floor(vote.expiresAt / 1000)}:R>`;
  } else if (vote.status === 'passed') {
    heading = 'Session Vote Passed!';
    description = `The target of **${vote.target} Yes votes** was reached. A Laredo Roleplay session start has been triggered.`;
  } else if (vote.status === 'manual') {
    heading = 'Session Started!';
    description = 'Staff started the Laredo Roleplay session, so this vote has closed.';
  } else if (vote.status === 'cancelled') {
    heading = 'Session Vote Cancelled';
    description = actor ? `This vote was cancelled by ${actor}.` : 'This vote was cancelled by staff.';
  } else {
    heading = 'Session Vote Ended';
    description = 'Voting ended before the target was reached. Staff can create another vote with `/session vote`.';
  }
  return `# ${heading}\n` +
    `-# LAREDO ROLEPLAY • COMMUNITY SESSIONS\n\n${description}\n\n` +
    `### Vote Progress\n` +
    `**✅ Yes:** ${yes} / ${vote.target}　•　**❌ No:** ${no}\n` +
    `\`${progressBar(yes, vote.target)}\`\n\n` +
    `-# Started by ${vote.createdBy.tag} • Each member counts once.`;
}
function voteButtons(vote, disabled = false) {
  const { yes, no } = yesAndNoVotes(vote);
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(YES_BUTTON_ID).setLabel(`Yes (${yes})`)
      .setEmoji('✅').setStyle(ButtonStyle.Success).setDisabled(disabled),
    new ButtonBuilder().setCustomId(NO_BUTTON_ID).setLabel(`No (${no})`)
      .setEmoji('❌').setStyle(ButtonStyle.Danger).setDisabled(disabled),
  );
}
function votePayload(vote, { initial = false, actor = null } = {}) {
  const { container, files } = sessionCard(voteBody(vote, actor), { includeFiles: initial });
  const components = [];
  if (VOTE_PING_ROLE_ID) components.push(text(`<@&${VOTE_PING_ROLE_ID}>`));
  components.push(container, voteButtons(vote, vote.status !== 'active'));
  return {
    components,
    allowedMentions: { parse: [], roles: initial && VOTE_PING_ROLE_ID ? [VOTE_PING_ROLE_ID] : [] },
    ...(initial ? { flags: MessageFlags.IsComponentsV2, files } : {}),
  };
}
async function requireStaff(interaction) {
  if (interaction.memberPermissions?.has(STAFF_PERMISSION)) return true;
  await interaction.reply({ content: 'You do not have permission to manage sessions.', flags: MessageFlags.Ephemeral });
  return false;
}
async function updateSessionPanel(client) {
  try {
    if (!(await refreshPanel(client))) console.warn('[session] Panel not refreshed. Check session.channelId and session.messageId.');
  } catch (error) { console.error('[session panel]', error); }
}
function scheduleAnnouncementDeletion(message) {
  const timer = setTimeout(() => {
    message.delete().catch((error) => {
      if (error.code !== 10008) console.error('[session] Could not delete timed announcement:', error);
    });
  }, ANNOUNCEMENT_LIFETIME);
  timer.unref?.();
}
async function sendTimedAnnouncement(channel, { voterIds = [], pingSessionRole = true } = {}) {
  const rules = RULES_CHANNEL_ID ? `<#${RULES_CHANNEL_ID}>` : '**rules**';
  const information = GAME_INFO_CHANNEL_ID ? `<#${GAME_INFO_CHANNEL_ID}>` : '**game-information**';
  const { container, files } = sessionCard(
    '# Session Started!\n' +
    '-# LAREDO ROLEPLAY • COMMUNITY SESSIONS\n\n' +
    '**Laredo Roleplay is now in session!**\n' +
    'Join us for quality roleplay and help bring the city to life.\n\n' +
    '### Before You Join\n' +
    `Please read ${rules} and ${information} before joining the server.\n\n` +
    '### Server Information\n' +
    `**Server:** ${SERVER_NAME}\n**Join Code:** \`${SERVER_CODE}\`\n\n` +
    '-# Ready to join? Use the Join Server button below.',
  );
  const voters = [...new Set(voterIds)];
  const first = voters.splice(0, VOTER_MENTIONS_PER_MESSAGE);
  const mentions = [];
  if (pingSessionRole && SESSION_PING_ROLE_ID) mentions.push(`<@&${SESSION_PING_ROLE_ID}>`);
  if (first.length) mentions.push(`**Voters:** ${first.map((id) => `<@${id}>`).join(' ')}`);
  const components = [];
  if (mentions.length) components.push(text(mentions.join(' | ')));
  components.push(container, new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel('Join Server').setStyle(ButtonStyle.Link).setURL(JOIN_URL),
  ));
  const announcement = await channel.send({
    flags: MessageFlags.IsComponentsV2, components, files,
    allowedMentions: { parse: [], users: first, roles: pingSessionRole && SESSION_PING_ROLE_ID ? [SESSION_PING_ROLE_ID] : [] },
  });
  scheduleAnnouncementDeletion(announcement);
  for (let i = 0; i < voters.length; i += VOTER_MENTIONS_PER_MESSAGE) {
    const chunk = voters.slice(i, i + VOTER_MENTIONS_PER_MESSAGE);
    const message = await channel.send({
      content: `**Voters:** ${chunk.map((id) => `<@${id}>`).join(' ')}`,
      allowedMentions: { parse: [], users: chunk, roles: [] },
    });
    scheduleAnnouncementDeletion(message);
  }
  return announcement;
}
async function runSessionStart({ interaction = null, channel = null, vote = null }) {
  const targetChannel = channel || interaction?.channel;
  if (!targetChannel) throw new Error('No channel supplied for the session announcement.');
  db.data.session.status = 'online';
  db.data.session.updatedAt = Date.now();
  db.save();
  try { await pullFromErlc(); } catch (error) { console.error('[session] Live stats refresh failed:', error); }
  const voterIds = vote ? [...vote.choices].filter(([, choice]) => choice === 'yes').map(([id]) => id) : [];
  await sendTimedAnnouncement(targetChannel, { voterIds, pingSessionRole: true });
  await updateSessionPanel(interaction?.client || targetChannel.client);
}
function removeActiveVote(vote) {
  if (activeVotes.get(vote.channelId) === vote) activeVotes.delete(vote.channelId);
}
async function closeVote(vote, status, actor = null) {
  if (vote.status !== 'active') return;
  vote.status = status;
  removeActiveVote(vote);
  vote.collector?.stop(status);
  try { await vote.message.edit(votePayload(vote, { actor })); }
  catch (error) { console.error('[session] Could not edit closed vote:', error); }
}
async function handleVoteButton(vote, button) {
  if (vote.status !== 'active') {
    await button.followUp({ content: 'This session vote has already closed.', flags: MessageFlags.Ephemeral });
    return;
  }
  const choice = button.customId === YES_BUTTON_ID ? 'yes' : 'no';
  if (vote.choices.get(button.user.id) === choice) {
    await button.followUp({ content: `Your **${choice.toUpperCase()}** vote is already counted. Use the other button to change it.`, flags: MessageFlags.Ephemeral });
    return;
  }
  vote.choices.set(button.user.id, choice);
  if (yesAndNoVotes(vote).yes >= vote.target) {
    vote.status = 'passed';
    removeActiveVote(vote);
    vote.collector?.stop('passed');
    // Start even if updating the old vote message fails.
    try { await vote.message.edit(votePayload(vote)); }
    catch (error) { console.error('[session] Could not update passed vote:', error); }
    await runSessionStart({ channel: vote.message.channel, vote });
    return;
  }
  await vote.message.edit(votePayload(vote));
}
async function startVote(interaction) {
  const existing = activeVotes.get(interaction.channel.id);
  if (existing?.status === 'active') {
    await interaction.reply({ content: `There is already an active vote: ${existing.message.url}`, flags: MessageFlags.Ephemeral });
    return;
  }
  const duration = interaction.options.getInteger('duration') ?? DEFAULT_VOTE_MINUTES;
  const createdAt = Date.now();
  const vote = {
    channelId: interaction.channel.id, createdBy: interaction.user, createdAt,
    expiresAt: createdAt + duration * 60_000,
    target: interaction.options.getInteger('votes', true), choices: new Map(),
    status: 'active', message: null, collector: null, queue: Promise.resolve(),
  };
  await interaction.reply(votePayload(vote, { initial: true }));
  vote.message = await interaction.fetchReply();
  vote.collector = vote.message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    filter: (button) => [YES_BUTTON_ID, NO_BUTTON_ID].includes(button.customId),
    time: duration * 60_000,
  });
  activeVotes.set(vote.channelId, vote);
  vote.collector.on('collect', (button) => {
    // Acknowledge immediately, before waiting for earlier votes in the queue.
    const acknowledgement = button.deferUpdate().then(() => true).catch((error) => {
      console.error('[session] Could not acknowledge vote:', error);
      return false;
    });
    vote.queue = vote.queue.then(async () => {
      if (await acknowledgement) await handleVoteButton(vote, button);
    }).catch(async (error) => {
      console.error('[session] Could not process vote:', error);
      try {
        await button.followUp({ content: 'Something went wrong processing that vote. Please contact staff.', flags: MessageFlags.Ephemeral });
      } catch (replyError) { console.error('[session] Could not answer voter:', replyError); }
    });
  });
  vote.collector.on('end', (_collected, reason) => {
    if (reason === 'time') {
      vote.queue = vote.queue.then(() => closeVote(vote, 'expired')).catch(console.error);
    }
  });
}
async function startManually(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const existing = activeVotes.get(interaction.channel.id);
  if (existing?.status === 'active') await closeVote(existing, 'manual');
  await runSessionStart({ interaction });
  await interaction.editReply('Laredo Roleplay session started.');
}
async function boostSession(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await sendTimedAnnouncement(interaction.channel, { pingSessionRole: false });
  await interaction.editReply('Laredo Roleplay session boost posted without pinging anyone.');
}
async function stopSession(interaction) {
  await interaction.deferReply();
  const existing = activeVotes.get(interaction.channel.id);
  if (existing?.status === 'active') await closeVote(existing, 'cancelled', interaction.user);
  Object.assign(db.data.session, { status: 'offline', players: 0, moderating: 0, queue: 0, updatedAt: Date.now() });
  db.save();
  await interaction.editReply({ content: `**Laredo Roleplay — Session Stopped**\nThe session has been stopped by ${interaction.user}.`, allowedMentions: { parse: [] } });
  await updateSessionPanel(interaction.client);
}
async function cancelVote(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const existing = activeVotes.get(interaction.channel.id);
  if (!existing || existing.status !== 'active') {
    await interaction.editReply('There is no active session vote in this channel.');
    return;
  }
  await closeVote(existing, 'cancelled', interaction.user);
  await interaction.editReply('The Laredo Roleplay session vote has been cancelled.');
}
module.exports = {
  data: new SlashCommandBuilder()
    .setName('session').setDescription('Manage Laredo Roleplay sessions and votes')
    .setDefaultMemberPermissions(STAFF_PERMISSION).setDMPermission(false)
    .addSubcommand((sub) => sub.setName('vote').setDescription('Start a vote that opens a Laredo RP session at your chosen target')
      .addIntegerOption((opt) => opt.setName('votes').setDescription('Yes votes needed to start').setRequired(true).setMinValue(1).setMaxValue(MAX_YES_VOTES))
      .addIntegerOption((opt) => opt.setName('duration').setDescription(`Voting duration in minutes (default: ${DEFAULT_VOTE_MINUTES})`).setMinValue(1).setMaxValue(MAX_VOTE_MINUTES)))
    .addSubcommand((sub) => sub.setName('start').setDescription('Start a Laredo RP session immediately'))
    .addSubcommand((sub) => sub.setName('stop').setDescription('Stop the session and mark the panel offline'))
    .addSubcommand((sub) => sub.setName('boost').setDescription('Post a Laredo RP session announcement without pings'))
    .addSubcommand((sub) => sub.setName('cancel').setDescription('Cancel the active session vote')),
  async execute(interaction) {
    if (!interaction.guildId || !interaction.channel) {
      await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
      return;
    }
    if (!(await requireStaff(interaction))) return;
    const handlers = { vote: startVote, start: startManually, stop: stopSession, boost: boostSession, cancel: cancelVote };
    await handlers[interaction.options.getSubcommand()](interaction);
  },
};
